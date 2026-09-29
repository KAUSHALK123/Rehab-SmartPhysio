import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  Award, 
  Activity, 
  ShieldAlert, 
  Heart, 
  RefreshCw,
  Sliders,
  ChevronRight,
  Calendar,
  CheckCircle,
  AlertCircle,
  Users,
  UserCheck
} from 'lucide-react';
import { getDashboardAnalytics } from '../services/analytics';
import { getPatients } from '../services/patient';
import { useTheme } from '../context/ThemeContext';
import PatientExerciseStreakCalendar from '../components/PatientExerciseStreakCalendar';

function AnalyticsPage() {
  const { isDark } = useTheme();
  const [activePatientId, setActivePatientId] = useState(
    () => localStorage.getItem('activePatientId') || ''
  );
  const [activePatientName, setActivePatientName] = useState(
    () => localStorage.getItem('activePatientName') || ''
  );
  const [patientList, setPatientList] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Load available patients for switching
  useEffect(() => {
    let isMounted = true;
    const loadPatients = async () => {
      try {
        setLoadingPatients(true);
        const data = await getPatients();
        if (isMounted && Array.isArray(data)) {
          setPatientList(data);
          if (activePatientId) {
            const match = data.find((p) => p.id === activePatientId);
            if (match && match.full_name !== activePatientName) {
              setActivePatientName(match.full_name);
              localStorage.setItem('activePatientName', match.full_name);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load patient list for analytics switcher:', err);
      } finally {
        if (isMounted) setLoadingPatients(false);
      }
    };
    loadPatients();
    return () => { isMounted = false; };
  }, []);

  // Sync if patient changed from another tab or window
  useEffect(() => {
    const handleSync = () => {
      const storedId = localStorage.getItem('activePatientId') || '';
      const storedName = localStorage.getItem('activePatientName') || '';
      if (storedId !== activePatientId) {
        setActivePatientId(storedId);
        setActivePatientName(storedName);
      }
    };
    window.addEventListener('patientChange', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('patientChange', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [activePatientId]);

  const handleSwitchPatient = (patient) => {
    if (!patient || patient.id === activePatientId) return;
    localStorage.setItem('activePatientId', patient.id);
    localStorage.setItem('activePatientName', patient.full_name);
    setActivePatientId(patient.id);
    setActivePatientName(patient.full_name);
    window.dispatchEvent(new Event('patientChange'));
  };

  const fetchAnalytics = async () => {
    if (!activePatientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getDashboardAnalytics(activePatientId);
      setAnalytics(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load rehabilitation analytics. Please verify backend connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [activePatientId]);

  // Helper formats seconds to readable string
  const formatTotalTime = (totalSecs) => {
    if (!totalSecs) return '0m';
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Helper format iso timestamp
  const formatDate = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Patient Guard Alert Header */}
      {!activePatientId ? (
        <div className={`border p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-200 ${
          isDark 
            ? 'bg-amber-950/30 border-amber-900/60 text-amber-200' 
            : 'bg-gradient-to-r from-amber-50 to-orange-50/70 border-amber-200 text-slate-800'
        }`}>
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className={`font-bold text-sm md:text-base ${isDark ? 'text-amber-200' : 'text-slate-800'}`}>Active Patient Profile Required</h4>
              <p className={`text-xs md:text-sm ${isDark ? 'text-amber-300/80' : 'text-slate-600'}`}>
                You must select or create a patient profile before displaying historical rehabilitation metrics.
              </p>
            </div>
          </div>
          <Link 
            to="/patient" 
            className="px-5 py-2.5 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-sm shadow-amber-100"
          >
            Go to Patient Profiles
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors duration-200 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-primary'}`}>
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Rehabilitation Recovery Progress</h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Track clinical flexibility improvements, grip force output, and movement accuracy profiles for patient:{' '}
                  <span className="font-extrabold" style={{ color: "var(--theme-accent, #10b981)" }}>{activePatientName}</span>
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Switchable Patient Selector Dropdown */}
              {patientList.length > 0 && (
                <div 
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold shadow-inner transition"
                  style={{
                    backgroundColor: isDark ? 'var(--theme-bg-elevated, #14151a)' : '#f8fafc',
                    borderColor: isDark ? 'var(--theme-border-main, rgba(255,255,255,0.1))' : '#e2e8f0'
                  }}
                >
                  <UserCheck className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--theme-accent, #10b981)' }} />
                  <span className={`text-[11px] uppercase tracking-wider font-extrabold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Patient:</span>
                  <select
                    value={activePatientId}
                    onChange={(e) => {
                      const chosen = patientList.find((p) => p.id === e.target.value);
                      if (chosen) handleSwitchPatient(chosen);
                    }}
                    className="bg-transparent font-extrabold text-xs outline-none cursor-pointer pr-1"
                    style={{
                      color: isDark ? '#ffffff' : '#0f172a'
                    }}
                  >
                    {patientList.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        {p.full_name} {p.injury_type ? `• ${p.injury_type}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                onClick={fetchAnalytics}
                className={`p-2.5 border rounded-xl transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                  isDark 
                    ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Data
              </button>
            </div>
          </div>

          {/* Quick Horizontal Patient Switcher Chips */}
          {patientList.length > 1 && (
            <div 
              className="p-3 px-4 rounded-2xl border flex items-center gap-2 overflow-x-auto transition-colors"
              style={{
                backgroundColor: isDark ? 'var(--theme-bg-card, #0c0d10)' : '#ffffff',
                borderColor: isDark ? 'var(--theme-border-main, rgba(255,255,255,0.08))' : '#e2e8f0'
              }}
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 whitespace-nowrap mr-2">
                <Users className="w-3.5 h-3.5" style={{ color: 'var(--theme-accent, #10b981)' }} />
                Patients:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                {patientList.map((p) => {
                  const isSelected = p.id === activePatientId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSwitchPatient(p)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                        isSelected
                          ? 'text-white shadow-sm'
                          : isDark 
                            ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      style={isSelected ? {
                        backgroundColor: 'var(--theme-accent, #10b981)',
                        borderColor: 'var(--theme-accent, #10b981)',
                        boxShadow: '0 0 12px var(--theme-accent-glow, rgba(16, 185, 129, 0.35))'
                      } : {}}
                    >
                      <span>{p.full_name}</span>
                      {p.injury_type && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                          isSelected ? 'bg-black/25 text-white' : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200/80 text-slate-600'
                        }`}>
                          {p.injury_type}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Analytics Content */}
      {activePatientId && (
        <>
          {loading ? (
            <div className={`flex flex-col items-center justify-center py-20 space-y-4 rounded-2xl border transition-colors duration-200 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Calculating aggregates & compiling history charts...</p>
            </div>
          ) : !analytics || analytics.total_sessions === 0 ? (
            <div className={`border p-16 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-6 transition-colors duration-200 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--theme-accent, #10b981)" }}>
                <Activity className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>No Assessment Sessions Logged</h4>
                <p className={`text-sm max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Patient "{activePatientName}" has not completed any physiotherapy exercise sessions yet. Run an exercise session from the library to populate analytics.
                </p>
              </div>
              <Link 
                to="/exercises"
                style={{ backgroundColor: "var(--theme-accent, #10b981)", boxShadow: "0 0 20px var(--theme-accent-glow, rgba(16,185,129,0.25))" }}
                className="px-6 py-3 text-white font-semibold rounded-xl hover:opacity-90 transition inline-block text-sm cursor-pointer"
              >
                Go to Exercise Library
              </Link>
            </div>
          ) : (
            <>
              {/* Stats HUD Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Accuracy HUD */}
                <div className={`p-6 rounded-2xl border shadow-sm space-y-4 transition-colors duration-200 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exercise Accuracy</h3>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{analytics.average_accuracy}%</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Average form correctness target</p>
                  </div>
                </div>

                {/* ROM HUD */}
                <div className={`p-6 rounded-2xl border shadow-sm space-y-4 transition-colors duration-200 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Peak Joint ROM</h3>
                    <Sliders className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{analytics.max_range_of_motion}°</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Maximum extension angle recorded</p>
                  </div>
                </div>

                {/* Grip Strength HUD */}
                <div className={`p-6 rounded-2xl border shadow-sm space-y-4 transition-colors duration-200 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grip Force output</h3>
                    <Heart className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <p className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{analytics.average_grip_strength} N</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Average force applied (flexion)</p>
                  </div>
                </div>

                {/* Duration HUD */}
                <div className={`p-6 rounded-2xl border shadow-sm space-y-4 transition-colors duration-200 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Therapy Time</h3>
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{formatTotalTime(analytics.total_duration_seconds)}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aggregated session duration ({analytics.total_sessions} runs)</p>
                  </div>
                </div>

              </div>

              {/* Patient Daily Exercise Streak & Activity Tree Card (GitHub Contribution Style) */}
              <PatientExerciseStreakCalendar 
                history={analytics.history} 
                patientName={activePatientName} 
              />

              {/* Progress Graphs Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* ROM Curve */}
                <div className={`p-6 rounded-2xl border shadow-sm space-y-4 transition-colors duration-200 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <h4 className={`font-bold text-sm md:text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    Range of Motion (ROM) Flexibility Trend
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                        <XAxis dataKey="date" tickFormatter={(t) => t.substring(5, 10)} stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={10} />
                        <YAxis domain={[0, 180]} stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={10} />
                        <Tooltip labelFormatter={(t) => formatDate(t)} contentStyle={isDark ? { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' } : {}} />
                        <Legend />
                        <Line type="monotone" name="Peak Angle (°)" dataKey="max_angle" stroke="#4f46e5" strokeWidth={2.5} activeDot={{ r: 6 }} />
                        <Line type="monotone" name="Avg Angle (°)" dataKey="average_angle" stroke="#818cf8" strokeWidth={1.5} strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Grip Strength Curve */}
                <div className={`p-6 rounded-2xl border shadow-sm space-y-4 transition-colors duration-200 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <h4 className={`font-bold text-sm md:text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <Heart className="w-4 h-4 text-pink-500" />
                    Grip Strength Improvement Trend
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                        <XAxis dataKey="date" tickFormatter={(t) => t.substring(5, 10)} stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={10} />
                        <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={10} />
                        <Tooltip labelFormatter={(t) => formatDate(t)} contentStyle={isDark ? { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' } : {}} />
                        <Legend />
                        <Line type="monotone" name="Avg Grip Force (N)" dataKey="average_pressure" stroke="#ec4899" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Form Accuracy Curve */}
                <div className={`p-6 rounded-2xl border shadow-sm space-y-4 lg:col-span-2 transition-colors duration-200 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <h4 className={`font-bold text-sm md:text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <Activity className="w-4 h-4 text-green-500" />
                    Rehabilitation Form Accuracy Progression
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                        <XAxis dataKey="date" tickFormatter={(t) => t.substring(5, 10)} stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={10} />
                        <YAxis domain={[0, 100]} stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={10} />
                        <Tooltip labelFormatter={(t) => formatDate(t)} contentStyle={isDark ? { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' } : {}} />
                        <Legend />
                        <Line type="monotone" name="Exercise Accuracy (%)" dataKey="exercise_accuracy" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* History Table */}
              <div className={`rounded-2xl border shadow-sm overflow-hidden space-y-4 p-6 transition-colors duration-200 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Calendar className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  <h4 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Recent Rehabilitation Sessions Log</h4>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className={`border-b text-xs font-bold uppercase tracking-wider ${
                        isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-400'
                      }`}>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Exercise Name</th>
                        <th className="py-3 px-4">Completed Reps</th>
                        <th className="py-3 px-4">Avg Angle</th>
                        <th className="py-3 px-4">Avg Grip Force</th>
                        <th className="py-3 px-4">Accuracy</th>
                        <th className="py-3 px-4">Duration</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-semibold text-xs md:text-sm ${
                      isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'
                    }`}>
                      {[...analytics.history].reverse().slice(0, 8).map((session, idx) => (
                        <tr key={idx} className={`transition ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                          <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {formatDate(session.date)}
                          </td>
                          <td className={`py-3.5 px-4 font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {session.exercise_name}
                          </td>
                          <td className="py-3.5 px-4">
                            {session.repetitions_completed} reps <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>({session.repetitions_failed} failed)</span>
                          </td>
                          <td className="py-3.5 px-4">
                            {session.average_angle}°
                          </td>
                          <td className="py-3.5 px-4">
                            {session.average_pressure} N
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                              session.exercise_accuracy >= 80 
                                ? (isDark ? 'bg-green-950/60 text-green-400 border border-green-800/60' : 'bg-green-50 text-green-600 border border-green-150')
                                : (isDark ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60' : 'bg-amber-50 text-amber-600 border border-amber-150')
                            }`}>
                              {session.exercise_accuracy}%
                            </span>
                          </td>
                          <td className={`py-3.5 px-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {formatTotalTime(session.duration_seconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default AnalyticsPage;
