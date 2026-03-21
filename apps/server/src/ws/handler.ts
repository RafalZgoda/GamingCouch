import { WebSocket, WebSocketServer } from 'ws';
import { ClientToServerMessage, ServerToClientMessage, ControllerLayout } from '@gamingcouch/shared';
import { RoomManager } from '../rooms/RoomManager.js';
import { GameEngine } from '../games/GameEngine.js';

export function setupWebSocketServer(wss: WebSocketServer, roomManager: RoomManager) {
  const clients = new Map<string, WebSocket>(); // socketId -> WebSocket
  const roomLayouts = new Map<string, ControllerLayout>(); // roomId -> ControllerLayout
  const gameEngines = new Map<string, GameEngine>(); // roomId -> GameEngine

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

          // If a game is already running, notify the engine of the late join
          const engine = gameEngines.get(room.id);
          if (engine) {
            engine.onPlayerJoin(player);
            // Send current game state to the newly joined player
            send(ws, { type: 'GAME_STATE_UPDATE', state: engine.getState() });
            const layout = roomLayouts.get(room.id);
            if (layout) send(ws, { type: 'CONTROLLER_LAYOUT', layout });
          }
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
          break;
        }

        case 'HOST_START_GAME': {
          const room = roomManager.getRoomBySocketId(socketId);
          if (!room || room.hostSocketId !== socketId) {
            send(ws, { type: 'ERROR', message: 'Not authorized' });
            return;
          }

          // Tear down any existing engine for this room
          gameEngines.get(room.id)?.end();
          gameEngines.delete(room.id);

          room.status = 'playing';
          room.currentGame = msg.gameId;
          const allSocketIds = room.players.map((p) => p.socketId);

          let engine: GameEngine;
          try {
            engine = new GameEngine(
              room.id,
              msg.gameId,
              // onStateUpdate — broadcast to everyone in the room
              (state) => {
                broadcast(allSocketIds, { type: 'GAME_STATE_UPDATE', state });
                // Propagate layout change if the game emits one
                if (state.controllerLayout) {
                  const playerSocketIds = allSocketIds.filter((id) => id !== room.hostSocketId);
                  broadcast(playerSocketIds, {
                    type: 'CONTROLLER_LAYOUT',
                    layout: state.controllerLayout,
                  });
                  roomLayouts.set(room.id, state.controllerLayout);
                }
              },
              // onGameEnd
              (final) => {
                room.status = 'finished';
                room.currentGame = null;
                broadcast(allSocketIds, {
                  type: 'GAME_ENDED',
                  scores: final.scores,
                  winner: final.winner,
                });
                gameEngines.delete(room.id);
              },
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown game';
            send(ws, { type: 'ERROR', message });
            return;
          }

          gameEngines.set(room.id, engine);

          const initialState = engine.start(room.players);
          broadcast(allSocketIds, { type: 'GAME_STARTED', gameId: msg.gameId });
          broadcast(allSocketIds, { type: 'GAME_STATE_UPDATE', state: initialState });

          // Send controller layout to players (not the host)
          const layout =
            initialState.controllerLayout ?? roomLayouts.get(room.id);
          if (layout) {
            const playerSocketIds = allSocketIds.filter((id) => id !== socketId);
            broadcast(playerSocketIds, { type: 'CONTROLLER_LAYOUT', layout });
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
          const playerSocketIds = room.players
            .filter((p) => p.socketId !== socketId)
            .map((p) => p.socketId);
          broadcast(playerSocketIds, { type: 'CONTROLLER_LAYOUT', layout: msg.layout });
          break;
        }

        case 'PLAYER_INPUT': {
          const room = roomManager.getRoomBySocketId(socketId);
          if (!room) return;
          const engine = gameEngines.get(room.id);
          if (engine) {
            // Route input to the game engine
            const player = room.players.find((p) => p.socketId === socketId);
            if (player) engine.onInput(player.id, msg.payload);
          } else {
            // Fallback: forward raw input to host (no active engine)
            const hostWs = clients.get(room.hostSocketId);
            if (hostWs) {
              send(hostWs, {
                type: 'GAME_STATE_UPDATE',
                state: {
                  gameId: room.currentGame ?? '',
                  phase: 'active',
                  scores: {},
                  round: { round: 1, totalRounds: 1, roundScores: {} },
                  data: msg.payload,
                },
              });
            }
          }
          break;
        }

        case 'HOST_END_GAME': {
          const room = roomManager.getRoomBySocketId(socketId);
          if (!room || room.hostSocketId !== socketId) return;
          const engine = gameEngines.get(room.id);
          const final = engine?.end() ?? { scores: {}, winner: null };
          gameEngines.delete(room.id);
          room.status = 'finished';
          room.currentGame = null;
          const allSocketIds = room.players.map((p) => p.socketId);
          broadcast(allSocketIds, {
            type: 'GAME_ENDED',
            scores: final.scores,
            winner: final.winner,
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      clients.delete(socketId);
      const result = roomManager.removePlayer(socketId);
      if (result) {
        const { room, playerId, wasHost } = result;
        const allSocketIds = room.players.map((p) => p.socketId);
        broadcast(allSocketIds, { type: 'PLAYER_LEFT', playerId });

        // Notify active game engine of the departure
        gameEngines.get(room.id)?.onPlayerLeave(playerId);

        if (wasHost) {
          // Host disconnected — end the game, close the room
          const engine = gameEngines.get(room.id);
          if (engine) {
            engine.end();
            gameEngines.delete(room.id);
          }
          roomLayouts.delete(room.id);
          roomManager.closeRoom(room.id);
          broadcast(allSocketIds, { type: 'ERROR', message: 'Host disconnected. Room closed.' });
        }
      }
    });
  });
}
