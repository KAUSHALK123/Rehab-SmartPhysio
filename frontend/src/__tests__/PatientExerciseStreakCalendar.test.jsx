import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PatientExerciseStreakCalendar, { 
  calculateStreakStats, 
  generateYearCalendarWeeks, 
  toDateKey 
} from '../components/PatientExerciseStreakCalendar';

describe('calculateStreakStats', () => {
  it('correctly calculates current streak and longest streak', () => {
    const today = new Date();
    const d0 = new Date(today);
    const d1 = new Date(today);
    d1.setDate(d1.getDate() - 1);
    const d2 = new Date(today);
    d2.setDate(d2.getDate() - 2);

    // 3 consecutive days: today, yesterday, 2 days ago
    const mockHistory = [
      { id: '1', date: `${toDateKey(d0)}T10:00:00`, duration_seconds: 60, exercise_accuracy: 90 },
      { id: '2', date: `${toDateKey(d1)}T11:00:00`, duration_seconds: 60, exercise_accuracy: 95 },
      { id: '3', date: `${toDateKey(d2)}T12:00:00`, duration_seconds: 60, exercise_accuracy: 85 },
      // Older isolated session
      { id: '4', date: '2025-01-01T10:00:00', duration_seconds: 30, exercise_accuracy: 100 },
    ];

    const stats = calculateStreakStats(mockHistory, today);
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
    expect(stats.totalActiveDays).toBe(4);
  });

  it('keeps streak alive if user exercised yesterday but not yet today', () => {
    const today = new Date();
    const d1 = new Date(today);
    d1.setDate(d1.getDate() - 1);
    const d2 = new Date(today);
    d2.setDate(d2.getDate() - 2);

    const mockHistory = [
      { id: '1', date: `${toDateKey(d1)}T11:00:00`, duration_seconds: 60, exercise_accuracy: 95 },
      { id: '2', date: `${toDateKey(d2)}T12:00:00`, duration_seconds: 60, exercise_accuracy: 85 },
    ];

    const stats = calculateStreakStats(mockHistory, today);
    expect(stats.currentStreak).toBe(2);
  });

  it('returns 0 streak when neither today nor yesterday has exercises', () => {
    const today = new Date();
    const d5 = new Date(today);
    d5.setDate(d5.getDate() - 5);

    const mockHistory = [
      { id: '1', date: `${toDateKey(d5)}T10:00:00`, duration_seconds: 60, exercise_accuracy: 90 }
    ];

    const stats = calculateStreakStats(mockHistory, today);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(1);
    expect(stats.totalActiveDays).toBe(1);
  });
});

describe('generateYearCalendarWeeks', () => {
  it('generates 52-53 weeks for a year with month labels', () => {
    const { weeks, monthLabels } = generateYearCalendarWeeks(2026);
    expect(weeks.length).toBeGreaterThanOrEqual(52);
    expect(weeks.length).toBeLessThanOrEqual(54);
    expect(weeks[0].length).toBe(7);
    expect(monthLabels.length).toBeGreaterThanOrEqual(12);
  });
});

describe('PatientExerciseStreakCalendar Component', () => {
  const sampleHistory = [
    { id: 's1', date: '2026-09-27T10:00:00', exercise_name: 'Wrist Flexion', duration_seconds: 120, exercise_accuracy: 92 },
    { id: 's2', date: '2026-09-28T11:00:00', exercise_name: 'Wrist Extension', duration_seconds: 150, exercise_accuracy: 96 },
    { id: 's3', date: '2026-09-29T09:30:00', exercise_name: 'Elbow Curl', duration_seconds: 180, exercise_accuracy: 100 },
  ];

  it('renders the streak calendar card with statistics', () => {
    render(
      <PatientExerciseStreakCalendar 
        history={sampleHistory}
        patientName="John"
      />
    );

    expect(screen.getByTestId('patient-streak-calendar')).toBeInTheDocument();
    expect(screen.getByText('Daily Exercise Streak & Activity Tree')).toBeInTheDocument();
    expect(screen.getByText(/Current Streak/i)).toBeInTheDocument();
    expect(screen.getByText(/Longest Streak/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Active Days/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Completed Sessions/i)).toBeInTheDocument();
  });

  it('allows browsing back and forth between years', () => {
    render(
      <PatientExerciseStreakCalendar 
        history={sampleHistory}
        patientName="John"
      />
    );

    const prevYearBtn = screen.getByLabelText('Previous Year');
    const nextYearBtn = screen.getByLabelText('Next Year');

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(String(currentYear))).toBeInTheDocument();

    // Click previous year
    fireEvent.click(prevYearBtn);
    expect(screen.getByText(String(currentYear - 1))).toBeInTheDocument();

    // Click next year twice
    fireEvent.click(nextYearBtn);
    expect(screen.getByText(String(currentYear))).toBeInTheDocument();
  });
});
