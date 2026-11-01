import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  Activity, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles,
  Layers,
  Radio,
  Cpu
} from 'lucide-react';

/**
 * ElbowSwitchTrialPanel Component
 * 
 * Provides live telemetry feedback, interactive simulation, configurable transition duration,
 * and GLB joint pose control for the ESP32 two-wire elbow contact switch.
 * 
 * Wiring:
 * - GPIO 27 (Configured as INPUT_PULLUP) ↔ Wire 1
 * - GND ↔ Wire 2
 * 
 * Logic:
 * - Switch closed (wires touching to GND) = LOW (0)  ➔ Elbow extended (0° bend)
 * - Switch open (wires separated)        = HIGH (1) ➔ Elbow bent (90° bend)
 */
export default function ElbowSwitchTrialPanel({
  liveSensors = {},
  deviceConnected = false,
  lastPacketTime = null,
  onAnglesUpdate = null,
  onStateChange = null
}) {
  // Mode: 'live' (real ESP32) | 'sim' (interactive buttons)
  const [mode, setMode] = useState('live');
  const [simState, setSimState] = useState(0); // 0 = closed (extended), 1 = open (bent)
  const [autoCycle, setAutoCycle] = useState(false);

  // Transition duration in ms (250ms - 400ms, default 300ms)
  const [transitionDuration, setTransitionDuration] = useState(300);

  // Repetition counting
  const [reps, setReps] = useState(0);
  const [repPhase, setRepPhase] = useState('extended'); // 'extended' | 'bent'

  // Always prioritize live hardware switch input from ESP32 if present
  const hasLiveSwitch = (liveSensors?.elbow_switch !== undefined && liveSensors?.elbow_switch !== null) ||
                        (liveSensors?.raw_elbow_switch !== undefined && liveSensors?.raw_elbow_switch !== null);

  const liveSwitchVal = liveSensors?.elbow_switch !== undefined 
    ? Number(liveSensors.elbow_switch) 
    : Number(liveSensors.raw_elbow_switch);

  const activeSwitchVal = (mode === 'live' && hasLiveSwitch)
    ? liveSwitchVal
    : (mode === 'live' && deviceConnected ? (hasLiveSwitch ? liveSwitchVal : 0) : simState);

  const isClosed = activeSwitchVal === 0;
  const isBent = !isClosed;

  // Repetition tracking effect
  useEffect(() => {
    if (isBent && repPhase === 'extended') {
      setRepPhase('bent');
    } else if (!isBent && repPhase === 'bent') {
      setRepPhase('extended');
      setReps(r => r + 1);
    }
    onStateChange?.({
      isClosed,
      isBent,
      reps,
      switchVal: activeSwitchVal,
      targetAngle: isClosed ? 0 : -90
    });
  }, [activeSwitchVal, isBent, isClosed, reps]);

  // Auto-cycle simulation timer
  useEffect(() => {
    if (!autoCycle) return;
    const interval = setInterval(() => {
      setMode('sim');
      setSimState(prev => (prev === 0 ? 1 : 0));
    }, 2500);
    return () => clearInterval(interval);
  }, [autoCycle]);

  // Map transition duration (250-400ms) to 60fps lerpFactor (0.28 down to 0.15)
  // 250ms -> ~0.26, 300ms -> ~0.22, 350ms -> ~0.18, 400ms -> ~0.15
  const lerpFactor = Math.max(0.12, Math.min(0.32, 66 / transitionDuration));

  // Forward rotation targets to 3D GLB model
  useEffect(() => {
    if (!onAnglesUpdate) return;

    if (isClosed) {
      // Extended Pose: 0° bend on local X axis, forearm straight
      onAnglesUpdate({
        angles: { x: 0, y: 0, z: 0 },
        bendDeg: 0,
        percentage: 0,
        lerpFactor,
        switchVal: 0,
        switchState: 'closed'
      });
    } else {
      // Bent Pose: -90° flexion forward on local X axis
      onAnglesUpdate({
        angles: { x: -90, y: 0, z: 0 },
        bendDeg: 90,
        percentage: 100,
        lerpFactor,
        switchVal: 1,
        switchState: 'open'
      });
    }
  }, [isClosed, lerpFactor, onAnglesUpdate]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Elbow Contact Switch Diagnostic</h3>
            <p className="text-[11px] text-slate-400">Two-Wire Contact Sensor • ESP32 GPIO 27</p>
          </div>
        </div>

        {/* Live vs Simulated Mode Badge */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-[11px] font-bold">
          <span className={`w-2 h-2 rounded-full ${hasLiveSwitch ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
          <span className="text-slate-600 dark:text-slate-300">
            {hasLiveSwitch ? 'ESP32 Streaming' : (deviceConnected ? 'ESP32 Connected' : 'Simulation Mode')}
          </span>
        </div>
      </div>

      {/* Main Live Switch Status Card */}
      <div className={`p-4 rounded-xl border transition-all duration-300 ${
        isClosed 
          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
          : 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Live Hardware GPIO 27 Status
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black">
                {isClosed ? 'SWITCH CLOSED (0)' : 'SWITCH OPEN (1)'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                isClosed ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-900' : 'bg-blue-200 dark:bg-blue-800 text-blue-900'
              }`}>
                {isClosed ? 'LOW (0V / GND)' : 'HIGH (3.3V / PULLUP)'}
              </span>
            </div>
            <p className="text-xs font-semibold">
              {isClosed 
                ? '✓ Contact Made (GPIO 27 connected to GND) ➔ 3D Joint: Extended (0°)' 
                : '⚡ Contact Broken (GPIO 27 disconnected) ➔ 3D Joint: Bent (-90°)'}
            </p>
          </div>

          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm ${
            isClosed ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            {isClosed ? '0°' : '-90°'}
          </div>
        </div>
      </div>

      {/* Reps Counter & Live Data Box */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Reps</span>
          <span className="text-2xl font-black text-slate-800 dark:text-white">{reps}</span>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Switch Input</span>
          <span className={`text-base font-extrabold block mt-1 ${isClosed ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
            GPIO 27 = {activeSwitchVal} ({isClosed ? 'LOW' : 'HIGH'})
          </span>
        </div>
      </div>

      {/* Transition Interpolation Duration Slider */}
      <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-500" />
            Smooth Interpolation Speed
          </span>
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
            {transitionDuration} ms
          </span>
        </div>
        <input 
          type="range"
          min="250"
          max="400"
          step="10"
          value={transitionDuration}
          onChange={(e) => setTransitionDuration(Number(e.target.value))}
          className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>250 ms (Snappy)</span>
          <span>325 ms</span>
          <span>400 ms (Gentle)</span>
        </div>
      </div>

      {/* Interactive Simulation Controls */}
      <div className="space-y-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
          Manual Test Controls
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setAutoCycle(false);
              setMode('sim');
              setSimState(0);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
              simState === 0 && mode === 'sim'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            Touch Wires (Extend 0)
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoCycle(false);
              setMode('sim');
              setSimState(1);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
              simState === 1 && mode === 'sim'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            Separate Wires (Bend 1)
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAutoCycle(prev => !prev)}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition border flex items-center justify-center gap-1.5 cursor-pointer ${
              autoCycle 
                ? 'bg-amber-500 text-white border-amber-600' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {autoCycle ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoCycle ? 'Stop Auto-Cycle' : 'Auto-Cycle Demo'}
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoCycle(false);
              setMode('live');
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            Reset to ESP32 Live
          </button>
        </div>
      </div>

      {/* Hardware Wiring Pinout Reference */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-blue-500" />
          <span>Hardware Pinout Guide:</span>
        </div>
        <ul className="space-y-1 list-disc list-inside text-[10px]">
          <li><strong>Wire 1:</strong> Connect to ESP32 <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">GPIO 27 (D27)</span></li>
          <li><strong>Wire 2:</strong> Connect to ESP32 <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">GND</span></li>
          <li><strong>Firmware Mode:</strong> Configured as <span className="font-mono text-purple-600 dark:text-purple-400">INPUT_PULLUP</span></li>
          <li><strong>Touch Wires (Connected to GND):</strong> Input reads <strong className="text-emerald-600 dark:text-emerald-400">LOW (0)</strong> ➔ 3D joint straightens (0°)</li>
          <li><strong>Separate Wires (Disconnected):</strong> Input reads <strong className="text-blue-600 dark:text-blue-400">HIGH (1)</strong> ➔ 3D joint flexes (-90°)</li>
        </ul>
      </div>
    </div>
  );
}
