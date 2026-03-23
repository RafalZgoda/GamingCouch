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

const DEFAULT_ROUNDS = 10;
const PICK_WINDOW_MS = 8_000;
const SPIN_MS = 4_000;

const CHOICES = ['A', 'B', 'C', 'D'] as const;
const CHOICE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'] as const;
const CHOICE_LABELS = ['1', '2', '3', '4'] as const;

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '1', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '2', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '3', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '4', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '🎰', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public state shape ───────────────────────────────────────────────────────

export interface LuckyNumberData {
  pickWindowMs: number;
  pickedPlayerIds: string[];
  round: number;
  totalRounds: number;
  isSpinning: boolean;
  spinMs: number;
  winningChoice: string | null;       // 'A' | 'B' | 'C' | 'D' during reveal
  winningNumber: number | null;       // 1-4 during reveal
  playerPicks: Record<string, string>; // playerId → 'A'|'B'|'C'|'D' (only during reveal)
  winners: string[];                   // playerIds who matched (during reveal)
  streaks: Record<string, number>;     // consecutive win streaks per player
}

// ── Game implementation ──────────────────────────────────────────────────────

export class LuckyNumberGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'luckynumber',
    name: 'Lucky Number',
    description: 'Pick a number, spin the wheel — match it and score big!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private pickWindowMs = PICK_WINDOW_MS;
  private spinMs = 0;
  private isSpinning = false;
  private picks: Record<string, string> = {}; // playerId → 'A'|'B'|'C'|'D'
  private winningChoice: string | null = null;
  private winners: string[] = [];
  private streaks: Record<string, number> = {};
  private lastLayoutPhase: 'pick' | 'wait' | null = null;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(30, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    for (const id of this.players.keys()) {
      this.streaks[id] = 0;
    }
    this.startRound();
    return this.currentState(true);
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isSpinning) return;
    const choice = input.control;
    if (choice !== 'A' && choice !== 'B' && choice !== 'C' && choice !== 'D') return;
    // Allow changing pick during the window
    this.picks[playerId] = choice;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isSpinning) {
      this.spinMs -= deltaMs;
      if (this.spinMs <= 0) this.nextRound();
      return this.currentState(false);
    }

    this.pickWindowMs -= deltaMs;

    // End early if everyone picked
    const allPicked = [...this.players.keys()].every((id) => this.picks[id] !== undefined);
    if (this.pickWindowMs <= 0 || allPicked) {
      this.startSpin();
    }

    return this.currentState(false);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startRound(): void {
    this.pickWindowMs = PICK_WINDOW_MS;
    this.spinMs = 0;
    this.isSpinning = false;
    this.picks = {};
    this.winningChoice = null;
    this.winners = [];
    this.phase = 'active';
    this.lastLayoutPhase = null;
  }

  private startSpin(): void {
    this.isSpinning = true;
    this.spinMs = SPIN_MS;
    this.phase = 'round_end';
    this.lastLayoutPhase = null;

    // Pick the winning number randomly
    const winIdx = Math.floor(Math.random() * 4);
    this.winningChoice = CHOICES[winIdx]!;

    // Score players
    const playerIds = [...this.players.keys()];
    this.winners = [];

    for (const id of playerIds) {
      const pick = this.picks[id];
      if (!pick) {
        // Didn't pick — reset streak
        this.streaks[id] = 0;
        continue;
      }

      if (pick === this.winningChoice) {
        // Winner!
        this.streaks[id] = (this.streaks[id] ?? 0) + 1;
        const streak = this.streaks[id];
        let points = 400;
        if (streak >= 3) points += 500;       // Hot streak bonus
        else if (streak === 2) points += 200; // Double bonus
        this.addScore(id, points);
        this.winners.push(id);
      } else {
        // Wrong pick — reset streak
        this.streaks[id] = 0;
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

  private currentState(forceLayoutUpdate: boolean): GameState {
    const targetPhase = this.isSpinning ? 'wait' as const : 'pick' as const;
    const layoutChanged = targetPhase !== this.lastLayoutPhase;
    const emitLayout = forceLayoutUpdate || layoutChanged;
    if (emitLayout) this.lastLayoutPhase = targetPhase;

    const playerIds = [...this.players.keys()];

    const data: LuckyNumberData = {
      pickWindowMs: Math.max(0, this.pickWindowMs),
      pickedPlayerIds: playerIds.filter((id) => this.picks[id] !== undefined),
      round: this.round,
      totalRounds: this.totalRounds,
      isSpinning: this.isSpinning,
      spinMs: Math.max(0, this.spinMs),
      winningChoice: this.isSpinning ? this.winningChoice : null,
      winningNumber: this.isSpinning && this.winningChoice
        ? CHOICES.indexOf(this.winningChoice as typeof CHOICES[number]) + 1
        : null,
      playerPicks: this.isSpinning ? { ...this.picks } : {},
      winners: this.isSpinning ? [...this.winners] : [],
      streaks: { ...this.streaks },
    };

    const state = this.buildState(data);
    if (emitLayout) {
      return { ...state, controllerLayout: this.isSpinning ? WAIT_LAYOUT : PICK_LAYOUT };
    }
    return state;
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'luckynumber',
    name: 'Lucky Number',
    description: 'Pick a number, spin the wheel — match it and score big!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new LuckyNumberGame(config),
);
