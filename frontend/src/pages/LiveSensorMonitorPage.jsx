import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronLeft,
  WifiOff,
  Cpu,
  Zap,
  Radio,
  RefreshCw,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ─── GPIO reference (matches sleeve_firmware.ino) ────────────────────────────
const FINGER_COLORS = {
  thumb:  { bar: '#8b5cf6', text: 'text-violet-400'  },
  index:  { bar: '#3b82f6', text: 'text-blue-400'    },
  middle: { bar: '#10b981', text: 'text-emerald-400' },
  ring:   { bar: '#f59e0b', text: 'text-amber-400'   },
  little: { bar: '#ef4444', text: 'text-red-400'     },
};

const GPIO_ROWS = [
  ['Thumb',    'PIN_THUMB',    'GPIO 32 (D32)', 'ADC1_CH4'],
  ['Index',    'PIN_INDEX',    'GPIO 35 (D35)', 'ADC1_CH7'],
  ['Middle',   'PIN_MIDDLE',   'GPIO 34 (D34)', 'ADC1_CH6'],
  ['Ring',     'PIN_RING',     'GPIO 33 (D33)', 'ADC1_CH5'],
  ['Little',   'PIN_LITTLE',   'GPIO 36 (VP)',  'ADC1_CH0'],
  ['Elbow',    'PIN_ELBOW',    'GPIO 39 (VN)',  'ADC1_CH3'],
  ['Pressure', 'PIN_PRESSURE', 'GPIO 25 (D25)', 'DAC1'],
  ['MPU SDA',  'Wire.begin()', 'GPIO 21',       'I\u00b2C Data'],
  ['MPU SCL',  'Wire.begin()', 'GPIO 22',       'I\u00b2C Clock'],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsHost = host.includes(':5173') ? host.replace(':5173', ':8000') : host;
  return `${protocol}//${wsHost}/api/v1/device/ws`;
}

function fmtRaw(v) {
  if (v === undefined || v === null) return '\u2014';
  return Math.round(v);
}

function fmtAngle(v) {
  if (v === undefined || v === null) return '\u2014';
  if (typeof v === 'object') return (v.angle ?? 0).toFixed(1) + '\u00b0';
  return Number(v).toFixed(1) + '\u00b0';
}

function anglePct(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'object') return Math.round(((v.angle ?? 0) / 90) * 100);
  if (v <= 90) return Math.round((v / 90) * 100);
  return Math.round(Math.min(100, (v / 4095) * 100));
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CurlBar({ pct = 0, color = '#3b82f6' }) {
  return (
    <div className="w-full h-2 rounded-full bg-slate-700/40 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-150"
        style={{ width: `${Math.min(100, pct)}%`, background: color }}
      />
    </div>
  );
}

function SensorRow({ label, emoji, gpioLabel, rawKey, angleKey, colorKey, packet, isDark }) {
  const raw   = packet?.[rawKey];
  const angle = packet?.[angleKey];
  const p     = anglePct(angle);
  const color = (FINGER_COLORS[colorKey] || FINGER_COLORS.index).bar;
  const textColor = (FINGER_COLORS[colorKey] || FINGER_COLORS.index).text;

  return (
    <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'} transition-colors`}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <div>
            <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{label}</div>
            <div className="text-[10px] text-slate-500 font-mono">{gpioLabel}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`font-mono text-sm font-bold ${packet ? (isDark ? 'text-slate-200' : 'text-slate-700') : 'text-slate-500'}`}>
          {fmtRaw(raw)}
        </span>
        <div className="text-[9px] text-slate-500">/ 4095</div>
      </td>
      <td className="py-3 px-4">
        <span className={`font-mono text-sm font-bold ${textColor}`}>{fmtAngle(angle)}</span>
      </td>
      <td className="py-3 px-4" style={{ minWidth: '140px' }}>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold">
            <span className={textColor}>{p}%</span>
            <span className="text-slate-500">{p < 30 ? 'Open' : p < 65 ? 'Partial' : 'Curled'}</span>
          </div>
          <CurlBar pct={p} color={color} />
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LiveSensorMonitorPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const wsRef = useRef(null);

  const [connected, setConnected]           = useState(false);
  const [isHardware, setIsHardware]         = useState(false);
  const [packet, setPacket]                 = useState(null);
  const [packetCount, setPacketCount]       = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState(null);
  const [wsState, setWsState]               = useState('disconnected');

  // ── WebSocket (viewer-only — sends NOTHING) ─────────────────────────────
  useEffect(() => {
    let ws;
    let reconnectTimer = null;

    function connect() {
      setWsState('connecting');
      ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => setWsState('open');

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'status_update') {
            setConnected(!!data.hardware_connected);
          }
          if (data.type === 'sensor_data') {
            setIsHardware(!data.is_mock);
            setConnected(true);
            setPacket(data);
            setLastPacketTime(Date.now());
            setPacketCount(n => n + 1);
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        setWsState('closed');
        setConnected(false);
        reconnectTimer = setTimeout(connect, 4000);
      };

      ws.onerror = () => setWsState('error');
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const timeSince = lastPacketTime ? ((Date.now() - lastPacketTime) / 1000).toFixed(1) : null;

  // ── MPU data ────────────────────────────────────────────────────────────
  const pitch  = packet?.wrist_pitch ?? packet?.pitch;
  const roll   = packet?.wrist_roll  ?? packet?.roll;
  const mpuOk  = packet?.mpu_working;

  // ── Pressure data ───────────────────────────────────────────────────────
  const rawP    = packet?.raw_pressure ?? packet?.pressure;
  const mapped  = rawP !== undefined ? Math.round(Math.min(rawP, 3000) / 3000 * 800) : undefined;
  const pBar    = rawP !== undefined ? Math.min(100, Math.round((Math.min(rawP, 3000) / 3000) * 100)) : 0;

  // ── Elbow data ──────────────────────────────────────────────────────────
  const rawE  = packet?.raw_elbow;
  const angE  = packet?.elbow;
  const pE    = angE !== undefined ? Math.round(Number(angE) / 90 * 100) : 0;

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className={`p-5 md:p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/exercises')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition flex-shrink-0 cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="Back to Exercise Library"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDark ? 'bg-cyan-950/80 text-cyan-400' : 'bg-cyan-50 text-cyan-600'
          }`}>
            <Radio className="w-6 h-6" />
          </div>

          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Live Sensor Monitor</h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Read-only diagnostic view &mdash; verify sensor wiring &amp; live ADC values
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status badge */}
          {wsState === 'connecting' && !connected ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
              <RefreshCw className="w-3 h-3 animate-spin" /> Connecting&hellip;
            </span>
          ) : connected && isHardware ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Hardware Live
            </span>
          ) : connected ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-950/70 text-blue-400 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
              Simulated
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
              <WifiOff className="w-3 h-3" /> ESP32 Offline
            </span>
          )}

          <div className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border ${
            isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}>
            {packetCount} pkts
          </div>
          {timeSince && (
            <div className="text-[11px] text-slate-500">Last: {timeSince}s ago</div>
          )}
        </div>
      </div>

      {/* Read-only notice */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
        isDark ? 'bg-cyan-950/30 border-cyan-800/40 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-700'
      }`}>
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">
          <strong>READ-ONLY monitor.</strong> This page sends zero commands to the device &mdash;
          it only observes the live telemetry stream already broadcast by the backend WebSocket.
        </span>
      </div>

      {/* No signal banner */}
      {!packet && (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
          isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Waiting for sensor data&hellip;</p>
            <p className="text-xs text-slate-500">
              {wsState === 'connecting' ? 'Establishing WebSocket connection to backend\u2026' :
               wsState === 'open'       ? 'Connected \u2014 waiting for ESP32 telemetry packets\u2026' :
               'WebSocket closed. Reconnecting in a few seconds\u2026'}
            </p>
          </div>
        </div>
      )}

      {/* ── FINGER FLEX SENSORS ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <span className="text-lg">✋</span>
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Live Finger Flex Sensors</h3>
          <span className="text-[10px] text-slate-500 ml-auto">Raw ADC (0&ndash;4095) &rarr; Angle (0&ndash;90&deg;)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                <th className="py-2 px-4">Finger / GPIO</th>
                <th className="py-2 px-4">Raw ADC</th>
                <th className="py-2 px-4">Angle</th>
                <th className="py-2 px-4">Curl %</th>
              </tr>
            </thead>
            <tbody>
              <SensorRow label="Thumb"  emoji="👍" gpioLabel="GPIO 32 (D32)" colorKey="thumb"  rawKey="raw_thumb"  angleKey="thumb"  packet={packet} isDark={isDark} />
              <SensorRow label="Index"  emoji="☝" gpioLabel="GPIO 35 (D35)"  colorKey="index"  rawKey="raw_index"  angleKey="index"  packet={packet} isDark={isDark} />
              <SensorRow label="Middle" emoji="🖐" gpioLabel="GPIO 34 (D34)"  colorKey="middle" rawKey="raw_middle" angleKey="middle" packet={packet} isDark={isDark} />
              <SensorRow label="Ring"   emoji="💍" gpioLabel="GPIO 33 (D33)" colorKey="ring"   rawKey="raw_ring"   angleKey="ring"   packet={packet} isDark={isDark} />
              <SensorRow label="Little" emoji="🤙" gpioLabel="VP / GPIO 36"  colorKey="little" rawKey="raw_little" angleKey="little" packet={packet} isDark={isDark} />
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ELBOW FLEX SENSOR ────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <span className="text-lg">💪</span>
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Elbow Flex Sensor</h3>
          <span className="text-[10px] text-slate-500 ml-auto">VN / GPIO 39 &mdash; ADC1_CH3</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                <th className="py-2 px-4">Sensor / GPIO</th>
                <th className="py-2 px-4">Raw ADC</th>
                <th className="py-2 px-4">Angle</th>
                <th className="py-2 px-4">Flex %</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💪</span>
                    <div>
                      <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Elbow</div>
                      <div className="text-[10px] text-slate-500 font-mono">VN / GPIO 39</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`font-mono text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmtRaw(rawE)}</span>
                  <div className="text-[9px] text-slate-500">/ 4095</div>
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono text-sm font-bold text-blue-400">{fmtAngle(angE)}</span>
                </td>
                <td className="py-3 px-4" style={{ minWidth: '140px' }}>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-blue-400">{pE}%</span>
                      <span className="text-slate-500">{pE < 30 ? 'Extended' : pE < 65 ? 'Partial' : 'Flexed'}</span>
                    </div>
                    <CurlBar pct={pE} color="#3b82f6" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MPU + Pressure Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* MPU-6050 */}
        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-950/60 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>MPU-6050 IMU</h3>
              <p className="text-[10px] text-slate-500">GPIO 21 (SDA) / GPIO 22 (SCL) &mdash; I&sup2;C</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'MPU I\u00b2C', value: mpuOk === undefined ? '\u2014' : mpuOk ? 'OK' : 'No Ack', ok: mpuOk },
              { label: 'Pitch', value: pitch !== undefined ? `${Number(pitch).toFixed(1)}\u00b0` : '\u2014' },
              { label: 'Roll',  value: roll  !== undefined ? `${Number(roll ).toFixed(1)}\u00b0` : '\u2014' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 border text-center ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`text-base mb-1 ${s.ok === true ? 'text-emerald-400' : s.ok === false ? 'text-red-400' : 'text-slate-400'}`}>
                  {s.ok === true ? '✓' : s.ok === false ? '✗' : <Activity className="w-4 h-4 mx-auto" />}
                </div>
                <div className={`text-xs font-bold font-mono ${
                  s.ok === true ? 'text-emerald-400' : s.ok === false ? 'text-red-400' : isDark ? 'text-slate-200' : 'text-slate-700'
                }`}>{s.value}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grip Pressure */}
        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-950/60 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Grip Pressure (FSR)</h3>
              <p className="text-[10px] text-slate-500">GPIO 25 (D25) &mdash; Analog</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className={`rounded-xl p-3 border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-[10px] text-slate-500 mb-1">Raw ADC</div>
              <div className={`text-lg font-black font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmtRaw(rawP)}</div>
              <div className="text-[9px] text-slate-500">/ 4095</div>
            </div>
            <div className={`rounded-xl p-3 border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-[10px] text-slate-500 mb-1">Approx. Force</div>
              <div className="text-lg font-black font-mono text-rose-400">{mapped !== undefined ? mapped : '\u2014'}</div>
              <div className="text-[9px] text-slate-500">/ 800 N-approx</div>
            </div>
          </div>
          <CurlBar pct={pBar} color="#f43f5e" />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>No press</span>
            <span className="font-bold text-rose-400">{pBar}%</span>
            <span>Max squeeze</span>
          </div>
        </div>
      </div>

      {/* ── GPIO Reference Table ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-slate-400" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Firmware GPIO Reference</h3>
          <span className="text-[10px] text-slate-500 ml-auto font-mono">sleeve_firmware.ino &mdash; PIN_ constants</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                <th className="py-2 px-3">Sensor</th>
                <th className="py-2 px-3">Constant</th>
                <th className="py-2 px-3">GPIO</th>
                <th className="py-2 px-3">ADC Channel</th>
              </tr>
            </thead>
            <tbody className={`text-xs font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {GPIO_ROWS.map(([sensor, constant, gpio, adc]) => (
                <tr key={sensor} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className="py-2 px-3 font-bold text-slate-400">{sensor}</td>
                  <td className="py-2 px-3 text-cyan-400">{constant}</td>
                  <td className="py-2 px-3 text-amber-400">{gpio}</td>
                  <td className="py-2 px-3 text-slate-500">{adc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
