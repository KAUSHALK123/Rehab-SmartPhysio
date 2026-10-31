/**
 * SmartPhysio - Dynamic WebSocket URL Resolver
 * 
 * Automatically resolves the WebSocket endpoint to FastAPI backend (port 8000),
 * seamlessly supporting any Vite dev server port (5173, 5174, etc.) as well as
 * production reverse proxies.
 */
export function getWsUrl(path = '/api/v1/device/ws') {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = window.location.port;
  const hostname = window.location.hostname || 'localhost';

  // If running in development (e.g. Vite on 5173, 5174, 3000, etc.), direct to FastAPI port 8000
  if (port && port !== '8000' && port !== '80' && port !== '443') {
    return `${protocol}//${hostname}:8000${path}`;
  }

  return `${protocol}//${window.location.host}${path}`;
}

