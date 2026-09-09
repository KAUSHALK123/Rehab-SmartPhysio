import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveElbowMovementId,
  normalizeElbowSensor,
  mapElbowSensorToGLBAngles,
  processElbowTelemetry,
  applyCalibratedElbowRotation,
  degToRad
} from '../services/elbowSensorMapper';

describe('elbowSensorMapper Service', () => {
  const mockApprovedGlbConfig = {
    elbow: {
      elbowFlexion: {
        targetBone: 'WristArm',
        rotationOrder: 'XYZ',
        x: { min: -110, max: 0 },
        y: { min: -15, max: 15 },
        z: { min: -15, max: 15 },
        approved: true
      }
    }
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('resolveElbowMovementId', () => {
    it('identifies elbowFlexion from exercise names and synonyms', () => {
      expect(resolveElbowMovementId({ exercise_name: 'Elbow Flexion & Extension' })).toBe('elbowFlexion');
      expect(resolveElbowMovementId({ exercise_name: 'Bicep Curl Routine' })).toBe('elbowFlexion');
      expect(resolveElbowMovementId({ primary_sensor: 'elbow' })).toBe('elbowFlexion');
      expect(resolveElbowMovementId({ movement_id: 'elbowFlexion' })).toBe('elbowFlexion');
    });

    it('returns null for wrist or finger exercises', () => {
      expect(resolveElbowMovementId({ exercise_name: 'Wrist Waving' })).toBeNull();
      expect(resolveElbowMovementId({ exercise_name: 'Finger Flexion' })).toBeNull();
      expect(resolveElbowMovementId({ primary_sensor: 'wrist_pitch' })).toBeNull();
      expect(resolveElbowMovementId(null)).toBeNull();
    });
  });

  describe('normalizeElbowSensor', () => {
    it('normalizes angle value (180° straight -> 90° bent)', () => {
      expect(normalizeElbowSensor(180, 180, 90)).toBe(0);
      expect(normalizeElbowSensor(135, 180, 90)).toBe(0.5);
      expect(normalizeElbowSensor(90, 180, 90)).toBe(1);
    });

    it('normalizes raw ADC value (1200 straight -> 2950 bent)', () => {
      expect(normalizeElbowSensor(1200, 1200, 2950)).toBe(0);
      expect(normalizeElbowSensor(2075, 1200, 2950)).toBe(0.5);
      expect(normalizeElbowSensor(2950, 1200, 2950)).toBe(1);
    });

    it('clamps values outside bounds to [0, 1]', () => {
      expect(normalizeElbowSensor(200, 180, 90)).toBe(0);
      expect(normalizeElbowSensor(50, 180, 90)).toBe(1);
    });

    it('handles division by zero and invalid inputs safely', () => {
      expect(normalizeElbowSensor(180, 180, 180)).toBe(0);
      expect(normalizeElbowSensor(null)).toBe(0);
      expect(normalizeElbowSensor(NaN)).toBe(0);
    });
  });

  describe('mapElbowSensorToGLBAngles', () => {
    it('maps 0.0 ratio to approved GLB straight angle (0°)', () => {
      const res = mapElbowSensorToGLBAngles(0.0, mockApprovedGlbConfig);
      expect(res.x).toBe(0);
      expect(res.y).toBe(0);
      expect(res.z).toBe(0);
      expect(res.movementId).toBe('elbowFlexion');
    });

    it('maps 0.5 ratio to midpoint of approved GLB range (-55°)', () => {
      const res = mapElbowSensorToGLBAngles(0.5, mockApprovedGlbConfig);
      expect(res.x).toBe(-55);
    });

    it('maps 1.0 ratio to approved GLB max bend angle (-110°)', () => {
      const res = mapElbowSensorToGLBAngles(1.0, mockApprovedGlbConfig);
      expect(res.x).toBe(-110);
    });
  });

  describe('processElbowTelemetry', () => {
    it('processes telemetry packet with elbow angle 90° for Bicep Curl', () => {
      const packet = {
        type: 'sensor_data',
        elbow: 90.0
      };
      const exercise = { exercise_name: 'Bicep Curl Routine' };
      const res = processElbowTelemetry(packet, exercise, mockApprovedGlbConfig);

      expect(res).not.toBeNull();
      expect(res.movementId).toBe('elbowFlexion');
      expect(res.normalizedRatio).toBe(1.0);
      expect(res.angles).toEqual({ x: -110, y: 0, z: 0 });
    });

    it('processes telemetry packet with raw_elbow ADC value', () => {
      const packet = {
        type: 'sensor_data',
        raw_elbow: 1200
      };
      const exercise = { exercise_name: 'Elbow Flexion & Extension' };
      const res = processElbowTelemetry(packet, exercise, mockApprovedGlbConfig);

      expect(res).not.toBeNull();
      expect(res.normalizedRatio).toBe(0.0);
      expect(res.angles).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('returns null if exercise is not an elbow routine', () => {
      const packet = { type: 'sensor_data', elbow: 120 };
      expect(processElbowTelemetry(packet, { exercise_name: 'Wrist Flexion' })).toBeNull();
    });
  });

  describe('applyCalibratedElbowRotation', () => {
    it('interpolates WristArm node local X rotation towards base + target test angle', () => {
      const forearmNode = {
        rotation: { x: 0, y: 0, z: 0 }
      };
      const base = { x: 0.1, y: 0.2, z: 0.3 };
      const testAngles = { x: -90, y: 15, z: -10 };

      // Apply lerp with factor 0.5
      applyCalibratedElbowRotation(forearmNode, base, testAngles, 0.5);

      const targetX = 0.1 + degToRad(-90);
      const targetY = 0.2; // Y stays locked to base rotation
      const targetZ = 0.3; // Z stays locked to base rotation

      expect(forearmNode.rotation.x).toBeCloseTo(0 + (targetX - 0) * 0.5, 4);
      expect(forearmNode.rotation.y).toBeCloseTo(0 + (targetY - 0) * 0.5, 4);
      expect(forearmNode.rotation.z).toBeCloseTo(0 + (targetZ - 0) * 0.5, 4);
    });

    it('handles null node or missing test angles safely', () => {
      const forearmNode = { rotation: { x: 1, y: 2, z: 3 } };
      applyCalibratedElbowRotation(forearmNode, { x: 0, y: 0, z: 0 }, null);
      expect(forearmNode.rotation.x).toBe(1);

      expect(() => applyCalibratedElbowRotation(null, { x: 0, y: 0, z: 0 }, { x: -45, y: 0, z: 0 })).not.toThrow();
    });
  });
});
