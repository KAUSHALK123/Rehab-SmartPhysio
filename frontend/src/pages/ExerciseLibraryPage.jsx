import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getExercises } from '../services/exercise';
import { 
  BookOpen, 
  Play, 
  X, 
  Info, 
  ShieldAlert, 
  Award, 
  Clock, 
  Activity, 
  CheckCircle2, 
  RefreshCw,
  Sliders,
  ChevronRight
} from 'lucide-react';

function ExerciseLibraryPage() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Active Patient info from localStorage
  const activePatientId = localStorage.getItem('activePatientId') || '';
  const activePatientName = localStorage.getItem('activePatientName') || '';

  // Selected Exercise for Details Modal
  const [selectedExercise, setSelectedExercise] = useState(null);

  const fetchExercisesList = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getExercises();
      setExercises(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load rehabilitation exercises. Please verify the backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercisesList();
  }, []);

  const handleStartExercise = (exercise) => {
    if (!activePatientId) {
      // Shoud not be allowed if patient not set, but handle just in case
      return;
    }
    
    // Save current active exercise parameters to localStorage so Live Dashboard can load them
    localStorage.setItem('activeExerciseId', exercise.id);
    localStorage.setItem('activeExerciseName', exercise.exercise_name);
    
    navigate('/exercise-session', { 
      state: { 
        exerciseId: exercise.id, 
        exerciseName: exercise.exercise_name 
      } 
    });
  };

  // Helper to determine required sensors dynamically
  const getRequiredSensors = (bodyPart, exerciseName) => {
    const nameLower = exerciseName.toLowerCase();
    if (nameLower.includes('squeeze') || nameLower.includes('pressure') || bodyPart.toLowerCase().includes('grip')) {
      return ['Grip Pressure Sensor', 'Thumb Flex Sensor', 'Index Flex Sensor'];
    }
    if (bodyPart.toLowerCase() === 'shoulder') {
      return ['MPU6050 Accelerometer', 'Elbow Flex Sensor'];
    }
    if (bodyPart.toLowerCase() === 'elbow') {
      return ['Elbow Flex Sensor'];
    }
    if (bodyPart.toLowerCase() === 'wrist') {
      return ['MPU6050 Gyroscope', 'Wrist Flexion Resistor'];
    }
    return ['Flex Sensors', 'MPU6050 Orientation Sensor'];
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
                You must select or create a patient profile before launching rehabilitation exercise sessions.
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
        <div className="bg-green-50/50 border border-green-200 p-4 px-6 rounded-2xl shadow-sm flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-slate-700 font-semibold">
            Rehabilitation session active for patient:{' '}
            <span className="text-green-700 font-bold">{activePatientName}</span>
          </span>
        </div>
      )}

      {/* Header Cards */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Rehabilitation Exercise Library</h3>
            <p className="text-sm text-slate-500">
              Select an exercise routine below to review targets, setup wearable sensor nodes, and begin physical metrics logging.
            </p>
          </div>
        </div>
      </div>

      {/* Exercises Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading exercises library from DB...</p>
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-slate-700">No Exercises Found</h4>
          <p className="text-sm text-slate-500">The exercise database is currently empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exercises.map((ex) => (
            <div 
              key={ex.id} 
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:border-slate-300"
            >
              <div className="p-6 space-y-4.5">
                {/* Badges */}
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">
                    {ex.body_part}
                  </span>
                  
                  <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full uppercase tracking-wider ${
                    ex.difficulty === 'Easy' ? 'bg-green-50 text-green-600 border border-green-200' :
                    ex.difficulty === 'Medium' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                    'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    {ex.difficulty}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-slate-800 group-hover:text-primary transition">
                    {ex.exercise_name}
                  </h4>
                  <p className="text-slate-500 text-xs md:text-sm line-clamp-2 h-10">
                    {ex.description}
                  </p>
                </div>

                <hr className="border-slate-100" />

                {/* Specs overview */}
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-slate-400" />
                    <span>Reps: {ex.repetitions}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Hold: {ex.hold_seconds}s / Rest: {ex.rest_seconds}s</span>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                <button 
                  onClick={() => setSelectedExercise(ex)}
                  className="px-3.5 py-2 border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 bg-white rounded-lg hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  View Details
                </button>

                <button 
                  onClick={() => {
                    if (activePatientId) {
                      handleStartExercise(ex);
                    } else {
                      setSelectedExercise(ex); // open modal showing patient alert
                    }
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    activePatientId 
                      ? 'bg-primary text-white hover:bg-blue-600 shadow-sm shadow-blue-100' 
                      : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start Exercise
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exercise Details Modal */}
      {selectedExercise && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex justify-between items-center">
              <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                Exercise Specifications
              </h4>
              <button 
                onClick={() => setSelectedExercise(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-extrabold text-slate-800">{selectedExercise.exercise_name}</h3>
                  <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full uppercase tracking-wider ${
                    selectedExercise.difficulty === 'Easy' ? 'bg-green-50 text-green-600 border border-green-200' :
                    selectedExercise.difficulty === 'Medium' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                    'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    {selectedExercise.difficulty}
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {selectedExercise.description}
                </p>
              </div>

              {/* Specs Table */}
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-y-4 gap-x-6 text-sm font-semibold text-slate-700">
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Target Area</span>
                  <span>{selectedExercise.body_part}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Repetitions</span>
                  <span>{selectedExercise.repetitions} reps</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Hold Duration</span>
                  <span>{selectedExercise.hold_seconds} seconds</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Rest Duration</span>
                  <span>{selectedExercise.rest_seconds} seconds</span>
                </div>
                
                {selectedExercise.target_angle > 0 && (
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Target Flexion Angle</span>
                    <span className="text-primary font-bold">{selectedExercise.target_angle}°</span>
                  </div>
                )}
                
                {selectedExercise.target_pressure > 0 && (
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Target Grip Force</span>
                    <span className="text-primary font-bold">{selectedExercise.target_pressure} N</span>
                  </div>
                )}
              </div>

              {/* Sensor Requirements */}
              <div className="space-y-2.5">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Required Wearable Sleeve Sensors</span>
                <div className="flex flex-wrap gap-2">
                  {getRequiredSensors(selectedExercise.body_part, selectedExercise.exercise_name).map((sensor, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-blue-50/50 border border-blue-100 rounded-xl text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      {sensor}
                    </span>
                  ))}
                </div>
              </div>

              {/* Warning if no patient selected */}
              {!activePatientId && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-800">Therapist Profile Action Required</p>
                    <p className="text-xs text-amber-700">
                      No active patient selected. Close this modal, head to the <Link to="/patient" className="font-semibold underline hover:text-amber-900">Patient Profiles</Link> directory, and select a patient profile to begin calibration checks and exercise streaming.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setSelectedExercise(null)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
              
              <button 
                type="button"
                disabled={!activePatientId}
                onClick={() => {
                  handleStartExercise(selectedExercise);
                  setSelectedExercise(null);
                }}
                className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  activePatientId 
                    ? 'bg-primary text-white hover:bg-blue-600 shadow-sm shadow-blue-200' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                Launch Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExerciseLibraryPage;
