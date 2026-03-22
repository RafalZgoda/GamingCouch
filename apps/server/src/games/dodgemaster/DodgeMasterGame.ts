import type {
  Player,
  ControllerInputEvent,
  GameState,
  GameDefinition,
  ControllerLayout,
} from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUNDS = 5;
const ROUND_DURATION_MS = 12_000;
const REVEAL_MS = 3_000;
const ARENA_SIZE = 100; // logical units (0–100)
const PLAYER_RADIUS = 4;
const OBSTACLE_RADIUS = 3;
const PLAYER_SPEED = 0.035; // units per ms
const OBSTACLE_BASE_SPEED = 0.015;
const OBSTACLE_SPEED_INCREASE = 0.003; // per round
const SPAWN_INTERVAL_MS = 800;
const SURVIVAL_POINTS_PER_SEC = 10;
const ROUND_SURVIVE_BONUS = 200;

// ── Controller layout ─────────────────────────────────────────────────────────

const LAYOUT: ControllerLayout = {
  controls: [
    { type: 'joystick', id: 'move', label: 'Move', position: 'center' },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Obstacle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface PlayerState {
  x: number;
  y: number;
  alive: boolean;
  diedAtMs: number | null;
}

export interface DodgeMasterData {
  arena: number;
  playerRadius: number;
  obstacleRadius: number;
  players: Record<string, { x: number; y: number; alive: boolean }>;
  obstacles: Array<{ x: number; y: number; radius: number }>;
  timeRemainingMs: number;
  round: number;
  totalRounds: number;
}

// ── Game implementation ───────────────────────────────────────────────────────

export class DodgeMasterGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'dodgemaster',
    name: 'Dodge Master',
    description: 'Use the joystick to dodge falling obstacles. Survive the longest!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private readonly configRounds: number;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(10, Math.max(1, Math.round(r))) : ROUNDS;
  }

  private playerStates = new Map<string, PlayerState>();
  private joystickInputs = new Map<string, { x: number; y: number }>();
  private obstacles: Obstacle[] = [];
  private obstacleIdCounter = 0;
  private roundTimeMs = 0;
  private spawnTimer = 0;
  private revealMs = 0;
  private isRevealing = false;
  private currentRoundScores: Record<string, number> = {};
  private obstacleSpeed = OBSTACLE_BASE_SPEED;

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.startRound();
    const state = this.buildState(this.makeData(), {});
    return { ...state, controllerLayout: LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action === 'joystick') {
      this.joystickInputs.set(playerId, { x: input.x, y: input.y });
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.buildState(this.makeData(), this.currentRoundScores);
    }

    // Move players
    for (const [id, ps] of this.playerStates) {
      if (!ps.alive) continue;
      const joy = this.joystickInputs.get(id) ?? { x: 0, y: 0 };
      ps.x = clamp(ps.x + joy.x * PLAYER_SPEED * deltaMs, PLAYER_RADIUS, ARENA_SIZE - PLAYER_RADIUS);
      ps.y = clamp(ps.y + joy.y * PLAYER_SPEED * deltaMs, PLAYER_RADIUS, ARENA_SIZE - PLAYER_RADIUS);
    }

    // Spawn obstacles
    this.spawnTimer -= deltaMs;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      this.spawnTimer = SPAWN_INTERVAL_MS;
    }

    // Move obstacles
    for (const obs of this.obstacles) {
      obs.x += obs.vx * deltaMs;
      obs.y += obs.vy * deltaMs;
    }
    // Remove off-screen
    this.obstacles = this.obstacles.filter(
      (o) => o.x > -10 && o.x < ARENA_SIZE + 10 && o.y > -10 && o.y < ARENA_SIZE + 10,
    );

    // Collision detection
    for (const [id, ps] of this.playerStates) {
      if (!ps.alive) continue;
      for (const obs of this.obstacles) {
        const dx = ps.x - obs.x;
        const dy = ps.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PLAYER_RADIUS + obs.radius) {
          ps.alive = false;
          ps.diedAtMs = ROUND_DURATION_MS - this.roundTimeMs;
          break;
        }
      }
    }

    // Award survival points
    const aliveCount = [...this.playerStates.values()].filter((p) => p.alive).length;

    // Time progression
    this.roundTimeMs -= deltaMs;
    if (this.roundTimeMs <= 0 || aliveCount === 0) {
      this.endRound();
    }

    return this.buildState(this.makeData(), this.currentRoundScores);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startRound(): void {
    this.roundTimeMs = ROUND_DURATION_MS;
    this.spawnTimer = SPAWN_INTERVAL_MS;
    this.obstacles = [];
    this.isRevealing = false;
    this.currentRoundScores = {};
    this.obstacleSpeed = OBSTACLE_BASE_SPEED + (this.round - 1) * OBSTACLE_SPEED_INCREASE;
    this.phase = 'active';

    // Place players in random positions
    for (const id of this.players.keys()) {
      this.playerStates.set(id, {
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 60,
        alive: true,
        diedAtMs: null,
      });
      this.joystickInputs.set(id, { x: 0, y: 0 });
    }
  }

  private spawnObstacle(): void {
    // Spawn from a random edge
    const edge = Math.floor(Math.random() * 4); // 0=top, 1=bottom, 2=left, 3=right
    let x: number, y: number, vx: number, vy: number;
    const speed = this.obstacleSpeed * (0.8 + Math.random() * 0.4);

    switch (edge) {
      case 0: // top
        x = Math.random() * ARENA_SIZE; y = -OBSTACLE_RADIUS;
        vx = (Math.random() - 0.5) * speed * 0.5; vy = speed;
        break;
      case 1: // bottom
        x = Math.random() * ARENA_SIZE; y = ARENA_SIZE + OBSTACLE_RADIUS;
        vx = (Math.random() - 0.5) * speed * 0.5; vy = -speed;
        break;
      case 2: // left
        x = -OBSTACLE_RADIUS; y = Math.random() * ARENA_SIZE;
        vx = speed; vy = (Math.random() - 0.5) * speed * 0.5;
        break;
      default: // right
        x = ARENA_SIZE + OBSTACLE_RADIUS; y = Math.random() * ARENA_SIZE;
        vx = -speed; vy = (Math.random() - 0.5) * speed * 0.5;
        break;
    }

    this.obstacles.push({
      id: this.obstacleIdCounter++,
      x, y, vx, vy,
      radius: OBSTACLE_RADIUS,
    });
  }

  private endRound(): void {
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    for (const [id, ps] of this.playerStates) {
      if (ps.alive) {
        // Survived the full round
        const pts = ROUND_SURVIVE_BONUS + SURVIVAL_POINTS_PER_SEC * (ROUND_DURATION_MS / 1000);
        this.currentRoundScores[id] = Math.round(pts);
        this.addScore(id, Math.round(pts));
      } else if (ps.diedAtMs !== null) {
        // Partial survival
        const survivedSec = ps.diedAtMs / 1000;
        const pts = Math.round(SURVIVAL_POINTS_PER_SEC * survivedSec);
        this.currentRoundScores[id] = pts;
        this.addScore(id, pts);
      }
    }
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private makeData(): DodgeMasterData {
    const players: DodgeMasterData['players'] = {};
    for (const [id, ps] of this.playerStates) {
      players[id] = { x: ps.x, y: ps.y, alive: ps.alive };
    }

    return {
      arena: ARENA_SIZE,
      playerRadius: PLAYER_RADIUS,
      obstacleRadius: OBSTACLE_RADIUS,
      players,
      obstacles: this.obstacles.map((o) => ({ x: o.x, y: o.y, radius: o.radius })),
      timeRemainingMs: Math.max(0, this.roundTimeMs),
      round: this.round,
      totalRounds: this.totalRounds,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'dodgemaster',
    name: 'Dodge Master',
    description: 'Use the joystick to dodge falling obstacles. Survive the longest!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  (config) => new DodgeMasterGame(config),
);
