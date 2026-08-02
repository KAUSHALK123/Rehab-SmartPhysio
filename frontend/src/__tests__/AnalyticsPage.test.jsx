import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AnalyticsPage from '../pages/AnalyticsPage';
import { getDashboardAnalytics } from '../services/analytics';

// Mock getDashboardAnalytics service
vi.mock('../services/analytics', () => {
  return {
    getDashboardAnalytics: vi.fn(),
  };
});

describe('AnalyticsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders active patient required alert when no patient is set in localStorage', () => {
    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Active Patient Profile Required')).toBeInTheDocument();
    expect(screen.getByText(/You must select or create a patient profile before displaying historical rehabilitation metrics/i)).toBeInTheDocument();
  });

  it('renders analytics dashboard stats when active patient is configured', async () => {
    localStorage.setItem('activePatientId', 'pat-999');
    localStorage.setItem('activePatientName', 'Jane Doe');

    getDashboardAnalytics.mockResolvedValue({
      total_sessions: 15,
      total_duration_seconds: 7200, // 2 hours
      average_accuracy: 85.6,
      max_range_of_motion: 110.0,
      average_grip_strength: 550.0,
      history: [
        {
          id: 'sess-1',
          exercise_name: 'Wrist Flexion',
          exercise_accuracy: 90.0,
          date: '2026-07-29T10:00:00Z',
          duration_seconds: 120,
          repetitions_completed: 10,
          repetitions_failed: 1,
          average_angle: 85.0,
          average_pressure: 0.0,
        }
      ],
      weekly_progress: [
        { day: 'Mon', average_accuracy: 80 },
        { day: 'Tue', average_accuracy: 85 }
      ],
    });

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Active Patient Profile Required')).not.toBeInTheDocument();

    // Verify statistics cards
    await waitFor(() => {
      expect(screen.getByText(/15 runs/)).toBeInTheDocument(); // total sessions
      expect(screen.getByText('85.6%')).toBeInTheDocument(); // average accuracy
      expect(screen.getByText('110°')).toBeInTheDocument(); // range of motion
      expect(screen.getByText('550 N')).toBeInTheDocument(); // grip force
    });

    // Verify charts container exists
    expect(screen.getAllByTestId('recharts-container')).toHaveLength(3);
    expect(screen.getByText('Wrist Flexion')).toBeInTheDocument();
  });

  it('displays error message when API call fails', async () => {
    localStorage.setItem('activePatientId', 'pat-999');
    getDashboardAnalytics.mockRejectedValue(new Error('API error'));

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load rehabilitation analytics. Please verify backend connectivity.')).toBeInTheDocument();
    });
  });
});
