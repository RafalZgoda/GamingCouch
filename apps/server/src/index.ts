import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { WS_PORT } from '@gamingcouch/shared';
import { RoomManager } from './rooms/RoomManager.js';
import { setupWebSocketServer } from './ws/handler.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();

setupWebSocketServer(wss, roomManager);

server.listen(WS_PORT, () => {
  console.log(`GamingCouch server running on port ${WS_PORT}`);
});
