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
const GUESS_MS = 8_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;
const WRONG_PENALTY = -50;

// ── Content ──────────────────────────────────────────────────────────────────

interface OddSet {
  category: string;
  items: [string, string, string, string]; // odd one at index [0]
  explanation: string;
}

const ODD_SETS: OddSet[] = [
  { category: 'Fruits', items: ['Carrot', 'Apple', 'Banana', 'Orange'], explanation: 'Carrot is a vegetable' },
  { category: 'Planets', items: ['Moon', 'Mars', 'Jupiter', 'Saturn'], explanation: 'Moon is not a planet' },
  { category: 'Colors', items: ['Triangle', 'Red', 'Blue', 'Green'], explanation: 'Triangle is a shape, not a color' },
  { category: 'Countries', items: ['Paris', 'France', 'Japan', 'Brazil'], explanation: 'Paris is a city' },
  { category: 'Musical Instruments', items: ['Hammer', 'Guitar', 'Piano', 'Violin'], explanation: 'Hammer is a tool' },
  { category: 'Sea Creatures', items: ['Eagle', 'Shark', 'Dolphin', 'Whale'], explanation: 'Eagle is a bird' },
  { category: 'Sports', items: ['Chess', 'Soccer', 'Tennis', 'Basketball'], explanation: 'Chess is a board game' },
  { category: 'Drinks', items: ['Bread', 'Water', 'Juice', 'Coffee'], explanation: 'Bread is a food' },
  { category: 'Transport', items: ['Bicycle', 'Car', 'Airplane', 'Cactus'], explanation: 'Cactus is a plant' },
  { category: 'Body Parts', items: ['Pillow', 'Hand', 'Foot', 'Elbow'], explanation: 'Pillow is not a body part' },
  { category: 'Desserts', items: ['Steak', 'Cake', 'Ice Cream', 'Brownie'], explanation: 'Steak is a main course' },
  { category: 'Metals', items: ['Wood', 'Gold', 'Silver', 'Iron'], explanation: 'Wood is not a metal' },
  { category: 'Weather', items: ['Book', 'Rain', 'Snow', 'Wind'], explanation: 'Book is not weather' },
  { category: 'Dog Breeds', items: ['Siamese', 'Labrador', 'Poodle', 'Husky'], explanation: 'Siamese is a cat breed' },
  { category: 'Vegetables', items: ['Strawberry', 'Broccoli', 'Spinach', 'Potato'], explanation: 'Strawberry is a fruit' },
  { category: 'Languages', items: ['Mandarin', 'Python', 'Spanish', 'Arabic'], explanation: 'Python is a programming language' },
  { category: 'Oceans', items: ['Amazon', 'Pacific', 'Atlantic', 'Indian'], explanation: 'Amazon is a river' },
  { category: 'Seasons', items: ['Monday', 'Spring', 'Summer', 'Autumn'], explanation: 'Monday is a day, not a season' },
  { category: 'Months', items: ['Thursday', 'January', 'March', 'August'], explanation: 'Thursday is a day of the week' },
  { category: 'Mammals', items: ['Penguin', 'Dog', 'Cat', 'Horse'], explanation: 'Penguin is a bird' },
  { category: 'Flowers', items: ['Oak', 'Rose', 'Tulip', 'Daisy'], explanation: 'Oak is a tree' },
  { category: 'Currencies', items: ['Meter', 'Dollar', 'Euro', 'Yen'], explanation: 'Meter is a unit of length' },
  { category: 'Pizza Toppings', items: ['Soap', 'Pepperoni', 'Mushroom', 'Olive'], explanation: 'Soap is not a pizza topping' },
  { category: 'Fairy Tales', items: ['Einstein', 'Cinderella', 'Snow White', 'Rapunzel'], explanation: 'Einstein was a real scientist' },
  { category: 'Continents', items: ['Antarctica', 'Africa', 'Asia', 'Narnia'], explanation: 'Narnia is fictional' },
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

export interface OddOneOutData {
  round: number;
  totalRounds: number;
  phase: 'guess' | 'reveal';
  category: string;
  items: string[];
  guessMs: number;
  guessedPlayerIds: string[];
  oddIndex: number | null;
  explanation: string | null;
  playerGuesses: Record<string, number>;
  correctPlayerIds: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class OddOneOutGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'oddoneout',
    name: 'Odd One Out',
    description: 'Four items, three belong — race to spot the odd one out!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'guess' | 'reveal' = 'guess';
  private guessMs = 0;
  private revealMs = 0;
  private guessStartTime = 0;
  private playerGuesses: Record<string, number> = {};
  private correctPlayerIds: string[] = [];
  private usedSets: number[] = [];
  private currentSet: OddSet | null = null;
  private shuffledItems: string[] = [];
  private oddIndex = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, ODD_SETS.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'guess') return;
    if (this.playerGuesses[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerGuesses[playerId] = idx;

    if (idx === this.oddIndex) {
      this.correctPlayerIds.push(playerId);
      const elapsed = Date.now() - this.guessStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / GUESS_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    } else {
      this.addScore(playerId, WRONG_PENALTY);
    }

    const allGuessed = [...this.players.keys()].every((id) => this.playerGuesses[id] !== undefined);
    if (allGuessed) {
      this.goToReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'guess') {
      this.guessMs -= deltaMs;
      if (this.guessMs <= 0) {
        this.goToReveal();
      }
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
    this.correctPlayerIds = [];
    this.guessMs = GUESS_MS;
    this.guessStartTime = Date.now();

    const available = ODD_SETS.map((_, i) => i).filter((i) => !this.usedSets.includes(i));
    const pool = available.length > 0 ? available : ODD_SETS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentSet = ODD_SETS[idx]!;
    this.usedSets.push(idx);

    this.shuffledItems = this.shuffle([...this.currentSet.items]);
    this.oddIndex = this.shuffledItems.indexOf(this.currentSet.items[0]!);
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

  private makeData(): OddOneOutData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      category: this.currentSet?.category ?? '',
      items: [...this.shuffledItems],
      guessMs: Math.max(0, this.guessMs),
      guessedPlayerIds: Object.keys(this.playerGuesses),
      oddIndex: isReveal ? this.oddIndex : null,
      explanation: isReveal ? (this.currentSet?.explanation ?? null) : null,
      playerGuesses: isReveal ? { ...this.playerGuesses } : {},
      correctPlayerIds: isReveal ? [...this.correctPlayerIds] : [],
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'oddoneout',
    name: 'Odd One Out',
    description: 'Four items, three belong — race to spot the odd one out!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new OddOneOutGame(),
);
