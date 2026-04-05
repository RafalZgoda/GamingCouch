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
const PICK_MS = 12_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 300;
const SPEED_BONUS_MAX = 200;

// ── Content ──────────────────────────────────────────────────────────────────

interface EmojiMathPuzzle {
  clues: string[];       // e.g. ["🍎 + 🍎 = 6", "🍎 + 🍌 = 8"]
  question: string;      // e.g. "🍌 = ?"
  answer: number;
  options: [number, number, number, number];
  correctIndex: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

const PUZZLES: EmojiMathPuzzle[] = [
  { clues: ['🍎 + 🍎 = 6'], question: '🍎 = ?', answer: 3, options: [2, 3, 4, 6], correctIndex: 1, difficulty: 'easy' },
  { clues: ['🐱 + 🐱 + 🐱 = 12'], question: '🐱 = ?', answer: 4, options: [3, 4, 6, 12], correctIndex: 1, difficulty: 'easy' },
  { clues: ['🍎 + 🍎 = 10', '🍎 + 🍌 = 8'], question: '🍌 = ?', answer: 3, options: [2, 3, 5, 8], correctIndex: 1, difficulty: 'easy' },
  { clues: ['⭐ + ⭐ = 14', '⭐ + 🌙 = 10'], question: '🌙 = ?', answer: 3, options: [3, 4, 7, 10], correctIndex: 0, difficulty: 'easy' },
  { clues: ['🍕 × 2 = 16'], question: '🍕 = ?', answer: 8, options: [4, 6, 8, 16], correctIndex: 2, difficulty: 'easy' },
  { clues: ['🎈 + 🎈 + 🎈 = 15', '🎈 + 🎁 = 9'], question: '🎁 = ?', answer: 4, options: [3, 4, 5, 6], correctIndex: 1, difficulty: 'medium' },
  { clues: ['🐶 + 🐱 = 10', '🐶 - 🐱 = 4'], question: '🐶 = ?', answer: 7, options: [5, 6, 7, 8], correctIndex: 2, difficulty: 'medium' },
  { clues: ['🌸 × 🌸 = 9'], question: '🌸 = ?', answer: 3, options: [2, 3, 4, 9], correctIndex: 1, difficulty: 'medium' },
  { clues: ['🍩 + 🍩 = 8', '🍩 + 🧁 = 7'], question: '🧁 = ?', answer: 3, options: [2, 3, 4, 7], correctIndex: 1, difficulty: 'easy' },
  { clues: ['🚗 + 🚗 + 🚗 = 21', '🚗 + 🚌 = 12'], question: '🚌 = ?', answer: 5, options: [3, 5, 7, 9], correctIndex: 1, difficulty: 'medium' },
  { clues: ['💎 × 3 = 27'], question: '💎 = ?', answer: 9, options: [7, 8, 9, 12], correctIndex: 2, difficulty: 'easy' },
  { clues: ['🎵 + 🎵 = 12', '🎵 × 🎸 = 18'], question: '🎸 = ?', answer: 3, options: [2, 3, 6, 9], correctIndex: 1, difficulty: 'medium' },
  { clues: ['🍓 + 🍇 = 11', '🍓 × 2 = 14'], question: '🍇 = ?', answer: 4, options: [3, 4, 5, 7], correctIndex: 1, difficulty: 'medium' },
  { clues: ['🦊 + 🐰 + 🐻 = 18', '🦊 = 🐰 = 🐻'], question: '🦊 = ?', answer: 6, options: [4, 5, 6, 9], correctIndex: 2, difficulty: 'easy' },
  { clues: ['🍋 + 🍊 = 9', '🍋 + 🍋 + 🍊 = 13'], question: '🍋 = ?', answer: 4, options: [3, 4, 5, 6], correctIndex: 1, difficulty: 'medium' },
  { clues: ['🎯 × 🎯 = 25'], question: '🎯 = ?', answer: 5, options: [4, 5, 6, 12], correctIndex: 1, difficulty: 'medium' },
  { clues: ['🌈 + 🌈 = 16', '🌈 + ☀️ + ☀️ = 14'], question: '☀️ = ?', answer: 3, options: [2, 3, 4, 6], correctIndex: 1, difficulty: 'hard' },
  { clues: ['🎲 + 🎲 + 🎲 + 🎲 = 20'], question: '🎲 = ?', answer: 5, options: [4, 5, 6, 10], correctIndex: 1, difficulty: 'easy' },
  { clues: ['🐸 + 🐸 = 10', '🐸 + 🦋 = 8', '🦋 + 🌻 = 7'], question: '🌻 = ?', answer: 4, options: [2, 3, 4, 5], correctIndex: 2, difficulty: 'hard' },
  { clues: ['🏀 + 🏀 = 18', '🏀 - ⚽ = 3'], question: '⚽ = ?', answer: 6, options: [3, 5, 6, 9], correctIndex: 2, difficulty: 'medium' },
  { clues: ['🍉 + 🍉 + 🍉 = 24', '🍉 + 🥝 = 11'], question: '🥝 = ?', answer: 3, options: [2, 3, 4, 8], correctIndex: 1, difficulty: 'medium' },
  { clues: ['🔥 × 4 = 28'], question: '🔥 = ?', answer: 7, options: [5, 6, 7, 8], correctIndex: 2, difficulty: 'easy' },
  { clues: ['🐙 + 🐙 = 16', '🐙 × 🐟 = 24'], question: '🐟 = ?', answer: 3, options: [2, 3, 4, 6], correctIndex: 1, difficulty: 'hard' },
  { clues: ['🌺 + 🌺 + 🌺 = 9', '🌺 + 🍀 + 🍀 = 11'], question: '🍀 = ?', answer: 4, options: [3, 4, 5, 6], correctIndex: 1, difficulty: 'medium' },
  { clues: ['💡 + 💡 = 20', '💡 - 🔋 = 2'], question: '🔋 = ?', answer: 8, options: [6, 7, 8, 10], correctIndex: 2, difficulty: 'medium' },
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

export interface EmojiMathData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  clues: string[];
  question: string;
  difficulty: string;
  options: number[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  correctAnswer: number | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class EmojiMathGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'emojimath',
    name: 'Emoji Math',
    description: 'Solve the emoji algebra puzzle!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: EmojiMathPuzzle | null = null;

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

    if (this.currentPuzzle && idx === this.currentPuzzle.correctIndex) {
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
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
  }

  private makeData(): EmojiMathData {
    const isReveal = this.subPhase === 'reveal';
    const puzzle = this.currentPuzzle;
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      clues: puzzle ? [...puzzle.clues] : [],
      question: puzzle?.question ?? '',
      difficulty: puzzle?.difficulty ?? 'easy',
      options: puzzle ? [...puzzle.options] : [],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? (puzzle?.correctIndex ?? null) : null,
      correctAnswer: isReveal ? (puzzle?.answer ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'emojimath',
    name: 'Emoji Math',
    description: 'Solve the emoji algebra puzzle!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new EmojiMathGame(),
);
