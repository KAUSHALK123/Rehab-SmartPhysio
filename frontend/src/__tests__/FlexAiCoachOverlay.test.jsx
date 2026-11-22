import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FlexAiCoachOverlay from '../components/FlexAiCoachOverlay';
import { evaluateFlexCoachRules, FlexCoachDebouncer } from '../services/flexCoachRules';

describe('Flex AI Coach Rules Engine', () => {
  it('returns starting message when hand is open at rest', () => {
    const msg = evaluateFlexCoachRules({
      sensors: { thumb: 10, index: 12, middle: 15, ring: 10, little: 8 },
      repState: 'rest',
      repsCompleted: 0,
      targetReps: 12
    });
    expect(msg).toContain('Make a fist with at least 3-4 fingers');
  });

  it('prompts user when inactive for 5s', () => {
    const msg = evaluateFlexCoachRules({
      sensors: { thumb: 10, index: 10, middle: 10, ring: 10, little: 10 },
      repState: 'rest',
      secondsIdle: 6,
      repsCompleted: 0
    });
    expect(msg).toBe('Close your fingers into a fist to start');
  });

  it('prompts to close remaining fingers during closing movement', () => {
    // 1 finger closed (index at 55)
    const msg = evaluateFlexCoachRules({
      sensors: { thumb: 15, index: 55, middle: 20, ring: 15, little: 10 },
      repState: 'moving',
      repsCompleted: 1
    });
    expect(msg).toContain('Close 2 more fingers into a fist (1/5 closed)');
  });

  it('prompts to hold when 3 fingers are closed', () => {
    // 3 fingers closed (index, middle, ring >= 40)
    const msg = evaluateFlexCoachRules({
      sensors: { thumb: 20, index: 60, middle: 55, ring: 50, little: 15 },
      repState: 'moving',
      holdCountdown: 2
    });
    expect(msg).toBe('Hold the fist! 2s');
  });

  it('prompts to hold during target_hold phase with active countdown', () => {
    const msg = evaluateFlexCoachRules({
      sensors: { thumb: 45, index: 65, middle: 60, ring: 55, little: 20 },
      repState: 'target_hold',
      holdCountdown: 1
    });
    expect(msg).toBe('Hold the fist! 1s');
  });

  it('prompts to open hand fully during returning phase', () => {
    const msg = evaluateFlexCoachRules({
      sensors: { thumb: 45, index: 50, middle: 55, ring: 20, little: 15 },
      repState: 'returning'
    });
    expect(msg).toBe('Open your hand fully to finish rep');
  });

  it('signals set complete when completed reps reach target reps', () => {
    const msg = evaluateFlexCoachRules({
      sensors: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 },
      repState: 'rest',
      repsCompleted: 12,
      targetReps: 12
    });
    expect(msg).toBe('Great job! Set complete');
  });
});

describe('FlexCoachDebouncer', () => {
  it('applies immediate updates for urgent messages', () => {
    const debouncer = new FlexCoachDebouncer(700);
    const initial = debouncer.update('Make a fist with at least 3-4 fingers');
    expect(initial).toBe('Make a fist with at least 3-4 fingers');

    const urgent = debouncer.update('Hold the fist! 2s');
    expect(urgent).toBe('Hold the fist! 2s');
  });
});

describe('FlexAiCoachOverlay Component', () => {
  it('renders floating canvas overlay with AI source badge and yellow text', () => {
    render(
      <FlexAiCoachOverlay
        sensors={{ thumb: 10, index: 10, middle: 10, ring: 10, little: 10 }}
        repState="rest"
        repsCompleted={0}
        targetReps={12}
        inlineBottom={false}
      />
    );

    expect(screen.getByText('AI: RULES ONLY')).toBeInTheDocument();
    expect(screen.getByText('Hand Squeeze AI Coach')).toBeInTheDocument();
    expect(screen.getByText(/Make a fist/i)).toBeInTheDocument();
  });

  it('renders inline bottom card box cleanly', () => {
    render(
      <FlexAiCoachOverlay
        sensors={{ thumb: 50, index: 60, middle: 60, ring: 10, little: 10 }}
        repState="target_hold"
        holdCountdown={2}
        repsCompleted={3}
        targetReps={12}
        inlineBottom={true}
      />
    );

    expect(screen.getByText('Finger Flexion Biofeedback')).toBeInTheDocument();
    expect(screen.getByText(/Hold the fist! 2s/i)).toBeInTheDocument();
  });
});
