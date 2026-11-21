import React, { useState, useEffect } from 'react';
import {
  Hand,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Activity,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import {
  DEFAULT_FLEX_CALIBRATION,
  loadGloveCalibration,
  saveGloveCalibration,
  resetGloveCalibration
} from '../services/fingerSensorMapper';

const FINGER_DISPLAY_ORDER = [
  { key: 'index',  label: 'Index Finger',  channel: 'Sensor #1', pin: 'GPIO 33' },
  { key: 'middle', label: 'Middle Finger', channel: 'Sensor #2', pin: 'GPIO 34' },
  { key: 'ring',   label: 'Ring Finger',   channel: 'Sensor #3', pin: 'GPIO 35' },
  { key: 'little', label: 'Little Finger', channel: 'Sensor #4', pin: 'GPIO 32' },
  { key: 'thumb',  label: 'Thumb',         channel: 'Sensor #5', pin: 'GPIO 36' }
];

export default function LiveGloveCalibrationPanel({
  computedFingerData = null,
  rawSensorPacket = {},
  deviceConnected = false,
  onCalibrationChange = () => {},
  manualSlidersActive = false,
  onToggleManualSliders = () => {},
  manualSliderValues = { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 },
  onManualSliderChange = () => {},
  isOpen = true,
  onClose = null
}) {
  const [calibration, setCalibration] = useState(loadGloveCalibration);
  const [toastMessage, setToastMessage] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const loaded = loadGloveCalibration();
    setCalibration(loaded);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 1. Calibrate Flat (Open Hand): Capture current live readings as flat
  const handleCalibrateFlat = () => {
    const updated = { ...calibration };
    FINGER_DISPLAY_ORDER.forEach(({ key }) => {
      const debug = computedFingerData?.debug?.[key];
      const liveVal = debug?.filtered !== undefined 
        ? debug.filtered 
        : (debug?.raw !== null && debug?.raw !== undefined ? debug.raw : null);
      if (liveVal !== null && liveVal !== undefined && liveVal > 0) {
        updated[key] = {
          ...updated[key],
          flat: Math.round(liveVal),
          swing: (updated[key].bent || 0) - Math.round(liveVal)
        };
      }
    });

    setCalibration(updated);
    saveGloveCalibration(updated);
    onCalibrationChange(updated);
    showToast('✓ Flat Pose Captured (Open Hand)! Saved to localStorage.');
  };

  // 2. Calibrate Fist (Full Bend): Capture current live readings as bent
  const handleCalibrateFist = () => {
    const updated = { ...calibration };
    FINGER_DISPLAY_ORDER.forEach(({ key }) => {
      const debug = computedFingerData?.debug?.[key];
      const liveVal = debug?.filtered !== undefined 
        ? debug.filtered 
        : (debug?.raw !== null && debug?.raw !== undefined ? debug.raw : null);
      if (liveVal !== null && liveVal !== undefined && liveVal > 0) {
        updated[key] = {
          ...updated[key],
          bent: Math.round(liveVal),
          swing: Math.round(liveVal) - (updated[key].flat || 0)
        };
      }
    });

    setCalibration(updated);
    saveGloveCalibration(updated);
    onCalibrationChange(updated);
    showToast('✓ Fist Pose Captured (Full Bend)! Saved to localStorage.');
  };

  // 3. Reset Defaults: Restore hardcoded calibrated values
  const handleResetDefaults = () => {
    const restored = resetGloveCalibration();
    setCalibration(restored);
    onCalibrationChange(restored);
    showToast('↺ Restored default hardware calibration constants.');
  };

  // 4. Update specific finger calibration manually (e.g. for Sensor #5 / Thumb testing)
  const handleManualValueChange = (fingerKey, field, val) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    const updated = {
      ...calibration,
      [fingerKey]: {
        ...calibration[fingerKey],
        [field]: num,
        swing: field === 'bent' ? num - calibration[fingerKey].flat : calibration[fingerKey].bent - num
      }
    };
    setCalibration(updated);
    saveGloveCalibration(updated);
    onCalibrationChange(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl text-slate-200 transition-all duration-200 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Hand className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
              5-Finger Flex Glove Calibration
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                12 kΩ Voltage Divider
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              Signed ratio normalization &amp; two-stage anti-jitter skeletal smoothing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {toastMessage && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg animate-in fade-in">
              {toastMessage}
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
            title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Action Buttons Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={handleCalibrateFlat}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-blue-500/50 rounded-xl text-xs font-black text-blue-300 hover:text-blue-200 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer group"
            >
              <span className="text-sm group-hover:scale-110 transition-transform">🖐️</span>
              <span>Calibrate Flat (Open Hand)</span>
            </button>

            <button
              type="button"
              onClick={handleCalibrateFist}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-emerald-500/50 rounded-xl text-xs font-black text-emerald-300 hover:text-emerald-200 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer group"
            >
              <span className="text-sm group-hover:scale-110 transition-transform">✊</span>
              <span>Calibrate Fist (Full Bend)</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-amber-500/50 rounded-xl text-xs font-black text-amber-300 hover:text-amber-200 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer group"
            >
              <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-90 transition-transform" />
              <span>Reset Defaults</span>
            </button>
          </div>

          {/* 5-Finger Live Telemetry & Calibration Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/50">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Finger &amp; Channel</th>
                  <th className="py-2.5 px-3 text-center">Live Raw</th>
                  <th className="py-2.5 px-3 text-center">Filtered</th>
                  <th className="py-2.5 px-3 text-center">Flat ADC</th>
                  <th className="py-2.5 px-3 text-center">Bent ADC</th>
                  <th className="py-2.5 px-3 text-center">Swing (Δ)</th>
                  <th className="py-2.5 px-3">Bend Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {FINGER_DISPLAY_ORDER.map(({ key, label, channel, pin }) => {
                  const cal = calibration[key] || DEFAULT_FLEX_CALIBRATION[key];
                  const debug = computedFingerData?.debug?.[key];
                  const rawVal = debug?.raw !== null && debug?.raw !== undefined 
                    ? debug.raw 
                    : (rawSensorPacket?.['raw_' + key] ?? '--');
                  const filteredVal = debug?.filtered !== undefined ? debug.filtered : '--';
                  const pct = debug?.percentage !== undefined ? debug.percentage : 0;
                  const swing = (cal.bent || 0) - (cal.flat || 0);

                  return (
                    <tr key={key} className="hover:bg-slate-850/50 transition-colors">
                      {/* Finger & Channel */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-xs">{label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {channel} • <span className="text-blue-400 font-semibold">{pin}</span>
                          </span>
                        </div>
                      </td>

                      {/* Live Raw ADC */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-300">
                        {rawVal !== null && rawVal !== undefined ? rawVal : '--'}
                      </td>

                      {/* Filtered EMA */}
                      <td className="py-2.5 px-3 text-center font-mono font-black text-blue-400">
                        {filteredVal}
                      </td>

                      {/* Flat ADC Input */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          value={cal.flat}
                          onChange={(e) => handleManualValueChange(key, 'flat', e.target.value)}
                          className="w-16 px-1.5 py-1 text-center font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg text-emerald-300 font-bold focus:border-blue-500 focus:outline-none"
                        />
                      </td>

                      {/* Bent ADC Input */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          value={cal.bent}
                          onChange={(e) => handleManualValueChange(key, 'bent', e.target.value)}
                          className="w-16 px-1.5 py-1 text-center font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg text-amber-300 font-bold focus:border-blue-500 focus:outline-none"
                        />
                      </td>

                      {/* Swing (Delta) */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                          swing > 0 
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' 
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        }`}>
                          {swing > 0 ? `+${swing}` : `${swing}`}
                        </span>
                      </td>

                      {/* Bend Ratio Progress Bar */}
                      <td className="py-2.5 px-3 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-100 ease-out bg-gradient-to-r from-blue-500 to-emerald-400"
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                          <span className="font-mono font-black text-xs text-white w-9 text-right">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Manual Sliders Section (Offline / Fallback / Testing Mode) */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                  Manual Fallback Sliders (Test 3D Hand Bones)
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleManualSliders}
                className={`text-[11px] font-black px-3 py-1 rounded-full transition border cursor-pointer ${
                  manualSlidersActive
                    ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {manualSlidersActive ? 'Sliders Active (Controlling 3D)' : 'Enable Manual Sliders'}
              </button>
            </div>

            {manualSlidersActive && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-900/80 rounded-xl border border-purple-500/30 animate-in fade-in">
                {FINGER_DISPLAY_ORDER.map(({ key, label }) => {
                  const val = manualSliderValues[key] || 0;
                  return (
                    <div key={key} className="space-y-1.5 flex flex-col items-center">
                      <div className="flex justify-between w-full text-[10px] font-bold text-slate-300">
                        <span>{label}</span>
                        <span className="font-mono text-purple-300">{val}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={val}
                        onChange={(e) => onManualSliderChange(key, parseInt(e.target.value, 10))}
                        className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
