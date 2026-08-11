import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CalibrationPage from '../pages/CalibrationPage';
import apiClient from '../services/auth';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const original = await vi.importActual('react-router-dom');
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

// Mock API Client using manual mock
vi.mock('../services/auth');

// Mock global WebSocket class
class MockWebSocket {
  constructor(url) {
    this.url = url;
    MockWebSocket.instance = this;
  }
  send = vi.fn();
  close = vi.fn();
}

describe('CalibrationPage Component', () => {
  let originalWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
  });

  it('renders Step 1 Connection step by default', () => {
    render(
      <MemoryRouter>
        <CalibrationPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Calibration Wizard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Establish Link/i })).toBeInTheDocument();
  });

  it('starts connection flow on button click', async () => {
    render(
      <MemoryRouter>
        <CalibrationPage />
      </MemoryRouter>
    );

    const connectBtn = screen.getByRole('button', { name: /Establish Link/i });
    fireEvent.click(connectBtn);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();

    // Trigger onopen on mock websocket
    const wsInstance = MockWebSocket.instance;
    act(() => {
      wsInstance.onopen();
    });

    // Simulate connection message from ESP32
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'status_update',
          status: 'hardware_status_changed',
          hardware_connected: true
        })
      });
    });

    // Should transition to showing Component Diagnostics controls
    await waitFor(() => {
      expect(screen.getAllByText('Component Diagnostics')[0]).toBeInTheDocument();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/device/connect');
  });

  it('verifies sensor data messages and validation status', async () => {
    render(
      <MemoryRouter>
        <CalibrationPage />
      </MemoryRouter>
    );

    const connectBtn = screen.getByRole('button', { name: /Establish Link/i });
    fireEvent.click(connectBtn);

    const wsInstance = MockWebSocket.instance;
    act(() => {
      wsInstance.onopen();
    });
    
    // Simulate connection message from ESP32
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'status_update',
          status: 'hardware_status_changed',
          hardware_connected: true
        })
      });
    });

    // Wait for Component Diagnostics to load
    await waitFor(() => {
      expect(screen.getAllByText('Component Diagnostics')[0]).toBeInTheDocument();
    });

    // 1. Calibrate Flex Sensors (variance >= 25% on 3 fingers)
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 0, index: 0, middle: 0, ring: 0, little: 0,
          elbow: 180, wrist_pitch: 0, wrist_roll: 0, pressure: 0, battery: 90
        })
      });
    });
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 50, index: 50, middle: 50, ring: 50, little: 50,
          elbow: 180, wrist_pitch: 0, wrist_roll: 0, pressure: 0, battery: 90
        })
      });
    });
    
    // Click "Next Sensor Diagnostics"
    await waitFor(() => {
      const nextBtn = screen.getByRole('button', { name: /Next Sensor Diagnostics/i });
      expect(nextBtn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /Next Sensor Diagnostics/i }));

    // 2. Calibrate Elbow (variance >= 20)
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 50, index: 50, middle: 50, ring: 50, little: 50,
          elbow: 180, wrist_pitch: 0, wrist_roll: 0, pressure: 0, battery: 90
        })
      });
    });
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 50, index: 50, middle: 50, ring: 50, little: 50,
          elbow: 150, wrist_pitch: 0, wrist_roll: 0, pressure: 0, battery: 90
        })
      });
    });
    
    // Click "Next Sensor Diagnostics"
    await waitFor(() => {
      const nextBtn = screen.getByRole('button', { name: /Next Sensor Diagnostics/i });
      expect(nextBtn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /Next Sensor Diagnostics/i }));

    // 3. Calibrate MPU (variance >= 15)
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 50, index: 50, middle: 50, ring: 50, little: 50,
          elbow: 150, wrist_pitch: 0, wrist_roll: 0, pressure: 0, battery: 90
        })
      });
    });
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 50, index: 50, middle: 50, ring: 50, little: 50,
          elbow: 150, wrist_pitch: 20, wrist_roll: 0, pressure: 0, battery: 90
        })
      });
    });
    
    // Click "Next Sensor Diagnostics"
    await waitFor(() => {
      const nextBtn = screen.getByRole('button', { name: /Next Sensor Diagnostics/i });
      expect(nextBtn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /Next Sensor Diagnostics/i }));

    // 4. Calibrate Pressure (variance >= 150)
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 50, index: 50, middle: 50, ring: 50, little: 50,
          elbow: 150, wrist_pitch: 20, wrist_roll: 0, pressure: 0, battery: 90
        })
      });
    });
    act(() => {
      wsInstance.onmessage({
        data: JSON.stringify({
          type: 'sensor_data',
          thumb: 50, index: 50, middle: 50, ring: 50, little: 50,
          elbow: 150, wrist_pitch: 20, wrist_roll: 0, pressure: 200, battery: 90
        })
      });
    });

    const continueBtn = screen.getByRole('button', { name: /Continue to Motion Verification/i });
    await waitFor(() => {
      expect(continueBtn).not.toBeDisabled();
    }, { timeout: 5000 });
    fireEvent.click(continueBtn);

    // Verify transition to Step 2
    expect(screen.getByText('Step 2: Motion Verification')).toBeInTheDocument();
  });
});
