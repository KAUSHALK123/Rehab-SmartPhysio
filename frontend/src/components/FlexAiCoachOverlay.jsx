import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Brain, Activity } from 'lucide-react';
import { evaluateFlexCoachRules, FlexCoachDebouncer } from '../services/flexCoachRules';

export default function FlexAiCoachOverlay({
  sensors = {},
  repState = "rest",
  holdCountdown = 2,
  repsCompleted = 0,
  targetReps = 12,
  exerciseName = "Finger Closing",
  isSimulated = false,
  inlineBottom = false
}) {
  const [debouncedMessage, setDebouncedMessage] = useState("");
  const badgeSource = isSimulated ? "AI: SIMULATED" : "AI: RULES ONLY";

  const debouncerRef = useRef(new FlexCoachDebouncer(700));
  const lastMovementTimeRef = useRef(Date.now());
  const prevSensorsRef = useRef({ ...sensors });

  // Track finger movement for idle detection
  useEffect(() => {
    const prev = prevSensorsRef.current;
    const diff = Math.abs((sensors?.thumb || 0) - (prev?.thumb || 0)) +
                 Math.abs((sensors?.index || 0) - (prev?.index || 0)) +
                 Math.abs((sensors?.middle || 0) - (prev?.middle || 0)) +
                 Math.abs((sensors?.ring || 0) - (prev?.ring || 0)) +
                 Math.abs((sensors?.little || 0) - (prev?.little || 0));

    if (diff > 5) {
      lastMovementTimeRef.current = Date.now();
      prevSensorsRef.current = { ...sensors };
    }
  }, [sensors]);

  // Evaluate rule-based flex coaching message
  useEffect(() => {
    const idleSeconds = (Date.now() - lastMovementTimeRef.current) / 1000.0;
    const candidateMessage = evaluateFlexCoachRules({
      sensors,
      repState,
      holdCountdown,
      repsCompleted,
      targetReps,
      secondsIdle: idleSeconds,
      closedThreshold: 40
    });

    const debounced = debouncerRef.current.update(candidateMessage);
    setDebouncedMessage(debounced);
  }, [sensors, repState, holdCountdown, repsCompleted, targetReps]);

  // Badge Styling
  const badgeColors = {
    "AI: RULES ONLY": "bg-blue-500/20 text-blue-300 border-blue-500/40",
    "AI: SIMULATED": "bg-purple-500/20 text-purple-300 border-purple-500/40"
  };

  // INLINE BOTTOM CARD MODE (Directly inside bottom instruction box)
  if (inlineBottom) {
    return (
      <div className="flex-1 flex flex-col justify-center min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`px-1.5 py-0.2 rounded-md border text-[9px] font-black uppercase tracking-wider ${badgeColors[badgeSource] || badgeColors["AI: RULES ONLY"]}`}>
            {badgeSource}
          </span>
          <span className="text-[10px] text-slate-300 font-medium">
            Finger Flexion Biofeedback
          </span>
        </div>
        <div 
          className="text-amber-400 font-extrabold text-sm sm:text-base leading-snug drop-shadow-md truncate sm:whitespace-normal transition-all duration-300"
          style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.95)" }}
        >
          {debouncedMessage || "Make a fist to start"}
        </div>
      </div>
    );
  }

  // FLOATING CANVAS OVERLAY (Upper-middle area of 3D Canvas)
  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center max-w-xl w-full px-4 animate-in fade-in duration-300">
      {/* Badge Tag */}
      <div className="flex items-center justify-center gap-2 mb-1.5">
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold tracking-wider shadow-sm uppercase ${badgeColors[badgeSource] || badgeColors["AI: RULES ONLY"]}`}>
          {badgeSource}
        </span>
        <span 
          className="text-xs font-semibold text-white drop-shadow-md bg-slate-900/60 backdrop-blur px-2 py-0.5 rounded-full border border-slate-800"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
        >
          Hand Squeeze AI Coach
        </span>
      </div>

      {/* Main Yellow Bold Coach Suggestion Line */}
      <div 
        className="text-amber-400 font-black text-2xl sm:text-3xl md:text-4xl tracking-tight leading-tight transition-all duration-300"
        style={{
          textShadow: "0 3px 12px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0,0,0,0.9)"
        }}
      >
        {debouncedMessage}
      </div>
    </div>
  );
}
