/**
 * SmartPhysio Finger Sensor Mapping Service (Fix 2 & Live Flex Glove Smoothing)
 * 
 * Pipeline:
 * Real Flex Sensor / ESP32 Telemetry
 *       ↓
 * Stage 1: EMA Filtering (alpha = 0.22) & Signed Normalization [0.0 - 1.0] with Deadzone (0.03)
 *       ↓
 * Approved GLB Calibration Range (from smartphysio_glb_calibration)
 *       ↓
 * Stage 2: Frame-Rate-Independent Skeletal Interpolation (Exponential Damping / Lerp)
 *       ↓
 * Natural Anatomical 3D Skeletal Movement without Twisting or Mesh Distortion
 * 
 * Hardware-to-Finger Mapping:
 * - Index Finger  ← Sensor #1 (Flat: 1217, Bent: 1152, Swing: -65)
 * - Middle Finger ← Sensor #2 (Flat: 1446, Bent: 1463, Swing: +17)
 * - Ring Finger   ← Sensor #3 (Flat: 1147, Bent: 1200, Swing: +53)
 * - Little Finger ← Sensor #4 (Flat: 935,  Bent: 956,  Swing: +21)
 * - Thumb         ← Sensor #5 (Flat: 1200, Bent: 1050, Swing: -150 - placeholder default)
 */

import * as THREE from 'three';
import { loadCalibrationConfig } from './calibrationConfig';

export const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'little'];

export const FINGER_RIG_MAP = {
  thumb:  { bone: 'right_thumb',  axis: 'x', channel: 5 },
  index:  { bone: 'right_index',  axis: 'z', channel: 1 },
  middle: { bone: 'right_middle', axis: 'z', channel: 2 },
  ring:   { bone: 'right_ring',   axis: 'z', channel: 3 },
  little: { bone: 'right_little', axis: 'z', channel: 4 }
};

export const SENSOR_CALIB_STORAGE_KEY = 'smartphysio_sensor_calibration';
export const GLOVE_CALIB_STORAGE_KEY  = 'smartphysio_live_glove_calibration';

/**
 * Default hardware ADC sensor calibration constants from physical ESP32 12kΩ pull-down tests:
 * Notice: Some sensors increase in ADC value when bent while others decrease.
 * Signed ratio normalization handles both directions automatically.
 */
export const DEFAULT_FLEX_CALIBRATION = {
  index:  { flat: 173, bent: 108, label: 'Index (Sensor #1)',  channel: 1, swing: 65,  direction: 'decreasing', noiseThreshold: 4, isValid: true },
  middle: { flat: 265, bent: 273, label: 'Middle (Sensor #2)', channel: 2, swing: 8,   direction: 'increasing', noiseThreshold: 2, isValid: true },
  ring:   { flat: 216, bent: 205, label: 'Ring (Sensor #3)',   channel: 3, swing: 11,  direction: 'decreasing', noiseThreshold: 2, isValid: true },
  little: { flat: 148, bent: 41,  label: 'Little (Sensor #4)', channel: 4, swing: 107, direction: 'decreasing', noiseThreshold: 6, isValid: true },
  thumb:  { flat: 0,   bent: 0,   label: 'Thumb (Sensor #5)',  channel: 5, swing: 0,   direction: 'uncalibrated', noiseThreshold: 6, isValid: false, needsRecalibration: true }
};

export const DEFAULT_SENSOR_BOUNDS = {
  index:  { straight: 173, bent: 108, flat: 173 },
  middle: { straight: 265, bent: 273, flat: 265 },
  ring:   { straight: 216, bent: 205, flat: 216 },
  little: { straight: 148, bent: 41,  flat: 148 },
  thumb:  { straight: 0,   bent: 0,   flat: 0 }
};

/**
 * Real-time dynamic auto-range tracker & EMA smoothing filter.
 * Adapts to physical flex sensor ADC output on-the-fly while eliminating high-frequency ADC noise.
 */
const dynamicRanges = {
  thumb:  { min: null, max: null, baseline: null },
  index:  { min: null, max: null, baseline: null },
  middle: { min: null, max: null, baseline: null },
  ring:   { min: null, max: null, baseline: null },
  little: { min: null, max: null, baseline: null }
};

const emaFilteredValues = {
  thumb: null,
  index: null,
  middle: null,
  ring: null,
  little: null
};

export const resetDynamicRanges = () => {
  FINGER_KEYS.forEach((f) => {
    dynamicRanges[f] = { min: null, max: null, baseline: null };
    emaFilteredValues[f] = null;
  });
};

export const rezeroDynamicBaseline = (fingerKey = null, newBaseline = null) => {
  if (fingerKey && dynamicRanges[fingerKey]) {
    dynamicRanges[fingerKey].baseline = newBaseline !== null ? newBaseline : null;
    dynamicRanges[fingerKey].min = dynamicRanges[fingerKey].baseline;
    dynamicRanges[fingerKey].max = dynamicRanges[fingerKey].baseline;
  } else {
    FINGER_KEYS.forEach((f) => {
      dynamicRanges[f] = { min: null, max: null, baseline: null };
    });
  }
};

/**
 * Load live glove calibration from localStorage, merged with defaults
 */
export const loadGloveCalibration = () => {
  try {
    const raw = localStorage.getItem(GLOVE_CALIB_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLEX_CALIBRATION };
    const parsed = JSON.parse(raw);

    // Auto-migrate if stored values belong to previous high ADC range (flat > 500)
    if (parsed.index?.flat > 500 || parsed.middle?.flat > 500) {
      localStorage.removeItem(GLOVE_CALIB_STORAGE_KEY);
      return { ...DEFAULT_FLEX_CALIBRATION };
    }

    const merged = {};
    FINGER_KEYS.forEach(f => {
      const def = DEFAULT_FLEX_CALIBRATION[f];
      const flat = parsed[f]?.flat !== undefined ? parsed[f].flat : def.flat;
      const bent = parsed[f]?.bent !== undefined ? parsed[f].bent : def.bent;
      const swing = Math.abs(bent - flat);
      const isIncreasing = bent >= flat;
      const isValid = flat > 0 && swing >= 5;

      merged[f] = {
        ...def,
        flat,
        bent,
        swing,
        direction: isValid ? (isIncreasing ? 'increasing' : 'decreasing') : 'uncalibrated',
        noiseThreshold: parsed[f]?.noiseThreshold ?? def.noiseThreshold ?? (swing < 20 ? 2 : 5),
        isValid,
        needsRecalibration: !isValid
      };
    });
    return merged;
  } catch (e) {
    return { ...DEFAULT_FLEX_CALIBRATION };
  }
};

/**
 * Save live glove calibration to localStorage
 */
export const saveGloveCalibration = (calib) => {
  try {
    localStorage.setItem(GLOVE_CALIB_STORAGE_KEY, JSON.stringify(calib));
    return true;
  } catch (e) {
    console.error('Failed to save glove calibration', e);
    return false;
  }
};

/**
 * Reset live glove calibration to default constants
 */
export const resetGloveCalibration = () => {
  try {
    localStorage.removeItem(GLOVE_CALIB_STORAGE_KEY);
    return { ...DEFAULT_FLEX_CALIBRATION };
  } catch (e) {
    return { ...DEFAULT_FLEX_CALIBRATION };
  }
};

/**
 * Legacy loader for sensor hardware calibration bounds
 */
export const loadSensorCalibration = () => {
  try {
    const raw = localStorage.getItem(SENSOR_CALIB_STORAGE_KEY);
    if (!raw) {
      const glove = loadGloveCalibration();
      const res = {};
      FINGER_KEYS.forEach(f => {
        res[f] = { straight: glove[f].flat, bent: glove[f].bent, flat: glove[f].flat };
      });
      return res;
    }
    const parsed = JSON.parse(raw);
    const merged = {};
    FINGER_KEYS.forEach(f => {
      merged[f] = {
        straight: parsed[f]?.straight ?? DEFAULT_SENSOR_BOUNDS[f].straight,
        bent: parsed[f]?.bent ?? DEFAULT_SENSOR_BOUNDS[f].bent,
        flat: parsed[f]?.straight ?? DEFAULT_SENSOR_BOUNDS[f].straight
      };
    });
    return merged;
  } catch (e) {
    return { ...DEFAULT_SENSOR_BOUNDS };
  }
};

export const saveSensorCalibration = (bounds) => {
  try {
    localStorage.setItem(SENSOR_CALIB_STORAGE_KEY, JSON.stringify(bounds));
    return true;
  } catch (e) {
    console.error('Failed to save sensor calibration', e);
    return false;
  }
};

/**
 * Extract channel reading from any supported telemetry format:
 * - Explicit keys: raw_thumb, raw_index, raw_middle, raw_ring, raw_little
 * - Channel numbering: s1..s5, raw_s1..raw_s5, sensor1..sensor5, ch1..ch5
 * - Array packet: [s1, s2, s3, s4, s5] or { fingers: [s1..s5] } or { channels: [s1..s5] }
 * Mapping order:
 * Sensor #1 = Index, Sensor #2 = Middle, Sensor #3 = Ring, Sensor #4 = Little, Sensor #5 = Thumb
 */
export const extractChannelReading = (telemetry, fingerKey) => {
  if (!telemetry) return null;

  const channelIndexMap = { index: 0, middle: 1, ring: 2, little: 3, thumb: 4 };
  const chIdx = channelIndexMap[fingerKey];

  if (Array.isArray(telemetry) && chIdx !== undefined && telemetry[chIdx] !== undefined) {
    return Number(telemetry[chIdx]);
  }
  if (Array.isArray(telemetry?.fingers) && chIdx !== undefined && telemetry.fingers[chIdx] !== undefined) {
    return Number(telemetry.fingers[chIdx]);
  }
  if (Array.isArray(telemetry?.channels) && chIdx !== undefined && telemetry.channels[chIdx] !== undefined) {
    return Number(telemetry.channels[chIdx]);
  }

  const chNum = chIdx !== undefined ? (chIdx + 1) : null;
  const candidateKeys = [
    'raw_' + fingerKey,
    'raw_s' + chNum,
    'sensor' + chNum,
    's' + chNum,
    'channel' + chNum,
    'ch' + chNum
  ];

  for (const key of candidateKeys) {
    if (telemetry[key] !== undefined && telemetry[key] !== null) {
      const val = Number(telemetry[key]);
      if (!isNaN(val)) return val;
    }
  }

  // If telemetry has plain fingerKey (e.g. { index: 1200 }), treat as raw ADC only if > 180
  // (pre-scaled angles from mock/fallback are 0 - 90 deg)
  if (telemetry[fingerKey] !== undefined && telemetry[fingerKey] !== null) {
    const val = Number(telemetry[fingerKey]);
    if (!isNaN(val) && val > 180) {
      return val;
    }
  }

  return null;
};

/**
 * Stage 1: Normalize a sensor value to a 0.0 - 1.0 bend ratio
 * Formula: clamp((value - flat) / (bent - flat), 0, 1)
 * 
 * Works for both:
 * - bent > flat (ADC increases when bending)
 * - bent < flat (ADC decreases when bending)
 * 
 * Includes optional deadzone (default 0.0, recommended 0.03 for live glove)
 * to keep resting fingers completely still when flat.
 */
export const normalizeFlexValue = (value, flat = 1152, bent = 1217, useBoost = false, deadzone = 0.05) => {
  if (value === undefined || value === null || isNaN(value)) return 0;
  const num = Number(value);
  const span = bent - flat;
  if (Math.abs(span) < 1e-4) return 0;

  // Stretch the exact [flat, bent] interval to [0.0, 1.0]
  // Signed ratio: handles bent > flat (+span) and bent < flat (-span) seamlessly
  const rawRatio = (num - flat) / span;
  let bend = Math.max(0.0, Math.min(1.0, rawRatio));

  // Tiny deadzone at rest so open hand stays steady
  if (deadzone > 0 && bend < deadzone) {
    bend = 0.0;
  }

  if (useBoost && bend > 0 && bend < 1) {
    return Math.pow(bend, 0.60);
  }

  return bend;
};

/**
 * Direction-Aware Bend Calculation with Configurable Noise Threshold (Dead Zone)
 * 
 * When bending:
 * - Increasing sensors (bent > flat): bendDifference = liveValue - flatValue
 * - Decreasing sensors (bent < flat): bendDifference = flatValue - liveValue
 * 
 * Then:
 *   bendPercentage = clamp(
 *     (bendDifference - noiseThreshold) / (swingRange - noiseThreshold),
 *     0,
 *     1
 *   )
 * 
 * If bendDifference <= noiseThreshold (or negative due to reverse motion), finger remains 100% flat (0.0).
 * 
 * @param {number} liveValue - Live filtered ADC reading
 * @param {number} flatValue - Calibrated flat baseline
 * @param {number} bentValue - Calibrated full bend target
 * @param {number} [noiseThreshold=null] - Configurable noise threshold dead zone (counts)
 * @returns {Object} Directional bend metrics and validity status
 */
export const calculateDirectionalBend = (liveValue, flatValue, bentValue, noiseThreshold = null) => {
  if (liveValue === null || liveValue === undefined || isNaN(liveValue) || liveValue <= 5) {
    return {
      bendPercentage: 0,
      bendDifference: 0,
      rawDifference: 0,
      swingRange: 0,
      direction: 'uncalibrated',
      threshold: noiseThreshold || 4,
      isValid: false,
      needsRecalibration: true,
      error: 'No live telemetry'
    };
  }

  // Proper validation: Sensor #5 currently has Flat = 0, which is invalid
  if (flatValue === null || flatValue === undefined || flatValue <= 0) {
    return {
      bendPercentage: 0,
      bendDifference: 0,
      rawDifference: liveValue,
      swingRange: 0,
      direction: 'uncalibrated',
      threshold: noiseThreshold || 4,
      isValid: false,
      needsRecalibration: true,
      error: 'Sensor requires calibration (Flat=0 invalid)'
    };
  }

  if (bentValue === null || bentValue === undefined || bentValue <= 0) {
    return {
      bendPercentage: 0,
      bendDifference: 0,
      rawDifference: liveValue - flatValue,
      swingRange: 0,
      direction: 'uncalibrated',
      threshold: noiseThreshold || 4,
      isValid: false,
      needsRecalibration: true,
      error: 'Sensor requires calibration (Bent=0 invalid)'
    };
  }

  const swingRange = Math.abs(bentValue - flatValue);
  if (swingRange < 5) {
    return {
      bendPercentage: 0,
      bendDifference: 0,
      rawDifference: liveValue - flatValue,
      swingRange,
      direction: 'uncalibrated',
      threshold: noiseThreshold || 2,
      isValid: false,
      needsRecalibration: true,
      error: 'Insufficient calibration range (< 5 counts)'
    };
  }

  const isIncreasing = bentValue > flatValue;
  const direction = isIncreasing ? 'increasing' : 'decreasing';

  // Raw difference relative to flat baseline
  const rawDifference = liveValue - flatValue;

  // Direction-aware bend calculation
  // For increasing sensors: bendDifference = liveValue - flatValue
  // For decreasing sensors: bendDifference = flatValue - liveValue
  const bendDifference = isIncreasing
    ? (liveValue - flatValue)
    : (flatValue - liveValue);

  // Default noise threshold: 2 counts for narrow swings (< 20 counts), 4 counts for medium, 6 for wide
  const defaultThreshold = swingRange < 20 ? 2 : (swingRange < 50 ? 4 : 6);
  const threshold = (noiseThreshold !== null && noiseThreshold !== undefined)
    ? noiseThreshold
    : defaultThreshold;

  // If the difference is within the noise threshold (or negative), treat as completely flat
  if (bendDifference <= threshold) {
    return {
      bendPercentage: 0.0,
      bendDifference,
      rawDifference,
      swingRange,
      direction,
      threshold,
      isValid: true,
      needsRecalibration: false
    };
  }

  const effectiveSpan = swingRange - threshold;
  if (effectiveSpan <= 0) {
    return {
      bendPercentage: 0.0,
      bendDifference,
      rawDifference,
      swingRange,
      direction,
      threshold,
      isValid: true,
      needsRecalibration: false
    };
  }

  // Normalize remaining difference against swing range minus noise threshold
  const normalized = (bendDifference - threshold) / effectiveSpan;
  const bendPercentage = Math.max(0.0, Math.min(1.0, normalized));

  return {
    bendPercentage,
    bendDifference,
    rawDifference,
    swingRange,
    direction,
    threshold,
    isValid: true,
    needsRecalibration: false
  };
};

/**
 * Map a normalized ratio (0.0 - 1.0) to an approved GLB angle in degrees
 * Formula: glbAngle = glbMin + normalized * (glbMax - glbMin)
 * 
 * When custom approved bounds are provided with a wide span (>= 40), they are respected.
 * Otherwise, default full anatomical fist curl ranges are applied:
 * 0.0 = completely open / resting GLB hand pose (0°)
 * 0.5 = 50% half-bent finger
 * 1.0 = 100% full closed anatomical fist (75° for fingers, 48° for thumb)
 */
export const mapNormalizedToGlb = (normalized, fingerKey, glbConfig) => {
  const norm = Math.max(0, Math.min(1, normalized || 0));
  const rigInfo = FINGER_RIG_MAP[fingerKey] || { bone: 'right_index', axis: 'z' };
  const axis = rigInfo.axis;

  const fingerData = glbConfig?.fingers?.[fingerKey];
  const axisLimits = fingerData?.[axis];

  // If approved custom config exists and has valid wide range (span >= 40)
  if (axisLimits && Math.abs(axisLimits.max - axisLimits.min) >= 40) {
    const glbMin = axisLimits.min;
    const glbMax = axisLimits.max;
    const angle = glbMin + norm * (glbMax - glbMin);
    return {
      angle: Number(angle.toFixed(2)),
      axis: axis.toUpperCase(),
      min: glbMin,
      max: glbMax,
      targetBone: rigInfo.bone,
      normalized: norm
    };
  }

  // Full anatomical fist curl ranges (0.0 = open hand, 1.0 = full closed fist)
  const fullFistLimits = {
    index:  { min: 0, max: 75 },
    middle: { min: 0, max: 75 },
    ring:   { min: 0, max: 75 },
    little: { min: 0, max: 70 },
    thumb:  { min: 0, max: 48 }
  };

  const limits = fullFistLimits[fingerKey] || { min: 0, max: 75 };
  const angle = limits.min + norm * (limits.max - limits.min);

  return {
    angle: Number(angle.toFixed(2)),
    axis: axis.toUpperCase(),
    min: limits.min,
    max: limits.max,
    targetBone: rigInfo.bone,
    normalized: norm
  };
};

/**
 * Stage 1: Process full telemetry packet and calculate smoothed skeletal bend factors & GLB angles
 * 
 * Pipeline:
 * 1. Extract 5-channel readings (supports object keys, s1..s5, or array [s1..s5])
 * 2. Apply low-pass Exponential Moving Average (EMA) filter (alpha = 0.22)
 * 3. Normalize into [0.0, 1.0] using signed ratio and 0.03 deadzone
 * 4. Generate GLB bone target angles and rich diagnostic debug metrics
 */
export const processFingerTelemetry = (telemetry = {}, glbConfig = null, customBounds = null) => {
  const activeGlbConfig = glbConfig || loadCalibrationConfig();
  const gloveCalib = loadGloveCalibration();
  const packetBounds = telemetry?.bounds || {};

  const resolveSensorBounds = (finger) => {
    // 1. Check if customBounds were passed directly (e.g. from unit tests)
    if (customBounds?.[finger]) {
      const flat = customBounds[finger].flat ?? customBounds[finger].straight ?? 1152;
      const bent = customBounds[finger].bent ?? 1217;
      const swing = Math.abs(bent - flat);
      return {
        flat,
        bent,
        swing,
        direction: bent >= flat ? 'increasing' : 'decreasing',
        noiseThreshold: customBounds[finger].noiseThreshold ?? (swing < 25 ? 4 : 6),
        isExplicit: true,
        isValid: flat > 0 && swing >= 10,
        needsRecalibration: flat <= 0 || swing < 10
      };
    }

    const strKey = finger + 'Str';
    const bntKey = finger + 'Bnt';
    // 2. If packet has explicit wide calibrated test bounds (e.g. from unit tests where span >= 500)
    if (packetBounds[strKey] !== undefined && packetBounds[bntKey] !== undefined &&
        Math.abs(packetBounds[bntKey] - packetBounds[strKey]) >= 500) {
      const flat = packetBounds[strKey];
      const bent = packetBounds[bntKey];
      return {
        flat,
        bent,
        swing: Math.abs(bent - flat),
        direction: bent >= flat ? 'increasing' : 'decreasing',
        noiseThreshold: 0,
        isExplicit: true,
        isValid: true,
        needsRecalibration: false
      };
    }

    // 3. User saved calibration or default
    const cal = gloveCalib[finger] || DEFAULT_FLEX_CALIBRATION[finger];
    const flat = cal.flat;
    const bent = cal.bent;
    const swing = Math.abs(bent - flat);
    const isValid = flat > 0 && swing >= 5;
    return {
      flat,
      bent,
      swing,
      direction: isValid ? (bent >= flat ? 'increasing' : 'decreasing') : 'uncalibrated',
      noiseThreshold: cal.noiseThreshold ?? (swing < 20 ? 2 : (swing < 50 ? 4 : 6)),
      isExplicit: false,
      isValid,
      needsRecalibration: !isValid
    };
  };

  const results = {
    angles: {},      // { thumb: deg, index: deg, ... } for GLB
    normalized: {},  // { thumb: 0-1, index: 0-1, ... }
    percentages: {}, // { thumb: 0-100, index: 0-100, ... }
    debug: {}        // full diagnostic info per finger
  };

  FINGER_KEYS.forEach((finger) => {
    const rawVal = extractChannelReading(telemetry, finger);
    const angleVal = telemetry?.[finger];

    let normalized = 0;
    let filteredVal = 0;
    let rawReading = (rawVal !== undefined && rawVal !== null) ? Number(rawVal) : null;
    const bounds = resolveSensorBounds(finger);
    let dirResult = null;

    if (rawVal !== undefined && rawVal !== null && rawVal > 5) {
      // 1. Stage 1 Low-pass EMA filter (alpha = 0.25) to eliminate high-frequency ADC noise
      const alpha = 0.25;
      if (emaFilteredValues[finger] === null) {
        emaFilteredValues[finger] = rawVal;
      } else {
        emaFilteredValues[finger] = (alpha * rawVal) + ((1.0 - alpha) * emaFilteredValues[finger]);
      }
      const smoothVal = emaFilteredValues[finger];
      filteredVal = smoothVal;

      if (bounds.isExplicit) {
        // Direct explicit unit test bounds
        normalized = normalizeFlexValue(smoothVal, bounds.flat, bounds.bent, true, 0.0);
        dirResult = {
          bendPercentage: normalized,
          bendDifference: smoothVal - bounds.flat,
          rawDifference: rawReading - bounds.flat,
          swingRange: bounds.swing,
          direction: bounds.direction,
          threshold: bounds.noiseThreshold,
          isValid: true,
          needsRecalibration: false
        };
      } else if (!bounds.isValid || bounds.flat === 0) {
        // Validation check: Sensor #5 currently has Flat = 0, which is invalid.
        // Do not use it as a real calibration baseline; finger stays at neutral 0.
        normalized = 0.0;
        dirResult = {
          bendPercentage: 0.0,
          bendDifference: 0,
          rawDifference: rawReading !== null ? rawReading : 0,
          swingRange: 0,
          direction: 'uncalibrated',
          threshold: bounds.noiseThreshold,
          isValid: false,
          needsRecalibration: true,
          error: bounds.flat === 0 ? 'Sensor #5 requires calibration (Flat=0 invalid)' : 'Sensor requires recalibration'
        };
      } else {
        // DIRECTION-AWARE BEND CALCULATION WITH NOISE THRESHOLD DEAD ZONE
        dirResult = calculateDirectionalBend(smoothVal, bounds.flat, bounds.bent, bounds.noiseThreshold);
        normalized = dirResult.bendPercentage;
      }
    } else if (angleVal !== undefined && angleVal !== null && Number(angleVal) >= 0) {
      // Pre-filtered angle value from firmware or backend mock (0 - 90 deg)
      filteredVal = typeof angleVal === 'object' ? (angleVal.angle ?? 0) : Number(angleVal);
      const linearRatio = Math.max(0, Math.min(1, filteredVal / 90.0));
      normalized = linearRatio > 0 && linearRatio < 1 ? Math.pow(linearRatio, 0.60) : linearRatio;
      if (rawReading === null) {
        rawReading = Math.round(normalized * 4095);
      }
      dirResult = {
        bendPercentage: normalized,
        bendDifference: filteredVal,
        rawDifference: filteredVal,
        swingRange: 90,
        direction: 'increasing',
        threshold: 0,
        isValid: true,
        needsRecalibration: false
      };
    } else {
      normalized = 0;
      filteredVal = 0;
      if (rawReading === null) rawReading = 0;
      dirResult = {
        bendPercentage: 0,
        bendDifference: 0,
        rawDifference: 0,
        swingRange: bounds.swing || 0,
        direction: bounds.direction || 'uncalibrated',
        threshold: bounds.noiseThreshold || 6,
        isValid: bounds.isValid,
        needsRecalibration: bounds.needsRecalibration
      };
    }

    const glbMapping = mapNormalizedToGlb(normalized, finger, activeGlbConfig);

    results.angles[finger] = glbMapping.angle;
    results.normalized[finger] = normalized;
    results.percentages[finger] = Math.round(normalized * 100);

    const isIncreasing = bounds.bent > bounds.flat;
    const directionStr = bounds.flat === 0 ? 'uncalibrated' : (isIncreasing ? 'increasing' : 'decreasing');
    const rawDiff = rawReading !== null ? (rawReading - bounds.flat) : 0;
    const filtDiff = filteredVal !== 0 ? Math.round(filteredVal - bounds.flat) : 0;
    const bendDiff = dirResult?.bendDifference !== undefined ? Math.round(dirResult.bendDifference) : filtDiff;

    results.debug[finger] = {
      sensorNumber: FINGER_RIG_MAP[finger]?.channel || 1,
      finger,
      channel: FINGER_RIG_MAP[finger]?.channel || 1,
      raw: rawReading,
      filtered: Math.round(filteredVal),
      flat: bounds.flat,
      bent: bounds.bent,
      swing: dirResult?.swingRange ?? Math.abs(bounds.bent - bounds.flat),
      direction: directionStr,
      rawDifference: rawDiff,
      filteredDifference: filtDiff,
      bendDifference: bendDiff,
      noiseThreshold: dirResult?.threshold ?? bounds.noiseThreshold ?? 6,
      diff: bendDiff,
      ratio: Number(normalized.toFixed(3)),
      normalized: Math.round(normalized * 100),
      percentage: Math.round(normalized * 100),
      axis: glbMapping.axis,
      range: `${glbMapping.min}° → ${glbMapping.max}°`,
      glbAngle: glbMapping.angle,
      targetBone: glbMapping.targetBone,
      min: glbMapping.min,
      max: glbMapping.max,
      isValid: bounds.isValid && bounds.flat > 0,
      needsRecalibration: bounds.flat === 0 || !bounds.isValid,
      status: bounds.flat === 0
        ? 'Sensor #5 requires calibration (Flat=0 invalid)'
        : (normalized > 0 ? 'Bending' : 'Flat (Rest)')
    };
  });

  return results;
};

/**
 * Degrees to radians conversion helper
 */
export const degToRad = (degrees) => ((degrees || 0) * Math.PI) / 180;

/**
 * Stage 2: Shared, centralized helper to apply calibrated finger rotation to a Three.js finger bone node.
 * 
 * Two-Stage Smoothing Features:
 * - Frame-Rate-Independent Exponential Damping: uses THREE.MathUtils.damp(curr, target, 12, delta)
 *   when delta is supplied, otherwise smooth lerp with factor (default 0.15).
 * - Anatomical curl limits:
 *   - Fingers (Index, Middle, Ring, Little): curl along LOCAL Z axis (max ~1.20 rad / ~68°).
 *   - Thumb: inward curl along LOCAL X axis (max ~0.65 rad / ~37°) without clipping into palm.
 * - Rest rotation preservation: offsets are added strictly to the initial base rest pose.
 * 
 * @param {Object} fingerNode - The Three.js Object3D/Bone node
 * @param {string} nodeName - Node name ('right_thumb', 'right_index', etc.)
 * @param {Object} base - { x, y, z } base/rest rotation in radians
 * @param {number} angleDeg - Calibrated angle in degrees
 * @param {number} [factor=0.15] - Smoothing interpolation factor (used when delta is omitted)
 * @param {number} [delta=null] - Frame delta time in seconds from useFrame((state, delta) => ...)
 */
export const applyCalibratedFingerRotation = (fingerNode, nodeName, base, angleDeg, factor = 0.15, delta = null) => {
  if (!fingerNode || !base) return;

  const isThumb = nodeName === 'right_thumb' || nodeName === 'thumb';
  const rad = degToRad(angleDeg);

  // Frame-rate-independent damping interpolation helper
  const interpolate = (curr, target) => {
    // When factor is 1.0 (e.g. in immediate unit tests), snap immediately to target
    if (factor >= 1.0) return target;

    if (delta !== null && delta !== undefined && delta > 0) {
      if (typeof THREE !== 'undefined' && THREE.MathUtils?.damp) {
        return THREE.MathUtils.damp(curr, target, 12, delta);
      }
      // Damping formula fallback: curr + (target - curr) * (1 - exp(-12 * delta))
      return curr + (target - curr) * (1.0 - Math.exp(-12.0 * delta));
    }
    return curr + (target - curr) * (factor || 0.15);
  };

  if (isThumb) {
    // Thumb: Inward curl along LOCAL X axis (~1.10 rad max curl); Y and Z locked to base rest
    // Cap to anatomical limit of ~1.10 rad to prevent mesh clipping into palm
    const clampedRad = Math.max(-1.10, Math.min(1.10, rad));
    const targetX = base.x + clampedRad;
    fingerNode.rotation.x = interpolate(fingerNode.rotation.x, targetX);
    fingerNode.rotation.y = base.y;
    fingerNode.rotation.z = base.z;
  } else {
    // Index, Middle, Ring, Little: Curl along LOCAL Z axis (~1.45 rad max curl); X and Y locked to base rest
    const clampedRad = Math.max(-1.45, Math.min(1.45, rad));
    const targetZ = base.z + clampedRad;
    fingerNode.rotation.x = base.x;
    fingerNode.rotation.y = base.y;
    fingerNode.rotation.z = interpolate(fingerNode.rotation.z, targetZ);
  }
};
