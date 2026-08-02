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
  AlertCircle
} from 'lucide-react';
import { getDashboardAnalytics } from '../services/analytics';

function AnalyticsPage() {
  const activePatientId = localStorage.getItem('activePatientId') || '';
  const activePatientName = localStorage.getItem('activePatientName') || '';

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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
        <div className="bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm md:text-base">Active Patient Profile Required</h4>
              <p className="text-xs md:text-sm text-slate-600">
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Rehabilitation Recovery Progress</h3>
              <p className="text-sm text-slate-500">
                Track clinical flexibility improvements, grip force output, and movement accuracy profiles for patient:{' '}
                <span className="text-primary font-bold">{activePatientName}</span>
              </p>
            </div>
          </div>
          
          <button 
            onClick={fetchAnalytics}
            className="p-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      )}

      {/* Main Analytics Content */}
      {activePatientId && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-semibold text-slate-500">Calculating aggregates & compiling history charts...</p>
            </div>
          ) : !analytics || analytics.total_sessions === 0 ? (
            <div className="bg-white border border-slate-200 p-16 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-6">
              <div className="w-16 h-16 rounded-full bg-blue-50/50 flex items-center justify-center mx-auto text-primary animate-pulse">
                <Activity className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-slate-800">No Assessment Sessions Logged</h4>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Patient "{activePatientName}" has not completed any physiotherapy exercise sessions yet. Run an exercise session from the library to populate analytics.
                </p>
              </div>
              <Link 
                to="/exercises"
                className="px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-blue-600 transition inline-block text-sm"
              >
                Go to Exercise Library
              </Link>
            </div>
          ) : (
            <>
              {/* Stats HUD Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Accuracy HUD */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exercise Accuracy</h3>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-slate-800">{analytics.average_accuracy}%</p>
                    <p className="text-xs text-slate-500 mt-1">Average form correctness target</p>
                  </div>
                </div>

                {/* ROM HUD */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Peak Joint ROM</h3>
                    <Sliders className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-slate-800">{analytics.max_range_of_motion}°</p>
                    <p className="text-xs text-slate-500 mt-1">Maximum extension angle recorded</p>
                  </div>
                </div>

                {/* Grip Strength HUD */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grip Force output</h3>
                    <Heart className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-slate-800">{analytics.average_grip_strength} N</p>
                    <p className="text-xs text-slate-500 mt-1">Average force applied (flexion)</p>
                  </div>
                </div>

                {/* Duration HUD */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Therapy Time</h3>
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-slate-800">{formatTotalTime(analytics.total_duration_seconds)}</p>
                    <p className="text-xs text-slate-500 mt-1">Aggregated session duration ({analytics.total_sessions} runs)</p>
                  </div>
                </div>

              </div>

              {/* Progress Graphs Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* ROM Curve */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    Range of Motion (ROM) Flexibility Trend
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={(t) => t.substring(5, 10)} stroke="#94a3b8" fontSize={10} />
                        <YAxis domain={[0, 180]} stroke="#94a3b8" fontSize={10} />
                        <Tooltip labelFormatter={(t) => formatDate(t)} />
                        <Legend />
                        <Line type="monotone" name="Peak Angle (°)" dataKey="max_angle" stroke="#4f46e5" strokeWidth={2.5} activeDot={{ r: 6 }} />
                        <Line type="monotone" name="Avg Angle (°)" dataKey="average_angle" stroke="#818cf8" strokeWidth={1.5} strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Grip Strength Curve */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-500" />
                    Grip Strength Improvement Trend
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={(t) => t.substring(5, 10)} stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip labelFormatter={(t) => formatDate(t)} />
                        <Legend />
                        <Line type="monotone" name="Avg Grip Force (N)" dataKey="average_pressure" stroke="#ec4899" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Form Accuracy Curve */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
                  <h4 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-500" />
                    Rehabilitation Form Accuracy Progression
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={(t) => t.substring(5, 10)} stroke="#94a3b8" fontSize={10} />
                        <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} />
                        <Tooltip labelFormatter={(t) => formatDate(t)} />
                        <Legend />
                        <Line type="monotone" name="Exercise Accuracy (%)" dataKey="exercise_accuracy" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* History Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-500" />
                  <h4 className="font-bold text-slate-800">Recent Rehabilitation Sessions Log</h4>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Exercise Name</th>
                        <th className="py-3 px-4">Completed Reps</th>
                        <th className="py-3 px-4">Avg Angle</th>
                        <th className="py-3 px-4">Avg Grip Force</th>
                        <th className="py-3 px-4">Accuracy</th>
                        <th className="py-3 px-4">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold text-xs md:text-sm">
                      {[...analytics.history].reverse().slice(0, 8).map((session, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-4 text-slate-500 font-medium">
                            {formatDate(session.date)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-800 font-bold">
                            {session.exercise_name}
                          </td>
                          <td className="py-3.5 px-4">
                            {session.repetitions_completed} reps <span className="text-slate-400 text-xs">({session.repetitions_failed} failed)</span>
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
                                ? 'bg-green-50 text-green-600 border border-green-150' 
                                : 'bg-amber-50 text-amber-600 border border-amber-150'
                            }`}>
                              {session.exercise_accuracy}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
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
