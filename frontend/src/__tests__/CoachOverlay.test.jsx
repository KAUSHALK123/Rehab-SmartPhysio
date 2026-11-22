import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CoachOverlay from '../components/CoachOverlay';

describe('CoachOverlay Component', () => {
  it('renders live suggestion, reps, and "approx. wrist angle" label', () => {
    const coachData = {
      type: 'coach',
      exercise: 'flexion_extension',
      rep_count: 5,
      current_angle: 38.5,
      peak_angle_last_rep: 42.1,
      target: 40.0,
      quality: 'correct',
      confidence: 0.95,
      anomaly: false,
      message: 'Good rep! Maintain that form',
      severity: 'ok',
      mode: 'ml_active',
      src: 'esp32',
    };

    render(<CoachOverlay coachData={coachData} isOffline={false} />);

    expect(screen.getByText('Wrist ML Coach')).toBeInTheDocument();
    expect(screen.getByText('Good rep! Maintain that form')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('approx. wrist angle')).toBeInTheDocument();
    expect(screen.getByText('ML ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Smooth Kinematics')).toBeInTheDocument();
  });

  it('displays SIMULATED badge when src is simulated', () => {
    const coachData = {
      type: 'coach',
      exercise: 'flexion_extension',
      rep_count: 3,
      current_angle: 20.0,
      target: 40.0,
      quality: 'too_shallow',
      confidence: 0.90,
      anomaly: false,
      message: 'Bend 20° more',
      severity: 'warn',
      mode: 'ml_active',
      src: 'simulated',
    };

    render(<CoachOverlay coachData={coachData} isOffline={false} />);

    expect(screen.getByText('SIMULATED')).toBeInTheDocument();
    expect(screen.getByText('Bend 20° more')).toBeInTheDocument();
  });

  it('displays Coach Offline badge and offline message when isOffline is true', () => {
    render(<CoachOverlay coachData={null} isOffline={true} />);

    expect(screen.getByText('Coach Offline')).toBeInTheDocument();
    expect(screen.getByText('Coach offline (awaiting IMU frames)')).toBeInTheDocument();
  });

  it('triggers onConfigChange callback when user updates exercise or target', () => {
    const onConfigChange = vi.fn();
    render(<CoachOverlay coachData={null} isOffline={false} onConfigChange={onConfigChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'radial_ulnar' } });

    expect(onConfigChange).toHaveBeenCalledWith({
      exercise: 'radial_ulnar',
      target: 25,
    });
  });
});
