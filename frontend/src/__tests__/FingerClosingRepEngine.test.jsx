import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import LiveExercisePage from '../pages/LiveExercisePage';
import apiClient from '../services/auth';
import { startSession, endSession } from '../services/session';

let currentExerciseState = {
  exerciseId: 'ex-finger-closing',
  exerciseName: 'Finger Closing'
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const original = await vi.importActual('react-router-dom');
  return {
    ...original,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: currentExerciseState
    }),
  };
});

vi.mock('../services/auth');

vi.mock('../services/session', () => ({
  startSession: vi.fn(),
  endSession: vi.fn(),
}));

class MockWebSocket {
  constructor(url) {
    this.url = url;
    MockWebSocket.instance = this;
  }
  send = vi.fn();
  close = vi.fn();
}

describe('Finger Repetition & Movement Engine (3-of-5 Coordinated Rule)', () => {
  let originalWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;
    vi.useFakeTimers();

    localStorage.setItem('activePatientId', 'pat-123');
    localStorage.setItem('activePatientName', 'Alice Patient');
    localStorage.setItem('activeExerciseId', 'ex-finger-closing');
    localStorage.setItem('activeExerciseName', 'Finger Closing');

    currentExerciseState = {
      exerciseId: 'ex-finger-closing',
      exerciseName: 'Finger Closing'
    };

    apiClient.get.mockImplementation((url) => {
      if (url.includes('/exercises/')) {
        return Promise.resolve({
          data: {
            id: currentExerciseState.exerciseId,
            exercise_name: currentExerciseState.exerciseName,
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
  });

  afterEach(() => {
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    localStorage.clear();
  });

  const setupPage = async () => {
    const utils = render(
      <MemoryRouter>
        <LiveExercisePage />
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(100);
    });

    const ws = MockWebSocket.instance;
    return { ...utils, ws };
  };

  const expectReps = (count, target = 12) => {
    const repsHeader = screen.getByText('REPETITIONS');
    const repCard = repsHeader.closest('div');
    expect(repCard).toHaveTextContent(new RegExp(`${count}\\s*\\/\\s*${target}`));
  };

  // =========================================================================
  // FINGER CLOSING TESTS
  // =========================================================================

  it('TEST 1: Only Thumb moves -> 0 reps', async () => {
    const { ws } = await setupPage();

    // Rest state: open hand (all <= 10%)
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    // Only Thumb closes (60%), others remain open (5%)
    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 60, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    // Hold time
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Return thumb to open
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(1000);
    });

    // Reps should remain 0
    expectReps(0);
  });

  it('TEST 2: Thumb + Index move -> 0 reps', async () => {
    const { ws } = await setupPage();

    // Rest state
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    // Thumb + Index close (60%), 3 others stay open
    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 60, index: 60, middle: 5, ring: 5, little: 5
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Return to open
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(1000);
    });

    // Reps should remain 0
    expectReps(0);
  });

  it('TEST 3: Thumb + Index + Middle perform a complete closing cycle -> 1 rep', async () => {
    const { ws } = await setupPage();

    // Rest (open)
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 10, index: 10, middle: 10, ring: 10, little: 10
        })
      });
    });

    // Close 3 fingers: Thumb, Index, Middle
    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 55, index: 60, middle: 65, ring: 10, little: 10
        })
      });
    });

    // Hold 1s
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Return to open
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 10, index: 10, middle: 10, ring: 10, little: 10
        })
      });
      vi.advanceTimersByTime(1000);
    });

    expectReps(1);
  });

  it('TEST 4: Index + Middle + Ring perform a complete cycle -> 1 rep', async () => {
    const { ws } = await setupPage();

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 10, index: 55, middle: 55, ring: 55, little: 10
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(1000);
    });

    expectReps(1);
  });

  it('TEST 5: Middle + Ring + Little perform a complete cycle -> 1 rep', async () => {
    const { ws } = await setupPage();

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 10, index: 10, middle: 60, ring: 60, little: 60
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(1000);
    });

    expectReps(1);
  });

  it('TEST 6: All 5 fingers perform a complete cycle -> 1 rep', async () => {
    const { ws } = await setupPage();

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 70, index: 70, middle: 70, ring: 70, little: 70
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(1000);
    });

    expectReps(1);
  });

  it('TEST 7: Three fingers move but do not complete the required return cycle -> 0 reps', async () => {
    const { ws } = await setupPage();

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 55, index: 55, middle: 55, ring: 5, little: 5
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Stay partially bent (38% bend > 30% return threshold)
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 38, index: 38, middle: 38, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(1000);
    });

    expectReps(0);
  });

  it('TEST 8: Sensor noise without meaningful movement -> 0 reps', async () => {
    const { ws } = await setupPage();

    // Noise fluctuations between 5% and 25% (below 40% threshold)
    for (let i = 0; i < 5; i++) {
      act(() => {
        ws.onmessage({
          data: JSON.stringify({
            type: 'sensor_data',
            thumb: 15 + (i % 5),
            index: 20 - (i % 4),
            middle: 12 + (i % 6),
            ring: 18 - (i % 3),
            little: 10 + (i % 5)
          })
        });
        vi.advanceTimersByTime(300);
      });
    }

    expectReps(0);
  });

  it('TEST 9: Holding the closed position -> should NOT continuously increase reps', async () => {
    const { ws } = await setupPage();

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 60, index: 60, middle: 60, ring: 60, little: 60
        })
      });
    });

    // Stay closed for 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Reps should still be 0 until return is performed
    expectReps(0);
  });

  it('TEST 10: One physical movement -> exactly 1 rep, never multiple reps', async () => {
    const { ws } = await setupPage();

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });

    // Close
    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 60, index: 60, middle: 60, ring: 60, little: 60
        })
      });
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Return open
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(100);
      // Extra sensor messages coming while in rest
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(500);
    });

    expectReps(1);
  });

  // =========================================================================
  // FINGER OPENING TESTS
  // =========================================================================

  it('Finger Opening: Coordinated 3-of-5 complete cycle counts 1 rep', async () => {
    currentExerciseState = {
      exerciseId: 'ex-finger-opening',
      exerciseName: 'Finger Opening'
    };
    localStorage.setItem('activeExerciseId', 'ex-finger-opening');
    localStorage.setItem('activeExerciseName', 'Finger Opening');

    const { ws } = await setupPage();

    // Rest position: closed fist (all >= 50%)
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 60, index: 60, middle: 60, ring: 60, little: 60
        })
      });
    });

    // Open 3 fingers: Index, Middle, Ring (<= 25% bend), Thumb & Little stay closed (70)
    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 70, index: 5, middle: 5, ring: 5, little: 70
        })
      });
    });

    // Hold 1s
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Return to closed fist
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 70, index: 65, middle: 65, ring: 65, little: 70
        })
      });
      vi.advanceTimersByTime(1000);
    });

    expectReps(1);
  });

  it('Session save upon completion calls endSession with correct rep count', async () => {
    const { ws } = await setupPage();

    // Perform 1 rep
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
    });
    act(() => {
      vi.advanceTimersByTime(500);
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 60, index: 60, middle: 60, ring: 60, little: 5
        })
      });
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 5, index: 5, middle: 5, ring: 5, little: 5
        })
      });
      vi.advanceTimersByTime(1000);
    });

    expectReps(1);

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
  });
});
