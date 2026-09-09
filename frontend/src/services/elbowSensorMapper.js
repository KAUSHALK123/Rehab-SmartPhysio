import * as THREE from 'three';
import { loadCalibrationConfig } from './calibrationConfig';

export const degToRad = (degrees) => ((degrees || 0) * Math.PI) / 180;

export const DEFAULT_ELBOW_SENSOR_BOUNDS = {
  straight: 180, // 180° angle (or raw ADC ~1200)
  bent: 90       // 90° angle (or raw ADC ~2950)
};

/**
 * Identify if an exercise is an Elbow routine.
 * 
 * @param {Object|string} exercise - Exercise object or exercise name
 * @returns {'elbowFlexion' | null}
 */
export const resolveElbowMovementId = (exercise) => {
  if (!exercise) return null;

  if (typeof exercise === 'object' && exercise.movement_id === 'elbowFlexion') {
    return 'elbowFlexion';
  }

  const name = typeof exercise === 'string'
    ? exercise
    : (exercise.exercise_name || exercise.name || '');
  const nameLower = name.toLowerCase();

  const primarySensor = typeof exercise === 'object'
    ? (exercise.primary_sensor || '').toLowerCase()
    : '';

  const targetJoint = typeof exercise === 'object'
    ? (exercise.target_joint || '').toLowerCase()
    : '';

  // Explicitly reject wrist and finger exercises
  if (
    nameLower.includes('finger') ||
    nameLower.includes('thumb') ||
    nameLower.includes('pinch') ||
    nameLower.includes('grip') ||
    nameLower.includes('wrist') ||
    primarySensor.includes('wrist')
  ) {
    return null;
  }

  // Check for elbow / bicep / curl keywords
  if (
    nameLower.includes('elbow') ||
    nameLower.includes('bicep') ||
    nameLower.includes('curl') ||
    primarySensor === 'elbow' ||
    targetJoint.includes('elbow')
  ) {
    return 'elbowFlexion';
  }

  return null;
};

/**
 * Normalize an elbow flex sensor value to a 0.0 - 1.0 bend ratio.
 * 0.0 = fully extended (straight arm, 180°)
 * 1.0 = fully flexed (bent arm, 90°)
 * 
 * Handles both angle values (180 -> 90) and raw ADC values (1200 -> 2950).
 * 
 * @param {number} value - Sensor value (angle or raw ADC)
 * @param {number} [straight=180] - Value when arm is straight
 * @param {number} [bent=90] - Value when arm is bent
 * @returns {number} Normalized ratio between 0.0 and 1.0
 */
export const normalizeElbowSensor = (value, straight = 180, bent = 90) => {
  if (value === undefined || value === null || isNaN(value)) return 0;
  const num = Number(value);
  if (straight === bent) return 0;

  const ratio = (num - straight) / (bent - straight);
  return Math.max(0, Math.min(1, ratio));
};

/**
 * Map a normalized ratio (0.0 - 1.0) to approved GLB local X rotation angle in degrees.
 * 
 * Approved range for elbowFlexion:
 * min: -110° (full flexion)
 * max: 0° (full extension)
 * 
 * Formula: glbAngle = glbMax + norm * (glbMin - glbMax) -> 0° down to -110°
 * 
 * @param {number} normalized - Normalized ratio 0.0 to 1.0
 * @param {Object} [glbConfig] - Optional pre-loaded calibration config
 * @returns {{ x: number, y: number, z: number, movementId: string, targetBone: string }}
 */
export const mapElbowSensorToGLBAngles = (normalized, glbConfig = null) => {
  const norm = Math.max(0, Math.min(1, normalized ?? 0));
  const activeConfig = glbConfig || loadCalibrationConfig();
  
  const elbowData = activeConfig?.elbow?.elbowFlexion || {
    x: { min: -110, max: 0 },
    y: { min: -15, max: 15 },
    z: { min: -15, max: 15 }
  };

  const xLimits = elbowData.x || { min: -110, max: 0 };
  const minAngle = xLimits.min ?? -110;
  const maxAngle = xLimits.max ?? 0;

  // Map 0.0 -> maxAngle (0° straight), 1.0 -> minAngle (-110° bent)
  const angleX = maxAngle + norm * (minAngle - maxAngle);

  return {
    x: Number(angleX.toFixed(2)),
    y: 0,
    z: 0,
    movementId: 'elbowFlexion',
    targetBone: elbowData.targetBone || 'WristArm'
  };
};

/**
 * Process a WebSocket telemetry packet for an elbow exercise,
 * returning the calibrated 3D rotation angles { x, y: 0, z: 0 }.
 * 
 * @param {Object} telemetry - WebSocket sensor_data packet
 * @param {Object} exercise - Current exercise configuration
 * @param {Object} [glbConfig] - Optional calibration config override
 * @returns {{ movementId: string, angles: { x: number, y: number, z: number }, raw: number, normalizedRatio: number } | null}
 */
export const processElbowTelemetry = (telemetry = null, exercise = null, glbConfig = null) => {
  if (!telemetry || !exercise) return null;

  const movementId = resolveElbowMovementId(exercise);
  if (!movementId) return null;

  const activeConfig = glbConfig || loadCalibrationConfig();

  // Extract raw ADC or angle value from telemetry packet
  let rawVal = telemetry.raw_elbow;
  let elbowAngleVal = telemetry.elbow;

  let normalized = 0;
  let displayRaw = 0;

  if (rawVal !== undefined && rawVal !== null) {
    // 12-bit ADC flex sensor reading available
    displayRaw = rawVal;
    normalized = normalizeElbowSensor(rawVal, 1200, 2950);
  } else if (elbowAngleVal !== undefined && elbowAngleVal !== null) {
    // Angle in degrees from firmware or backend mock (180° -> 90°)
    displayRaw = elbowAngleVal;
    normalized = normalizeElbowSensor(elbowAngleVal, 180, 90);
  } else {
    normalized = 0;
    displayRaw = 180;
  }

  const mapping = mapElbowSensorToGLBAngles(normalized, activeConfig);

  return {
    movementId,
    angles: {
      x: mapping.x,
      y: 0,
      z: 0
    },
    raw: displayRaw,
    normalizedRatio: normalized,
    percentage: Math.round(normalized * 100),
    targetBone: mapping.targetBone
  };
};

/**
 * Apply calibrated Elbow GLB rotation.
 * Bending is strictly locked to LOCAL X axis.
 *
 * @param {THREE.Object3D} forearmNode - The GLB node for elbow/forearm (e.g. WristArm or right_forearm)
 * @param {Object} base - captured rest rotation angles { x, y, z } in radians
 * @param {Object} testAngles - user test angles { x, y, z } in degrees
 * @param {number} lerpFactor - smooth interpolation factor (default 0.25)
 */
export function applyCalibratedElbowRotation(forearmNode, base, testAngles, lerpFactor = 0.25) {
  if (!forearmNode || !testAngles) return;

  const baseRot = base || { x: 0, y: 0, z: 0 };

  // Elbow bending uses LOCAL X axis ONLY.
  // Negative X rotation bends forearm forward/upward (-X deg).
  const targetX = baseRot.x + degToRad(testAngles?.x || 0);

  forearmNode.rotation.x = THREE.MathUtils.lerp(forearmNode.rotation.x, targetX, lerpFactor);
  forearmNode.rotation.y = THREE.MathUtils.lerp(forearmNode.rotation.y, baseRot.y, lerpFactor);
  forearmNode.rotation.z = THREE.MathUtils.lerp(forearmNode.rotation.z, baseRot.z, lerpFactor);
}
