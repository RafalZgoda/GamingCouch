import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { WS_PORT } from '@gamingcouch/shared';
import { RoomManager } from './rooms/RoomManager.js';
import { setupWebSocketServer } from './ws/handler.js';
import { GameRegistry } from './games/GameRegistry.js';
// Side-effect imports: register all built-in games
import './games/registry/index.js';

const app = express();
app.use(cors());
app.use(express.json());

const roomManager = new RoomManager();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// List all available games (used by host lobby to populate game picker)
app.get('/api/games', (_req, res) => {
  res.json(GameRegistry.list());
});

// Look up a room by code (used by join page to validate before WS connect)
app.get('/api/rooms/:code', (req, res) => {
  const room = roomManager.getRoomByCode(req.params.code.toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  if (room.status !== 'waiting') {
    res.status(409).json({ error: 'Room already started' });
    return;
  }
  if (room.players.length >= room.maxPlayers) {
    res.status(409).json({ error: 'Room is full' });
    return;
  }
  res.json({
    code: room.code,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    status: room.status,
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocketServer(wss, roomManager);

server.listen(WS_PORT, () => {
  console.log(`GamingCouch server running on port ${WS_PORT}`);
});
