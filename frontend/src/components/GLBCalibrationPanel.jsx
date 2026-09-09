import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Save, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  Terminal, 
  Play,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  WRIST_MOVEMENTS, 
  FINGER_MOVEMENTS, 
  ELBOW_MOVEMENTS,
  loadCalibrationConfig, 
  saveCalibrationConfig 
} from '../services/calibrationConfig';

export default function GLBCalibrationPanel({
  mode = 'wrist', // 'wrist' | 'fingers' | 'elbow'
  onActiveJointChange, // Callback: ({ boneName, movementId }) => void
  onTestAnglesChange,  // Callback: ({ x, y, z }) => void
  restAngles = { x: 0, y: 0, z: 0 },
  liveRotation = { x: 0, y: 0, z: 0 }
}) {
  const movements = mode === 'wrist' ? WRIST_MOVEMENTS : mode === 'fingers' ? FINGER_MOVEMENTS : ELBOW_MOVEMENTS;
  const configCategory = mode === 'wrist' ? 'wrist' : mode === 'fingers' ? 'fingers' : 'elbow';

  // Master calibration configuration loaded from storage
  const [calibrationConfig, setCalibrationConfig] = useState(() => loadCalibrationConfig());

  // Currently selected movement or finger
  const [selectedId, setSelectedId] = useState(movements[0]?.id || '');

  // Form inputs for candidate min/max (strings while editing)
  const [candidateRanges, setCandidateRanges] = useState({
    xMin: -35,
    xMax: 35,
    yMin: -25,
    yMax: 25,
    zMin: -20,
    zMax: 20
  });

  // Active applied limits controlling the live sliders
  const [activeLimits, setActiveLimits] = useState({
    x: { min: -35, max: 35 },
    y: { min: -25, max: 25 },
    z: { min: -20, max: 20 }
  });

  // Live test values driven by the sliders (in degrees offset from rest)
  const [testAngles, setTestAngles] = useState({ x: 0, y: 0, z: 0 });

  // Input validation error
  const [inputError, setInputError] = useState('');
  const [applySuccessNotice, setApplySuccessNotice] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Debug panel open/close
  const [showDebug, setShowDebug] = useState(false);

  // Synchronize candidate form and active limits when switching movements
  useEffect(() => {
    const activeItem = calibrationConfig[configCategory]?.[selectedId];
    if (!activeItem) return;

    const newLimits = {
      x: { min: activeItem.x.min, max: activeItem.x.max },
      y: { min: activeItem.y.min, max: activeItem.y.max },
      z: { min: activeItem.z.min, max: activeItem.z.max }
    };

    setActiveLimits(newLimits);
    setCandidateRanges({
      xMin: activeItem.x.min,
      xMax: activeItem.x.max,
      yMin: activeItem.y.min,
      yMax: activeItem.y.max,
      zMin: activeItem.z.min,
      zMax: activeItem.z.max
    });

    // Return sliders to 0° test position on movement switch
    const initialTest = { x: 0, y: 0, z: 0 };
    setTestAngles(initialTest);
    onTestAnglesChange?.(initialTest);

    // Notify visualizer of active bone
    const movementMeta = movements.find(m => m.id === selectedId);
    const boneName = mode === 'wrist' || mode === 'elbow' ? movementMeta?.targetBone : movementMeta?.bone;
    onActiveJointChange?.({ boneName, movementId: selectedId });

    setInputError('');
    setApplySuccessNotice(false);
    setSaveSuccessNotice(false);
  }, [selectedId, mode]);

  // Current approval status for the selected movement
  const currentMovementData = calibrationConfig[configCategory]?.[selectedId];
  const isApproved = Boolean(currentMovementData?.approved);

  // Handle candidate range input changes
  const handleInputChange = (field, value) => {
    setCandidateRanges(prev => ({
      ...prev,
      [field]: value
    }));
    setInputError('');
    setApplySuccessNotice(false);
  };

  // Apply candidate values to live slider boundaries
  const handleApplyValues = () => {
    const xMin = parseFloat(candidateRanges.xMin);
    const xMax = parseFloat(candidateRanges.xMax);
    const yMin = parseFloat(candidateRanges.yMin);
    const yMax = parseFloat(candidateRanges.yMax);
    const zMin = parseFloat(candidateRanges.zMin);
    const zMax = parseFloat(candidateRanges.zMax);

    if (
      isNaN(xMin) || isNaN(xMax) ||
      isNaN(yMin) || isNaN(yMax) ||
      isNaN(zMin) || isNaN(zMax)
    ) {
      setInputError('All candidate bounds must be valid numbers.');
      return;
    }

    if (xMin >= xMax || yMin >= yMax || zMin >= zMax) {
      setInputError('Minimum degrees must be strictly less than Maximum degrees.');
      return;
    }

    // Update active limits
    const newLimits = {
      x: { min: xMin, max: xMax },
      y: { min: yMin, max: yMax },
      z: { min: zMin, max: zMax }
    };
    setActiveLimits(newLimits);

    // Clamp current test angles within new limits
    const isFinger = mode === 'fingers';
    const isElbow = mode === 'elbow';
    const isThumb = isFinger && selectedId === 'thumb';
    const isZOnly = isFinger && !isThumb;

    const clampedX = Math.min(xMax, Math.max(xMin, testAngles.x));
    const clampedY = Math.min(yMax, Math.max(yMin, testAngles.y));
    const clampedZ = Math.min(zMax, Math.max(zMin, testAngles.z));

    let clamped;
    if (isElbow) {
      clamped = { x: clampedX, y: 0, z: 0 };
    } else if (isFinger) {
      if (isThumb) {
        clamped = { x: clampedX, y: 0, z: 0 };
      } else if (isZOnly) {
        clamped = { x: 0, y: 0, z: clampedZ };
      } else {
        clamped = { x: clampedX, y: clampedY, z: clampedZ };
      }
    } else {
      clamped = { x: clampedX, y: clampedY, z: clampedZ };
    }

    setTestAngles(clamped);
    onTestAnglesChange?.(clamped);

    setInputError('');
    setApplySuccessNotice(true);
    setTimeout(() => setApplySuccessNotice(false), 2200);
  };

  // Live Slider Movement (Changes only the specified axis, combining XYZ smoothly)
  const handleSliderChange = (axis, val) => {
    const num = parseFloat(val);
    const isFinger = mode === 'fingers';
    const isElbow = mode === 'elbow';
    const isThumb = isFinger && selectedId === 'thumb';
    const isZOnly = isFinger && !isThumb;

    let updated;
    if (isElbow) {
      // Elbow uses LOCAL X axis only; Y and Z stay at 0
      updated = { x: axis === 'x' ? (isNaN(num) ? 0 : num) : 0, y: 0, z: 0 };
    } else if (isFinger) {
      if (isThumb) {
        // Thumb uses LOCAL X axis only; Y and Z stay at 0
        updated = { x: axis === 'x' ? (isNaN(num) ? 0 : num) : 0, y: 0, z: 0 };
      } else if (isZOnly) {
        // Index, Middle, Ring, Little use LOCAL Z axis only; X and Y stay at 0
        updated = { x: 0, y: 0, z: axis === 'z' ? (isNaN(num) ? 0 : num) : 0 };
      } else {
        updated = { ...testAngles, [axis]: isNaN(num) ? 0 : num };
      }
    } else {
      updated = {
        ...testAngles,
        [axis]: isNaN(num) ? 0 : num
      };
    }
    setTestAngles(updated);
    onTestAnglesChange?.(updated);
  };

  // Reset sliders to rest position (0° offset)
  const handleResetSliders = () => {
    const zero = { x: 0, y: 0, z: 0 };
    setTestAngles(zero);
    onTestAnglesChange?.(zero);
  };

  // Approve & Save the current active limits into configuration & localStorage
  const handleApproveAndSave = () => {
    const movementMeta = movements.find(m => m.id === selectedId);
    const targetBone = mode === 'wrist' || mode === 'elbow' ? movementMeta?.targetBone : movementMeta?.bone;

    const updatedConfig = {
      ...calibrationConfig,
      [configCategory]: {
        ...calibrationConfig[configCategory],
        [selectedId]: {
          targetBone,
          rotationOrder: 'XYZ',
          x: { ...activeLimits.x },
          y: { ...activeLimits.y },
          z: { ...activeLimits.z },
          approved: true,
          approvedAt: new Date().toISOString()
        }
      }
    };

    setCalibrationConfig(updatedConfig);
    saveCalibrationConfig(updatedConfig);

    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  const selectedMeta = movements.find(m => m.id === selectedId);

  return (
    <div className="flex flex-col h-full space-y-4 text-slate-800 text-xs select-none">
      
      {/* Top Header & Movement Dropdown */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-600" />
            <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              {mode === 'wrist' ? 'Wrist GLB Calibration' : mode === 'fingers' ? 'Finger GLB Calibration' : 'Elbow GLB Calibration'}
            </span>
          </div>

          {/* Status Badge */}
          {isApproved ? (
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Approved
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Not Approved
            </span>
          )}
        </div>

        {/* Movement Selector Dropdown */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {mode === 'wrist' ? 'Select Conceptual Movement' : 'Select Finger'}
          </label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer appearance-none pr-8 shadow-sm"
            >
              {movements.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} {m.description ? `(${m.description})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Axis Candidate Configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            Axis Candidate Configuration
          </span>
          <span className="text-[9px] text-slate-400 font-medium">Input degrees (°)</span>
        </div>

        {/* X, Y, Z Candidate Bounds Inputs */}
        <div className="grid grid-cols-3 gap-2">
          {/* Axis X */}
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1.5">
            <span className="font-extrabold text-blue-600 block text-[11px]">Axis X</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400 w-6">Min</span>
                <input
                  type="number"
                  value={candidateRanges.xMin}
                  onChange={(e) => handleInputChange('xMin', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400 w-6">Max</span>
                <input
                  type="number"
                  value={candidateRanges.xMax}
                  onChange={(e) => handleInputChange('xMax', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Axis Y */}
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1.5">
            <span className="font-extrabold text-emerald-600 block text-[11px]">Axis Y</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400 w-6">Min</span>
                <input
                  type="number"
                  value={candidateRanges.yMin}
                  onChange={(e) => handleInputChange('yMin', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400 w-6">Max</span>
                <input
                  type="number"
                  value={candidateRanges.yMax}
                  onChange={(e) => handleInputChange('yMax', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Axis Z */}
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1.5">
            <span className="font-extrabold text-purple-600 block text-[11px]">Axis Z</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400 w-6">Min</span>
                <input
                  type="number"
                  value={candidateRanges.zMin}
                  onChange={(e) => handleInputChange('zMin', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400 w-6">Max</span>
                <input
                  type="number"
                  value={candidateRanges.zMax}
                  onChange={(e) => handleInputChange('zMax', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error / Success Feedback */}
        {inputError && (
          <p className="text-[10px] text-rose-600 font-semibold">{inputError}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleApplyValues}
            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Apply Values to Sliders
          </button>
        </div>

        {applySuccessNotice && (
          <p className="text-[10px] text-emerald-600 font-bold text-center animate-in fade-in">
            ✓ Live test slider bounds updated. Use sliders below to inspect.
          </p>
        )}
      </div>

      {/* Live Movement Test Sliders */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-sm flex-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Live Movement Test (Experimental)
          </span>
          <span className="text-[9px] font-bold text-slate-500">Not Saved Automatically</span>
        </div>

        <div className="space-y-3 py-1">
          {/* Slider X */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-extrabold text-blue-600">X Rotation</span>
              <span className="font-extrabold text-slate-700">{testAngles.x > 0 ? `+${testAngles.x}` : testAngles.x}°</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 w-8 text-right font-medium">{activeLimits.x.min}°</span>
              <input
                type="range"
                min={activeLimits.x.min}
                max={activeLimits.x.max}
                step="1"
                value={testAngles.x}
                onChange={(e) => handleSliderChange('x', e.target.value)}
                className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <span className="text-[9px] text-slate-400 w-8 font-medium">+{activeLimits.x.max}°</span>
            </div>
          </div>

          {/* Slider Y */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-extrabold text-emerald-600">Y Rotation</span>
              <span className="font-extrabold text-slate-700">{testAngles.y > 0 ? `+${testAngles.y}` : testAngles.y}°</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 w-8 text-right font-medium">{activeLimits.y.min}°</span>
              <input
                type="range"
                min={activeLimits.y.min}
                max={activeLimits.y.max}
                step="1"
                value={testAngles.y}
                onChange={(e) => handleSliderChange('y', e.target.value)}
                className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <span className="text-[9px] text-slate-400 w-8 font-medium">+{activeLimits.y.max}°</span>
            </div>
          </div>

          {/* Slider Z */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-extrabold text-purple-600">Z Rotation</span>
              <span className="font-extrabold text-slate-700">{testAngles.z > 0 ? `+${testAngles.z}` : testAngles.z}°</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 w-8 text-right font-medium">{activeLimits.z.min}°</span>
              <input
                type="range"
                min={activeLimits.z.min}
                max={activeLimits.z.max}
                step="1"
                value={testAngles.z}
                onChange={(e) => handleSliderChange('z', e.target.value)}
                className="flex-1 accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <span className="text-[9px] text-slate-400 w-8 font-medium">+{activeLimits.z.max}°</span>
            </div>
          </div>
        </div>

        {/* Current Transformation summary pill */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex justify-around text-center text-[10px] font-bold text-slate-600">
          <div>X: <span className="text-blue-600">{testAngles.x}°</span></div>
          <div>Y: <span className="text-emerald-600">{testAngles.y}°</span></div>
          <div>Z: <span className="text-purple-600">{testAngles.z}°</span></div>
        </div>

        {/* Action Buttons: Reset & Approve */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleResetSliders}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Pose
          </button>

          <button
            type="button"
            onClick={handleApproveAndSave}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-purple-200"
          >
            <Save className="w-3.5 h-3.5" />
            Approve & Save
          </button>
        </div>

        {saveSuccessNotice && (
          <p className="text-[10px] text-emerald-600 font-bold text-center animate-in fade-in">
            ✓ Calibration approved and saved to local configuration!
          </p>
        )}
      </div>

      {/* Developer / Rig Debug Panel */}
      <div className="bg-slate-900 text-slate-300 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setShowDebug(prev => !prev)}
          className="w-full px-3.5 py-2 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            Developer / Rig Debug Panel
          </span>
          {showDebug ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showDebug && (
          <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-2 text-[10px] font-mono leading-relaxed">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div><span className="text-slate-500">Target Bone:</span> <span className="text-purple-400 font-bold">{selectedMeta?.targetBone || selectedMeta?.bone}</span></div>
              <div><span className="text-slate-500">Rotation Mode:</span> <span className="text-cyan-400 font-bold">Euler XYZ</span></div>
              <div><span className="text-slate-500">Movement ID:</span> <span className="text-slate-300">{selectedId}</span></div>
              <div><span className="text-slate-500">Approved:</span> <span className={isApproved ? "text-emerald-400" : "text-amber-400"}>{isApproved ? 'YES' : 'NO'}</span></div>
            </div>

            <div className="border-t border-slate-850 pt-1.5">
              <span className="text-slate-500 block mb-0.5">Configured Allowed Ranges:</span>
              <div className="text-slate-400">
                X: [{activeLimits.x.min}°, {activeLimits.x.max}°] | Y: [{activeLimits.y.min}°, {activeLimits.y.max}°] | Z: [{activeLimits.z.min}°, {activeLimits.z.max}°]
              </div>
            </div>

            <div className="border-t border-slate-850 pt-1.5">
              <span className="text-slate-500 block mb-0.5">Captured Rest Angles (Rad / Deg):</span>
              <div className="text-slate-400">
                X: {(restAngles?.x || 0).toFixed(3)} rad ({((restAngles?.x || 0) * 180 / Math.PI).toFixed(1)}°)
              </div>
              <div className="text-slate-400">
                Y: {(restAngles?.y || 0).toFixed(3)} rad ({((restAngles?.y || 0) * 180 / Math.PI).toFixed(1)}°)
              </div>
              <div className="text-slate-400">
                Z: {(restAngles?.z || 0).toFixed(3)} rad ({((restAngles?.z || 0) * 180 / Math.PI).toFixed(1)}°)
              </div>
            </div>

            <div className="border-t border-slate-850 pt-1.5">
              <span className="text-slate-500 block mb-0.5">Live Test Offset Applied:</span>
              <div className="text-purple-300">
                ΔX: {testAngles.x}° | ΔY: {testAngles.y}° | ΔZ: {testAngles.z}°
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
