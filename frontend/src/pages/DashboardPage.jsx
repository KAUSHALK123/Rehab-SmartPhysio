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
  SlidersHorizontal
} from 'lucide-react';
import { getSessionHistory, getSessionDetails } from '../services/session';
import { getDashboardAnalytics } from '../services/analytics';
import { getPatients, createPatient, getBodyParts, getConditions, getRehabilitationGoals, getRecommendedExercises } from '../services/patient';
import apiClient from '../services/auth';
import Arm3DVisualizer from '../components/Arm3DVisualizer';

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
  const [controls, setControls] = useState({
    shoulderAngle: 0,
    shoulderAngleX: 0,
    elbowAngle: 0,
    wristAngle: 0
  });

  const activeControls = liveTelemetry
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
  }, []);

  useEffect(() => {
    const getWsUrl = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return import.meta.env.VITE_WS_URL || `${protocol}//${host}/api/v1/device/ws`;
    };
    const ws = new WebSocket(getWsUrl());
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'status_update' && data.status === 'hardware_status_changed') {
        setDeviceConnected(data.hardware_connected);
      }
      if (data.type === 'sensor_data') {
        setLiveTelemetry(data);
        if (!data.is_mock) {
          setDeviceConnected(true);
        }
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

  return (
    <div className={`min-h-screen -m-8 p-6 flex flex-col xl:flex-row gap-6 font-sans select-none overflow-x-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#050505] text-[#E2E8F0]' : 'bg-[#F8FAFC] text-[#1E293B]'
    }`}>
      
      {/* ===================================================
          COLUMN 1: LEFT SIDEBAR PANEL
          =================================================== */}
      <div className={`w-full xl:w-72 flex flex-col gap-6 shrink-0 rounded-3xl border p-5 shadow-2xl transition-colors duration-300 ${
        isDark ? 'card-neumorphic-dark text-white' : 'card-neumorphic-light text-slate-800'
      }`}>
        
        {/* Compact Unified Patient profile list card */}
        <div className={`rounded-2xl border p-4 shadow-lg transition-colors duration-300 ${
          isDark ? 'card-neumorphic-dark text-white' : 'card-neumorphic-light text-slate-800'
        }`}>
          {/* Active Patient info row */}
          <div className="flex items-center justify-between py-1 relative">
            <div 
              onClick={() => setPatientsExpanded(!patientsExpanded)}
              className="flex items-center gap-3 cursor-pointer select-none group"
            >
              {/* Round Avatar Container */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden border transition-colors ${
                isDark ? 'bg-slate-800 border-slate-750 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                {selectedPatient ? selectedPatient.full_name[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h4 className={`font-bold text-xs tracking-wide truncate max-w-[110px] transition-colors ${
                    isDark ? 'text-white' : 'text-slate-800'
                  }`}>{selectedPatient ? selectedPatient.full_name : 'No Patient'}</h4>
                  {patients.length > 1 && (
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                      patientsExpanded ? 'rotate-90' : ''
                    }`} />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{selectedPatient ? `${selectedPatient.age} years` : '0 years'}</p>
              </div>
            </div>
            
            <button 
              onClick={handleOpenRegisterModal}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-blue-500 border transition cursor-pointer ${
                isDark ? 'bg-[#09090C] border-slate-800 hover:bg-slate-800' : 'bg-[#FFFFFF] border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Expandable alternative patients selection panel */}
          {patientsExpanded && patients.length > 1 && (
            <div className="pt-3 mt-3 border-t border-slate-800/20 space-y-2 max-h-[190px] overflow-y-auto pr-1">
              {patients.filter(p => p.id !== activePatientId).map((pat) => (
                <button
                  key={pat.id}
                  onClick={() => {
                    selectPatient(pat);
                    setPatientsExpanded(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl transition text-left cursor-pointer group ${
                    isDark ? 'hover:bg-slate-800/25' : 'hover:bg-slate-200/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                      isDark ? 'bg-slate-800/80 border-slate-700/30 text-slate-400' : 'bg-slate-200/80 border-slate-300 text-slate-600'
                    }`}>
                      {pat.full_name[0].toUpperCase()}
                    </div>
                    <div>
                      <span className={`text-[11px] font-bold block truncate max-w-[110px] transition ${
                        isDark ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-955'
                      }`}>{pat.full_name}</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">{pat.age} years</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedPatient && (
            <div className="mt-3 pt-3 border-t border-slate-800/10 space-y-1.5 text-[10px] font-semibold">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500">Condition:</span>
                <span className="text-blue-500 truncate max-w-[130px] text-right" title={selectedPatient.condition_name || selectedPatient.injury_type}>
                  {selectedPatient.condition_name || selectedPatient.injury_type || "Not Specified"}
                </span>
              </div>
              {selectedPatient.body_part_name && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Body Part:</span>
                  <span className="text-slate-400 text-right">{selectedPatient.body_part_name}</span>
                </div>
              )}
              {selectedPatient.rehabilitation_goal_name && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Goal:</span>
                  <span className="text-emerald-500 truncate max-w-[150px] text-right" title={selectedPatient.rehabilitation_goal_name}>
                    {selectedPatient.rehabilitation_goal_name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Sidebar List */}
        <div className="flex flex-col gap-1.5 mt-2">
          
          {/* General navigation links */}
          <Link to="/dashboard" className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-bold ${
            isDark ? 'text-slate-400 hover:bg-slate-900/40 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <Home className="w-4 h-4" />
              <span>Homepage</span>
            </div>
          </Link>

          <Link to="/patient" className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-blue-600 text-white transition text-xs font-bold shadow-md shadow-blue-600/10 relative">
            {/* Sidebar indicator blue dot/chevron mockup tick on the left */}
            <div className="absolute left-[-16px] top-1/2 -translate-y-1/2 w-2.5 h-6 bg-blue-600 rounded-r-lg"></div>
            <div className="flex items-center gap-3.5">
              <Users className="w-4 h-4" />
              <span>Patients</span>
            </div>
            <Plus className="w-3.5 h-3.5 opacity-90" />
          </Link>

          <Link to="/analytics" className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-bold ${
            isDark ? 'text-slate-400 hover:bg-slate-900/40 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <TrendingUp className="w-4 h-4" />
              <span>Analytics</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-blue-900 border border-blue-800 text-blue-400 text-[8px] font-bold tracking-wider">PRO+</span>
          </Link>

          {/* Overview Section Header */}
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-3 mt-4 mb-1 block">Overview</span>

          <Link to="/messages" className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-bold ${
            isDark ? 'text-slate-400 hover:bg-slate-900/40 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <MessageSquare className="w-4 h-4" />
              <span>Messages</span>
            </div>
          </Link>

          <Link to="/appointments" className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-bold ${
            isDark ? 'text-slate-400 hover:bg-slate-900/40 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <Calendar className="w-4 h-4" />
              <span>Appointments</span>
            </div>
          </Link>

          <Link to="/reports" className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-bold ${
            isDark ? 'text-slate-400 hover:bg-slate-900/40 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <FileText className="w-4 h-4" />
              <span>Reports</span>
            </div>
          </Link>

          {/* General Section Header */}
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-3 mt-4 mb-1 block">General</span>

          <Link to="/settings" className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-bold ${
            isDark ? 'text-slate-400 hover:bg-slate-900/40 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </div>
          </Link>

          <Link to="/dashboard" className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-bold ${
            isDark ? 'text-slate-400 hover:bg-slate-900/40 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          }`}>
            <div className="flex items-center gap-3.5">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </div>
          </Link>

        </div>
      </div>

      {/* ===================================================
          COLUMN 2: MIDDLE KINEMATICS OVERVIEW & TESTS
          =================================================== */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Dashboard Title & Overview Header */}
        <div className="flex justify-between items-center px-1">
          <div>
            <h2 className={`text-2xl font-bold tracking-tight transition-colors ${isDark ? 'text-white' : 'text-slate-800'}`}>Kinematics Overview</h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              Finished analyzing: 
              <button onClick={initTherapistDashboard} className="text-blue-500 hover:underline flex items-center gap-1 font-semibold">
                Retry <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" />
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`p-2 rounded-xl border transition cursor-pointer ${
              isDark ? 'bg-[#121620] border-slate-900/10 text-slate-400 hover:text-white' : 'bg-[#FFFFFF] border-slate-200 text-slate-600 hover:text-slate-900'
            }`}>
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button 
              onClick={() => navigate('/device-calibration')}
              className="text-xs bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full font-bold text-white flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/10"
            >
              <span className={`w-2 h-2 rounded-full ${deviceConnected ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_#EF4444]'}`}></span>
              {deviceConnected ? 'Calibration Link' : 'Establish Link'}
            </button>
          </div>
        </div>

        {/* MAIN HOLOGRAPHIC ARM VISUALIZER CARD */}
        <div className={`rounded-3xl border shadow-2xl h-[470px] relative overflow-hidden flex items-center justify-center select-none transition-colors duration-300 ${
          isDark ? 'card-neumorphic-dark text-white' : 'card-neumorphic-light text-slate-800'
        }`}>
          {/* 3D Visualizer Canvas component container */}
          <div className="absolute inset-0">
            <Arm3DVisualizer controls={activeControls} cameraAngle={cameraAngle} />
          </div>

          {/* Camera View selector */}
          <div className="absolute top-4 left-56 z-20">
            <button
              onClick={() => setShowCamDropdown(prev => !prev)}
              className={`flex items-center gap-1.5 backdrop-blur border text-xs font-bold rounded-xl p-2.5 px-3 transition-all cursor-pointer shadow-sm ${
                isDark 
                  ? 'bg-slate-950/85 border-slate-800 hover:border-slate-700 text-slate-200' 
                  : 'bg-white/85 border-slate-200 hover:border-slate-300 text-slate-800'
              }`}
            >
              <span>View:</span>
              <span className="text-blue-500 capitalize">{cameraAngle === 'straight' ? 'straight' : cameraAngle}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showCamDropdown && (
              <div className={`absolute top-full left-0 mt-1.5 w-36 border rounded-xl overflow-hidden z-30 shadow-xl ${
                isDark 
                  ? 'bg-slate-950/95 border-slate-800 text-slate-200' 
                  : 'bg-white/95 border-slate-200 text-slate-800'
              }`}>
                {[
                  { key: 'straight', label: 'Straight View' },
                  { key: 'side', label: 'Side View' },
                  { key: 'hand', label: '✋ Hand View' },
                  { key: 'hand_side', label: '✋ Hand Side' },
                  { key: 'elbow', label: '💪 Elbow View' },
                  { key: 'wrist', label: '⌚ Wrist View' }
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setCameraAngle(item.key);
                      setShowCamDropdown(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-[11px] font-semibold transition hover:bg-slate-500/10 cursor-pointer ${
                      cameraAngle === item.key ? 'text-blue-500 bg-blue-500/5' : ''
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sliders Control Panel Overlay */}
          <div className={`absolute top-4 left-4 z-20 border p-4 rounded-2xl w-48 text-left shadow-2xl backdrop-blur-md ${
            isDark ? 'card-neumorphic-dark-nested text-white' : 'bg-white/85 border-slate-200 text-slate-800'
          }`}>
            <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider block mb-3">Joint Calibration</span>
            
            <div className="space-y-2.5">
              {/* Shoulder Angle */}
              <div>
                <div className="flex justify-between text-[9px] font-semibold text-slate-400 mb-0.5">
                  <span>Shoulder (Forward/Back)</span>
                  <span>{Math.round(activeControls.shoulderAngle)}°</span>
                </div>
                <input 
                  type="range" 
                  min="-90" 
                  max="90" 
                  value={controls.shoulderAngle} 
                  onChange={(e) => setControls(prev => ({ ...prev, shoulderAngle: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Shoulder Angle X */}
              <div>
                <div className="flex justify-between text-[9px] font-semibold text-slate-400 mb-0.5">
                  <span>Shoulder (Side/Twist)</span>
                  <span>{Math.round(activeControls.shoulderAngleX)}°</span>
                </div>
                <input 
                  type="range" 
                  min="-90" 
                  max="90" 
                  value={controls.shoulderAngleX} 
                  onChange={(e) => setControls(prev => ({ ...prev, shoulderAngleX: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Elbow Angle */}
              <div>
                <div className="flex justify-between text-[9px] font-semibold text-slate-400 mb-0.5">
                  <span>Elbow Angle</span>
                  <span>{Math.round(activeControls.elbowAngle)}°</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="135" 
                  value={controls.elbowAngle} 
                  disabled={deviceConnected}
                  onChange={(e) => setControls(prev => ({ ...prev, elbowAngle: parseInt(e.target.value) }))}
                  className={`w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 ${deviceConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* Wrist Angle */}
              <div>
                <div className="flex justify-between text-[9px] font-semibold text-slate-400 mb-0.5">
                  <span>Wrist Angle</span>
                  <span>{Math.round(activeControls.wristAngle)}°</span>
                </div>
                <input 
                  type="range" 
                  min="-90" 
                  max="90" 
                  value={controls.wristAngle} 
                  disabled={deviceConnected}
                  onChange={(e) => setControls(prev => ({ ...prev, wristAngle: parseInt(e.target.value) }))}
                  className={`w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 ${deviceConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {deviceConnected && (
              <div className="mt-3 pt-2 border-t border-slate-700/20 flex items-center justify-between text-[8px] text-emerald-400 font-bold tracking-wider uppercase animate-pulse">
                <span>Telemetry Active</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>
            )}
          </div>

          {/* DYNAMIC HUD STATISTIC FLOATING OVERLAYS */}
          
          {/* Card Overlay 1: Elbow Flex Cluster */}
          <div className={`absolute top-4 right-4 border p-3 rounded-xl text-left shadow-2xl backdrop-blur-md max-w-[125px] transition hover:scale-105 z-10 ${
            isDark ? 'card-neumorphic-dark-nested text-white' : 'bg-white/95 border-slate-200 text-slate-800'
          }`}>
            <span className="text-[12px] font-bold block">Flex Joint</span>
            <span className="text-[8px] text-slate-500 mt-0.5 block">Elbow Flexion</span>
          </div>

          {/* Card Overlay 2: ROM Active Degrees */}
          <div className={`absolute bottom-4 left-4 border p-3 rounded-xl text-left shadow-2xl backdrop-blur-md min-w-[110px] transition hover:scale-105 z-10 ${
            isDark ? 'card-neumorphic-dark-nested text-white' : 'bg-white/95 border-slate-200 text-slate-800'
          }`}>
            <span className="text-xl font-extrabold block">
              {deviceConnected && liveTelemetry ? `${Math.round(180 - liveTelemetry.elbow)}°` : '18°'}
            </span>
            <span className="text-[8px] text-slate-500 mt-0.5 block leading-normal">ROM Active Flexion<br/>Angle Extension</span>
          </div>

          {/* Card Overlay 3: Peak Grip Compression Force */}
          <div className={`absolute bottom-4 right-4 border p-3 rounded-xl text-left shadow-2xl backdrop-blur-md min-w-[110px] transition hover:scale-105 z-10 ${
            isDark ? 'card-neumorphic-dark-nested text-white' : 'bg-white/95 border-slate-200 text-slate-800'
          }`}>
            <span className="text-xl font-extrabold block">
              {deviceConnected && liveTelemetry ? `${(liveTelemetry.pressure / 10).toFixed(1)}` : '23.3'}
            </span>
            <span className="text-[8px] text-slate-500 mt-0.5 block leading-normal">Newtons Peak Force<br/>Muscular Squeeze</span>
          </div>
        </div>

      </div>

      {/* ===================================================
          COLUMN 3: RIGHT PANEL (SUPPLEMENTS & CLINICAL SCHEDULE)
          =================================================== */}
      <div className={`w-full xl:w-80 flex flex-col gap-6 shrink-0 rounded-3xl border p-5 shadow-2xl transition-colors duration-300 ${
        isDark ? 'card-neumorphic-dark text-white' : 'card-neumorphic-light text-slate-800'
      }`}>
        
        {/* Toggle Slider Header */}
        <div className={`flex justify-between items-center pb-2 border-b ${
          isDark ? 'border-slate-900/10' : 'border-slate-100'
        }`}>
          {/* Custom Theme Toggle Switch */}
          <div className="theme-toggle-wrapper">
            <label className="switch">
              <input 
                type="checkbox" 
                className="togglesw" 
                checked={isDark} 
                onChange={() => toggleTheme()} 
              />
              <div className="indicator left"></div>
              <div className="indicator right"></div>
              <div className="btn"></div>
            </label>
          </div>
        </div>

        {/* Supplements Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Supplements</h4>
              <p className="text-[9px] text-slate-500 font-semibold mt-0.5">3 suggested supplements</p>
            </div>
            <button className={`p-1 rounded-full border transition ${
              isDark ? 'bg-[#121620] border-slate-900/10 text-slate-400' : 'bg-[#F1F5F9] border-slate-200 text-slate-600'
            }`}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {supplements.map((supp) => (
              <div key={supp.count} className={`border rounded-2xl p-3 flex justify-between items-center transition hover:border-slate-800 ${
                isDark ? 'card-neumorphic-dark-nested text-white' : 'bg-[#F1F5F9]/90 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 shadow-inner ${
                    isDark ? 'bg-[#09090C] border-slate-900/10 text-blue-500' : 'bg-white border-slate-200 text-blue-600'
                  }`}>
                    {supp.count}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold block">{supp.name}</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5 max-w-[120px] truncate">{supp.desc}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-slate-850 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                  }`}>{supp.dose}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar Intake checklist Schedule */}
        <div className={`space-y-4 flex-1 flex flex-col justify-between pt-2 border-t ${
          isDark ? 'border-slate-905' : 'border-slate-100'
        }`}>
          
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
              <ChevronLeft className="w-3 h-3 text-slate-500 cursor-pointer" />
              October, 2023
              <ChevronRight className="w-3 h-3 text-slate-500 cursor-pointer" />
            </span>
            <div className="flex gap-1">
              <button className={`w-6 h-6 rounded-full border flex items-center justify-center transition ${
                isDark ? 'bg-[#121620] border-slate-900/10 text-slate-400 hover:text-white' : 'bg-[#F1F5F9] border-slate-200 text-slate-500 hover:text-slate-900'
              }`}>
                <Calendar className="w-3 h-3" />
              </button>
              <button className={`text-[9px] font-bold border px-2 py-0.5 rounded-md transition flex items-center gap-1 ${
                isDark ? 'bg-[#121620] border-slate-900/10 hover:bg-slate-850 text-white' : 'bg-[#F1F5F9] border-slate-200 hover:bg-slate-200 text-slate-700'
              }`}>
                Filter
              </button>
            </div>
          </div>

          {/* Calendar week layout */}
          <div className={`grid grid-cols-5 gap-1 text-center py-2 border-y ${
            isDark ? 'border-slate-900/10' : 'border-slate-150'
          }`}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => {
              const isWed = day === 'Wed';
              return (
                <div key={day} className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 block">{day.slice(0, 1)}</span>
                  <span className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center mx-auto transition ${
                    isWed ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-950')
                  }`}>{isWed ? '4' : isWed ? '1' : day === 'Mon' ? '3' : day === 'Tue' ? '12' : day === 'Thu' ? '5' : '6'}</span>
                </div>
              );
            })}
          </div>

          {/* Timeline schedule intake rows with vertical indicators */}
          <div className="space-y-4 relative pl-4 mt-2 flex-1 overflow-y-auto max-h-[220px]">
            {/* Active connecting line mockup */}
            <div className={`absolute left-1.5 top-2 bottom-2 w-[1.5px] ${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}></div>
            
            {/* Wed Intake Item 1 */}
            <div className="flex items-center justify-between text-xs relative">
              <div className={`absolute left-[-16px] w-2.5 h-2.5 rounded-full border-2 ${
                isDark ? 'bg-blue-600 border-[#09090C]' : 'bg-blue-600 border-[#FFFFFF]'
              }`}></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>3</span>
                  <span className="text-[9px] text-slate-500">2:00 PM</span>
                </div>
                <span className={`text-[10px] block font-semibold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Vitamin E &bull; 1 pill</span>
              </div>
              <button className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 cursor-pointer">
                <Check className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Wed Intake Item 2 */}
            <div className="flex items-center justify-between text-xs relative mt-3">
              <div className={`absolute left-[-16px] w-2.5 h-2.5 rounded-full border-2 ${
                isDark ? 'bg-blue-600 border-[#09090C]' : 'bg-blue-600 border-[#FFFFFF]'
              }`}></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>4</span>
                  <span className="text-[9px] text-slate-500">4:00 PM</span>
                </div>
                <span className={`text-[10px] block font-semibold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Iron Capsule &bull; 1 pill</span>
              </div>
              <button className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 cursor-pointer">
                <Check className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Fri Intake Item 3 */}
            <div className="flex items-center justify-between text-xs relative mt-3">
              <div className={`absolute left-[-16px] w-2.5 h-2.5 rounded-full border-2 ${
                isDark ? 'bg-slate-800 border-[#09090C]' : 'bg-slate-200 border-[#FFFFFF]'
              }`}></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>16</span>
                  <span className="text-[9px] text-slate-550">4:00 PM</span>
                </div>
                <span className={`text-[10px] block font-semibold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Vitamin C &bull; 2 pills</span>
              </div>
              <button className="w-4 h-4 rounded-full border border-slate-700 hover:border-blue-500 flex items-center justify-center text-transparent hover:text-blue-500 transition shrink-0 cursor-pointer">
                <Check className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>

      </div>

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
