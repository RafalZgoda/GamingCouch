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

const DEFAULT_ROUNDS = 12;
const PICK_MS = 6_000;
const REVEAL_MS = 2_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

// ── Content generation ───────────────────────────────────────────────────────

interface MathPuzzle {
  question: string;
  correct: number;
  distractors: [number, number, number];
}

function generatePuzzles(): MathPuzzle[] {
  const puzzles: MathPuzzle[] = [];
  const ops = ['+', '-', '×'] as const;

  for (let i = 0; i < 30; i++) {
    const op = ops[i % 3]!;
    let a: number, b: number, answer: number;

    switch (op) {
      case '+':
        a = 10 + Math.floor(Math.random() * 90);
        b = 10 + Math.floor(Math.random() * 90);
        answer = a + b;
        break;
      case '-':
        a = 20 + Math.floor(Math.random() * 80);
        b = 5 + Math.floor(Math.random() * (a - 5));
        answer = a - b;
        break;
      case '×':
        a = 2 + Math.floor(Math.random() * 12);
        b = 2 + Math.floor(Math.random() * 12);
        answer = a * b;
        break;
    }

    const offsets = new Set<number>();
    while (offsets.size < 3) {
      const off = (Math.floor(Math.random() * 20) - 10) || 1;
      if (off !== 0 && !offsets.has(off)) offsets.add(off);
    }
    const distractors = [...offsets].map((o) => answer + o) as [number, number, number];

    puzzles.push({ question: `${a} ${op} ${b}`, correct: answer, distractors });
  }

  return puzzles;
}

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface SpeedMathData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  question: string;
  options: number[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SpeedMathGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'speedmath',
    name: 'Speed Math',
    description: 'Quick arithmetic! First to solve wins big.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private puzzles: MathPuzzle[] = [];
  private puzzleIdx = 0;
  private shuffledOptions: number[] = [];
  private correctIdx = -1;

  protected onInit(_players: Player[]): GameState {
    this.puzzles = generatePuzzles();
    this.totalRounds = Math.min(DEFAULT_ROUNDS, this.puzzles.length);
    this.puzzleIdx = 0;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerPicks[playerId] = idx;

    if (idx === this.correctIdx) {
      const elapsed = Date.now() - this.pickStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    }

    const allPicked = [...this.players.keys()].every((id) => this.playerPicks[id] !== undefined);
    if (allPicked) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'pick') {
      this.pickMs -= deltaMs;
      if (this.pickMs <= 0) this.goToReveal();
      return this.buildState(this.makeData());
    }

    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      if (this.round >= this.totalRounds) {
        this.phase = 'results';
      } else {
        this.round++;
        this.puzzleIdx++;
        this.startRound();
      }
    }
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.subPhase = 'pick';
    this.phase = 'active';
    this.playerPicks = {};
    this.pickMs = PICK_MS;
    this.pickStartTime = Date.now();

    const puzzle = this.puzzles[this.puzzleIdx]!;
    const allOptions = [puzzle.correct, ...puzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIdx = this.shuffledOptions.indexOf(puzzle.correct);
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
  }

  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private makeData(): SpeedMathData {
    const isReveal = this.subPhase === 'reveal';
    const puzzle = this.puzzles[this.puzzleIdx]!;
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      question: puzzle.question,
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'speedmath',
    name: 'Speed Math',
    description: 'Quick arithmetic! First to solve wins big.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SpeedMathGame(),
);
