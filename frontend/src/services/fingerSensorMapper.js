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
 * Default hardware ADC sensor bounds for each finger.
 * (Typical 12-bit ESP32 pull-down: ~1200 straight to ~2900 bent)
 */
export const DEFAULT_SENSOR_BOUNDS = {
  thumb:  { straight: 1200, bent: 2950 },
  index:  { straight: 1150, bent: 3100 },
  middle: { straight: 1180, bent: 3150 },
  ring:   { straight: 1220, bent: 3050 },
  little: { straight: 1100, bent: 2900 }
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
 * Normalize a sensor value to a 0.0 - 1.0 bend ratio
 * Formula: clamp((value - straight) / (bent - straight), 0, 1)
 */
export const normalizeFlexValue = (value, straight = 1200, bent = 2950) => {
  if (value === undefined || value === null || isNaN(value)) return 0;
  const num = Number(value);
  if (straight === bent) return 0;

  // Handle both straight < bent and straight > bent (sensor wiring polarity)
  const ratio = (num - straight) / (bent - straight);
  return Math.max(0, Math.min(1, ratio));
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
    if (packetBounds[strKey] !== undefined && packetBounds[bntKey] !== undefined) {
      return { straight: packetBounds[strKey], bent: packetBounds[bntKey] };
    }
    return sensorBounds[finger] || DEFAULT_SENSOR_BOUNDS[finger];
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
    let rawReading = rawVal !== undefined ? rawVal : null;

    if (rawVal !== undefined && rawVal !== null) {
      // Raw 12-bit ADC reading available
      const bounds = resolveSensorBounds(finger);
      filteredVal = rawVal;
      normalized = normalizeFlexValue(rawVal, bounds.straight, bounds.bent);
    } else if (angleVal !== undefined && angleVal !== null) {
      // Pre-filtered angle value from firmware or backend mock (0 - 90 deg)
      filteredVal = typeof angleVal === 'object' ? (angleVal.angle ?? 0) : angleVal;
      // Pre-filtered values in SmartPhysio ESP32 are 0° (straight) to 90° (bent)
      normalized = Math.max(0, Math.min(1, filteredVal / 90.0));
      if (rawReading === null) {
        rawReading = Math.round(normalized * 4095);
      }
    } else {
      normalized = 0;
      filteredVal = 0;
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
 * - Uses smooth lerp interpolation (default factor 0.25) to prevent snapping and jitter.
 * 
 * @param {Object} fingerNode - The Three.js Object3D/Bone node
 * @param {string} nodeName - Node name ('right_thumb', 'right_index', etc.)
 * @param {Object} base - { x, y, z } base/rest rotation in radians
 * @param {number} angleDeg - Calibrated angle in degrees
 * @param {number} [lerpFactor=0.25] - Smoothing interpolation factor
 */
export const applyCalibratedFingerRotation = (fingerNode, nodeName, base, angleDeg, lerpFactor = 0.25) => {
  if (!fingerNode || !base) return;

  const isThumb = nodeName === 'right_thumb' || nodeName === 'thumb';
  const rad = degToRad(angleDeg);

  // Smooth lerp function: current + (target - current) * t
  const lerp = (curr, target, t) => curr + (target - curr) * t;

  if (isThumb) {
    // Thumb: LOCAL X axis only (curl inward); Y and Z locked to base/rest
    const targetX = base.x + rad;
    fingerNode.rotation.x = lerp(fingerNode.rotation.x, targetX, lerpFactor);
    fingerNode.rotation.y = lerp(fingerNode.rotation.y, base.y, lerpFactor);
    fingerNode.rotation.z = lerp(fingerNode.rotation.z, base.z, lerpFactor);
  } else {
    // Index, Middle, Ring, Little: LOCAL Z axis only (curl inward); X and Y locked to base/rest
    const targetZ = base.z + rad;
    fingerNode.rotation.x = lerp(fingerNode.rotation.x, base.x, lerpFactor);
    fingerNode.rotation.y = lerp(fingerNode.rotation.y, base.y, lerpFactor);
    fingerNode.rotation.z = lerp(fingerNode.rotation.z, targetZ, lerpFactor);
  }
};
