import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import GLBCalibrationPanel from '../components/GLBCalibrationPanel';
import { loadCalibrationConfig } from '../services/calibrationConfig';

describe('GLBCalibrationPanel Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders Wrist calibration with movements and initial unapproved status', () => {
    const onActiveJointChange = vi.fn();
    const onTestAnglesChange = vi.fn();

    render(
      <GLBCalibrationPanel 
        mode="wrist" 
        onActiveJointChange={onActiveJointChange} 
        onTestAnglesChange={onTestAnglesChange} 
      />
    );

    expect(screen.getByText('Wrist GLB Calibration')).toBeInTheDocument();
    expect(screen.getByText('Not Approved')).toBeInTheDocument();
    expect(screen.getByText(/Hi Movement/)).toBeInTheDocument();
    expect(screen.getByText('Apply Values to Sliders')).toBeInTheDocument();
    expect(screen.getByText('Reset Pose')).toBeInTheDocument();
    expect(screen.getByText('Approve & Save')).toBeInTheDocument();
  });

  it('allows changing candidate ranges and applies them to live sliders', () => {
    const onTestAnglesChange = vi.fn();

    render(
      <GLBCalibrationPanel 
        mode="wrist" 
        onTestAnglesChange={onTestAnglesChange} 
      />
    );

    // Find inputs for X candidate bounds
    const inputs = screen.getAllByRole('spinbutton');
    // inputs[0] is X Min, inputs[1] is X Max
    fireEvent.change(inputs[0], { target: { value: '-45' } });
    fireEvent.change(inputs[1], { target: { value: '45' } });

    // Click Apply Values
    fireEvent.click(screen.getByText('Apply Values to Sliders'));

    expect(screen.getByText(/Live test slider bounds updated/i)).toBeInTheDocument();
  });

  it('allows moving live sliders without automatically saving to configuration', () => {
    const onTestAnglesChange = vi.fn();

    render(
      <GLBCalibrationPanel 
        mode="wrist" 
        onTestAnglesChange={onTestAnglesChange} 
      />
    );

    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBe(3); // X, Y, Z sliders

    // Move X slider to 15
    fireEvent.change(sliders[0], { target: { value: '15' } });
    expect(onTestAnglesChange).toHaveBeenCalledWith(expect.objectContaining({ x: 15 }));

    // Verify localStorage has NOT been marked approved yet
    const stored = loadCalibrationConfig();
    expect(stored.wrist.hiMovement.approved).toBe(false);
  });

  it('commits configuration and sets approved status upon clicking Approve & Save', () => {
    render(<GLBCalibrationPanel mode="wrist" />);

    // Click Approve & Save
    fireEvent.click(screen.getByText('Approve & Save'));

    expect(screen.getByText('Approved')).toBeInTheDocument();

    const stored = loadCalibrationConfig();
    expect(stored.wrist.hiMovement.approved).toBe(true);
  });

  it('supports finger calibration mode with independent finger selection', () => {
    const onActiveJointChange = vi.fn();

    render(
      <GLBCalibrationPanel 
        mode="fingers" 
        onActiveJointChange={onActiveJointChange} 
      />
    );

    expect(screen.getByText('Finger GLB Calibration')).toBeInTheDocument();
    expect(screen.getByText('Thumb')).toBeInTheDocument();
  });
});
