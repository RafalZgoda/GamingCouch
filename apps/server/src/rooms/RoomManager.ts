import { v4 as uuidv4 } from 'uuid';
import {
  Room,
  Player,
  AvatarColor,
  generateRoomCode,
  MAX_PLAYERS_PER_ROOM,
  ROOM_CODE_EXPIRY_MS,
} from '@gamingcouch/shared';

export class RoomManager {
  private rooms = new Map<string, Room>(); // roomId -> Room
  private codeToId = new Map<string, string>(); // roomCode -> roomId

  constructor() {
    // Clean up expired rooms every 5 minutes
    setInterval(() => this.pruneExpiredRooms(), 5 * 60 * 1000);
  }

  createRoom(hostSocketId: string, maxPlayers = MAX_PLAYERS_PER_ROOM): Room {
    const id = uuidv4();
    const code = this.generateUniqueCode();
    const hostPlayer: Player = {
      id: uuidv4(),
      socketId: hostSocketId,
      name: 'Host',
      avatarColor: 'blue',
      isHost: true,
      isReady: true,
      joinedAt: Date.now(),
    };
    const room: Room = {
      id,
      code,
      hostSocketId,
      status: 'waiting',
      players: [hostPlayer],
      currentGame: null,
      maxPlayers: Math.min(Math.max(1, maxPlayers), MAX_PLAYERS_PER_ROOM),
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    this.codeToId.set(code, id);
    return room;
  }

  joinRoom(
    code: string,
    playerName: string,
    avatarColor: AvatarColor,
    socketId: string,
  ): { room: Room; player: Player } | null {
    const roomId = this.codeToId.get(code);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') return null;
    if (room.players.length >= room.maxPlayers) return null;

    const player: Player = {
      id: uuidv4(),
      socketId,
      name: playerName.trim().slice(0, 20),
      avatarColor,
      isHost: false,
      isReady: false,
      joinedAt: Date.now(),
    };
    room.players.push(player);
    return { room, player };
  }

  setPlayerReady(socketId: string, isReady: boolean): { room: Room; player: Player } | null {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return null;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player || player.isHost) return null;
    player.isReady = isReady;
    // Update room status: "ready" when all non-host players are ready (≥1 player)
    const nonHostPlayers = room.players.filter((p) => !p.isHost);
    if (nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.isReady)) {
      room.status = 'ready';
    } else if (room.status === 'ready') {
      room.status = 'waiting';
    }
    return { room, player };
  }

  kickPlayer(hostSocketId: string, playerId: string): { room: Room; playerId: string } | null {
    const room = this.getRoomBySocketId(hostSocketId);
    if (!room || room.hostSocketId !== hostSocketId) return null;
    const idx = room.players.findIndex((p) => p.id === playerId && !p.isHost);
    if (idx === -1) return null;
    room.players.splice(idx, 1);
    return { room, playerId };
  }

  removePlayer(socketId: string): { room: Room; playerId: string; wasHost: boolean } | null {
    for (const room of this.rooms.values()) {
      const idx = room.players.findIndex((p) => p.socketId === socketId);
      if (idx === -1) continue;
      const [player] = room.players.splice(idx, 1);
      if (room.players.length === 0) {
        this.rooms.delete(room.id);
        this.codeToId.delete(room.code);
      }
      return { room, playerId: player.id, wasHost: player.isHost };
    }
    return null;
  }

  getRoomByCode(code: string): Room | undefined {
    const id = this.codeToId.get(code);
    return id ? this.rooms.get(id) : undefined;
  }

  getRoomBySocketId(socketId: string): Room | undefined {
    return [...this.rooms.values()].find((r) =>
      r.players.some((p) => p.socketId === socketId),
    );
  }

  getRoomById(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  getAllRooms(): Room[] {
    return [...this.rooms.values()];
  }

  closeRoom(roomId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    this.rooms.delete(roomId);
    this.codeToId.delete(room.code);
    return room;
  }

  private generateUniqueCode(): string {
    let code: string;
    do {
      code = generateRoomCode();
    } while (this.codeToId.has(code));
    return code;
  }

  private pruneExpiredRooms(): void {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      if (now - room.createdAt > ROOM_CODE_EXPIRY_MS) {
        this.rooms.delete(room.id);
        this.codeToId.delete(room.code);
      }
    }
  }
}
