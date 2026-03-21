export type RoomStatus = 'waiting' | 'ready' | 'playing' | 'finished';

export type AvatarColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'teal';

export interface Player {
  id: string;
  socketId: string;
  name: string;
  avatarColor: AvatarColor;
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
}

export interface Room {
  id: string;
  code: string; // 4-digit join code
  hostSocketId: string;
  status: RoomStatus;
  players: Player[];
  currentGame: string | null;
  maxPlayers: number;
  createdAt: number;
}
