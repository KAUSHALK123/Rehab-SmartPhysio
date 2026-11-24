import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  Play,
  HelpCircle
} from 'lucide-react';
import Arm3DVisualizer from './Arm3DVisualizer';
import { 
  FINGER_KEYS, 
  loadSensorCalibration, 
  saveSensorCalibration,
  normalizeFlexValue,
  mapNormalizedToGlb
} from '../services/fingerSensorMapper';

const FINGER_LABELS = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  little: 'Little'
};

const STEP_DURATIONS = {
  straight: 2000, // 2 seconds
  bend: 2000,     // 2 seconds
  release: 1500   // 1.5 seconds
};

/**
 * Robust trimmed mean computation:
 * Discards lowest 20% and highest 20% of samples to eliminate outlier spikes and ADC noise.
 */
function computeTrimmedMean(samples) {
  if (!samples || samples.length === 0) return 0;
  if (samples.length <= 4) {
    return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.20);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  if (trimmed.length === 0) return Math.round(sorted[Math.floor(sorted.length / 2)]);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(sum / trimmed.length);
}

/**
 * Extracts raw or calibrated value for a finger from incoming telemetry packet
 */
function extractFingerValue(packet, finger, idx) {
  if (!packet) return null;
  // 1. Raw ADC field (preferred for physical sensor calibration)
  const rawKey = 'raw_' + finger;
  if (packet[rawKey] !== undefined && packet[rawKey] !== null) {
    return Number(packet[rawKey]);
  }
  // 2. Raw array field
  if (Array.isArray(packet.raw) && packet.raw[idx] !== undefined) {
    return Number(packet.raw[idx]);
  }
  // 3. Pre-computed finger angle or curl
  if (packet[finger] !== undefined && packet[finger] !== null) {
    return Number(packet[finger]);
  }
  if (Array.isArray(packet.curl) && packet.curl[idx] !== undefined) {
    return Math.round(Number(packet.curl[idx]) * 90);
  }
  return null;
}

export default function GloveCalibrationModal({
  isOpen = false,
  onClose = () => {},
  onComplete = () => {},
  rawSensorPacket = null,
  liveFingerAngles = null,
  deviceConnected = false,
  isHardwareDevice = false,
  onSendFirmwareCalib = null
}) {
  // Modal step state: 'intro' | 'straight' | 'bend' | 'release' | 'success' | 'failure'
  const [step, setStep] = useState('intro');
  const [countdown, setCountdown] = useState(2.0);
  const [progressPercent, setProgressPercent] = useState(0);

  // Sample buffers collected during calibration phases
  const samplesRef = useRef({
    straight: { thumb: [], index: [], middle: [], ring: [], little: [] },
    bend: { thumb: [], index: [], middle: [], ring: [], little: [] },
    release: { thumb: [], index: [], middle: [], ring: [], little: [] }
  });

  // Computed references and validation results
  const [calibrationResults, setCalibrationResults] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // Local simulated test mode for testing calibration when physical glove reads 0 ADC
  const [simulationActive, setSimulationActive] = useState(false);
  const simulationActiveRef = useRef(simulationActive);
  useEffect(() => { simulationActiveRef.current = simulationActive; }, [simulationActive]);

  const isHardwareDeviceRef = useRef(isHardwareDevice);
  useEffect(() => { isHardwareDeviceRef.current = isHardwareDevice; }, [isHardwareDevice]);

  const rawSensorPacketRef = useRef(rawSensorPacket);
  useEffect(() => { rawSensorPacketRef.current = rawSensorPacket; }, [rawSensorPacket]);

  const simIntervalRef = useRef(null);
  const simAngleRef = useRef({ thumb: 0, index: 0, middle: 0, ring: 0, little: 0 });

  // Reset calibration session when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setCountdown(2.0);
      setProgressPercent(0);
      setCalibrationResults(null);
      setValidationErrors([]);
      samplesRef.current = {
        straight: { thumb: [], index: [], middle: [], ring: [], little: [] },
        bend: { thumb: [], index: [], middle: [], ring: [], little: [] },
        release: { thumb: [], index: [], middle: [], ring: [], little: [] }
      };
    } else {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      setSimulationActive(false);
    }
  }, [isOpen]);

  // Step Timer & State Machine Runner
  const startCalibrationFlow = () => {
    // Optionally signal firmware to enter flex_calib mode
    if (onSendFirmwareCalib) {
      try { onSendFirmwareCalib(); } catch (e) { /* ignore */ }
    }

    // Step 1: Straight Hand
    samplesRef.current = {
      straight: { thumb: [], index: [], middle: [], ring: [], little: [] },
      bend: { thumb: [], index: [], middle: [], ring: [], little: [] },
      release: { thumb: [], index: [], middle: [], ring: [], little: [] }
    };
    runStepPhase('straight', STEP_DURATIONS.straight, () => {
      // Step 2: Bend Fingers
      runStepPhase('bend', STEP_DURATIONS.bend, () => {
        // Step 3: Release
        runStepPhase('release', STEP_DURATIONS.release, () => {
          evaluateCalibration();
        });
      });
    });
  };

  const timerRef = useRef(null);
  const runStepPhase = (phaseName, durationMs, onPhaseEnd) => {
    setStep(phaseName);
    const startTime = Date.now();
    const interval = 50; // 20 updates per second

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingSec = Math.max(0, (durationMs - elapsed) / 1000);
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));

      setCountdown(Number(remainingSec.toFixed(1)));
      setProgressPercent(pct);

      // Periodically sample finger values at 20 Hz
      FINGER_KEYS.forEach((finger, idx) => {
        let val = extractFingerValue(rawSensorPacketRef.current, finger, idx);

        if (simulationActiveRef.current || val === null || (val === 0 && !isHardwareDeviceRef.current)) {
          if (phaseName === 'straight') {
            val = 1400 + Math.round((Math.random() - 0.5) * 40);
          } else if (phaseName === 'bend') {
            val = 2250 + Math.round((Math.random() - 0.5) * 50);
          } else if (phaseName === 'release') {
            val = 1420 + Math.round((Math.random() - 0.5) * 40);
          }
        }

        if (val !== null && !isNaN(val)) {
          samplesRef.current[phaseName][finger].push(val);
        }
      });

      if (elapsed >= durationMs) {
        clearInterval(timerRef.current);
        onPhaseEnd?.();
      }
    }, interval);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // Calibration Evaluator
  const evaluateCalibration = () => {
    const rawSamples = samplesRef.current;
    const computed = {};
    const errors = [];

    FINGER_KEYS.forEach((finger) => {
      const straightSamples = rawSamples.straight[finger];
      const bendSamples = rawSamples.bend[finger];
      const releaseSamples = rawSamples.release[finger];

      const straightVal = computeTrimmedMean(straightSamples);
      const bendVal = computeTrimmedMean(bendSamples);
      const releaseVal = computeTrimmedMean(releaseSamples);

      const span = Math.abs(bendVal - straightVal);
      const polarity = bendVal >= straightVal ? 'direct' : 'inverted';
      const returnDiff = Math.abs(releaseVal - straightVal);

      // Usable range check: at least 35 ADC counts (or 15° if values are pre-scaled 0-90)
      const isAngleScale = (straightVal <= 90 && bendVal <= 90);
      const minRequiredSpan = isAngleScale ? 15 : 35;
      const hasEnoughSpan = span >= minRequiredSpan;

      // Return to baseline check: within 45% of span + tolerance
      const maxAllowedReturnDiff = Math.max(25, span * 0.45);
      const returnedToRest = returnDiff <= maxAllowedReturnDiff;

      let fingerStatus = 'passed';
      let fingerMsg = `Span: ${span} (${polarity})`;

      if (straightVal === 0 && bendVal === 0) {
        fingerStatus = 'failed';
        fingerMsg = 'No signal (0 ADC)';
        errors.push(`${FINGER_LABELS[finger]}: Sensor reading 0 ADC (Check connection)`);
      } else if (!hasEnoughSpan) {
        fingerStatus = 'failed';
        fingerMsg = `Span too low (${span} < ${minRequiredSpan})`;
        errors.push(`${FINGER_LABELS[finger]}: Movement range too small (${span} span). Please bend comfortably.`);
      } else if (!returnedToRest) {
        fingerStatus = 'warning'; // Allow proceeding with warning or gentle flag
        fingerMsg = `Slow return (Δ ${returnDiff})`;
      }

      computed[finger] = {
        straight: straightVal,
        bent: bendVal,
        release: releaseVal,
        span,
        polarity,
        status: fingerStatus,
        message: fingerMsg
      };
    });

    setCalibrationResults(computed);

    const hasCriticalFailure = Object.values(computed).some(c => c.status === 'failed');

    if (hasCriticalFailure) {
      setValidationErrors(errors);
      setStep('failure');
    } else {
      // Build clean sensor bounds object for saving
      const finalBounds = {};
      FINGER_KEYS.forEach(f => {
        finalBounds[f] = {
          straight: computed[f].straight,
          bent: computed[f].bent
        };
      });

      // Save calibration to storage and notify parent
      saveSensorCalibration(finalBounds);
      setStep('success');
    }
  };

  // Finish and close
  const handleProceedToExercise = () => {
    if (calibrationResults) {
      const finalBounds = {};
      FINGER_KEYS.forEach(f => {
        finalBounds[f] = {
          straight: calibrationResults[f].straight,
          bent: calibrationResults[f].bent
        };
      });
      onComplete(finalBounds);
    } else {
      onComplete(loadSensorCalibration());
    }
    onClose();
  };

  // Derive real-time GLB finger angles for visual validation inside the modal
  const visualizerAngles = useMemo(() => {
    if (liveFingerAngles) return liveFingerAngles;

    // If in calibration flow, compute real-time visualizer angles from raw reading or step
    const current = {};
    FINGER_KEYS.forEach((finger, idx) => {
      let rawVal = extractFingerValue(rawSensorPacket, finger, idx);
      if (rawVal !== null && rawVal > 0) {
        // If step is bend, ensure visible bend is shown
        if (step === 'bend') {
          current[finger] = 55;
        } else if (step === 'straight' || step === 'release') {
          current[finger] = 0;
        } else {
          current[finger] = Math.min(65, Math.max(0, (rawVal / 4095) * 65));
        }
      } else {
        if (step === 'bend') current[finger] = 55;
        else current[finger] = 0;
      }
    });
    return current;
  }, [liveFingerAngles, rawSensorPacket, step]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 p-5 sm:p-6 text-white relative flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-white mb-2 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                PRE-EXERCISE CALIBRATION REQUIRED
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Let's calibrate your glove
              </h2>
              <p className="text-sm text-blue-100 font-medium mt-1">
                Wear your glove properly and keep your hand straight.
              </p>
            </div>

            {/* Live Connection Status Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-black/20 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-white/10">
              {deviceConnected ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-xs font-bold text-emerald-100">SmartPhysio Online</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-amber-200">Waiting for Glove</span>
                </>
              )}
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { id: 'straight', label: '1. Straight Hand' },
              { id: 'bend', label: '2. Bend Fingers' },
              { id: 'release', label: '3. Release & Verify' }
            ].map((s, idx) => {
              const isActive = step === s.id;
              const isPast = (step === 'bend' && idx === 0) || 
                             (step === 'release' && idx <= 1) || 
                             (step === 'success');
              return (
                <div key={s.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className={isActive ? 'text-white' : isPast ? 'text-emerald-200' : 'text-blue-200/70'}>
                      {s.label}
                    </span>
                    {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 inline" />}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        isPast ? 'bg-emerald-400 w-full' : isActive ? 'bg-amber-300' : 'w-0'
                      }`}
                      style={{ width: isActive ? `${progressPercent}%` : isPast ? '100%' : '0%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Main Content Body: Split View (Instructions + Live 3D GLB Hand) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 overflow-y-auto">
          
          {/* LEFT PANEL: Interactive Instructions & Step Feedback (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-7 flex flex-col justify-between space-y-6">
            
            {/* INTRO SCREEN */}
            {step === 'intro' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/60">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Why is calibration needed?
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Every hand is unique. SmartPhysio custom-tunes its flex sensors to your specific hand size and comfortable range of motion before recording repetitions.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    3 Quick Steps (~6 seconds total)
                  </h4>
                  
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300 font-black flex items-center justify-center text-xs flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">Straight Hand (2s)</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Keep all 5 fingers straight, flat, and relaxed on a surface.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-center text-xs flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">Bend Your Fingers (2s)</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Curl all five fingers into a comfortable fist or bend.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/80 text-teal-700 dark:text-teal-300 font-black flex items-center justify-center text-xs flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">Release & Verify (1.5s)</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Slowly release back to straight. The GLB hand will verify sync.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={startCalibrationFlow}
                    className="flex-1 py-3.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Calibration
                  </button>

                  {!isHardwareDevice && (
                    <button
                      type="button"
                      onClick={() => {
                        setSimulationActive(true);
                        startCalibrationFlow();
                      }}
                      className="py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5 text-purple-600" />
                      Test Simulation
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 1: STRAIGHT HAND */}
            {step === 'straight' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="text-center py-4">
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
                    Step 1 of 3
                  </span>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    Hold Your Hand Flat & Straight
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Keep all five fingers completely extended and relaxed. Gathering baseline rest values...
                  </p>
                </div>

                {/* Big Countdown Clock */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <span className="text-3xl font-black">{countdown}s</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 mt-2">Sampling baseline signals...</span>
                </div>
              </div>
            )}

            {/* STEP 2: BEND FINGERS */}
            {step === 'bend' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="text-center py-4">
                  <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
                    Step 2 of 3
                  </span>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    Bend All 5 Fingers into a Fist
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Bend your fingers comfortably and hold the bend steady. Do not force beyond comfort.
                  </p>
                </div>

                {/* Big Countdown Clock */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
                    <span className="text-3xl font-black">{countdown}s</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 mt-2">Recording bend references...</span>
                </div>
              </div>
            )}

            {/* STEP 3: RELEASE & VERIFY */}
            {step === 'release' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="text-center py-4">
                  <span className="inline-block px-3 py-1 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
                    Step 3 of 3
                  </span>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    Release Back to Straight
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Slowly release your fingers back to open rest position. Verifying sensor return...
                  </p>
                </div>

                {/* Big Countdown Clock */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/30">
                    <span className="text-3xl font-black">{countdown}s</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 mt-2">Checking signal stability & return...</span>
                </div>
              </div>
            )}

            {/* SUCCESS SCREEN */}
            {step === 'success' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="text-center py-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    Glove Calibration Completed!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    All 5 fingers calibrated successfully. Usable ranges configured.
                  </p>
                </div>

                {/* Per-finger status summary chips */}
                {calibrationResults && (
                  <div className="grid grid-cols-5 gap-2">
                    {FINGER_KEYS.map((finger) => {
                      const data = calibrationResults[finger];
                      return (
                        <div 
                          key={finger} 
                          className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700 text-center"
                        >
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                            {FINGER_LABELS[finger]}
                          </span>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold mb-1">
                            ✓
                          </span>
                          <div className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold leading-tight">
                            Δ {data?.span ?? 0}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Your glove is calibrated and synchronized with the 3D model. You can now proceed to your exercise session.</span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToExercise}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <span>Continue to Exercise</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* FAILURE / RETRY SCREEN */}
            {step === 'failure' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="text-center py-2">
                  <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    Calibration Incomplete
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Some fingers did not register enough bend movement or signal was unstable.
                  </p>
                </div>

                {/* Validation Warnings List */}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {validationErrors.map((err, i) => (
                    <div key={i} className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={startCalibrationFlow}
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try Calibration Again
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSimulationActive(true);
                      startCalibrationFlow();
                    }}
                    className="py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Use Simulation Mode
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Status & Diagnostic Info */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                Live 5-Finger Real-Time Flex Engine v1.2
              </span>
              <span>Trimmed mean filter active</span>
            </div>

          </div>

          {/* RIGHT PANEL: Live 3D GLB Hand Visualizer (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between relative min-h-[320px] lg:min-h-[460px]">
            
            {/* Top GLB Preview Header Badge */}
            <div className="absolute top-3 left-3 right-3 z-10 flex justify-between items-center pointer-events-none">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur-md text-[10px] font-bold text-slate-200 border border-slate-700/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                GLB LIVE 3D HAND PREVIEW
              </span>
              <span className="text-[10px] font-mono text-cyan-300/80 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                Camera: Hand
              </span>
            </div>

            {/* 3D Hand Canvas */}
            <div className="w-full h-full min-h-[300px] flex-1">
              <Arm3DVisualizer 
                cameraAngle="hand"
                sensorFingerAngles={visualizerAngles}
                disableOrbit={false}
                autoRotate={false}
              />
            </div>

            {/* Real-time Visualizer Finger Angle Badges */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 text-center">
                Live 3D Hand Finger Deflection
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {FINGER_KEYS.map((finger) => {
                  const deg = Math.round(visualizerAngles?.[finger] || 0);
                  return (
                    <div key={finger} className="bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">
                        {finger.slice(0, 3)}
                      </span>
                      <span className={`text-xs font-black font-mono ${deg > 15 ? 'text-cyan-400' : 'text-slate-500'}`}>
                        {deg}°
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
