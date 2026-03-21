import { WS_PORT } from '@gamingcouch/shared';

/**
 * Returns the WebSocket server URL.
 * Priority:
 *  1. NEXT_PUBLIC_WS_URL env var (explicit override)
 *  2. Same origin as the page (production: server + web run on same host)
 *  3. Localhost fallback for local dev
 */
export function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return `ws://localhost:${WS_PORT}`;
}
