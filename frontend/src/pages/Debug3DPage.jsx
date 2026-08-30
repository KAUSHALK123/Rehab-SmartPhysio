import React, { useState } from 'react';
import Arm3DVisualizer from '../components/Arm3DVisualizer';

/**
 * Debug page for testing 3D model joint rotations.
 * This page provides sliders for every control axis to determine
 * the correct rotation axis for each joint in the GLB model.
 * 
 * Navigate to /debug-3d to use this page.
 * REMOVE THIS PAGE once rotation axes are confirmed.
 */
export default function Debug3DPage() {
  const [cameraAngle, setCameraAngle] = useState('straight');
  const [controls, setControls] = useState({
    shoulderAngle: 0,
    shoulderAngleX: 0,
    elbowAngle: 0,
    wristAngle: 0,
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    little: 0,
  });

  const cameraOptions = ['straight', 'side', 'hand', 'hand_side', 'elbow', 'wrist'];

  const sliderGroups = [
    {
      title: '🦴 Arm Joints',
      sliders: [
        { key: 'shoulderAngle', label: 'Shoulder (Fwd/Back)', min: -90, max: 90 },
        { key: 'shoulderAngleX', label: 'Shoulder (Side)', min: -90, max: 90 },
        { key: 'elbowAngle', label: 'Elbow Bend', min: 0, max: 135 },
        { key: 'wristAngle', label: 'Wrist Roll', min: -90, max: 90 },
      ]
    },
    {
      title: '🖐️ Fingers (0°=straight, 90°=fully bent)',
      sliders: [
        { key: 'thumb', label: 'Thumb', min: 0, max: 90 },
        { key: 'index', label: 'Index', min: 0, max: 90 },
        { key: 'middle', label: 'Middle', min: 0, max: 90 },
        { key: 'ring', label: 'Ring', min: 0, max: 90 },
        { key: 'little', label: 'Little', min: 0, max: 90 },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Left Panel: 3D Visualizer */}
      <div className="flex-1 relative">
        <Arm3DVisualizer controls={controls} cameraAngle={cameraAngle} />

        {/* Camera selector */}
        <div className="absolute top-4 right-4 z-20 flex gap-1.5 flex-wrap max-w-[300px]">
          {cameraOptions.map(cam => (
            <button
              key={cam}
              onClick={() => setCameraAngle(cam)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                cameraAngle === cam
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {cam}
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-3">
          <h1 className="text-sm font-black text-blue-400 uppercase tracking-wider">3D Model Debug</h1>
          <p className="text-[10px] text-slate-400 mt-1">Drag sliders to test rotation axes. Check console for [GLB] logs.</p>
        </div>
      </div>

      {/* Right Panel: Control Sliders */}
      <div className="w-80 bg-slate-900/90 border-l border-slate-800 p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-200">Joint Controls</h2>
          <button
            onClick={() => setControls({
              shoulderAngle: 0, shoulderAngleX: 0,
              elbowAngle: 0, wristAngle: 0,
              thumb: 0, index: 0, middle: 0, ring: 0, little: 0,
            })}
            className="text-[10px] bg-rose-600/20 text-rose-400 font-bold px-2.5 py-1 rounded-lg border border-rose-800 hover:bg-rose-600/30 transition cursor-pointer"
          >
            Reset All
          </button>
        </div>

        {sliderGroups.map(group => (
          <div key={group.title} className="mb-5">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">{group.title}</h3>
            <div className="space-y-3">
              {group.sliders.map(s => (
                <div key={s.key}>
                  <div className="flex justify-between text-[10px] font-semibold mb-0.5">
                    <span className="text-slate-400">{s.label}</span>
                    <span className="text-blue-300 font-mono">{controls[s.key]}°</span>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    value={controls[s.key]}
                    onChange={e => setControls(prev => ({ ...prev, [s.key]: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Quick Test Buttons */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">🧪 Quick Tests</h3>
          <div className="space-y-2">
            <button
              onClick={() => setControls(prev => ({ ...prev, thumb: 60, index: 60, middle: 60, ring: 60, little: 60 }))}
              className="w-full text-xs font-bold bg-emerald-600/20 text-emerald-300 py-2 rounded-lg border border-emerald-800 hover:bg-emerald-600/30 transition cursor-pointer"
            >
              Bend All Fingers 60°
            </button>
            <button
              onClick={() => setControls(prev => ({ ...prev, thumb: 0, index: 0, middle: 0, ring: 0, little: 0 }))}
              className="w-full text-xs font-bold bg-slate-600/20 text-slate-300 py-2 rounded-lg border border-slate-700 hover:bg-slate-600/30 transition cursor-pointer"
            >
              Straighten All Fingers 0°
            </button>
            <button
              onClick={() => setControls(prev => ({ ...prev, elbowAngle: 90 }))}
              className="w-full text-xs font-bold bg-amber-600/20 text-amber-300 py-2 rounded-lg border border-amber-800 hover:bg-amber-600/30 transition cursor-pointer"
            >
              Bend Elbow 90°
            </button>
            <button
              onClick={() => setControls(prev => ({ ...prev, index: 45 }))}
              className="w-full text-xs font-bold bg-purple-600/20 text-purple-300 py-2 rounded-lg border border-purple-800 hover:bg-purple-600/30 transition cursor-pointer"
            >
              Bend Index Only 45°
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 p-3 bg-slate-800/50 rounded-xl text-[10px] text-slate-500 leading-relaxed">
          <p className="font-bold text-slate-400 mb-1">How to determine correct axis:</p>
          <p>1. Open browser console (F12)</p>
          <p>2. Look for <code className="text-blue-300">[GLB]</code> logs showing each node's initial rotation</p>
          <p>3. Drag the "Index" slider from 0→45</p>
          <p>4. If the finger curls naturally inward → current axis is correct</p>
          <p>5. If finger moves sideways or breaks → wrong axis, needs code fix</p>
        </div>
      </div>
    </div>
  );
}
