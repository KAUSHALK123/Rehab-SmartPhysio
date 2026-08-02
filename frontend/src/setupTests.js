import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Stub out Canvas / WebGL features
window.HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  clip: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  createLinearGradient: vi.fn(),
  createPattern: vi.fn(),
  createRadialGradient: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 0 }),
  transform: vi.fn(),
  rect: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  translate: vi.fn(),
});

// Mock react-three-fiber Canvas and components without JSX syntax
vi.mock('@react-three/fiber', () => {
  return {
    Canvas: ({ children }) => React.createElement('div', { 'data-testid': 'mock-canvas' }, children),
    useFrame: vi.fn(),
    useThree: vi.fn().mockReturnValue({ camera: {}, scene: {}, gl: {} }),
  };
});

vi.mock('@react-three/drei', () => {
  return {
    OrbitControls: () => React.createElement('div', { 'data-testid': 'mock-orbit-controls' }),
  };
});

// Mock Recharts to avoid rendering complexities in jsdom
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }) => React.createElement('div', { 'data-testid': 'recharts-container' }, children),
    LineChart: ({ children }) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
    Line: () => React.createElement('div', { 'data-testid': 'line-element' }),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

// Stub localstorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock apiClient and Auth service globally
vi.mock('./services/auth', () => {
  const mockClient = {
    post: vi.fn(() => Promise.resolve({ data: { message: "Connected" } })),
    get: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    }
  };
  return {
    default: mockClient,
    registerUser: vi.fn(() => Promise.resolve({ success: true })),
    loginUser: vi.fn(() => Promise.resolve({ success: true })),
    logoutUser: vi.fn(() => Promise.resolve({ success: true })),
  };
});

