import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

// Axis mapping configuration: X and Z are the two rotation axes. Y is NOT used.
const WRIST_AXES = {
  sideToSide: 'z', // LEFT ↔ RIGHT
  bend: 'x',       // UP ↕ DOWN
};

function WristModel({ sideAngle, bendAngle }) {
  const { scene, nodes } = useGLTF('/models/wrist1.glb');
  
  // Locate Hand and WristArm nodes
  const handNode = nodes['Hand'];
  const wristArmNode = nodes['WristArm'];

  // Initialize orientation once if needed to ensure natural upright right-hand posture.
  useEffect(() => {
    if (scene) {
      // Reset any local scale or translation if necessary, ensuring it centers cleanly.
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [scene]);

  // Frame loop for smooth interpolation (no unnecessary React re-renders)
  useFrame(() => {
    if (handNode) {
      // Convert degrees to radians (-45 to +45)
      const targetSide = THREE.MathUtils.degToRad(sideAngle);
      const targetBend = THREE.MathUtils.degToRad(bendAngle);

      // Smoothly interpolate rotation to target angles
      handNode.rotation[WRIST_AXES.sideToSide] = THREE.MathUtils.lerp(
        handNode.rotation[WRIST_AXES.sideToSide],
        targetSide,
        0.15
      );
      handNode.rotation[WRIST_AXES.bend] = THREE.MathUtils.lerp(
        handNode.rotation[WRIST_AXES.bend],
        targetBend,
        0.15
      );
    }
  });

  return (
    <group rotation={[0, 0, Math.PI]} position={[0, -0.35, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export default function WristCalibrationViewer({ sideAngle = 0, bendAngle = 0 }) {
  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        camera={{ position: [0, 0, 2.2], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} />
        
        <Center>
          <WristModel sideAngle={sideAngle} bendAngle={bendAngle} />
        </Center>
      </Canvas>
    </div>
  );
}
