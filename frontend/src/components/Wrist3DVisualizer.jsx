import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Center } from '@react-three/drei';
import * as THREE from 'three';

// 3D Model Inner Component to handle wrist/hand rotations
function RiggedWristModel({ roll, pitch }) {
  // Load custom wrist GLB from public directory (using fallback/trial.glb structure for now)
  const gltf = useGLTF('/models/wrist.glb');
  const groupRef = useRef();

  useFrame(() => {
    if (!gltf.nodes) return;

    // Convert degrees to radians
    const rollAngleRadians = (roll * Math.PI) / 180;
    const pitchAngleRadians = (pitch * Math.PI) / 180;

    // The user will build their own custom model. 
    // We will look for a bone/mesh named 'wrist' or fallback to the 'palm' node from the arm model.
    const wristNode = gltf.nodes['wrist'] || gltf.nodes['palm'];

    if (wristNode) {
      // Restrict rotation: Left and Right (Roll)
      wristNode.rotation.z = THREE.MathUtils.lerp(wristNode.rotation.z, rollAngleRadians, 0.1);
      
      // Keep other axes restricted/locked to 0 for now (Left/Right only)
      wristNode.rotation.x = 0;
      wristNode.rotation.y = 0;
    }
  });

  return (
    <primitive 
      ref={groupRef}
      object={gltf.scene} 
    />
  );
}

// Main Canvas container component for Wrist Visualizer
export default function Wrist3DVisualizer({ roll = 0, pitch = 0 }) {
  return (
    <div className="w-full h-full min-h-[160px] relative select-none">
      <Canvas
        camera={{ position: [0, 0.5, 3.5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} />
        
        <Center>
          <RiggedWristModel roll={roll} pitch={pitch} />
        </Center>
        
        <OrbitControls 
          enableZoom={true} 
          enableRotate={true} 
          enablePan={false} 
        />
      </Canvas>
    </div>
  );
}
