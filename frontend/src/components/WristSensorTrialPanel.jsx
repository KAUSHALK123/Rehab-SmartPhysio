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
  processWristTelemetry, 
  mapWristSensorToGLBAngles 
} from '../services/wristSensorMapper';
import { loadCalibrationConfig } from '../services/calibrationConfig';

export default function WristSensorTrialPanel({
  liveSensors = {},
  deviceConnected = false,
  lastPacketTime = null,
  onAnglesUpdate,
  onToggleCalibrationMode
}) {
  const glbConfig = useRef(loadCalibrationConfig());
  const [selectedMovement, setSelectedMovement] = useState('upDown'); // 'upDown' | 'hiMovement' | 'twist'
  const [activeMode, setActiveMode] = useState('live'); // 'live' | 'simulation'
  const [isWristSynced, setIsWristSynced] = useState(true);
  const [simAngle, setSimAngle] = useState(0);

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

  // Read approved calibration bounds for selected movement
  const movementConfig = glbConfig.current?.wrist?.[selectedMovement] || {
    x: { min: -35, max: 35 },
    y: { min: -25, max: 25 },
    z: { min: -20, max: 20 }
  };

  // MPU6050 live readings
  const rawPitch = liveSensors?.wrist_pitch ?? liveSensors?.pitch ?? 0;
  const rawRoll = liveSensors?.wrist_roll ?? liveSensors?.roll ?? 0;
  const rawYaw = liveSensors?.yaw ?? 0;

  // Process live telemetry
  const exerciseMeta = { movement_id: selectedMovement, target_angle: 45 };
  const processedLive = processWristTelemetry(liveSensors, exerciseMeta, glbConfig.current);

  // Active GLB angle resolution
  let activeAngles = { x: 0, y: 0, z: 0 };
  let primaryRawVal = 0;
  let primarySensorName = 'Pitch';
  let normRatio = 0.5;

  if (activeMode === 'live' && isWristSynced && deviceConnected && processedLive) {
    activeAngles = processedLive.angles;
    primaryRawVal = processedLive.raw;
    normRatio = processedLive.normalized;
    primarySensorName = selectedMovement === 'upDown' ? 'Pitch' : 'Roll';
  } else if (activeMode === 'simulation') {
    // Map manual slider simAngle to normalized ratio [-45, 45] -> [0, 1]
    const norm = Math.max(0, Math.min(1, (simAngle + 45) / 90.0));
    activeAngles = mapWristSensorToGLBAngles(norm, selectedMovement, glbConfig.current);
    primaryRawVal = simAngle;
    normRatio = norm;
    primarySensorName = selectedMovement === 'upDown' ? 'Sim Pitch' : 'Sim Roll';
  }

  // Notify 3D model visualizer
  useEffect(() => {
    if (isWristSynced || activeMode === 'simulation') {
      onAnglesUpdate?.(activeAngles);
    } else {
      onAnglesUpdate?.({ x: 0, y: 0, z: 0 });
    }
  }, [activeAngles.x, activeAngles.y, activeAngles.z, isWristSynced, activeMode]);

  // Handle manual slider adjustment
  const handleSimSliderChange = (newVal) => {
    setActiveMode('simulation');
    setSimAngle(Number(newVal));
  };

  const switchToLiveMode = () => {
    setActiveMode('live');
    if (processedLive) {
      onAnglesUpdate?.(processedLive.angles);
    }
  };

  // Range span helper for bar percentage
  const getGlbPct = () => {
    const primaryAxis = selectedMovement === 'upDown' ? 'x' : 'y';
    const limit = movementConfig[primaryAxis] || { min: -35, max: 35 };
    const val = activeAngles[primaryAxis] || 0;
    const span = Math.abs(limit.max - limit.min) || 70;
    return Math.max(0, Math.min(100, ((val - limit.min) / span) * 100));
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 text-slate-800 text-xs select-none">
      {/* Top Banner & Sync Status Badge */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600 animate-pulse" />
            <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              Wrist Telemetry &amp; Movement
            </span>
          </div>

          <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-1 rounded-full border ${
            !deviceConnected && activeMode === 'live'
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : isWristSynced
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse'
                : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              !deviceConnected && activeMode === 'live' ? 'bg-amber-500' : isWristSynced ? 'bg-emerald-500' : 'bg-slate-400'
            }`} />
            {!deviceConnected && activeMode === 'live'
              ? 'Waiting for MPU6050...'
              : isWristSynced
                ? 'Real-Time Wrist Active'
                : 'Wrist Sync Off'}
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
          {/* LEFT CARD: GLB WRIST MOVEMENT */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                GLB WRIST MOVEMENT
              </span>
              <span className="text-[9px] font-bold text-slate-400">Target Angle</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-extrabold text-slate-700 capitalize">{selectedMovement}</span>
                <span className="font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                  X:{activeAngles.x}° Y:{activeAngles.y}° Z:{activeAngles.z}°
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
                <span>Range: {movementConfig.x.min}° → {movementConfig.x.max}°</span>
                <span className="text-purple-600 uppercase font-extrabold">Circle Joint</span>
              </div>
            </div>
          </div>

          {/* RIGHT CARD: LIVE MPU6050 */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                LIVE MPU6050
              </span>
              <span className="text-[9px] font-bold text-slate-400">Pitch / Roll / Yaw</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-slate-600">{primarySensorName}</span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Pitch: {rawPitch.toFixed(1)}° | Roll: {rawRoll.toFixed(1)}°
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-150"
                  style={{ width: `${Math.round(normRatio * 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-[9px] font-bold text-slate-400">
                <span>Yaw: {rawYaw.toFixed(1)}°</span>
                <span className="text-emerald-600 font-extrabold">{Math.round(normRatio * 100)}% Sensor</span>
              </div>
            </div>
          </div>
        </div>

        {/* SYNC VALUES & SHOW REAL TIME WRIST BUTTON */}
        <button
          type="button"
          onClick={() => setIsWristSynced(prev => !prev)}
          className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
            isWristSynced
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/30'
              : 'bg-slate-800 hover:bg-slate-900 text-white'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isWristSynced ? 'animate-spin' : ''}`} />
          {isWristSynced ? 'REAL TIME WRIST SYNC ACTIVE' : 'SYNC VALUES & SHOW REAL TIME WRIST'}
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

        {/* Movement Selector & Slider */}
        <div className="grid grid-cols-3 gap-3 items-center">
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Select Movement
            </label>
            <select
              value={selectedMovement}
              onChange={(e) => {
                setSelectedMovement(e.target.value);
                handleSimSliderChange(simAngle);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="upDown">Up / Down (Flexion)</option>
              <option value="hiMovement">Hi Movement (Waving)</option>
              <option value="twist">Left / Right Twist</option>
            </select>
          </div>

          <div className="col-span-2 space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-slate-500">Test Sensor Angle</span>
              <span className="font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                {simAngle}°
              </span>
            </div>
            <input
              type="range"
              min="-45"
              max="45"
              step="1"
              value={simAngle}
              onChange={(e) => handleSimSliderChange(e.target.value)}
              className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
          </div>
        </div>

        {/* Quick Test Presets */}
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => handleSimSliderChange(-45)}
            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[10px] cursor-pointer"
          >
            Min (-45°)
          </button>
          <button
            type="button"
            onClick={() => handleSimSliderChange(0)}
            className="flex-1 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg transition text-[10px] cursor-pointer border border-purple-200"
          >
            Neutral (0°)
          </button>
          <button
            type="button"
            onClick={() => handleSimSliderChange(45)}
            className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition text-[10px] cursor-pointer shadow-sm"
          >
            Max (+45°)
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
