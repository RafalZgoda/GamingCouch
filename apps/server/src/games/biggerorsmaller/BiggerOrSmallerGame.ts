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
const PICK_MS = 7_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface SizePuzzle {
  itemA: string;
  valueA: number;
  itemB: string;
  valueB: number;
  unit: string;
  category: string;
  correctAnswer: 'A' | 'B';
}

const PUZZLES: SizePuzzle[] = [
  { itemA: 'Height of Eiffel Tower', valueA: 330, itemB: 'Height of Statue of Liberty', valueB: 93, unit: 'meters', category: 'Landmarks', correctAnswer: 'A' },
  { itemA: 'Population of Tokyo', valueA: 14000000, itemB: 'Population of New York', valueB: 8300000, unit: 'people', category: 'Cities', correctAnswer: 'A' },
  { itemA: 'Speed of cheetah', valueA: 120, itemB: 'Speed of horse', valueB: 70, unit: 'km/h', category: 'Animals', correctAnswer: 'A' },
  { itemA: 'Length of Amazon River', valueA: 6400, itemB: 'Length of Nile River', valueB: 6650, unit: 'km', category: 'Nature', correctAnswer: 'B' },
  { itemA: 'Weight of blue whale', valueA: 150000, itemB: 'Weight of elephant', valueB: 6000, unit: 'kg', category: 'Animals', correctAnswer: 'A' },
  { itemA: 'Distance Earth to Moon', valueA: 384400, itemB: 'Distance Earth to Sun', valueB: 149600000, unit: 'km', category: 'Space', correctAnswer: 'B' },
  { itemA: 'Age of Great Wall of China', valueA: 2300, itemB: 'Age of Colosseum', valueB: 1950, unit: 'years', category: 'History', correctAnswer: 'A' },
  { itemA: 'Calories in a banana', valueA: 105, itemB: 'Calories in an apple', valueB: 95, unit: 'kcal', category: 'Food', correctAnswer: 'A' },
  { itemA: 'Number of bones in human body', valueA: 206, itemB: 'Number of muscles in human body', valueB: 600, unit: '', category: 'Body', correctAnswer: 'B' },
  { itemA: 'Boiling point of water', valueA: 100, itemB: 'Melting point of gold', valueB: 1064, unit: '°C', category: 'Science', correctAnswer: 'B' },
  { itemA: 'Countries in Africa', valueA: 54, itemB: 'Countries in Europe', valueB: 44, unit: 'countries', category: 'Geography', correctAnswer: 'A' },
  { itemA: 'Keys on a piano', valueA: 88, itemB: 'Strings on a guitar', valueB: 6, unit: '', category: 'Music', correctAnswer: 'A' },
  { itemA: 'Episodes of The Simpsons', valueA: 750, itemB: 'Episodes of Friends', valueB: 236, unit: 'episodes', category: 'TV', correctAnswer: 'A' },
  { itemA: 'Wingspan of albatross', valueA: 350, itemB: 'Wingspan of eagle', valueB: 230, unit: 'cm', category: 'Animals', correctAnswer: 'A' },
  { itemA: 'Depth of Mariana Trench', valueA: 11034, itemB: 'Height of Mount Everest', valueB: 8849, unit: 'meters', category: 'Nature', correctAnswer: 'A' },
  { itemA: 'Letters in Hawaiian alphabet', valueA: 13, itemB: 'Letters in English alphabet', valueB: 26, unit: 'letters', category: 'Language', correctAnswer: 'B' },
  { itemA: 'FIFA World Cups held', valueA: 22, itemB: 'Summer Olympics held', valueB: 33, unit: 'events', category: 'Sports', correctAnswer: 'B' },
  { itemA: 'Teeth in adult human', valueA: 32, itemB: 'Teeth in adult dog', valueB: 42, unit: 'teeth', category: 'Body', correctAnswer: 'B' },
  { itemA: 'Speed of sound', valueA: 1235, itemB: 'Speed of light', valueB: 1079000000, unit: 'km/h', category: 'Science', correctAnswer: 'B' },
  { itemA: 'Harry Potter books', valueA: 7, itemB: 'Lord of the Rings books', valueB: 3, unit: 'books', category: 'Books', correctAnswer: 'A' },
  { itemA: 'Floors in Empire State Building', valueA: 102, itemB: 'Floors in Burj Khalifa', valueB: 163, unit: 'floors', category: 'Buildings', correctAnswer: 'B' },
  { itemA: 'Stars on US flag', valueA: 50, itemB: 'Stars on EU flag', valueB: 12, unit: 'stars', category: 'Flags', correctAnswer: 'A' },
  { itemA: 'Age of a cat in human years (10yo cat)', valueA: 56, itemB: 'Age of a dog in human years (10yo dog)', valueB: 70, unit: 'human years', category: 'Animals', correctAnswer: 'B' },
  { itemA: 'Vitamin C in orange', valueA: 70, itemB: 'Vitamin C in kiwi', valueB: 93, unit: 'mg', category: 'Food', correctAnswer: 'B' },
  { itemA: 'Moons of Jupiter', valueA: 95, itemB: 'Moons of Saturn', valueB: 146, unit: 'moons', category: 'Space', correctAnswer: 'B' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'lg', position: 'top-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface BiggerOrSmallerData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  itemA: string;
  itemB: string;
  valueA: number | null;
  valueB: number | null;
  unit: string;
  category: string;
  correctAnswer: 'A' | 'B' | null;
  pickMs: number;
  pickedPlayerIds: string[];
  playerPicks: Record<string, string>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class BiggerOrSmallerGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'biggerorsmaller',
    name: 'Bigger or Smaller',
    description: 'Which one is bigger? Pick the larger number!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, string> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: SizePuzzle | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    const pick = input.control;
    if (pick !== 'A' && pick !== 'B') return;

    this.playerPicks[playerId] = pick;

    if (this.currentPuzzle && pick === this.currentPuzzle.correctAnswer) {
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

  private makeData(): BiggerOrSmallerData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      itemA: this.currentPuzzle?.itemA ?? '',
      itemB: this.currentPuzzle?.itemB ?? '',
      valueA: isReveal ? (this.currentPuzzle?.valueA ?? null) : null,
      valueB: isReveal ? (this.currentPuzzle?.valueB ?? null) : null,
      unit: this.currentPuzzle?.unit ?? '',
      category: this.currentPuzzle?.category ?? '',
      correctAnswer: isReveal ? (this.currentPuzzle?.correctAnswer ?? null) : null,
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'biggerorsmaller',
    name: 'Bigger or Smaller',
    description: 'Which one is bigger? Pick the larger number!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new BiggerOrSmallerGame(),
);
