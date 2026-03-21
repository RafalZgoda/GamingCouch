export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  code: string; // 4-digit join code
  hostSocketId: string;
  status: RoomStatus;
  players: Player[];
  currentGame: string | null;
  createdAt: number;
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}
