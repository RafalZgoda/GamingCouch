import { WebSocket, WebSocketServer } from 'ws';
import { ClientToServerMessage, ServerToClientMessage, ControllerLayout } from '@gamingcouch/shared';
import { RoomManager } from '../rooms/RoomManager.js';

export function setupWebSocketServer(wss: WebSocketServer, roomManager: RoomManager) {
  const clients = new Map<string, WebSocket>(); // socketId -> WebSocket
  const roomLayouts = new Map<string, ControllerLayout>(); // roomId -> ControllerLayout

  function send(ws: WebSocket, msg: ServerToClientMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcast(socketIds: string[], msg: ServerToClientMessage) {
    for (const id of socketIds) {
      const ws = clients.get(id);
      if (ws) send(ws, msg);
    }
  }

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
          const room = roomManager.createRoom(socketId, msg.maxPlayers);
          send(ws, { type: 'ROOM_CREATED', roomCode: room.code, roomId: room.id });
          break;
        }

        case 'PLAYER_JOIN_ROOM': {
          const result = roomManager.joinRoom(msg.code, msg.playerName, msg.avatarColor, socketId);
          if (!result) {
            send(ws, { type: 'ERROR', message: 'Room not found, full, or already started' });
            return;
          }
          const { room, player } = result;
          send(ws, { type: 'ROOM_JOINED', room });
          const otherSocketIds = room.players
            .map((p) => p.socketId)
            .filter((id) => id !== socketId);
          broadcast(otherSocketIds, { type: 'PLAYER_JOINED', player });
          break;
        }

        case 'PLAYER_READY': {
          const result = roomManager.setPlayerReady(socketId, true);
          if (!result) return;
          const { room, player } = result;
          const allSocketIds = room.players.map((p) => p.socketId);
          broadcast(allSocketIds, {
            type: 'PLAYER_READY_CHANGED',
            playerId: player.id,
            isReady: player.isReady,
          });
          if (room.status === 'ready') {
            broadcast(allSocketIds, { type: 'ROOM_STATUS_CHANGED', status: 'ready' });
          }
          break;
        }

        case 'HOST_KICK_PLAYER': {
          const result = roomManager.kickPlayer(socketId, msg.playerId);
          if (!result) {
            send(ws, { type: 'ERROR', message: 'Cannot kick that player' });
            return;
          }
          const { room, playerId } = result;
          const allSocketIds = room.players.map((p) => p.socketId);
          broadcast(allSocketIds, { type: 'PLAYER_KICKED', playerId });
          // The kicked player's WS is no longer in room; send them an error too
          // We look them up via the playerId which we no longer have socketId for,
          // but the client should handle PLAYER_KICKED and disconnect gracefully.
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
          broadcast(allSocketIds, { type: 'GAME_STARTED', gameId: msg.gameId });
          // If there's a stored layout for this room, send it to players now
          const existingLayout = roomLayouts.get(room.id);
          if (existingLayout) {
            const playerSocketIds = room.players
              .filter((p) => p.socketId !== socketId)
              .map((p) => p.socketId);
            broadcast(playerSocketIds, { type: 'CONTROLLER_LAYOUT', layout: existingLayout });
          }
          break;
        }

        case 'HOST_SET_CONTROLLER_LAYOUT': {
          const room = roomManager.getRoomBySocketId(socketId);
          if (!room || room.hostSocketId !== socketId) {
            send(ws, { type: 'ERROR', message: 'Not authorized' });
            return;
          }
          roomLayouts.set(room.id, msg.layout);
          // Broadcast to all non-host players
          const playerSocketIds = room.players
            .filter((p) => p.socketId !== socketId)
            .map((p) => p.socketId);
          broadcast(playerSocketIds, { type: 'CONTROLLER_LAYOUT', layout: msg.layout });
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
          broadcast(allSocketIds, { type: 'GAME_ENDED', scores: {} });
          break;
        }
      }
    });

    ws.on('close', () => {
      clients.delete(socketId);
      const result = roomManager.removePlayer(socketId);
      if (result) {
        const allSocketIds = result.room.players.map((p) => p.socketId);
        broadcast(allSocketIds, { type: 'PLAYER_LEFT', playerId: result.playerId });
        if (result.wasHost) {
          // Host disconnected — close room and clean up layout
          roomLayouts.delete(result.room.id);
          roomManager.closeRoom(result.room.id);
          broadcast(allSocketIds, { type: 'ERROR', message: 'Host disconnected. Room closed.' });
        }
      }
    });
  });
}
