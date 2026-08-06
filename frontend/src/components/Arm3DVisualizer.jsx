import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Center } from '@react-three/drei';
import * as THREE from 'three';

// 3D Model Inner Component to handle bone rotations
function RiggedArmModel({ controls }) {
  // Load rigged GLB from public directory
  const gltf = useGLTF('/muscle_ARM1.glb');
  const groupRef = useRef();

  // Reset materials to have a premium neon-wireframe holographic look
  useEffect(() => {
    if (gltf.scene) {
      console.log("=== 3D Model Node Structure ===");
      gltf.scene.traverse((child) => {
        if (child.isMesh || child.isBone || child.name.includes('shoulder')) {
          console.log(`Node name: '${child.name}', isMesh: ${!!child.isMesh}, isBone: ${!!child.isBone}, parent: '${child.parent ? child.parent.name : "none"}'`);
        }
        if (child.isMesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#3B82F6'),
            emissive: new THREE.Color('#1E3A8A'),
            roughness: 0.1,
            metalness: 0.8,
            transparent: true,
            opacity: 0.85,
            transmission: 0.6,
            thickness: 1.5,
            wireframe: false,
            side: THREE.DoubleSide
          });
        }
      });
    }
  }, [gltf.scene]);

  // Frame loop to animate bone rotations based on controls prop
  useFrame(() => {
    if (!gltf.nodes) return;

    // 1. Shoulder rotation
    const shoulderNode = gltf.nodes['shoulder'];
    if (shoulderNode) {
      const shoulderRad = (controls.shoulder * Math.PI) / 180;
      shoulderNode.rotation.y = THREE.MathUtils.lerp(shoulderNode.rotation.y, shoulderRad, 0.1);
    }

    // 2. Upper arm (shoulder.001) / Elbow flexion
    const upperArmNode = gltf.nodes['shoulder.001'];
    if (upperArmNode) {
      // Map elbow angle (typically 90 to 180 degrees)
      const elbowRad = ((controls.elbow - 90) * Math.PI) / 180;
      upperArmNode.rotation.z = THREE.MathUtils.lerp(upperArmNode.rotation.z, elbowRad, 0.1);
    }

    // 3. Forearm rotation (pronation/supination)
    const forearmFullNode = gltf.nodes['forearm_full'];
    const forearmBackNode = gltf.nodes['forearm_back'];
    const forearmRad = (controls.forearm * Math.PI) / 180;
    if (forearmFullNode) {
      forearmFullNode.rotation.y = THREE.MathUtils.lerp(forearmFullNode.rotation.y, forearmRad, 0.1);
    }
    if (forearmBackNode) {
      forearmBackNode.rotation.y = THREE.MathUtils.lerp(forearmBackNode.rotation.y, forearmRad, 0.1);
    }

    // 4. Fingers flexion (curl index, middle, ring, little, thumb)
    const fingerRad = (controls.finger * Math.PI) / 180;
    const fingerPrefixes = ['index', 'middle', 'ring', 'little', 'thumb'];
    fingerPrefixes.forEach((prefix) => {
      // Loop over three sub-joints within fingers
      for (let j = 1; j <= 3; j++) {
        const boneNode = gltf.nodes[`${prefix}${j}`];
        if (boneNode) {
          // Curl inwards
          boneNode.rotation.z = THREE.MathUtils.lerp(boneNode.rotation.z, -fingerRad * 0.4, 0.1);
        }
      }
    });
  });

  return (
    <primitive 
      ref={groupRef}
      object={gltf.scene} 
      scale={0.8}
      position={[0, -1, 0]}
    />
  );
}

// Main Canvas container component
export default function Arm3DVisualizer({ controls }) {
  return (
    <div className="w-full h-full min-h-[350px] relative select-none">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [5, 4, 8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.5} />
        
        {/* Futuristic cyan/blue spotlights */}
        <pointLight position={[10, 10, 10]} intensity={2} color="#60A5FA" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#3B82F6" />
        <directionalLight position={[0, 10, 0]} intensity={1.5} color="#A7F3D0" />
        
        <Center>
          <RiggedArmModel controls={controls} />
        </Center>
        
        <OrbitControls 
          enableZoom={true} 
          enablePan={true}
          maxPolarAngle={Math.PI / 2 + 0.1}
          minDistance={3}
          maxDistance={12}
        />
        
        {/* Holographic floor grid */}
        <Grid
          position={[0, -2, 0]}
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={1}
          cellColor="#3B82F6"
          sectionSize={2}
          sectionThickness={1.5}
          sectionColor="#60A5FA"
          fadeDistance={25}
          fadeStrength={1}
          infiniteGrid
        />
      </Canvas>

      {/* Floating Interactive Instructions Hint */}
      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-slate-900/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/30 text-[10px] text-blue-300 font-semibold tracking-wider uppercase pointer-events-none shadow-lg">
        Drag to rotate model • Scroll to zoom
      </div>
    </div>
  );
}

// Pre-load the asset to prevent loading lag
useGLTF.preload('/muscle_ARM1.glb');
