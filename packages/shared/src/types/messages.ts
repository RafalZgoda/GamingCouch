/**
 * Messages sent from clients (phone controllers / host) to the server.
 */
export type ClientToServerMessage =
  | { type: 'HOST_CREATE_ROOM' }
  | { type: 'PLAYER_JOIN_ROOM'; code: string; playerName: string }
  | { type: 'HOST_START_GAME'; gameId: string }
  | { type: 'PLAYER_INPUT'; payload: unknown }
  | { type: 'HOST_END_GAME' };

/**
 * Messages sent from the server to clients.
 */
export type ServerToClientMessage =
  | { type: 'ROOM_CREATED'; roomCode: string; roomId: string }
  | { type: 'ROOM_JOINED'; room: import('./room').Room }
  | { type: 'PLAYER_JOINED'; player: import('./room').Player }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'GAME_STARTED'; gameId: string }
  | { type: 'GAME_STATE_UPDATE'; state: unknown }
  | { type: 'GAME_ENDED'; scores: Record<string, number> }
  | { type: 'ERROR'; message: string };
