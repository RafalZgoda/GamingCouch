import { WS_PORT } from '@gamingcouch/shared';

/**
 * Returns the WebSocket server URL.
 * In production set NEXT_PUBLIC_WS_URL (e.g. wss://gamingcouch-server.up.railway.app).
 * Falls back to localhost for local development.
 */
export function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  return `ws://localhost:${WS_PORT}`;
}
