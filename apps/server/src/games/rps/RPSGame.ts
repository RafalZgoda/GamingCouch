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
const PICK_WINDOW_MS = 5_000;
const REVEAL_MS = 3_500;

type Move = 'rock' | 'paper' | 'scissors';

const MOVE_MAP: Record<string, Move> = { A: 'rock', B: 'paper', C: 'scissors' };
const MOVE_EMOJI: Record<Move, string> = { rock: '🪨', paper: '📄', scissors: '✂️' };

function beats(a: Move, b: Move): boolean {
  return (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper');
}

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '🪨 Rock', color: '#6b7280', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '📄 Paper', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '✂️ Scissors', color: '#ef4444', size: 'lg', position: 'bottom-left' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '⚔️', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface RPSData {
  round: number;
  totalRounds: number;
  pickWindowMs: number;
  pickedPlayerIds: string[];
  isReveal: boolean;
  choices: Record<string, Move>;
  results: Record<string, { wins: number; losses: number; draws: number }>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class RPSGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'rps',
    name: 'Rock Paper Scissors',
    description: 'Classic RPS — beat as many opponents as you can!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private pickWindowMs = PICK_WINDOW_MS;
  private revealMs = 0;
  private isReveal = false;
  private choices: Record<string, Move> = {};
  private results: Record<string, { wins: number; losses: number; draws: number }> = {};
  private lastPhase: 'pick' | 'reveal' | null = null;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isReveal) return;
    const move = MOVE_MAP[input.control];
    if (!move) return;
    this.choices[playerId] = move;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isReveal) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.emitState();
    }

    this.pickWindowMs -= deltaMs;
    const allPicked = [...this.players.keys()].every((id) => this.choices[id] !== undefined);
    if (this.pickWindowMs <= 0 || allPicked) {
      this.resolveRound();
    }

    return this.emitState();
  }

  private startRound(): void {
    this.pickWindowMs = PICK_WINDOW_MS;
    this.isReveal = false;
    this.choices = {};
    this.results = {};
    this.phase = 'active';
    this.lastPhase = null;
  }

  private resolveRound(): void {
    this.isReveal = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.lastPhase = null;

    const playerIds = [...this.players.keys()];

    // Assign random move to players who didn't pick
    for (const id of playerIds) {
      if (!this.choices[id]) {
        const moves: Move[] = ['rock', 'paper', 'scissors'];
        this.choices[id] = moves[Math.floor(Math.random() * 3)]!;
      }
    }

    // Calculate results
    for (const id of playerIds) {
      let wins = 0, losses = 0, draws = 0;
      const myMove = this.choices[id]!;
      for (const otherId of playerIds) {
        if (otherId === id) continue;
        const otherMove = this.choices[otherId]!;
        if (beats(myMove, otherMove)) wins++;
        else if (beats(otherMove, myMove)) losses++;
        else draws++;
      }
      this.results[id] = { wins, losses, draws };
      // 100 points per opponent beaten
      if (wins > 0) {
        this.addScore(id, wins * 100);
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

  private emitState(): GameState {
    const data = this.makeData();
    const state = this.buildState(data);
    const currentPhase = this.isReveal ? 'reveal' as const : 'pick' as const;
    if (currentPhase !== this.lastPhase) {
      this.lastPhase = currentPhase;
      return { ...state, controllerLayout: this.isReveal ? WAIT_LAYOUT : PICK_LAYOUT };
    }
    return state;
  }

  private makeData(): RPSData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      pickWindowMs: Math.max(0, this.pickWindowMs),
      pickedPlayerIds: Object.keys(this.choices),
      isReveal: this.isReveal,
      choices: this.isReveal ? { ...this.choices } : {},
      results: this.isReveal ? { ...this.results } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'rps',
    name: 'Rock Paper Scissors',
    description: 'Classic RPS — beat as many opponents as you can!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new RPSGame(config),
);
