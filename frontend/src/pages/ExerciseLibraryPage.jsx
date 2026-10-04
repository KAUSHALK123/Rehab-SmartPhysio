import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getExercises } from '../services/exercise';
import { getRecommendedExercises, getPatient } from '../services/patient';
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
  ChevronRight,
  ChevronLeft,
  Columns3,
  LayoutGrid
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';

const CATEGORIES = [
  {
    id: 'wrist',
    title: 'Wrist & Forearm',
    subtitle: 'MPU-6050 pitch, roll, deviation & rotation tracking',
    icon: '⌚',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300',
    match: (ex) => {
      const bp = (ex.body_part || '').toLowerCase();
      const name = (ex.exercise_name || '').toLowerCase();
      const joint = (ex.target_joint || '').toLowerCase();
      return bp.includes('wrist') || name.includes('wrist') || name.includes('pronation') || name.includes('supination') || name.includes('deviation') || joint.includes('wrist');
    },
    trialType: 'wrist',
    trialTitle: 'Wrist Sensor Test',
    trialDesc: 'Test MPU6050 3D pitch, roll & deviation in real-time.'
  },
  {
    id: 'hand',
    title: 'Hand & Finger Flex',
    subtitle: 'Finger curl flex sensors & grip squeeze resistance',
    icon: '✋',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300',
    match: (ex) => {
      const bp = (ex.body_part || '').toLowerCase();
      const name = (ex.exercise_name || '').toLowerCase();
      const joint = (ex.target_joint || '').toLowerCase();
      return bp.includes('hand') || bp.includes('finger') || name.includes('finger') || name.includes('grip') || name.includes('squeeze') || name.includes('pinch') || joint.includes('finger');
    },
    trialType: 'fingers',
    trialTitle: 'Finger Sensor Test',
    trialDesc: 'Test all 5 analog flex resistors & grip pressure in 3D.'
  },
  {
    id: 'elbow',
    title: 'Elbow & Arm Flexion',
    subtitle: 'Elbow flexion, extension and curl resistance tracking',
    icon: '💪',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300',
    match: (ex) => {
      const bp = (ex.body_part || '').toLowerCase();
      const name = (ex.exercise_name || '').toLowerCase();
      const joint = (ex.target_joint || '').toLowerCase();
      return bp.includes('elbow') || name.includes('elbow') || name.includes('curl') || joint.includes('elbow');
    },
    trialType: 'elbow',
    trialTitle: 'Elbow Sensor Test',
    trialDesc: 'Test elbow flex sensor bend angle in 3D.'
  },
  {
    id: 'shoulder',
    title: 'Shoulder & Full Arm',
    subtitle: 'Multi-joint kinetic arm elevation and reaching',
    icon: '🎯',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300',
    match: (ex) => {
      const bp = (ex.body_part || '').toLowerCase();
      const name = (ex.exercise_name || '').toLowerCase();
      const joint = (ex.target_joint || '').toLowerCase();
      return bp.includes('shoulder') || bp.includes('full') || name.includes('shoulder') || name.includes('reach') || joint.includes('shoulder');
    },
    trialType: null,
    trialTitle: null,
    trialDesc: null
  }
];

const FALLBACK_EXERCISES = [
  {
    id: "97223631-0df8-4ecf-9fd5-e36688f98014",
    exercise_name: "Ball Squeeze",
    description: "Squeeze the therapy ball repeatedly with moderate pressure to improve grip strength, finger flexion, and hand dexterity.",
    body_part: "Hand/Fingers",
    target_joint: "Fingers",
    rehabilitation_goal: "Strength Building",
    difficulty: "Medium",
    target_angle: 85.0,
    target_pressure: 120.0,
    repetitions: 10,
    hold_duration: 3,
    hold_seconds: 3,
    rest_duration: 2,
    rest_seconds: 2,
    required_sensors: "FSR, Flex Sensors",
    camera_view: "hand",
    primary_sensor: "pressure",
    secondary_sensor: "flex_avg"
  },
  {
    id: "6bf28f42-c178-4359-ba1d-288289bf65d8",
    exercise_name: "Wrist Flexion",
    description: "Slowly bend your wrist downward towards the inside of your forearm to stretch and strengthen wrist flexors.",
    body_part: "Wrist",
    target_joint: "Wrist",
    rehabilitation_goal: "Improve Range of Motion",
    difficulty: "Easy",
    target_angle: 60.0,
    target_pressure: 0.0,
    repetitions: 10,
    hold_duration: 3,
    hold_seconds: 3,
    rest_duration: 2,
    rest_seconds: 2,
    required_sensors: "MPU",
    camera_view: "wrist",
    primary_sensor: "wrist_pitch",
    secondary_sensor: "wrist_roll"
  },
  {
    id: "1a1e473f-0601-41dc-8ee7-e360f28fadd4",
    exercise_name: "Wrist Extension",
    description: "Bend your wrist upward towards the outside of your forearm to stretch and strengthen wrist extensors.",
    body_part: "Wrist",
    target_joint: "Wrist",
    rehabilitation_goal: "Improve Range of Motion",
    difficulty: "Easy",
    target_angle: 50.0,
    target_pressure: 0.0,
    repetitions: 10,
    hold_duration: 3,
    hold_seconds: 3,
    rest_duration: 2,
    rest_seconds: 2,
    required_sensors: "MPU",
    camera_view: "wrist",
    primary_sensor: "wrist_pitch",
    secondary_sensor: "wrist_roll"
  },
  {
    id: "39371466-5a3c-4335-82af-daeca0cec244",
    exercise_name: "Wrist Rotation",
    description: "Rotate your wrist slowly in a circular motion to improve wrist joint mobility, range of motion, and flexibility.",
    body_part: "Wrist",
    target_joint: "Wrist",
    rehabilitation_goal: "Improve Range of Motion",
    difficulty: "Medium",
    target_angle: 90.0,
    target_pressure: 0.0,
    repetitions: 8,
    hold_duration: 2,
    hold_seconds: 2,
    rest_duration: 3,
    rest_seconds: 3,
    required_sensors: "MPU",
    camera_view: "wrist",
    primary_sensor: "wrist_roll",
    secondary_sensor: "wrist_pitch"
  },
  {
    id: "0f385649-9f2a-4ef0-b959-cb7f405527ce",
    exercise_name: "Finger Closing",
    description: "Curl all fingers inward to make a tight fist to improve hand flexor endurance and finger joint range.",
    body_part: "Hand/Fingers",
    target_joint: "Fingers",
    rehabilitation_goal: "Reduce Stiffness",
    difficulty: "Easy",
    target_angle: 95.0,
    target_pressure: 0.0,
    repetitions: 12,
    hold_duration: 4,
    hold_seconds: 4,
    rest_duration: 2,
    rest_seconds: 2,
    required_sensors: "Flex Sensors",
    camera_view: "hand",
    primary_sensor: "flex_avg",
    secondary_sensor: "wrist_pitch"
  },
  {
    id: "03441c40-0b73-423c-b593-fd5a9595c6db",
    exercise_name: "Finger Opening",
    description: "Fully extend and separate your fingers outward to improve extensor strength and reduce joint stiffness.",
    body_part: "Hand/Fingers",
    target_joint: "Fingers",
    rehabilitation_goal: "Reduce Stiffness",
    difficulty: "Easy",
    target_angle: 10.0,
    target_pressure: 0.0,
    repetitions: 12,
    hold_duration: 3,
    hold_seconds: 3,
    rest_duration: 2,
    rest_seconds: 2,
    required_sensors: "Flex Sensors",
    camera_view: "hand",
    primary_sensor: "flex_avg",
    secondary_sensor: "wrist_pitch"
  },
  {
    id: "071a02dd-255c-45f0-bb8c-98dfe560d5ef",
    exercise_name: "Elbow Curl",
    description: "Bend your elbow to bring your forearm up towards your shoulder, simulating a standard bicep curl to improve elbow range of motion.",
    body_part: "Elbow",
    target_joint: "Elbow",
    rehabilitation_goal: "Improve Range of Motion",
    difficulty: "Medium",
    target_angle: 130.0,
    target_pressure: 0.0,
    repetitions: 10,
    hold_duration: 3,
    hold_seconds: 3,
    rest_duration: 3,
    rest_seconds: 3,
    required_sensors: "MPU",
    camera_view: "elbow",
    primary_sensor: "elbow",
    secondary_sensor: "wrist_roll"
  },
  {
    id: "bc589ee6-9a23-4120-bc3c-6979bf688ce2",
    exercise_name: "Shoulder Raise",
    description: "Raise your arm up sideways to shoulder level to improve shoulder rotation, range of motion, and deltoid muscular strength.",
    body_part: "Shoulder",
    target_joint: "Shoulder",
    rehabilitation_goal: "Improve Range of Motion",
    difficulty: "Hard",
    target_angle: 90.0,
    target_pressure: 0.0,
    repetitions: 8,
    hold_duration: 4,
    hold_seconds: 4,
    rest_duration: 4,
    rest_seconds: 4,
    required_sensors: "MPU",
    camera_view: "side",
    primary_sensor: "wrist_pitch",
    secondary_sensor: "elbow"
  },
  {
    id: "d2be0688-1534-4cab-8cf7-85b725be6c9a",
    exercise_name: "Elbow Flex Test",
    description: "Slowly bend and straighten your elbow to test flex sensor range and calibrate the 3D model elbow joint.",
    body_part: "Elbow",
    target_joint: "Elbow",
    rehabilitation_goal: "Improve Range of Motion",
    difficulty: "Easy",
    target_angle: 90.0,
    target_pressure: 0.0,
    repetitions: 5,
    hold_duration: 3,
    hold_seconds: 3,
    rest_duration: 3,
    rest_seconds: 3,
    required_sensors: "Flex Sensor",
    camera_view: "elbow",
    primary_sensor: "elbow",
    secondary_sensor: "wrist_roll"
  },
  {
    id: "550f0c38-457a-43be-83af-d63e57998804",
    exercise_name: "Finger Flex Test",
    description: "Open and close your hand slowly to test all 5 finger flex sensors and calibrate the 3D finger model.",
    body_part: "Hand/Fingers",
    target_joint: "Fingers",
    rehabilitation_goal: "Reduce Stiffness",
    difficulty: "Easy",
    target_angle: 70.0,
    target_pressure: 0.0,
    repetitions: 5,
    hold_seconds: 3,
    hold_duration: 3,
    rest_duration: 3,
    rest_seconds: 3,
    required_sensors: "Flex Sensors",
    camera_view: "hand",
    primary_sensor: "flex_avg",
    secondary_sensor: "pressure"
  },
  {
    id: "6ae8def9-b6d3-4bf0-b249-bfcc7e30a66c",
    exercise_name: "Wrist Motion Test",
    description: "Tilt and rotate your wrist to test MPU6050 pitch and roll readings and calibrate wrist 3D movement.",
    body_part: "Wrist",
    target_joint: "Wrist",
    rehabilitation_goal: "Improve Range of Motion",
    difficulty: "Easy",
    target_angle: 45.0,
    target_pressure: 0.0,
    repetitions: 5,
    hold_seconds: 2,
    hold_duration: 2,
    rest_duration: 2,
    rest_seconds: 2,
    required_sensors: "MPU",
    camera_view: "wrist",
    primary_sensor: "wrist_pitch",
    secondary_sensor: "wrist_roll"
  },
  {
    id: "71df6ce9-141c-4dac-9060-3ead1a7ff385",
    exercise_name: "Full Arm Diagnostic",
    description: "Complete arm range of motion test: bend elbow, flex fingers, rotate wrist. Tests all sensors simultaneously.",
    body_part: "Full Arm",
    target_joint: "All",
    rehabilitation_goal: "Improve Range of Motion",
    difficulty: "Medium",
    target_angle: 90.0,
    target_pressure: 0.0,
    repetitions: 3,
    hold_seconds: 5,
    hold_duration: 5,
    rest_duration: 5,
    rest_seconds: 5,
    required_sensors: "All",
    camera_view: "straight",
    primary_sensor: "elbow",
    secondary_sensor: "flex_avg"
  }
];

function ExerciseLibraryPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [exercises, setExercises] = useState([]);
  const [recommendedExercises, setRecommendedExercises] = useState([]);
  const [patientDetails, setPatientDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // View Mode: 'horizontal' (Category Rows by Muscle) vs 'grid' (All Routines Grid)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('exercise_view_mode') || 'horizontal';
  });
  const rowRefs = useRef({});

  const scrollRow = (categoryId, offset) => {
    const container = rowRefs.current[categoryId];
    if (container) {
      container.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Active Patient info from localStorage
  const activePatientId = localStorage.getItem('activePatientId') || '';
  const activePatientName = localStorage.getItem('activePatientName') || '';

  // Selected Exercise for Details Modal
  const [selectedExercise, setSelectedExercise] = useState(null);

  const fetchExercisesList = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const allEx = await getExercises();
      if (allEx && Array.isArray(allEx) && allEx.length > 0) {
        setExercises(allEx);
      } else {
        setExercises(FALLBACK_EXERCISES);
      }

      if (activePatientId) {
        try {
          const recEx = await getRecommendedExercises(activePatientId);
          setRecommendedExercises(recEx || []);
        } catch (rErr) {
          console.warn("Failed to load recommended exercises:", rErr);
        }
        
        try {
          const pDetails = await getPatient(activePatientId);
          setPatientDetails(pDetails);
        } catch (pErr) {
          console.warn("Failed to load patient details:", pErr);
        }
      } else {
        setRecommendedExercises([]);
        setPatientDetails(null);
      }
    } catch (err) {
      console.warn("Could not fetch exercises from API, using built-in catalog:", err);
      setExercises(FALLBACK_EXERCISES);
      setErrorMsg('Connected to built-in exercise catalogue (backend sync pending).');
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

  // Set of recommended exercise IDs for quick lookup
  const recIds = new Set(recommendedExercises.map(r => r.id));

  // Exercises that don't match standard wrist/hand/elbow/shoulder categories
  const otherExercises = exercises.filter(ex => !CATEGORIES.some(cat => cat.match(ex)));

  // Render a compact, small exercise card box for horizontal category rows
  const renderCompactExerciseCard = (ex, isRecommended = false) => {
    return (
      <div 
        key={`compact-${ex.id}`}
        className={`w-[285px] sm:w-[310px] flex-shrink-0 rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:scale-[1.01] hover:shadow-md ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-100' 
            : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-xs text-slate-800'
        } ${isRecommended ? (isDark ? 'ring-1 ring-emerald-500/40 border-emerald-500/30' : 'ring-2 ring-emerald-500/20 border-emerald-500/40') : ''}`}
      >
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold truncate ${
                isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}>
                {ex.body_part || 'Arm'}
              </span>
              {isRecommended && (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Recommended
                </span>
              )}
            </div>
            <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider flex-shrink-0 ${
              ex.difficulty === 'Easy' ? 'bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800' :
              ex.difficulty === 'Medium' ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800' :
              'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
              {ex.difficulty}
            </span>
          </div>

          <div className="space-y-1">
            <h4 className={`text-sm font-bold truncate ${
              isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-800 group-hover:text-primary'
            } transition`}>
              {ex.exercise_name}
            </h4>
            <p className={`text-[11px] line-clamp-2 h-8 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {ex.description}
            </p>
          </div>

          <div className={`p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[10px] font-semibold ${
            isDark ? 'bg-slate-800/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'
          }`}>
            <div className="flex items-center gap-1.5 truncate">
              <Award className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>Reps: {ex.repetitions}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>Hold: {ex.hold_seconds}s</span>
            </div>
          </div>
        </div>

        <div className={`px-4 py-3 border-t flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'
        }`}>
          <button 
            type="button"
            onClick={() => setSelectedExercise(ex)}
            className={`px-3 py-1.5 border text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer ${
              isDark 
                ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200' 
                : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Info className="w-3 h-3 text-slate-400" />
            Details
          </button>

          <button 
            type="button"
            onClick={() => {
              if (activePatientId) {
                handleStartExercise(ex);
              } else {
                setSelectedExercise(ex);
              }
            }}
            className={`px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
              activePatientId 
                ? 'bg-primary text-white hover:bg-blue-600 shadow-blue-500/20' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            Start
          </button>
        </div>
      </div>
    );
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
        <div className="bg-green-50/50 border border-green-200 p-5 px-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-slate-700 font-semibold">
              Rehabilitation session active for patient:{' '}
              <span className="text-green-700 font-bold">{activePatientName}</span>
              {patientDetails?.condition_name && (
                <span className="ml-2 px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
                  Condition: {patientDetails.condition_name}
                </span>
              )}
            </span>
          </div>
          <div className="text-xs text-slate-500 italic font-medium">
            Exercises are based on the rehabilitation condition selected during setup.
          </div>
        </div>
      )}

      {/* Header Cards */}
      <div className={`p-5 md:p-6 rounded-2xl border transition-colors duration-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDark ? 'bg-blue-950/80 text-blue-400' : 'bg-blue-50 text-primary'
          }`}>
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Physical Therapy Exercise Library</h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Interactive motor assessment modules with automated range-of-motion limits and 3D digital-twin feedback.
            </p>
          </div>
        </div>

        {/* Small & Simple View Toggle Button */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs self-start md:self-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setViewMode('horizontal');
              localStorage.setItem('exercise_view_mode', 'horizontal');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'horizontal'
                ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-xs border border-slate-200/80')
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Show exercises arranged horizontally by target muscle / category"
          >
            <Columns3 className="w-3.5 h-3.5 text-primary" />
            <span>Category Rows</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('grid');
              localStorage.setItem('exercise_view_mode', 'grid');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'grid'
                ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-xs border border-slate-200/80')
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Show all exercises in standard grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
            <span>Standard Grid</span>
          </button>
        </div>
      </div>

      {/* Exercise DB Sync Banner if errorMsg exists */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-amber-500 text-lg">ℹ️</span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{errorMsg}</span>
          </div>
          <button
            onClick={fetchExercisesList}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync DB</span>
          </button>
        </div>
      )}

      {/* Exercises Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Loading exercises library from DB...</p>
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200">No Exercises Found</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">The exercise database is syncing. Click below to reload.</p>
          <button
            onClick={fetchExercisesList}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Library
          </button>
        </div>
      ) : viewMode === 'horizontal' ? (
        <div className="space-y-8">
          {/* Recommended Category Row (if active patient has prescribed exercises) */}
          {recommendedExercises.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm shadow-xs font-bold">
                    ⭐
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        Recommended for Your Rehabilitation
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                        {recommendedExercises.length} {recommendedExercises.length === 1 ? 'Exercise' : 'Exercises'}
                      </span>
                    </div>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Targeted routines for active patient: {activePatientName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={() => scrollRow('rec', -320)}
                    aria-label="Scroll left"
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition shadow-xs cursor-pointer ${
                      isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => scrollRow('rec', 320)}
                    aria-label="Scroll right"
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition shadow-xs cursor-pointer ${
                      isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div 
                ref={el => rowRefs.current['rec'] = el}
                className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1 scroll-smooth scrollbar-thin"
              >
                {recommendedExercises.map(ex => renderCompactExerciseCard(ex, true))}
              </div>
            </div>
          )}

          {/* Target Muscle / Body Part Categories (Wrist, Hand/Flex, Elbow, Shoulder) */}
          {CATEGORIES.map(cat => {
            const catExercises = exercises.filter(cat.match);
            if (catExercises.length === 0 && !cat.trialType) return null;

            return (
              <div key={cat.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-xs font-bold ${cat.iconBg}`}>
                      {cat.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {cat.title}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.badgeClass}`}>
                          {catExercises.length} {catExercises.length === 1 ? 'Exercise' : 'Exercises'}
                        </span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {cat.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button"
                      onClick={() => scrollRow(cat.id, -320)}
                      aria-label={`Scroll ${cat.title} left`}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition shadow-xs cursor-pointer ${
                        isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => scrollRow(cat.id, 320)}
                      aria-label={`Scroll ${cat.title} right`}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition shadow-xs cursor-pointer ${
                        isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div 
                  ref={el => rowRefs.current[cat.id] = el}
                  className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1 scroll-smooth scrollbar-thin"
                >
                  {catExercises.map(ex => renderCompactExerciseCard(ex, recIds.has(ex.id)))}

                  {/* Diagnostic Trial Test Card inside each relevant category */}
                  {cat.trialType && (
                    <div className={`w-[260px] flex-shrink-0 rounded-2xl border-2 border-dashed p-4 flex flex-col justify-between transition-all duration-200 ${
                      isDark
                        ? 'border-purple-900/60 bg-purple-950/20 hover:border-purple-700 hover:bg-purple-950/30'
                        : 'border-purple-200 bg-purple-50/40 hover:border-purple-300 hover:bg-purple-50/70'
                    }`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                            Diagnostic Trial
                          </span>
                          <Sliders className="w-3.5 h-3.5 text-purple-500" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {cat.trialTitle}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {cat.trialDesc}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/exercise-session?mode=trial&type=${cat.trialType}`)}
                        className="mt-3 w-full py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Test Sensor in 3D
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Fallback for other exercises if any */}
          {otherExercises.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm shadow-xs font-bold">
                    📋
                  </span>
                  <div>
                    <h4 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      Additional Rehabilitation Routines
                    </h4>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      General motor assessment and flexibility modules
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={() => scrollRow('other', -320)}
                    aria-label="Scroll left"
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition shadow-xs cursor-pointer ${
                      isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => scrollRow('other', 320)}
                    aria-label="Scroll right"
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition shadow-xs cursor-pointer ${
                      isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div 
                ref={el => rowRefs.current['other'] = el}
                className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1 scroll-smooth scrollbar-thin"
              >
                {otherExercises.map(ex => renderCompactExerciseCard(ex, recIds.has(ex.id)))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {/* Recommended Exercises (First section) */}
          {recommendedExercises.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-4 bg-green-500 rounded-full"></div>
                <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest">
                  Recommended for your rehabilitation
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendedExercises.map((ex) => (
                  <div 
                    key={`rec-${ex.id}`} 
                    className="bg-white rounded-2xl border-2 border-green-500/25 hover:border-green-500/60 shadow-md hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:scale-[1.01] relative"
                  >
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[9px] font-extrabold px-3 py-1.5 rounded-bl-xl tracking-wider uppercase shadow-sm">
                      Recommended
                    </div>
                    
                    <div className="p-6 space-y-4.5">
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
                        <h4 className="text-lg font-bold text-slate-800 group-hover:text-primary transition pr-16">
                          {ex.exercise_name}
                        </h4>
                        <p className="text-slate-500 text-xs md:text-sm line-clamp-2 h-10">
                          {ex.description}
                        </p>
                      </div>

                      <hr className="border-slate-100" />

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

                    <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                      <button 
                        onClick={() => setSelectedExercise(ex)}
                        className="px-3.5 py-2 border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 bg-white rounded-lg hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Info className="w-3.5 h-3.5 text-slate-500" />
                        View Details
                      </button>

                      <button 
                        onClick={() => handleStartExercise(ex)}
                        className="px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer bg-primary text-white hover:bg-blue-600 shadow-sm shadow-blue-100"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Start Exercise
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General Exercises (Second section) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-4 bg-slate-400 rounded-full"></div>
              <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest">
                All Rehabilitation Routines
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exercises.map((ex) => (
                <div 
                  key={ex.id} 
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:border-slate-300"
                >
                  <div className="p-6 space-y-4.5">
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
                          setSelectedExercise(ex);
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
          </div>


          {/* Trial / Sensor Test Section */}
          <div className="space-y-4 pt-6 border-t-2 border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-2 w-4 bg-purple-500 rounded-full"></div>
              <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest">
                Trial / Sensor Test
              </h4>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Use these diagnostic exercises to verify sensor telemetry and 3D arm visualization. These tests do not record to your patient analytics.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Finger Sensor Test */}
              <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 border-dashed hover:border-purple-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group">
                <div className="p-6 space-y-4.5">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-1 bg-white text-slate-600 rounded-lg text-xs font-semibold border border-slate-200">
                      Hand/Fingers
                    </span>
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full uppercase tracking-wider bg-purple-100 text-purple-700">
                      Diagnostic
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-slate-800">Finger Sensor Test</h4>
                    <p className="text-slate-500 text-xs md:text-sm h-10">
                      Test all 5 flex sensors and finger movement in the 3D model.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-100/50 px-6 py-4 flex items-center justify-end">
                  <button 
                    onClick={() => navigate('/exercise-session?mode=trial&type=fingers')}
                    className="px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Test
                  </button>
                </div>
              </div>

              {/* Wrist Sensor Test */}
              <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 border-dashed hover:border-purple-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group">
                <div className="p-6 space-y-4.5">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-1 bg-white text-slate-600 rounded-lg text-xs font-semibold border border-slate-200">
                      Wrist
                    </span>
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full uppercase tracking-wider bg-purple-100 text-purple-700">
                      Diagnostic
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-slate-800">Wrist Sensor Test</h4>
                    <p className="text-slate-500 text-xs md:text-sm h-10">
                      Test MPU6050 wrist angle, pitch, and rotation.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-100/50 px-6 py-4 flex items-center justify-end">
                  <button 
                    onClick={() => navigate('/exercise-session?mode=trial&type=wrist')}
                    className="px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Test
                  </button>
                </div>
              </div>

              {/* Elbow Sensor Test */}
              <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 border-dashed hover:border-purple-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group">
                <div className="p-6 space-y-4.5">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-1 bg-white text-slate-600 rounded-lg text-xs font-semibold border border-slate-200">
                      Elbow
                    </span>
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full uppercase tracking-wider bg-purple-100 text-purple-700">
                      Diagnostic
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-slate-800">Elbow Sensor Test</h4>
                    <p className="text-slate-500 text-xs md:text-sm h-10">
                      Test elbow flex sensor bend angle and visualization.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-100/50 px-6 py-4 flex items-center justify-end">
                  <button 
                    onClick={() => navigate('/exercise-session?mode=trial&type=elbow')}
                    className="px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Test
                  </button>
                </div>
              </div>

            </div>
          </div>

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
                {selectedExercise.target_joint && (
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Target Joint</span>
                    <span>{selectedExercise.target_joint}</span>
                  </div>
                )}
                {selectedExercise.rehabilitation_goal && (
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Rehabilitation Goal</span>
                    <span>{selectedExercise.rehabilitation_goal}</span>
                  </div>
                )}
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
                  {(selectedExercise.required_sensors 
                    ? selectedExercise.required_sensors.split(',').map(s => s.trim()) 
                    : getRequiredSensors(selectedExercise.body_part, selectedExercise.exercise_name)
                  ).map((sensor, idx) => (
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
