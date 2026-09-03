import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Grid, Center } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Degree to radian conversion helper
const degToRad = (degrees) => ((degrees || 0) * Math.PI) / 180;

// 3D Human Rig Component for Kinematics Overview
function FullBodyRig({ controls, injuredArm = 'Right', demoMode = false }) {
  // Load full_rig GLB from public/models directory
  const { scene } = useGLTF('/models/full_rig.glb');
  
  // Clone the scene for this specific instance to support multiple canvases (split view)
  const clonedScene = React.useMemo(() => {
    return scene.clone ? SkeletonUtils.clone(scene) : scene;
  }, [scene]);

  const groupRef = useRef();
  const baseRotationsRef = useRef({ initialized: false });

  // Capture initial/base GLB joint rotations once to prevent snapping
  useEffect(() => {
    if (!clonedScene || baseRotationsRef.current.initialized) return;

    const getNode = (name) =>
      typeof clonedScene.getObjectByName === 'function'
        ? clonedScene.getObjectByName(name)
        : null;

    const fingerNodeNames = [
      'right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little'
    ];

    const initialBases = { initialized: true };

    // Capture all standard joint bases
    const jointNames = ['bicep_right', 'right_forearm', 'Circle', ...fingerNodeNames];
    jointNames.forEach((name) => {
      const node = getNode(name);
      if (node) {
        initialBases[name] = {
          x: node.rotation.x,
          y: node.rotation.y,
          z: node.rotation.z,
        };
      } else {
        initialBases[name] = { x: 0, y: 0, z: 0 };
      }
    });

    baseRotationsRef.current = initialBases;
  }, [clonedScene]);

  // Frame loop for smooth real-time joint rotations
  const lastControlsRef = useRef({});

  useFrame(({ clock }) => {
    if (!clonedScene || !baseRotationsRef.current.initialized) return;

    const t = clock.getElapsedTime();
    let computedControls = controls;

    if (demoMode && (!controls || Object.keys(controls).length === 0)) {
      computedControls = {
        shoulderAngle: Math.sin(t * 0.8) * 8,
        shoulderAngleX: Math.cos(t * 0.7) * 6,
        elbowAngle: 150 - Math.abs(Math.sin(t * 1.2)) * 60,
        wristAngle: Math.sin(t * 1.5) * 35,
        thumb: Math.max(0, Math.sin(t * 1.8) * 45),
        index: Math.max(0, Math.sin(t * 1.8 + 0.2) * 55),
        middle: Math.max(0, Math.sin(t * 1.8 + 0.4) * 60),
        ring: Math.max(0, Math.sin(t * 1.8 + 0.6) * 55),
        little: Math.max(0, Math.sin(t * 1.8 + 0.8) * 50),
      };
    }

    // Use current controls if provided and has valid keys, otherwise fallback to last valid
    const activeControls = (computedControls && Object.keys(computedControls).length > 0) ? computedControls : lastControlsRef.current;
    if (computedControls && Object.keys(computedControls).length > 0) {
      lastControlsRef.current = computedControls;
    }

    const getNode = (name) =>
      typeof clonedScene.getObjectByName === 'function'
        ? clonedScene.getObjectByName(name)
        : null;

    const bases = baseRotationsRef.current;

    // 1. Shoulder Forward/Back & Side/Twist (bicep_right)
    const bicepRight = getNode('bicep_right');
    if (bicepRight) {
      const base = bases.bicep_right || { x: 0, y: 0, z: 0 };
      const targetZ = base.z + degToRad(activeControls?.shoulderAngle || 0);
      const targetX = base.x + degToRad(activeControls?.shoulderAngleX || 0);
      bicepRight.rotation.z = THREE.MathUtils.lerp(bicepRight.rotation.z, targetZ, 0.15);
      bicepRight.rotation.x = THREE.MathUtils.lerp(bicepRight.rotation.x, targetX, 0.15);
    }

    // 2. Elbow Angle (right_forearm)
    const rightForearm = getNode('right_forearm');
    if (rightForearm) {
      const base = bases.right_forearm || { x: 0, y: 0, z: 0 };
      const bendDeg = 180 - (activeControls?.elbowAngle || 180); // 180 = straight -> 0 bend
      const targetElbowZ = base.z - degToRad(bendDeg);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, targetElbowZ, 0.15);
    }

    // 3. Wrist Angle (Circle - Hand/Wrist assembly)
    // Wrist roll should rotate around the forearm axis (local X for this node configuration).
    const circleWrist = getNode('Circle');
    if (circleWrist) {
      const base = bases.Circle || { x: 0, y: 0, z: 0 };
      const targetWristX = base.x + degToRad(activeControls?.wristAngle || 0);
      circleWrist.rotation.x = THREE.MathUtils.lerp(circleWrist.rotation.x, targetWristX, 0.15);
    }

    // 4. Fingers Flexion
    // Nodes confirmed: right_thumb, right_index, right_middle, right_ring, right_little
    // Bending (flexion) should rotate around the local X axis (curl inward).
    const fingerMap = [
      { node: 'right_thumb',  val: activeControls?.thumb  !== undefined ? activeControls.thumb  : 0 },
      { node: 'right_index',  val: activeControls?.index  !== undefined ? activeControls.index  : 0 },
      { node: 'right_middle', val: activeControls?.middle !== undefined ? activeControls.middle : 0 },
      { node: 'right_ring',   val: activeControls?.ring   !== undefined ? activeControls.ring   : 0 },
      { node: 'right_little', val: activeControls?.little !== undefined ? activeControls.little : 0 },
    ];

    fingerMap.forEach(({ node: nodeName, val }) => {
      const fingerNode = getNode(nodeName);
      if (!fingerNode) return;

      const base = bases[nodeName] || { x: 0, y: 0, z: 0 };
      // Clamp val to 0-90 and convert to radians
      const flexRad = degToRad(Math.max(0, Math.min(90, val)));

      // Apply bend on X axis (curl inward).
      const targetX = base.x - flexRad;
      fingerNode.rotation.x = THREE.MathUtils.lerp(fingerNode.rotation.x, targetX, 0.15);
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
  const { camera, scene } = useThree();

  useFrame(() => {
    // Camera positions:
    // straight: full arm front view
    // side:     side view of full arm
    // hand:     zoomed in to hand/finger area (front)
    // hand_side: zoomed in to hand/finger area (side)
    // elbow:    zoomed in to elbow joint
    // wrist:    zoomed in to wrist joint
    let targetPos;
    let targetLookAt = new THREE.Vector3(0.1, 0.2, 0); // Default chest target

    if (cameraAngle === 'side') {
      targetPos = new THREE.Vector3(2.8, 0.6, 1.5);
    } else if (cameraAngle === 'hand') {
      targetPos = new THREE.Vector3(-0.6, -1.2, 1.0);  // Close up, aimed at hand
      const handNode = scene.getObjectByName('Circle');
      if (handNode) {
        handNode.getWorldPosition(targetLookAt);
      }
    } else if (cameraAngle === 'hand_side') {
      targetPos = new THREE.Vector3(0.5, -1.2, 0.8);   // Side close-up of hand
      const handNode = scene.getObjectByName('Circle');
      if (handNode) {
        handNode.getWorldPosition(targetLookAt);
      }
    } else if (cameraAngle === 'elbow') {
      targetPos = new THREE.Vector3(1.5, -0.4, 1.5);    // Zoomed on forearm/elbow
      const elbowNode = scene.getObjectByName('right_forearm');
      if (elbowNode) {
        elbowNode.getWorldPosition(targetLookAt);
      }
    } else if (cameraAngle === 'wrist') {
      targetPos = new THREE.Vector3(0.5, -0.9, 1.0);   // Zoomed on wrist area
      const wristNode = scene.getObjectByName('Circle');
      if (wristNode) {
        wristNode.getWorldPosition(targetLookAt);
      }
    } else {
      targetPos = new THREE.Vector3(0.2, 0.4, 3.2);    // Default straight
    }

    camera.position.lerp(targetPos, 0.08);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt, 0.08);
      controlsRef.current.update();
    }
  });

  return null;
}

// Main Canvas container component for Dashboard Kinematics Overview
export default function Arm3DVisualizer({ 
  controls, 
  cameraAngle = 'straight', 
  disableOrbit = false, 
  injuredArm = 'Right',
  autoRotate = false,
  demoMode = false
}) {
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
          <FullBodyRig controls={controls} injuredArm={injuredArm} demoMode={demoMode} />
        </Center>
        
        {/* Dynamic camera transitions */}
        <CameraController cameraAngle={cameraAngle} controlsRef={controlsRef} />
        
        {/* OrbitControls: zoom & orbit enabled, pan disabled */}
        <OrbitControls 
          ref={controlsRef}
          enableZoom={!disableOrbit} 
          enableRotate={!disableOrbit} 
          enablePan={false} 
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
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
