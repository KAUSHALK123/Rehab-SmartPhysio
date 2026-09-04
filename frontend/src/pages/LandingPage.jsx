import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, 
  Play, 
  ArrowRight, 
  CheckCircle2, 
  RotateCcw, 
  Activity, 
  Sliders, 
  BookOpen, 
  ShieldCheck, 
  TrendingUp, 
  Cpu 
} from 'lucide-react';
import SensorCard from '../components/SensorCard';
import Arm3DVisualizer from '../components/Arm3DVisualizer';

export default function LandingPage() {
  const navigate = useNavigate();
  const [autoRotate, setAutoRotate] = useState(true);
  const [cameraAngle, setCameraAngle] = useState('straight');
  const [activeSensorKey, setActiveSensorKey] = useState('imu');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col font-sans select-none">
      
      {/* Top Navbar */}
      <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-100">
            <Activity className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-tight">SmartPhysio</span>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            to="/login"
            className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            Sign In
          </Link>
          <Link 
            to="/register"
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-10 flex flex-col gap-12">
        
        {/* SECTION 1: FULL-WIDTH HERO */}
        <section className="relative rounded-3xl p-8 lg:p-12 bg-gradient-to-br from-white via-slate-50 to-blue-50/40 border border-slate-200/80 shadow-lg overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>IoT Biomechanical Rehabilitation System</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="font-mono text-[11px] opacity-80">v2.4</span>
            </div>

            <h1 className="text-3xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Next-Generation Upper-Limb Rehabilitation
            </h1>

            <p className="text-sm lg:text-base font-normal text-slate-600 leading-relaxed max-w-2xl">
              Real-time physical therapy recovery powered by wearable IoT multi-sensor telemetry, automated range-of-motion analytics, and an interactive 3D digital-twin.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button 
                onClick={() => navigate('/login')}
                className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2.5 transition shadow-md shadow-blue-600/20"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Enter Therapy Portal</span>
              </button>
              <button 
                onClick={() => navigate('/debug-3d')}
                className="px-5 py-3.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition"
              >
                <span>Live 3D Test Viewer</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 2: TWO-COLUMN LAYOUT (IoT Sensors + 3D Rotating GLB) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Small IoT Sensors */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Wearable IoT Sensor Array
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-channel edge telemetry capturing angular displacement and muscle squeeze force
                </p>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-100">
                5 Sensors
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <SensorCard 
                name="MPU-6050 6-Axis IMU"
                type="imu"
                role="Wrist Pronation/Supination & Pitch"
                specs="3-Axis Gyro + Accel • I2C (0x68)"
                pin="GPIO 21 (SDA) / 22 (SCL)"
                value="14.2° / -8.5°"
                unit="P/R"
                status="online"
                active={activeSensorKey === 'imu'}
                onClick={() => setActiveSensorKey('imu')}
              />

              <SensorCard 
                name="5-Finger Flex Array"
                type="flex"
                role="Individual Finger Flexion & Grasp"
                specs="5x 2.2-inch Resistive Strips"
                pin="ADC1 (GPIO 32 - 36)"
                value="48%"
                unit="Avg Flex"
                status="online"
                active={activeSensorKey === 'flex'}
                onClick={() => setActiveSensorKey('flex')}
              />

              <SensorCard 
                name="Elbow Goniometer"
                type="elbow"
                role="Elbow Flexion & Extension (0°-180° ROM)"
                specs="Precision Rotary Potentiometer"
                pin="Analog ADC2 (GPIO 4)"
                value="45°"
                unit="ROM"
                status="online"
                active={activeSensorKey === 'elbow'}
                onClick={() => setActiveSensorKey('elbow')}
              />

              <SensorCard 
                name="FSR Tactile Pressure Sensor"
                type="pressure"
                role="Palmar Grip Compression & Squeeze Force"
                specs="Force Sensitive Resistor (0.2N - 20N)"
                pin="Analog ADC1 (GPIO 39)"
                value="18.4"
                unit="N Force"
                status="online"
                active={activeSensorKey === 'pressure'}
                onClick={() => setActiveSensorKey('pressure')}
              />

              <SensorCard 
                name="ESP-32 IoT Edge Node"
                type="mcu"
                role="240MHz Wireless Telemetry Hub"
                specs="Wi-Fi 802.11 b/g/n + BLE 4.2"
                pin="50Hz WebSocket JSON Stream"
                value="Active"
                unit=""
                status="online"
                active={activeSensorKey === 'mcu'}
                onClick={() => setActiveSensorKey('mcu')}
              />
            </div>
          </div>

          {/* Right Column: 3D GLB Model Visualizer */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  3D Digital-Twin Kinematics
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Interactive real-time 3D arm simulation reflecting sensor motion
                </p>
              </div>

              <button
                onClick={() => setAutoRotate(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  autoRotate
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin-slow' : ''}`} />
                <span>{autoRotate ? 'Rotate: ON' : 'Rotate: OFF'}</span>
              </button>
            </div>

            {/* 3D GLB Card Container */}
            <div className="rounded-3xl border border-slate-200 shadow-lg h-[520px] relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-white to-slate-100/70">
              <div className="absolute inset-0">
                <Arm3DVisualizer 
                  cameraAngle={cameraAngle}
                  autoRotate={autoRotate}
                  demoMode={true}
                />
              </div>

              {/* Floating Camera View Switcher */}
              <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'straight', label: 'Overview' },
                  { key: 'hand', label: '✋ Hand' },
                  { key: 'elbow', label: '💪 Elbow' },
                  { key: 'wrist', label: '⌚ Wrist' }
                ].map((view) => (
                  <button
                    key={view.key}
                    onClick={() => setCameraAngle(view.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-md border ${
                      cameraAngle === view.key
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>

              {/* Floating HUD Badges */}
              <div className="absolute bottom-4 left-4 z-20 p-3.5 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md shadow-xl text-left min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Active ROM</span>
                <span className="text-2xl font-black text-blue-600 block leading-tight mt-0.5">45°</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Elbow Extension</span>
              </div>

              <div className="absolute bottom-4 right-4 z-20 p-3.5 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md shadow-xl text-left min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Grip Strength</span>
                <span className="text-2xl font-black text-emerald-600 block leading-tight mt-0.5">18.4 N</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Muscular Squeeze</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: HOW THIS PROJECT WORKS (3 Flow-wise Cards) */}
        <section className="flex flex-col gap-6 pt-4">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">
              End-to-End Architecture
            </span>
            <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              How SmartPhysio Works
            </h2>
            <p className="text-xs lg:text-sm text-slate-500">
              One unified flow connecting wearable IoT hardware, edge computing, and real-time biomechanics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl border border-slate-200 bg-white hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-black text-sm mb-4">
                01
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Wearable Sensor Ingestion
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Patient wears the ergonomic sleeve and glove. Calibrated resistive flex strips, rotary goniometer, and 6-axis IMU capture multi-axis joint angles and squeeze force without restrictive cables.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Multi-channel calibrated edge sensing</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl border border-slate-200 bg-white hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-black text-sm mb-4">
                02
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Low-Latency WebSocket Stream
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The ESP32 microcontroller digitizes multi-channel signals at 50Hz, filters sensor noise, and broadcasts encrypted telemetry packets over WebSockets to the Python FastAPI backend in under 20ms.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>50Hz continuous real-time transmission</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl border border-slate-200 bg-white hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm mb-4">
                03
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                3D Digital Twin & Clinical AI
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Incoming telemetry animates the 3D anatomical GLB model in real time. Backend algorithms score repetition accuracy, compare active Range-of-Motion against targets, and log progress reports.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Automated rehabilitation analytics</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 px-8 text-center text-xs text-slate-400 bg-white">
        SmartPhysio &bull; Intelligent Upper-Limb Rehabilitation & IoT Biomechanics &bull; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
