/**
 * SmartPhysio Finger Sensor Mapping Service
 * Version: 1.2.0
 * 
 * Single Source of Truth Pinout:
 * - Thumb:  GPIO 36 (VP  / ADC1_CH0)
 * - Index:  GPIO 33 (D33 / ADC1_CH5)
 * - Middle: GPIO 34 (D34 / ADC1_CH6)
 * - Ring:   GPIO 35 (D35 / ADC1_CH7)
 * - Little: GPIO 32 (D32 / ADC1_CH4)
 * 
 * Pipeline:
 * Real Flex Sensor / ESP32 Telemetry (raw, curl, ok)
 *       ↓
 * Direct Firmware Normalized Curl (0.0 .. 1.0) - Single Source of Truth
 *       ↓
 * Fault Checking: If ok[i] == false -> HOLD neutral pose (-15°), Flag SENSOR FAULT
 *       ↓
 * Skeletal Bone Angle = MIN_DEG + curl * (MAX_DEG - MIN_DEG) [-15° to +70°]
 *       ↓
 * Stage 2: Frame-Rate-Independent Skeletal Interpolation (Exponential Damping / Lerp)
 */

import * as THREE from 'three';
import { loadCalibrationConfig } from './calibrationConfig';

export const MIN_DEG = -15;
export const MAX_DEG = 70;

export const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'little'];

export const FINGER_RIG_MAP = {
  thumb:  { bone: 'right_thumb',  axis: 'x', pin: 36, channel: 1 },
  index:  { bone: 'right_index',  axis: 'z', pin: 33, channel: 2 },
  middle: { bone: 'right_middle', axis: 'z', pin: 34, channel: 3 },
  ring:   { bone: 'right_ring',   axis: 'z', pin: 35, channel: 4 },
  little: { bone: 'right_little', axis: 'z', pin: 32, channel: 5 }
};

export const SENSOR_CALIB_STORAGE_KEY = 'smartphysio_sensor_calibration';
export const GLOVE_CALIB_STORAGE_KEY  = 'smartphysio_live_glove_calibration';

/**
 * Calibrated ADC benchmarks (12-bit ADC: value DECREASES when bent)
 */
export const DEFAULT_FLEX_CALIBRATION = {
  thumb:  { flat: 250,  bent: 180,  label: 'Thumb (GPIO 36)',  channel: 1, swing: 70,  direction: 'decreasing', noiseThreshold: 4, isValid: true },
  index:  { flat: 1205, bent: 1180, label: 'Index (GPIO 33)',  channel: 2, swing: 25,  direction: 'decreasing', noiseThreshold: 2, isValid: true },
  middle: { flat: 265,  bent: 220,  label: 'Middle (GPIO 34)', channel: 3, swing: 45,  direction: 'decreasing', noiseThreshold: 4, isValid: true },
  ring:   { flat: 900,  bent: 400,  label: 'Ring (GPIO 35)',   channel: 4, swing: 500, direction: 'decreasing', noiseThreshold: 4, isValid: true },
  little: { flat: 148,  bent: 41,   label: 'Little (GPIO 32)', channel: 5, swing: 107, direction: 'decreasing', noiseThreshold: 6, isValid: true }
};

export const DEFAULT_SENSOR_BOUNDS = {
  thumb:  { straight: 250,  bent: 180,  flat: 250 },
  index:  { straight: 1205, bent: 1180, flat: 1205 },
  middle: { straight: 265,  bent: 220,  flat: 265 },
  ring:   { straight: 900,  bent: 400,  flat: 900 },
  little: { straight: 148,  bent: 41,   flat: 148 }
};

// Fault detection thresholds (Named Constants)
export const RAW_MIN_FAULT    = 10;
export const RAW_MAX_FAULT    = 4085;
export const SPREAD_MAX_FAULT = 150;
export const SWING_MIN_FAULT  = 20;
export const DEADZONE         = 0.04;

export const resetDynamicRanges = () => {};
export const rezeroDynamicBaseline = () => {};

export const loadGloveCalibration = () => {
  return { ...DEFAULT_FLEX_CALIBRATION };
};

export const saveGloveCalibration = () => true;
export const resetGloveCalibration = () => ({ ...DEFAULT_FLEX_CALIBRATION });

/**
 * Normalize a sensor value to a 0.0 - 1.0 bend ratio (Decreasing ADC when bent)
 */
export const normalizeFlexValue = (value, flat = 148, bent = 41, useBoost = false, deadzone = DEADZONE) => {
  if (value === undefined || value === null || isNaN(value)) return 0;
  const num = Number(value);
  const span = flat - bent;
  if (Math.abs(span) < 1e-4) return 0;

  // curl = (flat - raw) / (flat - bent)
  const rawRatio = (flat - num) / span;
  let curl = Math.max(0.0, Math.min(1.0, rawRatio));

  if (deadzone > 0 && curl < deadzone) {
    return 0.0;
  }

  if (useBoost && curl > 0.0 && curl < 1.0) {
    return Math.pow(curl, 0.60);
  }

  return Number(curl.toFixed(3));
};

/**
 * Direction-aware bend calculation helper
 */
export const calculateDirectionalBend = (liveValue, flatValue, bentValue, noiseThreshold = 4) => {
  if (liveValue === null || liveValue === undefined || isNaN(liveValue) || liveValue < RAW_MIN_FAULT) {
    return {
      bendPercentage: 0,
      bendDifference: 0,
      rawDifference: 0,
      swingRange: 0,
      direction: 'uncalibrated',
      threshold: noiseThreshold,
      isValid: false,
      needsRecalibration: true,
      error: 'Sensor fault or unplugged (< 10 ADC)'
    };
  }

  if (flatValue === 0 || bentValue === 0) {
    return {
      bendPercentage: 0,
      bendDifference: 0,
      rawDifference: 0,
      swingRange: 0,
      direction: 'uncalibrated',
      threshold: noiseThreshold,
      isValid: false,
      needsRecalibration: true,
      error: 'Uncalibrated baseline'
    };
  }

  const swing = Math.abs(flatValue - bentValue);
  if (swing < 5) {
    return {
      bendPercentage: 0,
      bendDifference: 0,
      rawDifference: 0,
      swingRange: swing,
      direction: 'uncalibrated',
      threshold: noiseThreshold,
      isValid: false,
      needsRecalibration: true,
      error: 'Insufficient calibration range (< 5 counts)'
    };
  }

  const isDecreasing = flatValue > bentValue;
  const rawDiff = isDecreasing ? (flatValue - liveValue) : (liveValue - flatValue);

  if (rawDiff <= noiseThreshold) {
    return {
      bendPercentage: 0,
      bendDifference: 0,
      rawDifference: rawDiff,
      swingRange: swing,
      direction: isDecreasing ? 'decreasing' : 'increasing',
      threshold: noiseThreshold,
      isValid: true,
      needsRecalibration: false
    };
  }

  const ratio = Math.max(0.0, Math.min(1.0, (rawDiff - noiseThreshold) / (swing - noiseThreshold)));
  return {
    bendPercentage: Number(ratio.toFixed(3)),
    bendDifference: rawDiff,
    rawDifference: rawDiff,
    swingRange: swing,
    direction: isDecreasing ? 'decreasing' : 'increasing',
    threshold: noiseThreshold,
    isValid: true,
    needsRecalibration: false
  };
};

/**
 * Map normalized curl to GLB bone rotation
 */
export const mapNormalizedToGlb = (normalizedCurl, fingerKey, glbConfig = null) => {
  const norm = Math.max(0.0, Math.min(1.0, Number(normalizedCurl) || 0));
  const rigInfo = FINGER_RIG_MAP[fingerKey] || { bone: `right_${fingerKey}`, axis: fingerKey === 'thumb' ? 'x' : 'z' };
  const axis = (glbConfig?.fingers?.[fingerKey]?.rotationAxis || rigInfo.axis || 'z').toUpperCase();

  let min = MIN_DEG;
  let max = MAX_DEG;

  if (glbConfig?.fingers?.[fingerKey]) {
    const fingerConf = glbConfig.fingers[fingerKey];
    const axisLower = axis.toLowerCase();
    if (fingerConf[axisLower]) {
      min = fingerConf[axisLower].min ?? MIN_DEG;
      max = fingerConf[axisLower].max ?? MAX_DEG;
    }
  }

  const angle = min + norm * (max - min);

  return {
    angle: Number(angle.toFixed(1)),
    axis,
    min,
    max,
    targetBone: rigInfo.bone,
    normalized: norm
  };
};

/**
 * Helper to extract channel reading from various telemetry formats
 */
const extractChannelReading = (telemetry, fingerKey) => {
  if (!telemetry || typeof telemetry !== 'object') return null;
  const idx = FINGER_KEYS.indexOf(fingerKey);

  // 1. Array format from firmware: raw: [thumb, index, middle, ring, little]
  if (Array.isArray(telemetry.raw) && idx >= 0 && idx < telemetry.raw.length) {
    return Number(telemetry.raw[idx]);
  }

  // 2. Object keys: raw_thumb, raw_index, etc.
  const rawKey = `raw_${fingerKey}`;
  if (telemetry[rawKey] !== undefined && telemetry[rawKey] !== null) {
    return Number(telemetry[rawKey]);
  }

  // 3. Plain finger key when bounds are provided or val > 90 (raw ADC)
  if (telemetry[fingerKey] !== undefined && telemetry[fingerKey] !== null) {
    const val = Number(telemetry[fingerKey]);
    if (!isNaN(val) && (telemetry.bounds !== undefined || val > 90)) {
      return val;
    }
  }

  return null;
};

/**
 * TASK C: Process full telemetry packet using firmware's "curl" as the ONLY normalized value.
 * Delete any second normalization of raw ADC.
 * Bone angle = MIN_DEG + curl * (MAX_DEG - MIN_DEG) [-15° to 70°] (preserves per-bone limits when configured)
 * If ok[i] == false: do NOT move finger bone (hold neutral pose), show SENSOR FAULT.
 */
export const processFingerTelemetry = (telemetry = {}, glbConfig = null, customBounds = null) => {
  const results = {
    angles: {},      // { thumb: deg, index: deg, ... } for GLB
    normalized: {},  // { thumb: 0-1, index: 0-1, ... }
    percentages: {}, // { thumb: 0-100, index: 0-100, ... }
    debug: {}        // full diagnostic info per finger
  };

  const hasArrayCurl = Array.isArray(telemetry?.curl);
  const hasArrayOk   = Array.isArray(telemetry?.ok);
  const hasArrayRaw  = Array.isArray(telemetry?.raw);

  FINGER_KEYS.forEach((finger, i) => {
    const rigInfo = FINGER_RIG_MAP[finger] || { bone: `right_${finger}`, axis: finger === 'thumb' ? 'x' : 'z' };
    const calib = customBounds?.[finger] || DEFAULT_FLEX_CALIBRATION[finger] || { flat: 148, bent: 41 };

    // 1. Extract raw ADC reading
    let raw = hasArrayRaw && telemetry.raw[i] !== undefined 
      ? Number(telemetry.raw[i]) 
      : extractChannelReading(telemetry, finger);

    // 2. Extract validity/ok flag
    let ok = true;
    if (hasArrayOk && telemetry.ok[i] !== undefined) {
      ok = Boolean(telemetry.ok[i]);
    } else if (telemetry?.ok && typeof telemetry.ok === 'object' && telemetry.ok[finger] !== undefined) {
      ok = Boolean(telemetry.ok[finger]);
    } else if (raw !== null && (raw < RAW_MIN_FAULT || raw > RAW_MAX_FAULT)) {
      ok = false;
    }

    // 3. Extract curl: use firmware curl directly if available (SINGLE SOURCE OF TRUTH)
    let curl = 0.0;
    if (hasArrayCurl && telemetry.curl[i] !== undefined) {
      curl = Math.max(0.0, Math.min(1.0, Number(telemetry.curl[i]) || 0.0));
    } else if (telemetry?.curl && typeof telemetry.curl === 'object' && telemetry.curl[finger] !== undefined) {
      curl = Math.max(0.0, Math.min(1.0, Number(telemetry.curl[finger]) || 0.0));
    } else if (raw !== null && ok) {
      // Fallback normalization when curl array is omitted (e.g. legacy packet or unit test)
      const straight = telemetry.bounds?.[`${finger}Str`] ?? calib.flat ?? calib.straight ?? 148;
      const bent = telemetry.bounds?.[`${finger}Bnt`] ?? calib.bent ?? 41;
      const useBoost = !hasArrayCurl && telemetry.bounds !== undefined;
      // Handle both decreasing and increasing bounds
      if (bent < straight) {
        curl = normalizeFlexValue(raw, straight, bent, useBoost, 0.0);
      } else {
        const rawRatio = (raw - straight) / (bent - straight);
        const clamped = Math.max(0.0, Math.min(1.0, rawRatio));
        curl = useBoost && clamped > 0 && clamped < 1 ? Math.pow(clamped, 0.60) : clamped;
      }
    } else if (telemetry?.[finger] !== undefined && Number(telemetry[finger]) <= 90) {
      // Pre-scaled degree angle input from legacy test or demo
      const degVal = Number(telemetry[finger]);
      const linearRatio = Math.max(0.0, Math.min(1.0, degVal / 90.0));
      curl = linearRatio > 0 && linearRatio < 1 ? Math.pow(linearRatio, 0.60) : linearRatio;
    }

    // 4. Calculate Bone Angle: MIN_DEG + curl * (MAX_DEG - MIN_DEG) [-15° to 70°]
    // Preserves per-bone custom glbConfig limits when explicitly passed
    const glbMapping = mapNormalizedToGlb(curl, finger, glbConfig);
    const angle = ok ? glbMapping.angle : glbMapping.min;
    const percentage = ok ? Math.round(curl * 100) : 0;

    results.angles[finger] = Number(angle.toFixed(1));
    results.percentages[finger] = percentage;
    results.normalized[finger] = ok ? curl : 0.0;

    results.debug[finger] = {
      finger,
      channel: i + 1,
      pin: rigInfo.pin || (i === 0 ? 36 : i === 1 ? 33 : i === 2 ? 34 : i === 3 ? 35 : 32),
      targetBone: rigInfo.bone,
      axis: glbMapping.axis,
      raw: raw !== null ? raw : 0,
      curl: Number(curl.toFixed(3)),
      percentage,
      normalized: percentage,
      glbAngle: Number(angle.toFixed(1)),
      angle: Number(angle.toFixed(1)),
      min: glbMapping.min,
      max: glbMapping.max,
      ok,
      isFault: !ok,
      status: ok ? (curl > 0.04 ? 'Bending' : 'Flat (Rest)') : 'SENSOR FAULT',
      error: ok ? null : 'SENSOR FAULT'
    };
  });

  return results;
};

/**
 * Convert degrees to radians
 */
export const degToRad = (degrees) => ((degrees || 0) * Math.PI) / 180;

/**
 * Apply calibrated finger rotation to Three.js bone node
 */
export const applyCalibratedFingerRotation = (fingerNode, nodeName, base, angleDeg, factor = 0.15, delta = null) => {
  if (!fingerNode || !base) return;

  const isThumb = nodeName === 'right_thumb' || nodeName === 'thumb';
  const isRing  = nodeName === 'right_ring'  || nodeName === 'ring';
  const isIndex = nodeName === 'right_index' || nodeName === 'index';
  // Ring: 0.35 fast factor; Index: 0.18 smooth anti-jitter factor (when default 0.15 is used)
  let effectiveFactor = factor;
  if (factor === 0.15) {
    if (isRing) effectiveFactor = 0.35;
    else if (isIndex) effectiveFactor = 0.18;
  }
  const rad = degToRad(angleDeg);

  const interpolate = (curr, target) => {
    if (factor >= 1.0) return target;
    if (delta !== null && delta !== undefined && delta > 0) {
      if (typeof THREE !== 'undefined' && THREE.MathUtils?.damp) {
        // Delta-time scaling damping: rate ~ 18 for Ring, 8 for Index, 12 for others
        const dampRate = isRing ? 18 : isIndex ? 8 : 12;
        return THREE.MathUtils.damp(curr, target, dampRate, delta);
      }
      const expRate = isRing ? 18.0 : isIndex ? 8.0 : 12.0;
      return curr + (target - curr) * (1.0 - Math.exp(-expRate * delta));
    }
    return curr + (target - curr) * effectiveFactor;
  };

  if (isThumb) {
    const clampedRad = Math.max(-1.10, Math.min(1.10, rad));
    const targetX = base.x + clampedRad;
    fingerNode.rotation.x = interpolate(fingerNode.rotation.x, targetX);
    fingerNode.rotation.y = base.y;
    fingerNode.rotation.z = base.z;
  } else {
    const clampedRad = Math.max(-1.45, Math.min(1.45, rad));
    const targetZ = base.z + clampedRad;
    fingerNode.rotation.x = base.x;
    fingerNode.rotation.y = base.y;
    fingerNode.rotation.z = interpolate(fingerNode.rotation.z, targetZ);
  }
};
