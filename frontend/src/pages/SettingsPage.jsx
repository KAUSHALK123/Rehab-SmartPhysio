import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Moon, 
  Sun, 
  Monitor, 
  Cpu, 
  Volume2, 
  VolumeX, 
  Sliders, 
  ShieldCheck, 
  RotateCcw,
  Check,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';

function SettingsPage() {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();

  // Local settings state
  const [audioGuidance, setAudioGuidance] = useState(
    localStorage.getItem('audioGuidance') !== 'false'
  );
  const [romThreshold, setRomThreshold] = useState(
    localStorage.getItem('romThreshold') || 'standard'
  );
  const [notice, setNotice] = useState('');

  const handleAudioToggle = () => {
    const nextVal = !audioGuidance;
    setAudioGuidance(nextVal);
    localStorage.setItem('audioGuidance', String(nextVal));
    showNotice('Audio guidance preference saved!');
  };

  const handleRomChange = (val) => {
    setRomThreshold(val);
    localStorage.setItem('romThreshold', val);
    showNotice(`Range-of-Motion threshold updated to ${val}!`);
  };

  const showNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleResetSettings = () => {
    setTheme('light');
    setAudioGuidance(true);
    setRomThreshold('standard');
    localStorage.removeItem('theme');
    localStorage.removeItem('audioGuidance');
    localStorage.removeItem('romThreshold');
    showNotice('Application settings restored to defaults!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner Header */}
      <div className={`p-6 rounded-2xl border transition-colors duration-200 shadow-sm flex items-center justify-between ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div>
          <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-500" />
            Application Settings
          </h3>
          <p className={`text-xs mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Configure your application theme appearance, IoT device sleeve variables, and therapeutic system preferences.
          </p>
        </div>

        {notice && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {notice}
          </div>
        )}
      </div>

      {/* Main Settings Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Section 1: Appearance & Theme Customization */}
        <div className={`p-6 rounded-2xl border transition-colors duration-200 space-y-5 ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-500 flex items-center gap-2">
              {isDark ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              Appearance &amp; Dark Theme
            </span>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
              isDark 
                ? 'bg-purple-950/80 text-purple-300 border-purple-800' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {isDark ? 'Dark Theme Active' : 'Light Theme Active'}
            </span>
          </div>

          <div className="space-y-4">
            {/* Quick Toggle Switch Row */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Dark Mode Toggle</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Switch global interface color scheme
                </p>
              </div>

              {/* Interactive Theme Switch Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 cursor-pointer border ${
                  isDark 
                    ? 'bg-blue-600 border-blue-500 justify-end pr-1' 
                    : 'bg-slate-300 border-slate-300 justify-start pl-1'
                }`}
              >
                <span className="sr-only">Toggle Theme</span>
                <span className={`h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 flex items-center justify-center`}>
                  {isDark ? (
                    <Moon className="w-3 h-3 text-purple-600" />
                  ) : (
                    <Sun className="w-3 h-3 text-amber-500" />
                  )}
                </span>
              </button>
            </div>

            {/* Theme Mode Selector Cards */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition cursor-pointer ${
                  !isDark 
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20' 
                    : isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                Light Mode
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition cursor-pointer ${
                  isDark 
                    ? 'bg-blue-950/80 border-blue-500 text-blue-300 ring-2 ring-blue-500/30' 
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Moon className="w-4 h-4 text-purple-400" />
                Dark Mode
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition cursor-pointer ${
                  isDark ? 'bg-slate-800/60 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <Monitor className="w-4 h-4 text-slate-400" />
                System Auto
              </button>
            </div>

            <p className={`text-[11px] leading-relaxed p-2.5 rounded-xl border ${
              isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
            }`}>
              <Info className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
              Note: Theme preferences apply globally across all pages and tabs in the application, except for <strong>Device Calibration</strong> which remains in light calibration mode.
            </p>
          </div>
        </div>

        {/* Section 2: IoT Sleeve Firmware & Hardware Diagnostics */}
        <div className={`p-6 rounded-2xl border transition-colors duration-200 space-y-5 ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-500" />
              IoT Sleeve Firmware &amp; Hardware
            </span>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Firmware v1.0.0
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">ESP32 Firmware Status</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  SmartPhysio Wearable Sleeve Controller
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400">Up to Date</span>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div>
                <p className="font-bold text-sm">WebSocket Gateway URL</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Real-time sensor stream endpoint
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-blue-500 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-900">
                /api/v1/device/ws
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div>
                <p className="font-bold text-sm">Baud Rate Protocol</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  MPU6050 + Flex sensor UART rate
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400">115,200 Baud</span>
            </div>
          </div>
        </div>

        {/* Section 3: Rehabilitation Guidance & Audio Feedback */}
        <div className={`p-6 rounded-2xl border transition-colors duration-200 space-y-5 ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
            <span className="text-xs font-extrabold uppercase tracking-wider text-purple-500 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-purple-500" />
              Rehabilitation Guidance
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">Audio Repetition Cues</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Spoken posture guidance &amp; rep completion beeps
                </p>
              </div>
              <button
                type="button"
                onClick={handleAudioToggle}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  audioGuidance 
                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800' 
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}
              >
                {audioGuidance ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                {audioGuidance ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="font-bold text-sm block">Range-of-Motion (ROM) Target Sensitivity</label>
              <select
                value={romThreshold}
                onChange={(e) => handleRomChange(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-200' 
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="strict">Strict (100% Target Angle Required for Rep)</option>
                <option value="standard">Standard (85% Target Angle Required for Rep)</option>
                <option value="gentle">Gentle / Acute Therapy (70% Target Angle Required)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: System Reset & Maintenance */}
        <div className={`p-6 rounded-2xl border transition-colors duration-200 space-y-5 flex flex-col justify-between ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-500 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-500" />
                Reset &amp; Maintenance
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <p className="font-bold text-sm">Restore Application Defaults</p>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Reset color theme, local storage preferences, audio settings, and active patient selections back to initial factory settings.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetSettings}
            className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 font-extrabold rounded-xl border border-rose-200 dark:border-rose-900 text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Restore Default Settings
          </button>
        </div>

      </div>
    </div>
  );
}

export default SettingsPage;
