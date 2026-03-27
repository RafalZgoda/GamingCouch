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
const GUESS_MS = 10_000;
const REVEAL_MS = 4_000;
const EXACT_POINTS = 300;
const CLOSEST_POINTS = 200;
const SECOND_POINTS = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface GuessPuzzle {
  question: string;
  answer: number;
  unit: string;
  options: [number, number, number, number]; // 4 ranges, one is closest
  category: string;
  emoji: string;
}

const PUZZLES: GuessPuzzle[] = [
  { question: 'How many bones in an adult human body?', answer: 206, unit: '', options: [150, 206, 270, 350], category: 'Science', emoji: '🦴' },
  { question: 'Height of the Eiffel Tower in meters?', answer: 330, unit: 'm', options: [200, 280, 330, 410], category: 'Landmarks', emoji: '🗼' },
  { question: 'How many countries in Africa?', answer: 54, unit: '', options: [35, 44, 54, 67], category: 'Geography', emoji: '🌍' },
  { question: 'Speed of light in km/s (thousands)?', answer: 300, unit: 'k km/s', options: [150, 300, 500, 750], category: 'Science', emoji: '💡' },
  { question: 'Year the first iPhone was released?', answer: 2007, unit: '', options: [2004, 2007, 2009, 2011], category: 'Tech', emoji: '📱' },
  { question: 'Length of a marathon in km?', answer: 42, unit: 'km', options: [36, 42, 48, 55], category: 'Sports', emoji: '🏃' },
  { question: 'How many teeth does an adult have?', answer: 32, unit: '', options: [24, 28, 32, 36], category: 'Science', emoji: '🦷' },
  { question: 'Temperature of the surface of the Sun in °C?', answer: 5500, unit: '°C', options: [2500, 4000, 5500, 8000], category: 'Space', emoji: '☀️' },
  { question: 'How many keys on a standard piano?', answer: 88, unit: '', options: [66, 76, 88, 100], category: 'Music', emoji: '🎹' },
  { question: 'Population of Japan in millions?', answer: 125, unit: 'M', options: [85, 105, 125, 160], category: 'Geography', emoji: '🇯🇵' },
  { question: 'How many episodes of Friends were made?', answer: 236, unit: '', options: [180, 210, 236, 280], category: 'TV', emoji: '📺' },
  { question: 'Deepest point in the ocean in meters?', answer: 11034, unit: 'm', options: [7500, 9000, 11000, 14000], category: 'Geography', emoji: '🌊' },
  { question: 'How many Harry Potter books are there?', answer: 7, unit: '', options: [5, 6, 7, 8], category: 'Books', emoji: '📚' },
  { question: 'Year humans first landed on the Moon?', answer: 1969, unit: '', options: [1963, 1966, 1969, 1972], category: 'History', emoji: '🌙' },
  { question: 'How many stars on the US flag?', answer: 50, unit: '', options: [36, 42, 50, 52], category: 'General', emoji: '🇺🇸' },
  { question: 'Weight of a blue whale in tons?', answer: 150, unit: 't', options: [80, 120, 150, 200], category: 'Animals', emoji: '🐋' },
  { question: 'How many chromosomes do humans have?', answer: 46, unit: '', options: [32, 40, 46, 52], category: 'Science', emoji: '🧬' },
  { question: 'Distance from Earth to Moon in km (thousands)?', answer: 384, unit: 'k km', options: [200, 300, 384, 500], category: 'Space', emoji: '🌑' },
  { question: 'How many rings in the Olympic symbol?', answer: 5, unit: '', options: [3, 4, 5, 6], category: 'Sports', emoji: '🏅' },
  { question: 'Year Titanic sank?', answer: 1912, unit: '', options: [1905, 1912, 1918, 1923], category: 'History', emoji: '🚢' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const GUESS_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface ClosestGuessData {
  round: number;
  totalRounds: number;
  phase: 'guess' | 'reveal';
  question: string;
  emoji: string;
  category: string;
  unit: string;
  options: number[];
  guessMs: number;
  guessedPlayerIds: string[];
  correctAnswer: number | null;
  closestIndex: number | null;
  playerGuesses: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class ClosestGuessGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'closestguess',
    name: 'Closest Guess',
    description: 'Pick the number closest to the real answer! How well do you estimate?',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'guess' | 'reveal' = 'guess';
  private guessMs = 0;
  private revealMs = 0;
  private playerGuesses: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: GuessPuzzle | null = null;
  private shuffledOptions: number[] = [];
  private closestIndex = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: GUESS_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'guess') return;
    if (this.playerGuesses[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerGuesses[playerId] = idx;

    // Score based on distance ranking
    const picked = this.shuffledOptions[idx]!;
    const dist = Math.abs(picked - this.currentPuzzle!.answer);

    const sortedDists = [...this.shuffledOptions]
      .map((o) => Math.abs(o - this.currentPuzzle!.answer))
      .sort((a, b) => a - b);

    if (dist === sortedDists[0]) {
      this.addScore(playerId, picked === this.currentPuzzle!.answer ? EXACT_POINTS : CLOSEST_POINTS);
    } else if (dist === sortedDists[1]) {
      this.addScore(playerId, SECOND_POINTS);
    }

    const allGuessed = [...this.players.keys()].every((id) => this.playerGuesses[id] !== undefined);
    if (allGuessed) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'guess') {
      this.guessMs -= deltaMs;
      if (this.guessMs <= 0) this.goToReveal();
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
    this.subPhase = 'guess';
    this.phase = 'active';
    this.playerGuesses = {};
    this.guessMs = GUESS_MS;

    const available = PUZZLES.map((_, i) => i).filter((i) => !this.usedPuzzles.includes(i));
    const pool = available.length > 0 ? available : PUZZLES.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPuzzle = PUZZLES[idx]!;
    this.usedPuzzles.push(idx);

    this.shuffledOptions = this.shuffle([...this.currentPuzzle.options]);
    // Find closest option index
    let minDist = Infinity;
    this.closestIndex = 0;
    for (let i = 0; i < this.shuffledOptions.length; i++) {
      const d = Math.abs(this.shuffledOptions[i]! - this.currentPuzzle.answer);
      if (d < minDist) { minDist = d; this.closestIndex = i; }
    }
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

  private makeData(): ClosestGuessData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      question: this.currentPuzzle?.question ?? '',
      emoji: this.currentPuzzle?.emoji ?? '',
      category: this.currentPuzzle?.category ?? '',
      unit: this.currentPuzzle?.unit ?? '',
      options: [...this.shuffledOptions],
      guessMs: Math.max(0, this.guessMs),
      guessedPlayerIds: Object.keys(this.playerGuesses),
      correctAnswer: isReveal ? (this.currentPuzzle?.answer ?? null) : null,
      closestIndex: isReveal ? this.closestIndex : null,
      playerGuesses: isReveal ? { ...this.playerGuesses } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'closestguess',
    name: 'Closest Guess',
    description: 'Pick the number closest to the real answer! How well do you estimate?',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new ClosestGuessGame(),
);
