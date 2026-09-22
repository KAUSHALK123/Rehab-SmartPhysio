import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  X, 
  Palette, 
  Check, 
  Sun, 
  Moon, 
  Sparkles, 
  RotateCcw,
  Sliders,
  CheckCircle,
  Eye
} from 'lucide-react';

export default function ThemeCustomizerModal({ isOpen, onClose }) {
  const { 
    theme, 
    isDark, 
    darkStyle, 
    setDarkStyle, 
    accentColor, 
    setAccentColor, 
    setTheme, 
    toggleTheme,
    DARK_STYLES,
    ACCENT_PRESETS 
  } = useTheme();

  const [customHexInput, setCustomHexInput] = useState(accentColor);

  if (!isOpen) return null;

  const handleHexChange = (e) => {
    const val = e.target.value;
    setCustomHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setAccentColor(val);
    }
  };

  const handleNativePicker = (e) => {
    const val = e.target.value;
    setCustomHexInput(val);
    setAccentColor(val);
  };

  const handleReset = () => {
    setTheme('dark');
    setDarkStyle('oled');
    setAccentColor('#10b981');
    setCustomHexInput('#10b981');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: isDark ? 'var(--theme-bg-card, #0c0d10)' : '#ffffff',
          borderColor: isDark ? 'var(--theme-border-main, rgba(255,255,255,0.1))' : '#e2e8f0',
          color: isDark ? '#fafafa' : '#0f172a'
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-5 px-6 border-b"
          style={{ borderColor: isDark ? 'var(--theme-border-main, rgba(255,255,255,0.08))' : '#f1f5f9' }}
        >
          <div className="flex items-center gap-2.5">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-inner"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Theme &amp; Accent Studio</h3>
              <p className="text-xs text-zinc-400 font-medium">Bespoke luxury styling without generic AI templates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Section 1: Dark Mode Tone / Base Canvas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                1. Base Darkness System
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1.5"
                style={{ 
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                  backgroundColor: isDark ? '#181920' : '#f1f5f9'
                }}
              >
                {isDark ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-purple-500" />}
                {isDark ? 'Switch to Light' : 'Switch to Dark'}
              </button>
            </div>

            {isDark ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {Object.values(DARK_STYLES).map((style) => {
                  const isSelected = darkStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setDarkStyle(style.id)}
                      className="p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group"
                      style={{
                        backgroundColor: style.bgCard,
                        borderColor: isSelected ? accentColor : style.border,
                        boxShadow: isSelected ? `0 0 0 1px ${accentColor}, 0 4px 14px ${accentColor}25` : 'none'
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center" style={{ backgroundColor: style.bgMain }}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${accentColor}25`, color: accentColor }}>
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white tracking-tight">{style.name}</p>
                      <p className="text-[10px] text-zinc-400 leading-tight mt-1 line-clamp-2">{style.description}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 bg-zinc-100 rounded-2xl border border-zinc-200 text-xs text-zinc-600 flex items-center justify-between">
                <span>Light mode active. Switch to Dark above to customize deep black tones.</span>
              </div>
            )}
          </div>

          {/* Section 2: Accent Color Picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                2. Accent Color Palette
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${accentColor}25`, color: accentColor }}>
                {accentColor.toUpperCase()}
              </span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => {
                      setAccentColor(preset.hex);
                      setCustomHexInput(preset.hex);
                    }}
                    title={preset.name}
                    className="h-10 rounded-xl transition-all flex items-center justify-center cursor-pointer relative group"
                    style={{
                      backgroundColor: preset.hex,
                      boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 16px ${preset.hex}` : 'none',
                      transform: isSelected ? 'scale(1.08)' : 'scale(1)'
                    }}
                  >
                    {isSelected && (
                      <Check className="w-4 h-4 text-black drop-shadow" style={{ color: preset.hex === '#ffffff' ? '#000' : '#fff' }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Native Color Picker & Hex Input Bar */}
            <div 
              className="flex items-center gap-3 p-3 rounded-2xl border transition"
              style={{
                backgroundColor: isDark ? '#14151a' : '#f8fafc',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
              }}
            >
              {/* Native Picker Swatch */}
              <div className="relative flex items-center gap-2 cursor-pointer flex-shrink-0">
                <input
                  type="color"
                  value={accentColor}
                  onChange={handleNativePicker}
                  className="w-10 h-10 rounded-xl border-0 cursor-pointer p-0 bg-transparent"
                />
                <span className="text-xs font-bold text-zinc-400">Pick Custom Color</span>
              </div>

              <div className="flex-1 flex items-center justify-end gap-2">
                <span className="text-xs text-zinc-500 font-bold">HEX:</span>
                <input
                  type="text"
                  value={customHexInput}
                  onChange={handleHexChange}
                  placeholder="#10b981"
                  className="w-24 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold tracking-wider uppercase text-center transition"
                  style={{
                    backgroundColor: isDark ? '#0c0d10' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Live Preview */}
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Live Preview Preview
            </span>
            <div 
              className="p-4 rounded-2xl border transition-all space-y-3"
              style={{
                backgroundColor: isDark ? 'var(--theme-bg-main, #000000)' : '#f8fafc',
                borderColor: isDark ? 'var(--theme-border-main, rgba(255,255,255,0.08))' : '#e2e8f0'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
                  <span className="text-xs font-black tracking-tight" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                    Rehabilitation Telemetry HUD
                  </span>
                </div>
                <span 
                  className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                >
                  Active Sensor
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-black text-black transition shadow-sm"
                  style={{
                    backgroundColor: accentColor,
                    color: accentColor === '#ffffff' ? '#000000' : '#ffffff',
                    boxShadow: `0 2px 10px ${accentColor}40`
                  }}
                >
                  Primary Action Button
                </button>
                <button
                  type="button"
                  className="py-2 px-3 rounded-xl text-xs font-bold border transition"
                  style={{
                    backgroundColor: isDark ? '#14151a' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                    color: isDark ? '#e4e4e7' : '#475569'
                  }}
                >
                  Secondary Action
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between p-4 px-6 border-t"
          style={{ borderColor: isDark ? 'var(--theme-border-main, rgba(255,255,255,0.08))' : '#f1f5f9' }}
        >
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to OLED Default
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-black text-white transition shadow-sm cursor-pointer"
            style={{
              backgroundColor: accentColor,
              color: accentColor === '#ffffff' ? '#000000' : '#ffffff',
              boxShadow: `0 2px 10px ${accentColor}40`
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
