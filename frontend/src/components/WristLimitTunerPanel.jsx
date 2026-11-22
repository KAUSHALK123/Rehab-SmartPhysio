import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Copy, Check, ShieldCheck, AlertCircle } from 'lucide-react';

// Original default limits from main (calibrationConfig.js & wristSensorMapper.js)
export const ORIGINAL_LIMITS = {
  X: [-45, 45],  // upDown.x (Flexion / Extension: Hand Up/Down)
  Y: [-60, 60],  // twist.y  (Pronation / Supination: Forearm Twist)
  Z: [-35, 35]   // hiMovement.z (Radial / Ulnar Deviation: Hand Left/Right)
};

export const AXIS_META = {
  X: { label: 'GLB X', desc: 'Hand Up / Down (Pitch)', mpuKey: 'pitch', color: 'border-l-rose-500' },
  Y: { label: 'GLB Y', desc: 'Forearm Twist (Roll)',   mpuKey: 'roll',  color: 'border-l-emerald-500' },
  Z: { label: 'GLB Z', desc: 'Hand Left / Right (Yaw)', mpuKey: 'yaw',   color: 'border-l-blue-500' }
};

export default function WristLimitTunerPanel({
  rawTelemetry = {},
  onAnglesChange,
  onZeroRequest
}) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'mpu'
  const [manualAngles, setManualAngles] = useState({ X: 0, Y: 0, Z: 0 });
  const [limits, setLimits] = useState(ORIGINAL_LIMITS);
  const [zeroOffset, setZeroOffset] = useState({ pitch: 0, roll: 0, yaw: 0 });
  const [copied, setCopied] = useState(false);

  // Extract raw MPU values
  const rawPitch = Number(rawTelemetry.wrist_pitch ?? rawTelemetry.pitch ?? 0.0);
  const rawRoll  = Number(rawTelemetry.wrist_roll  ?? rawTelemetry.roll  ?? 0.0);
  const rawYaw   = Number(rawTelemetry.wrist_yaw   ?? rawTelemetry.yaw   ?? 0.0);
  const rawVals  = { pitch: rawPitch, roll: rawRoll, yaw: rawYaw };

  // Calculate live output angles and clamping states
  const computedAngles = {};
  const isClamped = {};

  ['X', 'Y', 'Z'].forEach(axis => {
    const meta = AXIS_META[axis];
    const [minLim, maxLim] = limits[axis];

    if (mode === 'manual') {
      const rawMan = manualAngles[axis];
      // In manual mode, rotate bone directly so user can see axis behavior and drag to natural limits
      computedAngles[axis.toLowerCase()] = rawMan;
      isClamped[axis] = rawMan < minLim || rawMan > maxLim;
    } else {
      // MPU live mode: raw angle minus zero offset, clamped to [min, max]
      const rawMpu = rawVals[meta.mpuKey] - (zeroOffset[meta.mpuKey] || 0.0);
      const clamped = Math.max(minLim, Math.min(maxLim, rawMpu));
      computedAngles[axis.toLowerCase()] = clamped;
      isClamped[axis] = rawMpu < minLim || rawMpu > maxLim;
    }
  });

  // Notify parent of updated angles
  useEffect(() => {
    onAnglesChange?.(computedAngles);
  }, [computedAngles.x, computedAngles.y, computedAngles.z, onAnglesChange]);

  // Re-zero handler (Key Z)
  const handleRezero = () => {
    const newZero = { pitch: rawPitch, roll: rawRoll, yaw: rawYaw };
    setZeroOffset(newZero);
    onZeroRequest?.(newZero);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleRezero();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rawPitch, rawRoll, rawYaw]);

  // Update a limit bound
  const setLimitBound = (axis, index, val) => {
    setLimits(prev => ({
      ...prev,
      [axis]: index === 0 ? [Math.min(0, Number(val)), prev[axis][1]] : [prev[axis][0], Math.max(0, Number(val))]
    }));
  };

  // Reset to original limits
  const handleResetLimits = () => {
    setLimits(ORIGINAL_LIMITS);
    setManualAngles({ X: 0, Y: 0, Z: 0 });
  };

  // Copy limits JSON
  const handleCopyLimits = () => {
    const jsonStr = JSON.stringify(limits);
    navigator.clipboard?.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-80 md:w-88 bg-slate-900/95 backdrop-blur-md border border-slate-750 rounded-2xl shadow-2xl overflow-hidden text-xs text-slate-200 z-30">
      
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-400" />
          <span className="font-extrabold text-sm text-white tracking-wide">
            Wrist Limits & Calibrator
          </span>
        </div>

        {/* Mode Toggle: Manual Sliders vs MPU Live */}
        <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
              mode === 'manual' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setMode('mpu')}
            className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
              mode === 'mpu' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            MPU Live
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3 max-h-[82vh] overflow-y-auto">

        {/* Info Banner */}
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-[10px] flex items-center justify-between text-slate-400">
          <span>Mode: <strong className="text-white uppercase">{mode === 'manual' ? 'Manual Angle Sliders' : 'MPU Live Sensor'}</strong></span>
          {mode === 'mpu' && (
            <button
              onClick={handleRezero}
              className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[9px] flex items-center gap-1"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Re-zero (Z)
            </button>
          )}
        </div>

        {/* ── 3 Blocks (One per GLB Axis: X, Y, Z) ─────────────────── */}
        {['X', 'Y', 'Z'].map(axis => {
          const meta = AXIS_META[axis];
          const [minLim, maxLim] = limits[axis];
          const rawMpuAngle = rawVals[meta.mpuKey] - (zeroOffset[meta.mpuKey] || 0.0);
          const currentGlb = computedAngles[axis.toLowerCase()];
          const clamped = isClamped[axis];

          return (
            <div
              key={axis}
              className={`p-2.5 rounded-xl border border-slate-800 bg-slate-950/50 space-y-2 border-l-4 ${meta.color}`}
            >
              {/* Block Header & Live Readout */}
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-extrabold text-white text-xs">{meta.label}</span>
                  <span className="text-[10px] text-slate-400 block">{meta.desc}</span>
                </div>

                <div className={`text-right font-mono text-[10px] px-2 py-0.5 rounded border ${
                  clamped
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-800'
                }`}>
                  <span>{mode === 'manual' ? `Man: ${manualAngles[axis]}°` : `${meta.mpuKey.toUpperCase()}: ${rawMpuAngle.toFixed(1)}°`}</span>
                  <span className="mx-1">→</span>
                  <strong className={clamped ? 'text-rose-400' : 'text-emerald-400'}>
                    {currentGlb.toFixed(1)}°
                  </strong>
                  {clamped && <span className="block text-[8px] font-black text-rose-400 uppercase">CLAMPED</span>}
                </div>
              </div>

              {/* a. Manual Angle Slider (-180 to +180 deg) */}
              <div className={mode === 'manual' ? 'opacity-100' : 'opacity-40 pointer-events-none'}>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span className="font-bold">Manual Test Slider</span>
                  <span className="font-mono font-bold text-purple-300">{manualAngles[axis]}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  disabled={mode !== 'manual'}
                  value={manualAngles[axis]}
                  onChange={(e) => setManualAngles(prev => ({ ...prev, [axis]: parseInt(e.target.value, 10) }))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* b. Min & Max Limit Sliders */}
              <div className="space-y-1.5 pt-1 border-t border-slate-850">
                {/* Min Limit */}
                <div>
                  <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>Min Limit: <strong className="text-rose-400 font-mono">{minLim}°</strong></span>
                    <button
                      type="button"
                      onClick={() => setLimitBound(axis, 0, manualAngles[axis])}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold border border-slate-700"
                      title="Set Min to current manual slider angle"
                    >
                      Set Min = Current ({manualAngles[axis]}°)
                    </button>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="0"
                    step="1"
                    value={minLim}
                    onChange={(e) => setLimitBound(axis, 0, e.target.value)}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                {/* Max Limit */}
                <div>
                  <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>Max Limit: <strong className="text-emerald-400 font-mono">+{maxLim}°</strong></span>
                    <button
                      type="button"
                      onClick={() => setLimitBound(axis, 1, manualAngles[axis])}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold border border-slate-700"
                      title="Set Max to current manual slider angle"
                    >
                      Set Max = Current ({manualAngles[axis]}°)
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    step="1"
                    value={maxLim}
                    onChange={(e) => setLimitBound(axis, 1, e.target.value)}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

            </div>
          );
        })}

        {/* ── Actions: Reset & Copy Limits ─────────────────────────── */}
        <div className="flex gap-2 pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={handleResetLimits}
            className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
          >
            Reset to Original Limits
          </button>

          <button
            type="button"
            onClick={handleCopyLimits}
            className="flex-1 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied JSON!' : 'Copy Limits JSON'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
