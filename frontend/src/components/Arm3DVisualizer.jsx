import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Center } from '@react-three/drei';
import * as THREE from 'three';

// 3D Model Inner Component to handle bone rotations
function RiggedArmModel({ controls }) {
  // Load rigged GLB from public directory
  const gltf = useGLTF('/trial.glb');
  const groupRef = useRef();

  // Frame loop to animate bone rotations based on controls prop
  useFrame(() => {
    if (!gltf.nodes) return;

    // Convert degrees to radians
    const shoulderAngleRadians = (controls.shoulderAngle * Math.PI) / 180;
    const elbowAngleRadians = (controls.elbowAngle * Math.PI) / 180;
    const wristAngleRadians = (controls.wristAngle * Math.PI) / 180;

    // Find model parts by exact name
    const upperArm = gltf.nodes['UpperArm'];
    const forearm = gltf.nodes['Forearm'];
    const palm = gltf.nodes['Palm'];

    // Apply rotations with smooth interpolation
    if (upperArm) {
      upperArm.rotation.z = THREE.MathUtils.lerp(upperArm.rotation.z, shoulderAngleRadians, 0.1);
    }
    if (forearm) {
      forearm.rotation.z = THREE.MathUtils.lerp(forearm.rotation.z, elbowAngleRadians, 0.1);
    }
    if (palm) {
      palm.rotation.z = THREE.MathUtils.lerp(palm.rotation.z, wristAngleRadians, 0.1);
    }
  });

  return (
    <primitive 
      ref={groupRef}
      object={gltf.scene} 
    />
  );
}

// Main Canvas container component
export default function Arm3DVisualizer({ controls }) {
  return (
    <div className="w-full h-full min-h-[350px] relative select-none">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <directionalLight position={[-10, -10, -10]} intensity={0.5} />
        
        <Center>
          <RiggedArmModel controls={controls} />
        </Center>
        
        {/* OrbitControls: zoom enabled, rotate enabled, pan disabled */}
        <OrbitControls 
          enableZoom={true} 
          enableRotate={true} 
          enablePan={false} 
        />
        
        {/* Subtle ground/grid helper */}
        <Grid 
          infiniteGrid
          fadeDistance={20}
          sectionColor="#3B82F6"
          cellColor="#1E3A8A"
          position={[0, -2, 0]}
        />
      </Canvas>
    </div>
  );
}
