import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Center } from '@react-three/drei';
import * as THREE from 'three';

function PressureModel({ pressure }) {
  // Load the wrist1.glb model
  const { scene, nodes } = useGLTF('/models/wrist1.glb');
  const palmNode = nodes['palm'];

  useFrame(() => {
    if (palmNode) {
      // Map pressure (0 to 800 roughly) to a slight squeeze/scale effect
      // When pressure increases, the palm slightly contracts and rotates to simulate a squeeze
      const squeezeFactor = Math.max(0, Math.min(1, pressure / 800));
      
      // Base scale of palm node from inspection is roughly [0.566, 0.566, 0.566]
      // We will multiply the base scale by a factor between 1.0 (no pressure) and 0.9 (max pressure)
      const targetScale = 0.566 * (1.0 - squeezeFactor * 0.08);
      
      // Smoothly interpolate scale for organic movement
      palmNode.scale.x = THREE.MathUtils.lerp(palmNode.scale.x, targetScale, 0.15);
      palmNode.scale.y = THREE.MathUtils.lerp(palmNode.scale.y, targetScale, 0.15);
      palmNode.scale.z = THREE.MathUtils.lerp(palmNode.scale.z, targetScale, 0.15);

      // Slight wrist flex/rotation to show effort when squeezed
      const targetRotationZ = squeezeFactor * 0.15; // Rotate up to 0.15 radians
      palmNode.rotation.z = THREE.MathUtils.lerp(palmNode.rotation.z, targetRotationZ, 0.15);
    }
  });

  return (
    // Rotate to clearly show the palm of the hand facing the camera
    <group rotation={[Math.PI / 8, Math.PI, 0]} scale={[2.5, 2.5, 2.5]} position={[0, -1.0, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export default function PressureCalibrationViewer({ pressure = 0 }) {
  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        camera={{ position: [0, 1.0, 3.5], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} />
        <pointLight position={[0, 2, 2]} intensity={0.8} />
        
        <Center>
          <PressureModel pressure={pressure} />
        </Center>
        
        <OrbitControls enableZoom={true} enablePan={false} maxDistance={6} minDistance={1.5} />
      </Canvas>
    </div>
  );
}

// Preload the model
useGLTF.preload('/models/wrist1.glb');
