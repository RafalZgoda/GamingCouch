import { WebSocket, WebSocketServer } from 'ws';
import { ClientToServerMessage, ServerToClientMessage } from '@gamingcouch/shared';
import { RoomManager } from '../rooms/RoomManager.js';

export function setupWebSocketServer(wss: WebSocketServer, roomManager: RoomManager) {
  function send(ws: WebSocket, msg: ServerToClientMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcast(socketIds: string[], msg: ServerToClientMessage, clients: Map<string, WebSocket>) {
    for (const id of socketIds) {
      const ws = clients.get(id);
      if (ws) send(ws, msg);
    }
  }

  const clients = new Map<string, WebSocket>(); // socketId -> WebSocket

  wss.on('connection', (ws) => {
    const socketId = crypto.randomUUID();
    clients.set(socketId, ws);

    ws.on('message', (raw) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientToServerMessage;
      } catch {
        send(ws, { type: 'ERROR', message: 'Invalid JSON' });
        return;
      }

      switch (msg.type) {
        case 'HOST_CREATE_ROOM': {
          const room = roomManager.createRoom(socketId);
          send(ws, { type: 'ROOM_CREATED', roomCode: room.code, roomId: room.id });
          break;
        }

        case 'PLAYER_JOIN_ROOM': {
          const result = roomManager.joinRoom(msg.code, msg.playerName, socketId);
          if (!result) {
            send(ws, { type: 'ERROR', message: 'Room not found or full' });
            return;
          }
          const { room, player } = result;
          send(ws, { type: 'ROOM_JOINED', room });
          const allSocketIds = room.players.map((p) => p.socketId).filter((id) => id !== socketId);
          broadcast(allSocketIds, { type: 'PLAYER_JOINED', player }, clients);
          break;
        }

        case 'HOST_START_GAME': {
          const room = roomManager.getRoomBySocketId(socketId);
          if (!room || room.hostSocketId !== socketId) {
            send(ws, { type: 'ERROR', message: 'Not authorized' });
            return;
          }
          room.status = 'playing';
          room.currentGame = msg.gameId;
          const allSocketIds = room.players.map((p) => p.socketId);
          broadcast(allSocketIds, { type: 'GAME_STARTED', gameId: msg.gameId }, clients);
          break;
        }

        case 'PLAYER_INPUT': {
          const room = roomManager.getRoomBySocketId(socketId);
          if (!room) return;
          const hostWs = clients.get(room.hostSocketId);
          if (hostWs) send(hostWs, { type: 'GAME_STATE_UPDATE', state: msg.payload });
          break;
        }

        case 'HOST_END_GAME': {
          const room = roomManager.getRoomBySocketId(socketId);
          if (!room || room.hostSocketId !== socketId) return;
          room.status = 'finished';
          room.currentGame = null;
          const allSocketIds = room.players.map((p) => p.socketId);
          broadcast(allSocketIds, { type: 'GAME_ENDED', scores: {} }, clients);
          break;
        }
      }
    });

    ws.on('close', () => {
      clients.delete(socketId);
      const result = roomManager.removePlayer(socketId);
      if (result) {
        const allSocketIds = result.room.players.map((p) => p.socketId);
        broadcast(allSocketIds, { type: 'PLAYER_LEFT', playerId: result.playerId }, clients);
      }
    });
  });
}
