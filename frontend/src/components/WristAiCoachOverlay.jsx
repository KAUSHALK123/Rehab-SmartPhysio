import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Brain, ShieldAlert, Cpu, Activity, Disc } from 'lucide-react';
import { evaluateWristCoachRules, WristCoachDebouncer } from '../services/wristCoachRules';

export default function WristAiCoachOverlay({
  currentAngle = 0,
  targetAngle = 45,
  targetDir = "RIGHT",
  repState = "moving",
  holdCountdown = 2,
  restCountdown = 0,
  velocity = 0,
  isJerky = false,
  repsCompleted = 0,
  targetReps = 5,
  exerciseName = "Wrist Motion Test",
  isSimulated = false,
  apiEndpoint = "http://localhost:8000/coach/predict",
  inlineBottom = false, // If true, renders inside the bottom card box
  onPredictionUpdate = null
}) {
  const [debouncedMessage, setDebouncedMessage] = useState("");
  const [mlQuality, setMlQuality] = useState("");
  const [mlConfidence, setMlConfidence] = useState(0);
  const [anomalyScore, setAnomalyScore] = useState(0);
  const [badgeSource, setBadgeSource] = useState(isSimulated ? "AI: SIMULATED" : "AI: RULES ONLY");
  
  // Dev mode recorder
  const [isDev, setIsDev] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordLabel, setRecordLabel] = useState("correct");
  const recordedSamplesRef = useRef([]);

  const debouncerRef = useRef(new WristCoachDebouncer(700));
  const angleHistoryRef = useRef([]);
  const lastMovementTimeRef = useRef(Date.now());
  const prevAngleRef = useRef(currentAngle);

  // Check URL for ?dev=1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setIsDev(params.get('dev') === '1');
    }
  }, []);

  // Track idle time
  useEffect(() => {
    if (Math.abs(currentAngle - prevAngleRef.current) > 1.5) {
      lastMovementTimeRef.current = Date.now();
      prevAngleRef.current = currentAngle;
    }
  }, [currentAngle]);

  // Record 2s window samples
  useEffect(() => {
    const now = Date.now();
    angleHistoryRef.current.push({ time: now / 1000.0, angle: currentAngle });
    // Keep last 2.5 seconds of data (approx 50 samples at 20Hz)
    const cutoff = (now / 1000.0) - 2.5;
    angleHistoryRef.current = angleHistoryRef.current.filter(s => s.time >= cutoff);

    if (recording) {
      recordedSamplesRef.current.push({ time: now / 1000.0, angle: currentAngle });
    }
  }, [currentAngle, recording]);

  // Periodic ML inference call (every 500ms) with graceful fallback
  useEffect(() => {
    const interval = setInterval(async () => {
      const samples = angleHistoryRef.current;
      if (samples.length < 8) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 400);

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            samples: samples.slice(-40),
            exercise_name: exerciseName,
            is_simulated: isSimulated
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.quality && data.quality !== "unknown") {
            setMlQuality(data.quality);
            setMlConfidence(data.confidence || 0);
            setAnomalyScore(data.anomaly || 0);
            const badge = data.badge || (isSimulated ? "AI: SIMULATED" : "AI: ML MODEL");
            setBadgeSource(badge);
            if (onPredictionUpdate) {
              onPredictionUpdate({
                quality: data.quality,
                confidence: data.confidence || 0,
                anomaly: data.anomaly || 0,
                badge
              });
            }
            return;
          }
        }
        // Fallback to rules if response not ok or quality unknown
        setBadgeSource(isSimulated ? "AI: SIMULATED" : "AI: RULES ONLY");
      } catch (err) {
        // Silent graceful fallback
        setBadgeSource(isSimulated ? "AI: SIMULATED" : "AI: RULES ONLY");
      } finally {
        clearTimeout(timeoutId);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [apiEndpoint, exerciseName, isSimulated]);

  // Evaluate rule-based coaching message
  useEffect(() => {
    const idleSeconds = (Date.now() - lastMovementTimeRef.current) / 1000.0;
    const candidateMessage = evaluateWristCoachRules({
      currentAngle,
      targetAngle,
      targetDir,
      repState,
      holdCountdown,
      restCountdown,
      velocity,
      secondsIdle: idleSeconds,
      isJerky: isJerky || (anomalyScore < -0.08),
      repsCompleted,
      targetReps
    });

    const debounced = debouncerRef.current.update(candidateMessage);
    setDebouncedMessage(debounced);
  }, [
    currentAngle,
    targetAngle,
    targetDir,
    repState,
    holdCountdown,
    restCountdown,
    velocity,
    isJerky,
    anomalyScore,
    repsCompleted,
    targetReps
  ]);

  // Handle start/stop record training data
  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      const payload = {
        label: recordLabel,
        samples: [...recordedSamplesRef.current],
        count: recordedSamplesRef.current.length
      };
      console.log("[DEV RECORDER] Saved training window:", payload);
      alert(`Recorded ${payload.count} samples labeled '${recordLabel}'! Saved to console.`);
      recordedSamplesRef.current = [];
    } else {
      recordedSamplesRef.current = [];
      setRecording(true);
    }
  };

  // Badge Styling
  const badgeColors = {
    "AI: ML MODEL": "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    "AI: RULES ONLY": "bg-blue-500/20 text-blue-300 border-blue-500/40",
    "AI: SIMULATED": "bg-purple-500/20 text-purple-300 border-purple-500/40"
  };

  // INLINE BOTTOM CARD MODE (Replaces text in bottom card box directly)
  if (inlineBottom) {
    return (
      <div className="flex-1 flex flex-col justify-center min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`px-1.5 py-0.2 rounded-md border text-[9px] font-black uppercase tracking-wider ${badgeColors[badgeSource] || badgeColors["AI: RULES ONLY"]}`}>
            {badgeSource}
          </span>
          {mlQuality && mlQuality !== "unknown" && (
            <span className="text-[10px] text-slate-300 font-medium">
              Quality: <strong className="text-white capitalize">{mlQuality.replace('_', ' ')}</strong> ({Math.round(mlConfidence * 100)}%)
            </span>
          )}
        </div>
        <div 
          className="text-amber-400 font-extrabold text-sm sm:text-base leading-snug drop-shadow-md truncate sm:whitespace-normal transition-all duration-300"
          style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.95)" }}
        >
          {debouncedMessage || "Move your wrist to start"}
        </div>
        {isDev && (
          <div className="pointer-events-auto mt-1 flex items-center gap-1.5">
            <Disc className={`w-3 h-3 ${recording ? "text-rose-500 animate-spin" : "text-slate-400"}`} />
            <select 
              value={recordLabel} 
              onChange={(e) => setRecordLabel(e.target.value)}
              disabled={recording}
              className="bg-slate-900 text-slate-200 text-[9px] font-semibold px-1 py-0.5 rounded border border-slate-700"
            >
              <option value="correct">correct</option>
              <option value="too_shallow">too_shallow</option>
              <option value="too_fast">too_fast</option>
              <option value="jerky">jerky</option>
            </select>
            <button
              type="button"
              onClick={toggleRecording}
              className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase transition ${
                recording ? "bg-rose-600 hover:bg-rose-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {recording ? "Stop" : "Rec"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // FLOATING CANVAS OVERLAY (Upper-middle area of 3D Canvas)
  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center max-w-xl w-full px-4 animate-in fade-in duration-300">
      
      {/* Badge + Quality Tag */}
      <div className="flex items-center justify-center gap-2 mb-1.5">
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold tracking-wider shadow-sm uppercase ${badgeColors[badgeSource] || badgeColors["AI: RULES ONLY"]}`}>
          {badgeSource}
        </span>
        {mlQuality && mlQuality !== "unknown" && (
          <span 
            className="text-xs font-semibold text-white drop-shadow-md bg-slate-900/60 backdrop-blur px-2 py-0.5 rounded-full border border-slate-800"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
          >
            Quality: <strong className="capitalize text-amber-300">{mlQuality.replace('_', ' ')}</strong> ({Math.round(mlConfidence * 100)}%)
          </span>
        )}
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

      {/* Dev Mode Data Recorder (?dev=1) */}
      {isDev && (
        <div className="pointer-events-auto mt-3 inline-flex items-center gap-2 bg-slate-950/90 border border-slate-750 px-3 py-1.5 rounded-xl shadow-2xl">
          <Disc className={`w-3.5 h-3.5 ${recording ? "text-rose-500 animate-spin" : "text-slate-400"}`} />
          <span className="text-[10px] font-bold text-slate-300">Record Data:</span>
          <select 
            value={recordLabel} 
            onChange={(e) => setRecordLabel(e.target.value)}
            disabled={recording}
            className="bg-slate-900 text-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-700"
          >
            <option value="correct">correct</option>
            <option value="too_shallow">too_shallow</option>
            <option value="too_fast">too_fast</option>
            <option value="jerky">jerky</option>
          </select>
          <button
            type="button"
            onClick={toggleRecording}
            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition ${
              recording ? "bg-rose-600 hover:bg-rose-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {recording ? "Stop" : "Start"}
          </button>
        </div>
      )}

    </div>
  );
}
