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

const ROUNDS = 10;
const COUNTDOWN_MS = 2_000;
const RESPONSE_WINDOW_MS = 3_000;
const REVEAL_MS = 2_500;
const MAX_SCORE = 1_000;
const MIN_SCORE = 100;
const WRONG_PENALTY = 150;

type SwipeDirection = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: SwipeDirection[] = ['up', 'down', 'left', 'right'];

// ── Controller layout ─────────────────────────────────────────────────────────

const LAYOUT: ControllerLayout = {
  controls: [
    { type: 'swipe', id: 'swipe', label: 'Swipe the direction shown on TV!' },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────

type RoundPhase = 'countdown' | 'go' | 'reveal';

export interface SwipeDuelData {
  roundPhase: RoundPhase;
  /** The direction players must swipe */
  targetDirection: SwipeDirection;
  /** Countdown timer before the direction is shown */
  countdownMs: number;
  /** Time remaining to swipe */
  responseMs: number;
  /** Who swiped correctly (during reveal) */
  correctPlayers: string[];
  /** Who swiped wrong (during reveal) */
  wrongPlayers: string[];
  /** Who didn't swipe (during reveal) */
  missedPlayers: string[];
  round: number;
  totalRounds: number;
}

// ── Game implementation ───────────────────────────────────────────────────────

export class SwipeDuelGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'swipeduel',
    name: 'Swipe Duel',
    description: 'Swipe in the right direction as fast as you can!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private readonly configRounds: number;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : ROUNDS;
  }

  private roundPhase: RoundPhase = 'countdown';
  private targetDirection: SwipeDirection = 'up';
  private countdownMs = 0;
  private responseMs = 0;
  private revealMs = 0;
  private goStartedAt = 0;
  private playerSwipes = new Map<string, { direction: SwipeDirection; timeMs: number }>();
  private currentRoundScores: Record<string, number> = {};

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.startCountdown();
    const state = this.buildState(this.makeData(), {});
    return { ...state, controllerLayout: LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'swipe') return;
    if (this.roundPhase !== 'go') return;
    if (this.playerSwipes.has(playerId)) return; // already swiped

    this.playerSwipes.set(playerId, {
      direction: input.direction as SwipeDirection,
      timeMs: Date.now() - this.goStartedAt,
    });

    // All players swiped — reveal early
    if (this.playerSwipes.size >= this.players.size) {
      this.startReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    switch (this.roundPhase) {
      case 'countdown':
        this.countdownMs -= deltaMs;
        if (this.countdownMs <= 0) this.startGo();
        break;
      case 'go':
        this.responseMs -= deltaMs;
        if (this.responseMs <= 0) this.startReveal();
        break;
      case 'reveal':
        this.revealMs -= deltaMs;
        if (this.revealMs <= 0) this.nextRound();
        break;
    }
    return this.buildState(this.makeData(), this.currentRoundScores);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startCountdown(): void {
    this.roundPhase = 'countdown';
    this.countdownMs = COUNTDOWN_MS;
    this.targetDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]!;
    this.playerSwipes = new Map();
    this.currentRoundScores = {};
    this.phase = 'active';
  }

  private startGo(): void {
    this.roundPhase = 'go';
    this.responseMs = RESPONSE_WINDOW_MS;
    this.goStartedAt = Date.now();
  }

  private startReveal(): void {
    this.roundPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    for (const id of this.players.keys()) {
      const swipe = this.playerSwipes.get(id);
      if (!swipe) {
        // Didn't swipe — no points
        continue;
      }
      if (swipe.direction === this.targetDirection) {
        // Correct — score based on speed
        const fraction = Math.max(0, 1 - swipe.timeMs / RESPONSE_WINDOW_MS);
        const pts = MIN_SCORE + Math.round((MAX_SCORE - MIN_SCORE) * fraction);
        this.currentRoundScores[id] = pts;
        this.addScore(id, pts);
      } else {
        // Wrong direction — penalty
        this.currentRoundScores[id] = -WRONG_PENALTY;
        this.addScore(id, -WRONG_PENALTY);
      }
    }
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startCountdown();
    }
  }

  private makeData(): SwipeDuelData {
    const correctPlayers: string[] = [];
    const wrongPlayers: string[] = [];
    const missedPlayers: string[] = [];

    if (this.roundPhase === 'reveal') {
      for (const id of this.players.keys()) {
        const swipe = this.playerSwipes.get(id);
        if (!swipe) {
          missedPlayers.push(id);
        } else if (swipe.direction === this.targetDirection) {
          correctPlayers.push(id);
        } else {
          wrongPlayers.push(id);
        }
      }
    }

    return {
      roundPhase: this.roundPhase,
      targetDirection: this.roundPhase === 'countdown' ? this.targetDirection : this.targetDirection,
      countdownMs: Math.max(0, this.countdownMs),
      responseMs: Math.max(0, this.responseMs),
      correctPlayers,
      wrongPlayers,
      missedPlayers,
      round: this.round,
      totalRounds: this.totalRounds,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'swipeduel',
    name: 'Swipe Duel',
    description: 'Swipe in the right direction as fast as you can!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  (config) => new SwipeDuelGame(config),
);
