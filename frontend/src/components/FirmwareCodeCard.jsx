import React, { useState } from 'react';
import { 
  Code, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Maximize2, 
  Minimize2, 
  X, 
  Cpu, 
  FileCode,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { FIRMWARE_CODE } from '../data/firmwareCode';
import { useTheme } from '../context/ThemeContext';

export default function FirmwareCodeCard() {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(FIRMWARE_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy firmware code:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([FIRMWARE_CODE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sleeve_firmware.ino';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lines = FIRMWARE_CODE.split('\n');

  return (
    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
      {/* Pop Open / Close Card Container */}
      <div 
        className="rounded-2xl border transition-all duration-200 overflow-hidden"
        style={{
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : '#f8fafc',
          borderColor: isDark ? 'var(--theme-border-main, rgba(255,255,255,0.08))' : '#e2e8f0'
        }}
      >
        {/* Toggle Header Row */}
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="p-3.5 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition select-none group"
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--theme-accent, #10b981)'
              }}
            >
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs tracking-tight text-white group-hover:text-emerald-400 transition">
                  ESP32 C++ Firmware Source
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800 text-emerald-300 font-bold">
                  sleeve_firmware.ino
                </span>
              </div>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {lines.length} lines • Arduino / ESP32 • 10Hz WebSocket Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span 
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg border transition"
              style={{
                backgroundColor: isOpen ? 'var(--theme-accent, #10b981)' : 'rgba(255,255,255,0.04)',
                borderColor: isOpen ? 'var(--theme-accent, #10b981)' : 'var(--theme-border-main, rgba(255,255,255,0.1))',
                color: isOpen ? '#ffffff' : 'var(--theme-accent, #10b981)'
              }}
            >
              {isOpen ? 'Close Code' : 'Pop Open Code'}
            </span>
            <div className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Collapsible Body Inside Card */}
        {isOpen && (
          <div className="p-4 pt-1 space-y-3 border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              {/* Wiring Pin Layout Pill */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>GPIO: 32 Thumb • 33 Index • 34 Mid • 35 Ring • 36 Little • 39 Elbow • 21/22 MPU</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
                  style={{
                    backgroundColor: copied ? '#10b981' : 'rgba(255,255,255,0.06)',
                    color: copied ? '#ffffff' : 'var(--theme-accent, #10b981)',
                    border: '1px solid',
                    borderColor: copied ? '#10b981' : 'var(--theme-border-main, rgba(255,255,255,0.12))'
                  }}
                  title="Copy full C++ firmware code to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Code!' : 'Copy Full Code'}</span>
                </button>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer hover:bg-white/10 border text-zinc-300 hover:text-white"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: 'var(--theme-border-main, rgba(255,255,255,0.1))'
                  }}
                  title="Download .ino file for Arduino IDE"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .ino</span>
                </button>

                {/* Pop Out to Full Modal */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer hover:bg-white/10 border text-zinc-300 hover:text-white"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: 'var(--theme-border-main, rgba(255,255,255,0.1))'
                  }}
                  title="Open in full screen modal reader"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Pop Out</span>
                </button>
              </div>
            </div>

            {/* Code Box with Line Numbers */}
            <div 
              className="rounded-xl border overflow-hidden font-mono text-[11px] leading-relaxed shadow-inner"
              style={{
                backgroundColor: '#050507',
                borderColor: 'var(--theme-border-main, rgba(255,255,255,0.1))'
              }}
            >
              <div className="flex max-h-[360px] overflow-y-auto select-all">
                {/* Line Numbers Column */}
                <div 
                  className="py-3 px-2 text-right select-none text-zinc-600 bg-black/40 border-r border-zinc-800/80 font-mono text-[10px]"
                  style={{ minWidth: '40px' }}
                >
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>

                {/* Code Text Column */}
                <pre className="p-3 text-emerald-400 overflow-x-auto flex-1 font-mono">
                  <code>{FIRMWARE_CODE}</code>
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pop-Out Full Modal View */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-5xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            style={{
              backgroundColor: isDark ? 'var(--theme-bg-card, #0c0d10)' : '#ffffff',
              borderColor: 'var(--theme-border-main, rgba(255,255,255,0.15))',
              color: isDark ? '#ffffff' : '#0f172a'
            }}
          >
            {/* Modal Header */}
            <div 
              className="flex items-center justify-between p-5 px-6 border-b"
              style={{ borderColor: 'var(--theme-border-main, rgba(255,255,255,0.08))' }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--theme-accent, #10b981)'
                  }}
                >
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base tracking-tight">SmartPhysio ESP32 Firmware</h3>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                      sleeve_firmware.ino
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    494 lines • WebSocket 10Hz Client • MPU6050 I2C + 5-Finger EMA Filters
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Copy in Modal */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm hover:scale-105"
                  style={{
                    backgroundColor: copied ? '#10b981' : 'rgba(255,255,255,0.06)',
                    color: copied ? '#ffffff' : 'var(--theme-accent, #10b981)',
                    border: '1px solid',
                    borderColor: copied ? '#10b981' : 'var(--theme-border-main, rgba(255,255,255,0.15))'
                  }}
                >
                  {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                </button>

                {/* Download in Modal */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border text-zinc-300 hover:text-white"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: 'var(--theme-border-main, rgba(255,255,255,0.1))'
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>

                {/* Close Modal */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Full Code Viewer */}
            <div className="flex-1 p-5 overflow-hidden flex flex-col">
              <div 
                className="flex-1 rounded-2xl border overflow-hidden font-mono text-xs leading-relaxed flex shadow-2xl"
                style={{
                  backgroundColor: '#030305',
                  borderColor: 'var(--theme-border-main, rgba(255,255,255,0.1))'
                }}
              >
                {/* Line Numbers */}
                <div 
                  className="py-4 px-3 text-right select-none text-zinc-600 bg-black/60 border-r border-zinc-800/80 font-mono text-[11px]"
                  style={{ minWidth: '50px' }}
                >
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>

                {/* Code Text */}
                <pre className="p-4 text-emerald-400 overflow-auto flex-1 font-mono select-all">
                  <code>{FIRMWARE_CODE}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
