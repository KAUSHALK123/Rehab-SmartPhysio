import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import GloveCalibrationModal from '../components/GloveCalibrationModal';
import * as fingerMapper from '../services/fingerSensorMapper';

vi.mock('../components/Arm3DVisualizer', () => ({
  default: () => <div data-testid="arm-3d-visualizer">3D Visualizer Mock</div>
}));

describe('GloveCalibrationModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders modal with title and initial instructions when open', () => {
    render(
      <GloveCalibrationModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onComplete={vi.fn()} 
        deviceConnected={true} 
      />
    );

    expect(screen.getByText("Let's calibrate your glove")).toBeInTheDocument();
    expect(screen.getByText(/Wear your glove properly and keep your hand straight/i)).toBeInTheDocument();
    expect(screen.getByText('Start Calibration')).toBeInTheDocument();
    expect(screen.getByTestId('arm-3d-visualizer')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <GloveCalibrationModal 
        isOpen={false} 
        onClose={vi.fn()} 
        onComplete={vi.fn()} 
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('progresses through Straight -> Bend -> Release phases upon Start Calibration', async () => {
    const onCompleteMock = vi.fn();
    const onCloseMock = vi.fn();

    const { rerender } = render(
      <GloveCalibrationModal 
        isOpen={true} 
        onClose={onCloseMock} 
        onComplete={onCompleteMock} 
        deviceConnected={true} 
        isHardwareDevice={true}
        rawSensorPacket={{
          raw_thumb: 1400,
          raw_index: 1410,
          raw_middle: 1395,
          raw_ring: 1405,
          raw_little: 1380
        }}
      />
    );

    // Click Start Calibration
    fireEvent.click(screen.getByRole('button', { name: /Start Calibration/i }));

    // Step 1: Straight Hand
    expect(screen.getByText(/Hold Your Hand Flat & Straight/i)).toBeInTheDocument();

    // Advance 2 seconds (Straight phase duration)
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    // Provide bent readings
    rerender(
      <GloveCalibrationModal 
        isOpen={true} 
        onClose={onCloseMock} 
        onComplete={onCompleteMock} 
        deviceConnected={true} 
        isHardwareDevice={true}
        rawSensorPacket={{
          raw_thumb: 2200,
          raw_index: 2250,
          raw_middle: 2230,
          raw_ring: 2240,
          raw_little: 2180
        }}
      />
    );

    // Step 2: Bend Fingers
    expect(screen.getByText(/Bend All 5 Fingers into a Fist/i)).toBeInTheDocument();

    // Advance 2 seconds (Bend phase duration)
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    // Provide release readings (returning close to straight)
    rerender(
      <GloveCalibrationModal 
        isOpen={true} 
        onClose={onCloseMock} 
        onComplete={onCompleteMock} 
        deviceConnected={true} 
        isHardwareDevice={true}
        rawSensorPacket={{
          raw_thumb: 1420,
          raw_index: 1415,
          raw_middle: 1400,
          raw_ring: 1410,
          raw_little: 1390
        }}
      />
    );

    // Step 3: Release & Verify
    expect(screen.getByText(/Release Back to Straight/i)).toBeInTheDocument();

    // Advance 1.5 seconds (Release phase duration)
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    // Verify Success screen is shown
    expect(screen.getByText(/Glove Calibration Completed!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to Exercise/i })).toBeInTheDocument();

    // Click Continue to Exercise
    fireEvent.click(screen.getByRole('button', { name: /Continue to Exercise/i }));
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    // Check that calibrated values were saved
    const savedBounds = fingerMapper.loadSensorCalibration();
    expect(savedBounds.thumb.straight).toBeCloseTo(1400, -1);
    expect(savedBounds.thumb.bent).toBeCloseTo(2200, -1);
  });

  it('detects insufficient movement span and displays retry message', async () => {
    render(
      <GloveCalibrationModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onComplete={vi.fn()} 
        deviceConnected={true} 
        isHardwareDevice={true}
        rawSensorPacket={{
          raw_thumb: 1400,
          raw_index: 1400,
          raw_middle: 1400,
          raw_ring: 1400,
          raw_little: 1400
        }}
      />
    );

    // Start Calibration with flatline / 0-movement readings across all steps
    fireEvent.click(screen.getByRole('button', { name: /Start Calibration/i }));

    // Step 1: Straight
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    // Step 2: Bend (still sending same 1400 values -> 0 span)
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    // Step 3: Release
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    // Should display Calibration Incomplete failure screen with retry
    expect(screen.getByText(/Calibration Incomplete/i)).toBeInTheDocument();
    expect(screen.getByText(/Some fingers did not register enough bend movement/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Calibration Again/i })).toBeInTheDocument();
  });
});
