import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Center } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Degree to radian conversion helper
const degToRad = (degrees) => ((degrees || 0) * Math.PI) / 180;

// 3D Human Rig Component for Kinematics Overview
function FullBodyRig({ controls, injuredArm = 'Right' }) {
  // Load full_rig GLB from public/models directory
  const { scene } = useGLTF('/models/full_rig.glb');
  
  // Clone the scene for this specific instance to support multiple canvases (split view)
  const clonedScene = React.useMemo(() => {
    return scene.clone ? SkeletonUtils.clone(scene) : scene;
  }, [scene]);

  const groupRef = useRef();
  const baseRotationsRef = useRef({});

  // Capture initial/base GLB joint rotations once to prevent snapping
  useEffect(() => {
    if (clonedScene && !baseRotationsRef.current.initialized) {
      const getBone = (name) => typeof clonedScene.getObjectByName === 'function' ? clonedScene.getObjectByName(name) : null;
      
      const bicepRight = getBone('bicep_right');
      const rightForearm = getBone('right_forearm');
      const circleWrist = getBone('Circle');

      const fingerNames = [
        'thumb1', 'thumb2',
        'index1', 'index2', 'index3',
        'middle1', 'middle2', 'middle3',
        'ring1', 'ring2', 'ring3',
        'little1', 'little2', 'little3'
      ];

      const initialBases = {
        initialized: true,
        bicep_right: bicepRight ? { x: bicepRight.rotation.x, y: bicepRight.rotation.y, z: bicepRight.rotation.z } : { x: 0, y: 0, z: 0 },
        right_forearm: rightForearm ? { x: rightForearm.rotation.x, y: rightForearm.rotation.y, z: rightForearm.rotation.z } : { x: 0, y: 0, z: 0 },
        Circle: circleWrist ? { x: circleWrist.rotation.x, y: circleWrist.rotation.y, z: circleWrist.rotation.z } : { x: 0, y: 0, z: 0 },
      };

      fingerNames.forEach(name => {
        const bone = getBone(name);
        if (bone) {
          initialBases[name] = { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z };
        }
      });

      baseRotationsRef.current = initialBases;
      console.log('[FullBodyRig] Captured base rotations:', baseRotationsRef.current);
    }
  }, [clonedScene]);

  // Frame loop for smooth real-time joint rotations
  useFrame(() => {
    if (!clonedScene || !baseRotationsRef.current.initialized) return;

    const getBone = (name) => typeof clonedScene.getObjectByName === 'function' ? clonedScene.getObjectByName(name) : null;

    const bicepRight = getBone('bicep_right');
    const rightForearm = getBone('right_forearm');
    const circleWrist = getBone('Circle');
    const bases = baseRotationsRef.current;

    // 1. Shoulder Forward/Back & Side/Twist (bicep_right)
    if (bicepRight && bases.bicep_right) {
      const targetZ = bases.bicep_right.z + degToRad(controls?.shoulderAngle || 0);
      const targetX = bases.bicep_right.x + degToRad(controls?.shoulderAngleX || 0);

      bicepRight.rotation.z = THREE.MathUtils.lerp(bicepRight.rotation.z, targetZ, 0.15);
      bicepRight.rotation.x = THREE.MathUtils.lerp(bicepRight.rotation.x, targetX, 0.15);
    }

    // 2. Elbow Angle (right_forearm)
    if (rightForearm && bases.right_forearm) {
      const targetElbowZ = bases.right_forearm.z + degToRad(controls?.elbowAngle || 0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, targetElbowZ, 0.15);
    }

    // 3. Wrist Angle (Circle - Hand/Wrist assembly)
    if (circleWrist && bases.Circle) {
      const targetWristZ = bases.Circle.z + degToRad(controls?.wristAngle || 0);
      circleWrist.rotation.z = THREE.MathUtils.lerp(circleWrist.rotation.z, targetWristZ, 0.15);
    }

    // 4. Fingers Flexion (thumb, index, middle, ring, little)
    const fingers = [
      { name: 'thumb', joints: ['thumb1', 'thumb2'], val: controls?.thumb !== undefined ? controls.thumb : 30 },
      { name: 'index', joints: ['index1', 'index2', 'index3'], val: controls?.index !== undefined ? controls.index : 30 },
      { name: 'middle', joints: ['middle1', 'middle2', 'middle3'], val: controls?.middle !== undefined ? controls.middle : 30 },
      { name: 'ring', joints: ['ring1', 'ring2', 'ring3'], val: controls?.ring !== undefined ? controls.ring : 30 },
      { name: 'little', joints: ['little1', 'little2', 'little3'], val: controls?.little !== undefined ? controls.little : 30 },
    ];

    fingers.forEach(f => {
      // Map flex sensor value (e.g. 0 to 100) to bending angle in radians (e.g. 0 to 75 degrees)
      const flexAngle = degToRad((f.val / 100) * 75);
      
      f.joints.forEach(j => {
        const bone = getBone(j);
        const base = bases[j];
        if (bone && base) {
          // Bending around Z axis for fingers in this rig coordinate frame
          const targetZ = base.z - flexAngle;
          bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, targetZ, 0.15);
        }
      });
    });
  });

  // Initial model position, scale, and side-turned orientation
  // Mirror model along X-axis if Left arm is injured
  const scaleX = injuredArm === 'Left' ? -1.1 : 1.1;

  return (
    <group ref={groupRef} rotation={[0, -Math.PI / 4, 0]} scale={[scaleX, 1.1, 1.1]} position={[0, -0.6, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Helper component to smoothly transition camera views
function CameraController({ cameraAngle, controlsRef }) {
  const { camera } = useThree();

  useFrame(() => {
    // Front View: [0.2, 0.4, 3.2]
    // Side View: [2.8, 0.6, 1.5] (side-on focusing on the right arm)
    const targetPos = cameraAngle === 'side'
      ? new THREE.Vector3(2.8, 0.6, 1.5)
      : new THREE.Vector3(0.2, 0.4, 3.2);

    camera.position.lerp(targetPos, 0.08);

    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });

  return null;
}

// Main Canvas container component for Dashboard Kinematics Overview
export default function Arm3DVisualizer({ controls, cameraAngle = 'straight', disableOrbit = false, injuredArm = 'Right' }) {
  const controlsRef = useRef();

  return (
    <div className="w-full h-full min-h-[380px] relative select-none">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0.2, 0.4, 3.2], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 10]} intensity={1.2} />
        <directionalLight position={[-10, -10, -10]} intensity={0.4} />
        <pointLight position={[0, 2, 3]} intensity={0.5} />
        
        <Center position={[0, 0, 0]}>
          <FullBodyRig controls={controls} injuredArm={injuredArm} />
        </Center>
        
        {/* Dynamic camera transitions */}
        <CameraController cameraAngle={cameraAngle} controlsRef={controlsRef} />
        
        {/* OrbitControls: zoom & orbit enabled, pan disabled */}
        <OrbitControls 
          ref={controlsRef}
          enableZoom={!disableOrbit} 
          enableRotate={!disableOrbit} 
          enablePan={false} 
          minDistance={1.5}
          maxDistance={5.5}
          target={[0.1, 0.2, 0]}
        />
        
        {/* Subtle ground/grid helper */}
        <Grid 
          infiniteGrid
          fadeDistance={20}
          sectionColor="#3B82F6"
          cellColor="#1E3A8A"
          position={[0, -2.2, 0]}
        />
      </Canvas>
    </div>
  );
}

// Preload full_rig.glb for smooth initial load
useGLTF.preload('/models/full_rig.glb');
