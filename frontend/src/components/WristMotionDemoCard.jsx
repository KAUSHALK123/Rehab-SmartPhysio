import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ChevronUp, ChevronDown, RotateCcw, Box, Eye } from 'lucide-react';
import { applyCalibratedWristRotation } from '../services/wristSensorMapper';

/**
 * Inner 3D GLB Rig Component that performs the animated wrist exercise demonstration.
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
      // Wrist Flexion: hand bends downward from 0° (neutral) to +maxDeg and back
      // Using smooth sine wave shifted to oscillate between 0 and 1
      const progress = (Math.sin(t * 2.2 - Math.PI / 2) + 1) / 2;
      const deg = progress * maxDeg;
      angles.x = deg;
      liveAngleVal = Math.round(deg);
    } else if (isExtension) {
      // Wrist Extension: hand bends upward from 0° to -maxDeg and back
      const progress = (Math.sin(t * 2.2 - Math.PI / 2) + 1) / 2;
      const deg = progress * maxDeg;
      angles.x = -deg;
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
      // Generic upDown / flexion & extension combined
      const progress = Math.sin(t * 2.0);
      const deg = progress * maxDeg;
      angles.x = deg;
      liveAngleVal = Math.round(Math.abs(deg));
    }

    if (onAngleTick) {
      onAngleTick(liveAngleVal);
    }

    // Apply rotation to GLB Circle bone with smooth interpolation
    applyCalibratedWristRotation(circle, base, angles, 0.25);

    // Keep camera target smoothly locked on the moving hand/wrist
    if (controlsRef.current) {
      const targetVec = new THREE.Vector3();
      circle.getWorldPosition(targetVec);
      targetVec.y -= 0.12; // Center focus slightly lower onto palm
      controlsRef.current.target.lerp(targetVec, 0.1);
      controlsRef.current.update();
    }
  });

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, -2, 3]} intensity={0.7} />
      <pointLight position={[0.4, -0.6, 1.2]} intensity={0.6} />

      {/* 3D Human Rig Group with exact matching scale and rotation */}
      <group rotation={[0, -Math.PI / 4, 0]} scale={[1.1, 1.1, 1.1]} position={[0, -0.6, 0]}>
        <primitive object={clonedScene} />
      </group>

      <OrbitControls 
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
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
 * directly inside the 3D viewport overlay.
 */
export default function WristMotionDemoCard({
  exerciseName = 'Wrist Flexion',
  movementId = 'upDown',
  targetAngle = 50,
  className = ''
}) {
  const [collapsed, setCollapsed] = useState(false);
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
  let motionRange = `0° → ${targetAngle}°`;
  let motionCues = 'Bend wrist downward to target, then return to neutral';
  let repFormula = '1 Rep = Down & Up';

  if (isFlexion) {
    motionTitle = 'Wrist Flexion';
    motionSubtitle = 'Bend Downward';
    motionRange = `0° → ${targetAngle}°`;
    motionCues = 'Bend wrist downward smoothly, then return to rest';
    repFormula = '1 Rep = Down & Up';
  } else if (isExtension) {
    motionTitle = 'Wrist Extension';
    motionSubtitle = 'Bend Upward';
    motionRange = `0° → ${targetAngle}°`;
    motionCues = 'Bend wrist upward smoothly, then return to rest';
    repFormula = '1 Rep = Up & Down';
  } else if (isRotation) {
    motionTitle = 'Wrist Rotation';
    motionSubtitle = 'Rotate Left ↔ Right';
    motionRange = `±${targetAngle || 45}°`;
    motionCues = 'Rotate hand fully to left, then fully to right';
    repFormula = '1 Rep = Left + Right';
  } else if (isDeviation) {
    motionTitle = 'Wrist Deviation';
    motionSubtitle = 'Wave Side-to-Side';
    motionRange = `±${targetAngle || 30}°`;
    motionCues = 'Wave hand toward thumb, then toward pinky side';
    repFormula = '1 Rep = Left + Right';
  } else if (isFlexExtension) {
    motionTitle = 'Flexion & Extension';
    motionSubtitle = 'Up ↕ Down';
    motionRange = `±${targetAngle || 45}°`;
    motionCues = 'Alternate bending downward and upward';
    repFormula = '1 Rep = Down + Up';
  }

  return (
    <div 
      className={`bg-slate-950/90 backdrop-blur-md border border-slate-800/90 rounded-2xl shadow-2xl p-3 text-slate-100 select-none transition-all duration-300 w-56 sm:w-64 ${className}`}
      style={{ boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)' }}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <Box className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
            3D GLB Demo
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-slate-300 bg-slate-900 border border-slate-750 px-1.5 py-0.5 rounded-md font-mono">
            {motionRange}
          </span>
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title={collapsed ? "Expand exercise guide" : "Collapse exercise guide"}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Card Body */}
      {!collapsed && (
        <div className="pt-2 space-y-2">
          {/* Subtitle & Direction Badge */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white text-[13px]">{motionTitle}</span>
            <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              {motionSubtitle}
            </span>
          </div>

          {/* 3D GLB Animated Viewport */}
          <div className="relative w-full h-36 bg-gradient-to-b from-slate-900/90 to-slate-950 rounded-xl border border-slate-800/80 overflow-hidden shadow-inner">
            {/* Live Angle Tag inside 3D viewport */}
            <div className="absolute top-2 left-2 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg px-2 py-0.5 text-[9px] font-bold font-mono text-cyan-400 flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>DEMO: {currentLiveAngle}°</span>
            </div>

            <div className="absolute top-2 right-2 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg px-2 py-0.5 text-[9px] font-bold text-slate-300 shadow-sm">
              Aim: {targetAngle}°
            </div>

            {/* Three.js Canvas with the actual 3D GLB Model */}
            <div className="w-full h-full">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  Loading 3D Model...
                </div>
              }>
                <Canvas
                  camera={{ position: [0.5, -0.9, 1.1], fov: 36 }}
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

          {/* Clinical Motion Cues */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2 px-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-400">Rep Guide</span>
              <span className="font-bold text-sky-400 bg-sky-950/70 border border-sky-850 px-1.5 py-0.2 rounded">
                {repFormula}
              </span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug font-medium">
              {motionCues}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
