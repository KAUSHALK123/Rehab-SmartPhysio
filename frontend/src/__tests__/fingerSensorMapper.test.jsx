import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  normalizeFlexValue, 
  mapNormalizedToGlb, 
  processFingerTelemetry, 
  applyCalibratedFingerRotation,
  degToRad,
  FINGER_KEYS,
  FINGER_RIG_MAP,
  isSwitchPressed,
  computeSwitchFingerAngles,
  SWITCH_BEND_ANGLES,
  FINGER_SWITCH_GPIOS
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

  describe('Hybrid Flex Sensor + Digital Switch Technique', () => {
    it('supports independent digital switch control per finger', () => {
      // Packet with thumb in SWITCH mode (closed = 1), index in SWITCH mode (open = 0), middle in FLEX mode
      const packet = {
        type: 'sensor_data',
        thumb_mode: 'SWITCH',
        thumb_switch: 1, // closed = full bend
        raw_thumb: 1450, // flex ADC still tracked

        index_mode: 'SWITCH',
        index_switch: 0, // open = straight
        raw_index: 1350,

        middle_mode: 'FLEX',
        raw_middle: 3150, // 100% bend on flex
        bounds: {
          middleStr: 1180, middleBnt: 3150
        }
      };

      const result = processFingerTelemetry(packet, mockApprovedGlbConfig);

      // Thumb: switch closed -> 100% bend -> GLB max (20)
      expect(result.percentages.thumb).toBe(100);
      expect(result.angles.thumb).toBe(20);
      expect(result.debug.thumb.mode).toBe('SWITCH');
      expect(result.debug.thumb.switchState).toBe('closed');
      expect(result.debug.thumb.raw).toBe(1450); // ADC preserved!

      // Index: switch open -> 0% bend -> GLB min (-15)
      expect(result.percentages.index).toBe(0);
      expect(result.angles.index).toBe(-15);
      expect(result.debug.index.mode).toBe('SWITCH');
      expect(result.debug.index.switchState).toBe('open');
      expect(result.debug.index.raw).toBe(1350);

      // Middle: flex mode -> 100% bend on flex sensor
      expect(result.percentages.middle).toBe(100);
      expect(result.angles.middle).toBe(65);
      expect(result.debug.middle.mode).toBe('FLEX');
    });

    it('correctly maps raw pin states (raw_finger_switch: LOW=0 -> closed, HIGH=1 -> open)', () => {
      const packet = {
        type: 'sensor_data',
        ring_mode: 'SWITCH',
        raw_ring_switch: 0, // Hardware pin LOW = contact closed to GND
        little_mode: 'SWITCH',
        raw_little_switch: 1 // Hardware pin HIGH = contact open via pullup
      };

      const result = processFingerTelemetry(packet, mockApprovedGlbConfig);

      expect(result.percentages.ring).toBe(100);
      expect(result.angles.ring).toBe(65);
      expect(result.debug.ring.switchState).toBe('closed');

      expect(result.percentages.little).toBe(0);
      expect(result.angles.little).toBe(-15);
      expect(result.debug.little.switchState).toBe('open');
    });

    it('allows frontend customModes override to toggle switch mode dynamically', () => {
      const packet = {
        type: 'sensor_data',
        thumb_switch: 1,
        raw_thumb: 1200 // at rest on flex sensor
      };

      // By default without mode, it defaults to FLEX (raw 1200 is 0%)
      const defaultResult = processFingerTelemetry(packet, mockApprovedGlbConfig);
      expect(defaultResult.percentages.thumb).toBe(0);

      // Overriding mode to SWITCH uses switch input (thumb_switch: 1 -> 100%)
      const switchedResult = processFingerTelemetry(packet, mockApprovedGlbConfig, null, { thumb: 'SWITCH' });
      expect(switchedResult.percentages.thumb).toBe(100);
      expect(switchedResult.angles.thumb).toBe(20);
    });
  });

  describe('Pure Digital Switch Movement (computeSwitchFingerAngles & isSwitchPressed)', () => {
    it('isSwitchPressed parses numeric, boolean, string, and raw GPIO levels correctly', () => {
      expect(isSwitchPressed({ thumb_switch: 1 }, 'thumb')).toBe(true);
      expect(isSwitchPressed({ thumb_switch: 0 }, 'thumb')).toBe(false);

      expect(isSwitchPressed({ index_switch: true }, 'index')).toBe(true);
      expect(isSwitchPressed({ index_switch: false }, 'index')).toBe(false);

      expect(isSwitchPressed({ middle_switch: 'closed' }, 'middle')).toBe(true);
      expect(isSwitchPressed({ middle_switch: 'open' }, 'middle')).toBe(false);

      // Raw GPIO levels: LOW (0) = pressed, HIGH (1) = released
      expect(isSwitchPressed({ raw_ring_switch: 0 }, 'ring')).toBe(true);
      expect(isSwitchPressed({ raw_ring_switch: 1 }, 'ring')).toBe(false);

      expect(isSwitchPressed(null, 'little')).toBe(false);
      expect(isSwitchPressed({}, 'little')).toBe(false);
    });

    it('computeSwitchFingerAngles moves only the finger whose switch is pressed and keeps others at 0° neutral', () => {
      // Only Index switch pressed
      const packet = {
        type: 'sensor_data',
        thumb_switch: 0,
        index_switch: 1, // Pressed
        middle_switch: 0,
        ring_switch: 0,
        little_switch: 0,
        raw_thumb: 3500 // Flex ADC should be completely ignored!
      };

      const result = computeSwitchFingerAngles(packet);

      expect(result.angles.index).toBe(SWITCH_BEND_ANGLES.index); // 65°
      expect(result.percentages.index).toBe(100);
      expect(result.debug.index.pressed).toBe(true);
      expect(result.debug.index.gpio).toBe(19);

      // Other 4 fingers must strictly remain at 0° neutral rest pose
      expect(result.angles.thumb).toBe(0);
      expect(result.angles.middle).toBe(0);
      expect(result.angles.ring).toBe(0);
      expect(result.angles.little).toBe(0);
      expect(result.percentages.thumb).toBe(0);
    });

    it('supports multiple switches pressed simultaneously without moving unpressed fingers', () => {
      // Thumb (GPIO 18) and Little (GPIO 13) pressed together
      const packet = {
        type: 'sensor_data',
        thumb_switch: 1,
        index_switch: 0,
        middle_switch: 0,
        ring_switch: 0,
        little_switch: 1
      };

      const result = computeSwitchFingerAngles(packet);

      expect(result.angles.thumb).toBe(SWITCH_BEND_ANGLES.thumb); // 45°
      expect(result.angles.little).toBe(SWITCH_BEND_ANGLES.little); // 50°
      expect(result.angles.index).toBe(0);
      expect(result.angles.middle).toBe(0);
      expect(result.angles.ring).toBe(0);
    });

    it('supports frontend simulated switches when hardware packet is empty or unpressed', () => {
      const simulatedSwitches = {
        thumb: 0,
        index: 0,
        middle: 1, // Simulated Middle pressed in UI
        ring: 0,
        little: 0
      };

      const result = computeSwitchFingerAngles({}, simulatedSwitches);

      expect(result.angles.middle).toBe(SWITCH_BEND_ANGLES.middle); // 65°
      expect(result.debug.middle.pressed).toBe(true);
      expect(result.debug.middle.gpio).toBe(23);

      expect(result.angles.thumb).toBe(0);
      expect(result.angles.index).toBe(0);
      expect(result.angles.ring).toBe(0);
      expect(result.angles.little).toBe(0);
    });
  });
});
