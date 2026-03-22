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

const ROUNDS = 12;
const SEQUENCE_SHOW_MS = 3_000;
const INPUT_WINDOW_MS = 5_000;
const REVEAL_MS = 2_500;
const POINTS_PER_CORRECT = 100;
const SPEED_BONUS_MAX = 200;

type Direction = 'up' | 'down' | 'left' | 'right';
const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right'];

// ── Controller layout ─────────────────────────────────────────────────────────

const LAYOUT: ControllerLayout = {
  controls: [
    { type: 'dpad', id: 'dpad', position: 'center' },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────

type RoundPhase = 'showing' | 'input' | 'reveal';

export interface DirectionDashData {
  roundPhase: RoundPhase;
  /** The sequence to memorize (shown during 'showing' phase) */
  sequence: Direction[];
  /** How many directions the player needs to input */
  sequenceLength: number;
  /** Timer for the showing phase */
  showTimeMs: number;
  /** Timer for the input phase */
  inputTimeMs: number;
  /** Per-player progress: how many correct so far */
  playerProgress: Record<string, number>;
  /** Per-player status during reveal */
  playerResults: Record<string, { correct: number; total: number; failed: boolean }>;
  round: number;
  totalRounds: number;
}

// ── Game implementation ───────────────────────────────────────────────────────

export class DirectionDashGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'directiondash',
    name: 'Direction Dash',
    description: 'Memorize the sequence and repeat it with the D-pad!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private readonly configRounds: number;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : ROUNDS;
  }

  private roundPhase: RoundPhase = 'showing';
  private sequence: Direction[] = [];
  private showTimeMs = 0;
  private inputTimeMs = 0;
  private revealMs = 0;
  private inputStartedAt = 0;
  // Per player: array of directions they've pressed so far
  private playerInputs = new Map<string, Direction[]>();
  // Per player: whether they've already failed (wrong direction)
  private playerFailed = new Map<string, boolean>();
  // Per player: when they completed (for speed bonus)
  private playerCompletedAt = new Map<string, number>();
  private currentRoundScores: Record<string, number> = {};

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.startShowing();
    const state = this.buildState(this.makeData(), {});
    return { ...state, controllerLayout: LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'dpad') return;
    if (input.direction === null) return; // release event
    if (this.roundPhase !== 'input') return;
    if (this.playerFailed.get(playerId)) return;
    if (this.playerCompletedAt.has(playerId)) return;

    const inputs = this.playerInputs.get(playerId) ?? [];
    const idx = inputs.length;

    if (idx >= this.sequence.length) return;

    if (input.direction === this.sequence[idx]) {
      inputs.push(input.direction);
      this.playerInputs.set(playerId, inputs);

      // Check if completed the full sequence
      if (inputs.length === this.sequence.length) {
        this.playerCompletedAt.set(playerId, Date.now() - this.inputStartedAt);
      }
    } else {
      // Wrong direction — mark as failed
      this.playerFailed.set(playerId, true);
    }

    // Check if all players are done (completed or failed)
    const allDone = [...this.players.keys()].every(
      (id) => this.playerCompletedAt.has(id) || this.playerFailed.get(id),
    );
    if (allDone) this.startReveal();
  }

  protected onTick(deltaMs: number): GameState {
    switch (this.roundPhase) {
      case 'showing':
        this.showTimeMs -= deltaMs;
        if (this.showTimeMs <= 0) this.startInput();
        break;
      case 'input':
        this.inputTimeMs -= deltaMs;
        if (this.inputTimeMs <= 0) this.startReveal();
        break;
      case 'reveal':
        this.revealMs -= deltaMs;
        if (this.revealMs <= 0) this.nextRound();
        break;
    }
    return this.buildState(this.makeData(), this.currentRoundScores);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private getSequenceLength(): number {
    // Start at 3, increase by 1 every 3 rounds, max 8
    return Math.min(8, 3 + Math.floor((this.round - 1) / 3));
  }

  private startShowing(): void {
    this.roundPhase = 'showing';
    const len = this.getSequenceLength();
    this.sequence = Array.from({ length: len }, () => ALL_DIRS[Math.floor(Math.random() * 4)]!);
    this.showTimeMs = SEQUENCE_SHOW_MS + (len - 3) * 500; // more time for longer sequences
    this.playerInputs = new Map();
    this.playerFailed = new Map();
    this.playerCompletedAt = new Map();
    this.currentRoundScores = {};
    this.phase = 'active';
  }

  private startInput(): void {
    this.roundPhase = 'input';
    this.inputTimeMs = INPUT_WINDOW_MS + (this.sequence.length - 3) * 500;
    this.inputStartedAt = Date.now();
  }

  private startReveal(): void {
    this.roundPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    for (const id of this.players.keys()) {
      const inputs = this.playerInputs.get(id) ?? [];
      const failed = this.playerFailed.get(id) ?? false;
      const completed = this.playerCompletedAt.has(id);

      if (completed) {
        // Full sequence correct — base points + speed bonus
        const timeMs = this.playerCompletedAt.get(id)!;
        const totalWindow = INPUT_WINDOW_MS + (this.sequence.length - 3) * 500;
        const speedFraction = Math.max(0, 1 - timeMs / totalWindow);
        const pts = this.sequence.length * POINTS_PER_CORRECT + Math.round(SPEED_BONUS_MAX * speedFraction);
        this.currentRoundScores[id] = pts;
        this.addScore(id, pts);
      } else if (!failed && inputs.length > 0) {
        // Partial correct (time ran out)
        const pts = inputs.length * POINTS_PER_CORRECT;
        this.currentRoundScores[id] = pts;
        this.addScore(id, pts);
      }
      // Failed or no input = 0 points
    }
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startShowing();
    }
  }

  private makeData(): DirectionDashData {
    const playerProgress: Record<string, number> = {};
    const playerResults: Record<string, { correct: number; total: number; failed: boolean }> = {};

    for (const id of this.players.keys()) {
      const inputs = this.playerInputs.get(id) ?? [];
      playerProgress[id] = inputs.length;

      if (this.roundPhase === 'reveal') {
        playerResults[id] = {
          correct: inputs.length,
          total: this.sequence.length,
          failed: this.playerFailed.get(id) ?? false,
        };
      }
    }

    return {
      roundPhase: this.roundPhase,
      sequence: this.roundPhase === 'showing' ? this.sequence : [],
      sequenceLength: this.sequence.length,
      showTimeMs: Math.max(0, this.showTimeMs),
      inputTimeMs: Math.max(0, this.inputTimeMs),
      playerProgress,
      playerResults,
      round: this.round,
      totalRounds: this.totalRounds,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'directiondash',
    name: 'Direction Dash',
    description: 'Memorize the sequence and repeat it with the D-pad!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  (config) => new DirectionDashGame(config),
);
