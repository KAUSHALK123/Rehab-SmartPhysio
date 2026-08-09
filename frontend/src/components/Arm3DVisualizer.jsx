import React, { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Center } from '@react-three/drei';
import * as THREE from 'three';

// 3D Human Rig Component for Kinematics Overview
function FullBodyRig() {
  // Load full_rig GLB from public/models directory
  const { scene, nodes } = useGLTF('/models/full_rig.glb');
  const groupRef = useRef();

  // Log node hierarchy once during development for future joint mapping steps
  useEffect(() => {
    if (nodes) {
      console.log('[FullBodyRig] Loaded full_rig.glb node hierarchy:', Object.keys(nodes));
    }
  }, [nodes]);

  // Initial model position, scale, and side-turned orientation
  // Turned slightly towards the right arm/hand for visual focus
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
          <FullBodyRig />
        </Center>
        
        {/* OrbitControls: zoom & orbit enabled, pan disabled to prevent uncontrolled movement */}
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
