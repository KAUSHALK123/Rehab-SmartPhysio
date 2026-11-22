import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Gauge, HelpCircle, RefreshCw, X, Zap } from 'lucide-react';

const EXERCISES = [
  { id: 'flexion_extension', name: 'Flexion / Extension', defaultTarget: 40, axis: 'Pitch' },
  { id: 'radial_ulnar', name: 'Radial / Ulnar Deviation', defaultTarget: 25, axis: 'Roll' },
  { id: 'forearm_rotation', name: 'Pronation / Supination', defaultTarget: 60, axis: 'Roll' },
];

export default function CoachOverlay({
  coachData,
  isOffline,
  onConfigChange,
  onClose,
}) {
  const [selectedExercise, setSelectedExercise] = useState('flexion_extension');
  const [targetAngle, setTargetAngle] = useState(40);
  const [isMinimized, setIsMinimized] = useState(false);

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
    <div className="absolute top-52 right-4 z-20 w-72 sm:w-80 max-w-[calc(100vw-2rem)] select-none animate-in fade-in slide-in-from-right-3 duration-200">
      <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-2xl text-white transition-all duration-300">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-purple-600/30 text-purple-400">
              <Zap className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-200">
              Wrist ML Coach
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Status & Simulation Badges */}
            {isOffline ? (
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Offline
              </span>
            ) : isSimulated ? (
              <span className="px-1.5 py-0.2 text-[9px] font-black tracking-wider uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                SIMULATED
              </span>
            ) : isMlActive ? (
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ML ACTIVE
              </span>
            ) : (
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-slate-700/50 text-slate-300 border border-slate-600">
                RULE-BASED
              </span>
            )}

            <button
              onClick={() => setIsMinimized((prev) => !prev)}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition ml-0.5"
                title="Close ML Coach HUD"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Minimized Pill View */}
        {isMinimized ? (
          <div className="mt-2 flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 font-bold">Angle: <span className="text-white font-extrabold">{Math.round(currentAngle)}°</span> / {target}°</span>
            <span className="text-blue-400 font-extrabold">{coachData?.rep_count || 0} Reps</span>
          </div>
        ) : (
          /* Full Detailed View */
          <div className="mt-2.5 space-y-2.5 animate-in fade-in duration-150">
            {/* Live Suggestion Instruction Banner */}
            <div
              className={`p-2 rounded-xl border flex items-center gap-2 transition-all duration-200 ${activeSeverityStyle}`}
            >
              {severity === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              ) : severity === 'warn' ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              ) : (
                <Activity className="w-4 h-4 flex-shrink-0 text-sky-400" />
              )}

              <div className="flex-1 min-w-0">
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-80 block">
                  Suggestion
                </span>
                <div className="text-xs font-black leading-tight drop-shadow truncate">
                  {isOffline
                    ? 'Coach offline (waiting for IMU)'
                    : coachData?.message || 'Ready when you are'}
                </div>
              </div>
            </div>

            {/* Rep Counter & Quality Stats */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-1.5">
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">
                  Reps
                </span>
                <span className="text-base font-black text-white">
                  {coachData?.rep_count || 0}
                </span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-1.5">
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">
                  Quality
                </span>
                <span className="text-[10px] font-black text-blue-300 block truncate mt-0.5">
                  {qualityLabels[coachData?.quality] || coachData?.quality || 'Calibrated'}
                </span>
                {coachData?.confidence ? (
                  <span className="text-[8px] text-slate-400">
                    {Math.round(coachData.confidence * 100)}%
                  </span>
                ) : null}
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-1.5">
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">
                  Peak
                </span>
                <span className="text-xs font-black text-white mt-0.5 block">
                  {coachData?.peak_angle_last_rep ? `${coachData.peak_angle_last_rep}°` : '--'}
                </span>
              </div>
            </div>

            {/* Angle Progress Bar */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-lg p-2">
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-300 mb-1">
                <span>approx. wrist angle</span>
                <span className="text-blue-300 font-extrabold">
                  {coachData?.current_angle !== undefined ? `${Math.round(coachData.current_angle)}°` : '0°'} / {target}°
                </span>
              </div>

              {/* Progress bar with target indicator marker */}
              <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-100 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="flex justify-between text-[8px] text-slate-500 font-bold mt-0.5">
                <span>0° Neutral</span>
                <span>Target: {target}°</span>
              </div>
            </div>

            {/* Anomaly / Jerk Status */}
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1 text-[10px]">
              <span className="text-slate-400 font-semibold">Motion:</span>
              {coachData?.anomaly ? (
                <span className="text-rose-400 font-black flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Tremor / Jerk
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Smooth
                </span>
              )}
            </div>

            {/* Interactive Exercise & Target Configuration */}
            <div className="border-t border-slate-800/80 pt-2 flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Exercise
                </label>
                <select
                  value={selectedExercise}
                  onChange={(e) => handleExerciseChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 text-[10px] font-semibold text-slate-200 rounded p-1 focus:outline-none focus:border-purple-500"
                >
                  {EXERCISES.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.axis})
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-16">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Target (°)
                </label>
                <input
                  type="number"
                  min="10"
                  max="90"
                  value={targetAngle}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 text-[10px] font-black text-slate-200 rounded p-1 text-center focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
