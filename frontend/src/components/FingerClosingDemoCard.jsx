import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Degree to radian conversion helper
const degToRad = (deg) => ((deg || 0) * Math.PI) / 180;

// Approved target bend angles for a natural, clear closed fist (degrees)
const TARGET_ANGLES = {
  right_thumb: 60,   // Local X axis
  right_index: 75,   // Local Z axis
  right_middle: 75,  // Local Z axis
  right_ring: 70,    // Local Z axis
  right_little: 65   // Local Z axis
};

// Phase durations in seconds
const DURATION_OPEN = 1.0;
const DURATION_CLOSE = 1.8;
const DURATION_HOLD = 1.2;
const DURATION_RETURN = 1.6;
const TOTAL_REP_CYCLE = DURATION_OPEN + DURATION_CLOSE + DURATION_HOLD + DURATION_RETURN;

/**
 * 3D Scene that renders the full_rig GLB focused on the hand.
 * The wrist (Circle bone) remains completely stationary.
 * Only the 5 fingers bend into a fist on their approved axes:
 * - Thumb: LOCAL X
 * - Index, Middle, Ring, Little: LOCAL Z
 */
function FingerClosingRigScene({ 
  targetReps = 12,
  onPhaseChange,
  onRepChange
}) {
  const { scene } = useGLTF('/models/full_rig.glb');

  const clonedScene = React.useMemo(() => {
    return scene?.clone ? SkeletonUtils.clone(scene) : scene;
  }, [scene]);

  const circleNodeRef = useRef(null);
  const fingerNodesRef = useRef({});
  const baseRotationsRef = useRef({});
  const controlsRef = useRef();
  const { camera } = useThree();
  const cameraInitializedRef = useRef(false);

  // Time & Repetition tracking
  const repStartTimeRef = useRef(null);
  const currentRepRef = useRef(1);
  const currentPhaseRef = useRef('OPEN');

  // Capture base rest orientations once
  useEffect(() => {
    if (!clonedScene) return;
    const getNode = (name) =>
      typeof clonedScene.getObjectByName === 'function'
        ? clonedScene.getObjectByName(name)
        : null;

    const circle = getNode('Circle');
    if (circle) {
      circleNodeRef.current = circle;
      baseRotationsRef.current.Circle = {
        x: circle.rotation.x,
        y: circle.rotation.y,
        z: circle.rotation.z
      };
      // Lock wrist to rest
      circle.rotation.set(circle.rotation.x, circle.rotation.y, circle.rotation.z);
    }

    const fingerNames = ['right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little'];
    const nodes = {};
    fingerNames.forEach((name) => {
      const node = getNode(name);
      if (node) {
        nodes[name] = node;
        baseRotationsRef.current[name] = {
          x: node.rotation.x,
          y: node.rotation.y,
          z: node.rotation.z
        };
        node.rotation.set(node.rotation.x, node.rotation.y, node.rotation.z);
      }
    });
    fingerNodesRef.current = nodes;
  }, [clonedScene]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (repStartTimeRef.current === null) {
      repStartTimeRef.current = elapsed;
    }

    const bases = baseRotationsRef.current;
    const circle = circleNodeRef.current;
    const fingers = fingerNodesRef.current;

    // Wrist strictly stationary at base rest pose
    if (circle && bases.Circle) {
      circle.rotation.set(bases.Circle.x, bases.Circle.y, bases.Circle.z);
    }

    // Determine rep cycle and progression
    const timeInRep = (elapsed - repStartTimeRef.current) % TOTAL_REP_CYCLE;
    const completedReps = Math.floor((elapsed - repStartTimeRef.current) / TOTAL_REP_CYCLE);
    
    // Repetition counter: 1 to targetReps, looping cleanly if continued
    const activeRep = (completedReps % (Math.max(1, targetReps))) + 1;
    if (activeRep !== currentRepRef.current) {
      currentRepRef.current = activeRep;
      if (onRepChange) onRepChange(activeRep);
    }

    let progress = 0; // 0 = open, 1 = fully closed
    let phase = 'OPEN';

    if (timeInRep < DURATION_OPEN) {
      // 1. OPEN (neutral rest)
      progress = 0;
      phase = 'OPEN';
    } else if (timeInRep < DURATION_OPEN + DURATION_CLOSE) {
      // 2. CLOSE (gradually bending into a fist)
      const tClose = (timeInRep - DURATION_OPEN) / DURATION_CLOSE;
      // Smooth sine easing 0 -> 1
      progress = (1 - Math.cos(tClose * Math.PI)) / 2;
      phase = 'CLOSE';
    } else if (timeInRep < DURATION_OPEN + DURATION_CLOSE + DURATION_HOLD) {
      // 3. HOLD (closed fist held clearly)
      progress = 1;
      phase = 'HOLD';
    } else {
      // 4. OPEN (gradual return to open hand)
      const tOpen = (timeInRep - DURATION_OPEN - DURATION_CLOSE - DURATION_HOLD) / DURATION_RETURN;
      // Smooth sine easing 1 -> 0
      progress = (1 + Math.cos(tOpen * Math.PI)) / 2;
      phase = 'RETURN';
    }

    if (phase !== currentPhaseRef.current) {
      currentPhaseRef.current = phase;
      if (onPhaseChange) onPhaseChange(phase);
    }

    // Apply finger rotations based on approved axes
    const fingerNames = ['right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little'];
    fingerNames.forEach((name) => {
      const node = fingers[name];
      const base = bases[name];
      if (!node || !base) return;

      const targetAngle = TARGET_ANGLES[name] || 70;
      const currentAngleDeg = progress * targetAngle;
      const rad = degToRad(currentAngleDeg);

      if (name === 'right_thumb') {
        // Thumb: LOCAL X axis ONLY (curl inward toward palm - reversed so it closes into fist); Y and Z locked to base rest
        const targetX = base.x - rad;
        node.rotation.x = THREE.MathUtils.lerp(node.rotation.x, targetX, 0.25);
        node.rotation.y = THREE.MathUtils.lerp(node.rotation.y, base.y, 0.25);
        node.rotation.z = THREE.MathUtils.lerp(node.rotation.z, base.z, 0.25);
      } else {
        // Index, Middle, Ring, Little: LOCAL Z axis ONLY (curl inward); X and Y locked to base rest
        const targetZ = base.z + rad;
        node.rotation.x = THREE.MathUtils.lerp(node.rotation.x, base.x, 0.25);
        node.rotation.y = THREE.MathUtils.lerp(node.rotation.y, base.y, 0.25);
        node.rotation.z = THREE.MathUtils.lerp(node.rotation.z, targetZ, 0.25);
      }
    });

    // Camera positioning tightly framed on the hand
    if (circle) {
      const wristWorldPos = new THREE.Vector3();
      circle.getWorldPosition(wristWorldPos);
      
      const handCenter = new THREE.Vector3(
        wristWorldPos.x + 0.04,
        wristWorldPos.y - 0.10,
        wristWorldPos.z
      );

      if (!cameraInitializedRef.current) {
        camera.position.set(
          wristWorldPos.x + 0.20,
          wristWorldPos.y + 0.04,
          wristWorldPos.z + 1.15
        );
        camera.lookAt(handCenter);

        if (controlsRef.current) {
          controlsRef.current.target.copy(handCenter);
          controlsRef.current.update();
        }
        cameraInitializedRef.current = true;
      } else if (controlsRef.current) {
        controlsRef.current.target.lerp(handCenter, 0.08);
        controlsRef.current.update();
      }
    }
  });

  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[4, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, -2, 3]} intensity={0.8} />
      <pointLight position={[0.4, -0.6, 1.2]} intensity={0.7} />

      {/* 3D Hand Model */}
      <group rotation={[0, -Math.PI / 4, 0]} scale={[1.1, 1.1, 1.1]} position={[0, -0.6, 0]}>
        <primitive object={clonedScene} />
      </group>

      <OrbitControls 
        ref={controlsRef}
        enableZoom={true}
        enablePan={false}
        minDistance={0.5}
        maxDistance={1.6}
        rotateSpeed={0.5}
      />
    </>
  );
}

/**
 * FingerClosingDemoCard
 * 
 * Instructional visual guide card inside the Main Exercise "Finger Closing".
 * Demonstrates a clear Open → Close → Hold → Open sequence across target reps.
 * Does NOT generate sensor values or interfere with real exercise rep counting.
 */
export default function FingerClosingDemoCard({
  targetReps = 12,
  className = ''
}) {
  const [currentRep, setCurrentRep] = useState(1);
  const [currentPhase, setCurrentPhase] = useState('OPEN');

  const getPhaseBadge = () => {
    switch (currentPhase) {
      case 'OPEN':
        return { label: 'OPEN', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-700/60' };
      case 'CLOSE':
        return { label: 'CLOSING', color: 'text-amber-400 bg-amber-950/80 border-amber-700/60' };
      case 'HOLD':
        return { label: 'HOLD', color: 'text-rose-400 bg-rose-950/80 border-rose-700/60' };
      case 'RETURN':
        return { label: 'OPENING', color: 'text-cyan-400 bg-cyan-950/80 border-cyan-700/60' };
      default:
        return { label: 'OPEN', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-700/60' };
    }
  };

  const badge = getPhaseBadge();

  return (
    <div 
      className={`bg-slate-950/92 backdrop-blur-md border border-slate-800/90 rounded-2xl shadow-2xl p-2.5 text-slate-100 select-none transition-all duration-200 w-60 sm:w-68 ${className}`}
      style={{ boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)' }}
    >
      {/* Exercise Title with Demo Badge */}
      <div className="flex items-center justify-between text-xs pb-2 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-white text-[13px] tracking-tight truncate">Finger Closing</span>
          <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">
            Demo
          </span>
        </div>
        <span className="text-[10px] font-semibold text-slate-300 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded-full shrink-0">
          Fist Movement
        </span>
      </div>

      {/* 3D GLB Animated Viewport Box */}
      <div className="relative w-full h-52 sm:h-56 bg-gradient-to-b from-slate-900/95 to-slate-950 rounded-xl border border-slate-800/80 overflow-hidden shadow-inner">
        {/* Repetition Indicator inside 3D viewport */}
        <div className="absolute top-2 left-2 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] font-extrabold font-mono text-cyan-400 flex items-center gap-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>REP {currentRep} / {targetReps}</span>
        </div>

        {/* Phase State Badge */}
        <div className={`absolute top-2 right-2 z-10 border rounded-lg px-2 py-0.5 text-[9px] font-bold shadow-sm ${badge.color}`}>
          {badge.label}
        </div>

        {/* Three.js Canvas with the actual 3D GLB Model */}
        <div className="w-full h-full">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
              Loading 3D Hand Model...
            </div>
          }>
            <Canvas
              camera={{ fov: 30 }}
              gl={{ antialias: true, alpha: true }}
            >
              <FingerClosingRigScene 
                targetReps={targetReps}
                onRepChange={setCurrentRep}
                onPhaseChange={setCurrentPhase}
              />
            </Canvas>
          </Suspense>
        </div>
      </div>

      {/* Repetition Cycle Step Indicator (OPEN → CLOSE → HOLD → OPEN) */}
      <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] font-bold text-center">
        <div className={`py-1 rounded border transition-all duration-200 ${
          currentPhase === 'OPEN' 
            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
            : 'bg-slate-900/70 border-slate-800/80 text-slate-400'
        }`}>
          OPEN
        </div>
        <div className={`py-1 rounded border transition-all duration-200 ${
          currentPhase === 'CLOSE' 
            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]' 
            : 'bg-slate-900/70 border-slate-800/80 text-slate-400'
        }`}>
          CLOSE
        </div>
        <div className={`py-1 rounded border transition-all duration-200 ${
          currentPhase === 'HOLD' 
            ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.3)]' 
            : 'bg-slate-900/70 border-slate-800/80 text-slate-400'
        }`}>
          HOLD
        </div>
        <div className={`py-1 rounded border transition-all duration-200 ${
          currentPhase === 'RETURN' 
            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]' 
            : 'bg-slate-900/70 border-slate-800/80 text-slate-400'
        }`}>
          OPEN
        </div>
      </div>

      {/* Patient Instruction Text */}
      <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-300 text-center leading-snug">
        Close your fingers into a fist, hold, then slowly open.
      </div>
    </div>
  );
}
