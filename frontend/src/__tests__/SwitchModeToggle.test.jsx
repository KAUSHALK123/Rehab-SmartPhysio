import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FingerSensorTrialPanel from '../components/FingerSensorTrialPanel';
import { 
  computeSwitchFingerAngles, 
  SWITCH_BEND_ANGLES, 
  FINGER_SWITCH_GPIOS,
  activeMovementSource, 
  setActiveMovementSource, 
  getActiveMovementSource,
  getAuthoritativeFingerMovement 
} from '../services/fingerSensorMapper';

describe('SmartPhysio Full Switch-Only GLB Movement Migration', () => {
  it('has SWITCH as the default central active movement source', () => {
    expect(activeMovementSource).toBe('SWITCH');
    expect(getActiveMovementSource()).toBe('SWITCH');

    setActiveMovementSource('FLEX');
    expect(getActiveMovementSource()).toBe('FLEX');

    setActiveMovementSource('SWITCH');
    expect(getActiveMovementSource()).toBe('SWITCH');
  });

  it('independently bends fingers via getAuthoritativeFingerMovement in switch mode', () => {
    // 1. Single switch press (Index: GPIO 19) -> only Index bends
    const indexPacket = { index_switch: 1 };
    const resIndex = getAuthoritativeFingerMovement(indexPacket, null, { forceSource: 'SWITCH' });
    expect(resIndex.angles.index).toBe(SWITCH_BEND_ANGLES.index);
    expect(resIndex.angles.thumb).toBe(0);
    expect(resIndex.angles.middle).toBe(0);
    expect(resIndex.angles.ring).toBe(0);
    expect(resIndex.angles.little).toBe(0);

    // 2. Single switch press (Thumb: GPIO 18) -> only Thumb bends
    const thumbPacket = { raw_thumb_switch: 0 }; // LOW = 0 = pressed
    const resThumb = getAuthoritativeFingerMovement(thumbPacket, null, { forceSource: 'SWITCH' });
    expect(resThumb.angles.thumb).toBe(SWITCH_BEND_ANGLES.thumb);
    expect(resThumb.angles.index).toBe(0);
    expect(resThumb.angles.middle).toBe(0);

    // 3. Multiple switch presses (Thumb, Middle, Little) -> all move simultaneously
    const multiPacket = {
      thumb_switch: 1,
      middle_switch: 1,
      little_switch: 1
    };
    const resMulti = getAuthoritativeFingerMovement(multiPacket, null, { forceSource: 'SWITCH' });
    expect(resMulti.angles.thumb).toBe(SWITCH_BEND_ANGLES.thumb);
    expect(resMulti.angles.middle).toBe(SWITCH_BEND_ANGLES.middle);
    expect(resMulti.angles.little).toBe(SWITCH_BEND_ANGLES.little);
    expect(resMulti.angles.index).toBe(0);
    expect(resMulti.angles.ring).toBe(0);

    // 4. All released -> all fingers return to 0 neutral rest pose
    const releasedPacket = {
      thumb_switch: 0,
      index_switch: 0,
      middle_switch: 0,
      ring_switch: 0,
      little_switch: 0
    };
    const resReleased = getAuthoritativeFingerMovement(releasedPacket, null, { forceSource: 'SWITCH' });
    expect(resReleased.angles).toEqual({
      thumb: 0,
      index: 0,
      middle: 0,
      ring: 0,
      little: 0
    });
  });

  it('verifies exact GPIO mapping constants for all 5 contact switches', () => {
    expect(FINGER_SWITCH_GPIOS.thumb).toBe(27);
    expect(FINGER_SWITCH_GPIOS.index).toBe(19);
    expect(FINGER_SWITCH_GPIOS.middle).toBe(23);
    expect(FINGER_SWITCH_GPIOS.ring).toBe(18);
    expect(FINGER_SWITCH_GPIOS.little).toBe(13);
  });

  it('initializes FingerSensorTrialPanel in Switch Mode: ACTIVE by default and toggles cleanly', () => {
    const onAnglesUpdate = vi.fn();
    const onToggleCalibrationMode = vi.fn();

    const { unmount } = render(
      <FingerSensorTrialPanel
        liveSensors={{ raw_thumb: 1500, raw_index: 1400 }}
        deviceConnected={true}
        lastPacketTime={Date.now()}
        onAnglesUpdate={onAnglesUpdate}
        onToggleCalibrationMode={onToggleCalibrationMode}
      />
    );

    // Find the Logic Flex Movement button
    const toggleButton = screen.getByRole('button', { name: /Logic Flex Movement/i });
    expect(toggleButton).toBeInTheDocument();

    // Default is Switch Mode: ACTIVE
    expect(screen.getByText('Switch Mode: ACTIVE')).toBeInTheDocument();
    expect(onAnglesUpdate).toHaveBeenCalled();

    // Toggle off -> returns to safe neutral
    fireEvent.click(toggleButton);
    expect(screen.queryByText('Switch Mode: ACTIVE')).not.toBeInTheDocument();

    // Toggle back on -> reactivates Switch Mode: ACTIVE
    fireEvent.click(toggleButton);
    expect(screen.getByText('Switch Mode: ACTIVE')).toBeInTheDocument();

    unmount();
  });
});
