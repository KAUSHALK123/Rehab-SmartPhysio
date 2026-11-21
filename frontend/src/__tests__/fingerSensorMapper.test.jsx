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
    it('Sensor 1 (Index, decreasing): Flat=173, Bent=108, Swing=65', () => {
      // Noise fluctuations around flat baseline must produce 0%
      expect(calculateDirectionalBend(175, 173, 108, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(173, 173, 108, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(171, 173, 108, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(170, 173, 108, 4).bendPercentage).toBe(0); // within threshold 4 (173 - 170 = 3 <= 4)

      // Above threshold starts bending
      const bend150 = calculateDirectionalBend(150, 173, 108, 4);
      expect(bend150.bendPercentage).toBeGreaterThan(0);
      expect(bend150.bendPercentage).toBeCloseTo((23 - 4) / (65 - 4), 3); // 19 / 61 ~ 0.311

      const bend120 = calculateDirectionalBend(120, 173, 108, 4);
      expect(bend120.bendPercentage).toBeGreaterThan(bend150.bendPercentage);
      expect(bend120.bendPercentage).toBeCloseTo((53 - 4) / (65 - 4), 3); // 49 / 61 ~ 0.803

      // At full bent reaches 100%
      expect(calculateDirectionalBend(108, 173, 108, 4).bendPercentage).toBe(1.0);
      // Beyond bent clamps to 100%
      expect(calculateDirectionalBend(90, 173, 108, 4).bendPercentage).toBe(1.0);
    });

    it('Sensor 2 (Middle, increasing): Flat=265, Bent=273, Swing=8', () => {
      // Fluctuations below flat baseline must produce 0%
      expect(calculateDirectionalBend(263, 265, 273, 2).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(265, 265, 273, 2).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(266, 265, 273, 2).bendPercentage).toBe(0); // within threshold 2 (266 - 265 = 1 <= 2)
      expect(calculateDirectionalBend(267, 265, 273, 2).bendPercentage).toBe(0); // within threshold 2 (267 - 265 = 2 <= 2)

      // Increasing ADC above threshold causes bending
      const bend270 = calculateDirectionalBend(270, 265, 273, 2);
      expect(bend270.bendPercentage).toBeCloseTo((5 - 2) / (8 - 2), 3); // 3 / 6 = 0.5

      // At full bent reaches 100%
      expect(calculateDirectionalBend(273, 265, 273, 2).bendPercentage).toBe(1.0);
      expect(calculateDirectionalBend(280, 265, 273, 2).bendPercentage).toBe(1.0);
    });

    it('Sensor 3 (Ring, decreasing): Flat=216, Bent=205, Swing=11', () => {
      expect(calculateDirectionalBend(220, 216, 205, 2).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(216, 216, 205, 2).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(215, 216, 205, 2).bendPercentage).toBe(0); // within threshold 2
      expect(calculateDirectionalBend(214, 216, 205, 2).bendPercentage).toBe(0); // within threshold 2

      const bend210 = calculateDirectionalBend(210, 216, 205, 2);
      expect(bend210.bendPercentage).toBeCloseTo((6 - 2) / (11 - 2), 3); // 4 / 9 ~ 0.444

      expect(calculateDirectionalBend(205, 216, 205, 2).bendPercentage).toBe(1.0);
      expect(calculateDirectionalBend(195, 216, 205, 2).bendPercentage).toBe(1.0);
    });

    it('Sensor 4 (Little, decreasing): Flat=148, Bent=41, Swing=107', () => {
      expect(calculateDirectionalBend(155, 148, 41, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(148, 148, 41, 6).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(144, 148, 41, 6).bendPercentage).toBe(0); // within threshold 6 (148 - 144 = 4 <= 6)

      const bend95 = calculateDirectionalBend(95, 148, 41, 6);
      expect(bend95.bendPercentage).toBeCloseTo((53 - 6) / (107 - 6), 3); // 47 / 101 ~ 0.465

      expect(calculateDirectionalBend(41, 148, 41, 6).bendPercentage).toBe(1.0);
      expect(calculateDirectionalBend(20, 148, 41, 6).bendPercentage).toBe(1.0);
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
      expect(calculateDirectionalBend(173, 173, 108, 4).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(265, 265, 273, 2).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(216, 216, 205, 2).bendPercentage).toBe(0);
      expect(calculateDirectionalBend(148, 148, 41, 6).bendPercentage).toBe(0);
    });
  });
});
