import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Play, RotateCcw, Info } from 'lucide-react';

/**
 * WristMotionDemoCard
 * 
 * Displays an animated visual demonstration of the specific wrist exercise
 * being performed (Wrist Flexion, Wrist Extension, Wrist Rotation, etc.)
 * directly inside the 3D viewport overlay.
 */
export default function WristMotionDemoCard({
  exerciseName = 'Wrist Flexion',
  movementId = 'upDown',
  targetAngle = 50,
  className = ''
}) {
  const [collapsed, setCollapsed] = useState(false);

  const nameLower = (exerciseName || '').toLowerCase();
  
  // Movement Classification
  const isFlexion = nameLower.includes('flexion') && !nameLower.includes('extension');
  const isExtension = nameLower.includes('extension') && !nameLower.includes('flexion');
  const isRotation = nameLower.includes('rotation') || nameLower.includes('twist') || nameLower.includes('pronation') || nameLower.includes('supination') || movementId === 'twist';
  const isDeviation = nameLower.includes('radial') || nameLower.includes('ulnar') || nameLower.includes('deviation') || nameLower.includes('hi') || movementId === 'hiMovement';
  const isFlexExtension = !isFlexion && !isExtension && !isRotation && !isDeviation;

  // Exercise Metadata
  let motionTitle = 'Wrist Flexion';
  let motionSubtitle = 'Bend Downward';
  let motionRange = `0° → ${targetAngle}°`;
  let motionCues = 'Bend hand downward smoothly, then return to neutral';
  let repFormula = '1 Rep = Down & Up';

  if (isFlexion) {
    motionTitle = 'Wrist Flexion';
    motionSubtitle = 'Bend Downward';
    motionRange = `0° → ${targetAngle}°`;
    motionCues = 'Bend wrist downward smoothly, then return to rest';
    repFormula = '1 Rep = Down & Up';
  } else if (isExtension) {
    motionTitle = 'Wrist Extension';
    motionSubtitle = 'Bend Upward';
    motionRange = `0° → ${targetAngle}°`;
    motionCues = 'Bend wrist upward smoothly, then return to rest';
    repFormula = '1 Rep = Up & Down';
  } else if (isRotation) {
    motionTitle = 'Wrist Rotation';
    motionSubtitle = 'Rotate Left ↔ Right';
    motionRange = `±${targetAngle || 45}°`;
    motionCues = 'Rotate hand fully to left, then fully to right';
    repFormula = '1 Rep = Left + Right';
  } else if (isDeviation) {
    motionTitle = 'Wrist Deviation';
    motionSubtitle = 'Wave Side-to-Side';
    motionRange = `±${targetAngle || 30}°`;
    motionCues = 'Wave hand toward thumb, then toward pinky side';
    repFormula = '1 Rep = Left + Right';
  } else if (isFlexExtension) {
    motionTitle = 'Flexion & Extension';
    motionSubtitle = 'Up ↕ Down';
    motionRange = `±${targetAngle || 45}°`;
    motionCues = 'Alternate bending downward and upward';
    repFormula = '1 Rep = Down + Up';
  }

  return (
    <div 
      className={`bg-slate-950/90 backdrop-blur-md border border-slate-800/90 rounded-2xl shadow-2xl p-3 text-slate-100 select-none transition-all duration-300 w-56 sm:w-64 ${className}`}
      style={{ boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)' }}
    >
      {/* Dynamic Keyframes for smooth animations */}
      <style>{`
        @keyframes wristFlexDemo {
          0%, 100% {
            transform: rotate(0deg);
          }
          45%, 55% {
            transform: rotate(44deg);
          }
        }
        @keyframes wristExtDemo {
          0%, 100% {
            transform: rotate(0deg);
          }
          45%, 55% {
            transform: rotate(-44deg);
          }
        }
        @keyframes wristFlexExtDemo {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(40deg);
          }
          50% {
            transform: rotate(0deg);
          }
          75% {
            transform: rotate(-40deg);
          }
        }
        @keyframes wristRotateRollDemo {
          0%, 100% {
            transform: rotate(0deg) scaleX(1);
          }
          25% {
            transform: rotate(-35deg) scaleX(0.85);
          }
          50% {
            transform: rotate(0deg) scaleX(1);
          }
          75% {
            transform: rotate(35deg) scaleX(0.85);
          }
        }
        @keyframes wristWaveDemo {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-25deg);
          }
          50% {
            transform: rotate(0deg);
          }
          75% {
            transform: rotate(25deg);
          }
        }
        @keyframes motionPathPulse {
          0%, 100% {
            stroke-dashoffset: 0;
            opacity: 0.8;
          }
          50% {
            stroke-dashoffset: 12;
            opacity: 1;
          }
        }
        @keyframes anglePulseTag {
          0%, 100% {
            opacity: 0.6;
            transform: scale(0.98);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }
      `}</style>

      {/* Card Header */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
            Motion Demo
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-slate-300 bg-slate-900 border border-slate-750 px-1.5 py-0.5 rounded-md font-mono">
            {motionRange}
          </span>
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title={collapsed ? "Expand exercise guide" : "Collapse exercise guide"}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Card Body */}
      {!collapsed && (
        <div className="pt-2 space-y-2">
          {/* Subtitle & Direction Badge */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white text-[13px]">{motionTitle}</span>
            <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              {motionSubtitle}
            </span>
          </div>

          {/* SVG Animated Model Viewport */}
          <div className="relative w-full h-28 bg-gradient-to-b from-slate-900/90 to-slate-950 rounded-xl border border-slate-800/70 overflow-hidden flex items-center justify-center shadow-inner">
            {/* Background Anatomical Reference Grid */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid-pattern" width="16" height="16" patternUnits="userSpaceOnUse">
                  <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="1,3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            </svg>

            {/* Visualizer 1: Wrist Flexion (Downwards Bend) */}
            {isFlexion && (
              <svg viewBox="0 0 200 110" className="w-full h-full relative z-10">
                {/* Horizontal Baseline (Neutral 0°) */}
                <line x1="70" y1="52" x2="175" y2="52" stroke="#475569" strokeWidth="1" strokeDasharray="3,3" />
                <text x="178" y="55" fill="#64748b" fontSize="8" fontWeight="bold">0°</text>

                {/* Curved Motion Arc with Arrowhead */}
                <defs>
                  <marker id="arrow-down" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                </defs>
                <path 
                  d="M 145 52 A 75 75 0 0 1 126 95" 
                  fill="none" 
                  stroke="#38bdf8" 
                  strokeWidth="1.5" 
                  strokeDasharray="4,3" 
                  markerEnd="url(#arrow-down)"
                  style={{ animation: 'motionPathPulse 2.4s ease-in-out infinite' }}
                />

                {/* Target Angle Arc Label */}
                <g style={{ animation: 'anglePulseTag 2.4s ease-in-out infinite' }}>
                  <rect x="135" y="80" width="34" height="15" rx="4" fill="#0369a1" fillOpacity="0.8" />
                  <text x="152" y="91" fill="#e0f2fe" fontSize="8" fontWeight="bold" textAnchor="middle">{targetAngle}° Aim</text>
                </g>

                {/* Stationary Forearm (Left) */}
                <g>
                  {/* Forearm Body */}
                  <path d="M 12 40 L 70 44 L 70 60 L 12 64 Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                  {/* Smart Sleeve IoT Cuff Band */}
                  <rect x="35" y="41.5" width="22" height="21" rx="2" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
                  <line x1="46" y1="42.5" x2="46" y2="61.5" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="46" y="54" fill="#38bdf8" fontSize="6" fontWeight="bold" textAnchor="middle">IOT</text>
                </g>

                {/* Wrist Joint Pivot Circle */}
                <circle cx="70" cy="52" r="5" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1.5" />
                <circle cx="70" cy="52" r="8" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />

                {/* Animated Hand (Pivoting Downwards) */}
                <g 
                  style={{ 
                    transformOrigin: '70px 52px', 
                    animation: 'wristFlexDemo 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' 
                  }}
                >
                  {/* Palm Assembly */}
                  <path d="M 70 46 L 110 46 L 114 58 L 70 58 Z" fill="#334155" stroke="#64748b" strokeWidth="1.2" />
                  {/* Palm Sensor / Smart Coin */}
                  <circle cx="92" cy="52" r="3.5" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />
                  {/* Fingers */}
                  <line x1="110" y1="48" x2="148" y2="48" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="112" y1="51" x2="152" y2="51" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="113" y1="54" x2="150" y2="54" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="110" y1="57" x2="142" y2="57" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Thumb */}
                  <path d="M 85 46 Q 95 38 108 40" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </svg>
            )}

            {/* Visualizer 2: Wrist Extension (Upwards Bend) */}
            {isExtension && (
              <svg viewBox="0 0 200 110" className="w-full h-full relative z-10">
                {/* Horizontal Baseline (Neutral 0°) */}
                <line x1="70" y1="58" x2="175" y2="58" stroke="#475569" strokeWidth="1" strokeDasharray="3,3" />
                <text x="178" y="61" fill="#64748b" fontSize="8" fontWeight="bold">0°</text>

                {/* Curved Motion Arc with Arrowhead */}
                <defs>
                  <marker id="arrow-up" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                </defs>
                <path 
                  d="M 145 58 A 75 75 0 0 0 126 15" 
                  fill="none" 
                  stroke="#38bdf8" 
                  strokeWidth="1.5" 
                  strokeDasharray="4,3" 
                  markerEnd="url(#arrow-up)"
                  style={{ animation: 'motionPathPulse 2.4s ease-in-out infinite' }}
                />

                {/* Target Angle Arc Label */}
                <g style={{ animation: 'anglePulseTag 2.4s ease-in-out infinite' }}>
                  <rect x="135" y="16" width="34" height="15" rx="4" fill="#0369a1" fillOpacity="0.8" />
                  <text x="152" y="27" fill="#e0f2fe" fontSize="8" fontWeight="bold" textAnchor="middle">{targetAngle}° Aim</text>
                </g>

                {/* Stationary Forearm (Left) */}
                <g>
                  <path d="M 12 46 L 70 50 L 70 66 L 12 70 Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                  <rect x="35" y="47.5" width="22" height="21" rx="2" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
                  <line x1="46" y1="48.5" x2="46" y2="67.5" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="46" y="60" fill="#38bdf8" fontSize="6" fontWeight="bold" textAnchor="middle">IOT</text>
                </g>

                {/* Wrist Joint Pivot Circle */}
                <circle cx="70" cy="58" r="5" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1.5" />
                <circle cx="70" cy="58" r="8" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />

                {/* Animated Hand (Pivoting Upwards) */}
                <g 
                  style={{ 
                    transformOrigin: '70px 58px', 
                    animation: 'wristExtDemo 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' 
                  }}
                >
                  <path d="M 70 52 L 110 52 L 114 64 L 70 64 Z" fill="#334155" stroke="#64748b" strokeWidth="1.2" />
                  <circle cx="92" cy="58" r="3.5" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />
                  <line x1="110" y1="54" x2="148" y2="54" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="112" y1="57" x2="152" y2="57" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="113" y1="60" x2="150" y2="60" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="110" y1="63" x2="142" y2="63" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 85 64 Q 95 72 108 70" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </svg>
            )}

            {/* Visualizer 3: Wrist Rotation / Twist (Pronation & Supination) */}
            {isRotation && (
              <svg viewBox="0 0 200 110" className="w-full h-full relative z-10">
                {/* Circular Rotation Guides */}
                <defs>
                  <marker id="arrow-rot-cw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                  <marker id="arrow-rot-ccw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#a855f7" />
                  </marker>
                </defs>

                {/* Left/Right Circular Arrow Arcs */}
                <path 
                  d="M 65 30 A 45 45 0 0 1 135 30" 
                  fill="none" 
                  stroke="#38bdf8" 
                  strokeWidth="1.5" 
                  strokeDasharray="4,3" 
                  markerEnd="url(#arrow-rot-cw)" 
                />
                <path 
                  d="M 135 80 A 45 45 0 0 1 65 80" 
                  fill="none" 
                  stroke="#a855f7" 
                  strokeWidth="1.5" 
                  strokeDasharray="4,3" 
                  markerEnd="url(#arrow-rot-ccw)" 
                />

                <text x="32" y="58" fill="#38bdf8" fontSize="8" fontWeight="bold">Left</text>
                <text x="156" y="58" fill="#a855f7" fontSize="8" fontWeight="bold">Right</text>

                {/* Center Forearm & Hand in Isometric/Frontal Orientation */}
                <g 
                  style={{ 
                    transformOrigin: '100px 55px', 
                    animation: 'wristRotateRollDemo 3.2s ease-in-out infinite' 
                  }}
                >
                  {/* Forearm stub behind */}
                  <rect x="90" y="80" width="20" height="28" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="1.2" />
                  {/* Wrist Band */}
                  <rect x="88" y="72" width="24" height="12" rx="2" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />

                  {/* Palm */}
                  <path d="M 85 45 Q 100 42 115 45 L 118 72 Q 100 75 82 72 Z" fill="#334155" stroke="#64748b" strokeWidth="1.2" />
                  {/* Palm Coin */}
                  <circle cx="100" cy="58" r="4" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />

                  {/* Fingers Upward */}
                  <line x1="88" y1="45" x2="86" y2="20" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="95" y1="44" x2="94" y2="15" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="102" y1="44" x2="103" y2="14" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="109" y1="45" x2="112" y2="20" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 84 56 Q 74 50 72 38" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </svg>
            )}

            {/* Visualizer 4: Combined Up ↕ Down or Side-to-Side */}
            {(isFlexExtension || isDeviation) && (
              <svg viewBox="0 0 200 110" className="w-full h-full relative z-10">
                <line x1="70" y1="55" x2="175" y2="55" stroke="#475569" strokeWidth="1" strokeDasharray="3,3" />

                <defs>
                  <marker id="arrow-both" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                </defs>
                <path 
                  d="M 135 22 A 65 65 0 0 1 135 88" 
                  fill="none" 
                  stroke="#38bdf8" 
                  strokeWidth="1.5" 
                  strokeDasharray="4,3" 
                  markerEnd="url(#arrow-both)"
                />

                {/* Forearm */}
                <path d="M 12 43 L 70 47 L 70 63 L 12 67 Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="35" y="44.5" width="22" height="21" rx="2" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
                <circle cx="70" cy="55" r="5" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1.5" />

                {/* Oscillating Hand */}
                <g 
                  style={{ 
                    transformOrigin: '70px 55px', 
                    animation: isDeviation ? 'wristWaveDemo 3s ease-in-out infinite' : 'wristFlexExtDemo 3.2s ease-in-out infinite' 
                  }}
                >
                  <path d="M 70 49 L 110 49 L 114 61 L 70 61 Z" fill="#334155" stroke="#64748b" strokeWidth="1.2" />
                  <circle cx="92" cy="55" r="3.5" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />
                  <line x1="110" y1="51" x2="148" y2="51" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="112" y1="54" x2="152" y2="54" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="113" y1="57" x2="150" y2="57" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="110" y1="60" x2="142" y2="60" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </svg>
            )}
          </div>

          {/* Clinical Motion Cues */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2 px-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-400">Rep Guide</span>
              <span className="font-bold text-sky-400 bg-sky-950/70 border border-sky-850 px-1.5 py-0.2 rounded">
                {repFormula}
              </span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug font-medium">
              {motionCues}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
