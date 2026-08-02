import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('Connect Wearable Sleeve')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Establish Device Link' })).toBeInTheDocument();
  });

  it('starts connection flow on button click', async () => {
    render(
      <MemoryRouter>
        <CalibrationPage />
      </MemoryRouter>
    );

    const connectBtn = screen.getByRole('button', { name: 'Establish Device Link' });
    fireEvent.click(connectBtn);

    expect(screen.getByText('Connecting to Device Link...')).toBeInTheDocument();

    // Trigger onopen on mock websocket
    const wsInstance = MockWebSocket.instance;
    wsInstance.onopen();

    // Should transition to Step 2: Diagnostics
    await waitFor(() => {
      expect(screen.getByText('Sensor Diagnostic Checks')).toBeInTheDocument();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/device/connect');
  });

  it('verifies sensor data messages and validation status', async () => {
    render(
      <MemoryRouter>
        <CalibrationPage />
      </MemoryRouter>
    );

    const connectBtn = screen.getByRole('button', { name: 'Establish Device Link' });
    fireEvent.click(connectBtn);

    const wsInstance = MockWebSocket.instance;
    wsInstance.onopen();
    
    // Wait for Step 2 to load using waitFor
    await waitFor(() => {
      expect(screen.getByText('Sensor Diagnostic Checks')).toBeInTheDocument();
    });

    const continueBtn = screen.getByRole('button', { name: /Continue to Motion Test/i });
    await waitFor(() => {
      expect(continueBtn).not.toBeDisabled();
    }, { timeout: 5000 });
    fireEvent.click(continueBtn);

    // Verify transition to Step 3
    expect(screen.getByText('Step 3: Motion Verification')).toBeInTheDocument();
  });
});
