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

const DEFAULT_ROUNDS = 5;
const ARENA = 100;                 // logical 100x100 arena
const PADDLE_LENGTH = 16;          // paddle length in arena units
const PADDLE_THICKNESS = 2;
const PADDLE_OFFSET = 4;           // distance from wall
const PADDLE_SPEED = 0.06;         // units per ms
const BALL_RADIUS = 2;
const BALL_BASE_SPEED = 0.04;      // units per ms
const BALL_SPEED_INCREMENT = 0.003; // per bounce
const BALL_MAX_SPEED = 0.12;
const SCORE_TO_WIN_ROUND = 5;      // points per round
const SERVE_DELAY_MS = 1_500;
const ROUND_END_MS = 3_000;

// Paddle sides: 0=left, 1=right, 2=top, 3=bottom
type Side = 0 | 1 | 2 | 3;

const SIDE_LABELS = ['Left', 'Right', 'Top', 'Bottom'];

// ── Controller layout ────────────────────────────────────────────────────────

const LAYOUT: ControllerLayout = {
  controls: [
    { type: 'joystick', id: 'move', label: 'Move Paddle', position: 'center' },
  ],
};

// ── Public state shape ───────────────────────────────────────────────────────

export interface RetroPongData {
  arena: number;
  ball: { x: number; y: number; radius: number } | null;
  paddles: Record<string, { side: Side; pos: number; length: number; offset: number; thickness: number; eliminated: boolean }>;
  roundScoresNeeded: number;
  roundPoints: Record<string, number>;
  round: number;
  totalRounds: number;
  isServing: boolean;
  serveMs: number;
  isRoundEnd: boolean;
  roundEndMs: number;
  lastScorer: string | null;
  eliminatedThisRound: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class RetroPongGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'retropong',
    name: 'Retro Pong',
    description: 'Classic Pong with up to 4 paddles — one on each side!',
    minPlayers: 2,
    maxPlayers: 4,
  };

  private readonly configRounds: number;
  private paddles = new Map<string, { side: Side; pos: number; eliminated: boolean }>();
  private joysticks = new Map<string, { x: number; y: number }>();
  private ballX = 50;
  private ballY = 50;
  private ballVX = 0;
  private ballVY = 0;
  private ballSpeed = BALL_BASE_SPEED;
  private ballActive = false;
  private serving = false;
  private serveMs = 0;
  private roundEndMs = 0;
  private isRoundEnd = false;
  private roundPoints: Record<string, number> = {};
  private lastScorer: string | null = null;
  private eliminatedThisRound: string[] = [];
  private sideToPlayer = new Map<Side, string>();

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(10, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.assignPaddles();
    this.startRound();
    const state = this.buildState(this.makeData());
    return { ...state, controllerLayout: LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action === 'joystick') {
      this.joysticks.set(playerId, { x: input.x, y: input.y });
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRoundEnd) {
      this.roundEndMs -= deltaMs;
      if (this.roundEndMs <= 0) this.nextRound();
      return this.buildState(this.makeData());
    }

    if (this.serving) {
      this.serveMs -= deltaMs;
      if (this.serveMs <= 0) this.serveBall();
      this.movePaddles(deltaMs);
      return this.buildState(this.makeData());
    }

    // Active play
    this.movePaddles(deltaMs);
    this.moveBall(deltaMs);
    this.checkCollisions();

    return this.buildState(this.makeData());
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  private assignPaddles(): void {
    const playerIds = [...this.players.keys()];
    const sides: Side[] = [0, 1, 2, 3]; // left, right, top, bottom
    playerIds.forEach((id, i) => {
      const side = sides[i % 4]!;
      this.paddles.set(id, { side, pos: 50, eliminated: false });
      this.joysticks.set(id, { x: 0, y: 0 });
      this.sideToPlayer.set(side, id);
    });
  }

  private startRound(): void {
    this.roundPoints = {};
    this.eliminatedThisRound = [];
    this.lastScorer = null;
    this.isRoundEnd = false;
    this.phase = 'active';
    for (const [id, p] of this.paddles) {
      p.pos = 50;
      p.eliminated = false;
      this.roundPoints[id] = 0;
    }
    this.ballSpeed = BALL_BASE_SPEED;
    this.startServe();
  }

  private startServe(): void {
    this.serving = true;
    this.serveMs = SERVE_DELAY_MS;
    this.ballActive = false;
    this.ballX = 50;
    this.ballY = 50;
    this.ballVX = 0;
    this.ballVY = 0;
  }

  private serveBall(): void {
    this.serving = false;
    this.ballActive = true;
    // Random direction
    const angle = Math.random() * Math.PI * 2;
    this.ballVX = Math.cos(angle) * this.ballSpeed;
    this.ballVY = Math.sin(angle) * this.ballSpeed;
  }

  // ── Physics ────────────────────────────────────────────────────────────────

  private movePaddles(deltaMs: number): void {
    for (const [id, paddle] of this.paddles) {
      if (paddle.eliminated) continue;
      const joy = this.joysticks.get(id) ?? { x: 0, y: 0 };
      // Left/right paddles move vertically (use joy.y), top/bottom move horizontally (use joy.x)
      const input = paddle.side <= 1 ? joy.y : joy.x;
      paddle.pos = clamp(
        paddle.pos + input * PADDLE_SPEED * deltaMs,
        PADDLE_LENGTH / 2,
        ARENA - PADDLE_LENGTH / 2,
      );
    }
  }

  private moveBall(deltaMs: number): void {
    if (!this.ballActive) return;
    this.ballX += this.ballVX * deltaMs;
    this.ballY += this.ballVY * deltaMs;
  }

  private checkCollisions(): void {
    if (!this.ballActive) return;

    // Check each wall — if a paddle exists on that side, check paddle hit; else bounce off wall
    // Left wall (x <= 0)
    if (this.ballX - BALL_RADIUS <= PADDLE_OFFSET + PADDLE_THICKNESS) {
      this.checkSideCollision(0, 'x', -1);
    }
    // Right wall (x >= ARENA)
    if (this.ballX + BALL_RADIUS >= ARENA - PADDLE_OFFSET - PADDLE_THICKNESS) {
      this.checkSideCollision(1, 'x', 1);
    }
    // Top wall (y <= 0)
    if (this.ballY - BALL_RADIUS <= PADDLE_OFFSET + PADDLE_THICKNESS) {
      this.checkSideCollision(2, 'y', -1);
    }
    // Bottom wall (y >= ARENA)
    if (this.ballY + BALL_RADIUS >= ARENA - PADDLE_OFFSET - PADDLE_THICKNESS) {
      this.checkSideCollision(3, 'y', 1);
    }
  }

  private checkSideCollision(side: Side, axis: 'x' | 'y', direction: -1 | 1): void {
    const playerId = this.sideToPlayer.get(side);
    const paddle = playerId ? this.paddles.get(playerId) : undefined;

    if (!paddle || paddle.eliminated) {
      // No active paddle on this side — bounce off wall
      if (axis === 'x') {
        if (direction === -1 && this.ballVX < 0) { this.ballVX = -this.ballVX; this.ballX = BALL_RADIUS; }
        if (direction === 1 && this.ballVX > 0) { this.ballVX = -this.ballVX; this.ballX = ARENA - BALL_RADIUS; }
      } else {
        if (direction === -1 && this.ballVY < 0) { this.ballVY = -this.ballVY; this.ballY = BALL_RADIUS; }
        if (direction === 1 && this.ballVY > 0) { this.ballVY = -this.ballVY; this.ballY = ARENA - BALL_RADIUS; }
      }
      return;
    }

    // Check if ball is within paddle range
    const ballPosOnAxis = axis === 'x' ? this.ballY : this.ballX;
    const halfPaddle = PADDLE_LENGTH / 2;
    const hitsPaddle = ballPosOnAxis >= paddle.pos - halfPaddle && ballPosOnAxis <= paddle.pos + halfPaddle;

    if (hitsPaddle) {
      // Paddle hit — reflect and speed up
      if (axis === 'x') {
        this.ballVX = -this.ballVX;
        this.ballX = direction === -1
          ? PADDLE_OFFSET + PADDLE_THICKNESS + BALL_RADIUS
          : ARENA - PADDLE_OFFSET - PADDLE_THICKNESS - BALL_RADIUS;
      } else {
        this.ballVY = -this.ballVY;
        this.ballY = direction === -1
          ? PADDLE_OFFSET + PADDLE_THICKNESS + BALL_RADIUS
          : ARENA - PADDLE_OFFSET - PADDLE_THICKNESS - BALL_RADIUS;
      }

      // Add slight angle based on where ball hit paddle
      const offset = (ballPosOnAxis - paddle.pos) / halfPaddle; // -1 to 1
      if (axis === 'x') {
        this.ballVY += offset * 0.01;
      } else {
        this.ballVX += offset * 0.01;
      }

      // Speed up
      this.ballSpeed = Math.min(this.ballSpeed + BALL_SPEED_INCREMENT, BALL_MAX_SPEED);
      const currentSpeed = Math.sqrt(this.ballVX * this.ballVX + this.ballVY * this.ballVY);
      if (currentSpeed > 0) {
        const scale = this.ballSpeed / currentSpeed;
        this.ballVX *= scale;
        this.ballVY *= scale;
      }
    } else {
      // Missed! The ball goes past the paddle — score against this player
      this.onMiss(playerId!);
    }
  }

  private onMiss(missedPlayerId: string): void {
    // All other active players score a point
    const activePlayers = [...this.paddles.entries()].filter(([, p]) => !p.eliminated);
    for (const [id] of activePlayers) {
      if (id !== missedPlayerId) {
        this.roundPoints[id] = (this.roundPoints[id] ?? 0) + 1;
      }
    }
    this.lastScorer = missedPlayerId; // who got scored ON

    // Check if this player is eliminated for this round
    const maxPointsOthers = Math.max(...activePlayers.filter(([id]) => id !== missedPlayerId).map(([id]) => this.roundPoints[id] ?? 0));
    if (maxPointsOthers >= SCORE_TO_WIN_ROUND) {
      this.endRoundWithScores();
      return;
    }

    // Re-serve
    this.startServe();
  }

  // ── Round management ───────────────────────────────────────────────────────

  private endRoundWithScores(): void {
    this.isRoundEnd = true;
    this.roundEndMs = ROUND_END_MS;
    this.ballActive = false;
    this.phase = 'round_end';

    // Award game-level scores based on round points
    const entries = Object.entries(this.roundPoints);
    const maxPts = Math.max(...entries.map(([, p]) => p));
    for (const [id, pts] of entries) {
      const bonus = pts === maxPts ? 300 : pts * 50;
      this.addScore(id, bonus);
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

  // ── State builder ──────────────────────────────────────────────────────────

  private makeData(): RetroPongData {
    const paddles: RetroPongData['paddles'] = {};
    for (const [id, p] of this.paddles) {
      paddles[id] = {
        side: p.side,
        pos: p.pos,
        length: PADDLE_LENGTH,
        offset: PADDLE_OFFSET,
        thickness: PADDLE_THICKNESS,
        eliminated: p.eliminated,
      };
    }

    return {
      arena: ARENA,
      ball: this.ballActive || this.serving
        ? { x: this.ballX, y: this.ballY, radius: BALL_RADIUS }
        : null,
      paddles,
      roundScoresNeeded: SCORE_TO_WIN_ROUND,
      roundPoints: { ...this.roundPoints },
      round: this.round,
      totalRounds: this.totalRounds,
      isServing: this.serving,
      serveMs: Math.max(0, this.serveMs),
      isRoundEnd: this.isRoundEnd,
      roundEndMs: Math.max(0, this.roundEndMs),
      lastScorer: this.lastScorer,
      eliminatedThisRound: [...this.eliminatedThisRound],
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'retropong',
    name: 'Retro Pong',
    description: 'Classic Pong with up to 4 paddles — one on each side!',
    minPlayers: 2,
    maxPlayers: 4,
  },
  (config) => new RetroPongGame(config),
);
