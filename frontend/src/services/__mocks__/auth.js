import { vi } from 'vitest';

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

export const registerUser = vi.fn(() => Promise.resolve({ success: true }));
export const loginUser = vi.fn(() => Promise.resolve({ success: true }));
export const logoutUser = vi.fn(() => Promise.resolve({ success: true }));

export default mockClient;
