import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FingerClosingDemoCard from '../components/FingerClosingDemoCard';

describe('FingerClosingDemoCard Component', () => {
  it('renders Finger Closing demo title, Demo badge, and fist movement label', () => {
    render(<FingerClosingDemoCard targetReps={10} />);

    expect(screen.getByText('Finger Closing')).toBeInTheDocument();
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByText('Fist Movement')).toBeInTheDocument();
  });

  it('renders rep counter indicator synchronized to target reps (defaults to 12 reps)', () => {
    render(<FingerClosingDemoCard />);

    expect(screen.getByText(/REP 1 \/ 12/i)).toBeInTheDocument();
  });

  it('renders the 4-phase rep progression indicators (OPEN, CLOSE, HOLD, OPEN)', () => {
    render(<FingerClosingDemoCard targetReps={8} />);

    // Cycle steps
    expect(screen.getByText('CLOSE')).toBeInTheDocument();
    expect(screen.getByText('HOLD')).toBeInTheDocument();
    // OPEN appears in cycle step and badge
    expect(screen.getAllByText('OPEN').length).toBeGreaterThanOrEqual(1);
  });

  it('displays the required patient instruction text', () => {
    render(<FingerClosingDemoCard targetReps={10} />);

    expect(
      screen.getByText('Close your fingers into a fist, hold, then slowly open.')
    ).toBeInTheDocument();
  });
});
