import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import WristAiCoachOverlay from '../components/WristAiCoachOverlay';
import { evaluateWristCoachRules, WristCoachDebouncer } from '../services/wristCoachRules';

describe('evaluateWristCoachRules', () => {
  it('gives bend more advice when moving toward target', () => {
    const msg = evaluateWristCoachRules({
      currentAngle: 20,
      targetAngle: 45,
      targetDir: 'RIGHT',
      repState: 'moving'
    });
    expect(msg).toBe('Bend 25 deg more to the RIGHT');
  });

  it('triggers Hold it! when within tolerance (+/-5 deg)', () => {
    const msg = evaluateWristCoachRules({
      currentAngle: 43,
      targetAngle: 45,
      holdCountdown: 2,
      repState: 'moving'
    });
    expect(msg).toBe('Hold it! 2s');
  });

  it('triggers Ease back when overshooting target by >5 deg', () => {
    const msg = evaluateWristCoachRules({
      currentAngle: 55,
      targetAngle: 45,
      repState: 'moving'
    });
    expect(msg).toBe('Ease back 10 deg - too far');
  });

  it('detects wrong direction movement', () => {
    const msg = evaluateWristCoachRules({
      currentAngle: -15,
      targetAngle: 45,
      targetDir: 'RIGHT',
      repState: 'moving'
    });
    expect(msg).toBe('Wrong way - move RIGHT');
  });

  it('warns Slow down if angular velocity is excessive', () => {
    const msg = evaluateWristCoachRules({
      currentAngle: 20,
      targetAngle: 45,
      velocity: 150,
      velocityThreshold: 120,
      repState: 'moving'
    });
    expect(msg).toBe('Slow down');
  });

  it('warns Keep the movement smooth when jerky', () => {
    const msg = evaluateWristCoachRules({
      currentAngle: 20,
      targetAngle: 45,
      isJerky: true,
      repState: 'moving'
    });
    expect(msg).toBe('Keep the movement smooth');
  });

  it('shows Relax and rest during rest phase with countdown', () => {
    const msg = evaluateWristCoachRules({
      currentAngle: 0,
      targetAngle: 45,
      repState: 'rest',
      restCountdown: 3
    });
    expect(msg).toBe('Relax and rest 3s');
  });

  it('shows Set complete when reps meet or exceed target', () => {
    const msg = evaluateWristCoachRules({
      repsCompleted: 5,
      targetReps: 5
    });
    expect(msg).toBe('Great job! Set complete');
  });

  it('nudges patient after 5s of no movement', () => {
    const msg = evaluateWristCoachRules({
      currentAngle: 0,
      targetAngle: 45,
      targetDir: 'RIGHT',
      repState: 'rest',
      secondsIdle: 6
    });
    expect(msg).toBe('Move your wrist RIGHT to 45 deg');
  });
});

describe('WristCoachDebouncer', () => {
  it('debounces rapid message updates within 700ms unless urgent', () => {
    const debouncer = new WristCoachDebouncer(700);
    const m1 = debouncer.update('Bend 20 deg more to the RIGHT');
    expect(m1).toBe('Bend 20 deg more to the RIGHT');

    // Immediate non-urgent update within 10ms should retain previous message
    const m2 = debouncer.update('Bend 19 deg more to the RIGHT');
    expect(m2).toBe('Bend 20 deg more to the RIGHT');

    // Urgent update (e.g. Set complete) breaks through debounce immediately
    const m3 = debouncer.update('Great job! Set complete');
    expect(m3).toBe('Great job! Set complete');
  });
});

describe('WristAiCoachOverlay Component', () => {
  it('renders floating overlay with yellow bold styling', () => {
    render(
      <WristAiCoachOverlay
        currentAngle={20}
        targetAngle={45}
        targetDir="RIGHT"
        repState="moving"
        inlineBottom={false}
      />
    );

    const textEl = screen.getByText(/Bend 25 deg more to the RIGHT/i);
    expect(textEl).toBeInTheDocument();
    expect(textEl.className).toContain('text-amber-400');
    expect(textEl.className).toContain('font-black');
  });

  it('renders inline bottom card mode with badge', () => {
    render(
      <WristAiCoachOverlay
        currentAngle={20}
        targetAngle={45}
        targetDir="RIGHT"
        repState="moving"
        inlineBottom={true}
      />
    );

    expect(screen.getByText(/AI: RULES ONLY/i)).toBeInTheDocument();
    expect(screen.getByText(/Bend 25 deg more to the RIGHT/i)).toBeInTheDocument();
  });
});
