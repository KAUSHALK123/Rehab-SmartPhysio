/**
 * SmartPhysio Wrist Sensor Mapping Service
 * 
 * Architecture:
 * REAL MPU6050 SENSOR (pitch, roll)
 *        ↓
 * EXISTING WEBSOCKET TELEMETRY
 *        ↓
 * MOVEMENT SELECTOR (hiMovement, upDown, twist)
 *        ↓
 * NORMALIZED BEND RATIO (-1.0 to +1.0 or 0.0 to 1.0)
 *        ↓
 * APPROVED WRIST GLB CALIBRATION (from smartphysio_glb_calibration)
 *        ↓
 * LOCAL X / Y / Z TRANSFORMATION
 *        ↓
 * SMOOTH GLB MOVEMENT (Circle bone)
 * 
 * Rules:
 * - Target bone: 'Circle' (Hand/Wrist assembly)
 * - 3 Distinct Calibrated Movements:
 *   1. Hi Movement ('hiMovement'): Left ↔ Right waving
 *   2. Up / Down Waving ('upDown'): Up ↕ Down flexion & extension
 *   3. Left / Right Twist ('twist'): Pronation & supination
 * - Interpolation: Smooth lerp factor (0.25) per frame
 */

import { loadCalibrationConfig } from './calibrationConfig';
import { degToRad } from './fingerSensorMapper';

export { degToRad };

export const WRIST_MOVEMENT_KEYS = {
  HI_MOVEMENT: 'hiMovement',
  UP_DOWN: 'upDown',
  TWIST: 'twist'
};

export const WRIST_SENSOR_DEFAULTS = {
  hiMovement: { min: -45, max: 45, sensor: 'wrist_roll' },
  upDown: { min: -45, max: 45, sensor: 'wrist_pitch' },
  twist: { min: -60, max: 60, sensor: 'wrist_roll' }
};

/**
 * Identify the appropriate calibrated wrist movement ID for an exercise.
 * 
 * @param {Object|string} exercise - Exercise object or exercise name
 * @returns {'hiMovement' | 'upDown' | 'twist' | null}
 */
export const resolveWristMovementId = (exercise) => {
  if (!exercise) return null;

  if (typeof exercise === 'object') {
    if (exercise.wrist_movement_id) return exercise.wrist_movement_id;
    if (exercise.movement_id && (exercise.movement_id === 'hiMovement' || exercise.movement_id === 'upDown' || exercise.movement_id === 'twist')) {
      return exercise.movement_id;
    }
  }

  const name = typeof exercise === 'string' 
    ? exercise 
    : (exercise.exercise_name || exercise.name || '');
  const nameLower = name.toLowerCase();

  const primarySensor = typeof exercise === 'object' 
    ? (exercise.primary_sensor || '').toLowerCase() 
    : '';

  // Explicitly reject non-wrist exercises
  if (
    nameLower.includes('finger') ||
    nameLower.includes('thumb') ||
    nameLower.includes('pinch') ||
    nameLower.includes('grip') ||
    nameLower.includes('elbow') ||
    primarySensor.includes('flex') ||
    primarySensor === 'elbow'
  ) {
    return null;
  }

  // 1. Check for Left / Right Twist / Rotation / Pronation / Supination keywords
  if (
    nameLower.includes('twist') ||
    nameLower.includes('rotation') ||
    nameLower.includes('pronation') ||
    nameLower.includes('supination') ||
    nameLower.includes('roll') ||
    primarySensor === 'wrist_roll'
  ) {
    return 'twist';
  }

  // 2. Check for Hi Movement / Greeting / Radial-Ulnar Deviation keywords
  if (
    nameLower.includes('hi movement') || 
    nameLower.includes('greeting') ||
    nameLower.includes('radial') ||
    nameLower.includes('ulnar') ||
    nameLower.includes('deviation') ||
    nameLower.includes('abduction') ||
    (nameLower.includes('waving') && !nameLower.includes('up') && !nameLower.includes('down'))
  ) {
    return 'hiMovement';
  }

  // 3. Check for Up / Down / Flexion / Extension keywords (e.g. Up / Down Waving)
  if (
    nameLower.includes('flexion') ||
    nameLower.includes('extension') ||
    nameLower.includes('pitch') ||
    /\bup\b/i.test(nameLower) ||
    /\bdown\b/i.test(nameLower) ||
    primarySensor === 'wrist_pitch'
  ) {
    return 'upDown';
  }

  // Default wrist exercise fallback
  if (nameLower.includes('wrist')) {
    return 'upDown';
  }

  return null;
};

/**
 * Normalize an MPU6050 sensor angle (pitch/roll) within physical limits to a 0.0 - 1.0 ratio.
 * Center (0° neutral) maps to 0.5.
 * 
 * @param {number} value - Sensor angle in degrees
 * @param {number} [sensorMin=-45] - Minimum expected sensor angle
 * @param {number} [sensorMax=45] - Maximum expected sensor angle
 * @returns {number} Normalized ratio between 0.0 and 1.0
 */
export const normalizeWristSensor = (value, sensorMin = -45, sensorMax = 45) => {
  if (value === undefined || value === null || isNaN(value)) return 0.5;
  const num = Number(value);
  if (sensorMin === sensorMax) return 0.5;

  const minVal = Math.min(sensorMin, sensorMax);
  const maxVal = Math.max(sensorMin, sensorMax);
  const clamped = Math.max(minVal, Math.min(maxVal, num));

  // If ranges were inverted (e.g. 45 down to -45)
  const ratio = (clamped - sensorMin) / (sensorMax - sensorMin);
  return Math.max(0, Math.min(1, ratio));
};

/**
 * Map a normalized ratio (0.0 - 1.0) to approved GLB Euler offset angles in degrees { x, y, z }.
 * 
 * Formula for each axis:
 * glbAngle = min + norm * (max - min)
 * 
 * @param {number} normalized - Normalized ratio 0.0 to 1.0
 * @param {'hiMovement' | 'upDown' | 'twist'} movementId
 * @param {Object} [glbConfig] - Optional pre-loaded calibration config
 * @returns {{ x: number, y: number, z: number, movementId: string }}
 */
export const mapWristSensorToGLBAngles = (normalized, movementId = 'upDown', glbConfig = null) => {
  const norm = Math.max(0, Math.min(1, normalized ?? 0.5));
  const activeConfig = glbConfig || loadCalibrationConfig();
  const wristData = activeConfig?.wrist?.[movementId] || {
    x: { min: -40, max: 40 },
    y: { min: -15, max: 15 },
    z: { min: -15, max: 15 }
  };

  const mapAxis = (axisLimits) => {
    if (!axisLimits) return 0;
    const min = axisLimits.min ?? 0;
    const max = axisLimits.max ?? 0;
    const angle = min + norm * (max - min);
    return Number(angle.toFixed(2));
  };

  return {
    x: mapAxis(wristData.x),
    y: mapAxis(wristData.y),
    z: mapAxis(wristData.z),
    movementId,
    targetBone: wristData.targetBone || 'Circle'
  };
};

/**
 * Process a WebSocket telemetry packet for a specific wrist exercise,
 * returning the calibrated 3D rotation angles { x, y, z }.
 * 
 * @param {Object} telemetry - WebSocket sensor_data packet
 * @param {Object} exercise - Current exercise configuration from DB or state
 * @param {Object} [glbConfig] - Optional calibration config override
 * @returns {{ movementId: string, angles: { x: number, y: number, z: number }, raw: number, normalized: number } | null}
 */
export const processWristTelemetry = (telemetry = null, exercise = null, glbConfig = null) => {
  if (!telemetry || !exercise) return null;

  const movementId = resolveWristMovementId(exercise);
  if (!movementId) return null;

  const activeConfig = glbConfig || loadCalibrationConfig();

  // Determine physical sensor range based on exercise target_angle if provided
  const targetAngle = Math.abs(exercise.target_angle || 45);
  const sensorLimit = Math.max(45, Math.min(90, targetAngle));
  const sensorMin = -sensorLimit;
  const sensorMax = sensorLimit;

  // Select primary sensor for this wrist movement
  let rawSensorVal = 0;
  if (movementId === 'upDown') {
    // Flexion / Extension: primary sensor is wrist_pitch
    rawSensorVal = telemetry.wrist_pitch ?? telemetry.pitch ?? 0.0;
  } else if (movementId === 'twist') {
    // Pronation / Supination: primary sensor is wrist_roll
    rawSensorVal = telemetry.wrist_roll ?? telemetry.roll ?? 0.0;
  } else if (movementId === 'hiMovement') {
    // Left / Right waving: primarily reflected in wrist_roll (or wrist_pitch depending on arm pose)
    rawSensorVal = telemetry.wrist_roll ?? telemetry.wrist_pitch ?? 0.0;
  } else {
    rawSensorVal = telemetry.wrist_pitch ?? 0.0;
  }

  const normalized = normalizeWristSensor(rawSensorVal, sensorMin, sensorMax);
  const mapping = mapWristSensorToGLBAngles(normalized, movementId, activeConfig);

  return {
    movementId,
    angles: {
      x: mapping.x,
      y: mapping.y,
      z: mapping.z
    },
    raw: rawSensorVal,
    normalized: Number((normalized * 100).toFixed(1)),
    normalizedRatio: normalized,
    targetBone: mapping.targetBone
  };
};

/**
 * Shared, centralized helper to apply calibrated 3D rotation to the Three.js 'Circle' wrist bone node.
 * 
 * Combines 3D test/calibrated angle offsets on top of base/rest pose using smooth lerp interpolation:
 * targetX = base.x + degToRad(angles.x)
 * targetY = base.y + degToRad(angles.y)
 * targetZ = base.z + degToRad(angles.z)
 * 
 * @param {Object} circleNode - Three.js Object3D / Bone node for 'Circle'
 * @param {Object} base - Base rest rotation in radians { x, y, z }
 * @param {Object} angles - Degree offsets { x, y, z }
 * @param {number} [lerpFactor=0.25] - Smoothing factor (default 0.25 matches Trial visualizer)
 */
export const applyCalibratedWristRotation = (circleNode, base, angles, lerpFactor = 0.25) => {
  if (!circleNode || !base || !angles) return;

  const radX = degToRad(angles?.x || 0);
  const radY = degToRad(angles?.y || 0);
  const radZ = degToRad(angles?.z || 0);

  const targetX = base.x + radX;
  const targetY = base.y + radY;
  const targetZ = base.z + radZ;

  const lerp = (curr, target, t) => curr + (target - curr) * t;

  circleNode.rotation.x = lerp(circleNode.rotation.x, targetX, lerpFactor);
  circleNode.rotation.y = lerp(circleNode.rotation.y, targetY, lerpFactor);
  circleNode.rotation.z = lerp(circleNode.rotation.z, targetZ, lerpFactor);
};

