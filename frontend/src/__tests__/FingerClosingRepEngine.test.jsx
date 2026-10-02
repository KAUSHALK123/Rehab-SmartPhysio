import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    useLocation: () => ({ 
      state: { 
        exerciseId: 'ex-finger-closing', 
        exerciseName: 'Finger Closing' 
      } 
    }),
  };
});

vi.mock('../services/auth');

vi.mock('../services/session', () => {
  return {
    startSession: vi.fn(),
    endSession: vi.fn(),
  };
});

class MockWebSocket {
  constructor(url) {
    this.url = url;
    MockWebSocket.instance = this;
  }
  send = vi.fn();
  close = vi.fn();
}

describe('Finger Closing Repetition & Saving Engine', () => {
  let originalWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;

    localStorage.setItem('activePatientId', 'pat-123');
    localStorage.setItem('activePatientName', 'Alice Patient');
    localStorage.setItem('activeExerciseId', 'ex-finger-closing');
    localStorage.setItem('activeExerciseName', 'Finger Closing');
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    localStorage.clear();
  });

  it('counts a repetition when 3-4 fingers are closed and opened, and saves the session', async () => {
    vi.useFakeTimers();

    apiClient.get.mockImplementation((url) => {
      if (url.includes('/exercises/')) {
        return Promise.resolve({
          data: {
            id: 'ex-finger-closing',
            exercise_name: 'Finger Closing',
            body_part: 'Hand/Fingers',
            target_joint: 'Fingers',
            primary_sensor: 'flex_avg',
            secondary_sensor: 'wrist_pitch',
            repetitions: 12,
            hold_seconds: 1,
            rest_seconds: 1,
          }
        });
      }
      return Promise.resolve({ data: { id: 'pat-123', name: 'Alice Patient' } });
    });

    startSession.mockResolvedValue({ session_id: 'sess-finger-123' });
    endSession.mockResolvedValue({ message: 'Session Saved Successfully' });

    render(
      <MemoryRouter>
        <LiveExercisePage />
      </MemoryRouter>
    );

    // Advance to resolve exercise loading and open WS
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(100);
    });

    const ws = MockWebSocket.instance;
    expect(ws).toBeDefined();

    // 1. Send initial open hand state (rest)
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 10,
          index: 10,
          middle: 10,
          ring: 10,
          little: 10
        })
      });
    });

    // 2. Simulate closing 3 fingers (index, middle, ring >= 40%)
    act(() => {
      vi.advanceTimersByTime(1000);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 15,
          index: 55,
          middle: 60,
          ring: 50,
          little: 15
        })
      });
    });

    // Hold timer (1 second) counts down
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // 3. Return to open hand (rest) to complete the repetition
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 10,
          index: 12,
          middle: 10,
          ring: 15,
          little: 10
        })
      });
      vi.advanceTimersByTime(1000);
    });

    // Verify rep count incremented to 1 of 12
    expect(screen.getAllByText(/\/ 12/)[0]).toBeInTheDocument();

    // End and save session
    const endBtn = screen.getByRole('button', { name: /End & Save/i });
    act(() => {
      fireEvent.click(endBtn);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(endSession).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'sess-finger-123',
        repetitions_completed: 1,
      })
    );

    vi.useRealTimers();
  });
});
