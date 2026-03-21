import { ROOM_CODE_LENGTH } from '../constants';

export function generateRoomCode(): string {
  const digits = Array.from({ length: ROOM_CODE_LENGTH }, () =>
    Math.floor(Math.random() * 10).toString(),
  );
  return digits.join('');
}

export function isValidRoomCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}
