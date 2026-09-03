import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Activity, 
  User, 
  Sliders, 
  BookOpen, 
  TrendingUp, 
  Cpu, 
  Calendar,
  Clock, 
  Award,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Printer,
  X,
  FileText,
  Heart,
  Info,
  RefreshCw,
  Plus,
  CheckCircle,
  AlertCircle,
  Check,
  Home,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Moon,
  Sun,
  SlidersHorizontal,
  Play,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Compass,
  Hand,
  Gauge,
  Wifi,
  RotateCcw
} from 'lucide-react';
import { getSessionHistory, getSessionDetails } from '../services/session';
import { getDashboardAnalytics } from '../services/analytics';
import { getPatients, createPatient, getBodyParts, getConditions, getRehabilitationGoals, getRecommendedExercises } from '../services/patient';
import apiClient from '../services/auth';
import Arm3DVisualizer from '../components/Arm3DVisualizer';
import SensorCard from '../components/SensorCard';

function DashboardPage() {
  const navigate = useNavigate();
  
  // Theme State: 'light' or 'dark'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const isDark = theme === 'dark';

  // Local active states
  const [activePatientId, setActivePatientId] = useState(localStorage.getItem('activePatientId') || '');
  const [activePatientName, setActivePatientName] = useState(localStorage.getItem('activePatientName') || '');
  const [patients, setPatients] = useState([]);
  const [patientsExpanded, setPatientsExpanded] = useState(false);

  // Injury-centric dropdown metadata states
  const [bodyParts, setBodyParts] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [rehabGoals, setRehabGoals] = useState([]);
  const [filteredConditions, setFilteredConditions] = useState([]);
  
  // Recommended exercises list
  const [recommendedExercises, setRecommendedExercises] = useState([]);
  
  // Dashboard details loaders
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [cameraAngle, setCameraAngle] = useState('straight');
  const [showCamDropdown, setShowCamDropdown] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activeSensorKey, setActiveSensorKey] = useState('imu');
  const [controls, setControls] = useState({
    shoulderAngle: 0,
    shoulderAngleX: 0,
    elbowAngle: 0,
    wristAngle: 0
  });

  const activeControls = (liveTelemetry && deviceConnected)
    ? {
        shoulderAngle: controls.shoulderAngle,
        shoulderAngleX: controls.shoulderAngleX,
        elbowAngle: 180 - liveTelemetry.elbow,
        wristAngle: liveTelemetry.wrist_roll,
        thumb:  liveTelemetry.thumb  !== undefined ? liveTelemetry.thumb  : 0,
        index:  liveTelemetry.index  !== undefined ? liveTelemetry.index  : 0,
        middle: liveTelemetry.middle !== undefined ? liveTelemetry.middle : 0,
        ring:   liveTelemetry.ring   !== undefined ? liveTelemetry.ring   : 0,
        little: liveTelemetry.little !== undefined ? liveTelemetry.little : 0
      }
    : {
        ...controls,
        thumb: 0,
        index: 0,
        middle: 0,
        ring: 0,
        little: 0
      };

  // Patient Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regForm, setRegForm] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    height_cm: '',
    weight_kg: '',
    dominant_hand: 'Right',
    injured_arm: 'Left',
    injury_type: 'Fracture'
  });
  const [regError, setRegError] = useState('');

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  // Fetch initial therapist data
  const initTherapistDashboard = async () => {
    try {
      // Fetch metadata dropdowns
      const [parts, conds, goals] = await Promise.all([
        getBodyParts(),
        getConditions(),
        getRehabilitationGoals()
      ]);
      setBodyParts(parts);
      setConditions(conds);
      setRehabGoals(goals);

      // 1. Fetch patient list
      const patientList = await getPatients();
      setPatients(patientList);
      
      // Auto-select first patient if none is selected
      if (!activePatientId && patientList.length > 0) {
        selectPatient(patientList[0]);
      }

      // 2. Fetch hardware link status
      const statusRes = await apiClient.get('/device/status');
      setDeviceConnected(statusRes.data?.connected === true);
    } catch (err) {
      console.error("Failed to load platform data", err);
    }
  };

  // Load selected patient metrics
  const loadPatientData = async (patientId) => {
    if (!patientId) return;
    setLoading(true);
    try {
      const analyticsData = await getDashboardAnalytics(patientId);
      setAnalytics(analyticsData);

      const historyData = await getSessionHistory();
      const filtered = historyData.filter(s => s.patient_id === patientId);
      setSessions(filtered);

      // Fetch recommended exercises
      const recs = await getRecommendedExercises(patientId);
      setRecommendedExercises(recs);
    } catch (err) {
      console.error("Failed to fetch patient logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initTherapistDashboard();
    
    const handleThemeChange = () => {
      setTheme(localStorage.getItem('theme') || 'dark');
    };
    window.addEventListener('themeChange', handleThemeChange);
    return () => window.removeEventListener('themeChange', handleThemeChange);
  }, []);

  useEffect(() => {
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
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'status_update' && data.status === 'hardware_status_changed') {
        setDeviceConnected(data.hardware_connected);
      }
      if (data.type === 'sensor_data') {
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
          if (val > 180) return Math.min(180, Math.max(0, (val / 4095) * 180));
          return val;
        };

        const parsedData = {
          ...data,
          elbow: extractElbow(),
          wrist_pitch: data.wrist_pitch ?? data.pitch ?? 0.0,
          wrist_roll: data.wrist_roll ?? data.roll ?? 0.0,
          thumb: extractFinger('thumb'),
          index: extractFinger('index'),
          middle: extractFinger('middle'),
          ring: extractFinger('ring'),
          little: extractFinger('little')
        };

        setLiveTelemetry(parsedData);
        setDeviceConnected(!data.is_mock);
      }
    };
    
    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (activePatientId) {
      loadPatientData(activePatientId);
    }
  }, [activePatientId]);

  const selectPatient = (patient) => {
    localStorage.setItem('activePatientId', patient.id);
    localStorage.setItem('activePatientName', patient.full_name);
    setActivePatientId(patient.id);
    setActivePatientName(patient.full_name);
  };

  const handleOpenDetails = async (sessionId) => {
    try {
      const details = await getSessionDetails(sessionId);
      setSelectedSession(details);
      setShowDetailsModal(true);
    } catch (err) {
      console.error("Failed to fetch session details", err);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleOpenRegisterModal = () => {
    const initialPartId = bodyParts[0]?.id || '';
    const initialConds = conditions.filter(c => c.body_part_id === initialPartId);
    setFilteredConditions(initialConds);
    setRegForm({
      full_name: '',
      age: '',
      gender: 'Male',
      height_cm: '',
      weight_kg: '',
      dominant_hand: 'Right',
      injured_arm: 'Left',
      injury_type: '',
      body_part_id: initialPartId,
      condition_id: initialConds[0]?.id || '',
      rehabilitation_goal_id: rehabGoals[0]?.id || ''
    });
    setRegError('');
    setShowRegisterModal(true);
  };

  const handleRegisterInputChange = (e) => {
    const { name, value } = e.target;
    setRegForm(prev => {
      const updated = {
        ...prev,
        [name]: value
      };
      if (name === 'body_part_id') {
        const matching = conditions.filter(c => c.body_part_id === value);
        setFilteredConditions(matching);
        updated.condition_id = matching[0]?.id || '';
      }
      return updated;
    });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    if (!regForm.full_name || !regForm.age || !regForm.height_cm || !regForm.weight_kg || !regForm.condition_id) {
      setRegError('All fields are required');
      return;
    }
    
    const activeCond = conditions.find(c => c.id === regForm.condition_id);
    const payload = {
      full_name: regForm.full_name,
      age: parseInt(regForm.age),
      gender: regForm.gender,
      height_cm: parseFloat(regForm.height_cm),
      weight_kg: parseFloat(regForm.weight_kg),
      dominant_hand: regForm.dominant_hand,
      injured_arm: regForm.injured_arm,
      injury_type: activeCond ? activeCond.name : regForm.injury_type,
      body_part_id: regForm.body_part_id,
      condition_id: regForm.condition_id,
      rehabilitation_goal_id: regForm.rehabilitation_goal_id
    };
    
    try {
      const res = await createPatient(payload);

      // Reload patients
      const patientList = await getPatients();
      setPatients(patientList);
      
      // Auto-select newly created patient
      const newPatientObj = patientList.find(p => p.id === res.patient_id);
      if (newPatientObj) {
        selectPatient(newPatientObj);
      }

      // Close modal
      setShowRegisterModal(false);
    } catch (err) {
      setRegError(err.response?.data?.detail || 'Failed to create patient profile');
    }
  };

  // Helper format seconds
  const formatTime = (secs) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const supplements = [
    { name: 'Vitamin E', dose: '200mcg', count: '01', desc: 'Accelerates cellular tissue rebuilding' },
    { name: 'Iron', dose: '90 Softgel', count: '02', desc: 'Promotes muscle oxygenation flow' },
    { name: 'Vitamin C', dose: '500mg Blend', count: '03', desc: 'Stimulates joint collagen synthesis' }
  ];

  const selectedPatient = patients.find(p => p.id === activePatientId);

  const sensorReadings = {
    imu: {
      pitch: liveTelemetry ? (liveTelemetry.wrist_pitch ?? 0).toFixed(1) : '14.2',
      roll: liveTelemetry ? (liveTelemetry.wrist_roll ?? 0).toFixed(1) : '-8.5',
    },
    flex: {
      thumb: liveTelemetry ? Math.round(liveTelemetry.thumb ?? 0) : 35,
      index: liveTelemetry ? Math.round(liveTelemetry.index ?? 0) : 52,
      middle: liveTelemetry ? Math.round(liveTelemetry.middle ?? 0) : 60,
      ring: liveTelemetry ? Math.round(liveTelemetry.ring ?? 0) : 48,
      little: liveTelemetry ? Math.round(liveTelemetry.little ?? 0) : 40,
    },
    elbow: {
      angle: liveTelemetry ? Math.round(180 - liveTelemetry.elbow) : 45,
    },
    pressure: {
      force: liveTelemetry ? ((liveTelemetry.pressure || 0) / 10).toFixed(1) : '18.4',
    }
  };

  const avgFlex = Math.round(
    (sensorReadings.flex.thumb + sensorReadings.flex.index + sensorReadings.flex.middle + sensorReadings.flex.ring + sensorReadings.flex.little) / 5
  );

  return (
    <div className={`min-h-screen -m-8 p-6 lg:p-10 flex flex-col gap-10 font-sans select-none overflow-x-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#090B10] text-[#E2E8F0]' : 'bg-[#F8FAFC] text-[#1E293B]'
    }`}>
      
      {/* ===================================================
          SECTION 1: FULL-WIDTH HERO SECTION
          =================================================== */}
      <section className={`relative rounded-3xl p-8 lg:p-10 border overflow-hidden transition-all duration-300 min-h-[calc(100vh-140px)] flex flex-col justify-center ${
        isDark 
          ? 'bg-gradient-to-br from-[#121722] via-[#0D1017] to-[#0A0C12] border-slate-800/80 shadow-2xl' 
          : 'bg-gradient-to-br from-white via-slate-50 to-blue-50/40 border-slate-200/80 shadow-lg shadow-slate-100'
      }`}>
        {/* Ambient background glow accents */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          {/* Left Hero Title & Tagline */}
          <div className="max-w-3xl space-y-4">
            <h1 className={`text-3xl lg:text-5xl font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Intelligent Upper-Limb Rehabilitation
            </h1>

            <p className={`text-sm lg:text-base font-normal leading-relaxed max-w-2xl ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Next-generation biomechanical physical therapy powered by wearable IoT multi-sensor telemetry, 
              automated Range-of-Motion (ROM) tracking, and an interactive 3D digital-twin for upper-limb recovery.
            </p>

            {/* Quick Status Bar & Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Hardware Status Pill */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                deviceConnected
                  ? isDark ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  deviceConnected ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-amber-400 animate-pulse'
                }`} />
                <span>{deviceConnected ? 'Hardware Online: WebSocket 50Hz' : 'Simulated Hardware Telemetry'}</span>
              </div>

              {/* Active Patient Switcher */}
              <div className="relative">
                <button 
                  onClick={() => setPatientsExpanded(!patientsExpanded)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-200' 
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-sm'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span>Patient: <strong className="font-extrabold text-blue-500">{activePatientName || 'Select Patient'}</strong></span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Patient Dropdown Menu */}
                {patientsExpanded && (
                  <div className={`absolute left-0 mt-2 w-64 rounded-2xl border p-2 shadow-2xl z-40 ${
                    isDark ? 'bg-[#0E131F] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrolled Patients</span>
                      <button 
                        onClick={() => {
                          setPatientsExpanded(false);
                          handleOpenRegisterModal();
                        }}
                        className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add New
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto py-1 space-y-1">
                      {patients.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            selectPatient(p);
                            setPatientsExpanded(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition cursor-pointer ${
                            p.id === activePatientId
                              ? 'bg-blue-600 text-white font-bold'
                              : isDark ? 'hover:bg-slate-800/50 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="truncate">{p.full_name}</span>
                          <span className="text-[10px] opacity-70">{p.age}y</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                }`}
                title="Toggle Theme"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>
            </div>
          </div>

          {/* Right Hero Call-to-Actions */}
          <div className="flex flex-col sm:flex-row xl:flex-col gap-3 shrink-0">
            <button 
              onClick={() => navigate('/exercise-session')}
              className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Exercise Session</span>
            </button>

            <div className="flex gap-2">
              <button 
                onClick={() => navigate('/calibration')}
                className={`flex-1 px-4 py-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Sliders className="w-4 h-4 text-slate-400" />
                <span>Device Calibration</span>
              </button>

              <button 
                onClick={() => navigate('/exercises')}
                className={`flex-1 px-4 py-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <BookOpen className="w-4 h-4 text-slate-400" />
                <span>Exercise Library</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          SECTION 2: HOW THIS PROJECT WORKS (3 FLOW-WISE CARDS)
          =================================================== */}
      <section className="flex flex-col gap-6">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-widest">
            End-to-End Architecture
          </span>
          <h2 className={`text-2xl lg:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            How SmartPhysio Works
          </h2>
          <p className="text-xs lg:text-sm text-slate-400">
            A continuous loop connecting patient biomechanics, edge computing, and real-time clinical assessment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
          
          {/* Card 1 */}
          <div className="uiverse-parent">
            <div className="uiverse-card">
              <div className="uiverse-logo">
                <span className="circle circle1"></span>
                <span className="circle circle2"></span>
                <span className="circle circle3"></span>
                <span className="circle circle4"></span>
                <span className="circle circle5">
                  <span className="font-bold text-xs text-white">01</span>
                </span>
              </div>
              <div className="uiverse-glass"></div>
              <div className="uiverse-content">
                <span className="uiverse-title">Wearable Sensor Ingestion</span>
                <span className="uiverse-text">Flexible resistive strips, rotary goniometer, and 6-axis IMU record joint angles and muscle squeeze force simultaneously with zero restriction.</span>
              </div>
              <div className="uiverse-bottom">
                <div className="social-buttons-container">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 drop-shadow-md" />
                </div>
                <div className="view-more">
                  <span className="text-[10px] font-bold text-emerald-800">Edge Capture</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="uiverse-parent">
            <div className="uiverse-card" style={{ background: 'linear-gradient(135deg, rgb(0, 150, 255) 0%, rgb(0, 80, 255) 100%)' }}>
              <div className="uiverse-logo">
                <span className="circle circle1"></span>
                <span className="circle circle2"></span>
                <span className="circle circle3"></span>
                <span className="circle circle4"></span>
                <span className="circle circle5">
                  <span className="font-bold text-xs text-white">02</span>
                </span>
              </div>
              <div className="uiverse-glass"></div>
              <div className="uiverse-content">
                <span className="uiverse-title" style={{ color: '#004080' }}>Low-Latency WebSocket</span>
                <span className="uiverse-text" style={{ color: 'rgba(0, 64, 128, 0.8)' }}>ESP32 samples lines at 50Hz and transmits encrypted JSON telemetry packets over WebSockets to the backend in under 20ms.</span>
              </div>
              <div className="uiverse-bottom">
                <div className="social-buttons-container">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 drop-shadow-md" />
                </div>
                <div className="view-more">
                  <span className="text-[10px] font-bold text-blue-800">50Hz Stream</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="uiverse-parent">
            <div className="uiverse-card" style={{ background: 'linear-gradient(135deg, rgb(200, 50, 255) 0%, rgb(100, 0, 255) 100%)' }}>
              <div className="uiverse-logo">
                <span className="circle circle1"></span>
                <span className="circle circle2"></span>
                <span className="circle circle3"></span>
                <span className="circle circle4"></span>
                <span className="circle circle5">
                  <span className="font-bold text-xs text-white">03</span>
                </span>
              </div>
              <div className="uiverse-glass"></div>
              <div className="uiverse-content">
                <span className="uiverse-title" style={{ color: '#400080' }}>3D Digital Twin</span>
                <span className="uiverse-text" style={{ color: 'rgba(64, 0, 128, 0.8)' }}>Incoming telemetry drives the 3D anatomical GLB model. Algorithms score repetition accuracy and compare active ROM against clinical goals.</span>
              </div>
              <div className="uiverse-bottom">
                <div className="social-buttons-container">
                  <CheckCircle2 className="w-5 h-5 text-purple-500 drop-shadow-md" />
                </div>
                <div className="view-more">
                  <span className="text-[10px] font-bold text-purple-800">AI Analytics</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ===================================================
          SECTION 3: TWO-COLUMN LAYOUT
          Left: Small IoT Sensors Used | Right: 3D GLB Model
          =================================================== */}
      <div className="flex flex-col gap-3 mt-10">
        <div className="text-center max-w-2xl mx-auto space-y-1.5 mb-6">
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-widest">
            Hardware & 3D Visualization
          </span>
          <h2 className={`text-2xl lg:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            IoT Sensors & Digital Twin
          </h2>
        </div>
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: SMALL IOT SENSORS USED (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Wearable IoT Sensor Array
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time edge telemetry capturing joint kinematics and grip force
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20">
              5 Active Channels
            </span>
          </div>

          {/* Sensor Cards List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <SensorCard 
              name="MPU-6050 6-Axis IMU"
              type="imu"
              role="Wrist Pronation/Supination & Pitch"
              specs="3-Axis Gyro + Accel • I2C (0x68)"
              pin="GPIO 21 (SDA) / 22 (SCL)"
              value='Hardware Module'
              unit=''
              status={deviceConnected ? 'online' : 'streaming'}
              active={activeSensorKey === 'imu'}
              onClick={() => setActiveSensorKey('imu')}
            />

            <SensorCard 
              name="5-Finger Flex Array"
              type="flex"
              role="Finger Flexion & Grasp Dynamics"
              specs="5x 2.2-inch Resistive Strips"
              pin="ADC1 (GPIO 32, 33, 34, 35, 36)"
              value='Hardware Module'
              unit=''
              status={deviceConnected ? 'online' : 'streaming'}
              active={activeSensorKey === 'flex'}
              onClick={() => setActiveSensorKey('flex')}
            />

            <SensorCard 
              name="Elbow Goniometric Angle"
              type="elbow"
              role="Elbow Flexion & Extension (0°-180° ROM)"
              specs="Precision Rotary Potentiometer"
              pin="Analog ADC2 (GPIO 4)"
              value='Hardware Module'
              unit=''
              status={deviceConnected ? 'online' : 'streaming'}
              active={activeSensorKey === 'elbow'}
              onClick={() => setActiveSensorKey('elbow')}
            />

            <SensorCard 
              name="FSR Tactile Pressure Sensor"
              type="pressure"
              role="Palmar Grip Compression & Squeeze Force"
              specs="Force Sensitive Resistor (0.2N - 20N)"
              pin="Analog ADC1 (GPIO 39)"
              value='Hardware Module'
              unit=''
              status={deviceConnected ? 'online' : 'streaming'}
              active={activeSensorKey === 'pressure'}
              onClick={() => setActiveSensorKey('pressure')}
            />

            <SensorCard 
              name="ESP-32 IoT Edge Node"
              type="mcu"
              role="240MHz Edge Telemetry Engine"
              specs="Wi-Fi 802.11 b/g/n + BLE 4.2"
              pin="50Hz WebSocket JSON Stream"
              value='Hardware Module'
              unit=''
              status={deviceConnected ? 'online' : 'streaming'}
              active={activeSensorKey === 'mcu'}
              onClick={() => setActiveSensorKey('mcu')}
            />
          </div>

          {/* Edge Architecture Mini Card */}
          <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center p-1.5 shrink-0 border border-slate-800">
              <img 
                src="/images/esp.png" 
                alt="ESP32 IoT Node" 
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div>
              <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ESP32 Edge Microcontroller
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Runs on-device low-pass filters and transmits synchronized multi-sensor packets over WebSockets under 20ms latency.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 3D GLB MODEL VISUALIZER (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                3D Digital-Twin Kinematics
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time 3D simulation driven by IoT telemetry or interactive demo rotation
              </p>
            </div>

            {/* Auto-Rotate & Controls Header Bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRotate(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  autoRotate
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
                    : isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin-slow' : ''}`} />
                <span>{autoRotate ? 'Rotate: ON' : 'Rotate: OFF'}</span>
              </button>

              <button 
                onClick={() => initTherapistDashboard()} 
                className={`p-1.5 rounded-xl border transition cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Refresh Telemetry"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MAIN 3D GLB CANVAS CONTAINER */}
          <div className={`rounded-3xl border shadow-2xl h-[520px] relative overflow-hidden flex items-center justify-center select-none transition-all duration-300 ${
            isDark 
              ? 'bg-gradient-to-b from-[#0F141F] to-[#080B11] border-slate-800/80 text-white' 
              : 'bg-gradient-to-b from-white to-slate-100/70 border-slate-200 text-slate-800 shadow-lg'
          }`}>
            <div className="absolute inset-0">
              <Arm3DVisualizer 
                controls={activeControls} 
                cameraAngle={cameraAngle}
                autoRotate={autoRotate}
                demoMode={!deviceConnected}
              />
            </div>

            {/* Floating Top Controls: Camera View Switcher */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1.5">
              {[
                { key: 'straight', label: 'Overview' },
                { key: 'hand', label: 'Hand' },
                { key: 'elbow', label: 'Elbow' },
                { key: 'wrist', label: 'Wrist' }
              ].map((view) => (
                <button
                  key={view.key}
                  onClick={() => setCameraAngle(view.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-md border ${
                    cameraAngle === view.key
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                      : isDark
                        ? 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900/80'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            {/* Floating Top Right: Telemetry Mode Pill */}
            <div className={`absolute top-4 right-4 z-20 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border backdrop-blur-md ${
              deviceConnected
                ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-400'
                : 'bg-blue-950/60 border-blue-600/40 text-blue-400'
            }`}>
              {deviceConnected ? 'Live Telemetry' : 'Demo Kinematics'}
            </div>
          </div>

          {/* Manual Joint Sliders Control Tray (Therapist Test Mode) */}
          <div className={`p-4 rounded-2xl border transition-colors ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Kinematic Angle Test Controls
              </span>
              <button 
                onClick={() => setControls({ shoulderAngle: 0, shoulderAngleX: 0, elbowAngle: 0, wristAngle: 0 })}
                className="text-[10px] font-bold text-blue-500 hover:underline"
              >
                Reset Angles
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span>Shoulder: {controls.shoulderAngle}°</span>
                </div>
                <input 
                  type="range" 
                  min="-45" 
                  max="45" 
                  value={controls.shoulderAngle}
                  disabled={deviceConnected}
                  onChange={(e) => setControls(prev => ({ ...prev, shoulderAngle: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span>Elbow Flex: {controls.elbowAngle}°</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="140" 
                  value='Hardware Module'
                  disabled={deviceConnected}
                  onChange={(e) => setControls(prev => ({ ...prev, elbowAngle: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span>Wrist Roll: {controls.wristAngle}°</span>
                </div>
                <input 
                  type="range" 
                  min="-90" 
                  max="90" 
                  value='Hardware Module'
                  disabled={deviceConnected}
                  onChange={(e) => setControls(prev => ({ ...prev, wristAngle: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>

      {/* ===================================================
          SECTION 4: CLINICAL TELEMETRY & PATIENT RECOVERY HUB
          =================================================== */}
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Patient Clinical Overview
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Active patient rehabilitation trajectory and clinical exercise logs
            </p>
          </div>

          <button 
            onClick={handleOpenRegisterModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enroll New Patient</span>
          </button>
        </div>

        {/* Analytics Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Sessions</span>
            <span className={`text-2xl font-black mt-1 block ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {analytics?.total_sessions || sessions.length || 0}
            </span>
            <span className="text-[11px] text-emerald-500 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +12% vs last week
            </span>
          </div>

          <div className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Form Accuracy</span>
            <span className="text-2xl font-black text-blue-500 mt-1 block">
              {analytics?.average_accuracy ? `${Math.round(analytics.average_accuracy)}%` : '88.5%'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">Biofeedback Form Match</span>
          </div>

          <div className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Peak ROM Extension</span>
            <span className="text-2xl font-black text-indigo-500 mt-1 block">
              {analytics?.max_rom_angle ? `${Math.round(analytics.max_rom_angle)}°` : '142°'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">Elbow Flex Limit</span>
          </div>

          <div className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Max Grip Compression</span>
            <span className="text-2xl font-black text-amber-500 mt-1 block">
              {analytics?.peak_pressure ? `${analytics.peak_pressure} N` : '28.4 N'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">Sustained Palmar Force</span>
          </div>
        </div>

        {/* Recommended Exercises & Recent History Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recommended Exercises (5 Cols) */}
          <div className={`lg:col-span-5 p-6 rounded-3xl border flex flex-col justify-between ${
            isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Targeted Exercise Prescriptions
                </h4>
                <Link to="/exercises" className="text-xs font-bold text-blue-500 hover:underline">
                  View All
                </Link>
              </div>

              <div className="space-y-3">
                {recommendedExercises.length > 0 ? (
                  recommendedExercises.slice(0, 3).map((ex) => (
                    <div 
                      key={ex.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                        isDark ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div>
                        <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {ex.name}
                        </h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {ex.target_muscle_group || 'Upper Limb'} • {ex.target_sets || 3} sets of {ex.target_reps_per_set || 10} reps
                        </p>
                      </div>

                      <button
                        onClick={() => navigate('/exercise-session', { state: { exerciseId: ex.id } })}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>Start</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  [
                    { name: 'Elbow Flexion & Extension', target: 'Biceps / Brachialis', reps: '3 sets of 10' },
                    { name: 'Wrist Pronation / Supination', target: 'Pronator Teres', reps: '3 sets of 12' },
                    { name: 'Isometric Palmar Grip Squeeze', target: 'Finger Flexors', reps: '4 sets of 8' },
                  ].map((mock, idx) => (
                    <div 
                      key={idx}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                        isDark ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div>
                        <h5 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {mock.name}
                        </h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {mock.target} • {mock.reps}
                        </p>
                      </div>

                      <button
                        onClick={() => navigate('/exercise-session')}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>Start</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <span>Goal: <strong>{selectedPatient?.rehabilitation_goal_name || 'Range-of-Motion Recovery'}</strong></span>
              <span className="text-emerald-500 font-bold">On Schedule</span>
            </div>
          </div>

          {/* Recent Session Records (7 Cols) */}
          <div className={`lg:col-span-7 p-6 rounded-3xl border flex flex-col justify-between ${
            isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Recent Clinical Therapy Sessions
                </h4>
                <Link to="/analytics" className="text-xs font-bold text-blue-500 hover:underline">
                  Full History
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[10px] uppercase font-bold tracking-wider ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
                    }`}>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Protocol</th>
                      <th className="pb-3">Reps</th>
                      <th className="pb-3">Accuracy</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {sessions.length > 0 ? (
                      sessions.slice(0, 4).map((s) => (
                        <tr key={s.id} className="hover:bg-slate-500/5 transition">
                          <td className="py-3 font-medium text-slate-400">{formatDate(s.start_time).split(',')[0]}</td>
                          <td className="py-3 font-bold">{s.exercise_name || 'Upper Limb Routine'}</td>
                          <td className="py-3">{s.repetitions_completed} reps</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              {s.exercise_accuracy}%
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleOpenDetails(s.id)}
                              className="text-blue-500 hover:underline font-bold text-[11px] cursor-pointer"
                            >
                              Report
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                          No therapy sessions logged yet for this patient. Launch an exercise session above to stream real-time kinematics.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <span>FastAPI Backend: <strong>Connected & Active</strong></span>
              <span className="font-mono text-[10px] text-slate-500">Device ID: ESP32-PHYSIO-01</span>
            </div>
          </div>
        </div>

      </section>

      {/* QUICK PATIENT REGISTRATION MODAL */}
      {showRegisterModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
          isDark ? 'bg-slate-950/70 backdrop-blur-sm' : 'bg-slate-900/40 backdrop-blur-sm'
        }`}>
          <div className={`rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border transition-colors ${
            isDark ? 'card-neumorphic-dark text-white' : 'card-neumorphic-light text-slate-800'
          }`}>
            <div className={`px-6 py-4 border-b flex justify-between items-center ${
              isDark ? 'border-slate-850' : 'border-slate-100'
            }`}>
              <h4 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <User className="w-4 h-4 text-blue-500" />
                Add New Patient Profile
              </h4>
              <button onClick={() => setShowRegisterModal(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
              {regError && (
                <div className="p-2.5 bg-red-950/40 border border-red-900/30 text-red-400 text-xs font-semibold rounded-lg text-center">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Full Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={regForm.full_name}
                  onChange={handleRegisterInputChange}
                  placeholder="Leslie Alexander"
                  className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                    isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200 text-slate-800'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={regForm.age}
                    onChange={handleRegisterInputChange}
                    placeholder="22"
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                      isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200 text-slate-800'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Gender</label>
                  <select
                    name="gender"
                    value={regForm.gender}
                    onChange={handleRegisterInputChange}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                      isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Height (cm)</label>
                  <input
                    type="number"
                    name="height_cm"
                    value={regForm.height_cm}
                    onChange={handleRegisterInputChange}
                    placeholder="175"
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                      isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200 text-slate-800'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Weight (kg)</label>
                  <input
                    type="number"
                    name="weight_kg"
                    value={regForm.weight_kg}
                    onChange={handleRegisterInputChange}
                    placeholder="70"
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                      isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200 text-slate-800'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Dominant Hand</label>
                  <select
                    name="dominant_hand"
                    value={regForm.dominant_hand}
                    onChange={handleRegisterInputChange}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                      isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200'
                    }`}
                  >
                    <option value="Right">Right</option>
                    <option value="Left">Left</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Injured Side</label>
                  <select
                    name="injured_arm"
                    value={regForm.injured_arm}
                    onChange={handleRegisterInputChange}
                    className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                      isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200'
                    }`}
                  >
                    <option value="Left">Left Side</option>
                    <option value="Right">Right Side</option>
                    <option value="Both">Both Sides</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Affected Body Part</label>
                <select
                  name="body_part_id"
                  value={regForm.body_part_id}
                  onChange={handleRegisterInputChange}
                  className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                    isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200'
                  }`}
                  required
                >
                  <option value="">Select affected area...</option>
                  {bodyParts.map(bp => (
                    <option key={bp.id} value={bp.id}>{bp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                  Diagnosed Injury / Condition 
                  <span className="text-[8px] text-slate-400 normal-case font-normal ml-2">
                    (Select diagnosed by healthcare professional)
                  </span>
                </label>
                <select
                  name="condition_id"
                  value={regForm.condition_id}
                  onChange={handleRegisterInputChange}
                  className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                    isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200'
                  }`}
                  required
                >
                  <option value="">Select condition...</option>
                  {filteredConditions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Rehabilitation Goal</label>
                <select
                  name="rehabilitation_goal_id"
                  value={regForm.rehabilitation_goal_id}
                  onChange={handleRegisterInputChange}
                  className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                    isDark ? 'bg-[#121620] border-slate-800 text-white' : 'bg-[#F1F5F9] border-slate-200'
                  }`}
                  required
                >
                  <option value="">Select goal...</option>
                  {rehabGoals.map(g => (
                    <option key={g.id} value={g.id}>{g.goal_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="w-1/2 py-2.5 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Save Profile
                </button>
              </div>

              {/* Medical Disclaimer */}
              <div className="mt-4 p-3 bg-slate-900/30 border border-slate-800/40 rounded-xl text-[9px] text-slate-455 leading-normal">
                <span className="font-bold text-slate-400 block mb-0.5">Medical Disclaimer</span>
                SmartPhysio is an assistive monitoring tool for tracking physical therapy progress and range of motion. It does not provide medical diagnoses, treatment plans, or clinical validation. Please consult a qualified healthcare professional before beginning any routine.
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SESSION DETAILS MODAL OVERLAY */}
      {showDetailsModal && selectedSession && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:relative print:bg-white print:p-0">
          <div className={`rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border flex flex-col justify-between max-h-[90vh] print:max-h-none print:shadow-none print:border-none transition-colors duration-300 ${
            isDark ? 'card-neumorphic-dark text-white' : 'card-neumorphic-light text-slate-800'
          }`}>
            
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex justify-between items-center print:hidden ${
              isDark ? 'bg-[#09090C] border-slate-850' : 'bg-[#FFFFFF] border-slate-100'
            }`}>
              <h4 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <FileText className="w-4 h-4 text-blue-500" />
                Clinical Session Record
              </h4>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto print:overflow-visible flex-1 print:p-0">
              {/* Header inside printing sheets */}
              <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
                <h1 className="text-2xl font-extrabold text-slate-955 uppercase tracking-tight">SmartPhysio Clinical Recovery Record</h1>
                <p className="text-xs text-slate-500 font-semibold mt-1">IoT Wearable Biofeedback Joint Rehabilitation Assessment</p>
              </div>

              {/* Metadata details block */}
              <div className={`p-4 rounded-xl border grid grid-cols-2 gap-4 print:bg-transparent print:border-slate-300 print:rounded-none ${
                isDark ? 'bg-[#121620]/60 border-slate-800/40' : 'bg-[#F1F5F9]/60 border-slate-200 text-slate-800'
              }`}>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Patient Name</span>
                  <span className={`text-xs font-bold mt-0.5 block ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedSession.patient_name || activePatientName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Assessment Date</span>
                  <span className={`text-xs font-bold mt-0.5 block ${isDark ? 'text-white' : 'text-slate-800'}`}>{formatDate(selectedSession.start_time)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Exercise Protocol</span>
                  <span className="text-xs font-bold text-blue-400 mt-0.5 block">{selectedSession.exercise_name || 'Physiotherapy Routine'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Record Reference ID</span>
                  <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">{selectedSession.id}</span>
                </div>
              </div>

              <hr className={isDark ? 'border-slate-800/40 print:border-slate-300' : 'border-slate-100 print:border-slate-300'} />

              {/* Technical indicators grid */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kinematic Assessment Metrics</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-slate-300">
                  <div className={`p-4 border rounded-xl space-y-1 ${isDark ? 'border-slate-800/40 bg-[#121620]/20' : 'border-slate-200 bg-slate-50/50'}`}>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Biofeedback Accuracy</span>
                    <span className="text-2xl font-extrabold text-green-400">{selectedSession.exercise_accuracy}%</span>
                  </div>
                  <div className={`p-4 border rounded-xl space-y-1 ${isDark ? 'border-slate-800/40 bg-[#121620]/20' : 'border-slate-200 bg-slate-50/50'}`}>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Total Duration</span>
                    <span className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{formatTime(selectedSession.duration_seconds)}</span>
                  </div>
                  <div className={`p-4 border rounded-xl space-y-1 ${isDark ? 'border-slate-800/40 bg-[#121620]/20' : 'border-slate-200 bg-slate-50/50'}`}>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Completed Reps</span>
                    <span className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedSession.repetitions_completed} reps</span>
                  </div>
                  <div className={`p-4 border rounded-xl space-y-1 ${isDark ? 'border-slate-800/40 bg-[#121620]/20' : 'border-slate-200 bg-slate-50/50'}`}>
                    <span className="text-[9px] font-bold text-slate-550 uppercase block tracking-wider">Failed Reps</span>
                    <span className="text-2xl font-extrabold text-red-400">{selectedSession.repetitions_failed} reps</span>
                  </div>
                  <div className={`p-4 border rounded-xl space-y-1 ${isDark ? 'border-slate-800/40 bg-[#121620]/20' : 'border-slate-200 bg-slate-50/50'}`}>
                    <span className="text-[9px] font-bold text-slate-550 uppercase block tracking-wider">Peak ROM (Angle)</span>
                    <span className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedSession.max_angle}°</span>
                  </div>
                  <div className={`p-4 border rounded-xl space-y-1 ${isDark ? 'border-slate-800/40 bg-[#121620]/20' : 'border-slate-200 bg-slate-50/50'}`}>
                    <span className="text-[9px] font-bold text-slate-550 uppercase block tracking-wider">Avg Grip Strength</span>
                    <span className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-805'}`}>{selectedSession.average_pressure} N</span>
                  </div>
                </div>
              </div>

              {/* Biofeedback clinical observation text */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-slate-500" />
                  Clinical Observation & Assessment Guidance
                </h5>
                <div className={`border p-4 rounded-xl text-xs md:text-sm leading-relaxed print:bg-transparent print:border-slate-300 ${
                  isDark ? 'bg-blue-950/10 border-blue-900/30 text-slate-400' : 'bg-blue-50/30 border-blue-100 text-slate-700'
                }`}>
                  <p>
                    The patient successfully performed the <strong>{selectedSession.exercise_name}</strong> rehabilitation routine. 
                    The assessment logged <strong>{selectedSession.repetitions_completed}</strong> valid repetitions with a 
                    form alignment accuracy index of <strong>{selectedSession.exercise_accuracy}%</strong>. 
                    The peak range of motion (ROM) reached a flex limit of <strong>{selectedSession.max_angle}°</strong>, and the patient 
                    sustained an average muscular compression force of <strong>{selectedSession.average_pressure} N</strong>. 
                  </p>
                  <p className="mt-2 text-slate-500 italic">
                    Recommendation: Continue physical therapy trials at standard target limits. Increase repetition count as muscle extension tolerances permit.
                  </p>
                </div>
              </div>

              {/* Printer signature lines */}
              <div className="hidden print:grid grid-cols-2 gap-10 pt-20 mt-16 text-xs font-bold">
                <div className="border-t border-slate-900 pt-3 text-center">
                  Patient Signature / Date
                </div>
                <div className="border-t border-slate-900 pt-3 text-center">
                  Therapist Clinical Endorsement / Date
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 print:hidden ${
              isDark ? 'bg-[#09090C] border-slate-850' : 'bg-[#FFFFFF] border-slate-100'
            }`}>
              <button 
                type="button" 
                onClick={() => setShowDetailsModal(false)}
                className={`px-4 py-2 border text-xs font-bold rounded-xl transition cursor-pointer ${
                  isDark ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-205 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Close Window
              </button>
              <button 
                type="button" 
                onClick={handlePrintReport}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Print Clinical Report
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Dynamic Printing-only Container Wrapper */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:relative, .print\\:relative * {
            visibility: visible;
          }
          .print\\:relative {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          header, aside, main > *:not(.fixed) {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default DashboardPage;
