import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import WristLimitTunerPanel, { ORIGINAL_LIMITS } from '../components/WristLimitTunerPanel';

describe('WristLimitTunerPanel', () => {
  it('has locked calibrated limits: X [-36, 43], Y [-23, 33], Z [-25, 35]', () => {
    expect(ORIGINAL_LIMITS).toEqual({
      X: [-36, 43],
      Y: [-23, 33],
      Z: [-25, 35]
    });
  });

  it('renders all three axes blocks (X, Y, Z)', () => {
    render(<WristLimitTunerPanel />);
    expect(screen.getByText('GLB X')).toBeInTheDocument();
    expect(screen.getByText('GLB Y')).toBeInTheDocument();
    expect(screen.getByText('GLB Z')).toBeInTheDocument();
    expect(screen.getByText('Hand Up / Down (Pitch)')).toBeInTheDocument();
    expect(screen.getByText('Forearm Twist (Roll)')).toBeInTheDocument();
    expect(screen.getByText('Hand Left / Right (Yaw)')).toBeInTheDocument();
  });

  it('allows switching between Manual and MPU Live modes', () => {
    render(<WristLimitTunerPanel />);
    const manualBtn = screen.getByRole('button', { name: /^Manual$/i });
    const mpuBtn = screen.getByRole('button', { name: /^MPU Live$/i });

    expect(screen.getByText(/MANUAL ANGLE SLIDERS/i)).toBeInTheDocument();
    fireEvent.click(mpuBtn);
    expect(screen.getByText(/MPU LIVE SENSOR/i)).toBeInTheDocument();
    fireEvent.click(manualBtn);
    expect(screen.getByText(/MANUAL ANGLE SLIDERS/i)).toBeInTheDocument();
  });

  it('in MPU mode clamps telemetry to [min, max] limits', () => {
    const onAnglesChange = vi.fn();
    const rawTelemetry = {
      wrist_pitch: 80.0, // Exceeds X max (45)
      wrist_roll: -90.0, // Exceeds Y min (-60)
      wrist_yaw: 20.0    // Within Z [-35, 35]
    };

    render(
      <WristLimitTunerPanel 
        rawTelemetry={rawTelemetry}
        onAnglesChange={onAnglesChange}
      />
    );

    const mpuBtn = screen.getByRole('button', { name: /^MPU Live$/i });
    fireEvent.click(mpuBtn);

    // Last call to onAnglesChange should reflect clamped values
    const lastCall = onAnglesChange.mock.calls[onAnglesChange.mock.calls.length - 1][0];
    expect(lastCall.x).toBe(43);  // Clamped to max 43
    expect(lastCall.y).toBe(-23); // Clamped to min -23
    expect(lastCall.z).toBe(20);  // Unclamped within [-25, 35]
  });

  it('copies limits JSON when Copy Limits button is clicked', async () => {
    const writeTextMock = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    render(<WristLimitTunerPanel />);
    const copyBtn = screen.getByRole('button', { name: /Copy Limits JSON/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(JSON.stringify(ORIGINAL_LIMITS));
  });
});
