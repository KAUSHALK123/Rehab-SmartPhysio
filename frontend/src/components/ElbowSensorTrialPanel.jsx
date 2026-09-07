import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Sliders, 
  AlertTriangle, 
  Radio, 
  Sparkles, 
  RefreshCw,
  Layers
} from 'lucide-react';
import { 
  processElbowTelemetry, 
  mapElbowSensorToGLBAngles, 
  normalizeElbowSensor 
} from '../services/elbowSensorMapper';
import { loadCalibrationConfig } from '../services/calibrationConfig';

export default function ElbowSensorTrialPanel({
  liveSensors = {},
  deviceConnected = false,
  lastPacketTime = null,
  onAnglesUpdate,
  onToggleCalibrationMode
}) {
  const glbConfig = useRef(loadCalibrationConfig());
  const [activeMode, setActiveMode] = useState('live'); // 'live' | 'simulation'
  const [isElbowSynced, setIsElbowSynced] = useState(true);
  const [simPct, setSimPct] = useState(0);

  // Connection heartbeat tracking
  const [connectionLost, setConnectionLost] = useState(false);
  const [timeSinceLastPacket, setTimeSinceLastPacket] = useState(0);

  useEffect(() => {
    glbConfig.current = loadCalibrationConfig();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastPacketTime) {
        setConnectionLost(true);
        setTimeSinceLastPacket(999);
        return;
      }
      const diffSec = (Date.now() - lastPacketTime) / 1000;
      setTimeSinceLastPacket(Math.round(diffSec));
      setConnectionLost(diffSec > 3.5 || !deviceConnected);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastPacketTime, deviceConnected]);

  // Read approved calibration bounds for elbow
  const elbowConfig = glbConfig.current?.elbow?.elbowFlexion || {
    targetBone: 'WristArm',
    x: { min: -110, max: 0 }
  };

  const rawElbowVal = liveSensors?.raw_elbow !== undefined ? liveSensors.raw_elbow : (liveSensors?.elbow ?? 180);

  // Process live telemetry
  const exerciseMeta = { primary_sensor: 'elbow', target_angle: 90 };
  const processedLive = processElbowTelemetry(liveSensors, exerciseMeta, glbConfig.current);

  // Active GLB angle resolution
  let activeAngles = { x: 0, y: 0, z: 0 };
  let displayRaw = '--';
  let normPct = 0;

  if (activeMode === 'live' && isElbowSynced && deviceConnected && processedLive) {
    activeAngles = processedLive.angles;
    displayRaw = processedLive.raw;
    normPct = Math.round(processedLive.normalized * 100);
  } else if (activeMode === 'simulation') {
    const norm = Math.max(0, Math.min(1, simPct / 100.0));
    activeAngles = mapElbowSensorToGLBAngles(norm, glbConfig.current);
    displayRaw = Math.round(norm * 4095);
    normPct = simPct;
  }

  // Notify 3D model visualizer
  useEffect(() => {
    if (isElbowSynced || activeMode === 'simulation') {
      onAnglesUpdate?.(activeAngles);
    } else {
      onAnglesUpdate?.({ x: 0, y: 0, z: 0 });
    }
  }, [activeAngles.x, activeAngles.y, activeAngles.z, isElbowSynced, activeMode]);

  // Handle manual slider adjustment
  const handleSimSliderChange = (newVal) => {
    setActiveMode('simulation');
    setSimPct(Number(newVal));
  };

  const switchToLiveMode = () => {
    setActiveMode('live');
    if (processedLive) {
      onAnglesUpdate?.(processedLive.angles);
    }
  };

  // Range span helper for GLB bar percentage
  const getGlbPct = () => {
    const limit = elbowConfig.x || { min: -110, max: 0 };
    const val = activeAngles.x || 0;
    const span = Math.abs(limit.max - limit.min) || 110;
    return Math.max(0, Math.min(100, (Math.abs(val - limit.min) / span) * 100));
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 text-slate-800 text-xs select-none">
      {/* Top Banner & Sync Status Badge */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600 animate-pulse" />
            <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              Elbow Telemetry &amp; Movement
            </span>
          </div>

          <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-1 rounded-full border ${
            !deviceConnected && activeMode === 'live'
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : isElbowSynced
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse'
                : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              !deviceConnected && activeMode === 'live' ? 'bg-amber-500' : isElbowSynced ? 'bg-emerald-500' : 'bg-slate-400'
            }`} />
            {!deviceConnected && activeMode === 'live'
              ? 'Waiting for Flex Sensor...'
              : isElbowSynced
                ? 'Real-Time Elbow Active'
                : 'Elbow Sync Off'}
          </span>
        </div>

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

        {/* Two Side-By-Side Diagnostic Cards */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* LEFT CARD: GLB ELBOW BEND */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                GLB ELBOW BEND
              </span>
              <span className="text-[9px] font-bold text-slate-400">Target Angle</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-extrabold text-slate-700">Flexion Angle</span>
                <span className="font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                  {Math.round(activeAngles.x)}°
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-150"
                  style={{ width: `${getGlbPct()}%` }}
                />
              </div>

              <div className="flex justify-between text-[9px] font-bold text-slate-400">
                <span>Range: {elbowConfig.x.min}° → {elbowConfig.x.max}°</span>
                <span className="text-purple-600 uppercase font-extrabold">Axis X</span>
              </div>
            </div>
          </div>

          {/* RIGHT CARD: LIVE ELBOW SENSOR */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                LIVE ELBOW SENSOR
              </span>
              <span className="text-[9px] font-bold text-slate-400">Raw &amp; Flex %</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-slate-600">Raw: r:{displayRaw}</span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {normPct}% Flex
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-150"
                  style={{ width: `${normPct}%` }}
                />
              </div>

              <div className="flex justify-between text-[9px] font-bold text-slate-400">
                <span>Sensor bounds: 180° → 90°</span>
                <span className="text-emerald-600 font-extrabold">Flex Sensor</span>
              </div>
            </div>
          </div>
        </div>

        {/* SYNC VALUES & SHOW REAL TIME ELBOW BUTTON */}
        <button
          type="button"
          onClick={() => setIsElbowSynced(prev => !prev)}
          className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
            isElbowSynced
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/30'
              : 'bg-slate-800 hover:bg-slate-900 text-white'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isElbowSynced ? 'animate-spin' : ''}`} />
          {isElbowSynced ? 'REAL TIME ELBOW SYNC ACTIVE' : 'SYNC VALUES & SHOW REAL TIME ELBOW'}
        </button>
      </div>

      {/* Developer Manual Adjustment & Controls Card */}
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

        {/* Manual Bend Slider */}
        <div className="space-y-1">
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

        {/* Quick Test Presets */}
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => handleSimSliderChange(0)}
            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[10px] cursor-pointer"
          >
            Straight (0%)
          </button>
          <button
            type="button"
            onClick={() => handleSimSliderChange(50)}
            className="flex-1 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg transition text-[10px] cursor-pointer border border-purple-200"
          >
            Half Bend (50%)
          </button>
          <button
            type="button"
            onClick={() => handleSimSliderChange(100)}
            className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition text-[10px] cursor-pointer shadow-sm"
          >
            Full Bend (100%)
          </button>
        </div>
      </div>

      {/* Calibration Mode Toggle */}
      <div className="p-2.5 bg-slate-900 text-slate-300 rounded-xl border border-slate-800 flex items-center justify-between">
        <span className="text-[9px] text-slate-400">Need to calibrate GLB angular limits?</span>
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
  );
}
