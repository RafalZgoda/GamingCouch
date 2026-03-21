import type { AvatarColor } from './room';
import type { ControllerLayout, ControllerInputEvent } from './controller';

/**
 * Messages sent from clients (phone controllers / host) to the server.
 */
export type ClientToServerMessage =
  | { type: 'HOST_CREATE_ROOM'; maxPlayers?: number }
  | { type: 'PLAYER_JOIN_ROOM'; code: string; playerName: string; avatarColor: AvatarColor }
  | { type: 'PLAYER_READY' }
  | { type: 'HOST_START_GAME'; gameId: string }
  | { type: 'HOST_KICK_PLAYER'; playerId: string }
  | { type: 'HOST_SET_CONTROLLER_LAYOUT'; layout: ControllerLayout }
  | { type: 'PLAYER_INPUT'; payload: ControllerInputEvent }
  | { type: 'HOST_END_GAME' };

/**
 * Messages sent from the server to clients.
 */
export type ServerToClientMessage =
  | { type: 'ROOM_CREATED'; roomCode: string; roomId: string }
  | { type: 'ROOM_JOINED'; room: import('./room').Room }
  | { type: 'PLAYER_JOINED'; player: import('./room').Player }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'PLAYER_READY_CHANGED'; playerId: string; isReady: boolean }
  | { type: 'PLAYER_KICKED'; playerId: string }
  | { type: 'ROOM_STATUS_CHANGED'; status: import('./room').RoomStatus }
  | { type: 'GAME_STARTED'; gameId: string }
  | { type: 'CONTROLLER_LAYOUT'; layout: ControllerLayout }
  | { type: 'GAME_STATE_UPDATE'; state: unknown }
  | { type: 'GAME_ENDED'; scores: Record<string, number> }
  | { type: 'ERROR'; message: string };
