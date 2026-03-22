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
const TIME_MS = 10_000;   // 10 s per question
const REVEAL_MS = 3_000;
const BASE_POINTS = 800;
const SPEED_BONUS = 400;

// ── Question generation ───────────────────────────────────────────────────────

interface MathQuestion {
  display: string;   // e.g. "7 × 8 = ?"
  options: string[]; // exactly 4
  correctIndex: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Build 4 choices where exactly one is correct, others are plausible distractors. */
function buildChoices(correct: number): { options: string[]; correctIndex: number } {
  const deltas = [1, 2, 3, 4, 5, 7, 9, 10, 11, 13].sort(() => Math.random() - 0.5);
  const wrong = new Set<number>();
  for (const d of deltas) {
    if (wrong.size >= 3) break;
    const w1 = correct + d;
    const w2 = correct - d;
    if (w1 !== correct && w1 > 0) wrong.add(w1);
    if (wrong.size < 3 && w2 !== correct && w2 > 0) wrong.add(w2);
  }
  while (wrong.size < 3) {
    const w = correct + rand(1, 20);
    if (w !== correct) wrong.add(w);
  }
  const all = shuffle([correct, ...[...wrong].slice(0, 3)]);
  return { options: all.map(String), correctIndex: all.indexOf(correct) };
}

function generateQuestion(): MathQuestion {
  const type = rand(0, 2); // 0=add, 1=sub, 2=mul

  let display: string;
  let correct: number;
  let difficulty: MathQuestion['difficulty'];

  if (type === 0) {
    const a = rand(10, 99);
    const b = rand(10, 99);
    correct = a + b;
    display = `${a} + ${b} = ?`;
    difficulty = 'easy';
  } else if (type === 1) {
    const a = rand(20, 99);
    const b = rand(1, a);
    correct = a - b;
    display = `${a} − ${b} = ?`;
    difficulty = 'easy';
  } else {
    // multiplication: mix of easy and harder
    const tier = rand(0, 2);
    if (tier === 0) {
      const a = rand(2, 9);
      const b = rand(2, 9);
      correct = a * b;
      display = `${a} × ${b} = ?`;
      difficulty = 'easy';
    } else if (tier === 1) {
      const a = rand(6, 15);
      const b = rand(6, 12);
      correct = a * b;
      display = `${a} × ${b} = ?`;
      difficulty = 'medium';
    } else {
      const a = rand(12, 25);
      const b = rand(12, 20);
      correct = a * b;
      display = `${a} × ${b} = ?`;
      difficulty = 'hard';
    }
  }

  const { options, correctIndex } = buildChoices(correct);
  return { display, options, correctIndex, difficulty };
}

// ── Controller layout ─────────────────────────────────────────────────────────

const MATHRACE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

// ── Public state shape ────────────────────────────────────────────────────────

export interface MathRaceData {
  equation: string;
  options: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  questionIndex: number;
  totalQuestions: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  /** Only during round_end */
  correctAnswer?: number;
  playerAnswers?: Record<string, number>;
}

// ── Game implementation ───────────────────────────────────────────────────────

export class MathRaceGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'mathrace',
    name: 'Math Race',
    description: 'Solve math equations faster than your opponents!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private questions: MathQuestion[] = [];
  private currentIndex = 0;
  private timerMs = 0;
  private revealMs = 0;
  private isRevealing = false;
  private playerAnswers = new Map<string, number>();
  private answerTimestamps = new Map<string, number>();
  private questionStartMs = 0;
  private currentRoundScores: Record<string, number> = {};

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.questions = Array.from({ length: ROUNDS }, generateQuestion);
    this.totalRounds = ROUNDS;
    this.currentIndex = 0;
    this.startQuestion();
    return this.currentState();
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (this.phase !== 'active') return;
    if (this.playerAnswers.has(playerId)) return;
    if (input.action !== 'button_down') return;

    const answerMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const idx = answerMap[input.control];
    if (idx === undefined) return;

    const elapsed = Date.now() - this.questionStartMs;
    this.playerAnswers.set(playerId, idx);
    this.answerTimestamps.set(playerId, elapsed);

    if (this.playerAnswers.size >= this.players.size) {
      this.startReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.advanceQuestion();
    } else if (this.phase === 'active') {
      this.timerMs -= deltaMs;
      if (this.timerMs <= 0) {
        this.timerMs = 0;
        this.startReveal();
      }
    }
    return this.currentState();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startQuestion(): void {
    this.timerMs = TIME_MS;
    this.revealMs = 0;
    this.isRevealing = false;
    this.playerAnswers = new Map();
    this.answerTimestamps = new Map();
    this.questionStartMs = Date.now();
    this.currentRoundScores = {};
    this.phase = 'active';
    this.round = this.currentIndex + 1;
  }

  private startReveal(): void {
    const q = this.questions[this.currentIndex]!;
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    const difficultyMultiplier = q.difficulty === 'hard' ? 1.5 : q.difficulty === 'medium' ? 1.2 : 1;

    for (const [playerId, answerIdx] of this.playerAnswers) {
      if (answerIdx === q.correctIndex) {
        const elapsed = this.answerTimestamps.get(playerId) ?? TIME_MS;
        const speedFraction = Math.max(0, 1 - elapsed / TIME_MS);
        const pts = Math.round((BASE_POINTS + SPEED_BONUS * speedFraction) * difficultyMultiplier);
        this.currentRoundScores[playerId] = pts;
        this.addScore(playerId, pts);
      }
    }
  }

  private advanceQuestion(): void {
    this.currentIndex++;
    if (this.currentIndex >= this.questions.length) {
      this.phase = 'results';
    } else {
      this.startQuestion();
    }
  }

  private currentState(): GameState {
    const q = this.questions[this.currentIndex];

    const data: MathRaceData = q
      ? {
          equation: q.display,
          options: q.options,
          difficulty: q.difficulty,
          questionIndex: this.currentIndex,
          totalQuestions: this.questions.length,
          timeRemainingMs: Math.max(0, this.timerMs),
          answeredPlayerIds: [...this.playerAnswers.keys()],
          ...(this.isRevealing && {
            correctAnswer: q.correctIndex,
            playerAnswers: Object.fromEntries(this.playerAnswers),
          }),
        }
      : {
          equation: '',
          options: [],
          difficulty: 'easy' as const,
          questionIndex: this.currentIndex,
          totalQuestions: this.questions.length,
          timeRemainingMs: 0,
          answeredPlayerIds: [],
        };

    return {
      ...this.buildState(data, this.currentRoundScores),
      controllerLayout: MATHRACE_LAYOUT,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'mathrace',
    name: 'Math Race',
    description: 'Solve math equations faster than your opponents!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  () => new MathRaceGame(),
);
