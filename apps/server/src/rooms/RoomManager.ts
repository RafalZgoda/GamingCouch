import { v4 as uuidv4 } from 'uuid';
import { Room, Player, generateRoomCode, MAX_PLAYERS_PER_ROOM } from '@gamingcouch/shared';

export class RoomManager {
  private rooms = new Map<string, Room>(); // roomId -> Room
  private codeToId = new Map<string, string>(); // roomCode -> roomId

  createRoom(hostSocketId: string): Room {
    const id = uuidv4();
    const code = this.generateUniqueCode();
    const hostPlayer: Player = {
      id: uuidv4(),
      socketId: hostSocketId,
      name: 'Host',
      isHost: true,
      joinedAt: Date.now(),
    };
    const room: Room = {
      id,
      code,
      hostSocketId,
      status: 'waiting',
      players: [hostPlayer],
      currentGame: null,
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    this.codeToId.set(code, id);
    return room;
  }

  joinRoom(code: string, playerName: string, socketId: string): { room: Room; player: Player } | null {
    const roomId = this.codeToId.get(code);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') return null;
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) return null;

    const player: Player = {
      id: uuidv4(),
      socketId,
      name: playerName,
      isHost: false,
      joinedAt: Date.now(),
    };
    room.players.push(player);
    return { room, player };
  }

  removePlayer(socketId: string): { room: Room; playerId: string } | null {
    for (const room of this.rooms.values()) {
      const idx = room.players.findIndex((p) => p.socketId === socketId);
      if (idx === -1) continue;
      const [player] = room.players.splice(idx, 1);
      if (room.players.length === 0) {
        this.rooms.delete(room.id);
        this.codeToId.delete(room.code);
      }
      return { room, playerId: player.id };
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

  private generateUniqueCode(): string {
    let code: string;
    do {
      code = generateRoomCode();
    } while (this.codeToId.has(code));
    return code;
  }
}
