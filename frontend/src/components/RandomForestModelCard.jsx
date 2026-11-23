import React, { useState } from 'react';
import { Brain, TreePine, Activity, Sparkles, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Zap, ShieldCheck } from 'lucide-react';

export default function RandomForestModelCard({
  quality = 'correct',
  confidence = 0.94,
  anomalyScore = 0.0,
  exerciseName = 'Rehab Routine',
  isWristExercise = false,
  isFingerExercise = false
}) {
  const [expanded, setExpanded] = useState(false);

  // Friendly display names and styling for predicted classes
  const classConfig = {
    correct: {
      label: 'Correct Form',
      desc: 'Controlled trajectory within targeted range of motion',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badge: 'bg-emerald-600 text-white',
      dot: 'bg-emerald-500'
    },
    too_shallow: {
      label: 'Too Shallow (Sub-target ROM)',
      desc: 'Motion amplitude is insufficient; extend closer to target angle',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      badge: 'bg-amber-600 text-white',
      dot: 'bg-amber-500'
    },
    too_fast: {
      label: 'Too Fast (Excess Velocity)',
      desc: 'Velocity exceeds physiological motor control threshold (>120°/s)',
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      badge: 'bg-rose-600 text-white',
      dot: 'bg-rose-500'
    },
    jerky: {
      label: 'Jerky / Tremor Detected',
      desc: 'Elevated mean absolute jerk or spastic tremor detected by Isolation Forest',
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      badge: 'bg-purple-600 text-white',
      dot: 'bg-purple-500'
    }
  };

  const currentClass = classConfig[quality] || classConfig.correct;
  const confidencePct = Math.round((confidence || 0.9) * 100);

  // Feature weights from Random Forest model metrics
  const topFeatures = [
    { name: 'Peak Count & Repetition Rhythm', weight: 15.6, color: 'bg-indigo-500' },
    { name: 'Mean Absolute Jerk (Smoothness)', weight: 13.1, color: 'bg-blue-500' },
    { name: 'Dominant Spectral Frequency (FFT)', weight: 13.0, color: 'bg-purple-500' },
    { name: 'Angular Velocity Mean & Variance', weight: 12.7, color: 'bg-emerald-500' }
  ];

  return (
    <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs transition-all duration-200 hover:shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
            <TreePine className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-800 tracking-tight">
                Random Forest Classifier
              </span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                100 Trees
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Kinematic Quality Ensemble • 20Hz Window
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="text-slate-400 hover:text-slate-600 transition p-1"
          title="Toggle model feature details"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Live Classification Result */}
      <div className={`p-3 rounded-xl border ${currentClass.color} flex flex-col gap-2 transition-all duration-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${currentClass.dot} animate-pulse`} />
            <span className="text-xs font-black uppercase tracking-wide">
              {currentClass.label}
            </span>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${currentClass.badge}`}>
            {confidencePct}% Confidence
          </span>
        </div>

        <p className="text-[11px] font-medium leading-relaxed opacity-90">
          {currentClass.desc}
        </p>

        {/* Confidence Progress Bar */}
        <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden">
          <div 
            className="h-full bg-current opacity-80 rounded-full transition-all duration-300"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>

      {/* Ensemble voting & Architecture Specs */}
      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="bg-white p-2 rounded-xl border border-slate-200/70">
          <span className="text-slate-400 font-semibold block text-[9px] uppercase">Ensemble</span>
          <span className="font-extrabold text-slate-800">100 Estimators</span>
        </div>
        <div className="bg-white p-2 rounded-xl border border-slate-200/70">
          <span className="text-slate-400 font-semibold block text-[9px] uppercase">Inference</span>
          <span className="font-extrabold text-emerald-600">&lt; 15 ms</span>
        </div>
        <div className="bg-white p-2 rounded-xl border border-slate-200/70">
          <span className="text-slate-400 font-semibold block text-[9px] uppercase">Validation</span>
          <span className="font-extrabold text-slate-800">GroupSplit</span>
        </div>
      </div>

      {/* Expandable Feature Importances */}
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-slate-200/80 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
            <span>Primary Decision Tree Features</span>
            <span>Feature Weight</span>
          </div>

          {topFeatures.map((feat) => (
            <div key={feat.name} className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                <span className="truncate pr-2">{feat.name}</span>
                <span className="font-mono text-slate-500">{feat.weight}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1 overflow-hidden">
                <div 
                  className={`h-full ${feat.color} rounded-full`}
                  style={{ width: `${feat.weight * 3}%` }}
                />
              </div>
            </div>
          ))}

          <div className="text-[9px] text-slate-400 font-medium pt-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Zero-leakage session partitioning with real-time sliding window.
          </div>
        </div>
      )}
    </div>
  );
}
