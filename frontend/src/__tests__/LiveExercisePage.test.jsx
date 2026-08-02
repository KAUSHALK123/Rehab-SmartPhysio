import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import LiveExercisePage from '../pages/LiveExercisePage';
import apiClient from '../services/auth';
import { startSession, endSession } from '../services/session';

// Mock useNavigate and useLocation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const original = await vi.importActual('react-router-dom');
  return {
    ...original,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: { exerciseId: 'ex-1', exerciseName: 'Ball Squeeze' } }),
  };
});


vi.mock('../services/auth');

// Mock Session Service
vi.mock('../services/session', () => {
  return {
    startSession: vi.fn(),
    endSession: vi.fn(),
  };
});

// Mock global WebSocket class
class MockWebSocket {
  constructor(url) {
    this.url = url;
    MockWebSocket.instance = this;
  }
  send = vi.fn();
  close = vi.fn();
}

describe('LiveExercisePage Component', () => {
  let originalWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;

    localStorage.setItem('activePatientId', 'pat-123');
    localStorage.setItem('activePatientName', 'Alice Patient');
    localStorage.setItem('activeExerciseId', 'ex-1');
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    localStorage.clear();
  });

  it('initializes exercise session and fetches targets on mount', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        id: 'ex-1',
        exercise_name: 'Ball Squeeze',
        description: 'Squeeze a soft therapy ball to improve finger flexion.',
        body_part: 'Grip & Fingers',
        target_angle: 0.0,
        target_pressure: 400.0,
        repetitions: 10,
        hold_seconds: 5,
        rest_seconds: 3,
        difficulty: 'Easy',
      },
    });

    startSession.mockResolvedValue({ session_id: 'sess-abc-123' });

    render(
      <MemoryRouter>
        <LiveExercisePage />
      </MemoryRouter>
    );

    // Should fetch target details and call startSession
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/exercises/ex-1');
      expect(startSession).toHaveBeenCalledWith('pat-123', 'ex-1');
    });

    // Check dashboard text rendering
    expect(screen.getAllByText('Ball Squeeze')[0]).toBeInTheDocument();
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/\/ 10/)).toBeInTheDocument(); // reps completed counter
  });

  it('completes session when clicking End session manually', async () => {
    apiClient.get.mockResolvedValue({
      data: { id: 'ex-1', exercise_name: 'Ball Squeeze' },
    });
    startSession.mockResolvedValue({ session_id: 'sess-abc-123' });
    endSession.mockResolvedValue({ message: "Session Saved Successfully" });

    render(
      <MemoryRouter>
        <LiveExercisePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(startSession).toHaveBeenCalled();
    });

    // Find and click End Session button
    const endBtn = screen.getByRole('button', { name: /End & Save Session/i });
    fireEvent.click(endBtn);

    await waitFor(() => {
      expect(endSession).toHaveBeenCalledWith({
        session_id: 'sess-abc-123',
        duration_seconds: 0,
        repetitions_completed: 0,
        repetitions_failed: 0,
        average_angle: 0.0,
        max_angle: 0.0,
        average_pressure: 0.0,
        exercise_accuracy: 100,
      });
    });

    // Should show overlay and return button
    await waitFor(() => {
      expect(screen.getByText('Assessment Saved Successfully!')).toBeInTheDocument();
    });

    const returnBtn = screen.getByRole('button', { name: /Return to Library/i });
    fireEvent.click(returnBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/exercises');
  });
});
