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
  thumb:  { min: null, max: null },
  index:  { min: null, max: null },
  middle: { min: null, max: null },
  ring:   { min: null, max: null },
  little: { min: null, max: null }
};

export const resetDynamicRanges = () => {
  FINGER_KEYS.forEach((f) => {
    dynamicRanges[f] = { min: null, max: null };
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
 * Normalize a sensor value to a 0.0 - 1.0 bend ratio
 * Formula: clamp((value - straight) / (bent - straight), 0, 1)
 * Uses high-sensitivity power curve (gamma = 0.60) so even subtle micro-bends
 * produce immediate, visible 3D hand motion while smoothly reaching 1.0 at full bend.
 */
export const normalizeFlexValue = (value, straight = 1400, bent = 2200, useBoost = true) => {
  if (value === undefined || value === null || isNaN(value)) return 0;
  const num = Number(value);
  if (straight === bent) return 0;

  // Linear ratio clamped [0, 1]
  const linearRatio = Math.max(0, Math.min(1, (num - straight) / (bent - straight)));

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

  // Normalize incoming telemetry if it sends arrays: curl: [...] or raw: [...]
  const normalizedTelemetry = { ...telemetry };
  if (Array.isArray(telemetry?.curl)) {
    FINGER_KEYS.forEach((finger, idx) => {
      if (normalizedTelemetry[finger] === undefined && telemetry.curl[idx] !== undefined) {
        normalizedTelemetry[finger] = telemetry.curl[idx] * 90.0;
      }
    });
  }
  if (Array.isArray(telemetry?.raw)) {
    FINGER_KEYS.forEach((finger, idx) => {
      const rawKey = 'raw_' + finger;
      if (normalizedTelemetry[rawKey] === undefined && telemetry.raw[idx] !== undefined) {
        normalizedTelemetry[rawKey] = telemetry.raw[idx];
      }
    });
  }

  // Extract embedded hardware bounds if present in telemetry packet
  const packetBounds = normalizedTelemetry?.bounds || {};
  const resolveSensorBounds = (finger) => {
    const strKey = finger + 'Str';
    const bntKey = finger + 'Bnt';
    // Ignore default uncalibrated firmware values (0 and 4095)
    if (packetBounds[strKey] !== undefined && packetBounds[bntKey] !== undefined &&
        !(packetBounds[strKey] === 0 && packetBounds[bntKey] === 4095) &&
        Math.abs(packetBounds[bntKey] - packetBounds[strKey]) > 30) {
      return { straight: packetBounds[strKey], bent: packetBounds[bntKey] };
    }
    return sensorBounds[finger] || DEFAULT_SENSOR_BOUNDS[finger];
  };

  const results = {
    angles: {},          // { thumb: deg, index: deg, ... } for GLB
    normalized: {},      // { thumb: 0-1, index: 0-1, ... }
    percentages: {},     // { thumb: 0-100, index: 0-100, ... }
    lerpFactors: {},     // { thumb: 0.38 (fast open) / 0.12 (slow bend), ... }
    switchStates: {},    // { thumb: 'OPEN' | 'BENDING' | 'N/A', ... }
    switchConnected: {}, // { thumb: true | false | null, ... }
    debug: {}            // full diagnostic info per finger
  };

  // Helper to extract switch connection state for a finger
  const getFingerSwitchConnected = (finger, idx) => {
    // 1. Direct boolean array: telemetry.connected = [true, false, ...] (true = open/connected)
    if (Array.isArray(normalizedTelemetry?.connected) && normalizedTelemetry.connected[idx] !== undefined) {
      return Boolean(normalizedTelemetry.connected[idx]);
    }
    // 2. Raw pin reading array: telemetry.sw = [0, 1, 0, ...] (0 = LOW = connected = OPEN)
    if (Array.isArray(normalizedTelemetry?.sw) && normalizedTelemetry.sw[idx] !== undefined) {
      return Number(normalizedTelemetry.sw[idx]) === 0;
    }
    // 3. Named boolean/pin field: sw_thumb, thumb_switch, or thumb_connected
    if (normalizedTelemetry?.['sw_' + finger] !== undefined) {
      return Number(normalizedTelemetry['sw_' + finger]) === 0;
    }
    if (normalizedTelemetry?.[finger + '_switch'] !== undefined) {
      return Number(normalizedTelemetry[finger + '_switch']) === 0;
    }
    if (normalizedTelemetry?.[finger + '_connected'] !== undefined) {
      return Boolean(normalizedTelemetry[finger + '_connected']);
    }
    return null; // Switch telemetry not available for this packet
  };

  FINGER_KEYS.forEach((finger, fIndex) => {
    const rawKey = 'raw_' + finger;
    const rawVal = normalizedTelemetry?.[rawKey];
    const angleVal = normalizedTelemetry?.[finger];

    let normalized = 0;
    let filteredVal = 0;
    let rawReading = (rawVal !== undefined && rawVal !== null) ? Number(rawVal) : null;

    // Check digital switch state for this finger
    const isSwConnected = getFingerSwitchConnected(finger, fIndex);
    let lerpFactor = 0.25;

    // Track dynamic physical sensor min/max if reading valid signal (> 30 ADC counts)
    if (rawVal !== undefined && rawVal !== null && rawVal > 30) {
      if (dynamicRanges[finger].min === null || rawVal < dynamicRanges[finger].min) {
        dynamicRanges[finger].min = rawVal;
      }
      if (dynamicRanges[finger].max === null || rawVal > dynamicRanges[finger].max) {
        dynamicRanges[finger].max = rawVal;
      }
    }

    if (isSwConnected === true) {
      // ─────────────────────────────────────────────────────────────
      // SWITCH TECHNIQUE: CONTACT CONNECTED TO GND (digitalRead == LOW)
      // Contacts closed to GND -> Finger is confirmed fully OPEN / STRAIGHT in GLB!
      // Dynamic Lerp: fast opening (0.38)
      // ─────────────────────────────────────────────────────────────
      normalized = 0;
      filteredVal = 0;
      lerpFactor = 0.38;
      if (rawReading === null) rawReading = 0;
    } else if (isSwConnected === false) {
      // ─────────────────────────────────────────────────────────────
      // SWITCH TECHNIQUE: SWITCH OPEN / DISCONNECTED (digitalRead == HIGH)
      // Switch is MAIN DETERMINATION: Switch open -> finger is BENT in GLB!
      // Dynamic Lerp: smooth and slow (0.12)
      // Parallel Fusion with Flex Sensor:
      // - Flex modulates the depth of bend (0.50 -> 1.0) if reading active signal
      // - If flex is 0 ADC (fault/disconnected), switch alone drives 75% bend!
      // ─────────────────────────────────────────────────────────────
      lerpFactor = 0.12;

      let flexRatio = 0;
      if (angleVal !== undefined && angleVal !== null && Number(angleVal) >= 0) {
        filteredVal = typeof angleVal === 'object' ? (angleVal.angle ?? 0) : Number(angleVal);
        flexRatio = Math.max(0, Math.min(1, filteredVal / 90.0));
      } else if (rawVal !== undefined && rawVal !== null && rawVal > 30) {
        const bounds = resolveSensorBounds(finger);
        let effectiveStraight = bounds.straight;
        let effectiveBent = bounds.bent;

        const dynSpan = (dynamicRanges[finger].max || 0) - (dynamicRanges[finger].min || 0);
        if (dynSpan >= 25) {
          if (bounds.straight > bounds.bent) {
            effectiveStraight = dynamicRanges[finger].max;
            effectiveBent = dynamicRanges[finger].min;
          } else {
            effectiveStraight = dynamicRanges[finger].min;
            effectiveBent = dynamicRanges[finger].max;
          }
        }

        filteredVal = rawVal;
        flexRatio = normalizeFlexValue(rawVal, effectiveStraight, effectiveBent, true);
      }

      if (flexRatio > 0.05) {
        // Parallel fusion: base bend 0.50 from open switch + flex sensor adds up to 0.50
        normalized = Math.min(1.0, 0.50 + 0.50 * flexRatio);
      } else {
        // Switch open alone (e.g. while flex reads 0 ADC or flat):
        // Main determination drives steady visible bend in GLB!
        normalized = 0.75;
      }
      if (rawReading === null) rawReading = Math.round(normalized * 4095);
    } else {
      // No switch installed -> purely flex sensor
      lerpFactor = 0.25;

      if (angleVal !== undefined && angleVal !== null && Number(angleVal) >= 0) {
        filteredVal = typeof angleVal === 'object' ? (angleVal.angle ?? 0) : Number(angleVal);
        const linearRatio = Math.max(0, Math.min(1, filteredVal / 90.0));
        normalized = linearRatio > 0 && linearRatio < 1 ? Math.pow(linearRatio, 0.60) : linearRatio;
        if (rawReading === null) {
          rawReading = rawVal !== undefined ? Number(rawVal) : Math.round(normalized * 4095);
        }
      } else if (rawVal !== undefined && rawVal !== null && rawVal > 30) {
        const bounds = resolveSensorBounds(finger);
        let effectiveStraight = bounds.straight;
        let effectiveBent = bounds.bent;

        const dynSpan = (dynamicRanges[finger].max || 0) - (dynamicRanges[finger].min || 0);
        if (dynSpan >= 25) {
          if (bounds.straight > bounds.bent) {
            effectiveStraight = dynamicRanges[finger].max;
            effectiveBent = dynamicRanges[finger].min;
          } else {
            effectiveStraight = dynamicRanges[finger].min;
            effectiveBent = dynamicRanges[finger].max;
          }
        }

        filteredVal = rawVal;
        normalized = normalizeFlexValue(rawVal, effectiveStraight, effectiveBent, true);
      } else {
        normalized = 0;
        filteredVal = 0;
        if (rawReading === null) rawReading = 0;
      }
    }

    const glbMapping = mapNormalizedToGlb(normalized, finger, activeGlbConfig);

    results.angles[finger] = glbMapping.angle;
    results.normalized[finger] = normalized;
    results.percentages[finger] = Math.round(normalized * 100);
    results.lerpFactors[finger] = lerpFactor;
    results.switchConnected[finger] = isSwConnected;
    results.switchStates[finger] = isSwConnected === true ? 'OPEN' : (isSwConnected === false ? 'BENDING' : 'N/A');

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
      max: glbMapping.max,
      lerpFactor,
      isSwitchConnected: isSwConnected,
      switchState: results.switchStates[finger]
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
