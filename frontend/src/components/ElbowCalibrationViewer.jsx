import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Center, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function ElbowModel({ elbowAngle }) {
  const { scene, nodes } = useGLTF('/models/elbow.glb');
  
  // Forearm and hand node in the elbow.glb model
  const forearmNode = nodes['WristArm'];

  // Initialize shadows and material properties
  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Apply a smooth matte grey/flesh shader to show off muscle contours
          child.material.roughness = 0.6;
          child.material.metalness = 0.1;
        }
      });
    }
  }, [scene]);

  // Frame loop for smooth interpolation
  useFrame(() => {
    if (forearmNode) {
      // Bends from 180° (fully extended, straight) to 90° (fully flexed, bent)
      // Map 180 -> 0 degrees, 90 -> 90 degrees bend
      const bendDeg = 180 - elbowAngle; 
      
      // Bending rotation around local Y-axis (negative to bend forward in front view)
      const targetRotation = THREE.MathUtils.degToRad(-bendDeg);

      forearmNode.rotation.y = THREE.MathUtils.lerp(
        forearmNode.rotation.y,
        targetRotation,
        0.15
      );
    }
  });

  return (
    // Align to side profile to match the reference image (biceps facing side)
    <group rotation={[0, -Math.PI / 2, 0]} scale={[2.0, 2.0, 2.0]} position={[0, -0.1, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export default function ElbowCalibrationViewer({ elbowAngle = 180 }) {
  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        camera={{ position: [0, 0.05, 1.85], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} />
        
        <Center>
          <ElbowModel elbowAngle={elbowAngle} />
        </Center>
        
        <OrbitControls enableZoom={true} enablePan={false} maxDistance={4} minDistance={1.0} />
      </Canvas>
    </div>
  );
}
