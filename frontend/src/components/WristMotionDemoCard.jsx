import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyCalibratedWristRotation } from '../services/wristSensorMapper';

/**
 * Inner 3D GLB Scene that tightly frames the hand/wrist assembly
 * and performs the looping exercise animation.
 */
function WristRigGLBScene({ 
  isFlexion, 
  isExtension, 
  isRotation, 
  isDeviation, 
  isFlexExtension,
  targetAngle = 50,
  onAngleTick
}) {
  const { scene } = useGLTF('/models/full_rig.glb');
  
  const clonedScene = React.useMemo(() => {
    return scene?.clone ? SkeletonUtils.clone(scene) : scene;
  }, [scene]);

  const circleNodeRef = useRef(null);
  const baseRotationRef = useRef({ x: 0, y: 0, z: 0 });
  const controlsRef = useRef();
  const { camera } = useThree();
  const cameraInitializedRef = useRef(false);

  // Find Circle bone and capture initial base rest orientation
  useEffect(() => {
    if (!clonedScene) return;
    const getNode = (name) =>
      typeof clonedScene.getObjectByName === 'function'
        ? clonedScene.getObjectByName(name)
        : null;

    const circle = getNode('Circle');
    if (circle) {
      circleNodeRef.current = circle;
      baseRotationRef.current = {
        x: circle.rotation.x,
        y: circle.rotation.y,
        z: circle.rotation.z
      };
    }
  }, [clonedScene]);

  useFrame(({ clock }) => {
    const circle = circleNodeRef.current;
    if (!circle) return;

    const t = clock.getElapsedTime();
    const base = baseRotationRef.current;
    let angles = { x: 0, y: 0, z: 0 };
    let liveAngleVal = 0;

    const maxDeg = Math.abs(targetAngle) || 50;

    if (isFlexion) {
      // Wrist Flexion (LOCKED): hand bends downward from 0° (neutral) to +maxDeg and returns
      const progress = (Math.sin(t * 2.2 - Math.PI / 2) + 1) / 2;
      const deg = progress * maxDeg;
      angles.x = deg;
      liveAngleVal = Math.round(deg);
    } else if (isExtension) {
      // Wrist Extension: clean up-and-down movement bending the wrist upward towards the wrist watch (dorsiflexion) and returning down to neutral
      const progress = (Math.sin(t * 2.2 - Math.PI / 2) + 1) / 2;
      const deg = progress * maxDeg;
      angles.x = -deg * 0.5;
      angles.y = -deg * 0.4;
      angles.z = -deg * 0.6;
      liveAngleVal = Math.round(deg);
    } else if (isRotation) {
      // Wrist Rotation: pronation/supination twisting left (-maxDeg) and right (+maxDeg)
      const progress = Math.sin(t * 2.0);
      const deg = progress * (maxDeg * 0.85);
      angles.y = deg;
      liveAngleVal = Math.round(Math.abs(deg));
    } else if (isDeviation) {
      // Radial / Ulnar deviation: waving side-to-side (-maxDeg to +maxDeg)
      const progress = Math.sin(t * 2.0);
      const deg = progress * (maxDeg * 0.7);
      angles.z = deg;
      liveAngleVal = Math.round(Math.abs(deg));
    } else {
      // Generic upDown / flexion & extension combined (downward flexion and upward watch-directed extension)
      const progress = Math.sin(t * 2.0);
      const deg = progress * maxDeg;
      if (deg >= 0) {
        angles.x = deg;
      } else {
        const extDeg = Math.abs(deg);
        angles.x = -extDeg * 0.5;
        angles.y = -extDeg * 0.4;
        angles.z = -extDeg * 0.6;
      }
      liveAngleVal = Math.round(Math.abs(deg));
    }

    if (onAngleTick) {
      onAngleTick(liveAngleVal);
    }

    // Apply rotation to GLB Circle bone with smooth interpolation
    applyCalibratedWristRotation(circle, base, angles, 0.25);

    // Calculate current wrist joint position in world coordinates
    const wristWorldPos = new THREE.Vector3();
    circle.getWorldPosition(wristWorldPos);
    
    // Focus target slightly above palm center so the hand renders positioned lower in the viewport
    const handCenter = new THREE.Vector3(
      wristWorldPos.x + 0.04,
      wristWorldPos.y - 0.10,
      wristWorldPos.z
    );

    // Zoomed an additional 15-20% back (z + 1.15) for comfortable full-hand framing
    if (!cameraInitializedRef.current) {
      camera.position.set(
        wristWorldPos.x + 0.20,
        wristWorldPos.y + 0.04,
        wristWorldPos.z + 1.15
      );
      camera.lookAt(handCenter);

      if (controlsRef.current) {
        controlsRef.current.target.copy(handCenter);
        controlsRef.current.update();
      }
      cameraInitializedRef.current = true;
    } else if (controlsRef.current) {
      // Smoothly track hand pivot center
      controlsRef.current.target.lerp(handCenter, 0.08);
      controlsRef.current.update();
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, -2, 3]} intensity={0.8} />
      <pointLight position={[0.4, -0.6, 1.2]} intensity={0.7} />

      {/* 3D Model Rig */}
      <group rotation={[0, -Math.PI / 4, 0]} scale={[1.1, 1.1, 1.1]} position={[0, -0.6, 0]}>
        <primitive object={clonedScene} />
      </group>

      <OrbitControls 
        ref={controlsRef}
        enableZoom={true}
        enablePan={false}
        minDistance={0.5}
        maxDistance={1.6}
        rotateSpeed={0.5}
      />
    </>
  );
}

/**
 * WristMotionDemoCard
 * 
 * Displays an animated GLB 3D model demonstration of the specific wrist exercise
 * being performed (Wrist Flexion, Wrist Extension, Wrist Rotation, etc.)
 * directly inside the 3D viewport overlay, zoomed in tightly to the wrist and hand,
 * filling the card with the 3D animation.
 */
export default function WristMotionDemoCard({
  exerciseName = 'Wrist Flexion',
  movementId = 'upDown',
  targetAngle = 50,
  className = ''
}) {
  const [currentLiveAngle, setCurrentLiveAngle] = useState(0);

  const nameLower = (exerciseName || '').toLowerCase();
  
  // Movement Classification
  const isFlexion = nameLower.includes('flexion') && !nameLower.includes('extension');
  const isExtension = nameLower.includes('extension') && !nameLower.includes('flexion');
  const isRotation = nameLower.includes('rotation') || nameLower.includes('twist') || nameLower.includes('pronation') || nameLower.includes('supination') || movementId === 'twist';
  const isDeviation = nameLower.includes('radial') || nameLower.includes('ulnar') || nameLower.includes('deviation') || nameLower.includes('hi') || movementId === 'hiMovement';
  const isFlexExtension = !isFlexion && !isExtension && !isRotation && !isDeviation;

  // Clinical Metadata
  let motionTitle = 'Wrist Flexion';
  let motionSubtitle = 'Bend Downward';

  if (isFlexion) {
    motionTitle = 'Wrist Flexion';
    motionSubtitle = 'Bend Downward';
  } else if (isExtension) {
    motionTitle = 'Wrist Extension';
    motionSubtitle = 'Bend Upward';
  } else if (isRotation) {
    motionTitle = 'Wrist Rotation';
    motionSubtitle = 'Rotate Left ↔ Right';
  } else if (isDeviation) {
    motionTitle = 'Wrist Deviation';
    motionSubtitle = 'Wave Side-to-Side';
  } else if (isFlexExtension) {
    motionTitle = 'Flexion & Extension';
    motionSubtitle = 'Up ↕ Down';
  }

  return (
    <div 
      className={`bg-slate-950/92 backdrop-blur-md border border-slate-800/90 rounded-2xl shadow-2xl p-2.5 text-slate-100 select-none transition-all duration-200 w-56 sm:w-64 ${className}`}
      style={{ boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)' }}
    >
      {/* Exercise Title with Demo Badge */}
      <div className="flex items-center justify-between text-xs pb-2 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-white text-[13px] tracking-tight truncate">{motionTitle}</span>
          <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">
            Demo
          </span>
        </div>
        <span className="text-[10px] font-semibold text-slate-300 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded-full shrink-0">
          {motionSubtitle}
        </span>
      </div>

      {/* 3D GLB Animated Viewport Box (Fills the card with 3D animation) */}
      <div className="relative w-full h-52 sm:h-56 bg-gradient-to-b from-slate-900/95 to-slate-950 rounded-xl border border-slate-800/80 overflow-hidden shadow-inner">
        {/* Live Animated Angle Tag inside 3D viewport */}
        <div className="absolute top-2 left-2 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg px-2 py-0.5 text-[9px] font-bold font-mono text-cyan-400 flex items-center gap-1 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>DEMO: {currentLiveAngle}°</span>
        </div>

        <div className="absolute top-2 right-2 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg px-2 py-0.5 text-[9px] font-bold text-slate-300 shadow-sm">
          Aim: {targetAngle}°
        </div>

        {/* Three.js Canvas with the actual 3D GLB Model zoomed tightly */}
        <div className="w-full h-full">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
              Loading 3D Model...
            </div>
          }>
            <Canvas
              camera={{ fov: 30 }}
              gl={{ antialias: true, alpha: true }}
            >
              <WristRigGLBScene 
                isFlexion={isFlexion}
                isExtension={isExtension}
                isRotation={isRotation}
                isDeviation={isDeviation}
                isFlexExtension={isFlexExtension}
                targetAngle={targetAngle}
                onAngleTick={setCurrentLiveAngle}
              />
            </Canvas>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
