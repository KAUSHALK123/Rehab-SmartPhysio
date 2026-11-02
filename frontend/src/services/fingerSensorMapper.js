/**
 * SmartPhysio Central Movement Controller & Finger Sensor Mapping Service
 * 
 * =========================================================================
 * LEGACY FLEX SENSOR LOGIC — PRESERVED, CURRENTLY DISABLED IN SWITCH MODE
 * 
 * Original Analog Flex Sensor GPIO Assignments:
 * - Thumb:  GPIO 36 (VP / ADC1_CH0)
 * - Index:  GPIO 33 (ADC1_CH5)
 * - Middle: GPIO 34 (ADC1_CH6)
 * - Ring:   GPIO 35 (ADC1_CH7)
 * - Little: GPIO 32 (ADC1_CH4)
 * - Elbow:  GPIO 39 (VN / ADC1_CH3)
 * - Grip:   GPIO 25 (Pressure Resistor)
 * 
 * All legacy flex sensor reading, calibration, bounds, dynamic ranges, and
 * normalization routines are fully preserved below for future reactivation.
 * =========================================================================
 * 
 * CURRENT ACTIVE MOVEMENT SOURCE:
 * Pure Digital Switch Inputs (INPUT_PULLUP to GND):
 * - Thumb:  GPIO 27 -> Local X axis (45° inward palm curl)
 * - Index:  GPIO 19 -> Local Z axis (65° curl)
 * - Middle: GPIO 23 -> Local Z axis (65° curl)
 * - Ring:   GPIO 18 -> Local Z axis (60° curl)
 * - Little: GPIO 13 -> Local Z axis (50° curl)
 * - Elbow:  GPIO 27 -> Local X axis (Independent elbow joint switch)
 */

import { loadCalibrationConfig } from './calibrationConfig';

export const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'little'];

export const FINGER_SWITCH_GPIOS = {
  thumb: 27,
  index: 19,
  middle: 23,
  ring: 18,
  little: 13
};

// Calibrated anatomical bend angles (degrees) for pure digital switch mode:
// Thumb curls inward (45°), Index/Middle curl (65°), Ring (60°), Little (50°)
export const SWITCH_BEND_ANGLES = {
  thumb: 45,
  index: 65,
  middle: 65,
  ring: 60,
  little: 50
};

/**
 * Robust parser for digital contact switch state.
 * Handles numeric (1=pressed, 0=released), boolean, string, or raw GPIO level (0=LOW=pressed).
 */
export const isSwitchPressed = (telemetry, finger) => {
  if (!telemetry) return false;

  // 1. Explicit boolean pressed flag from firmware (true = NOT TOUCHED / HIGH = BENT)
  if (telemetry[finger + '_pressed'] !== undefined) {
    return Boolean(telemetry[finger + '_pressed']);
  }

  // 2. Direct hardware GPIO reading (INPUT_PULLUP glove logic):
  // NOT TOUCHED / open via pullup (HIGH / 1) -> BENT (return true)
  // TOUCHED / closed to GND (LOW / 0) -> OPEN / STRAIGHT default position (return false)
  const rawSw = telemetry['raw_' + finger + '_switch'];
  if (rawSw !== undefined && rawSw !== null) {
    if (rawSw === 1 || rawSw === '1' || rawSw === 'HIGH' || rawSw === true) {
      return true; // NOT TOUCHED -> BENT
    }
    if (rawSw === 0 || rawSw === '0' || rawSw === 'LOW' || rawSw === false) {
      return false; // TOUCHED to GND -> OPEN / STRAIGHT
    }
  }

  // 3. Processed / debounced switch value:
  // 1 / 'bent' / 'HIGH' / 'open' = BENT (return true)
  // 0 / 'straight' / 'LOW' / 'closed' / 'touched' = OPEN / STRAIGHT (return false)
  const swVal = telemetry[finger + '_switch'];
  if (swVal !== undefined && swVal !== null) {
    if (swVal === 1 || swVal === true || swVal === '1' || swVal === 'bent' || swVal === 'open' || swVal === 'HIGH') {
      return true;
    }
    if (swVal === 0 || swVal === false || swVal === '0' || swVal === 'straight' || swVal === 'closed' || swVal === 'LOW') {
      return false;
    }
  }

  // 4. Seamless fallback for mock telemetry or pre-filtered angle packets (>= 35° = bent)
  if (telemetry[finger] !== undefined && typeof telemetry[finger] === 'number') {
    return telemetry[finger] >= 35;
  }

  return false;
};

/**
 * Computes pure digital switch-driven finger angles for GLB hand animation.
 * Completely ignores analog flex sensor values.
 * 
 * Each switch controls only its corresponding finger:
 * - Pressed (LOW / 1): bends to calibrated angle (e.g. 65° for index)
 * - Released (HIGH / 0): returns to 0° neutral rest pose
 * Multiple switches operate independently and simultaneously.
 */

// Central active movement source: 'SWITCH' (default for current testing version) vs 'FLEX' (legacy)
export let activeMovementSource = 'SWITCH';

export const setActiveMovementSource = (source) => {
  activeMovementSource = (source === 'FLEX') ? 'FLEX' : 'SWITCH';
  console.log('[MOVEMENT CONTROLLER] activeMovementSource set to:', activeMovementSource);
};

export const getActiveMovementSource = () => activeMovementSource;

/**
 * Authoritative Central Movement Controller for SmartPhysio GLB Finger Animation.
 * Shared by all exercises across the Exercise Library and trial test panels.
 * 
 * In SWITCH mode (default):
 * - All finger movement derives purely from digital switch states (GPIO 27, 19, 23, 18, 13).
 * - Flex sensor ADC values are completely bypassed and cannot override switch angles.
 * - Pressed = bends finger to calibrated angle.
 * - Released = returns finger to neutral 0° rest pose.
 * - Multiple pressed switches move simultaneously and independently.
 * 
 * In FLEX mode (preserved legacy):
 * - Calculates angles from analog flex sensor ADC inputs.
 */
export const getAuthoritativeFingerMovement = (telemetry = {}, simulatedSwitches = null, options = {}) => {
  const currentSource = options.forceSource || activeMovementSource;
  if (currentSource === 'SWITCH') {
    return computeSwitchFingerAngles(telemetry, simulatedSwitches, options.customBendAngles);
  }
  return processFingerTelemetry(telemetry, options.glbConfig, options.sensorBounds, options.fingerModes);
};

export const computeSwitchFingerAngles = (telemetry = {}, simulatedSwitches = null, customBendAngles = null) => {
  const bendAngles = customBendAngles || SWITCH_BEND_ANGLES;
  const angles = {};
  const percentages = {};
  const debug = {};
  let anyPressed = false;

  FINGER_KEYS.forEach((finger) => {
    const hwPressed = isSwitchPressed(telemetry, finger);
    const simPressed = simulatedSwitches ? (simulatedSwitches[finger] === 1 || simulatedSwitches[finger] === true) : false;
    const isPressed = hwPressed || simPressed;

    if (isPressed) anyPressed = true;

    const targetAngle = isPressed ? (bendAngles[finger] || 50) : 0;

    angles[finger] = targetAngle;
    percentages[finger] = isPressed ? 100 : 0;

    debug[finger] = {
      finger,
      gpio: FINGER_SWITCH_GPIOS[finger],
      pressed: isPressed,
      switchState: isPressed ? 'closed' : 'open',
      switchStatus: isPressed ? 'PRESSED (LOW)' : 'RELEASED (HIGH)',
      switchVal: isPressed ? 1 : 0,
      targetAngle,
      glbAngle: targetAngle,
      normalized: isPressed ? 100 : 0,
      mode: 'SWITCH',
      raw: telemetry?.['raw_' + finger] ?? null,
      filtered: targetAngle,
      targetBone: FINGER_RIG_MAP[finger]?.bone || ('right_' + finger),
      axis: (FINGER_RIG_MAP[finger]?.axis || 'z').toUpperCase(),
      min: 0,
      max: bendAngles[finger] || 50,
      range: '0° → ' + (bendAngles[finger] || 50) + '°'
    };
  });

  return {
    angles,
    percentages,
    debug,
    anyPressed
  };
};


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
export const processFingerTelemetry = (telemetry = {}, glbConfig = null, customBounds = null, customModes = null) => {
  const activeGlbConfig = glbConfig || loadCalibrationConfig();
  const sensorBounds = customBounds || loadSensorCalibration();

  // Extract embedded hardware bounds if present in telemetry packet
  const packetBounds = telemetry?.bounds || {};
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

    // Track dynamic physical sensor min/max if reading valid signal (> 30 ADC counts)
    if (rawVal !== undefined && rawVal !== null && rawVal > 30) {
      if (dynamicRanges[finger].min === null || rawVal < dynamicRanges[finger].min) {
        dynamicRanges[finger].min = rawVal;
      }
      if (dynamicRanges[finger].max === null || rawVal > dynamicRanges[finger].max) {
        dynamicRanges[finger].max = rawVal;
      }
    }

    // Determine active input mode for this finger: 'FLEX' (default) vs 'SWITCH'
    const modeKey = finger + '_mode';
    const activeMode = (customModes?.[finger] || telemetry?.[modeKey] || 'FLEX').toUpperCase();

    // Check if digital switch input is present
    const switchKey = finger + '_switch';
    const rawSwitchKey = 'raw_' + finger + '_switch';
    const pressedKey = finger + '_pressed';
    let switchVal = null;
    if (telemetry?.[pressedKey] !== undefined) {
      switchVal = telemetry[pressedKey] ? 1 : 0;
    } else if (telemetry?.[rawSwitchKey] !== undefined && telemetry?.[rawSwitchKey] !== null) {
      // Physical glove: NOT TOUCHED (HIGH / 1) = BENT (1); TOUCHED to GND (LOW / 0) = STRAIGHT (0)
      const r = telemetry[rawSwitchKey];
      switchVal = (r === 1 || r === '1' || r === 'HIGH' || r === true) ? 1 : 0;
    } else if (telemetry?.[switchKey] !== undefined && telemetry?.[switchKey] !== null) {
      const v = telemetry[switchKey];
      switchVal = (v === 1 || v === true || v === '1' || v === 'bent' || v === 'open' || v === 'HIGH') ? 1 : 0;
    }

    if (activeMode === 'SWITCH') {
      // --- DIGITAL CONTACT SWITCH MODE ---
      // Open switch (HIGH / 0) = 0.0 (straight pose)
      // Closed switch (LOW / 1) = 1.0 (fully bent 90° pose)
      const isClosed = switchVal === 1;
      normalized = isClosed ? 1.0 : 0.0;
      filteredVal = isClosed ? 90.0 : 0.0;
      if (rawReading === null) {
        rawReading = isClosed ? 4095 : 0;
      }
    } else {
      // --- CONTINUOUS ANALOG FLEX SENSOR MODE ---
      if (rawVal !== undefined && rawVal !== null && rawVal > 30) {
        // Raw 12-bit ADC reading available
        const bounds = resolveSensorBounds(finger);
        let effectiveStraight = bounds.straight;
        let effectiveBent = bounds.bent;

        // Ultra-sensitive dynamic auto-range adapts to micro-bends (span >= 25)
        const dynSpan = (dynamicRanges[finger].max || 0) - (dynamicRanges[finger].min || 0);
        if (dynSpan >= 25) {
          effectiveStraight = dynamicRanges[finger].min;
          effectiveBent = dynamicRanges[finger].max;
        }

        filteredVal = rawVal;
        normalized = normalizeFlexValue(rawVal, effectiveStraight, effectiveBent, true);
      } else if (angleVal !== undefined && angleVal !== null && Number(angleVal) >= 0) {
        // Pre-filtered angle value from firmware or backend mock (0 - 90 deg)
        filteredVal = typeof angleVal === 'object' ? (angleVal.angle ?? 0) : Number(angleVal);
        const linearRatio = Math.max(0, Math.min(1, filteredVal / 90.0));
        // Apply ultra-sensitive boost for subtle angle inputs
        normalized = linearRatio > 0 && linearRatio < 1 ? Math.pow(linearRatio, 0.60) : linearRatio;
        if (rawReading === null) {
          rawReading = Math.round(normalized * 4095);
        }
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

    results.debug[finger] = {
      finger,
      mode: activeMode,
      switchVal: switchVal !== null ? switchVal : 0,
      switchState: switchVal === 1 ? 'closed' : 'open',
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
