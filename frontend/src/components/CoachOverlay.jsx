import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle2, ChevronRight, Gauge, HelpCircle, RefreshCw, Zap } from 'lucide-react';

const EXERCISES = [
  { id: 'flexion_extension', name: 'Flexion / Extension', defaultTarget: 40, axis: 'Pitch' },
  { id: 'radial_ulnar', name: 'Radial / Ulnar Deviation', defaultTarget: 25, axis: 'Roll' },
  { id: 'forearm_rotation', name: 'Pronation / Supination', defaultTarget: 60, axis: 'Roll' },
];

export default function CoachOverlay({
  coachData,
  isOffline,
  onConfigChange,
}) {
  const [selectedExercise, setSelectedExercise] = useState('flexion_extension');
  const [targetAngle, setTargetAngle] = useState(40);
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync state if coachData arrives with a different config
  useEffect(() => {
    if (coachData?.exercise && coachData.exercise !== selectedExercise) {
      setSelectedExercise(coachData.exercise);
    }
    if (coachData?.target && coachData.target !== targetAngle) {
      setTargetAngle(coachData.target);
    }
  }, [coachData?.exercise, coachData?.target]);

  const handleExerciseChange = (newEx) => {
    setSelectedExercise(newEx);
    const found = EXERCISES.find((e) => e.id === newEx);
    const newTarget = found ? found.defaultTarget : 40;
    setTargetAngle(newTarget);
    if (onConfigChange) {
      onConfigChange({ exercise: newEx, target: newTarget });
    }
  };

  const handleTargetChange = (val) => {
    const num = Math.max(10, Math.min(90, Number(val) || 40));
    setTargetAngle(num);
    if (onConfigChange) {
      onConfigChange({ exercise: selectedExercise, target: num });
    }
  };

  // Severity styling
  const severity = coachData?.severity || 'info';
  const severityStyles = {
    ok: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
    info: 'bg-sky-500/20 border-sky-500/50 text-sky-200',
    warn: 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse',
  };
  const activeSeverityStyle = severityStyles[severity] || severityStyles.info;

  // Source & Mode Badges
  const isSimulated = coachData?.src === 'simulated' || coachData?.is_simulated;
  const isMlActive = coachData?.mode === 'ml_active';

  // Math for Angle Progress Bar
  const currentAngle = Math.abs(coachData?.current_angle || 0);
  const target = coachData?.target || targetAngle || 40;
  const percent = Math.min(100, Math.max(0, (currentAngle / target) * 100));

  const qualityLabels = {
    correct: 'Good Form',
    too_shallow: 'Too Shallow',
    too_fast: 'Too Fast',
    jerky: 'Irregular / Jerky',
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 w-84 sm:w-96 max-w-[calc(100vw-2rem)] select-none">
      <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl text-white transition-all duration-300">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-blue-600/30 text-blue-400">
              <Zap className="w-4 h-4" />
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-slate-200">
              Wrist ML Coach
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Status & Simulation Badges */}
            {isOffline ? (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Coach Offline
              </span>
            ) : isSimulated ? (
              <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                SIMULATED
              </span>
            ) : isMlActive ? (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ML ACTIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-700/50 text-slate-300 border border-slate-600">
                RULE-BASED
              </span>
            )}

            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Live Suggestion Instruction Banner */}
        <div
          className={`p-3 rounded-xl border flex items-center gap-3 transition-all duration-300 ${activeSeverityStyle}`}
        >
          {severity === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : severity === 'warn' ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          ) : (
            <Activity className="w-5 h-5 flex-shrink-0 text-sky-400" />
          )}

          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
              Live Suggestion
            </span>
            <div className="text-sm font-black leading-tight drop-shadow truncate">
              {isOffline
                ? 'Coach offline (awaiting IMU frames)'
                : coachData?.message || 'Ready when you are'}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-3 animate-in fade-in duration-200">
            {/* Rep Counter & Quality Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                  Reps
                </span>
                <span className="text-xl font-black text-white">
                  {coachData?.rep_count || 0}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                  Quality
                </span>
                <span className="text-xs font-black text-blue-300 block truncate mt-1">
                  {qualityLabels[coachData?.quality] || coachData?.quality || 'Calibrated'}
                </span>
                {coachData?.confidence ? (
                  <span className="text-[9px] text-slate-400">
                    {Math.round(coachData.confidence * 100)}% conf
                  </span>
                ) : null}
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                  Last Peak
                </span>
                <span className="text-base font-black text-white">
                  {coachData?.peak_angle_last_rep ? `${coachData.peak_angle_last_rep}°` : '--'}
                </span>
              </div>
            </div>

            {/* Angle Progress Bar */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 mb-1">
                <span>approx. wrist angle</span>
                <span className="text-blue-300 font-extrabold">
                  {coachData?.current_angle ? `${Math.round(coachData.current_angle)}°` : '0°'} / {target}°
                </span>
              </div>

              {/* Progress bar with target indicator marker */}
              <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-100 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="flex justify-between text-[9px] text-slate-500 font-bold mt-1">
                <span>0° Neutral</span>
                <span>Target: {target}°</span>
              </div>
            </div>

            {/* Anomaly / Jerk Status */}
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-1.5 text-[11px]">
              <span className="text-slate-400 font-semibold">Motion Smoothness:</span>
              {coachData?.anomaly ? (
                <span className="text-rose-400 font-black flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Tremor / Jerk Detected
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Smooth Kinematics
                </span>
              )}
            </div>

            {/* Interactive Exercise & Target Configuration */}
            <div className="border-t border-slate-800/80 pt-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Exercise
                </label>
                <select
                  value={selectedExercise}
                  onChange={(e) => handleExerciseChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 text-xs font-semibold text-slate-200 rounded-lg p-1.5 focus:outline-none focus:border-blue-500"
                >
                  {EXERCISES.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.axis})
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-20">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Target (°)
                </label>
                <input
                  type="number"
                  min="10"
                  max="90"
                  value={targetAngle}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 text-xs font-black text-slate-200 rounded-lg p-1.5 text-center focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
