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

const ROUNDS = 8;
const WAIT_MIN_MS = 1_500;
const WAIT_MAX_MS = 3_500;
const GO_WINDOW_MS = 2_500;   // players have this long to tap once signal is green
const REVEAL_MS = 2_500;      // show results before next round
const MAX_SCORE = 1_000;
const MIN_SCORE = 200;        // awarded for any tap within the go window
const EARLY_PENALTY = 100;    // deducted for tapping too early

// ── Controller layouts ────────────────────────────────────────────────────────

function makeLayout(signal: 'waiting' | 'go'): ControllerLayout {
  const color = signal === 'go' ? '#22c55e' : '#ef4444';
  const label = signal === 'go' ? 'TAP!' : 'WAIT';
  return {
    controls: [
      { type: 'button', id: 'TAP', label, color, size: 'lg', position: 'center' },
    ],
  };
}

// ── Public state shape ────────────────────────────────────────────────────────

export interface ReactionData {
  signal: 'waiting' | 'go';
  /** Countdown remaining before go (waiting phase) */
  waitRemainingMs: number;
  /** Time remaining in the go window */
  goRemainingMs: number;
  round: number;
  totalRounds: number;
  /** playerId → reaction time ms (only populated during round_end) */
  playerTaps: Record<string, number>;
  /** Players who tapped before the signal — shown during round_end */
  earlyTappers: string[];
}

// ── Game implementation ───────────────────────────────────────────────────────

export class ReactionGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'reaction',
    name: 'Reaction',
    description: 'Tap as fast as possible when the signal turns green!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private readonly configRounds: number;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(3, Math.round(r))) : ROUNDS;
  }

  private signal: 'waiting' | 'go' = 'waiting';
  private waitMs = 0;
  private goMs = 0;
  private revealMs = 0;
  private isRevealing = false;
  private goStartedAt = 0;
  // playerId → reaction time ms; -1 = early tap
  private roundTaps = new Map<string, number>();
  private currentRoundScores: Record<string, number> = {};
  private lastLayout: 'waiting' | 'go' | null = null;

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.startWaiting();
    return this.currentState(true);
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down' || input.control !== 'TAP') return;
    if (this.isRevealing) return;

    if (this.signal === 'waiting') {
      // Early tap — penalty
      if (!this.roundTaps.has(playerId)) {
        this.roundTaps.set(playerId, -1);
        this.addScore(playerId, -EARLY_PENALTY);
      }
    } else if (this.signal === 'go') {
      // Valid tap
      if (!this.roundTaps.has(playerId)) {
        const reactionMs = Date.now() - this.goStartedAt;
        this.roundTaps.set(playerId, reactionMs);
        // All players tapped — reveal early
        const nonEarlyExpected = [...this.players.keys()].filter(
          (id) => this.roundTaps.get(id) !== -1 || !this.roundTaps.has(id),
        );
        const allTapped = [...this.players.keys()].every((id) => this.roundTaps.has(id));
        if (allTapped) this.startReveal();
      }
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.currentState(false);
    }

    if (this.signal === 'waiting') {
      this.waitMs -= deltaMs;
      if (this.waitMs <= 0) this.startGo();
    } else {
      this.goMs -= deltaMs;
      if (this.goMs <= 0) this.startReveal();
    }

    return this.currentState(false);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startWaiting(): void {
    this.signal = 'waiting';
    this.waitMs = WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
    this.goMs = 0;
    this.revealMs = 0;
    this.isRevealing = false;
    this.roundTaps = new Map();
    this.currentRoundScores = {};
    this.phase = 'active';
  }

  private startGo(): void {
    this.signal = 'go';
    this.goMs = GO_WINDOW_MS;
    this.goStartedAt = Date.now();
  }

  private startReveal(): void {
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    // Score valid taps
    const validTaps: Array<{ playerId: string; ms: number }> = [];
    for (const [playerId, ms] of this.roundTaps) {
      if (ms >= 0) validTaps.push({ playerId, ms });
    }
    validTaps.sort((a, b) => a.ms - b.ms);

    for (const { playerId, ms } of validTaps) {
      const fraction = Math.max(0, 1 - ms / GO_WINDOW_MS);
      const pts = MIN_SCORE + Math.round((MAX_SCORE - MIN_SCORE) * fraction);
      this.currentRoundScores[playerId] = pts;
      this.addScore(playerId, pts);
    }
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startWaiting();
    }
  }

  private currentState(forceLayoutUpdate: boolean): GameState {
    const signalChanged = this.signal !== this.lastLayout;
    const emitLayout = forceLayoutUpdate || signalChanged;
    if (emitLayout) this.lastLayout = this.signal;

    const playerTaps: Record<string, number> = {};
    const earlyTappers: string[] = [];
    if (this.isRevealing) {
      for (const [id, ms] of this.roundTaps) {
        if (ms >= 0) {
          playerTaps[id] = ms;
        } else {
          earlyTappers.push(id);
        }
      }
    }

    const data: ReactionData = {
      signal: this.signal,
      waitRemainingMs: Math.max(0, this.waitMs),
      goRemainingMs: Math.max(0, this.goMs),
      round: this.round,
      totalRounds: this.totalRounds,
      playerTaps,
      earlyTappers,
    };

    const state = this.buildState(data, this.currentRoundScores);
    if (emitLayout) {
      return { ...state, controllerLayout: makeLayout(this.signal) };
    }
    return state;
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'reaction',
    name: 'Reaction',
    description: 'Tap as fast as possible when the signal turns green!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  (config) => new ReactionGame(config),
);
