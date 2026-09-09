import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Play, 
  Square, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Terminal, 
  Radio, 
  Sparkles, 
  RotateCcw,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  FINGER_KEYS, 
  FINGER_RIG_MAP, 
  processFingerTelemetry, 
  mapNormalizedToGlb 
} from '../services/fingerSensorMapper';
import { loadCalibrationConfig } from '../services/calibrationConfig';

export default function FingerSensorTrialPanel({
  liveSensors = {},
  deviceConnected = false,
  lastPacketTime = null,
  onAnglesUpdate, // Callback to parent to update 3D model with finger angles: ({ thumb, index, middle, ring, little }) => void
  onToggleCalibrationMode // Callback to switch back to Fix 1 calibration view if needed
}) {
  const glbConfig = useRef(loadCalibrationConfig());

  // Operational mode: 'live' | 'simulation' | 'demo'
  const [activeMode, setActiveMode] = useState('live');

  // Selected finger for manual simulation
  const [simFinger, setSimFinger] = useState('thumb');
  const [simPct, setSimPct] = useState(0);

  // Automated demo running state
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoActiveFinger, setDemoActiveFinger] = useState(null);
  const animFrameRef = useRef(null);

  // Debug drawer toggle
  const [showDebug, setShowDebug] = useState(true);

  // Connection heartbeat state (>3.5 seconds without packets = lost)
  const [connectionLost, setConnectionLost] = useState(false);
  const [timeSinceLastPacket, setTimeSinceLastPacket] = useState(0);

  // Re-read GLB configuration on mount
  useEffect(() => {
    glbConfig.current = loadCalibrationConfig();
  }, []);

  // Check telemetry heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastPacketTime) {
        setConnectionLost(true);
        setTimeSinceLastPacket(999);
        return;
      }
      const diffSec = (Date.now() - lastPacketTime) / 1000;
      setTimeSinceLastPacket(Math.round(diffSec));
      if (diffSec > 3.5 || !deviceConnected) {
        setConnectionLost(true);
      } else {
        setConnectionLost(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastPacketTime, deviceConnected]);

  // Current processed telemetry readings
  const [processedTelemetry, setProcessedTelemetry] = useState(() => 
    processFingerTelemetry(liveSensors, glbConfig.current)
  );

  // 1. LIVE SENSOR PIPELINE
  useEffect(() => {
    if (activeMode !== 'live') return;

    const result = processFingerTelemetry(liveSensors, glbConfig.current);
    setProcessedTelemetry(result);
    onAnglesUpdate?.(result.angles);
  }, [liveSensors, activeMode]);

  // 2. SIMULATION PIPELINE (Manual Slider)
  const handleSimSliderChange = (newPct) => {
    setActiveMode('simulation');
    setDemoRunning(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const pct = Math.max(0, Math.min(100, Number(newPct)));
    setSimPct(pct);

    // Build simulated angles: selected finger bends by slider %, other fingers stay at 0%
    const currentAngles = {};
    const currentDebug = { ...processedTelemetry.debug };

    FINGER_KEYS.forEach((f) => {
      const norm = f === simFinger ? pct / 100.0 : 0.0;
      const mapped = mapNormalizedToGlb(norm, f, glbConfig.current);
      currentAngles[f] = mapped.angle;

      currentDebug[f] = {
        finger: f,
        raw: f === simFinger ? Math.round(norm * 4095) : 0,
        filtered: f === simFinger ? Math.round(norm * 90) : 0,
        normalized: Math.round(norm * 100),
        axis: mapped.axis,
        range: `${mapped.min}° → ${mapped.max}°`,
        glbAngle: mapped.angle,
        targetBone: mapped.targetBone,
        min: mapped.min,
        max: mapped.max
      };
    });

    setProcessedTelemetry(prev => ({
      ...prev,
      angles: currentAngles,
      percentages: { ...prev.percentages, [simFinger]: pct },
      debug: currentDebug
    }));

    onAnglesUpdate?.(currentAngles);
  };

  // 3. AUTOMATED FINGER DEMO (Sequential 0% → 100% → 0% for each finger)
  const startFingerDemo = () => {
    setActiveMode('demo');
    setDemoRunning(true);

    const fingersSequence = ['thumb', 'index', 'middle', 'ring', 'little'];
    let fingerIdx = 0;
    let startTime = performance.now();
    const durationPerFinger = 1600; // 1.6 seconds per finger (up and down)

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationPerFinger);

      // Smooth sine curve: 0 -> 1 -> 0
      // sin(0) = 0, sin(PI/2) = 1, sin(PI) = 0
      const bendRatio = Math.sin(progress * Math.PI);
      const currentFinger = fingersSequence[fingerIdx];
      setDemoActiveFinger(currentFinger);

      // Calculate angles
      const currentAngles = {};
      const currentDebug = { ...processedTelemetry.debug };

      fingersSequence.forEach((f) => {
        const norm = f === currentFinger ? bendRatio : 0.0;
        const mapped = mapNormalizedToGlb(norm, f, glbConfig.current);
        currentAngles[f] = mapped.angle;

        currentDebug[f] = {
          finger: f,
          raw: f === currentFinger ? Math.round(norm * 4095) : 0,
          filtered: f === currentFinger ? Math.round(norm * 90) : 0,
          normalized: Math.round(norm * 100),
          axis: mapped.axis,
          range: `${mapped.min}° → ${mapped.max}°`,
          glbAngle: mapped.angle,
          targetBone: mapped.targetBone,
          min: mapped.min,
          max: mapped.max
        };
      });

      setProcessedTelemetry(prev => ({
        ...prev,
        angles: currentAngles,
        percentages: { ...prev.percentages, [currentFinger]: Math.round(bendRatio * 100) },
        debug: currentDebug
      }));

      onAnglesUpdate?.(currentAngles);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Move to next finger
        fingerIdx++;
        if (fingerIdx < fingersSequence.length) {
          startTime = performance.now();
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Loop or stop
          setDemoRunning(false);
          setDemoActiveFinger(null);
          // Return to live mode
          switchToLiveMode();
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const stopDemo = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setDemoRunning(false);
    setDemoActiveFinger(null);
    switchToLiveMode();
  };

  // Switch back to real sensor priority
  const switchToLiveMode = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setDemoRunning(false);
    setActiveMode('live');
    const result = processFingerTelemetry(liveSensors, glbConfig.current);
    setProcessedTelemetry(result);
    onAnglesUpdate?.(result.angles);
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 text-slate-800 text-xs select-none">
      
      {/* Top Banner: Mode & Connection Status */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600 animate-pulse" />
            <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              Finger Telemetry & Movement
            </span>
          </div>

          {/* Mode Pill Indicator */}
          {activeMode === 'live' ? (
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              LIVE SENSOR
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
              <Sparkles className="w-3 h-3 text-purple-600" />
              SIMULATION
            </span>
          )}
        </div>

        {/* Telemetry Disconnection Warning Banner */}
        {connectionLost && activeMode === 'live' && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center justify-between text-[11px] font-bold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Sensor connection lost</span>
            </div>
            <span className="text-[10px] text-rose-500 font-semibold">
              {lastPacketTime ? `Last stream: ${timeSinceLastPacket}s ago` : 'Awaiting hardware...'}
            </span>
          </div>
        )}

        {/* Two Side-By-Side Cards: GLB FINGER BEND & LIVE FLEX SENSORS */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* LEFT CARD: GLB FINGER BEND */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                GLB FINGER BEND
              </span>
              <span className="text-[9px] font-bold text-slate-400">Target Angle</span>
            </div>

            <div className="flex items-end justify-between gap-1.5 h-24 pt-1">
              {FINGER_KEYS.map((finger) => {
                const info = processedTelemetry.debug[finger] || {};
                const angle = info.glbAngle !== undefined ? info.glbAngle : 0;
                const min = info.min !== undefined ? info.min : 0;
                const max = info.max !== undefined ? info.max : 60;
                const rangeSpan = Math.abs(max - min) || 60;
                const pct = Math.max(0, Math.min(100, (Math.abs(angle - min) / rangeSpan) * 100));

                return (
                  <div key={finger} className="flex-1 flex flex-col items-center h-full justify-end min-w-0">
                    <span className="text-[9px] font-black text-slate-800 mb-1">
                      {Math.round(angle)}°
                    </span>
                    <div className="w-2.5 bg-slate-100 rounded-full h-full relative overflow-hidden flex flex-col justify-end">
                      <div 
                        className="w-full rounded-full transition-all duration-150 ease-out bg-gradient-to-t from-purple-600 to-indigo-500 shadow-sm"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-extrabold text-slate-400 mt-1 select-none uppercase">
                      {finger.substring(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT CARD: LIVE FLEX SENSORS */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                LIVE FLEX SENSORS
              </span>
              <span className="text-[9px] font-bold text-slate-400">Raw &amp; Flex %</span>
            </div>

            <div className="flex items-end justify-between gap-1.5 h-24 pt-1">
              {FINGER_KEYS.map((finger) => {
                const info = processedTelemetry.debug[finger] || {};
                const flexPct = processedTelemetry.percentages[finger] || 0;
                const rawVal = info.raw !== null && info.raw !== undefined ? info.raw : '--';

                return (
                  <div key={finger} className="flex-1 flex flex-col items-center h-full justify-end min-w-0">
                    <span className="text-[8px] font-bold text-slate-400 leading-none mb-0.5">
                      r:{rawVal}
                    </span>
                    <span className="text-[9px] font-black text-slate-800 mb-1">
                      {Math.round(flexPct)}%
                    </span>
                    <div className="w-2.5 bg-slate-100 rounded-full h-full relative overflow-hidden flex flex-col justify-end">
                      <div 
                        className="w-full rounded-full transition-all duration-150 ease-out bg-gradient-to-t from-emerald-500 to-teal-400 shadow-sm"
                        style={{ height: `${flexPct}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-extrabold text-slate-400 mt-1 select-none uppercase">
                      {finger.substring(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Developer Simulation / Playback Controls Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            Manual Sensor Adjustment &amp; Test Presets
          </span>
          {activeMode !== 'live' && (
            <button
              type="button"
              onClick={switchToLiveMode}
              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
            >
              ← Return to Live Sensor
            </button>
          )}
        </div>

        {/* Finger Selector & Slider */}
        <div className="grid grid-cols-3 gap-3 items-center">
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Select Finger
            </label>
            <select
              value={simFinger}
              onChange={(e) => {
                setSimFinger(e.target.value);
                handleSimSliderChange(simPct);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="thumb">Thumb (Axis X)</option>
              <option value="index">Index (Axis Z)</option>
              <option value="middle">Middle (Axis Z)</option>
              <option value="ring">Ring (Axis Z)</option>
              <option value="little">Little (Axis Z)</option>
            </select>
          </div>

          <div className="col-span-2 space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-slate-500">Simulated Bend Ratio</span>
              <span className="font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                {simPct}% Bend
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={simPct}
              onChange={(e) => handleSimSliderChange(e.target.value)}
              className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
          </div>
        </div>

        {/* Manual Quick Presets (0%, 50%, 100%) */}
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => handleSimSliderChange(0)}
            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[10px] cursor-pointer"
          >
            Rest (0%)
          </button>
          <button
            type="button"
            onClick={() => handleSimSliderChange(50)}
            className="flex-1 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg transition text-[10px] cursor-pointer border border-purple-200"
          >
            Half Flex (50%)
          </button>
          <button
            type="button"
            onClick={() => handleSimSliderChange(100)}
            className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition text-[10px] cursor-pointer shadow-sm"
          >
            Full Flex (100%)
          </button>
        </div>

        {/* Automated Sequential Demo Button */}
        <div className="flex gap-2 pt-1">
          {demoRunning ? (
            <button
              type="button"
              onClick={stopDemo}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-xs"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop Finger Demo
            </button>
          ) : (
            <button
              type="button"
              onClick={startFingerDemo}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-purple-200 text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Play Finger Demo (Thumb → Little Sequential 0–100%)
            </button>
          )}
        </div>
      </div>

      {/* Sensor → GLB Debug Information Panel */}
      <div className="bg-slate-900 text-slate-300 rounded-xl border border-slate-800 overflow-hidden shadow-sm flex-1 flex flex-col justify-between">
        <div>
          <button
            type="button"
            onClick={() => setShowDebug(prev => !prev)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer border-b border-slate-800"
          >
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              Sensor → GLB Real-time Diagnostic Telemetry
            </span>
            {showDebug ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDebug && (
            <div className="p-3 space-y-2 overflow-x-auto text-[10px] font-mono leading-relaxed">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                    <th className="py-1 px-1">Finger</th>
                    <th className="py-1 px-1">Target Bone</th>
                    <th className="py-1 px-1">Raw</th>
                    <th className="py-1 px-1">Norm %</th>
                    <th className="py-1 px-1">Axis</th>
                    <th className="py-1 px-1">GLB Range</th>
                    <th className="py-1 px-1 text-right">GLB Angle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {FINGER_KEYS.map((f) => {
                    const info = processedTelemetry.debug[f] || {};
                    const isTargeted = (activeMode === 'simulation' && simFinger === f) || (activeMode === 'demo' && demoActiveFinger === f);

                    return (
                      <tr key={f} className={isTargeted ? 'bg-purple-950/40 text-purple-200' : 'hover:bg-slate-850/50'}>
                        <td className="py-1.5 px-1 font-bold capitalize text-slate-200">{f}</td>
                        <td className="py-1.5 px-1 text-slate-400">{info.targetBone}</td>
                        <td className="py-1.5 px-1 text-slate-300">{info.raw ?? '--'}</td>
                        <td className="py-1.5 px-1 text-emerald-400 font-bold">{info.normalized}%</td>
                        <td className="py-1.5 px-1 font-bold text-cyan-400">{info.axis}</td>
                        <td className="py-1.5 px-1 text-slate-400">{info.range}</td>
                        <td className="py-1.5 px-1 text-right font-extrabold text-amber-300">{info.glbAngle}°</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Link to switch to Fix 1 GLB Calibration */}
        <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[9px] text-slate-500">Need to tune GLB physical limits?</span>
          <button
            type="button"
            onClick={onToggleCalibrationMode}
            className="text-[10px] font-bold text-purple-400 hover:text-purple-300 underline cursor-pointer flex items-center gap-1"
          >
            <Layers className="w-3 h-3" />
            Switch to GLB Calibration Tool
          </button>
        </div>
      </div>

    </div>
  );
}
