/**
 * SmartPhysio Finger Sensor Mapping Service (Fix 2)
 * 
 * Pipeline:
 * Real Flex Sensor / Telemetry
 *       ↓
 * Normalized 0–100% Bend
 *       ↓
 * Approved GLB Calibration Range (from smartphysio_glb_calibration)
 *       ↓
 * Local GLB Rotation Angle
 *       ↓
 * Real-time 3D Finger Movement
 * 
 * Rules:
 * - Thumb: Target bone 'right_thumb', Bending Axis: LOCAL X ONLY
 * - Index: Target bone 'right_index', Bending Axis: LOCAL Z ONLY
 * - Middle: Target bone 'right_middle', Bending Axis: LOCAL Z ONLY
 * - Ring: Target bone 'right_ring', Bending Axis: LOCAL Z ONLY
 * - Little: Target bone 'right_little', Bending Axis: LOCAL Z ONLY
 */

import { loadCalibrationConfig } from './calibrationConfig';

export const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'little'];

export const FINGER_RIG_MAP = {
  thumb:  { bone: 'right_thumb',  axis: 'x' },
  index:  { bone: 'right_index',  axis: 'z' },
  middle: { bone: 'right_middle', axis: 'z' },
  ring:   { bone: 'right_ring',   axis: 'z' },
  little: { bone: 'right_little', axis: 'z' }
};

const SENSOR_CALIB_STORAGE_KEY = 'smartphysio_sensor_calibration';

/**
 * Real-time dynamic auto-range tracker.
 * Adapts to physical flex sensor ADC output on-the-fly even before manual calibration.
 */
const dynamicRanges = {
  thumb:  { min: null, max: null, baseline: null, count: 0 },
  index:  { min: null, max: null, baseline: null, count: 0 },
  middle: { min: null, max: null, baseline: null, count: 0 },
  ring:   { min: null, max: null, baseline: null, count: 0 },
  little: { min: null, max: null, baseline: null, count: 0 }
};

export const resetDynamicRanges = () => {
  FINGER_KEYS.forEach((f) => {
    dynamicRanges[f] = { min: null, max: null, baseline: null, count: 0, polarity: null };
  });
};

/**
 * Default hardware ADC sensor bounds for each finger.
 * (Typical flex sensor on ESP32 voltage divider has ~600-900 ADC active range from rest to bend)
 */
export const DEFAULT_SENSOR_BOUNDS = {
  thumb:  { straight: 1400, bent: 2200 },
  index:  { straight: 1350, bent: 2250 },
  middle: { straight: 1380, bent: 2280 },
  ring:   { straight: 1400, bent: 2250 },
  little: { straight: 1300, bent: 2150 }
};

/**
 * Load sensor hardware calibration bounds from localStorage, merged with defaults
 */
export const loadSensorCalibration = () => {
  try {
    const raw = localStorage.getItem(SENSOR_CALIB_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SENSOR_BOUNDS };
    const parsed = JSON.parse(raw);
    const merged = {};
    FINGER_KEYS.forEach(f => {
      merged[f] = {
        straight: parsed[f]?.straight ?? DEFAULT_SENSOR_BOUNDS[f].straight,
        bent: parsed[f]?.bent ?? DEFAULT_SENSOR_BOUNDS[f].bent
      };
    });
    return merged;
  } catch (e) {
    return { ...DEFAULT_SENSOR_BOUNDS };
  }
};

/**
 * Save sensor hardware calibration bounds to localStorage
 */
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
 * Normalize a sensor value to a 0.0 - 1.0 bend ratio.
 * Supports both standard polarity (bent > straight) and inverted polarity (bent < straight,
 * common with pull-down voltage dividers where bending increases sensor resistance and drops voltage).
 * Uses high-sensitivity power curve (gamma = 0.60) so micro-bends produce visible, fluid motion.
 */
export const normalizeFlexValue = (value, straight = 1400, bent = 2200, useBoost = true) => {
  if (value === undefined || value === null || isNaN(value)) return 0;
  const num = Number(value);
  if (straight === bent) return 0;

  // Support both positive polarity (bent > straight) and inverted polarity (bent < straight)
  let ratio = 0;
  if (bent > straight) {
    ratio = (num - straight) / (bent - straight);
  } else {
    ratio = (straight - num) / (straight - bent);
  }

  // Linear ratio clamped [0, 1]
  const linearRatio = Math.max(0, Math.min(1, ratio));

  if (!useBoost || linearRatio === 0 || linearRatio === 1) {
    return linearRatio;
  }

  // Ultra-sensitive response for slight bends (y = x^0.60)
  return Math.max(0, Math.min(1, Math.pow(linearRatio, 0.60)));
};

/**
 * Map a normalized ratio (0.0 - 1.0) to an approved GLB angle in degrees
 * Formula: glbAngle = glbMin + normalized * (glbMax - glbMin)
 */
export const mapNormalizedToGlb = (normalized, fingerKey, glbConfig) => {
  const norm = Math.max(0, Math.min(1, normalized || 0));
  const rigInfo = FINGER_RIG_MAP[fingerKey] || { bone: 'right_index', axis: 'z' };
  const axis = rigInfo.axis;

  const fingerData = glbConfig?.fingers?.[fingerKey];
  const axisLimits = fingerData?.[axis] || { min: 0, max: 60 };

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
};

/**
 * Process a full telemetry packet or simulated input and calculate GLB finger angles
 * 
 * Supports:
 * 1. Raw ADC fields: raw_thumb, raw_index, raw_middle, raw_ring, raw_little
 * 2. Pre-scaled firmware/mock angle fields: thumb, index, middle, ring, little (0-90)
 * 3. Hardware bounds embedded in packet: bounds.thumbStr, bounds.thumbBnt, etc.
 */
export const processFingerTelemetry = (telemetry = {}, glbConfig = null, customBounds = null) => {
  const activeGlbConfig = glbConfig || loadCalibrationConfig();
  const sensorBounds = customBounds || loadSensorCalibration();

  // Extract embedded hardware bounds if present in telemetry packet
  const packetBounds = telemetry?.bounds || {};
  const resolveSensorBounds = (finger) => {
    const strKey = finger + 'Str';
    const bntKey = finger + 'Bnt';
    // Check embedded hardware bounds from firmware NVS
    if (packetBounds[strKey] !== undefined && packetBounds[bntKey] !== undefined &&
        !(packetBounds[strKey] === 0 && packetBounds[bntKey] === 4095) &&
        Math.abs(packetBounds[bntKey] - packetBounds[strKey]) > 30) {
      return { straight: packetBounds[strKey], bent: packetBounds[bntKey], isExplicit: true };
    }
    // Check saved calibration from localStorage
    const saved = sensorBounds[finger];
    if (saved && saved.straight !== undefined && saved.bent !== undefined && Math.abs(saved.bent - saved.straight) > 30) {
      return { ...saved, isExplicit: true };
    }
    return { ...DEFAULT_SENSOR_BOUNDS[finger], isExplicit: false };
  };

  const results = {
    angles: {},      // { thumb: deg, index: deg, ... } for GLB
    normalized: {},  // { thumb: 0-1, index: 0-1, ... }
    percentages: {}, // { thumb: 0-100, index: 0-100, ... }
    debug: {}        // full diagnostic info per finger
  };

  FINGER_KEYS.forEach((finger) => {
    const rawKey = 'raw_' + finger;
    const rawVal = telemetry?.[rawKey];
    const angleVal = telemetry?.[finger];

    let normalized = 0;
    let filteredVal = 0;
    let rawReading = (rawVal !== undefined && rawVal !== null) ? Number(rawVal) : null;

    // Track dynamic physical sensor min/max and resting baseline if reading valid signal (> 30 ADC counts)
    if (rawVal !== undefined && rawVal !== null && rawVal > 30) {
      const tracker = dynamicRanges[finger];
      if (tracker.baseline === null) {
        tracker.baseline = rawVal;
        tracker.min = rawVal;
        tracker.max = rawVal;
        tracker.count = 1;
      } else {
        if (tracker.count < 50) {
          // Average initial resting readings for steady baseline
          tracker.baseline = (tracker.baseline * tracker.count + rawVal) / (tracker.count + 1);
          tracker.count++;
        } else {
          // Slow continuous baseline drift adaptation (EMA) to prevent locking over time
          tracker.baseline = 0.998 * tracker.baseline + 0.002 * rawVal;
        }
        if (rawVal < tracker.min) tracker.min = rawVal;
        if (rawVal > tracker.max) tracker.max = rawVal;
      }
    }

    if (rawVal !== undefined && rawVal !== null && rawVal > 30) {
      // Raw 12-bit ADC reading available
      const bounds = resolveSensorBounds(finger);
      const tracker = dynamicRanges[finger];
      let effectiveStraight = bounds.straight;
      let effectiveBent = bounds.bent;

      // Only apply dynamic auto-range override if explicit calibration is NOT provided
      if (!bounds.isExplicit) {
        const dynSpan = (tracker.max || 0) - (tracker.min || 0);
        if (dynSpan >= 80) {
          const baseline = tracker.baseline !== null ? tracker.baseline : bounds.straight;
          // Determine polarity once per session to prevent sudden inversion flip-flop
          if (!tracker.polarity) {
            const diffAbove = tracker.max - baseline;
            const diffBelow = baseline - tracker.min;
            tracker.polarity = diffBelow > diffAbove ? 'active_low' : 'active_high';
          }

          if (tracker.polarity === 'active_low') {
            effectiveStraight = tracker.max;
            effectiveBent = tracker.min;
          } else {
            effectiveStraight = tracker.min;
            effectiveBent = tracker.max;
          }
        } else {
          // When motion span is small, anchor straight to baseline so subtle bends immediately show
          const lower = Math.min(bounds.straight, bounds.bent);
          const upper = Math.max(bounds.straight, bounds.bent);
          if (rawVal < lower - 50 || rawVal > upper + 50) {
            const baseline = tracker.baseline !== null ? tracker.baseline : rawVal;
            effectiveStraight = baseline;
            effectiveBent = baseline > 2000 ? (baseline - 600) : (baseline + 600);
          }
        }
      }

      filteredVal = rawVal;
      normalized = normalizeFlexValue(rawVal, effectiveStraight, effectiveBent, true);
    } else if (angleVal !== undefined && angleVal !== null && Number(angleVal) >= 0) {
      // Pre-filtered angle value from firmware or backend mock (0 - 90 deg)
      filteredVal = typeof angleVal === 'object' ? (angleVal.angle ?? 0) : Number(angleVal);
      const linearRatio = Math.max(0, Math.min(1, filteredVal / 90.0));
      normalized = linearRatio > 0 && linearRatio < 1 ? Math.pow(linearRatio, 0.60) : linearRatio;
      if (rawReading === null) {
        rawReading = Math.round(normalized * 4095);
      }
    } else {
      normalized = 0;
      filteredVal = 0;
      if (rawReading === null) rawReading = 0;
    }

    // Safety & live sensor guarantee:
    // If firmware on ESP32 or telemetry calculated an active bend angle (> 0),
    // ensure normalized is NEVER stuck at 0 while the physical sensor is bending!
    if (angleVal !== undefined && angleVal !== null) {
      const deg = typeof angleVal === 'object' ? (angleVal.angle ?? 0) : Number(angleVal);
      if (deg > 0 && deg <= 90) {
        const fwNorm = Math.min(1, Math.max(0, deg / 90.0));
        const boostedFwNorm = fwNorm > 0 && fwNorm < 1 ? Math.pow(fwNorm, 0.60) : fwNorm;
        if (boostedFwNorm > normalized) {
          normalized = boostedFwNorm;
        }
      }
    }

    const glbMapping = mapNormalizedToGlb(normalized, finger, activeGlbConfig);

    results.angles[finger] = glbMapping.angle;
    results.normalized[finger] = normalized;
    results.percentages[finger] = Math.round(normalized * 100);

    results.debug[finger] = {
      finger,
      raw: rawReading,
      filtered: Math.round(filteredVal),
      normalized: Math.round(normalized * 100),
      axis: glbMapping.axis,
      range: `${glbMapping.min}° → ${glbMapping.max}°`,
      glbAngle: glbMapping.angle,
      targetBone: glbMapping.targetBone,
      min: glbMapping.min,
      max: glbMapping.max
    };
  });

  return results;
};

/**
 * Degrees to radians conversion helper
 */
export const degToRad = (degrees) => ((degrees || 0) * Math.PI) / 180;

/**
 * Shared, centralized helper to apply calibrated finger rotation to a Three.js finger bone node.
 * 
 * Rules:
 * - Thumb: Target bone 'right_thumb', LOCAL X axis ONLY. Y and Z are strictly locked to base rest.
 * - Index, Middle, Ring, Little: Target bones 'right_index'..'right_little', LOCAL Z axis ONLY.
 *   X and Y are strictly locked to base rest.
 * - Uses smooth frame-rate independent exponential damping when delta is provided, falling back to lerpFactor.
 * 
 * @param {Object} fingerNode - The Three.js Object3D/Bone node
 * @param {string} nodeName - Node name ('right_thumb', 'right_index', etc.)
 * @param {Object} base - { x, y, z } base/rest rotation in radians
 * @param {number} angleDeg - Calibrated angle in degrees
 * @param {number} [lerpFactor=0.25] - Smoothing interpolation factor fallback
 * @param {number} [delta=null] - Frame delta time in seconds (enables frame-rate independent damping)
 */
export const applyCalibratedFingerRotation = (fingerNode, nodeName, base, angleDeg, lerpFactor = 0.25, delta = null) => {
  if (!fingerNode || !base) return;

  const isThumb = nodeName === 'right_thumb' || nodeName === 'thumb';
  const rad = degToRad(angleDeg);

  // Smooth frame-rate independent exponential damping factor
  const effectiveFactor = (delta !== null && delta !== undefined)
    ? (1 - Math.exp(-22 * Math.min(delta || 0.016, 0.1)))
    : lerpFactor;

  // Smooth lerp function: current + (target - current) * t
  const lerp = (curr, target, t) => curr + (target - curr) * t;

  if (isThumb) {
    // Thumb: LOCAL X axis only (curl inward); Y and Z locked to base/rest
    const targetX = base.x + rad;
    fingerNode.rotation.x = lerp(fingerNode.rotation.x, targetX, effectiveFactor);
    fingerNode.rotation.y = lerp(fingerNode.rotation.y, base.y, effectiveFactor);
    fingerNode.rotation.z = lerp(fingerNode.rotation.z, base.z, effectiveFactor);
  } else {
    // Index, Middle, Ring, Little: LOCAL Z axis only (curl inward); X and Y locked to base/rest
    const targetZ = base.z + rad;
    fingerNode.rotation.x = lerp(fingerNode.rotation.x, base.x, effectiveFactor);
    fingerNode.rotation.y = lerp(fingerNode.rotation.y, base.y, effectiveFactor);
    fingerNode.rotation.z = lerp(fingerNode.rotation.z, targetZ, effectiveFactor);
  }
};
