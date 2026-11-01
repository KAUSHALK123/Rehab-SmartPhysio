import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ElbowSwitchTrialPanel from '../components/ElbowSwitchTrialPanel';

describe('ElbowSwitchTrialPanel Component', () => {
  it('renders default live contact state and pinout information', () => {
    render(<ElbowSwitchTrialPanel />);

    expect(screen.getByText(/Elbow Contact Switch Diagnostic/i)).toBeInTheDocument();
    expect(screen.getByText(/ESP32 GPIO 27/i)).toBeInTheDocument();
    expect(screen.getByText(/SWITCH CLOSED \(0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/LOW \(0V \/ GND\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0°/i).length).toBeGreaterThan(0);
  });

  it('updates target angles on manual simulation button clicks', () => {
    const handleAnglesUpdate = vi.fn();
    const handleStateChange = vi.fn();

    render(
      <ElbowSwitchTrialPanel 
        onAnglesUpdate={handleAnglesUpdate}
        onStateChange={handleStateChange}
      />
    );

    // Initial render sets extended pose (0 deg bend)
    expect(handleAnglesUpdate).toHaveBeenCalledWith(expect.objectContaining({
      bendDeg: 0,
      percentage: 0
    }));

    // Click "Separate Wires (Bend 1)"
    const bendBtn = screen.getByRole('button', { name: /Separate Wires \(Bend 1\)/i });
    fireEvent.click(bendBtn);

    expect(screen.getByText(/SWITCH OPEN \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH \(3.3V \/ PULLUP\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/-90°/i).length).toBeGreaterThan(0);

    expect(handleAnglesUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      bendDeg: 90,
      percentage: 100
    }));

    // Click "Touch Wires (Extend 0)" to complete 1 rep
    const extendBtn = screen.getByRole('button', { name: /Touch Wires \(Extend 0\)/i });
    fireEvent.click(extendBtn);

    expect(screen.getByText(/SWITCH CLOSED \(0\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0°/i).length).toBeGreaterThan(0);
  });

  it('adjusts transition duration via slider within 250-400ms range', () => {
    render(<ElbowSwitchTrialPanel />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('300');

    fireEvent.change(slider, { target: { value: '350' } });
    expect(slider).toHaveValue('350');
    expect(screen.getByText('350 ms')).toBeInTheDocument();
  });

  it('reflects live ESP32 telemetry packet switch state', () => {
    const handleAnglesUpdate = vi.fn();

    // Telemetry packet with open switch (HIGH = 1 = bent)
    const livePacket = {
      elbow_switch: 1
    };

    render(
      <ElbowSwitchTrialPanel 
        liveSensors={livePacket}
        deviceConnected={true}
        onAnglesUpdate={handleAnglesUpdate}
      />
    );

    expect(screen.getByText(/SWITCH OPEN \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH \(3.3V \/ PULLUP\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ESP32 Streaming/i)).toBeInTheDocument();
  });
});
