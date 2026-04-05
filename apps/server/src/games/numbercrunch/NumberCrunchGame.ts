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
const PICK_MS = 8_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface MathPuzzle {
  target: number;
  correctExpr: string;
  distractors: [string, string, string];
  difficulty: 'easy' | 'medium' | 'hard';
}

const PUZZLES: MathPuzzle[] = [
  { target: 10, correctExpr: '7 + 3', distractors: ['8 + 3', '6 + 3', '5 + 4'], difficulty: 'easy' },
  { target: 15, correctExpr: '9 + 6', distractors: ['8 + 6', '9 + 5', '7 + 7'], difficulty: 'easy' },
  { target: 24, correctExpr: '8 × 3', distractors: ['6 × 3', '8 × 2', '7 × 3'], difficulty: 'easy' },
  { target: 12, correctExpr: '36 ÷ 3', distractors: ['36 ÷ 4', '24 ÷ 3', '36 ÷ 2'], difficulty: 'easy' },
  { target: 20, correctExpr: '4 × 5', distractors: ['4 × 6', '3 × 5', '5 × 5'], difficulty: 'easy' },
  { target: 42, correctExpr: '7 × 6', distractors: ['7 × 5', '6 × 6', '8 × 6'], difficulty: 'medium' },
  { target: 56, correctExpr: '8 × 7', distractors: ['9 × 7', '8 × 8', '7 × 7'], difficulty: 'medium' },
  { target: 100, correctExpr: '25 × 4', distractors: ['20 × 4', '25 × 5', '30 × 4'], difficulty: 'medium' },
  { target: 17, correctExpr: '23 - 6', distractors: ['24 - 6', '23 - 5', '22 - 6'], difficulty: 'medium' },
  { target: 45, correctExpr: '9 × 5', distractors: ['8 × 5', '9 × 4', '10 × 5'], difficulty: 'medium' },
  { target: 144, correctExpr: '12 × 12', distractors: ['11 × 12', '12 × 11', '13 × 12'], difficulty: 'hard' },
  { target: 81, correctExpr: '9 × 9', distractors: ['8 × 9', '9 × 8', '10 × 9'], difficulty: 'hard' },
  { target: 36, correctExpr: '72 ÷ 2', distractors: ['72 ÷ 3', '64 ÷ 2', '72 ÷ 4'], difficulty: 'medium' },
  { target: 50, correctExpr: '200 ÷ 4', distractors: ['200 ÷ 5', '150 ÷ 4', '200 ÷ 3'], difficulty: 'medium' },
  { target: 33, correctExpr: '99 ÷ 3', distractors: ['96 ÷ 3', '99 ÷ 4', '90 ÷ 3'], difficulty: 'medium' },
  { target: 7, correctExpr: '3 + 4', distractors: ['3 + 5', '2 + 4', '4 + 4'], difficulty: 'easy' },
  { target: 64, correctExpr: '8 × 8', distractors: ['7 × 8', '8 × 9', '9 × 8'], difficulty: 'medium' },
  { target: 30, correctExpr: '6 × 5', distractors: ['7 × 5', '6 × 6', '5 × 5'], difficulty: 'easy' },
  { target: 11, correctExpr: '33 ÷ 3', distractors: ['33 ÷ 2', '30 ÷ 3', '36 ÷ 3'], difficulty: 'medium' },
  { target: 72, correctExpr: '9 × 8', distractors: ['9 × 7', '8 × 8', '10 × 8'], difficulty: 'medium' },
  { target: 15, correctExpr: '45 ÷ 3', distractors: ['42 ÷ 3', '45 ÷ 5', '48 ÷ 3'], difficulty: 'medium' },
  { target: 90, correctExpr: '10 × 9', distractors: ['10 × 8', '9 × 9', '11 × 9'], difficulty: 'easy' },
  { target: 125, correctExpr: '5 × 25', distractors: ['5 × 20', '4 × 25', '5 × 30'], difficulty: 'hard' },
  { target: 48, correctExpr: '6 × 8', distractors: ['6 × 7', '7 × 8', '5 × 8'], difficulty: 'medium' },
  { target: 21, correctExpr: '7 × 3', distractors: ['8 × 3', '7 × 4', '6 × 3'], difficulty: 'easy' },
];

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

export interface NumberCrunchData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  target: number;
  difficulty: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  correctExpr: string | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class NumberCrunchGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'numbercrunch',
    name: 'Number Crunch',
    description: 'Which expression equals the target number? Think fast!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: MathPuzzle | null = null;
  private shuffledOptions: string[] = [];
  private correctIdx = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
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

    const available = PUZZLES.map((_, i) => i).filter((i) => !this.usedPuzzles.includes(i));
    const pool = available.length > 0 ? available : PUZZLES.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPuzzle = PUZZLES[idx]!;
    this.usedPuzzles.push(idx);

    const allOptions = [this.currentPuzzle.correctExpr, ...this.currentPuzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIdx = this.shuffledOptions.indexOf(this.currentPuzzle.correctExpr);
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

  private makeData(): NumberCrunchData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      target: this.currentPuzzle?.target ?? 0,
      difficulty: this.currentPuzzle?.difficulty ?? 'easy',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
      correctExpr: isReveal ? (this.currentPuzzle?.correctExpr ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'numbercrunch',
    name: 'Number Crunch',
    description: 'Which expression equals the target number? Think fast!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new NumberCrunchGame(),
);
