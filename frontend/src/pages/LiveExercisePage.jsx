import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { 
  Activity, 
  Play, 
  Pause,
  Square, 
  Clock, 
  Award, 
  TrendingUp, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  Cpu,
  ChevronLeft,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { startSession, endSession } from '../services/session';
import apiClient from '../services/auth';
import Arm3DVisualizer from '../components/Arm3DVisualizer';
import Trial3DVisualizer from '../components/Trial3DVisualizer';

// Speedometer-style circular gauge component with rotating needle
const SVGGauge = ({ value, min = 0, max = 180, title, aimText, currentText, feedbackText }) => {
  // Map value to angle from -90 to 90 degrees
  const angle = ((value - min) / (max - min)) * 180 - 90;
  // Ensure angle is bounded
  const boundedAngle = Math.max(-90, Math.min(90, angle));
  
  return (
    <div className="flex flex-col items-center text-center space-y-1 bg-slate-50 border border-slate-100 rounded-xl p-3 flex-1 min-w-0 shadow-sm transition hover:shadow duration-200">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{title}</span>
      
      <div className="relative w-24 h-14 flex items-center justify-center mt-1">
        <svg viewBox="0 0 100 60" className="w-20 h-12">
          {/* Background gray arc */}
          <path
            d="M 15 50 A 35 35 0 0 1 85 50"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Active progress arc */}
          <path
            d="M 15 50 A 35 35 0 0 1 85 50"
            fill="none"
            stroke="url(#gauge-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={110}
            strokeDashoffset={110 - (110 * Math.max(0, Math.min(value - min, max - min))) / (max - min)}
            className="transition-all duration-300 ease-out"
          />
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          {/* Needle pin */}
          <g transform={`translate(50, 50) rotate(${boundedAngle})`}>
            <line x1="0" y1="0" x2="0" y2="-38" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="0" r="4.5" fill="#1e293b" />
          </g>
        </svg>
      </div>

      <div className="text-[10px] font-bold text-slate-500 mt-1">{aimText}</div>
      <div className="text-[11px] font-extrabold text-slate-800">{currentText}</div>
      <p className="text-[10px] text-slate-500 font-semibold leading-tight mt-1 h-7 flex items-center justify-center text-center">
        {feedbackText}
      </p>
    </div>
  );
};

// Forearm and wrist rotation illustration
const WristIcon = () => (
  <svg viewBox="0 0 64 64" className="w-12 h-12 text-slate-400 opacity-85 flex-shrink-0">
    <path d="M12 40 L28 40 L32 30 L48 30 L52 35 L48 40 L32 40 L28 46 L12 46 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M46 16 A 14 14 0 0 1 54 36" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="3 3" />
    <path d="M52 36 L54 36 L54 34" fill="none" stroke="#3b82f6" strokeWidth="2" />
    <path d="M38 34 A 14 14 0 0 1 42 18" fill="none" stroke="#3b82f6" strokeWidth="2" />
    <path d="M40 18 L42 18 L42 20" fill="none" stroke="#3b82f6" strokeWidth="2" />
  </svg>
);

// 5 vertical volume-style bars for finger flexion values
const FingerVolumeBars = ({ sensors }) => {
  const fingers = [
    { name: 'Thumb', val: sensors.thumb || 0 },
    { name: 'Index', val: sensors.index || 0 },
    { name: 'Middle', val: sensors.middle || 0 },
    { name: 'Ring', val: sensors.ring || 0 },
    { name: 'Little', val: sensors.little || 0 }
  ];

  // Map value to temperature-style gradient colors
  const getColorClass = (val) => {
    if (val < 30) return 'bg-gradient-to-t from-emerald-500 to-green-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (val < 70) return 'bg-gradient-to-t from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-gradient-to-t from-rose-500 to-pink-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  };

  return (
    <div className="flex flex-col text-left space-y-2 bg-slate-50 border border-slate-100 rounded-xl p-3 flex-1 min-w-0 shadow-sm transition hover:shadow duration-200">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fingers Flexion</span>
        <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
      </div>

      <div className="flex items-end justify-between gap-1.5 h-24 pt-2.5">
        {fingers.map((f) => (
          <div key={f.name} className="flex-1 flex flex-col items-center h-full justify-end">
            <span className="text-[8px] font-extrabold text-slate-500 mb-1">{Math.round(f.val)}%</span>
            
            {/* Vertical Track */}
            <div className="w-2.5 bg-slate-200 rounded-full h-full relative overflow-hidden flex flex-col justify-end">
              <div 
                className={`w-full rounded-full transition-all duration-150 ease-out ${getColorClass(f.val)}`}
                style={{ height: `${f.val}%` }}
              />
            </div>
            
            <span className="text-[8px] font-bold text-slate-400 mt-1.5 select-none">{f.name.substring(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Horizontal volume-style progress bar for elbow flexion
const ElbowVolumeBar = ({ sensors, target }) => {
  const currentElbowVal = 180 - (sensors.elbow || 180);
  const pct = Math.min(100, Math.max(0, (currentElbowVal / 180) * 100));

  const getColorClass = (val) => {
    if (val < 45) return 'bg-gradient-to-r from-blue-500 to-indigo-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
    if (val < 110) return 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    return 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  };

  return (
    <div className="flex flex-col text-left space-y-2 bg-slate-50 border border-slate-100 rounded-xl p-3 flex-1 min-w-0 shadow-sm transition hover:shadow duration-200">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Elbow Joint</span>
        <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Aim: {target}°</span>
      </div>

      <div className="space-y-2 py-1">
        <div className="flex justify-between items-end">
          <span className="text-xl font-extrabold text-slate-800 leading-none">{Math.round(currentElbowVal)}°</span>
          <span className="text-[8px] font-bold text-slate-400">Max: 180°</span>
        </div>

        {/* Horizontal Track */}
        <div className="w-full bg-slate-200 rounded-full h-3 relative overflow-hidden">
          {target && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10 opacity-60"
              style={{ left: `${(target / 180) * 100}%` }}
            />
          )}
          <div 
            className={`h-full rounded-full transition-all duration-150 ease-out ${getColorClass(currentElbowVal)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      
      <p className="text-[8px] font-bold text-slate-400 leading-tight">
        Current elbow bend angle. Aim for smooth, steady control.
      </p>
    </div>
  );
};

function LiveExercisePage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we are in trial mode
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get('mode');
  const trialType = searchParams.get('type') || '';
  const isTrial = mode === 'trial';

  // Exercise parameters passed in route state (or loaded from localStorage)
  const exerciseId = location.state?.exerciseId || localStorage.getItem('activeExerciseId') || '';
  const exerciseName = isTrial ? `Trial: ${trialType ? trialType.charAt(0).toUpperCase() + trialType.slice(1) : ''} Test` : (location.state?.exerciseName || localStorage.getItem('activeExerciseName') || 'Exercise Routine');
  const patientId = localStorage.getItem('activePatientId') || '';
  const patientName = localStorage.getItem('activePatientName') || 'Patient';

  // Session state
  const [sessionId, setSessionId] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [exerciseDetails, setExerciseDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Camera & Pause states
  const [cameraAngle, setCameraAngle] = useState('straight');
  const [isPaused, setIsPaused] = useState(false);
  const [frozenSensors, setFrozenSensors] = useState(null);
  const [showCamDropdown, setShowCamDropdown] = useState(false);

  // Time & Rep tracking
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [repsCompleted, setRepsCompleted] = useState(0);
  const [repsFailed, setRepsFailed] = useState(0);
  const [holdCountdown, setHoldCountdown] = useState(0);
  const [accuracy, setAccuracy] = useState(100);

  // Live Telemetry states
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [battery, setBattery] = useState(100);
  const [telemetryStream, setTelemetryStream] = useState([]);
  
  const [sensors, setSensors] = useState({
    wrist_pitch: 0.0,
    wrist_roll: 0.0,
    elbow: 180.0,
    pressure: 0,
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    little: 0
  });

  // State machine variables
  // States: 'rest' | 'moving' | 'target_hold' | 'returning'
  const [repState, setRepState] = useState('rest');
  const [guidance, setGuidance] = useState('Ensure wearable sleeve is connected. Get ready to begin.');
  const [patientDetails, setPatientDetails] = useState(null);
  const [aiFeedback, setAiFeedback] = useState({
    progress: 0,
    suggestion: 'Place your arm in the starting position to begin.',
    warning: null,
    status: 'info'
  });

  // Refs for tracking telemetry metrics to calculate averages
  const telemetryHistoryRef = useRef([]);
  const wsRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const holdTimerIntervalRef = useRef(null);
  const activeExerciseRef = useRef(null);
  const evaluateRepetitionStateRef = useRef();

  // AI Feedback specific refs
  const lastProgressRef = useRef({ pct: 0, time: Date.now() });
  const stallWarningGivenRef = useRef(false);

  // Keep repetition state machine callback updated to prevent stale closures
  useEffect(() => {
    evaluateRepetitionStateRef.current = evaluateRepetitionState;
  });

  const togglePauseSession = () => {
    setIsPaused(prev => {
      const nextPaused = !prev;
      if (nextPaused) {
        // Freeze active sensors posture
        setFrozenSensors({...sensors});
        // Pause duration timer
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        // Pause hold timer if it's running
        if (holdTimerIntervalRef.current) clearInterval(holdTimerIntervalRef.current);
        setGuidance('Session paused. Movement evaluation is frozen.');
      } else {
        // Resume duration timer
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
          setSecondsElapsed(p => p + 1);
        }, 1000);
        
        // Resume hold timer if we were in target_hold
        if (repState === 'target_hold' && holdCountdown > 0) {
          startHoldTimer(holdCountdown);
          setGuidance(`Session resumed. Continue holding position for ${holdCountdown}s.`);
        } else {
          setGuidance('Session resumed. Continue your movement.');
        }
      }
      return nextPaused;
    });
  };

  // Load exercise targets from database
  const isMounted = useRef(true);
  
  useEffect(() => {
    isMounted.current = true;
    
    // In Trial mode, bypass DB exercise check and patient check
    if (!isTrial && (!patientId || !exerciseId)) {
      navigate('/exercises');
      return;
    }

    const loadExercise = async () => {
      try {
        if (isTrial) {
          // Hardcoded configuration for trial modes
          let mockConfig = {};
          if (trialType === 'fingers') {
            mockConfig = { exercise_name: 'Finger Sensor Test', primary_sensor: 'flex_avg', secondary_sensor: 'pressure', camera_view: 'hand', target_angle: 90 };
          } else if (trialType === 'wrist') {
            mockConfig = { exercise_name: 'Wrist Sensor Test', primary_sensor: 'wrist_pitch', secondary_sensor: 'wrist_roll', camera_view: 'wrist', target_angle: 45 };
          } else if (trialType === 'elbow') {
            mockConfig = { exercise_name: 'Elbow Sensor Test', primary_sensor: 'elbow', secondary_sensor: 'wrist_roll', camera_view: 'elbow', target_angle: 90 };
          } else {
            mockConfig = { exercise_name: 'Sensor Test', primary_sensor: 'flex_avg', camera_view: 'straight' };
          }
          
          setExerciseDetails(mockConfig);
          activeExerciseRef.current = mockConfig;
          setCameraAngle(mockConfig.camera_view || 'straight');
          setSessionActive(true);
          setGuidance(`Trial Mode: ${mockConfig.exercise_name} active. Check telemetry stream.`);
        } else {
          // Standard execution flow
          const [exerciseRes, patientRes] = await Promise.all([
            apiClient.get(`/exercises/${exerciseId}`),
            apiClient.get(`/patients/${patientId}`)
          ]);
          if (!isMounted.current) return;
          setExerciseDetails(exerciseRes.data);
          activeExerciseRef.current = exerciseRes.data;
          setPatientDetails(patientRes.data);

          // Auto-switch camera based on exercise database configuration
          if (exerciseRes.data.camera_view) {
            setCameraAngle(exerciseRes.data.camera_view);
          }
          
          // Start session in DB
          const sessionRes = await startSession(patientId, exerciseId);
          if (!isMounted.current) return;
          setSessionId(sessionRes.session_id);
          setSessionActive(true);
        }
      } catch (err) {
        console.error("Failed to initialize exercise session", err);
        navigate('/exercises');
      } finally {
        if (isMounted.current) {
          // Clear any potentially lingering interval before setting a new one
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          
          // Start duration timer
          timerIntervalRef.current = setInterval(() => {
            setSecondsElapsed(prev => prev + 1);
          }, 1000);
          
          // Open WebSocket
          connectWebSocket();
          setLoading(false);
        }
      }
    };

    loadExercise();

    return () => {
      isMounted.current = false;
      cleanupSession();
    };
  }, []);

  const cleanupSession = () => {
    if (wsRef.current) wsRef.current.close();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (holdTimerIntervalRef.current) clearInterval(holdTimerIntervalRef.current);
  };

  // WebSocket Connection
  const connectWebSocket = () => {
    const getWsUrl = () => {
      if (import.meta.env.VITE_WS_URL) {
        return import.meta.env.VITE_WS_URL;
      }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      // If running on Vite dev server (port 5173), redirect WS to FastAPI port 8000
      const wsHost = host.includes(':5173') ? host.replace(':5173', ':8000') : host;
      return `${protocol}//${wsHost}/api/v1/device/ws`;
    };
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setDeviceConnected(true);
      setGuidance('Device connected. Move arm to rest position to initiate repetitions.');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'status_update' && data.status === 'hardware_status_changed') {
        setDeviceConnected(data.hardware_connected);
      }

      if (data.type === 'sensor_data') {
        const isHardware = !data.is_mock;
        setDeviceConnected(isHardware);
        if (data.battery !== undefined) setBattery(data.battery);

        // Normalize raw or scaled sensor readings matching CalibrationPage logic
        const extractFinger = (name) => {
          const rawKey = 'raw_' + name;
          if (data[rawKey] !== undefined) return Math.min(100, Math.max(0, (data[rawKey] / 4095) * 100));
          const val = data[name];
          if (val === undefined || val === null) return 0;
          if (typeof val === 'object') return val.raw !== undefined ? Math.min(100, Math.max(0, (val.raw / 4095) * 100)) : (val.angle || 0);
          if (val > 100) return Math.min(100, Math.max(0, (val / 4095) * 100));
          return val;
        };

        const extractElbow = () => {
          if (data.raw_elbow !== undefined) return Math.min(180, Math.max(0, 180 - (data.raw_elbow / 4095) * 180));
          const val = data.elbow;
          if (val === undefined || val === null) return 180;
          if (typeof val === 'object') return val.angle !== undefined ? val.angle : 180;
          if (val > 180) return Math.min(180, Math.max(0, 180 - (val / 4095) * 180));
          return val;
        };

        const parsedSensors = {
          wrist_pitch: data.wrist_pitch ?? data.pitch ?? 0.0,
          wrist_roll: data.wrist_roll ?? data.roll ?? 0.0,
          elbow: extractElbow(),
          pressure: data.pressure ?? 0,
          thumb: extractFinger('thumb'),
          index: extractFinger('index'),
          middle: extractFinger('middle'),
          ring: extractFinger('ring'),
          little: extractFinger('little')
        };

        setSensors(parsedSensors);

        // Store history for averages & charting
        telemetryHistoryRef.current.push(parsedSensors);
        
        setTelemetryStream(prev => {
          const updated = [...prev, {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            elbow: parsedSensors.elbow,
            pitch: parsedSensors.wrist_pitch,
            pressure: parsedSensors.pressure
          }];
          return updated.slice(-50); // Keep last 50 ticks
        });

        // Process movement state machine
        evaluateRepetitionStateRef.current?.(parsedSensors);
      }
    };

    ws.onclose = () => {
      setDeviceConnected(false);
      setGuidance('Wearable sleeve disconnected. Attempting to reconnect...');
    };
  };

  const getSensorValue = (sensorKey, data) => {
    if (!sensorKey) return 0;
    const key = sensorKey.toLowerCase();
    if (key === 'flex_avg') {
      return (data.thumb + data.index + data.middle + data.ring + data.little) / 5;
    }
    if (key === 'elbow') {
      return 180 - data.elbow;
    }
    if (key === 'wrist_pitch') {
      return data.wrist_pitch;
    }
    if (key === 'wrist_roll') {
      return data.wrist_roll;
    }
    if (key === 'pressure') {
      return data.pressure;
    }
    if (key === 'thumb') return data.thumb;
    if (key === 'index') return data.index;
    if (key === 'middle') return data.middle;
    if (key === 'ring') return data.ring;
    if (key === 'little') return data.little;
    return 0;
  };

  // State Machine Rep Count & Posture Guidance Logic
  const evaluateRepetitionState = (data) => {
    if (isPaused) return;

    if (isTrial) {
      // In trial mode, we just update static test guidance and avoid running the rep state machine
      if (trialType === 'fingers') {
        setGuidance('Open and close your fingers slowly. Observe the 3D hand.');
        setAiFeedback({ progress: 100, suggestion: 'Try bending your index finger or thumb.', warning: null, status: 'info' });
      } else if (trialType === 'wrist') {
        setGuidance('Move your wrist slowly. Rotate left and right, and bend upward/downward.');
        setAiFeedback({ progress: 100, suggestion: 'Rotate your wrist to test the MPU6050 angles.', warning: null, status: 'info' });
      } else {
        setGuidance('Keep your upper arm steady. Bend and straighten your elbow.');
        setAiFeedback({ progress: 100, suggestion: 'Test the elbow flex sensor range.', warning: null, status: 'info' });
      }
      return;
    }


    const ex = activeExerciseRef.current;
    if (!ex) return;

    const nameLower = ex.exercise_name.toLowerCase();
    const primaryLower = (ex.primary_sensor || '').toLowerCase();
    
    const isForceBased = primaryLower === 'pressure' || ex.target_pressure > 0;
    const holdSecs = ex.hold_seconds || 0;
    
    // Extract current value we are tracking
    let currentValue = getSensorValue(ex.primary_sensor, data);
    let targetValue = isForceBased ? (ex.target_pressure || 200) : (ex.target_angle || 0);
    
    // Determine restValue
    let restValue = 0;
    if (primaryLower === 'elbow') {
      restValue = 15;
    } else if (primaryLower === 'flex_avg') {
      restValue = nameLower.includes('opening') ? 75 : 25;
    } else if (primaryLower === 'pressure') {
      restValue = 30;
    } else if (primaryLower === 'wrist_pitch' || primaryLower === 'wrist_roll') {
      restValue = 0;
    } else {
      restValue = 10;
    }
    
    const isAscending = targetValue > restValue;

    // STATE MACHINE TRANSITIONS
    let nextState = repState;
    if (repState === 'rest') {
      const hasInitiated = isAscending 
        ? currentValue > restValue + (targetValue - restValue) * 0.25 
        : currentValue < restValue - (restValue - targetValue) * 0.25;

      if (hasInitiated) {
        setGuidance(isForceBased ? 'Grip force detected. Squeeze harder!' : 'Movement detected. Bend toward target!');
        nextState = 'moving';
      }
    } else if (repState === 'moving') {
      const targetReached = isAscending 
        ? currentValue >= targetValue 
        : currentValue <= targetValue;

      if (targetReached) {
        if (holdSecs > 0) {
          setHoldCountdown(holdSecs);
          startHoldTimer(holdSecs);
          setGuidance(`Target reached! HOLD position for ${holdSecs} seconds.`);
          nextState = 'target_hold';
        } else {
          setGuidance('Target reached! Return to starting rest position.');
          nextState = 'returning';
        }
      } else {
        if (isForceBased) {
          setGuidance(`Apply more force! Current: ${currentValue.toFixed(0)} N / Target: ${targetValue} N`);
        } else {
          setGuidance(`Moving... Current: ${currentValue.toFixed(0)}° / Target: ${targetValue}°`);
        }
      }
    } else if (repState === 'target_hold') {
      const letGo = isAscending 
        ? currentValue < targetValue * 0.8
        : currentValue > targetValue + (restValue - targetValue) * 0.2;

      if (letGo) {
        // User released hold early -> mark failed rep
        clearInterval(holdTimerIntervalRef.current);
        setHoldCountdown(0);
        setRepsFailed(f => {
          const nextFailed = f + 1;
          updateAccuracyScore(repsCompleted, nextFailed);
          return nextFailed;
        });
        setGuidance('Target released too early! Return to starting rest position.');
        nextState = 'returning';
      }
    } else if (repState === 'returning') {
      const returnedToRest = isAscending 
        ? currentValue <= restValue + (targetValue - restValue) * 0.15
        : currentValue >= restValue - (restValue - targetValue) * 0.15;

      if (returnedToRest) {
        setRepsCompleted(c => {
          const updated = c + 1;
          updateAccuracyScore(updated, repsFailed);
          return updated;
        });
        setGuidance('Repetition complete! Relax and prepare for next.');
        nextState = 'rest';
      }
    }

    if (nextState !== repState) {
      setRepState(nextState);
    }

    // AI CLINICAL TARGET TRACKER & DEVIATION CALCULATION
    let progressPct = 0;
    if (isAscending) {
      const range = targetValue - restValue;
      progressPct = range > 0 ? Math.max(0, Math.min(100, Math.round(((currentValue - restValue) / range) * 100))) : 0;
    } else {
      const range = restValue - targetValue;
      progressPct = range > 0 ? Math.max(0, Math.min(100, Math.round(((restValue - currentValue) / range) * 100))) : 0;
    }

    // Velocity & Anti-Stall Tracking
    const now = Date.now();
    const last = lastProgressRef.current;
    let isStalling = false;

    if (nextState === 'moving') {
      if (Math.abs(progressPct - last.pct) < 2) {
        if (now - last.time > 2000) {
          isStalling = true; // Stalled for 2 seconds
        }
      } else {
        // Made progress, reset timer
        lastProgressRef.current = { pct: progressPct, time: now };
        stallWarningGivenRef.current = false;
      }
    } else {
      // Not moving, reset timer
      lastProgressRef.current = { pct: progressPct, time: now };
      stallWarningGivenRef.current = false;
    }

    const injuredArm = patientDetails?.injured_arm || 'Right';
    let warningText = null;
    let suggestionText = '';
    let statusVal = 'info';

    // 1. Posture checks & stabilizers
    const secondaryLower = (ex.secondary_sensor || '').toLowerCase();
    if (secondaryLower === 'wrist_pitch') {
      const pitchVal = data.wrist_pitch;
      if (pitchVal > 15) {
        warningText = `Lower your wrist! Tilted down by ${Math.round(pitchVal - 15)}°`;
      } else if (pitchVal < -15) {
        warningText = `Raise your wrist! Tilted up by ${Math.round(-15 - pitchVal)}°`;
      }
    } else if (secondaryLower === 'wrist_roll') {
      const rollVal = data.wrist_roll;
      const threshold = nameLower.includes('rotation') ? 10 : 15;
      if (Math.abs(rollVal) > threshold) {
        warningText = `Keep wrist stable! Twisting by ${Math.round(Math.abs(rollVal))}°`;
      }
    } else if (secondaryLower === 'elbow') {
      const elbowFlex = 180 - data.elbow;
      if (nameLower.includes('rotation')) {
        if (elbowFlex < 75) {
          warningText = `Keep your elbow still! Bend more to 90°! Currently: ${Math.round(elbowFlex)}°`;
        } else if (elbowFlex > 105) {
          warningText = `Keep your elbow still! Straighten slightly to 90°! Currently: ${Math.round(elbowFlex)}°`;
        }
      } else {
        if (elbowFlex > 20) {
          warningText = `Straighten your elbow! Flexed by ${Math.round(elbowFlex)}°`;
        }
      }
    } else if (secondaryLower === 'flex_avg') {
      const flexAvg = (data.thumb + data.index + data.middle + data.ring + data.little) / 5;
      if (nameLower.includes('squeeze') || nameLower.includes('ball')) {
        const pitchVal = data.wrist_pitch;
        if (pitchVal > 15) {
          warningText = `Lower your wrist! Tilted down by ${Math.round(pitchVal - 15)}°`;
        } else if (pitchVal < -15) {
          warningText = `Raise your wrist! Tilted up by ${Math.round(-15 - pitchVal)}°`;
        } else if (flexAvg < 40 && currentValue > restValue + 15) {
          warningText = `Finger Form: Bend fingers more while squeezing!`;
        }
      } else {
        if (flexAvg < 40 && currentValue > restValue + 15) {
          warningText = `Finger Form: Bend fingers more!`;
        }
      }
    }

    // Override warning if stalling
    if (isStalling && !warningText) {
      warningText = `You've stopped moving! Keep pushing toward the target!`;
      stallWarningGivenRef.current = true;
    }

    // 2. Compute dynamic action guidance text based on nextState
    if (nextState === 'rest') {
      suggestionText = isAscending 
        ? `Ready to begin. Move your injured ${injuredArm} Arm to initiate the repetition.`
        : `Ready to begin. Release your injured ${injuredArm} Arm to initiate.`;
      statusVal = 'info';
    } else if (nextState === 'moving') {
      statusVal = warningText ? 'warning' : 'info';
      if (isForceBased) {
        const remaining = Math.max(0, Math.round(targetValue - currentValue));
        suggestionText = `Squeezing... reached ${progressPct}% of target force. Apply ${remaining} N more force.`;
      } else {
        const remaining = Math.max(0, Math.round(Math.abs(targetValue - currentValue)));
        
        if (nameLower.includes('rotation')) {
          suggestionText = `Rotate your wrist further outwards. You are at ${Math.round(currentValue)}°, target is ${Math.round(targetValue)}°.`;
        } else if (nameLower.includes('elbow')) {
          suggestionText = `Bend your elbow more towards your shoulder. Move ${remaining}° more.`;
        } else {
          suggestionText = `Moving... reached ${progressPct}% of target angle. Move ${remaining}° more.`;
        }
      }
    } else if (nextState === 'target_hold') {
      const isSlipping = isAscending 
        ? (currentValue < targetValue - (targetValue - restValue) * 0.1) 
        : (currentValue > targetValue + (restValue - targetValue) * 0.1);
        
      if (isSlipping && !warningText) {
        warningText = `Hold steady! Don't let your arm drop yet.`;
        statusVal = 'warning';
      } else {
        statusVal = 'success';
      }
      suggestionText = `Target reached! Keep holding for ${holdCountdown > 0 ? holdCountdown : holdSecs}s.`;
    } else if (nextState === 'returning') {
      suggestionText = `Rep completed successfully! Slowly return your arm to the rest position.`;
      statusVal = 'info';
    }

    setAiFeedback({
      progress: progressPct,
      suggestion: suggestionText,
      warning: warningText,
      status: statusVal
    });
  };

  const startHoldTimer = (secs) => {
    if (holdTimerIntervalRef.current) clearInterval(holdTimerIntervalRef.current);
    
    let current = secs;
    holdTimerIntervalRef.current = setInterval(() => {
      current -= 1;
      setHoldCountdown(current);
      if (current <= 0) {
        clearInterval(holdTimerIntervalRef.current);
        setGuidance('Hold complete! Return to rest position.');
        setRepState('returning');
      }
    }, 1000);
  };

  const updateAccuracyScore = (completed, failed) => {
    const total = completed + failed;
    if (total === 0) setAccuracy(100);
    else setAccuracy(Math.round((completed / total) * 100));
  };

  // Save session overlays
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const handleStopSession = async () => {
    cleanupSession();
    setSessionActive(false);

    // Calculate statistical averages
    const hist = telemetryHistoryRef.current;
    let avgAngle = 0;
    let maxAngle = 0;
    let avgPressure = 0;

    if (hist.length > 0) {
      // Find angle column matching exercise
      const ex = exerciseDetails;
      const isElbow = ex?.exercise_name?.toLowerCase()?.includes('elbow');
      
      const angles = hist.map(h => isElbow ? (180 - h.elbow) : h.wrist_pitch);
      const pressures = hist.map(h => h.pressure);
      
      avgAngle = angles.reduce((a, b) => a + b, 0) / hist.length;
      maxAngle = Math.max(...angles);
      avgPressure = pressures.reduce((a, b) => a + b, 0) / hist.length;
    }

    const payload = {
      session_id: sessionId,
      duration_seconds: secondsElapsed,
      repetitions_completed: repsCompleted,
      repetitions_failed: repsFailed,
      average_angle: Number(avgAngle.toFixed(1)),
      max_angle: Number(maxAngle.toFixed(1)),
      average_pressure: Number(avgPressure.toFixed(1)),
      exercise_accuracy: accuracy
    };

    if (isTrial) {
      // Bypass analytics and navigate directly back
      navigate('/exercises');
      return;
    }

    try {
      await endSession(payload);
      setSummaryData(payload);
      setShowSummary(true);
    } catch (err) {
      console.error("Failed to save session statistics to DB", err);
      // Fallback show summary anyway
      setSummaryData(payload);
      setShowSummary(true);
    }
  };

  // Helper format seconds
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const defaultSensors = {
    wrist_pitch: 0.0,
    wrist_roll: 0.0,
    elbow: 180.0,
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    little: 0
  };

  const activeSensors = isPaused && frozenSensors 
    ? frozenSensors 
    : (deviceConnected ? sensors : defaultSensors);

  const activeControls = {
    shoulderAngle: activeSensors.wrist_pitch,
    shoulderAngleX: 0,
    elbowAngle: 180 - activeSensors.elbow,
    wristAngle: activeSensors.wrist_roll,
    thumb: activeSensors.thumb,
    index: activeSensors.index,
    middle: activeSensors.middle,
    ring: activeSensors.ring,
    little: activeSensors.little
  };

  // Build the dynamic gauge configurations for the selected exercise
  const getExerciseFeedback = () => {
    const ex = exerciseDetails;
    if (!ex) return {
      primary: { value: 0, min: 0, max: 100, title: 'Flexion', aimText: 'Aim: --', currentText: 'Current: --', feedbackText: 'Loading exercise details...' },
      secondary: { value: 0, min: -45, max: 45, title: 'Form', aimText: 'Aim: --', currentText: 'Current: --', feedbackText: 'Loading form indicators...' }
    };

    const nameLower = ex.exercise_name.toLowerCase();
    
    // Default fallback
    const primaryLower = (ex.primary_sensor || '').toLowerCase();
    const secondaryLower = (ex.secondary_sensor || '').toLowerCase();
    
    let primary = { value: 0, min: 0, max: 100, title: 'Flexion', aimText: 'Aim: 0°', currentText: 'Current: 0°', feedbackText: 'Perform movement.' };
    let secondary = { value: 0, min: -45, max: 45, title: 'Wrist Rotation', aimText: 'Aim: 0° (Neutral)', currentText: 'Current: 0°', feedbackText: 'Keep wrist stable.' };

    // --- Resolve Primary Gauge ---
    if (primaryLower === 'pressure') {
      const target = ex.target_pressure || 400;
      const currentVal = sensors.pressure;
      let feedback = 'Squeeze soft therapy ball.';
      if (currentVal >= target) {
        feedback = 'Target force reached! Hold it.';
      } else if (currentVal > 50) {
        feedback = 'Squeeze harder to reach target!';
      }
      primary = {
        value: currentVal,
        min: 0,
        max: 500,
        title: 'Grip Force',
        aimText: `Aim: ${target} N`,
        currentText: `Current: ${currentVal.toFixed(0)} N`,
        feedbackText: feedback
      };
    } else if (primaryLower === 'wrist_pitch') {
      const target = ex.target_angle || 60;
      const isExtension = nameLower.includes('extension');
      const currentVal = isExtension ? -sensors.wrist_pitch : sensors.wrist_pitch;
      let feedback = isExtension ? 'Bend wrist upward.' : 'Bend wrist downward.';
      if (currentVal >= target) {
        feedback = 'Target angle reached! Hold it.';
      } else if (currentVal > 10) {
        feedback = isExtension ? 'Continue extending wrist upward.' : 'Continue flexing wrist downward.';
      }
      primary = {
        value: Math.max(0, currentVal),
        min: 0,
        max: 90,
        title: isExtension ? 'Wrist Extension' : 'Wrist Pitch',
        aimText: `Aim: ${target}° ${isExtension ? 'Ext' : 'Flex'}`,
        currentText: `Current: ${Math.max(0, currentVal).toFixed(0)}°`,
        feedbackText: feedback
      };
    } else if (primaryLower === 'wrist_roll') {
      const target = ex.target_angle || 90;
      const currentVal = Math.abs(sensors.wrist_roll);
      let feedback = 'Rotate your wrist.';
      if (currentVal >= target) {
        feedback = 'Target rotation reached! Hold it.';
      } else if (currentVal > 15) {
        feedback = 'Continue rotating wrist.';
      }
      primary = {
        value: currentVal,
        min: 0,
        max: 120,
        title: 'Wrist Rotation',
        aimText: `Aim: ${target}° CCW`,
        currentText: `Current: ${sensors.wrist_roll.toFixed(0)}° ${sensors.wrist_roll >= 0 ? 'CCW' : 'CW'}`,
        feedbackText: feedback
      };
    } else if (primaryLower === 'flex_avg') {
      const target = ex.target_angle || 95;
      const isOpening = nameLower.includes('opening');
      const currentVal = (sensors.thumb + sensors.index + sensors.middle + sensors.ring + sensors.little) / 5;
      
      let feedback = isOpening ? 'Extend fingers outward.' : 'Close fingers into fist.';
      if (isOpening) {
        if (currentVal <= target) {
          feedback = 'Hand fully open! Hold it.';
        } else if (currentVal < 70) {
          feedback = 'Open hand wider.';
        }
      } else {
        if (currentVal >= target) {
          feedback = 'Fist fully closed! Hold it.';
        } else if (currentVal > 30) {
          feedback = 'Squeeze fist tighter.';
        }
      }
      
      primary = {
        value: isOpening ? 100 - currentVal : currentVal,
        min: 0,
        max: 100,
        title: isOpening ? 'Fist Opening' : 'Fist Flexion',
        aimText: isOpening ? `Aim: < ${target}% Flex` : `Aim: ${target}% Fist`,
        currentText: `Current: ${currentVal.toFixed(0)}%`,
        feedbackText: feedback
      };
    } else if (primaryLower === 'elbow') {
      const target = ex.target_angle || 130;
      const currentVal = 180 - sensors.elbow;
      let feedback = 'Bend elbow upward.';
      if (currentVal >= target) {
        feedback = 'Target angle reached! Hold it.';
      } else if (currentVal > 20) {
        feedback = 'Continue curling elbow.';
      }
      primary = {
        value: currentVal,
        min: 0,
        max: 180,
        title: 'Elbow Flex',
        aimText: `Aim: ${target}° Flex`,
        currentText: `Current: ${currentVal.toFixed(0)}°`,
        feedbackText: feedback
      };
    }

    // --- Resolve Secondary Gauge (Form Indicator) ---
    if (secondaryLower === 'wrist_pitch') {
      const pitchVal = sensors.wrist_pitch;
      let secFeedback = 'Wrist is straight.';
      if (pitchVal > 15) secFeedback = 'Lower your wrist.';
      else if (pitchVal < -15) secFeedback = 'Raise your wrist.';

      secondary = {
        value: pitchVal,
        min: -45,
        max: 45,
        title: 'Wrist Pitch',
        aimText: 'Aim: 0° (Neutral)',
        currentText: `Current: ${pitchVal.toFixed(0)}°`,
        feedbackText: secFeedback
      };
    } else if (secondaryLower === 'wrist_roll') {
      const rollVal = sensors.wrist_roll;
      let secFeedback = 'Wrist is stable.';
      if (rollVal > 10) secFeedback = 'Align wrist (tilt left).';
      else if (rollVal < -10) secFeedback = 'Align wrist (tilt right).';

      secondary = {
        value: rollVal,
        min: -45,
        max: 45,
        title: 'Wrist Stability',
        aimText: 'Aim: 0° (Aligned)',
        currentText: `Current: ${rollVal.toFixed(0)}°`,
        feedbackText: secFeedback
      };
    } else if (secondaryLower === 'elbow') {
      const elbowFlex = 180 - sensors.elbow;
      let secFeedback = 'Elbow is straight.';
      if (elbowFlex > 15) secFeedback = 'Straighten your elbow.';

      secondary = {
        value: elbowFlex,
        min: 0,
        max: 180,
        title: 'Elbow Straightness',
        aimText: 'Aim: 0° (Straight)',
        currentText: `Current: ${elbowFlex.toFixed(0)}°`,
        feedbackText: secFeedback
      };
    } else if (secondaryLower === 'flex_avg') {
      const currentVal = (sensors.thumb + sensors.index + sensors.middle + sensors.ring + sensors.little) / 5;
      secondary = {
        value: currentVal,
        min: 0,
        max: 100,
        title: 'Finger Flexion',
        aimText: 'Aim: stable',
        currentText: `Current: ${currentVal.toFixed(0)}%`,
        feedbackText: 'Keep fingers stable.'
      };
    } else if (secondaryLower === 'pressure') {
      secondary = {
        value: sensors.pressure,
        min: 0,
        max: 500,
        title: 'Grip Force',
        aimText: 'Aim: 0 N (No Squeeze)',
        currentText: `Current: ${sensors.pressure.toFixed(0)} N`,
        feedbackText: 'Do not squeeze.'
      };
    }

    return { primary, secondary };
  };

  const { primary, secondary } = getExerciseFeedback();

  return (
    <div className="space-y-6 relative h-[calc(100vh-6.5rem)] overflow-hidden flex flex-col justify-between">
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <RefreshCw className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Initializing physical therapy stream session...</p>
        </div>
      ) : (
        <>
          {/* Main Workspace split */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
            
            {/* Left Panel: 3D Visualization */}
            <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-white relative shadow-inner overflow-hidden min-h-[300px]">
              
              {/* Header inside canvas overlay */}
              <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 items-center">
                {/* Live Stream Status Pill */}
                <div className="flex items-center gap-2.5 bg-slate-950/80 backdrop-blur border border-slate-850 rounded-xl p-2 px-3">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Live Stream</span>
                    <span className="text-xs font-semibold text-slate-200">{exerciseName}</span>
                  </div>
                </div>

                {/* Camera Angle Selector Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowCamDropdown(prev => !prev)}
                    className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold rounded-xl p-2.5 px-3 transition-all cursor-pointer shadow-sm"
                  >
                    <span>Camera View:</span>
                    <span className="text-blue-450 capitalize">
                      {cameraAngle === 'split' ? 'Split View' : `${cameraAngle} View`}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {showCamDropdown && (
                    <div className="absolute top-full left-0 mt-1.5 w-40 bg-slate-950/95 backdrop-blur border border-slate-800 rounded-xl overflow-hidden z-30 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100">
                      {[
                        { key: 'straight', label: 'Straight View' },
                        { key: 'side', label: 'Side View' },
                        { key: 'hand', label: '✋ Hand View' },
                        { key: 'hand_side', label: '✋ Hand Side' },
                        { key: 'elbow', label: '💪 Elbow View' },
                        { key: 'wrist', label: '⌚ Wrist View' },
                        { key: 'split', label: 'Split View' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            setCameraAngle(item.key);
                            setShowCamDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition hover:bg-slate-900 cursor-pointer ${
                            cameraAngle === item.key ? 'text-blue-405 bg-slate-900/50' : 'text-slate-350'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {deviceConnected ? (
                <div className="absolute top-4 right-4 z-10 bg-slate-950/80 backdrop-blur border border-slate-855 rounded-xl p-2 px-3 flex items-center gap-2 text-xs font-semibold text-green-400">
                  <Activity className="w-4 h-4 text-green-400 animate-pulse" />
                  Battery: {battery}%
                </div>
              ) : (
                <div className="absolute top-4 right-4 z-10 bg-slate-950/80 backdrop-blur border border-red-950 rounded-xl p-2 px-3 flex items-center gap-2 text-xs font-semibold text-red-500 animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Sleeve Offline
                </div>
              )}

              {/* R3F Canvas container with premium model */}
              <div className="w-full h-full">
                {cameraAngle === 'split' ? (
                  <div className="w-full h-full grid grid-cols-2 gap-3 p-3">
                    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-850 shadow-inner">
                      <div className="absolute top-2 left-2 z-10 bg-slate-900/80 backdrop-blur text-[9px] font-extrabold px-2.5 py-1 rounded-lg border border-slate-800 uppercase tracking-widest text-slate-400">
                        Straight View
                      </div>
                      <VisualizerComponent 
                        controls={activeControls} 
                        cameraAngle="straight" 
                        disableOrbit={true} 
                        injuredArm={patientDetails?.injured_arm || 'Right'}
                      />
                    </div>
                    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-850 shadow-inner">
                      <div className="absolute top-2 left-2 z-10 bg-slate-900/80 backdrop-blur text-[9px] font-extrabold px-2.5 py-1 rounded-lg border border-slate-800 uppercase tracking-widest text-slate-400">
                        Side View
                      </div>
                      <VisualizerComponent 
                        controls={activeControls} 
                        cameraAngle="side" 
                        disableOrbit={true} 
                        injuredArm={patientDetails?.injured_arm || 'Right'}
                      />
                    </div>
                  </div>
                ) : (
                  <VisualizerComponent 
                    controls={activeControls} 
                    cameraAngle={cameraAngle} 
                    disableOrbit={true} 
                    injuredArm={patientDetails?.injured_arm || 'Right'}
                  />
                )}
              </div>

              {/* Pause Overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center space-y-2 animate-in fade-in duration-200">
                  <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-500 animate-pulse">
                    <Pause className="w-8 h-8 fill-current" />
                  </div>
                  <span className="text-sm font-bold tracking-wider text-slate-200 uppercase">Session Paused</span>
                  <span className="text-xs text-slate-400 font-medium">Repetition and timer evaluations are frozen</span>
                </div>
              )}

              {/* 3D Guide helper */}
              <div className="absolute bottom-4 left-4 text-[10px] text-slate-400 bg-slate-950/60 p-2 px-3 border border-slate-850 rounded-lg font-medium">
                Use the camera angle buttons to toggle viewpoints.
              </div>
            </div>

            {/* Right Panel: Guidance, Recommendations, & Counters */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-y-auto">
              
              {/* Header Details */}
              <div className="space-y-1">
                <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">Rehab Assessment Session</span>
                <h3 className="text-xl font-bold text-slate-800">{exerciseName}</h3>
                <p className="text-xs text-slate-500 font-semibold">Patient: {patientName}</p>
              </div>

              {/* AI Real-time Clinical Feedback Companion Card */}
              <div className={`p-4 rounded-xl border transition-all duration-200 mt-2 ${
                aiFeedback.status === 'success' 
                  ? 'bg-emerald-50 border-emerald-250 text-emerald-900' 
                  : aiFeedback.status === 'warning'
                    ? 'bg-amber-50 border-amber-250 text-amber-900'
                    : 'bg-blue-50 border-blue-150 text-blue-900'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        aiFeedback.status === 'success' 
                          ? 'bg-emerald-400' 
                          : aiFeedback.status === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-blue-400'
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${
                        aiFeedback.status === 'success' 
                          ? 'bg-emerald-500' 
                          : aiFeedback.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                      }`}></span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 animate-pulse" />
                      AI Therapy Companion
                    </span>
                  </div>
                  {patientDetails && (
                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      Injured Arm: {patientDetails.injured_arm}
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span>Repetition Progress</span>
                    <span>{aiFeedback.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        aiFeedback.status === 'success' 
                          ? 'bg-emerald-500' 
                          : aiFeedback.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${aiFeedback.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Guidance Text */}
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold leading-relaxed">
                    {aiFeedback.suggestion}
                  </p>
                  
                  {/* Active Posture Warnings */}
                  {aiFeedback.warning && (
                    <div className="flex items-start gap-1.5 p-2 bg-red-100/70 border border-red-200 text-red-700 rounded-lg text-[11px] font-bold animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{aiFeedback.warning}</span>
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-slate-100 my-3" />

              {/* Counters Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Repetitions</span>
                  <p className="text-3xl font-extrabold text-slate-800">
                    {repsCompleted} <span className="text-sm text-slate-400 font-medium">/ {exerciseDetails?.repetitions || 10}</span>
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Accuracy Score</span>
                  <p className={`text-3xl font-extrabold ${accuracy >= 80 ? 'text-green-600' : 'text-amber-500'}`}>
                    {accuracy}%
                  </p>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Hold Timer</span>
                  <p className={`text-3xl font-extrabold ${holdCountdown > 0 ? 'text-primary animate-pulse' : 'text-slate-400'}`}>
                    {holdCountdown > 0 ? `${holdCountdown}s` : '0s'}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Time Elapsed</span>
                  <p className="text-3xl font-extrabold text-slate-800 flex items-center justify-center gap-1.5">
                    <Clock className="w-5 h-5 text-slate-400" />
                    {formatTime(secondsElapsed)}
                  </p>
                </div>
              </div>

              {/* Real-time Exercise Recommendations Section */}
              <div className="border border-slate-100 rounded-2xl p-4 space-y-3 mt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Live Exercise Guidance</span>
                    <h4 className="text-xs font-bold text-slate-700 mt-0.5">Adjust your movement to optimize form:</h4>
                  </div>
                  <WristIcon />
                </div>
                
                <div className="flex gap-3">
                  {(exerciseDetails?.primary_sensor?.toLowerCase() === 'flex_avg' || 
                    exerciseDetails?.target_joint?.toLowerCase()?.includes('finger') ||
                    exerciseName.toLowerCase().includes('finger') || 
                    exerciseName.toLowerCase().includes('hand')) ? (
                    <FingerVolumeBars sensors={sensors} />
                  ) : (exerciseDetails?.primary_sensor?.toLowerCase() === 'elbow' || 
                       exerciseDetails?.target_joint?.toLowerCase()?.includes('elbow') ||
                       exerciseName.toLowerCase().includes('elbow') ||
                       exerciseName.toLowerCase().includes('curl')) ? (
                    <ElbowVolumeBar sensors={sensors} target={exerciseDetails?.target_angle || 90} />
                  ) : (
                    <SVGGauge {...primary} />
                  )}
                  <SVGGauge {...secondary} />
                </div>
              </div>



              {/* Medical Disclaimer Note */}
              <div className="mt-3 p-3 bg-amber-50/40 border border-amber-200/50 rounded-xl text-[9px] text-slate-500 leading-tight">
                <span className="font-bold text-slate-700 block mb-0.5">Clinical Disclaimer</span>
                SmartPhysio is an assistive wearable biofeedback tracking tool. It does not provide medical diagnoses or replace professional therapeutic intervention.
              </div>

              {/* Actions Footer */}
              <div className="flex gap-3 mt-4">
                <button 
                  onClick={togglePauseSession}
                  className={`flex-1 py-3.5 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                    isPaused 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-250' 
                      : 'bg-amber-500 hover:bg-amber-600 shadow-amber-250'
                  }`}
                >
                  {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button 
                  onClick={handleStopSession}
                  className="flex-1 py-3.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-red-250"
                >
                  <Square className="w-4 h-4 fill-current" />
                  End & Save
                </button>
              </div>
            </div>

          </div>
        </>
      )}

      {/* Session Success Summary Overlay */}
      {showSummary && summaryData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Overlay Header */}
            <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex justify-between items-center">
              <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Assessment Saved Successfully!
              </h4>
            </div>

            {/* Overlay Content */}
            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-extrabold text-slate-800">{exerciseName} Complete</h3>
                <p className="text-sm text-slate-500">Summary analysis stored in patient record database.</p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                  <span className="text-lg font-extrabold text-slate-700 mt-1">{formatTime(summaryData.duration_seconds)}</span>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Accuracy Score</span>
                  <span className="text-lg font-extrabold text-green-600 mt-1">{summaryData.exercise_accuracy}%</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Reps</span>
                  <span className="text-lg font-extrabold text-slate-700 mt-1">{summaryData.repetitions_completed} reps</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Failed Reps</span>
                  <span className="text-lg font-extrabold text-red-500 mt-1">{summaryData.repetitions_failed} reps</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Angle</span>
                  <span className="text-lg font-extrabold text-slate-700 mt-1">{summaryData.average_angle}°</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Grip Force</span>
                  <span className="text-lg font-extrabold text-slate-700 mt-1">{summaryData.average_pressure} N</span>
                </div>
              </div>
            </div>

            {/* Overlay Footer */}
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex items-center justify-end">
              <button 
                type="button" 
                onClick={() => navigate('/exercises')}
                className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition cursor-pointer shadow-sm shadow-blue-200"
              >
                Return to Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveExercisePage;
