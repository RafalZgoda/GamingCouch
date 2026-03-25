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
const ROUND_DURATION_MS = 10_000;
const REVEAL_MS = 3_000;
const ROPE_CENTER = 50;        // 0–100 scale, 50 = center
const WIN_THRESHOLD = 80;      // rope must reach 80 or 20 to win early
const TAP_POWER = 0.6;         // how much each tap moves the rope
const DECAY_RATE = 0.002;      // rope drifts back to center per ms (mild)

// ── Controller layout ────────────────────────────────────────────────────────

const LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'TAP', label: 'PULL!', color: '#7c3aed', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface TugOfWarData {
  ropePosition: number;           // 0–100, <50 = team A winning, >50 = team B winning
  teamA: string[];                // player ids
  teamB: string[];
  teamATaps: number;
  teamBTaps: number;
  timeRemainingMs: number;
  round: number;
  totalRounds: number;
  isReveal: boolean;
  roundWinner: 'A' | 'B' | 'draw' | null;
  teamAWins: number;
  teamBWins: number;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class TugOfWarGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'tugofwar',
    name: 'Tug of War',
    description: 'Two teams tap as fast as possible to pull the rope!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private teamA: string[] = [];
  private teamB: string[] = [];
  private ropePosition = ROPE_CENTER;
  private teamATaps = 0;
  private teamBTaps = 0;
  private timeRemainingMs = ROUND_DURATION_MS;
  private revealMs = 0;
  private isReveal = false;
  private roundWinner: 'A' | 'B' | 'draw' | null = null;
  private teamAWins = 0;
  private teamBWins = 0;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(10, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.assignTeams();
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isReveal) return;

    if (this.teamA.includes(playerId)) {
      this.teamATaps++;
      this.ropePosition = Math.max(0, this.ropePosition - TAP_POWER);
    } else if (this.teamB.includes(playerId)) {
      this.teamBTaps++;
      this.ropePosition = Math.min(100, this.ropePosition + TAP_POWER);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isReveal) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.buildState(this.makeData());
    }

    // Mild decay toward center (keeps it competitive)
    if (this.ropePosition < ROPE_CENTER) {
      this.ropePosition = Math.min(ROPE_CENTER, this.ropePosition + DECAY_RATE * deltaMs);
    } else if (this.ropePosition > ROPE_CENTER) {
      this.ropePosition = Math.max(ROPE_CENTER, this.ropePosition - DECAY_RATE * deltaMs);
    }

    this.timeRemainingMs -= deltaMs;

    // Check win conditions
    if (this.ropePosition <= (100 - WIN_THRESHOLD) || this.ropePosition >= WIN_THRESHOLD || this.timeRemainingMs <= 0) {
      this.endRound();
    }

    return this.buildState(this.makeData());
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  private assignTeams(): void {
    const ids = [...this.players.keys()];
    // Shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    const mid = Math.ceil(ids.length / 2);
    this.teamA = ids.slice(0, mid);
    this.teamB = ids.slice(mid);
  }

  private startRound(): void {
    this.ropePosition = ROPE_CENTER;
    this.teamATaps = 0;
    this.teamBTaps = 0;
    this.timeRemainingMs = ROUND_DURATION_MS;
    this.isReveal = false;
    this.roundWinner = null;
    this.phase = 'active';
  }

  private endRound(): void {
    this.isReveal = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    // Determine winner
    if (this.ropePosition < ROPE_CENTER) {
      this.roundWinner = 'A';
      this.teamAWins++;
      for (const id of this.teamA) this.addScore(id, 300);
      for (const id of this.teamB) this.addScore(id, 50);
    } else if (this.ropePosition > ROPE_CENTER) {
      this.roundWinner = 'B';
      this.teamBWins++;
      for (const id of this.teamB) this.addScore(id, 300);
      for (const id of this.teamA) this.addScore(id, 50);
    } else {
      this.roundWinner = 'draw';
      for (const id of [...this.teamA, ...this.teamB]) this.addScore(id, 150);
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

  private makeData(): TugOfWarData {
    return {
      ropePosition: this.ropePosition,
      teamA: [...this.teamA],
      teamB: [...this.teamB],
      teamATaps: this.teamATaps,
      teamBTaps: this.teamBTaps,
      timeRemainingMs: Math.max(0, this.timeRemainingMs),
      round: this.round,
      totalRounds: this.totalRounds,
      isReveal: this.isReveal,
      roundWinner: this.roundWinner,
      teamAWins: this.teamAWins,
      teamBWins: this.teamBWins,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'tugofwar',
    name: 'Tug of War',
    description: 'Two teams tap as fast as possible to pull the rope!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new TugOfWarGame(config),
);
