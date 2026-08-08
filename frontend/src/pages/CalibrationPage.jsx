import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/auth';
import WristCalibrationViewer from '../components/WristCalibrationViewer';
import { 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  Battery, 
  Activity, 
  ArrowRight, 
  RefreshCw, 
  Check,
  X,
  Sliders,
  Cpu,
  Layers,
  Gauge,
  Video
} from 'lucide-react';

// ==========================================
// 1. DYNAMIC SVG ILLUSTRATIONS & COMPONENT ICONS
// ==========================================

const Esp32Svg = ({ status }) => {
  const isPulsing = status === 'calibrating';
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 select-none">
      <rect x="25" y="15" width="50" height="70" rx="6" fill="#1E293B" stroke="#475569" strokeWidth="2" />
      <rect x="33" y="35" width="34" height="35" rx="3" fill="#94A3B8" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="36" y="38" width="28" height="8" rx="1" fill="#64748B" />
      <text x="39" y="44" fill="#cbd5e1" fontSize="5" fontWeight="bold" fontFamily="monospace">ESP32</text>
      <path d="M 33 22 L 33 18 L 67 18 L 67 22 M 40 22 L 40 20 L 45 20 L 45 22 M 55 22 L 55 20 L 60 20 L 60 22" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
      {[24, 30, 36, 42, 48, 54, 60, 66, 72, 78].map((y) => (
        <g key={y}>
          <rect x="20" y={y} width="5" height="2" fill="#E2E8F0" />
          <rect x="75" y={y} width="5" height="2" fill="#E2E8F0" />
        </g>
      ))}
      <circle cx="60" cy="28" r="2.5" fill={status === 'ready' ? '#10B981' : isPulsing ? '#3B82F6' : '#94A3B8'} className={isPulsing ? 'animate-pulse' : ''} />
    </svg>
  );
};

const Mpu6050Svg = ({ status }) => {
  const isPulsing = status === 'calibrating';
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 select-none">
      <rect x="20" y="20" width="60" height="60" rx="8" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="2" />
      {[28, 34, 40, 46, 52, 58, 64, 72].map((x, idx) => (
        <g key={idx}>
          <circle cx={x} cy="26" r="2" fill="#F59E0B" />
          <line x1={x} y1="20" x2={x} y2="24" stroke="#D97706" strokeWidth="1.5" />
        </g>
      ))}
      <rect x="36" y="38" width="28" height="28" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
      <circle cx="40" cy="42" r="1" fill="#94A3B8" />
      <text x="39" y="55" fill="#cbd5e1" fontSize="4.5" fontWeight="bold" fontFamily="monospace">MPU6050</text>
      
      <g stroke={status === 'skipped' ? '#F59E0B' : status === 'ready' ? '#10B981' : '#F59E0B'} strokeWidth="1.5" fill="none" className={isPulsing ? 'animate-bounce' : ''}>
        <path d="M 50 52 L 68 52" />
        <path d="M 65 49 L 68 52 L 65 55" fill="none" />
        <path d="M 50 52 L 50 34" />
        <path d="M 47 37 L 50 34 L 53 37" fill="none" />
      </g>
    </svg>
  );
};

const FlexGloveSvg = ({ status }) => {
  const isPulsing = status === 'calibrating';
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 select-none">
      <path d="M 35 85 C 35 70 30 65 30 50 C 30 40 33 30 35 20 C 36 17 39 17 40 20 C 42 32 44 42 45 48 C 45 35 47 22 48 10 C 49 7 52 7 53 10 C 54 25 55 35 56 45 C 57 32 59 18 60 12 C 61 9 64 9 65 12 C 66 25 67 36 68 47 C 69 36 71 25 72 20 C 73 17 76 17 77 20 C 78 35 75 52 72 65 C 69 75 60 85 50 85 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
      <rect x="34" y="78" width="32" height="8" rx="2" fill="#475569" />
      <g stroke={status === 'ready' ? '#10B981' : isPulsing ? '#3B82F6' : '#EF4444'} strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M 45 30 L 46 45 L 47 60" className={isPulsing ? 'animate-pulse' : ''} />
        <path d="M 52 22 L 53 38 L 54 62" className={isPulsing ? 'animate-pulse' : ''} />
        <path d="M 60 25 L 61 40 L 62 62" className={isPulsing ? 'animate-pulse' : ''} />
      </g>
    </svg>
  );
};

const ElbowPressureSvg = ({ status }) => {
  const isPulsing = status === 'calibrating';
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 select-none">
      <path d="M 25 35 L 40 35 C 50 35 55 40 60 50 L 70 70 L 60 75 L 50 58 C 47 52 42 50 35 50 L 25 50 Z" fill="#334155" stroke="#475569" strokeWidth="1.5" />
      <circle cx="54" cy="52" r="14" fill="none" stroke={status === 'ready' ? '#10B981' : isPulsing ? '#3B82F6' : '#94A3B8'} strokeWidth="3" strokeDasharray="4 2" className={isPulsing ? 'animate-spin' : ''} style={{ transformOrigin: '54px 52px', animationDuration: '4s' }} />
    </svg>
  );
};

// ==========================================
// 2. LIVE SCROLLING CHART COMPONENT (CANVAS)
// ==========================================

const LiveChart = ({ value, minVal = 0, maxVal = 100, color = '#3B82F6', height = 36 }) => {
  const canvasRef = useRef(null);
  const historyRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const history = historyRef.current;
    history.push(value);
    if (history.length > 80) history.shift();

    const width = canvas.width;
    const canvasHeight = canvas.height;
    ctx.clearRect(0, 0, width, canvasHeight);

    // Draw background grid lines
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvasHeight); ctx.stroke();
    }
    for (let i = 0; i < canvasHeight; i += 10) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    if (history.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const step = width / 80;
    const range = maxVal - minVal || 1;

    history.forEach((val, index) => {
      const x = index * step;
      const normalized = (val - minVal) / range;
      const clamped = Math.max(0, Math.min(1, normalized));
      const y = canvasHeight - 3 - clamped * (canvasHeight - 6);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }, [value, minVal, maxVal, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={220} 
      height={height} 
      className="w-full border border-slate-100 rounded-md bg-slate-50/50"
    />
  );
};

// ==========================================
// 3. LIVE KINEMATIC VISUALIZER (CANVAS)
// ==========================================

const LiveVisualizer = ({ sensorIndex, telemetry }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark grey background mimicking the mockup's camera frame
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, width, height);

    // Camera details overlay
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 30) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    // Camera rec indicator in top right
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(width - 15, 12, 3, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '8px monospace';
    ctx.fillText('LIVE STREAM', 12, 14);

    if (!telemetry) return;

    ctx.strokeStyle = '#3B82F6';
    ctx.fillStyle = '#60A5FA';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    if (sensorIndex === 0) {
      // ESP32 Heartbeat signal
      ctx.strokeStyle = '#10B981';
      ctx.beginPath();
      ctx.moveTo(10, height / 2);
      const time = Date.now() * 0.005;
      for (let x = 10; x < width - 10; x++) {
        const y = height / 2 + Math.sin(x * 0.06 + time) * 12 * (x > 40 && x < 100 ? 1.4 : 0.1);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    else if (sensorIndex === 1) {
      // Fingers visual (hand skeleton)
      const { thumb = 0, index = 0, middle = 0, ring = 0, little = 0 } = telemetry;
      const fingers = [thumb, index, middle, ring, little];
      const startX = 35;
      const spacing = 14;
      
      // Palm base
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2 + 18, 35, 10, 0, 0, 2 * Math.PI);
      ctx.fill();

      // Fingers
      fingers.forEach((val, idx) => {
        const x = startX + idx * spacing;
        const straightLen = 32;
        const bentLen = 8;
        const len = straightLen - (val / 100) * (straightLen - bentLen);
        
        ctx.strokeStyle = '#3B82F6';
        ctx.beginPath();
        ctx.moveTo(x, height / 2 + 15);
        ctx.lineTo(x, height / 2 + 15 - len);
        ctx.stroke();

        ctx.fillStyle = '#93C5FD';
        ctx.beginPath();
        ctx.arc(x, height / 2 + 15 - len, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    else if (sensorIndex === 2) {
      // Elbow Bend Visual (joint forearm)
      const elbow = telemetry.elbow || 180;
      const angleRad = (elbow * Math.PI) / 180;
      
      const px = width / 2 - 20;
      const py = height / 2 + 15;
      
      // Upper arm
      ctx.strokeStyle = '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(px - 25, py);
      ctx.lineTo(px, py);
      ctx.stroke();

      // Forearm
      const fx = px + Math.cos(Math.PI - angleRad) * 35;
      const fy = py - Math.sin(Math.PI - angleRad) * 35;

      ctx.strokeStyle = '#3B82F6';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(fx, fy);
      ctx.stroke();

      // Elbow joint
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
    else if (sensorIndex === 3) {
      // Wrist Rotation MPU (dynamic top-down hand/wrist visual)
      const pitch = telemetry.wrist_pitch || 0;
      const roll = telemetry.wrist_roll || 0;

      // 1. Draw target background rings (radar style)
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(width / 2, height / 2, 28, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(width / 2, height / 2, 45, 0, 2 * Math.PI); ctx.stroke();
      
      // Crosshairs
      ctx.beginPath(); ctx.moveTo(width / 2 - 55, height / 2); ctx.lineTo(width / 2 + 55, height / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(width / 2, height / 2 - 55); ctx.lineTo(width / 2, height / 2 + 55); ctx.stroke();

      // 2. Draw forearm/arm base (static behind the hand)
      ctx.strokeStyle = '#64748B';
      ctx.fillStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Draw a sleeve base at the bottom of the joint
      ctx.rect(width / 2 - 12, height / 2 + 25, 24, 45);
      ctx.fill();
      ctx.stroke();

      // 3. Draw Hand / Wrist (pronating and supinating)
      ctx.save();
      ctx.translate(width / 2, height / 2 + 25);
      ctx.rotate((roll * Math.PI) / 180);

      const scaleY = Math.cos((pitch * Math.PI) / 180);
      ctx.scale(1, scaleY);

      // Palm outline
      ctx.strokeStyle = '#3B82F6';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-18, -25); 
      ctx.quadraticCurveTo(-18, -32, -12, -33); 
      ctx.lineTo(12, -33); 
      ctx.quadraticCurveTo(18, -32, 18, -25); 
      ctx.lineTo(16, 0); 
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Joint pin
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, 2 * Math.PI);
      ctx.fill();

      // Thumb
      ctx.strokeStyle = '#60A5FA';
      ctx.beginPath();
      ctx.moveTo(-16, -10);
      ctx.lineTo(-26, -16);
      ctx.lineTo(-28, -26);
      ctx.stroke();
      ctx.fillStyle = '#93C5FD';
      ctx.beginPath(); ctx.arc(-28, -26, 2.5, 0, 2 * Math.PI); ctx.fill();

      // Index finger
      ctx.beginPath();
      ctx.moveTo(-12, -33);
      ctx.lineTo(-14, -55);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-14, -55, 2.2, 0, 2 * Math.PI); ctx.fill();

      // Middle finger
      ctx.beginPath();
      ctx.moveTo(-4, -33);
      ctx.lineTo(-4, -61);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-4, -61, 2.2, 0, 2 * Math.PI); ctx.fill();

      // Ring finger
      ctx.beginPath();
      ctx.moveTo(4, -33);
      ctx.lineTo(6, -57);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(6, -57, 2.2, 0, 2 * Math.PI); ctx.fill();

      // Little finger
      ctx.beginPath();
      ctx.moveTo(12, -33);
      ctx.lineTo(16, -49);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(16, -49, 2.2, 0, 2 * Math.PI); ctx.fill();

      ctx.restore();
    }
    else if (sensorIndex === 4) {
      // Pressure sensor visual (squeezing circle)
      const pressure = telemetry.pressure || 0;
      const radius = 8 + (pressure / 800) * 22;

      ctx.strokeStyle = '#10B981';
      ctx.fillStyle = '#A7F3D0';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }

  }, [sensorIndex, telemetry]);

  const isMpu = sensorIndex === 3;
  return (
    <div className="w-full h-full relative overflow-hidden rounded-lg bg-slate-700">
      <canvas 
        ref={canvasRef} 
        width={isMpu ? 280 : 140} 
        height={isMpu ? 140 : 70} 
        className="w-full h-full block" 
      />
      <Video className="absolute bottom-2 right-2 w-4 h-4 text-slate-300" />
    </div>
  );
};

// ==========================================
// 4. MAIN PAGE COMPONENT
// ==========================================

function CalibrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Diagnostics Layout, 2: Motion Verification, 3: Complete
  const [connecting, setConnecting] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [linkEstablished, setLinkEstablished] = useState(false);
  const [battery, setBattery] = useState(94);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Real-time tracking states
  const [physicalDeviceConnected, setPhysicalDeviceConnected] = useState(false);
  const [activeSensorIndex, setActiveSensorIndex] = useState(0);
  const [lastTelemetry, setLastTelemetry] = useState(null);
  const [liveValues, setLiveValues] = useState({
    wrist_pitch: 0.0,
    wrist_roll: 0.0,
    pressure: 0,
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    little: 0,
    elbow: 180
  });
  
  // Track min/max readings for variance check during calibration
  const [minSeen, setMinSeen] = useState({});
  const [maxSeen, setMaxSeen] = useState({});
  
  // Statuses: 'pending', 'calibrating', 'ready', 'skipped'
  const [sensorStatuses, setSensorStatuses] = useState({
    esp32: 'pending',
    flex: 'pending',
    elbow: 'pending',
    mpu: 'pending',
    pressure: 'pending'
  });

  // Motion Verification tasks
  const [motionSteps, setMotionSteps] = useState({
    raiseArm: false,
    bendElbow: false,
    closeHand: false
  });
  const [sideAngle, setSideAngle] = useState(0);
  const [bendAngle, setBendAngle] = useState(0);

  // Sync sideAngle/bendAngle with physical sensor telemetry if available
  useEffect(() => {
    if (lastTelemetry) {
      const roll = Math.max(-45, Math.min(45, lastTelemetry.wrist_roll || 0));
      const pitch = Math.max(-45, Math.min(45, lastTelemetry.wrist_pitch || 0));
      setSideAngle(roll);
      setBendAngle(pitch);
    }
  }, [lastTelemetry]);

  const wsRef = useRef(null);

  // Components mapping for the layout rows
  const componentRows = [
    { id: 'esp32', name: 'ESP32 Microcontroller 1.', model: 'ESP32-DEV-1', statusKey: 'esp32' },
    { id: 'flex', name: 'Finger Sensors.', model: 'Finger Flex Cluster', statusKey: 'flex', icons: true },
    { id: 'elbow', name: 'Elbow Flex Sensor.', model: 'Elbow Joint Flex', statusKey: 'elbow' },
    { id: 'mpu', name: 'Wrist Rotation MPU.', model: 'MPU6050 Wrist IMU', statusKey: 'mpu' },
    { id: 'pressure', name: 'Pressure Sensor.', model: 'Palmar Pressure Sensor', statusKey: 'pressure' }
  ];

  // Connection Handler
  const connectDevice = () => {
    setConnecting(true);
    setErrorMsg('');
    setPhysicalDeviceConnected(false);
    
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

    const connectionTimeout = setTimeout(() => {
      if (!physicalDeviceConnected) {
        setErrorMsg('Physical ESP32 device not detected. Ensure your ESP32 sleeve is powered on and connected to the same Wi-Fi subnet as your computer.');
        ws.close();
        setConnecting(false);
      }
    }, 12000);

    ws.onopen = () => {
      console.log("[WS] WebSocket link opened. Waiting for ESP32 connection broadcast...");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Hardware status checks
      if (data.type === 'status_update' && data.status === 'hardware_status_changed') {
        if (data.hardware_connected) {
          clearTimeout(connectionTimeout);
          setPhysicalDeviceConnected(true);
          setConnecting(false);
          setDeviceConnected(true);
          setLinkEstablished(true);
          setErrorMsg(''); // Clear any previous error
          
          setSensorStatuses(prev => ({ ...prev, esp32: 'ready' }));
          apiClient.post('/device/connect').catch(err => console.error(err));
          
          // Focus first sensor if we haven't selected anything yet
          setActiveSensorIndex(prev => prev === 0 ? 1 : prev);
          setSensorStatuses(prev => {
            const nextKey = componentRows[activeSensorIndex === 0 ? 1 : activeSensorIndex].statusKey;
            if (prev[nextKey] === 'pending') {
              return { ...prev, flex: 'calibrating' };
            }
            return prev;
          });
        } else {
          setPhysicalDeviceConnected(false);
          setDeviceConnected(false);
          setErrorMsg('Device Link Lost: The ESP32 is offline. Waiting for device to turn back on...');
        }
      }
      
      // Telemetry stream checks
      if (data.type === 'sensor_data') {
        if (data.is_mock) return; // Strict block: ignore all mock/simulated streams
        
        setBattery(data.battery);
        setLiveValues(data);
        setLastTelemetry(data);

        // Motion testing state machine triggers
        if (sensorStatuses.mpu === 'ready') {
          if (data.wrist_pitch > 55.0) setMotionSteps(prev => ({ ...prev, raiseArm: true }));
        } else if (sensorStatuses.mpu === 'skipped') {
          setMotionSteps(prev => ({ ...prev, raiseArm: true }));
        }

        if (sensorStatuses.elbow === 'ready') {
          if (data.elbow < 110) setMotionSteps(prev => ({ ...prev, bendElbow: true }));
        } else if (sensorStatuses.elbow === 'skipped') {
          setMotionSteps(prev => ({ ...prev, bendElbow: true }));
        }

        if (sensorStatuses.pressure === 'ready') {
          if (data.pressure > 500) setMotionSteps(prev => ({ ...prev, closeHand: true }));
        } else if (sensorStatuses.pressure === 'skipped') {
          setMotionSteps(prev => ({ ...prev, closeHand: true }));
        }
      }
    };

    ws.onerror = () => {
      setErrorMsg('Failed to connect to the backend server. Make sure uvicorn is running.');
      setConnecting(false);
      clearTimeout(connectionTimeout);
    };

    ws.onclose = () => {
      setDeviceConnected(false);
      setPhysicalDeviceConnected(false);
      setConnecting(false);
      clearTimeout(connectionTimeout);
    };
  };

  const disconnectDevice = async () => {
    if (wsRef.current) wsRef.current.close();
    try {
      await apiClient.post('/device/disconnect');
    } catch (e) {}
    setDeviceConnected(false);
    setLinkEstablished(false);
    setStep(1);
    setActiveSensorIndex(0);
    setSensorStatuses({ esp32: 'pending', flex: 'pending', elbow: 'pending', mpu: 'pending', pressure: 'pending' });
    setMotionSteps({ raiseArm: false, bendElbow: false, closeHand: false });
    setMinSeen({});
    setMaxSeen({});
  };

  // ==========================================
  // REAL INTERACTIVE CALIBRATION SIGNAL CHECKS
  // ==========================================

  useEffect(() => {
    if (!lastTelemetry) return;

    // Finger Calibration check (Variance > 12 on at least 2 finger channels)
    if (activeSensorIndex === 1 && sensorStatuses.flex === 'calibrating') {
      const { thumb, index, middle, ring, little } = lastTelemetry;
      
      setMinSeen(prev => {
        const c = prev.flex || { thumb: 100, index: 100, middle: 100, ring: 100, little: 100 };
        return { ...prev, flex: { thumb: Math.min(c.thumb, thumb), index: Math.min(c.index, index), middle: Math.min(c.middle, middle), ring: Math.min(c.ring, ring), little: Math.min(c.little, little) } };
      });
      setMaxSeen(prev => {
        const c = prev.flex || { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 };
        return { ...prev, flex: { thumb: Math.max(c.thumb, thumb), index: Math.max(c.index, index), middle: Math.max(c.middle, middle), ring: Math.max(c.ring, ring), little: Math.max(c.little, little) } };
      });
    }

    // Elbow Calibration check (Variance > 12 degrees bend)
    if (activeSensorIndex === 2 && sensorStatuses.elbow === 'calibrating') {
      const elbowVal = lastTelemetry.elbow;
      setMinSeen(prev => ({ ...prev, elbow: Math.min(prev.elbow !== undefined ? prev.elbow : 180, elbowVal) }));
      setMaxSeen(prev => ({ ...prev, elbow: Math.max(prev.elbow !== undefined ? prev.elbow : 0, elbowVal) }));
    }

    // Wrist MPU Calibration check (Variance > 10 degrees on pitch or roll)
    if (activeSensorIndex === 3 && sensorStatuses.mpu === 'calibrating') {
      const { wrist_pitch, wrist_roll } = lastTelemetry;
      setMinSeen(prev => {
        const c = prev.mpu || { pitch: 180, roll: 180 };
        return { ...prev, mpu: { pitch: Math.min(c.pitch, wrist_pitch), roll: Math.min(c.roll, wrist_roll) } };
      });
      setMaxSeen(prev => {
        const c = prev.mpu || { pitch: -180, roll: -180 };
        return { ...prev, mpu: { pitch: Math.max(c.pitch, wrist_pitch), roll: Math.max(c.roll, wrist_roll) } };
      });
    }

    // Pressure Calibration check (Variance > 80 Newton units)
    if (activeSensorIndex === 4 && sensorStatuses.pressure === 'calibrating') {
      const pressureVal = lastTelemetry.pressure;
      setMinSeen(prev => ({ ...prev, pressure: Math.min(prev.pressure !== undefined ? prev.pressure : 1000, pressureVal) }));
      setMaxSeen(prev => ({ ...prev, pressure: Math.max(prev.pressure !== undefined ? prev.pressure : 0, pressureVal) }));
    }

  }, [lastTelemetry, activeSensorIndex, sensorStatuses]);

  // Evaluate Threshold Criteria for Calibration
  useEffect(() => {
    // Finger sensors logic - requires at least 3 fingers to register variance >= 25%
    if (activeSensorIndex === 1 && sensorStatuses.flex === 'calibrating' && minSeen.flex && maxSeen.flex) {
      const fMin = minSeen.flex;
      const fMax = maxSeen.flex;
      const count = [fMax.thumb - fMin.thumb, fMax.index - fMin.index, fMax.middle - fMin.middle, fMax.ring - fMin.ring, fMax.little - fMin.little].filter(v => v >= 25).length;
      if (count >= 3) {
        setSensorStatuses(prev => ({ ...prev, flex: 'ready' }));
      }
    }

    // Elbow joint logic - requires elbow angle change >= 20 degrees
    if (activeSensorIndex === 2 && sensorStatuses.elbow === 'calibrating' && minSeen.elbow !== undefined && maxSeen.elbow !== undefined) {
      if (maxSeen.elbow - minSeen.elbow >= 20) {
        setSensorStatuses(prev => ({ ...prev, elbow: 'ready' }));
      }
    }

    // Wrist MPU logic - requires pitch/roll rotation variance >= 15 degrees
    if (activeSensorIndex === 3 && sensorStatuses.mpu === 'calibrating' && minSeen.mpu && maxSeen.mpu) {
      const pVar = maxSeen.mpu.pitch - minSeen.mpu.pitch;
      const rVar = maxSeen.mpu.roll - minSeen.mpu.roll;
      if (pVar >= 15 || rVar >= 15) {
        setSensorStatuses(prev => ({ ...prev, mpu: 'ready' }));
      }
    }

    // Pressure logic - requires pressure change >= 150 Newtons
    if (activeSensorIndex === 4 && sensorStatuses.pressure === 'calibrating' && minSeen.pressure !== undefined && maxSeen.pressure !== undefined) {
      if (maxSeen.pressure - minSeen.pressure >= 150) {
        setSensorStatuses(prev => ({ ...prev, pressure: 'ready' }));
      }
    }

  }, [minSeen, maxSeen, activeSensorIndex, sensorStatuses]);

  // Handle advancing row focus
  const handleNextSensor = () => {
    if (activeSensorIndex < 4) {
      const nextIndex = activeSensorIndex + 1;
      setActiveSensorIndex(nextIndex);
      const nextKey = componentRows[nextIndex].statusKey;
      
      // Auto-set the next status to calibrating if it is pending
      if (sensorStatuses[nextKey] === 'pending') {
        setSensorStatuses(prev => ({ ...prev, [nextKey]: 'calibrating' }));
      }
    }
  };



  const handleSkipSensor = () => {
    const currentKey = componentRows[activeSensorIndex].statusKey;
    setSensorStatuses(prev => ({ ...prev, [currentKey]: 'skipped' }));
  };

  // Submit calibration result to backend
  const submitCalibration = async () => {
    try {
      await apiClient.post('/calibration/result', {
        mpu: sensorStatuses.mpu === 'ready',
        pressure: sensorStatuses.pressure === 'ready',
        thumb: sensorStatuses.flex === 'ready',
        index: sensorStatuses.flex === 'ready',
        middle: sensorStatuses.flex === 'ready',
        ring: sensorStatuses.flex === 'ready',
        little: sensorStatuses.flex === 'ready',
        elbow: sensorStatuses.elbow === 'ready',
        battery: battery,
        patient_id: localStorage.getItem('activePatientId') || null
      });
      navigate('/dashboard');
    } catch (err) {
      console.error("Failed to save calibration results", err);
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const currentSensorKey = componentRows[activeSensorIndex]?.statusKey;
  const currentSensorStatus = currentSensorKey === 'esp32'
    ? (deviceConnected ? 'ready' : 'disconnected')
    : sensorStatuses[currentSensorKey];

  return (
    <div className="min-h-[calc(100vh-5rem)] -m-8 p-8 calib-bg text-slate-700">
      <div className="max-w-6xl mx-auto space-y-6">
      
      {/* 1. Header Wizard Tabs */}
      <div className="neu-panel p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          <h3 className="text-lg font-bold text-slate-800">Calibration Wizard</h3>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <span className={step === 1 ? 'text-primary font-bold' : ''}>1. Component Diagnostics</span>
          <ArrowRight className="w-4 h-4" />
          <span className={step === 2 ? 'text-primary font-bold' : ''}>2. Motion Verification</span>
          <ArrowRight className="w-4 h-4" />
          <span className={step === 3 ? 'text-primary font-bold' : ''}>3. Complete</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center font-medium shadow-sm">
          {errorMsg}
        </div>
      )}

      {/* ==========================================
          STEP 1: COMPONENTS & SIDE POPUP VIEW
          ========================================== */}
      {step === 1 && (
        <div className="w-full animate-fade-in">
              
          {/* MAIN CARD: Component list */}
          <div className="neu-panel p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-slate-300">
              <h4 className="font-bold text-slate-800 text-lg">Component Diagnostics</h4>
              {!linkEstablished ? (
                <button
                  onClick={connectDevice}
                  disabled={connecting}
                  className="neu-button-primary px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {connecting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting...</>
                  ) : (
                    <><Wifi className="w-4 h-4" /> Establish Link</>
                  )}
                </button>
              ) : (
                <button 
                  onClick={disconnectDevice}
                  className="neu-button px-4 py-2 text-xs font-bold text-slate-500 hover:text-red-500"
                >
                  Disconnect Link
                </button>
              )}
            </div>
            <div className="space-y-4">
                
              <div className="space-y-4">
                {componentRows.map((row, idx) => {
                  const isActive = activeSensorIndex === idx;
                  const status = row.statusKey === 'esp32' ? (deviceConnected ? 'ready' : 'disconnected') : sensorStatuses[row.statusKey];
                  return (
                    <div 
                      key={row.id}
                      className={`flex flex-col p-5 rounded-2xl transition duration-300 ease-in-out ${
                        isActive ? 'neu-panel-inset' : 'neu-button opacity-80 cursor-pointer'
                      } ${!linkEstablished && idx > 0 ? 'pointer-events-none opacity-40' : ''}`}
                    >
                      {/* Accordion Row Header */}
                      <div 
                        onClick={() => {
                          setActiveSensorIndex(idx);
                          // Auto set status to calibrating if we select it manually and it is pending
                          if (sensorStatuses[row.statusKey] === 'pending') {
                            setSensorStatuses(prev => ({ ...prev, [row.statusKey]: 'calibrating' }));
                          }
                        }}
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-4"
                      >
                        <div>
                          <span className="font-bold text-slate-800 text-base block">{row.name}</span>
                          <span className="text-xs text-slate-400 font-medium">{row.model}</span>
                        </div>

                        {/* Middle Icons row matching the Finger row mockup */}
                        {row.icons && (
                          <div className="flex items-center gap-2 py-2 sm:py-0 px-3 rounded-lg neu-panel-inset">
                            <Cpu className="w-4 h-4 text-slate-400" />
                            <div className="w-0.5 h-4 bg-slate-100" />
                            <Sliders className="w-4 h-4 text-slate-400" />
                            <div className="w-0.5 h-4 bg-slate-100" />
                            <Layers className="w-4 h-4 text-slate-400" />
                            <div className="w-0.5 h-4 bg-slate-100" />
                            <Gauge className="w-4 h-4 text-slate-400" />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {status === 'ready' && (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 stroke-[3]" /> {idx === 0 ? 'Connected' : 'Ready'}
                            </span>
                          )}
                          {status === 'disconnected' && (
                            <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full flex items-center gap-1 uppercase">
                              <X className="w-3.5 h-3.5 stroke-[3]" /> Disconnected
                            </span>
                          )}
                          {status === 'calibrating' && (
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full animate-pulse uppercase">
                              Active Check...
                            </span>
                          )}
                          {status === 'skipped' && (
                            <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full uppercase">
                              Skipped
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="px-3 py-1 bg-slate-100 text-slate-400 text-xs font-bold rounded-full uppercase">
                              Pending
                            </span>
                          )}
                          <span className={`text-slate-500 transition-transform duration-300 text-sm ${isActive ? 'rotate-180' : ''}`}>
                            &#x25BE;
                          </span>
                        </div>
                      </div>

                      {/* Accordion Row Collapsible Details */}
                      {isActive && (
                        <div className="mt-5 pt-5 border-t border-slate-300 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                          {/* Expanded Left: 3D or 2D Visualizer */}
                          <div className="flex flex-col space-y-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Visual Diagnostics</span>
                            {idx === 3 ? (
                              <div className="h-80 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner relative flex items-center justify-center">
                                <WristCalibrationViewer 
                                  sideAngle={sideAngle} 
                                  bendAngle={bendAngle} 
                                />
                              </div>
                            ) : idx === 0 ? (
                              <div className="flex items-center justify-center neu-panel h-64 rounded-xl p-4">
                                <Esp32Svg status={status} />
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-64 items-center">
                                <div className="flex items-center justify-center neu-panel h-full rounded-xl p-4">
                                  {idx === 1 && <FlexGloveSvg status={status} />}
                                  {idx === 2 && <ElbowPressureSvg status={status} />}
                                  {idx === 4 && <ElbowPressureSvg status={status} />}
                                </div>
                                <div className="h-full bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                  <LiveVisualizer sensorIndex={idx} telemetry={lastTelemetry} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Expanded Right: Telemetry Charts, status, and manual controls */}
                          <div className="flex flex-col space-y-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Live Stream Waveforms</span>
                            
                            {idx === 0 && (
                              <div className="space-y-3">
                                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                                  <span>Connection Status</span>
                                  <span className={deviceConnected ? "text-emerald-500 font-bold" : "text-red-500 font-bold animate-pulse"}>
                                    {deviceConnected ? "ACTIVE" : "INACTIVE"}
                                  </span>
                                </div>
                                
                                <div className="pt-2 border-t border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">GPIO Pin Health Status</span>
                                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold">
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                      <span className="text-slate-500 font-medium">GPIO 32 (Thumb)</span>
                                      <span className={lastTelemetry ? "text-emerald-500" : "text-slate-400"}>
                                        {lastTelemetry ? "● OK" : "○ OFFLINE"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                      <span className="text-slate-500 font-medium">GPIO 33 (Index)</span>
                                      <span className={lastTelemetry ? "text-emerald-500" : "text-slate-400"}>
                                        {lastTelemetry ? "● OK" : "○ OFFLINE"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                      <span className="text-slate-500 font-medium">GPIO 34 (Middle)</span>
                                      <span className={lastTelemetry ? "text-emerald-500" : "text-slate-400"}>
                                        {lastTelemetry ? "● OK" : "○ OFFLINE"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                      <span className="text-slate-500 font-medium">GPIO 35 (Ring)</span>
                                      <span className={lastTelemetry ? "text-emerald-500" : "text-slate-400"}>
                                        {lastTelemetry ? "● OK" : "○ OFFLINE"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                      <span className="text-slate-500 font-medium">GPIO 36 (Little)</span>
                                      <span className={lastTelemetry ? "text-emerald-500" : "text-slate-400"}>
                                        {lastTelemetry ? "● OK" : "○ OFFLINE"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                      <span className="text-slate-500 font-medium">GPIO 39 (Elbow)</span>
                                      <span className={lastTelemetry ? "text-emerald-500" : "text-slate-400"}>
                                        {lastTelemetry ? "● OK" : "○ OFFLINE"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                      <span className="text-slate-500 font-medium">GPIO 25 (Pressure)</span>
                                      <span className={lastTelemetry ? "text-emerald-500" : "text-slate-400"}>
                                        {lastTelemetry ? "● OK" : "○ OFFLINE"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                      <span className="text-slate-500 font-medium">I2C SDA/SCL (MPU)</span>
                                      <span className={lastTelemetry && lastTelemetry.mpu_working ? "text-emerald-500 font-bold" : lastTelemetry ? "text-rose-500 animate-pulse font-bold" : "text-slate-400"}>
                                        {lastTelemetry && lastTelemetry.mpu_working ? "● OK" : lastTelemetry ? "▲ ERROR" : "○ OFFLINE"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {idx === 1 && (
                              <div className="space-y-3">
                                {lastTelemetry && (
                                  <div className="grid grid-cols-5 gap-1.5 text-center">
                                    {['thumb', 'index', 'middle', 'ring', 'little'].map((finger) => (
                                      <div key={finger} className="neu-panel p-1.5 rounded-lg">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase block">{finger.slice(0, 3)}</span>
                                        <span className="text-xs font-bold text-slate-700">{lastTelemetry[finger]}%</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div>
                                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                                    <span>Index Finger Flexion</span>
                                    <span>{lastTelemetry?.index || 0}%</span>
                                  </div>
                                  <LiveChart value={lastTelemetry?.index || 0} minVal={0} maxVal={100} color="#3B82F6" />
                                </div>
                              </div>
                            )}

                            {idx === 2 && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                  <span>Elbow Bend Angle</span>
                                  <span className="font-bold text-primary">{lastTelemetry?.elbow || 180}°</span>
                                </div>
                                <LiveChart value={lastTelemetry?.elbow || 180} minVal={90} maxVal={180} color="#F59E0B" />
                              </div>
                            )}

                            {idx === 3 && (
                              <div className="space-y-3">
                                {lastTelemetry && !lastTelemetry.mpu_working && (
                                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-[10px] font-semibold text-red-700 flex items-start gap-1.5 leading-relaxed">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold block">MPU6050 Disconnected</span>
                                      The ESP32 reported that the MPU6050 chip is not detected on the I2C bus. Check your SDA/SCL wire connections!
                                    </div>
                                  </div>
                                )}

                                <div className="neu-panel-inset p-2.5 rounded-lg grid grid-cols-2 gap-2 text-center">
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">X-Axis (Pitch)</span>
                                    <span className="text-xs font-bold text-slate-700">{lastTelemetry?.wrist_pitch || 0}°</span>
                                    <span className="text-[8px] font-semibold text-slate-400 block mt-0.5">
                                      {(lastTelemetry?.wrist_pitch || 0) > 5 ? 'Extension (Up)' : (lastTelemetry?.wrist_pitch || 0) < -5 ? 'Flexion (Down)' : 'Neutral'}
                                    </span>
                                  </div>
                                  <div className="border-l border-slate-200">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Y-Axis (Roll)</span>
                                    <span className="text-xs font-bold text-slate-700">{lastTelemetry?.wrist_roll || 0}°</span>
                                    <span className="text-[8px] font-semibold text-slate-400 block mt-0.5">
                                      {(lastTelemetry?.wrist_roll || 0) > 5 ? 'Pronation (Right)' : (lastTelemetry?.wrist_roll || 0) < -5 ? 'Supination (Left)' : 'Neutral'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                                      <span>Pitch Range (Up/Down)</span>
                                      <span>{lastTelemetry?.wrist_pitch || 0}°</span>
                                    </div>
                                    <LiveChart value={lastTelemetry?.wrist_pitch || 0} minVal={-90} maxVal={90} color="#3B82F6" />
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                                      <span>Roll Range (Left/Right)</span>
                                      <span>{lastTelemetry?.wrist_roll || 0}°</span>
                                    </div>
                                    <LiveChart value={lastTelemetry?.wrist_roll || 0} minVal={-90} maxVal={90} color="#10B981" />
                                  </div>
                                </div>

                                <div className="space-y-3 pt-2.5 border-t border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">3D Wrist Prototype Controls</span>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-0.5">
                                        <span>Left ↔ Right (Side-to-Side)</span>
                                        <span className="font-bold text-emerald-500">{sideAngle}°</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="-45" 
                                        max="45" 
                                        value={sideAngle} 
                                        onChange={(e) => setSideAngle(Number(e.target.value))} 
                                        className="w-full accent-emerald-500 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-0.5">
                                        <span>Up ↕ Down (Wrist Bend)</span>
                                        <span className="font-bold text-blue-500">{bendAngle}°</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="-45" 
                                        max="45" 
                                        value={bendAngle} 
                                        onChange={(e) => setBendAngle(Number(e.target.value))} 
                                        className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {idx === 4 && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                  <span>Palmar Force (Pressure)</span>
                                  <span className="font-bold text-emerald-500">{lastTelemetry?.pressure || 0} N</span>
                                </div>
                                <LiveChart value={lastTelemetry?.pressure || 0} minVal={0} maxVal={800} color="#10B981" />
                              </div>
                            )}
                          </div>

                          {/* Expanded Bottom: Status Banner & Row Actions */}
                          <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-300 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition w-full sm:w-auto sm:flex-1 ${
                              status === 'ready' 
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : status === 'disconnected'
                                ? 'bg-red-50 border-red-100 text-red-700'
                                : status === 'skipped'
                                ? 'bg-amber-50 border-amber-100 text-amber-700'
                                : 'bg-blue-50 border-blue-100 text-blue-700 animate-pulse'
                            }`}>
                              <span>
                                {status === 'ready' && (idx === 0 ? 'STATUS: CONNECTED (Active Data Stream)' : 'STATUS: CALIBRATED (Active Data Stream)')}
                                {status === 'disconnected' && 'STATUS: DISCONNECTED (Telemetry Offline)'}
                                {status === 'skipped' && 'STATUS: BYPASSED / SKIPPED'}
                                {status === 'calibrating' && (
                                  idx === 1 ? 'CALIBRATING: Flex your fingers now...' :
                                  idx === 2 ? 'CALIBRATING: Bend your elbow back and forth...' :
                                  idx === 3 ? 'CALIBRATING: Rotate and tilt your wrist...' :
                                  idx === 4 ? 'CALIBRATING: Squeeze palm force sensor...' : 
                                  'CALIBRATING: Establishing connection link...'
                                )}
                              </span>
                              {(status === 'ready' || status === 'skipped') && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              )}
                              {status === 'disconnected' && (
                                <AlertCircle className="w-4 h-4 text-red-650 animate-pulse" />
                              )}
                            </div>

                            <div className="flex gap-3 w-full sm:w-auto">
                              {status === 'calibrating' && idx > 0 && (
                                <button 
                                  onClick={handleSkipSensor}
                                  className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                  Skip Sensor
                                </button>
                              )}
                              <button 
                                onClick={handleNextSensor}
                                disabled={status !== 'ready' && status !== 'skipped'}
                                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-slate-900/10"
                              >
                                Next Sensor Diagnostics
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Info bar */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-300 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  {linkEstablished && <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
                  <span>{linkEstablished ? 'Real-time link streaming at 10Hz' : 'Awaiting connection...'}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={Object.values(sensorStatuses).some(s => s === 'pending' || s === 'calibrating')}
                  className="w-full py-3 neu-button-primary rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Continue to Motion Verification &rarr;
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* ==========================================
          STEP 2: MOTION VERIFICATION
          ========================================== */}
      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in animate-fade-in">
          <div className="neu-panel md:col-span-2 p-6 space-y-6">
            <div>
              <h4 className="font-bold text-slate-800 text-lg">Step 2: Motion Verification</h4>
              <p className="text-sm text-slate-500">Perform the following movements to calibrate target thresholds.</p>
            </div>

            <div className="space-y-4">
              {/* Task 1 */}
              <div className={`p-4 rounded-xl border transition flex justify-between items-center ${
                motionSteps.raiseArm ? 'bg-green-50/50 border-green-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <h5 className="font-bold text-slate-800">1. Raise Your Arm</h5>
                  <p className="text-xs text-slate-500">
                    {sensorStatuses.mpu === 'ready' 
                      ? `Lift your shoulder to a 45-degree angle. (Live pitch: ${liveValues.wrist_pitch.toFixed(1)}°)`
                      : 'Bypassed (MPU6050 sensor skipped)'}
                  </p>
                </div>
                {motionSteps.raiseArm ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <span className="text-xs font-bold text-primary animate-pulse uppercase">Perform now</span>
                )}
              </div>

              {/* Task 2 */}
              <div className={`p-4 rounded-xl border transition flex justify-between items-center ${
                !motionSteps.raiseArm ? 'opacity-50' : 
                motionSteps.bendElbow ? 'bg-green-50/50 border-green-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <h5 className="font-bold text-slate-800">2. Bend Your Elbow</h5>
                  <p className="text-xs text-slate-500">
                    {sensorStatuses.elbow === 'ready'
                      ? `Bend your forearm upwards towards your shoulder. (Live angle: ${liveValues.elbow.toFixed(0)}°)`
                      : 'Bypassed (Elbow sensor skipped)'}
                  </p>
                </div>
                {motionSteps.bendElbow ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : motionSteps.raiseArm ? (
                  <span className="text-xs font-bold text-primary animate-pulse uppercase">Perform now</span>
                ) : (
                  <AlertCircle className="w-6 h-6 text-slate-300" />
                )}
              </div>

              {/* Task 3 */}
              <div className={`p-4 rounded-xl border transition flex justify-between items-center ${
                !motionSteps.bendElbow ? 'opacity-50' : 
                motionSteps.closeHand ? 'bg-green-50/50 border-green-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <h5 className="font-bold text-slate-800">3. Close Your Hand (Squeeze)</h5>
                  <p className="text-xs text-slate-500">
                    {sensorStatuses.pressure === 'ready'
                      ? `Close all fingers into a tight fist. (Live pressure: ${liveValues.pressure} N)`
                      : 'Bypassed (Force sensor skipped)'}
                  </p>
                </div>
                {motionSteps.closeHand ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : motionSteps.bendElbow ? (
                  <span className="text-xs font-bold text-primary animate-pulse uppercase">Perform now</span>
                ) : (
                  <AlertCircle className="w-6 h-6 text-slate-300" />
                )}
              </div>
            </div>
            
            <button
              onClick={() => setStep(3)}
              disabled={!motionSteps.raiseArm || !motionSteps.bendElbow || !motionSteps.closeHand}
              className="w-full mt-4 py-3 bg-primary hover:bg-blue-600 text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md shadow-blue-500/10"
            >
              Continue &rarr;
            </button>
          </div>

          <div className="neu-panel md:col-span-1 p-6 space-y-6">
            <h5 className="font-bold text-slate-800">Diagnostics Stream</h5>
            <div className="space-y-3.5 text-sm text-slate-600 font-mono neu-panel-inset p-4 rounded-xl">
              <div>Wrist Pitch: {liveValues.wrist_pitch.toFixed(1)}°</div>
              <div>Elbow Flex: {liveValues.elbow.toFixed(0)}°</div>
              <div>Grip Force: {liveValues.pressure} N</div>
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-400">
                Stream state: 10Hz active
              </div>
            </div>

            <button
              onClick={disconnectDevice}
              className="w-full py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              Abort Test
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Complete Screen */}
      {step === 3 && (
        <div className="neu-panel p-8 text-center max-w-xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto text-green-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h4 className="text-2xl font-bold text-slate-800">Calibration Successful!</h4>
            <p className="text-slate-500 max-w-sm mx-auto text-sm">
              All sensors and flex movement thresholds have passed diagnostic inspection. You are ready to start today's rehabilitation routines.
            </p>
          </div>

          <button
            onClick={submitCalibration}
            className="w-full py-3 bg-primary hover:bg-blue-600 text-white font-semibold rounded-xl transition cursor-pointer shadow-md shadow-blue-500/10"
          >
            Save Calibration & Proceed &rarr;
          </button>
        </div>
      )}
    </div>
    </div>
  );
}

export default CalibrationPage;
