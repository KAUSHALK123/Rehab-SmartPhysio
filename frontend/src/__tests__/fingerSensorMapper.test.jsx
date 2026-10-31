import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  normalizeFlexValue, 
  mapNormalizedToGlb, 
  processFingerTelemetry, 
  applyCalibratedFingerRotation,
  degToRad,
  FINGER_KEYS,
  FINGER_RIG_MAP,
  resetDynamicRanges
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
  describe('GLB Finger Movement Stability and Continuous Position Control', () => {
    beforeEach(() => {
      resetDynamicRanges();
    });

    it('Test straight, middle-bend, and full-bend positions for every finger', () => {
      const bounds = {
        thumbStr: 1400, thumbBnt: 2200,
        indexStr: 1350, indexBnt: 2250,
        middleStr: 1380, middleBnt: 2280,
        ringStr: 1400, ringBnt: 2250,
        littleStr: 1300, littleBnt: 2150
      };

      // 1. Straight Pose (raw = straight bound)
      const straightPkt = {
        type: 'sensor_data',
        raw_thumb: 1400, raw_index: 1350, raw_middle: 1380, raw_ring: 1400, raw_little: 1300,
        bounds
      };
      resetDynamicRanges();
      const straightRes = processFingerTelemetry(straightPkt, mockApprovedGlbConfig);
      FINGER_KEYS.forEach((f) => {
        expect(straightRes.percentages[f]).toBe(0);
        const rigAxis = FINGER_RIG_MAP[f].axis;
        const expectedMin = mockApprovedGlbConfig.fingers[f][rigAxis].min;
        expect(straightRes.angles[f]).toBe(expectedMin);
      });

      // 2. Full-Bend Pose (raw = bent bound)
      const fullBendPkt = {
        type: 'sensor_data',
        raw_thumb: 2200, raw_index: 2250, raw_middle: 2280, raw_ring: 2250, raw_little: 2150,
        bounds
      };
      resetDynamicRanges();
      const fullRes = processFingerTelemetry(fullBendPkt, mockApprovedGlbConfig);
      FINGER_KEYS.forEach((f) => {
        expect(fullRes.percentages[f]).toBe(100);
        const rigAxis = FINGER_RIG_MAP[f].axis;
        const expectedMax = mockApprovedGlbConfig.fingers[f][rigAxis].max;
        expect(fullRes.angles[f]).toBe(expectedMax);
      });

      // 3. Middle-Bend Pose (raw = halfway between straight and bent)
      const midPkt = {
        type: 'sensor_data',
        raw_thumb: 1800, raw_index: 1800, raw_middle: 1830, raw_ring: 1825, raw_little: 1725,
        bounds
      };
      resetDynamicRanges();
      const midRes = processFingerTelemetry(midPkt, mockApprovedGlbConfig);
      FINGER_KEYS.forEach((f) => {
        expect(midRes.percentages[f]).toBeGreaterThan(60);
        expect(midRes.percentages[f]).toBeLessThan(75);
        const rigAxis = FINGER_RIG_MAP[f].axis;
        const { min, max } = mockApprovedGlbConfig.fingers[f][rigAxis];
        expect(midRes.angles[f]).toBeGreaterThan(min);
        expect(midRes.angles[f]).toBeLessThan(max);
      });
    });

    it('Holding finger at constant bend with fluctuating sensor noise holds stable GLB angle without vibration', () => {
      const bounds = {
        thumbStr: 1400, thumbBnt: 2200,
        indexStr: 1350, indexBnt: 2250,
        middleStr: 1380, middleBnt: 2280,
        ringStr: 1400, ringBnt: 2250,
        littleStr: 1300, littleBnt: 2150
      };

      resetDynamicRanges();

      // Initial reading at 50% bend (index ~ 1800)
      const initialPkt = {
        type: 'sensor_data',
        raw_thumb: 1400, raw_index: 1800, raw_middle: 1380, raw_ring: 1400, raw_little: 1300,
        bounds
      };
      let initialRes;
      for (let i = 0; i < 5; i++) { initialRes = processFingerTelemetry(initialPkt, mockApprovedGlbConfig); }
      const heldAngle = initialRes.angles.index;

      // Simulate 50 continuous packets with electrical noise (fluctuating +-8 ADC counts around 1800)
      const noiseOffsets = [-5, +7, -8, +4, -3, +8, -6, +2, -7, +6, -4, +5, -6, +7, -2, +4];
      for (let i = 0; i < 50; i++) {
        const jitter = noiseOffsets[i % noiseOffsets.length];
        const noisyPkt = {
          type: 'sensor_data',
          raw_thumb: 1400, raw_index: 1800 + jitter, raw_middle: 1380, raw_ring: 1400, raw_little: 1300,
          bounds
        };
        const noisyRes = processFingerTelemetry(noisyPkt, mockApprovedGlbConfig);
        expect(noisyRes.angles.index).toBe(heldAngle);
      }
    });

    it('Smooth continuous tracking: slowly bending and straightening follows progressively', () => {
      const bounds = {
        thumbStr: 1000, thumbBnt: 2000,
        indexStr: 1000, indexBnt: 2000,
        middleStr: 1000, middleBnt: 2000,
        ringStr: 1000, ringBnt: 2000,
        littleStr: 1000, littleBnt: 2000
      };
      resetDynamicRanges();

      let prevAngle = -15; // index straight angle in mock config
      // Slowly ramp ADC from 1000 to 2000 in steps of 50
      for (let adc = 1050; adc <= 2000; adc += 50) {
        const pkt = {
          type: 'sensor_data',
          raw_thumb: 1000, raw_index: adc, raw_middle: 1000, raw_ring: 1000, raw_little: 1000,
          bounds
        };
        const res = processFingerTelemetry(pkt, mockApprovedGlbConfig);
        expect(res.angles.index).toBeGreaterThanOrEqual(prevAngle);
        prevAngle = res.angles.index;
      }
      let finalRes; for (let i = 0; i < 20; i++) { finalRes = processFingerTelemetry({ type: 'sensor_data', raw_thumb: 1000, raw_index: 2000, raw_middle: 1000, raw_ring: 1000, raw_little: 1000, bounds }, mockApprovedGlbConfig); } expect(finalRes.angles.index).toBe(65);
    });

    it('Preserves independent finger movement: bending one finger does not affect other fingers', () => {
      const bounds = {
        thumbStr: 1000, thumbBnt: 2000,
        indexStr: 1000, indexBnt: 2000,
        middleStr: 1000, middleBnt: 2000,
        ringStr: 1000, ringBnt: 2000,
        littleStr: 1000, littleBnt: 2000
      };
      resetDynamicRanges();

      // Only bend Thumb to 2000 while others remain at 1000
      const pkt = {
        type: 'sensor_data',
        raw_thumb: 2000, raw_index: 1000, raw_middle: 1000, raw_ring: 1000, raw_little: 1000,
        bounds
      };
      const res = processFingerTelemetry(pkt, mockApprovedGlbConfig);

      expect(res.percentages.thumb).toBe(100);
      expect(res.percentages.index).toBe(0);
      expect(res.percentages.middle).toBe(0);
      expect(res.percentages.ring).toBe(0);
      expect(res.percentages.little).toBe(0);

      expect(res.angles.index).toBe(-15);
      expect(res.angles.middle).toBe(-15);
      expect(res.angles.ring).toBe(-15);
      expect(res.angles.little).toBe(-15);
    });

    it('Regression Test: straight -> 4% -> 25% -> 50% -> 75% -> full bend with stable holding for EVERY finger', () => {
      const bounds = {
        thumbStr: 1000, thumbBnt: 2000,
        indexStr: 1000, indexBnt: 2000,
        middleStr: 1000, middleBnt: 2000,
        ringStr: 1000, ringBnt: 2000,
        littleStr: 1000, littleBnt: 2000
      };

      FINGER_KEYS.forEach((finger) => {
        resetDynamicRanges();
        const axis = FINGER_RIG_MAP[finger].axis;
        const { min, max } = mockApprovedGlbConfig.fingers[finger][axis];

        // 1. Straight (0%)
        let pkt = { type: 'sensor_data', bounds };
        FINGER_KEYS.forEach(f => { pkt['raw_' + f] = 1000; });
        let res = processFingerTelemetry(pkt, mockApprovedGlbConfig);
        expect(res.percentages[finger]).toBe(0);
        expect(res.angles[finger]).toBe(min);

        // 2. 4% Movement (small movement must produce visible GLB movement)
        const raw4 = 1000 + Math.round(1000 * 0.04); // 1040
        pkt['raw_' + finger] = raw4;
        for (let i = 0; i < 20; i++) { res = processFingerTelemetry(pkt, mockApprovedGlbConfig); }
        expect(res.percentages[finger]).toBeGreaterThanOrEqual(10); // boosted gamma 0.60
        expect(Math.abs(res.angles[finger] - min)).toBeGreaterThan(1.0); // visible GLB change > 1.0 deg!

        // Hold 4% pose with electrical noise (30 packets) -> must remain stable
        const angleAt4 = res.angles[finger];
        for (let i = 0; i < 30; i++) {
          const jitter = (i % 2 === 0) ? -1 : 1;
          pkt['raw_' + finger] = raw4 + jitter;
          const noisyRes = processFingerTelemetry(pkt, mockApprovedGlbConfig);
          expect(noisyRes.angles[finger]).toBe(angleAt4);
        }

        // 3. 25% Movement
        const raw25 = 1000 + Math.round(1000 * 0.25);
        pkt['raw_' + finger] = raw25;
        for (let i = 0; i < 20; i++) { res = processFingerTelemetry(pkt, mockApprovedGlbConfig); }
        expect(res.percentages[finger]).toBeGreaterThan(35);
        expect(res.percentages[finger]).toBeLessThan(50);
        expect(res.angles[finger]).toBeGreaterThan(min);
        expect(res.angles[finger]).toBeLessThan(max);

        // Hold 25% pose with electrical noise
        const angleAt25 = res.angles[finger];
        for (let i = 0; i < 30; i++) {
          pkt['raw_' + finger] = raw25 + ((i % 2 === 0) ? -1 : 1);
          const noisyRes = processFingerTelemetry(pkt, mockApprovedGlbConfig);
          expect(noisyRes.angles[finger]).toBe(angleAt25);
        }

        // 4. 50% Movement
        const raw50 = 1000 + Math.round(1000 * 0.50);
        pkt['raw_' + finger] = raw50;
        for (let i = 0; i < 20; i++) { res = processFingerTelemetry(pkt, mockApprovedGlbConfig); }
        expect(res.percentages[finger]).toBeGreaterThan(60);
        expect(res.percentages[finger]).toBeLessThan(75);

        // Hold 50% pose with electrical noise
        const angleAt50 = res.angles[finger];
        for (let i = 0; i < 30; i++) {
          pkt['raw_' + finger] = raw50 + ((i % 2 === 0) ? -1 : 1);
          const noisyRes = processFingerTelemetry(pkt, mockApprovedGlbConfig);
          expect(noisyRes.angles[finger]).toBe(angleAt50);
        }

        // 5. 75% Movement
        const raw75 = 1000 + Math.round(1000 * 0.75);
        pkt['raw_' + finger] = raw75;
        for (let i = 0; i < 20; i++) { res = processFingerTelemetry(pkt, mockApprovedGlbConfig); }
        expect(res.percentages[finger]).toBeGreaterThan(78);
        expect(res.percentages[finger]).toBeLessThan(90);

        // 6. Full Bend (100%)
        pkt['raw_' + finger] = 2000;
        for (let i = 0; i < 20; i++) { res = processFingerTelemetry(pkt, mockApprovedGlbConfig); }
        expect(res.percentages[finger]).toBe(100);
        expect(res.angles[finger]).toBe(max);

        // Hold Full Bend pose with electrical noise
        for (let i = 0; i < 30; i++) {
          pkt['raw_' + finger] = 2000 + ((i % 2 === 0) ? -1 : 0);
          const noisyRes = processFingerTelemetry(pkt, mockApprovedGlbConfig);
          expect(noisyRes.angles[finger]).toBe(max);
        }
      });
    });

    it('Uncalibrated dynamic auto-range: user hand baseline adapts at rest and reaches full bend', () => {
      resetDynamicRanges();
      // Hardware flex sensor resting at ~1750, bending up to ~1950 (no explicit calibration)
      const restPkt = {
        type: 'sensor_data',
        raw_thumb: 1750, raw_index: 1750, raw_middle: 1750, raw_ring: 1750, raw_little: 1750
      };

      // Establish resting baseline
      let res;
      for (let i = 0; i < 35; i++) {
        res = processFingerTelemetry(restPkt, mockApprovedGlbConfig);
      }
      expect(res.percentages.index).toBe(0);
      expect(res.angles.index).toBe(-15); // straight rest pose

      // Small 4% movement (7 counts) -> visible GLB movement
      const move4Pkt = {
        type: 'sensor_data',
        raw_thumb: 1750, raw_index: 1757, raw_middle: 1750, raw_ring: 1750, raw_little: 1750
      };
      for (let i = 0; i < 5; i++) { res = processFingerTelemetry(move4Pkt, mockApprovedGlbConfig); }
      expect(res.percentages.index).toBeGreaterThan(0);
      expect(res.angles.index).toBeGreaterThan(-15);

      // Full fist bend reaching 1950 (deflection ~200 counts)
      const fullFistPkt = {
        type: 'sensor_data',
        raw_thumb: 1750, raw_index: 1950, raw_middle: 1750, raw_ring: 1750, raw_little: 1750
      };
      for (let i = 0; i < 15; i++) {
        res = processFingerTelemetry(fullFistPkt, mockApprovedGlbConfig);
      }
      expect(res.percentages.index).toBe(100);
      expect(res.angles.index).toBe(65); // reaches full bend!
    });
  });

});
