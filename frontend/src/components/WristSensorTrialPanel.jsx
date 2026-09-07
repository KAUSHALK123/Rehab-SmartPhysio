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

  // Manual XYZ fine-tuning offsets in simulation mode
  const [customXYZ, setCustomXYZ] = useState(null);

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
    x: { min: -45, max: 45 },
    y: { min: -60, max: 60 },
    z: { min: -35, max: 35 }
  };

  const getMovementLimits = (movId) => {
    if (movId === 'upDown') return { min: -45, max: 45, label: 'Up / Down Flexion (X)', axis: 'x' };
    if (movId === 'hiMovement') return { min: -35, max: 35, label: 'Left / Right Waving (Z)', axis: 'z' };
    if (movId === 'twist') return { min: -60, max: 60, label: 'Pronation / Supination (Y)', axis: 'y' };
    return { min: -45, max: 45, label: 'Wrist Movement', axis: 'x' };
  };

  const movLimits = getMovementLimits(selectedMovement);

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
    normRatio = processedLive.normalizedRatio ?? 0.5;
    primarySensorName = selectedMovement === 'upDown' ? 'Pitch' : 'Roll';
  } else if (activeMode === 'simulation') {
    if (customXYZ) {
      activeAngles = customXYZ;
      primaryRawVal = customXYZ[movLimits.axis] || 0;
      const span = movLimits.max - movLimits.min || 90;
      normRatio = Math.max(0, Math.min(1, (primaryRawVal - movLimits.min) / span));
      primarySensorName = `Sim ${movLimits.axis.toUpperCase()}`;
    } else {
      const span = movLimits.max - movLimits.min || 90;
      const norm = Math.max(0, Math.min(1, (simAngle - movLimits.min) / span));
      activeAngles = mapWristSensorToGLBAngles(norm, selectedMovement, glbConfig.current);
      primaryRawVal = simAngle;
      normRatio = norm;
      primarySensorName = selectedMovement === 'upDown' ? 'Sim Pitch' : selectedMovement === 'twist' ? 'Sim Twist' : 'Sim Wave';
    }
  }

  // Notify 3D model visualizer
  useEffect(() => {
    if (isWristSynced || activeMode === 'simulation') {
      onAnglesUpdate?.(activeAngles);
    } else {
      onAnglesUpdate?.({ x: 0, y: 0, z: 0 });
    }
  }, [activeAngles.x, activeAngles.y, activeAngles.z, isWristSynced, activeMode]);

  // Handle movement dropdown change
  const handleMovementChange = (newMov) => {
    setSelectedMovement(newMov);
    setCustomXYZ(null);
    setSimAngle(0);
    if (activeMode === 'simulation') {
      const limits = getMovementLimits(newMov);
      const span = limits.max - limits.min || 90;
      const norm = 0.5;
      const mapped = mapWristSensorToGLBAngles(norm, newMov, glbConfig.current);
      onAnglesUpdate?.(mapped);
    }
  };

  // Handle manual main slider adjustment
  const handleSimSliderChange = (newVal) => {
    setActiveMode('simulation');
    setCustomXYZ(null);
    setSimAngle(Number(newVal));
  };

  // Handle individual axis slider change (X, Y, Z fine tuning)
  const handleCustomAxisChange = (axis, val) => {
    setActiveMode('simulation');
    const num = Number(val);
    setCustomXYZ(prev => ({
      x: activeAngles.x,
      y: activeAngles.y,
      z: activeAngles.z,
      ...(prev || {}),
      [axis]: num
    }));
  };

  const switchToLiveMode = () => {
    setActiveMode('simulation');
    setCustomXYZ(null);
    setSimAngle(0);
    setActiveMode('live');
    if (processedLive) {
      onAnglesUpdate?.(processedLive.angles);
    }
  };

  // Range span helper for bar percentage
  const getGlbPct = () => {
    const limit = movementConfig[movLimits.axis] || { min: movLimits.min, max: movLimits.max };
    const val = activeAngles[movLimits.axis] || 0;
    const span = Math.abs(limit.max - limit.min) || 90;
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
              <span className="text-[9px] font-bold text-slate-400">Euler Angles</span>
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
                <span>Axis {movLimits.axis.toUpperCase()}: {activeAngles[movLimits.axis]}°</span>
                <span className="text-purple-600 uppercase font-extrabold">Circle Bone</span>
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
          {isWristSynced ? 'REAL-TIME WRIST ACTIVE' : 'SYNC VALUES & SHOW REAL TIME WRIST'}
        </button>
      </div>

      {/* Developer Manual Adjustment & Controls Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            Manual Sensor Adjustment &amp; Movement Test
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

        {/* Movement Selector Dropdown */}
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Select Wrist Movement to Test
          </label>
          <select
            value={selectedMovement}
            onChange={(e) => handleMovementChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="upDown">1. Up / Down Waving (Flexion / Extension - Axis X)</option>
            <option value="hiMovement">2. Hi Movement (Left / Right Waving - Axis Z)</option>
            <option value="twist">3. Left / Right Twist (Pronation / Supination - Axis Y)</option>
          </select>
        </div>

        {/* Primary Movement Test Slider */}
        <div className="space-y-1 bg-purple-50/50 border border-purple-100 p-2.5 rounded-lg">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-extrabold text-purple-900">{movLimits.label}</span>
            <span className="font-black text-purple-700 bg-white px-1.5 py-0.5 rounded border border-purple-200 shadow-xs">
              {simAngle}°
            </span>
          </div>
          <input
            type="range"
            min={movLimits.min}
            max={movLimits.max}
            step="1"
            value={simAngle}
            onChange={(e) => handleSimSliderChange(e.target.value)}
            className="w-full accent-purple-600 cursor-pointer h-1.5 bg-purple-200 rounded-lg"
          />
          <div className="flex justify-between text-[8px] font-bold text-slate-400">
            <span>Min ({movLimits.min}°)</span>
            <span>Neutral (0°)</span>
            <span>Max (+{movLimits.max}°)</span>
          </div>
        </div>

        {/* Quick Test Presets for Selected Movement */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSimSliderChange(movLimits.min)}
            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[10px] cursor-pointer"
          >
            Min ({movLimits.min}°)
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
            onClick={() => handleSimSliderChange(movLimits.max)}
            className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition text-[10px] cursor-pointer shadow-sm"
          >
            Max (+{movLimits.max}°)
          </button>
        </div>

        {/* Individual X, Y, Z Axis Fine Tuning Sliders */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            Independent Axis Fine Tuning
          </span>
          <div className="grid grid-cols-3 gap-2">
            {/* Axis X */}
            <div className="space-y-1 bg-slate-50 p-1.5 rounded border border-slate-200">
              <div className="flex justify-between text-[9px] font-bold text-blue-600">
                <span>Pitch X</span>
                <span>{activeAngles.x}°</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="1"
                value={activeAngles.x}
                onChange={(e) => handleCustomAxisChange('x', e.target.value)}
                className="w-full accent-blue-600 cursor-pointer h-1 bg-slate-200 rounded"
              />
            </div>
            {/* Axis Y */}
            <div className="space-y-1 bg-slate-50 p-1.5 rounded border border-slate-200">
              <div className="flex justify-between text-[9px] font-bold text-emerald-600">
                <span>Twist Y</span>
                <span>{activeAngles.y}°</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="1"
                value={activeAngles.y}
                onChange={(e) => handleCustomAxisChange('y', e.target.value)}
                className="w-full accent-emerald-600 cursor-pointer h-1 bg-slate-200 rounded"
              />
            </div>
            {/* Axis Z */}
            <div className="space-y-1 bg-slate-50 p-1.5 rounded border border-slate-200">
              <div className="flex justify-between text-[9px] font-bold text-purple-600">
                <span>Wave Z</span>
                <span>{activeAngles.z}°</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="1"
                value={activeAngles.z}
                onChange={(e) => handleCustomAxisChange('z', e.target.value)}
                className="w-full accent-purple-600 cursor-pointer h-1 bg-slate-200 rounded"
              />
            </div>
          </div>
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
