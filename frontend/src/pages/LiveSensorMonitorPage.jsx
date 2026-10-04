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
  Eye,
  XCircle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ─── GPIO reference (matches sleeve_firmware.ino PIN_ constants) ─────────────
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

// Raw field names sent by firmware in the JSON WebSocket packet
const FINGER_SENSORS = [
  { key: 'raw_thumb',  label: 'Thumb',  gpio: 'GPIO 32 (D32)', color: '#8b5cf6' },
  { key: 'raw_index',  label: 'Index',  gpio: 'GPIO 35 (D35)', color: '#3b82f6' },
  { key: 'raw_middle', label: 'Middle', gpio: 'GPIO 34 (D34)', color: '#10b981' },
  { key: 'raw_ring',   label: 'Ring',   gpio: 'GPIO 33 (D33)', color: '#f59e0b' },
  { key: 'raw_little', label: 'Little', gpio: 'VP / GPIO 36',  color: '#ef4444' },
];

const ADC_MAX = 4095; // ESP32 12-bit ADC

// ─── WebSocket URL helper ─────────────────────────────────────────────────────
function getWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsHost = host.includes(':5173') ? host.replace(':5173', ':8000') : host;
  return `${protocol}//${wsHost}/api/v1/device/ws`;
}

// ─── Pure raw ADC bar — NO calibration, NO angle mapping ─────────────────────
function RawBar({ raw, color }) {
  // pct is purely: raw / 4095 * 100. Nothing else.
  const pct = (raw !== undefined && raw !== null) ? Math.min(100, Math.round((raw / ADC_MAX) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-3 rounded-full bg-slate-700/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-mono font-bold text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Single sensor row ────────────────────────────────────────────────────────
function SensorRow({ label, gpio, color, rawValue, isDark }) {
  const hasValue = rawValue !== undefined && rawValue !== null;
  return (
    <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
      {/* Label */}
      <td className="py-3 px-4 w-40">
        <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{label}</div>
        <div className="text-[10px] font-mono text-slate-500">{gpio}</div>
      </td>

      {/* Raw ADC number — the ONLY value shown */}
      <td className="py-3 px-4 w-32">
        <span className={`font-mono text-xl font-black ${hasValue ? (isDark ? 'text-white' : 'text-slate-800') : 'text-slate-600'}`}>
          {hasValue ? Math.round(rawValue) : '\u2014'}
        </span>
        <div className="text-[9px] text-slate-500">/ {ADC_MAX}</div>
      </td>

      {/* Bar — raw / 4095, no processing */}
      <td className="py-3 px-4">
        <RawBar raw={rawValue} color={color} />
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LiveSensorMonitorPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const wsRef = useRef(null);

  const [packet, setPacket]                 = useState(null);
  const [isMock, setIsMock]                 = useState(false);
  const [isHardware, setIsHardware]         = useState(false);
  const [connected, setConnected]           = useState(false);
  const [packetCount, setPacketCount]       = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState(null);
  const [wsState, setWsState]               = useState('disconnected');

  // ── WebSocket — viewer-only, sends NOTHING ─────────────────────────────────
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
            const mock = !!data.is_mock;
            setIsMock(mock);
            setIsHardware(!mock);
            setConnected(true);
            setPacket(data);                        // store full packet as-is
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

  // Age of last packet (for staleness warning)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const msSince = lastPacketTime ? now - lastPacketTime : null;

  // MPU raw values — these ARE live hardware, not mapped
  const pitch   = packet?.wrist_pitch ?? packet?.pitch;
  const roll    = packet?.wrist_roll  ?? packet?.roll;
  const mpuOk   = packet?.mpu_working;

  // Elbow and pressure raw
  const rawElbow    = packet?.raw_elbow;
  const rawPressure = packet?.raw_pressure;

  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
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
              Pure raw ADC values only &mdash; no processing, no calibration, no mapping
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-3 flex-wrap">
          {wsState === 'connecting' && !connected ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
              <RefreshCw className="w-3 h-3 animate-spin" /> Connecting&hellip;
            </span>
          ) : connected && isHardware ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Hardware Live
            </span>
          ) : connected && isMock ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-950/70 text-orange-400 border border-orange-500/30">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              SIMULATED
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

          {msSince !== null && (
            <span className={`text-[11px] font-mono ${msSince > 3000 ? 'text-red-400' : 'text-slate-500'}`}>
              {(msSince / 1000).toFixed(1)}s ago
            </span>
          )}
        </div>
      </div>

      {/* ── MOCK DATA WARNING — shown whenever is_mock=true ──────────────────── */}
      {isMock && packet && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl border-2 border-orange-500/60 bg-orange-950/40">
          <XCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-orange-300">SIMULATED DATA &mdash; ESP32 not connected</p>
            <p className="text-xs text-orange-400/80 mt-0.5">
              The backend is sending fake/random telemetry because the hardware device is offline.
              These values do NOT reflect real sensor readings. Connect the ESP32 sleeve and refresh to see live data.
            </p>
          </div>
        </div>
      )}

      {/* ── Read-only notice ─────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
        isDark ? 'bg-cyan-950/30 border-cyan-800/40 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-700'
      }`}>
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">
          <strong>READ-ONLY.</strong> Showing only <code className="font-mono bg-black/20 px-1 rounded">raw_*</code> ADC fields
          straight from the WebSocket packet &mdash; no angle mapping, no calibration, no EMA.
        </span>
      </div>

      {/* ── No packet yet ──────────────────────────────────────────────────────  */}
      {!packet && (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
          isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Waiting for sensor data&hellip;</p>
            <p className="text-xs text-slate-500">
              {wsState === 'connecting'
                ? 'Establishing WebSocket connection\u2026'
                : wsState === 'open'
                ? 'Socket open \u2014 waiting for ESP32 telemetry\u2026'
                : 'Socket closed \u2014 reconnecting in 4 s\u2026'}
            </p>
          </div>
        </div>
      )}

      {/* ── FINGER FLEX SENSORS ──────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <span className="text-lg">✋</span>
          <div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Finger Flex Sensors</h3>
            <p className="text-[10px] text-slate-500">
              Direct <code className="font-mono bg-black/20 px-1 rounded">raw_*</code> ADC reading (0&ndash;4095) from firmware JSON packet &mdash; no angle mapping applied
            </p>
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              <th className="py-2 px-4">Finger / GPIO Pin</th>
              <th className="py-2 px-4">Raw ADC (0&ndash;4095)</th>
              <th className="py-2 px-4">% of Max ADC</th>
            </tr>
          </thead>
          <tbody>
            {FINGER_SENSORS.map(({ key, label, gpio, color }) => (
              <SensorRow
                key={key}
                label={label}
                gpio={gpio}
                color={color}
                rawValue={packet?.[key]}
                isDark={isDark}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── ELBOW FLEX SENSOR ────────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`px-5 py-4 border-b flex items-center gap-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <span className="text-lg">💪</span>
          <div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Elbow Flex Sensor</h3>
            <p className="text-[10px] text-slate-500">VN / GPIO 39 &mdash; ADC1_CH3</p>
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              <th className="py-2 px-4">Sensor / GPIO Pin</th>
              <th className="py-2 px-4">Raw ADC (0&ndash;4095)</th>
              <th className="py-2 px-4">% of Max ADC</th>
            </tr>
          </thead>
          <tbody>
            <SensorRow
              label="Elbow"
              gpio="VN / GPIO 39"
              color="#3b82f6"
              rawValue={rawElbow}
              isDark={isDark}
            />
          </tbody>
        </table>
      </div>

      {/* ── MPU-6050 + Grip Pressure ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* MPU-6050 */}
        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-950/60 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>MPU-6050 IMU</h3>
              <p className="text-[10px] text-slate-500">GPIO 21 (SDA) &amp; GPIO 22 (SCL) &mdash; I&sup2;C</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'I\u00b2C Status',
                value: mpuOk === undefined ? '\u2014' : mpuOk ? 'OK' : 'No Ack',
                color: mpuOk === undefined ? 'text-slate-400' : mpuOk ? 'text-emerald-400' : 'text-red-400',
                icon: mpuOk === true ? '✓' : mpuOk === false ? '✗' : '?'
              },
              {
                label: 'Pitch',
                value: pitch !== undefined ? `${Number(pitch).toFixed(2)}\u00b0` : '\u2014',
                color: 'text-violet-400',
                icon: <Activity className="w-4 h-4 mx-auto" />
              },
              {
                label: 'Roll',
                value: roll !== undefined ? `${Number(roll).toFixed(2)}\u00b0` : '\u2014',
                color: 'text-blue-400',
                icon: <Activity className="w-4 h-4 mx-auto" />
              },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 border text-center ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`text-base mb-1 ${s.color}`}>{s.icon}</div>
                <div className={`text-sm font-black font-mono ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-3">
            MPU values are orientation angles from the DMP/gyro integration &mdash; not raw register reads.
          </p>
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
          <div className={`rounded-xl p-4 border mb-3 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <div className="text-[10px] text-slate-500 mb-1">raw_pressure ADC value</div>
            <div className={`text-3xl font-black font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {rawPressure !== undefined ? Math.round(rawPressure) : '\u2014'}
            </div>
            <div className="text-[9px] text-slate-500">/ {ADC_MAX}</div>
          </div>
          <RawBar raw={rawPressure} color="#f43f5e" />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>No press</span>
            <span className="font-bold text-rose-400">
              {rawPressure !== undefined ? Math.min(100, Math.round((rawPressure / ADC_MAX) * 100)) : 0}%
            </span>
            <span>Max (4095)</span>
          </div>
        </div>
      </div>

      {/* ── GPIO Reference Table ─────────────────────────────────────────────── */}
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
