import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WristMotionDemoCard from '../components/WristMotionDemoCard';

describe('WristMotionDemoCard Component', () => {
  it('renders wrist flexion 3D GLB demonstration with zoomed-in view correctly', () => {
    render(
      <WristMotionDemoCard 
        exerciseName="Wrist Flexion"
        movementId="upDown"
        targetAngle={50}
      />
    );

    expect(screen.getByText('Wrist Flexion')).toBeInTheDocument();
    expect(screen.getByText('Bend Downward')).toBeInTheDocument();
    expect(screen.getByText('Aim: 50°')).toBeInTheDocument();
    expect(screen.getByText(/DEMO: 0°/i)).toBeInTheDocument();
    expect(screen.getByText(/Bend wrist downward smoothly/i)).toBeInTheDocument();
    expect(screen.getByText('1 Rep = Down & Up')).toBeInTheDocument();
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
    expect(screen.getByText('Aim: 45°')).toBeInTheDocument();
    expect(screen.getByText('1 Rep = Up & Down')).toBeInTheDocument();
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
    expect(screen.getByText('Aim: 60°')).toBeInTheDocument();
    expect(screen.getByText('1 Rep = Left + Right')).toBeInTheDocument();
  });
});
