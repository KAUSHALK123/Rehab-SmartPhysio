import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
  Square, 
  Clock, 
  Award, 
  TrendingUp, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  Cpu,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';
import { startSession, endSession } from '../services/session';
import apiClient from '../services/auth';

// --- 3D KINEMATIC ARM MODEL ---
function ArmModel({ shoulderPitch, elbowAngle, wristRoll, fingers }) {
  const upperArmRef = useRef();
  const forearmRef = useRef();
  const handRef = useRef();

  useFrame(() => {
    // 1. Upper arm rotation (shoulder pitch)
    // Map pitch degrees to radians. Pitch is typically 0 (rest) to 90 (raised).
    if (upperArmRef.current) {
      upperArmRef.current.rotation.z = (shoulderPitch * Math.PI) / 180;
    }

    // 2. Forearm rotation (elbow flex relative to upper arm)
    // straight arm (180 deg) -> local angle 0. Bent elbow (90 deg) -> local angle -90 deg.
    if (forearmRef.current) {
      const elbowRad = ((180 - elbowAngle) * Math.PI) / 180;
      forearmRef.current.rotation.z = -elbowRad;
    }

    // 3. Hand rotation (wrist roll)
    if (handRef.current) {
      handRef.current.rotation.y = (wristRoll * Math.PI) / 180;
    }
  });

  // Convert finger flex (0 to 100) to rotation radians for joint bending
  const getFingerBend = (flexVal) => {
    const val = flexVal || 0;
    // Map 0 -> 0 rad, 100 -> -Math.PI / 2 rad (closed)
    return -(val / 100) * (Math.PI / 2);
  };

  return (
    <group position={[0, -1, 0]}>
      {/* Shoulder Joint Pivot */}
      <mesh>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color="#4f46e5" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Upper Arm Group (rotates at shoulder) */}
      <group ref={upperArmRef}>
        {/* Upper Arm Segment */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.13, 0.11, 1.8, 16]} />
          <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.2} />
        </mesh>

        {/* Elbow Joint (at y = 1.8) */}
        <group position={[0, 1.8, 0]}>
          <mesh>
            <sphereGeometry args={[0.2, 32, 32]} />
            <meshStandardMaterial color="#4f46e5" roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Forearm Group (rotates at elbow) */}
          <group ref={forearmRef}>
            {/* Forearm Segment */}
            <mesh position={[0, 0.8, 0]}>
              <cylinderGeometry args={[0.1, 0.08, 1.6, 16]} />
              <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.2} />
            </mesh>

            {/* Wrist Joint (at y = 1.6) */}
            <group position={[0, 1.6, 0]}>
              <mesh>
                <sphereGeometry args={[0.14, 32, 32]} />
                <meshStandardMaterial color="#4f46e5" roughness={0.3} metalness={0.8} />
              </mesh>

              {/* Hand Group (rotates at wrist) */}
              <group ref={handRef}>
                {/* Palm block */}
                <mesh position={[0, 0.22, 0]}>
                  <boxGeometry args={[0.26, 0.3, 0.08]} />
                  <meshStandardMaterial color="#3b82f6" roughness={0.5} />
                </mesh>

                {/* Interactive Fingers */}
                <group position={[0, 0.35, 0]}>
                  {/* Thumb (flexes outward/inward) */}
                  <group position={[-0.14, -0.1, 0]} rotation={[0, 0, getFingerBend(fingers?.thumb) * 0.7]}>
                    <mesh position={[-0.05, 0.08, 0]}>
                      <boxGeometry args={[0.05, 0.16, 0.05]} />
                      <meshStandardMaterial color="#1e40af" />
                    </mesh>
                  </group>

                  {/* Index Finger */}
                  <group position={[-0.08, 0, 0]} rotation={[getFingerBend(fingers?.index), 0, 0]}>
                    <mesh position={[0, 0.1, 0]}>
                      <boxGeometry args={[0.05, 0.22, 0.05]} />
                      <meshStandardMaterial color="#1d4ed8" />
                    </mesh>
                  </group>

                  {/* Middle Finger */}
                  <group position={[0.0, 0, 0]} rotation={[getFingerBend(fingers?.middle), 0, 0]}>
                    <mesh position={[0, 0.11, 0]}>
                      <boxGeometry args={[0.05, 0.24, 0.05]} />
                      <meshStandardMaterial color="#1d4ed8" />
                    </mesh>
                  </group>

                  {/* Ring Finger */}
                  <group position={[0.08, 0, 0]} rotation={[getFingerBend(fingers?.ring), 0, 0]}>
                    <mesh position={[0, 0.1, 0]}>
                      <boxGeometry args={[0.05, 0.22, 0.05]} />
                      <meshStandardMaterial color="#1d4ed8" />
                    </mesh>
                  </group>

                  {/* Little Finger */}
                  <group position={[0.14, 0, 0]} rotation={[getFingerBend(fingers?.little), 0, 0]}>
                    <mesh position={[0, 0.08, 0]}>
                      <boxGeometry args={[0.05, 0.16, 0.05]} />
                      <meshStandardMaterial color="#1d4ed8" />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function LiveExercisePage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Exercise parameters passed in route state (or loaded from localStorage)
  const exerciseId = location.state?.exerciseId || localStorage.getItem('activeExerciseId') || '';
  const exerciseName = location.state?.exerciseName || localStorage.getItem('activeExerciseName') || 'Exercise Routine';
  const patientId = localStorage.getItem('activePatientId') || '';
  const patientName = localStorage.getItem('activePatientName') || 'Patient';

  // Session state
  const [sessionId, setSessionId] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [exerciseDetails, setExerciseDetails] = useState(null);
  const [loading, setLoading] = useState(true);

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
    thumb: 80,
    index: 80,
    middle: 80,
    ring: 80,
    little: 80
  });

  // State machine variables
  // States: 'rest' | 'moving' | 'target_hold' | 'returning'
  const [repState, setRepState] = useState('rest');
  const [guidance, setGuidance] = useState('Ensure wearable sleeve is connected. Get ready to begin.');

  // Refs for tracking telemetry metrics to calculate averages
  const telemetryHistoryRef = useRef([]);
  const wsRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const holdTimerIntervalRef = useRef(null);
  const activeExerciseRef = useRef(null);

  // Load exercise targets from database
  useEffect(() => {
    if (!patientId || !exerciseId) {
      navigate('/exercises');
      return;
    }

    const loadExercise = async () => {
      try {
        const response = await apiClient.get(`/exercises/${exerciseId}`);
        setExerciseDetails(response.data);
        activeExerciseRef.current = response.data;
        
        // Start session in DB
        const sessionRes = await startSession(patientId, exerciseId);
        setSessionId(sessionRes.session_id);
        setSessionActive(true);
        
        // Start duration timer
        timerIntervalRef.current = setInterval(() => {
          setSecondsElapsed(prev => prev + 1);
        }, 1000);
        
        // Open WebSocket
        connectWebSocket();
      } catch (err) {
        console.error("Failed to initialize exercise session", err);
        navigate('/exercises');
      } finally {
        setLoading(false);
      }
    };

    loadExercise();

    return () => {
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = window.location.host;
    if (host.includes('localhost:5173') || host.includes('127.0.0.1:5173')) {
      host = host.replace('5173', '8000');
    }
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}/api/v1/device/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setDeviceConnected(true);
      setGuidance('Device connected. Move arm to rest position to initiate repetitions.');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sensor_data') {
        if (data.is_mock) {
          setDeviceConnected(false);
          setGuidance('Device Disconnected: Power off or link lost. Waiting for physical ESP32...');
          return;
        }
        
        setDeviceConnected(true);
        setBattery(data.battery);
        setSensors({
          wrist_pitch: data.wrist_pitch,
          wrist_roll: data.wrist_roll,
          elbow: data.elbow,
          pressure: data.pressure,
          thumb: data.thumb,
          index: data.index,
          middle: data.middle,
          ring: data.ring,
          little: data.little
        });

        // Store history for averages & charting
        telemetryHistoryRef.current.push(data);
        
        setTelemetryStream(prev => {
          const updated = [...prev, {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            elbow: data.elbow,
            pitch: data.wrist_pitch,
            pressure: data.pressure
          }];
          return updated.slice(-50); // Keep last 50 ticks
        });

        // Process movement state machine
        evaluateRepetitionState(data);
      }
    };

    ws.onclose = () => {
      setDeviceConnected(false);
      setGuidance('Wearable sleeve disconnected. Attempting to reconnect...');
    };
  };

  // State Machine Rep Count & Posture Guidance Logic
  const evaluateRepetitionState = (data) => {
    const ex = activeExerciseRef.current;
    if (!ex) return;

    const isForceBased = ex.target_pressure > 0;
    const holdSecs = ex.hold_seconds || 0;
    
    // Extract current value we are tracking
    let currentValue = 0;
    let targetValue = 0;
    let restValue = 0;
    let isAscending = true; // True if target > rest

    if (isForceBased) {
      currentValue = data.pressure;
      targetValue = ex.target_pressure;
      restValue = 30; // Grip pressure near zero
      isAscending = true;
    } else {
      // Angle-based exercises
      const nameLower = ex.exercise_name.toLowerCase();
      if (nameLower.includes('elbow')) {
        currentValue = data.elbow;
        targetValue = ex.target_angle; // e.g. 130
        restValue = 165; // Straight arm
        isAscending = false; // Elbow angle decreases as we flex
      } else if (nameLower.includes('shoulder')) {
        currentValue = data.wrist_pitch;
        targetValue = ex.target_angle; // e.g. 90
        restValue = 15; // Arm down
        isAscending = true;
      } else if (nameLower.includes('finger closing')) {
        // Flex sensors: higher flex value means bent fingers.
        currentValue = (data.thumb + data.index + data.middle + data.ring + data.little) / 5;
        targetValue = ex.target_angle; // e.g. 95
        restValue = 30; // Hand open
        isAscending = true;
      } else if (nameLower.includes('finger opening')) {
        currentValue = (data.thumb + data.index + data.middle + data.ring + data.little) / 5;
        targetValue = ex.target_angle; // e.g. 10
        restValue = 75; // Hand closed
        isAscending = false; // Flex sensor drops when straight/open
      } else {
        // Default to MPU wrist pitch
        currentValue = data.wrist_pitch;
        targetValue = ex.target_angle;
        restValue = 10;
        isAscending = true;
      }
    }

    // STATE MACHINE TRANSITIONS
    setRepState(current => {
      // 1. REST STATE
      if (current === 'rest') {
        const hasInitiated = isAscending 
          ? currentValue > restValue + (targetValue - restValue) * 0.25 
          : currentValue < restValue - (restValue - targetValue) * 0.25;

        if (hasInitiated) {
          setGuidance(isForceBased ? 'Grip force detected. Squeeze harder!' : 'Movement detected. Bend toward target!');
          return 'moving';
        }
        return 'rest';
      }

      // 2. MOVING STATE
      if (current === 'moving') {
        const targetReached = isAscending 
          ? currentValue >= targetValue 
          : currentValue <= targetValue;

        if (targetReached) {
          if (holdSecs > 0) {
            setHoldCountdown(holdSecs);
            startHoldTimer(holdSecs);
            setGuidance(`Target reached! HOLD position for ${holdSecs} seconds.`);
            return 'target_hold';
          } else {
            setGuidance('Target reached! Return to starting rest position.');
            return 'returning';
          }
        }
        
        // Posture guidance recommendations
        if (isForceBased) {
          setGuidance(`Apply more force! Current: ${currentValue.toFixed(0)} N / Target: ${targetValue} N`);
        } else {
          setGuidance(`Bending arm... Current: ${currentValue.toFixed(0)}° / Target: ${targetValue}°`);
        }
        return 'moving';
      }

      // 3. TARGET HOLD STATE
      if (current === 'target_hold') {
        const letGo = isAscending 
          ? currentValue < targetValue * 0.8
          : currentValue > targetValue + (180 - targetValue) * 0.2; // slipped elbow flex

        if (letGo) {
          // User released hold early -> mark failed rep
          clearInterval(holdTimerIntervalRef.current);
          setHoldCountdown(0);
          setRepsFailed(f => f + 1);
          updateAccuracyScore(repsCompleted, repsFailed + 1);
          setGuidance('Target released too early! Return to starting rest position.');
          return 'returning';
        }
        return 'target_hold';
      }

      // 4. RETURNING STATE
      if (current === 'returning') {
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
          return 'rest';
        }
        return 'returning';
      }

      return current;
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
      
      const angles = hist.map(h => isElbow ? h.elbow : h.wrist_pitch);
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

  return (
    <div className="space-y-6 relative h-[calc(100vh-8.5rem)] overflow-hidden flex flex-col justify-between">
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
            <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-4 text-white relative shadow-inner overflow-hidden min-h-[300px]">
              
              {/* Header inside canvas overlay */}
              <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur border border-slate-800 rounded-xl p-3 px-4 flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Live Stream</span>
                  <span className="text-xs font-semibold text-slate-200">{exerciseName}</span>
                </div>
              </div>

              {deviceConnected ? (
                <div className="absolute top-4 right-4 z-10 bg-slate-950/80 backdrop-blur border border-slate-800 rounded-xl p-2 px-3 flex items-center gap-2 text-xs font-semibold text-green-400">
                  <Activity className="w-4 h-4 text-green-400 animate-pulse" />
                  Battery: {battery}%
                </div>
              ) : (
                <div className="absolute top-4 right-4 z-10 bg-slate-950/80 backdrop-blur border border-red-950 rounded-xl p-2 px-3 flex items-center gap-2 text-xs font-semibold text-red-500 animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Sleeve Offline
                </div>
              )}

              {/* R3F Canvas */}
              <div className="w-full h-full">
                <Canvas camera={{ position: [3, 1, 0], fov: 50 }}>
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[10, 10, 5]} intensity={1.5} />
                  <pointLight position={[-10, -10, -5]} intensity={0.5} />
                  <ArmModel 
                    shoulderPitch={sensors.wrist_pitch} 
                    elbowAngle={sensors.elbow} 
                    wristRoll={sensors.wrist_roll} 
                    fingers={sensors}
                  />
                  <OrbitControls enableZoom={true} enablePan={true} maxPolarAngle={Math.PI / 2} />
                  <gridHelper args={[10, 10, '#334155', '#1e293b']} position={[0, -2.5, 0]} />
                </Canvas>
              </div>

              {/* 3D Guide helper */}
              <div className="absolute bottom-4 left-4 text-[10px] text-slate-500 bg-slate-950/40 p-2 rounded-lg font-medium">
                Hold left click and drag to rotate view. Scroll to zoom.
              </div>
            </div>

            {/* Right Panel: Guidance and Statistics */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-y-auto">
              
              {/* Patient and session names */}
              <div className="space-y-1">
                <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">Rehab Assessment Session</span>
                <h3 className="text-xl font-bold text-slate-800">{exerciseName}</h3>
                <p className="text-xs text-slate-500 font-semibold">Patient: {patientName}</p>
              </div>

              <hr className="border-slate-100" />

              {/* Counters Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Repetitions</span>
                  <p className="text-3xl font-extrabold text-slate-800">
                    {repsCompleted} <span className="text-sm text-slate-400 font-medium">/ {exerciseDetails?.repetitions}</span>
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

              {/* Live Guidance Hud */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Biofeedback Guidance HUD</span>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                  <Cpu className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-slate-700 leading-normal">{guidance}</p>
                </div>
              </div>

              {/* Actions Footer */}
              <button 
                onClick={handleStopSession}
                className="w-full py-3.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-red-200"
              >
                <Square className="w-4 h-4 fill-current" />
                End & Save Session
              </button>
            </div>

          </div>

          {/* Bottom Panel: Live Charts */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-48 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Real-time Telemetry Graph (Last 50 ticks)</span>
              <div className="flex gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />Pitch Angle (°)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Elbow Angle (°)</span>
                {exerciseDetails?.target_pressure > 0 && (
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" />Force (N)</span>
                )}
              </div>
            </div>

            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryStream} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" hide={true} />
                  <YAxis domain={[0, 200]} stroke="#94a3b8" fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pitch" stroke="#4f46e5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="elbow" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  {exerciseDetails?.target_pressure > 0 && (
                    <Line type="monotone" dataKey="pressure" stroke="#ec4899" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
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
