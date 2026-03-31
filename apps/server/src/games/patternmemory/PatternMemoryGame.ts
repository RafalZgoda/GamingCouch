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
const SHOW_MS_PER_STEP = 800;
const INPUT_MS = 6_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const PERFECT_BONUS = 100;
const STARTING_LENGTH = 3;

// ── Controller layout ────────────────────────────────────────────────────────

const INPUT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface PatternMemoryData {
  round: number;
  totalRounds: number;
  phase: 'show' | 'input' | 'reveal';
  sequence: string[]; // only sent during 'show' and 'reveal'
  sequenceLength: number;
  showIndex: number; // which step is currently highlighted (-1 if not showing)
  inputMs: number;
  submittedPlayerIds: string[];
  correctPlayerIds: string[];
  perfectPlayerIds: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class PatternMemoryGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'patternmemory',
    name: 'Pattern Memory',
    description: 'Watch the pattern, repeat it from memory! Sequences get longer each round.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'show' | 'input' | 'reveal' = 'show';
  private showMs = 0;
  private inputMs = 0;
  private revealMs = 0;
  private sequence: string[] = [];
  private showIndex = -1;
  private playerInputs: Record<string, string[]> = {};
  private correctPlayerIds: string[] = [];
  private perfectPlayerIds: string[] = [];

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = DEFAULT_ROUNDS;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: INPUT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'input') return;
    if (!['A', 'B', 'C', 'D'].includes(input.control)) return;

    // Already submitted full sequence
    if ((this.playerInputs[playerId]?.length ?? 0) >= this.sequence.length) return;

    if (!this.playerInputs[playerId]) this.playerInputs[playerId] = [];
    this.playerInputs[playerId]!.push(input.control);

    // Check if player completed their sequence
    if (this.playerInputs[playerId]!.length === this.sequence.length) {
      const playerSeq = this.playerInputs[playerId]!;
      let correctCount = 0;
      for (let i = 0; i < this.sequence.length; i++) {
        if (playerSeq[i] === this.sequence[i]) correctCount++;
      }

      if (correctCount === this.sequence.length) {
        this.correctPlayerIds.push(playerId);
        this.perfectPlayerIds.push(playerId);
        this.addScore(playerId, CORRECT_POINTS + PERFECT_BONUS);
      } else if (correctCount >= Math.ceil(this.sequence.length * 0.5)) {
        this.correctPlayerIds.push(playerId);
        this.addScore(playerId, CORRECT_POINTS);
      }

      // Check if all submitted
      const allDone = [...this.players.keys()].every(
        (id) => (this.playerInputs[id]?.length ?? 0) >= this.sequence.length
      );
      if (allDone) this.goToReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'show') {
      this.showMs -= deltaMs;
      if (this.showMs <= 0) {
        this.showIndex++;
        if (this.showIndex >= this.sequence.length) {
          // Done showing, switch to input
          this.subPhase = 'input';
          this.inputMs = INPUT_MS;
          this.showIndex = -1;
        } else {
          this.showMs = SHOW_MS_PER_STEP;
        }
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'input') {
      this.inputMs -= deltaMs;
      if (this.inputMs <= 0) this.goToReveal();
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
    this.subPhase = 'show';
    this.phase = 'active';
    this.playerInputs = {};
    this.correctPlayerIds = [];
    this.perfectPlayerIds = [];

    const seqLength = STARTING_LENGTH + (this.round - 1);
    const buttons = ['A', 'B', 'C', 'D'];
    this.sequence = [];
    for (let i = 0; i < seqLength; i++) {
      this.sequence.push(buttons[Math.floor(Math.random() * 4)]!);
    }

    this.showIndex = 0;
    this.showMs = SHOW_MS_PER_STEP;
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
  }

  private makeData(): PatternMemoryData {
    const isShow = this.subPhase === 'show';
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      sequence: (isShow || isReveal) ? [...this.sequence] : [],
      sequenceLength: this.sequence.length,
      showIndex: isShow ? this.showIndex : -1,
      inputMs: Math.max(0, this.inputMs),
      submittedPlayerIds: Object.entries(this.playerInputs)
        .filter(([_, inputs]) => inputs.length >= this.sequence.length)
        .map(([id]) => id),
      correctPlayerIds: isReveal ? [...this.correctPlayerIds] : [],
      perfectPlayerIds: isReveal ? [...this.perfectPlayerIds] : [],
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'patternmemory',
    name: 'Pattern Memory',
    description: 'Watch the pattern, repeat it from memory! Sequences get longer each round.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new PatternMemoryGame(),
);
