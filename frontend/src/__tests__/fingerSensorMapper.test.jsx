import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  normalizeFlexValue, 
  mapNormalizedToGlb, 
  processFingerTelemetry, 
  applyCalibratedFingerRotation,
  calculateDirectionalBend,
  degToRad,
  FINGER_KEYS,
  FINGER_RIG_MAP
} from '../services/fingerSensorMapper';

describe('fingerSensorMapper Service (Fix 2)', () => {
  const mockApprovedGlbConfig = {
    fingers: {
      thumb:  { targetBone: 'right_thumb',  rotationOrder: 'XYZ', x: { min: -60, max: 20 }, y: { min: -20, max: 20 }, z: { min: -15, max: 15 }, approved: true },
      index:  { targetBone: 'right_index',  rotationOrder: 'XYZ', x: { min: 9, max: 10 },   y: { min: -15, max: 15 }, z: { min: -15, max: 65 }, approved: true },
      middle: { targetBone: 'right_middle', rotationOrder: 'XYZ', x: { min: 9, max: 10 },   y: { min: -15, max: 15 }, z: { min: -15, max: 65 }, approved: true },
      ring:   { targetBone: 'right_ring',   rotationOrder: 'XYZ', x: { min: 9, max: 10 },   y: { min: -15, max: 15 }, z: { min: -15, max: 65 }, approved: true },
      little: { targetBone: 'right_little', rotationOrder: 'XYZ', x: { min: 9, max: 10 },   y: { min: -15, max: 15 }, z: { min: -15, max: 25 }, approved: true }
    }
  };

  describe('normalizeFlexValue', () => {
    it('normalizes within bounds and clamps [0, 1]', () => {
      // Straight: 1000, Bent: 3000 (linear without boost)
      expect(normalizeFlexValue(1000, 1000, 3000, false)).toBe(0);
      expect(normalizeFlexValue(2000, 1000, 3000, false)).toBe(0.5);
      expect(normalizeFlexValue(3000, 1000, 3000, false)).toBe(1);
      // Below min clamps to 0
      expect(normalizeFlexValue(500, 1000, 3000, false)).toBe(0);
      // Above max clamps to 1
      expect(normalizeFlexValue(3500, 1000, 3000, false)).toBe(1);
      // Boosted version gives increased sensitivity at 50% (0.5^0.60 = 0.66)
      expect(normalizeFlexValue(2000, 1000, 3000, true)).toBeCloseTo(Math.pow(0.5, 0.60), 2);
    });

    it('safely handles divide by zero and invalid inputs', () => {
      expect(normalizeFlexValue(1000, 1000, 1000)).toBe(0);
      expect(normalizeFlexValue(null)).toBe(0);
      expect(normalizeFlexValue(undefined)).toBe(0);
      expect(normalizeFlexValue(NaN)).toBe(0);
    });
  });

  describe('mapNormalizedToGlb', () => {
    it('maps Thumb strictly to LOCAL X axis', () => {
      const at0 = mapNormalizedToGlb(0.0, 'thumb', mockApprovedGlbConfig);
      expect(at0.axis).toBe('X');
      expect(at0.targetBone).toBe('right_thumb');
      expect(at0.angle).toBe(-60);

      const at50 = mapNormalizedToGlb(0.5, 'thumb', mockApprovedGlbConfig);
      expect(at50.angle).toBe(-20); // -60 + 0.5 * (20 - (-60)) = -20

      const at100 = mapNormalizedToGlb(1.0, 'thumb', mockApprovedGlbConfig);
      expect(at100.angle).toBe(20);
    });

    it('maps Index strictly to LOCAL Z axis', () => {
      const at0 = mapNormalizedToGlb(0.0, 'index', mockApprovedGlbConfig);
      expect(at0.axis).toBe('Z');
      expect(at0.targetBone).toBe('right_index');
      expect(at0.angle).toBe(-15);

      const at50 = mapNormalizedToGlb(0.5, 'index', mockApprovedGlbConfig);
      expect(at50.angle).toBe(25); // -15 + 0.5 * (65 - (-15)) = 25

      const at100 = mapNormalizedToGlb(1.0, 'index', mockApprovedGlbConfig);
      expect(at100.angle).toBe(65);
    });

    it('maps Middle strictly to LOCAL Z axis', () => {
      const at0 = mapNormalizedToGlb(0.0, 'middle', mockApprovedGlbConfig);
      expect(at0.axis).toBe('Z');
      expect(at0.targetBone).toBe('right_middle');
      expect(at0.angle).toBe(-15);

      const at100 = mapNormalizedToGlb(1.0, 'middle', mockApprovedGlbConfig);
      expect(at100.angle).toBe(65);
    });

    it('maps Ring strictly to LOCAL Z axis', () => {
      const at0 = mapNormalizedToGlb(0.0, 'ring', mockApprovedGlbConfig);
      expect(at0.axis).toBe('Z');
      expect(at0.targetBone).toBe('right_ring');
      expect(at0.angle).toBe(-15);

      const at100 = mapNormalizedToGlb(1.0, 'ring', mockApprovedGlbConfig);
      expect(at100.angle).toBe(65);
    });

    it('maps Little strictly to LOCAL Z axis with approved range (-15 to 25)', () => {
      const at0 = mapNormalizedToGlb(0.0, 'little', mockApprovedGlbConfig);
      expect(at0.axis).toBe('Z');
      expect(at0.targetBone).toBe('right_little');
      expect(at0.angle).toBe(-15);

      const at50 = mapNormalizedToGlb(0.5, 'little', mockApprovedGlbConfig);
      expect(at50.angle).toBe(5); // -15 + 0.5 * (25 - (-15)) = 5

      const at100 = mapNormalizedToGlb(1.0, 'little', mockApprovedGlbConfig);
      expect(at100.angle).toBe(25);
    });
  });

  describe('processFingerTelemetry', () => {
    it('processes raw ADC values and computes GLB angles for all 5 fingers', () => {
      const packet = {
        type: 'sensor_data',
        raw_thumb: 1200, // 0%
        raw_index: 3100, // 100%
        raw_middle: 2165, // ~50%
        raw_ring: 1220, // 0%
        raw_little: 2900, // 100%
        bounds: {
          thumbStr: 1200, thumbBnt: 2950,
          indexStr: 1150, indexBnt: 3100,
          middleStr: 1180, middleBnt: 3150,
          ringStr: 1220, ringBnt: 3050,
          littleStr: 1100, littleBnt: 2900
        }
      };

      const result = processFingerTelemetry(packet, mockApprovedGlbConfig);

      expect(result.percentages.thumb).toBe(0);
      expect(result.angles.thumb).toBe(-60);

      expect(result.percentages.index).toBe(100);
      expect(result.angles.index).toBe(65);

      expect(result.percentages.middle).toBe(66); // 50% with gamma 0.60 = 66%
      expect(result.angles.middle).toBeCloseTo(-15 + 0.6597 * (65 - (-15)), 0);

      expect(result.percentages.little).toBe(100);
      expect(result.angles.little).toBe(25);

      // Verify debug object format
      expect(result.debug.thumb).toMatchObject({
        finger: 'thumb',
        axis: 'X',
        targetBone: 'right_thumb'
      });
      expect(result.debug.index).toMatchObject({
        finger: 'index',
        axis: 'Z',
        targetBone: 'right_index'
      });
    });

    it('processes pre-scaled angle streams (0-90 from mock / fallback)', () => {
      const packet = {
        type: 'sensor_data',
        thumb: 0,
        index: 90,
        middle: 45,
        ring: 0,
        little: 90
      };

      const result = processFingerTelemetry(packet, mockApprovedGlbConfig);

      expect(result.percentages.thumb).toBe(0);
      expect(result.angles.thumb).toBe(-60);

      expect(result.percentages.index).toBe(100);
      expect(result.angles.index).toBe(65);

      expect(result.percentages.middle).toBe(66);
      expect(result.angles.middle).toBeCloseTo(-15 + 0.6597 * (65 - (-15)), 0);
    });
  });

  describe('applyCalibratedFingerRotation & degToRad', () => {
    it('accurately converts degrees to radians', () => {
      expect(degToRad(0)).toBe(0);
      expect(degToRad(180)).toBeCloseTo(Math.PI);
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
    });

    it('Thumb: applies bending to LOCAL X axis only while locking Y and Z to base rest', () => {
      const mockNode = {
        rotation: { x: 0.1, y: 0.2, z: 0.3 }
      };
      const base = { x: 0.1, y: 0.2, z: 0.3 };
      const angleDeg = -40; // approved thumb range is negative to positive X

      // Call with full interpolation (lerpFactor = 1.0) to test immediate target
      applyCalibratedFingerRotation(mockNode, 'right_thumb', base, angleDeg, 1.0);

      const expectedX = base.x + degToRad(angleDeg);
      expect(mockNode.rotation.x).toBeCloseTo(expectedX);
      expect(mockNode.rotation.y).toBeCloseTo(base.y);
      expect(mockNode.rotation.z).toBeCloseTo(base.z);
    });

    it('Index: applies bending to LOCAL Z axis only while locking X and Y to base rest', () => {
      const mockNode = {
        rotation: { x: 0.5, y: -0.2, z: 0.1 }
      };
      const base = { x: 0.5, y: -0.2, z: 0.1 };
      const angleDeg = 45; // 45° bend

      applyCalibratedFingerRotation(mockNode, 'right_index', base, angleDeg, 1.0);

      const expectedZ = base.z + degToRad(angleDeg);
      expect(mockNode.rotation.z).toBeCloseTo(expectedZ);
      expect(mockNode.rotation.x).toBeCloseTo(base.x);
      expect(mockNode.rotation.y).toBeCloseTo(base.y);
    });

    it('Middle, Ring, Little: apply bending to LOCAL Z axis only', () => {
      ['right_middle', 'right_ring', 'right_little'].forEach((fingerBone) => {
        const mockNode = { rotation: { x: 0.2, y: 0.3, z: 0.4 } };
        const base = { x: 0.2, y: 0.3, z: 0.4 };
        const angleDeg = 50;

        applyCalibratedFingerRotation(mockNode, fingerBone, base, angleDeg, 1.0);

        const expectedZ = base.z + degToRad(angleDeg);
        expect(mockNode.rotation.z).toBeCloseTo(expectedZ);
        expect(mockNode.rotation.x).toBeCloseTo(base.x);
        expect(mockNode.rotation.y).toBeCloseTo(base.y);
      });
    });

    it('smoothly interpolates using lerpFactor across frames without snapping', () => {
      const mockNode = { rotation: { x: 0, y: 0, z: 0 } };
      const base = { x: 0, y: 0, z: 0 };
      const angleDeg = 60;
      const targetRad = degToRad(angleDeg);

      // Frame 1 with lerpFactor = 0.25
      applyCalibratedFingerRotation(mockNode, 'right_index', base, angleDeg, 0.25);
      expect(mockNode.rotation.z).toBeCloseTo(targetRad * 0.25);

      // Frame 2
      const prevZ = mockNode.rotation.z;
      applyCalibratedFingerRotation(mockNode, 'right_index', base, angleDeg, 0.25);
      expect(mockNode.rotation.z).toBeCloseTo(prevZ + (targetRad - prevZ) * 0.25);
      expect(mockNode.rotation.x).toBe(0);
      expect(mockNode.rotation.y).toBe(0);
    });

    it('handles null node or missing base safely without error', () => {
      expect(() => applyCalibratedFingerRotation(null, 'right_thumb', { x: 0, y: 0, z: 0 }, 10)).not.toThrow();
      expect(() => applyCalibratedFingerRotation({ rotation: { x: 0, y: 0, z: 0 } }, 'right_thumb', null, 10)).not.toThrow();
    });
  });

  describe('Direction-Aware Bend Calculation & Noise Threshold (Dead Zone)', () => {
    it('Sensor 1 (Index, increasing): Flat=1152, Bent=1217, Swing=65', () => {
      // Noise fluctuations around flat baseline must produce 0%
      expect(calculateDirectionalBend(1150, 1152, 1217, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1152, 1152, 1217, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1155, 1152, 1217, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1158, 1152, 1217, 6).bendPercentage).toBe(0); // within threshold 6

      // Above threshold starts bending
      const bend1180 = calculateDirectionalBend(1180, 1152, 1217, 6);
      expect(bend1180.bendPercentage).toBeGreaterThan(0);
      expect(bend1180.bendPercentage).toBeCloseTo((28 - 6) / (65 - 6), 3); // ~0.373

      const bend1200 = calculateDirectionalBend(1200, 1152, 1217, 6);
      expect(bend1200.bendPercentage).toBeGreaterThan(bend1180.bendPercentage);
      expect(bend1200.bendPercentage).toBeCloseTo((48 - 6) / (65 - 6), 3); // ~0.712

      // At full bent reaches 100%
      expect(calculateDirectionalBend(1217, 1152, 1217, 6).bendPercentage).toBe(1.0);
      // Beyond bent clamps to 100%
      expect(calculateDirectionalBend(1250, 1152, 1217, 6).bendPercentage).toBe(1.0);
    });

    it('Sensor 2 (Middle, decreasing): Flat=1463, Bent=1446, Swing=17', () => {
      // Noise / reverse fluctuations above flat baseline must produce 0%
      expect(calculateDirectionalBend(1465, 1463, 1446, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1463, 1463, 1446, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1460, 1463, 1446, 4).bendPercentage).toBe(0); // within threshold 4

      // Decreasing ADC causes bending
      const bend1455 = calculateDirectionalBend(1455, 1463, 1446, 4);
      expect(bend1455.bendPercentage).toBeCloseTo((8 - 4) / (17 - 4), 3); // 4/13 ~ 0.308

      // At full bent reaches 100%
      expect(calculateDirectionalBend(1446, 1463, 1446, 4).bendPercentage).toBe(1.0);
      expect(calculateDirectionalBend(1430, 1463, 1446, 4).bendPercentage).toBe(1.0);
    });

    it('Sensor 3 (Ring, decreasing): Flat=1200, Bent=1147, Swing=53', () => {
      expect(calculateDirectionalBend(1205, 1200, 1147, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1200, 1200, 1147, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1196, 1200, 1147, 6).bendPercentage).toBe(0); // within threshold 6

      const bend1175 = calculateDirectionalBend(1175, 1200, 1147, 6);
      expect(bend1175.bendPercentage).toBeCloseTo((25 - 6) / (53 - 6), 3); // 19/47 ~ 0.404

      expect(calculateDirectionalBend(1147, 1200, 1147, 6).bendPercentage).toBe(1.0);
    });

    it('Sensor 4 (Little, increasing): Flat=935, Bent=956, Swing=21', () => {
      expect(calculateDirectionalBend(930, 935, 956, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(935, 935, 956, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(938, 935, 956, 4).bendPercentage).toBe(0); // within threshold 4

      const bend945 = calculateDirectionalBend(945, 935, 956, 4);
      expect(bend945.bendPercentage).toBeCloseTo((10 - 4) / (21 - 4), 3); // 6/17 ~ 0.353

      expect(calculateDirectionalBend(956, 935, 956, 4).bendPercentage).toBe(1.0);
    });

    it('Sensor 5 (Thumb, uncalibrated): Flat=0 is validated as invalid and reports recalibration required', () => {
      const res = calculateDirectionalBend(135, 0, 0);
      expect(res.isValid).toBe(false);
      expect(res.needsRecalibration).toBe(true);
      expect(res.bendPercentage).toBe(0);
      expect(res.error).toContain('Flat=0');
    });

    it('does not move fingers when user releases back to flat baseline', () => {
      // Releasing back to flat gives 0%
      expect(calculateDirectionalBend(1152, 1152, 1217, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1463, 1463, 1446, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(1200, 1200, 1147, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(935, 935, 956, 4).bendPercentage).toBe(0);
    });
  });
});
