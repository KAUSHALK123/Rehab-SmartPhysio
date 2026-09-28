import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WristMotionDemoCard from '../components/WristMotionDemoCard';

describe('WristMotionDemoCard Component', () => {
  it('renders wrist flexion demonstration correctly', () => {
    render(
      <WristMotionDemoCard 
        exerciseName="Wrist Flexion"
        movementId="upDown"
        targetAngle={50}
      />
    );

    expect(screen.getByText('Motion Demo')).toBeInTheDocument();
    expect(screen.getByText('Wrist Flexion')).toBeInTheDocument();
    expect(screen.getByText('Bend Downward')).toBeInTheDocument();
    expect(screen.getByText('0° → 50°')).toBeInTheDocument();
    expect(screen.getByText('50° Aim')).toBeInTheDocument();
    expect(screen.getByText(/Bend wrist downward smoothly/i)).toBeInTheDocument();
  });

  it('renders wrist extension demonstration correctly', () => {
    render(
      <WristMotionDemoCard 
        exerciseName="Wrist Extension"
        movementId="upDown"
        targetAngle={45}
      />
    );

    expect(screen.getByText('Wrist Extension')).toBeInTheDocument();
    expect(screen.getByText('Bend Upward')).toBeInTheDocument();
    expect(screen.getByText('0° → 45°')).toBeInTheDocument();
    expect(screen.getByText('45° Aim')).toBeInTheDocument();
  });

  it('renders wrist rotation demonstration correctly', () => {
    render(
      <WristMotionDemoCard 
        exerciseName="Wrist Rotation"
        movementId="twist"
        targetAngle={60}
      />
    );

    expect(screen.getByText('Wrist Rotation')).toBeInTheDocument();
    expect(screen.getByText('Rotate Left ↔ Right')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('toggles collapse and expand when clicking the collapse button', () => {
    render(
      <WristMotionDemoCard 
        exerciseName="Wrist Flexion"
        movementId="upDown"
        targetAngle={50}
      />
    );

    expect(screen.getByText('Bend Downward')).toBeInTheDocument();

    const toggleBtn = screen.getByTitle('Collapse exercise guide');
    fireEvent.click(toggleBtn);

    expect(screen.queryByText('Bend Downward')).not.toBeInTheDocument();

    const expandBtn = screen.getByTitle('Expand exercise guide');
    fireEvent.click(expandBtn);

    expect(screen.getByText('Bend Downward')).toBeInTheDocument();
  });
});
