import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RandomForestModelCard from '../components/RandomForestModelCard';

describe('RandomForestModelCard Component', () => {
  it('renders Random Forest title and 100 Trees badge', () => {
    render(
      <RandomForestModelCard 
        quality="correct"
        confidence={0.95}
        exerciseName="Finger Closing"
      />
    );

    expect(screen.getByText('Random Forest Classifier')).toBeInTheDocument();
    expect(screen.getByText('100 Trees')).toBeInTheDocument();
    expect(screen.getByText('Correct Form')).toBeInTheDocument();
    expect(screen.getByText('95% Confidence')).toBeInTheDocument();
    expect(screen.getByText('100 Estimators')).toBeInTheDocument();
  });

  it('renders different clinical classes dynamically', () => {
    const { rerender } = render(
      <RandomForestModelCard 
        quality="too_shallow"
        confidence={0.88}
      />
    );
    expect(screen.getByText(/Too Shallow/i)).toBeInTheDocument();
    expect(screen.getByText('88% Confidence')).toBeInTheDocument();

    rerender(
      <RandomForestModelCard 
        quality="too_fast"
        confidence={0.92}
      />
    );
    expect(screen.getByText(/Too Fast/i)).toBeInTheDocument();

    rerender(
      <RandomForestModelCard 
        quality="jerky"
        confidence={0.85}
      />
    );
    expect(screen.getByText(/Jerky \/ Tremor/i)).toBeInTheDocument();
  });

  it('expands feature importance breakdown on toggle button click', () => {
    render(
      <RandomForestModelCard 
        quality="correct"
        confidence={0.94}
      />
    );

    expect(screen.queryByText('Primary Decision Tree Features')).not.toBeInTheDocument();

    const toggleBtn = screen.getByTitle('Toggle model feature details');
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Primary Decision Tree Features')).toBeInTheDocument();
    expect(screen.getByText('Peak Count & Repetition Rhythm')).toBeInTheDocument();
    expect(screen.getByText('Mean Absolute Jerk (Smoothness)')).toBeInTheDocument();
    expect(screen.getByText('15.6%')).toBeInTheDocument();
  });
});
