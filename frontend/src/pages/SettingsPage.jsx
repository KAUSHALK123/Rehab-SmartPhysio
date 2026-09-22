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
  Palette,
  Info
} from 'lucide-react';

function SettingsPage() {
  const { theme, isDark, darkStyle, setDarkStyle, accentColor, setAccentColor, setTheme, toggleTheme, DARK_STYLES, ACCENT_PRESETS } = useTheme();
  const [customHex, setCustomHex] = useState(accentColor);

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

        {/* Section 1: Appearance & Bespoke Theme Customization */}
        <div className={`p-6 rounded-2xl border transition-colors duration-200 space-y-6 ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
            <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--theme-accent, #10b981)' }}>
              <Palette className="w-4 h-4" />
              Appearance &amp; Dark Theme Studio
            </span>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border" style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              borderColor: 'var(--theme-border-main, rgba(255,255,255,0.1))',
              color: 'var(--theme-accent, #10b981)'
            }}>
              {isDark ? `${DARK_STYLES[darkStyle]?.name || 'Pitch Black'}` : 'Light Theme Active'}
            </span>
          </div>

          <div className="space-y-5">
            {/* Quick Toggle Switch Row */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Dark Theme Active</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Eliminate blueish AI templates with pure zero-light OLED black
                </p>
              </div>

              {/* Interactive Theme Switch Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 cursor-pointer border ${
                  isDark 
                    ? 'border-emerald-500 justify-end pr-1' 
                    : 'bg-slate-300 border-slate-300 justify-start pl-1'
                }`}
                style={isDark ? { backgroundColor: 'var(--theme-accent, #10b981)' } : {}}
              >
                <span className="sr-only">Toggle Theme</span>
                <span className="h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 flex items-center justify-center">
                  {isDark ? (
                    <Moon className="w-3 h-3 text-zinc-900" />
                  ) : (
                    <Sun className="w-3 h-3 text-amber-500" />
                  )}
                </span>
              </button>
            </div>

            {/* Darkness Tone Mode Selector (OLED / Obsidian / Stealth) */}
            {isDark && (
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                  <span>Base Darkness Tone</span>
                  <span className="text-[10px] text-zinc-400 font-mono">True Deep Black</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(DARK_STYLES).map((style) => {
                    const isSelected = darkStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => {
                          setDarkStyle(style.id);
                          showNotice(`Dark style set to ${style.name}`);
                        }}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer relative overflow-hidden ${
                          isSelected ? 'ring-2' : 'hover:border-zinc-600'
                        }`}
                        style={{
                          backgroundColor: style.bgCard,
                          borderColor: isSelected ? 'var(--theme-accent, #10b981)' : 'rgba(255,255,255,0.08)',
                          boxShadow: isSelected ? '0 0 14px var(--theme-accent-glow, rgba(16,185,129,0.25))' : 'none'
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div 
                            className="w-3 h-3 rounded-full border border-white/20"
                            style={{ backgroundColor: style.bgMain }}
                          />
                          <span className="text-xs font-bold truncate text-white">{style.name.split(' ')[0]}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate">{style.id === 'oled' ? '#000000 OLED' : style.id === 'obsidian' ? 'Graphite Carbon' : 'Matte Charcoal'}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Accent Color Palette & Native HTML5 Color Picker */}
            {isDark && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300">Accent Color &amp; Glow</label>
                  <div className="flex items-center gap-2">
                    {/* Native HTML5 Color Picker */}
                    <label 
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold cursor-pointer transition hover:scale-105"
                      style={{ 
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderColor: 'var(--theme-border-main, rgba(255,255,255,0.12))',
                        color: 'var(--theme-accent, #10b981)'
                      }}
                      title="Click to open full color spectrum picker"
                    >
                      <input 
                        type="color" 
                        value={accentColor} 
                        onChange={(e) => {
                          setAccentColor(e.target.value);
                          setCustomHex(e.target.value);
                          showNotice(`Custom color applied: ${e.target.value}`);
                        }}
                        className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span>Custom Picker</span>
                    </label>
                  </div>
                </div>

                {/* Preset Swatches */}
                <div className="grid grid-cols-4 gap-2">
                  {ACCENT_PRESETS.map((preset) => {
                    const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => {
                          setAccentColor(preset.hex);
                          setCustomHex(preset.hex);
                          showNotice(`Accent color set to ${preset.name}`);
                        }}
                        className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-semibold transition cursor-pointer ${
                          isSelected ? 'ring-2' : 'hover:border-zinc-600'
                        }`}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          borderColor: isSelected ? preset.hex : 'rgba(255,255,255,0.08)',
                          boxShadow: isSelected ? `0 0 10px ${preset.glow}` : 'none'
                        }}
                      >
                        <span 
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="truncate text-[11px] text-zinc-300">{preset.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Hex Code Input */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-zinc-400 font-mono">Hex Code:</span>
                  <input
                    type="text"
                    value={customHex}
                    onChange={(e) => {
                      setCustomHex(e.target.value);
                      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                        setAccentColor(e.target.value);
                        showNotice(`Applied hex: ${e.target.value}`);
                      }
                    }}
                    placeholder="#10b981"
                    maxLength={7}
                    className="w-28 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border bg-black/40 text-white outline-none focus:ring-1"
                    style={{ borderColor: 'var(--theme-border-main, rgba(255,255,255,0.15))' }}
                  />
                  <div 
                    className="w-5 h-5 rounded-md border border-white/20 ml-auto"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
              </div>
            )}

            <p className={`text-[11px] leading-relaxed p-2.5 rounded-xl border ${
              isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
            }`}>
              <Info className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
              Theme &amp; accent settings persist locally across sessions. Device Calibration remains in light high-contrast mode as calibrated.
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
