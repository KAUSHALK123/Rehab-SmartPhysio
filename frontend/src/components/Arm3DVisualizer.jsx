import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Center } from '@react-three/drei';
import * as THREE from 'three';

// Degree to radian conversion helper
const degToRad = (degrees) => ((degrees || 0) * Math.PI) / 180;

// 3D Human Rig Component for Kinematics Overview
function FullBodyRig({ controls }) {
  // Load full_rig GLB from public/models directory
  const { scene, nodes } = useGLTF('/models/full_rig.glb');
  const groupRef = useRef();
  const baseRotationsRef = useRef({});

  // Capture initial/base GLB joint rotations once to prevent snapping
  useEffect(() => {
    if (nodes && !baseRotationsRef.current.initialized) {
      const bicepRight = nodes['bicep_right'];
      const rightForearm = nodes['right_forearm'];
      const circleWrist = nodes['Circle'];

      baseRotationsRef.current = {
        initialized: true,
        bicep_right: bicepRight ? { x: bicepRight.rotation.x, y: bicepRight.rotation.y, z: bicepRight.rotation.z } : { x: 0, y: 0, z: 0 },
        right_forearm: rightForearm ? { x: rightForearm.rotation.x, y: rightForearm.rotation.y, z: rightForearm.rotation.z } : { x: 0, y: 0, z: 0 },
        Circle: circleWrist ? { x: circleWrist.rotation.x, y: circleWrist.rotation.y, z: circleWrist.rotation.z } : { x: 0, y: 0, z: 0 },
      };

      console.log('[FullBodyRig] Captured base rotations:', baseRotationsRef.current);
    }
  }, [nodes]);

  // Frame loop for smooth real-time joint rotations
  useFrame(() => {
    if (!nodes || !baseRotationsRef.current.initialized) return;

    const bicepRight = nodes['bicep_right'];
    const rightForearm = nodes['right_forearm'];
    const circleWrist = nodes['Circle'];
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
  });

  // Initial model position, scale, and side-turned orientation
  return (
    <group ref={groupRef} rotation={[0, -Math.PI / 4, 0]} scale={[1.1, 1.1, 1.1]} position={[0, -0.6, 0]}>
      <primitive object={scene} />
    </group>
  );
}

// Main Canvas container component for Dashboard Kinematics Overview
export default function Arm3DVisualizer({ controls }) {
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
          <FullBodyRig controls={controls} />
        </Center>
        
        {/* OrbitControls: zoom & orbit enabled, pan disabled */}
        <OrbitControls 
          enableZoom={true} 
          enableRotate={true} 
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
