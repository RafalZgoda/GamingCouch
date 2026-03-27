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

const DEFAULT_ROUNDS = 8;
const COUNTDOWN_MS = 5_000; // count down from 5
const GRACE_AFTER_MS = 2_000; // allow taps up to 2s after zero
const REVEAL_MS = 3_000;
const PERFECT_THRESHOLD_MS = 100; // within 100ms of zero = perfect
const GOOD_THRESHOLD_MS = 300;
const PERFECT_POINTS = 300;
const GOOD_POINTS = 200;
const OK_POINTS = 100;
const EARLY_PENALTY = -50;

// ── Controller layout ────────────────────────────────────────────────────────

const TAP_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'STOP!', color: '#ef4444', size: 'md', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface CountdownData {
  round: number;
  totalRounds: number;
  phase: 'counting' | 'reveal';
  countdownMs: number;
  playerTaps: Record<string, number>; // playerId -> offset from zero (negative = early, positive = late)
  tappedPlayerIds: string[];
  perfectPlayerIds: string[];
  revealResults: boolean;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class CountdownGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'countdown',
    name: 'Countdown',
    description: 'Press the button at exactly zero! Closest to zero wins. Precision is everything.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'counting' | 'reveal' = 'counting';
  private countdownMs = COUNTDOWN_MS;
  private graceMs = 0;
  private revealMs = 0;
  private playerTaps: Record<string, number> = {};
  private perfectPlayerIds: string[] = [];
  private countdownStartTime = 0;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = DEFAULT_ROUNDS;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: TAP_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (input.control !== 'A') return;
    if (this.subPhase !== 'counting') return;
    if (this.playerTaps[playerId] !== undefined) return;

    const elapsed = Date.now() - this.countdownStartTime;
    const offset = elapsed - COUNTDOWN_MS; // negative = early, positive = late

    this.playerTaps[playerId] = offset;

    const absOffset = Math.abs(offset);
    if (absOffset <= PERFECT_THRESHOLD_MS) {
      this.addScore(playerId, PERFECT_POINTS);
      this.perfectPlayerIds.push(playerId);
    } else if (absOffset <= GOOD_THRESHOLD_MS) {
      this.addScore(playerId, GOOD_POINTS);
    } else if (offset > 0 && offset <= GRACE_AFTER_MS) {
      this.addScore(playerId, OK_POINTS);
    } else if (offset < -1000) {
      // Very early penalty
      this.addScore(playerId, EARLY_PENALTY);
    }

    const allTapped = [...this.players.keys()].every((id) => this.playerTaps[id] !== undefined);
    if (allTapped) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'counting') {
      this.countdownMs -= deltaMs;

      // After zero, give grace period then auto-reveal
      if (this.countdownMs <= -GRACE_AFTER_MS) {
        this.goToReveal();
      }
      return this.buildState(this.makeData());
    }

    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      if (this.round >= this.totalRounds) {
        this.phase = 'results';
      } else {
        this.round++;
        this.startRound();
      }
    }
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.subPhase = 'counting';
    this.phase = 'active';
    this.playerTaps = {};
    this.perfectPlayerIds = [];
    this.countdownMs = COUNTDOWN_MS;
    this.countdownStartTime = Date.now();
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
  }

  private makeData(): CountdownData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      countdownMs: Math.max(-GRACE_AFTER_MS, this.countdownMs),
      playerTaps: isReveal ? { ...this.playerTaps } : {},
      tappedPlayerIds: Object.keys(this.playerTaps),
      perfectPlayerIds: isReveal ? [...this.perfectPlayerIds] : [],
      revealResults: isReveal,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'countdown',
    name: 'Countdown',
    description: 'Press the button at exactly zero! Closest to zero wins. Precision is everything.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new CountdownGame(),
);
