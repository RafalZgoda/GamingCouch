export const ROOM_CODE_LENGTH = 4;
export const MAX_PLAYERS_PER_ROOM = 8;
export const MIN_PLAYERS_TO_START = 2;
export const ROOM_CODE_EXPIRY_MS = 1000 * 60 * 60; // 1 hour

export const WS_PORT = 3001;
export const WEB_PORT = 3000;

export const AVATAR_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'teal',
] as const;

export const AVATAR_COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
};
