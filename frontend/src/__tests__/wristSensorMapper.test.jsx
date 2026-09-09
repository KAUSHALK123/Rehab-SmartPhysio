import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveWristMovementId,
  normalizeWristSensor,
  mapWristSensorToGLBAngles,
  processWristTelemetry,
  applyCalibratedWristRotation,
  degToRad,
  WRIST_MOVEMENT_KEYS,
  WRIST_SENSOR_DEFAULTS
} from '../services/wristSensorMapper';

describe('wristSensorMapper Service', () => {
  const mockApprovedGlbConfig = {
    wrist: {
      hiMovement: {
        targetBone: 'Circle',
        rotationOrder: 'XYZ',
        x: { min: -10, max: 10 },
        y: { min: -15, max: 15 },
        z: { min: -35, max: 35 },
        approved: true
      },
      upDown: {
        targetBone: 'Circle',
        rotationOrder: 'XYZ',
        x: { min: -45, max: 45 },
        y: { min: -10, max: 10 },
        z: { min: -10, max: 10 },
        approved: true
      },
      twist: {
        targetBone: 'Circle',
        rotationOrder: 'XYZ',
        x: { min: -5, max: 5 },
        y: { min: -60, max: 60 },
        z: { min: -5, max: 5 },
        approved: true
      }
    }
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('resolveWristMovementId', () => {
    it('identifies hiMovement from exercise names and synonyms', () => {
      expect(resolveWristMovementId({ exercise_name: 'Hi Movement' })).toBe('hiMovement');
      expect(resolveWristMovementId({ exercise_name: 'Wrist Waving' })).toBe('hiMovement');
      expect(resolveWristMovementId({ exercise_name: 'Radial & Ulnar Deviation' })).toBe('hiMovement');
      expect(resolveWristMovementId({ movement_id: 'hiMovement' })).toBe('hiMovement');
    });

    it('identifies upDown from flexion and extension exercises', () => {
      expect(resolveWristMovementId({ exercise_name: 'Wrist Flexion & Extension' })).toBe('upDown');
      expect(resolveWristMovementId({ exercise_name: 'Up / Down Waving' })).toBe('upDown');
      expect(resolveWristMovementId({ primary_sensor: 'wrist_pitch' })).toBe('upDown');
    });

    it('identifies twist from rotation and pronation/supination exercises', () => {
      expect(resolveWristMovementId({ exercise_name: 'Wrist Twist & Turn' })).toBe('twist');
      expect(resolveWristMovementId({ exercise_name: 'Forearm Pronation and Supination' })).toBe('twist');
      expect(resolveWristMovementId({ exercise_name: 'Left / Right Twist' })).toBe('twist');
    });

    it('returns null for non-wrist exercises', () => {
      expect(resolveWristMovementId({ exercise_name: 'Finger Grip' })).toBeNull();
      expect(resolveWristMovementId({ exercise_name: 'Elbow Flexion' })).toBeNull();
      expect(resolveWristMovementId(null)).toBeNull();
    });
  });

  describe('normalizeWristSensor', () => {
    it('normalizes within bounds and clamps [0, 1]', () => {
      // Min: -45, Max: 45
      expect(normalizeWristSensor(-45, -45, 45)).toBe(0);
      expect(normalizeWristSensor(0, -45, 45)).toBe(0.5);
      expect(normalizeWristSensor(45, -45, 45)).toBe(1);

      // Clamping
      expect(normalizeWristSensor(-90, -45, 45)).toBe(0);
      expect(normalizeWristSensor(90, -45, 45)).toBe(1);
    });

    it('handles division by zero and invalid inputs safely', () => {
      expect(normalizeWristSensor(45, 45, 45)).toBe(0.5);
      expect(normalizeWristSensor(null)).toBe(0.5);
      expect(normalizeWristSensor(NaN)).toBe(0.5);
    });
  });

  describe('mapWristSensorToGLBAngles', () => {
    it('maps hiMovement using independent approved ranges', () => {
      // config: x: [-10, 10], y: [-15, 15], z: [-35, 35]
      const at0 = mapWristSensorToGLBAngles(0.0, 'hiMovement', mockApprovedGlbConfig);
      expect(at0).toMatchObject({ x: -10, y: -15, z: -35 });

      const atMid = mapWristSensorToGLBAngles(0.5, 'hiMovement', mockApprovedGlbConfig);
      expect(atMid).toMatchObject({ x: 0, y: 0, z: 0 });

      const at1 = mapWristSensorToGLBAngles(1.0, 'hiMovement', mockApprovedGlbConfig);
      expect(at1).toMatchObject({ x: 10, y: 15, z: 35 });
    });

    it('maps upDown using independent approved ranges', () => {
      // config: x: [-45, 45], y: [-10, 10], z: [-10, 10]
      const at0 = mapWristSensorToGLBAngles(0.0, 'upDown', mockApprovedGlbConfig);
      expect(at0).toMatchObject({ x: -45, y: -10, z: -10 });

      const atMid = mapWristSensorToGLBAngles(0.5, 'upDown', mockApprovedGlbConfig);
      expect(atMid).toMatchObject({ x: 0, y: 0, z: 0 });

      const at1 = mapWristSensorToGLBAngles(1.0, 'upDown', mockApprovedGlbConfig);
      expect(at1).toMatchObject({ x: 45, y: 10, z: 10 });
    });

    it('maps twist using independent approved ranges', () => {
      // config: x: [-5, 5], y: [-60, 60], z: [-5, 5]
      const at0 = mapWristSensorToGLBAngles(0.0, 'twist', mockApprovedGlbConfig);
      expect(at0).toMatchObject({ x: -5, y: -60, z: -5 });

      const atMid = mapWristSensorToGLBAngles(0.5, 'twist', mockApprovedGlbConfig);
      expect(atMid).toMatchObject({ x: 0, y: 0, z: 0 });

      const at1 = mapWristSensorToGLBAngles(1.0, 'twist', mockApprovedGlbConfig);
      expect(at1).toMatchObject({ x: 5, y: 60, z: 5 });
    });
  });

  describe('processWristTelemetry', () => {
    it('processes live wrist_pitch telemetry for Up/Down exercise', () => {
      const packet = {
        type: 'sensor_data',
        wrist_pitch: 45.0,
        wrist_roll: 0.0
      };
      const exercise = { exercise_name: 'Wrist Flexion & Extension' };
      const res = processWristTelemetry(packet, exercise, mockApprovedGlbConfig);

      expect(res).not.toBeNull();
      expect(res.movementId).toBe('upDown');
      expect(res.raw).toBe(45.0);
      expect(res.normalizedRatio).toBe(1.0); // max of [-45, 45]
      expect(res.angles).toEqual({ x: 45, y: 10, z: 10 });
    });

    it('processes live wrist_roll telemetry for Twist exercise', () => {
      const packet = {
        type: 'sensor_data',
        wrist_pitch: 0.0,
        wrist_roll: 0.0 // midpoint of [-60, 60]
      };
      const exercise = { exercise_name: 'Forearm Pronation and Supination' };
      const res = processWristTelemetry(packet, exercise, mockApprovedGlbConfig);

      expect(res).not.toBeNull();
      expect(res.movementId).toBe('twist');
      expect(res.normalizedRatio).toBe(0.5);
      expect(res.angles).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('returns null if telemetry or exercise is invalid', () => {
      expect(processWristTelemetry(null, { exercise_name: 'Wrist Waving' })).toBeNull();
      expect(processWristTelemetry({ wrist_pitch: 10 }, null)).toBeNull();
      expect(processWristTelemetry({ wrist_pitch: 10 }, { exercise_name: 'Finger Exercise' })).toBeNull();
    });
  });

  describe('applyCalibratedWristRotation', () => {
    it('lerps Circle node rotation towards base + target Euler angles', () => {
      const circleNode = {
        rotation: { x: 0, y: 0, z: 0 }
      };
      const base = { x: 0.1, y: 0.2, z: 0.3 };
      const angles = { x: 20, y: 10, z: 5 };

      // Apply one step with lerp factor 0.5
      applyCalibratedWristRotation(circleNode, base, angles, 0.5);

      const targetX = 0.1 + degToRad(20);
      const targetY = 0.2 + degToRad(10);
      const targetZ = 0.3 + degToRad(5);

      expect(circleNode.rotation.x).toBeCloseTo(0 + (targetX - 0) * 0.5, 4);
      expect(circleNode.rotation.y).toBeCloseTo(0 + (targetY - 0) * 0.5, 4);
      expect(circleNode.rotation.z).toBeCloseTo(0 + (targetZ - 0) * 0.5, 4);
    });

    it('handles null angles or missing node safely without mutating rotation', () => {
      const circleNode = { rotation: { x: 1, y: 2, z: 3 } };
      applyCalibratedWristRotation(circleNode, { x: 0, y: 0, z: 0 }, null);
      expect(circleNode.rotation.x).toBe(1);

      expect(() => applyCalibratedWristRotation(null, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).not.toThrow();
    });
  });
});
