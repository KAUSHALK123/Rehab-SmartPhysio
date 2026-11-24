import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  normalizeFlexValue, 
  mapNormalizedToGlb, 
  processFingerTelemetry, 
  applyCalibratedFingerRotation,
  degToRad,
  resetDynamicRanges,
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

  beforeEach(() => {
    resetDynamicRanges();
  });

  describe('Digital Switch Technique & Dynamic Lerp', () => {
    it('sets normalized=0 and fast lerpFactor=0.38 when switch is connected to GND (finger open/straight)', () => {
      // Connected (true / LOW): finger is OPEN / STRAIGHT (fast lerpFactor = 0.38)
      // Disconnected (false / HIGH): finger is BENT (slow lerpFactor = 0.12)
      const telemetry = {
        connected: [true, false, true, false, false],
        raw_index: 2200,
        raw_ring: 2100,
        raw_little: 2000
      };

      const result = processFingerTelemetry(telemetry, mockApprovedGlbConfig);

      // Thumb & Middle are connected to GND (switch closed -> finger straight / open hand)
      expect(result.switchConnected.thumb).toBe(true);
      expect(result.switchStates.thumb).toBe('OPEN');
      expect(result.normalized.thumb).toBe(0);
      expect(result.lerpFactors.thumb).toBe(0.38); // Fast return to open
      expect(result.angles.thumb).toBe(-60); // Straight rest angle

      expect(result.switchConnected.middle).toBe(true);
      expect(result.switchStates.middle).toBe('OPEN');
      expect(result.normalized.middle).toBe(0);
      expect(result.lerpFactors.middle).toBe(0.38);

      // Index is disconnected / switch open (switch open circuit -> bending slowly)
      expect(result.switchConnected.index).toBe(false);
      expect(result.switchStates.index).toBe('BENDING');
      expect(result.lerpFactors.index).toBe(0.12); // Buttery smooth slow bend
      expect(result.normalized.index).toBeGreaterThan(0);
    });

    it('correctly maps raw ESP32 sw array (0 = LOW/connected/open straight, 1 = HIGH/disconnected/bent)', () => {
      const telemetry = {
        sw: [0, 1, 0, 1, 0], // Thumb=0 (open), Index=1 (bent), Middle=0 (open), Ring=1 (bent), Little=0 (open)
        raw_index: 2000,
        raw_ring: 1900
      };

      const result = processFingerTelemetry(telemetry, mockApprovedGlbConfig);

      expect(result.switchConnected.thumb).toBe(true);
      expect(result.lerpFactors.thumb).toBe(0.38); // Connected -> OPEN STRAIGHT (fast)
      expect(result.switchStates.thumb).toBe('OPEN');

      expect(result.switchConnected.index).toBe(false);
      expect(result.lerpFactors.index).toBe(0.12); // Switch Open -> BENT (slow)
      expect(result.switchStates.index).toBe('BENDING');

      expect(result.switchConnected.middle).toBe(true);
      expect(result.lerpFactors.middle).toBe(0.38);
      expect(result.switchStates.middle).toBe('OPEN');

      expect(result.switchConnected.ring).toBe(false);
      expect(result.lerpFactors.ring).toBe(0.12);
      expect(result.switchStates.ring).toBe('BENDING');

      expect(result.switchConnected.little).toBe(true);
      expect(result.lerpFactors.little).toBe(0.38);
      expect(result.switchStates.little).toBe('OPEN');
    });

    it('drives visible GLB bending when switch is open circuit, and fast open straight when connected to GND', () => {
      // Index attached to D4:
      // When D4 is open circuit (untouched / HIGH) -> Index is BENT (normalized = 0.75, lerpFactor = 0.12)
      const untouchedIndexD4 = {
        sw: [0, 1, 0, 0, 0], // Index (sw[1]) open circuit (1 = HIGH)
        raw_index: 0         // Flex sensor reads 0 ADC
      };
      const untouchedResult = processFingerTelemetry(untouchedIndexD4, mockApprovedGlbConfig);
      expect(untouchedResult.switchConnected.index).toBe(false);
      expect(untouchedResult.switchStates.index).toBe('BENDING');
      expect(untouchedResult.normalized.index).toBe(0.75); // Main determination drives 75% bend!
      expect(untouchedResult.lerpFactors.index).toBe(0.12); // Smooth and slow bend

      // When D4 is touched to GND (0 = LOW) -> Index snaps OPEN STRAIGHT (normalized = 0, lerpFactor = 0.38)
      const touchedIndexD4 = {
        sw: [0, 0, 0, 0, 0], // Index (sw[1]) touched to GND (0 = LOW)
        raw_index: 0
      };
      const touchedResult = processFingerTelemetry(touchedIndexD4, mockApprovedGlbConfig);
      expect(touchedResult.switchConnected.index).toBe(true);
      expect(touchedResult.switchStates.index).toBe('OPEN');
      expect(touchedResult.normalized.index).toBe(0); // Straight open hand!
      expect(touchedResult.angles.index).toBe(-15);   // Straight open hand (-15° rest)
      expect(touchedResult.lerpFactors.index).toBe(0.38); // Fast return to open
    });

    it('defaults to standard lerpFactor=0.25 when switch telemetry is not present', () => {
      const telemetry = {
        raw_index: 1800
      };

      const result = processFingerTelemetry(telemetry, mockApprovedGlbConfig);

      expect(result.switchConnected.index).toBeNull();
      expect(result.switchStates.index).toBe('N/A');
      expect(result.lerpFactors.index).toBe(0.25);
    });
  });
});
