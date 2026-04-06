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
const PICK_MS = 10_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface OddWordPuzzle {
  words: [string, string, string, string]; // 3 belong, 1 is the odd one out
  oddIndex: number;
  connection: string;
  category: string;
}

const PUZZLES: OddWordPuzzle[] = [
  { words: ['Cheddar', 'Brie', 'Granite', 'Gouda'], oddIndex: 2, connection: 'Types of cheese', category: 'Food' },
  { words: ['Mercury', 'Venus', 'Pluto', 'Mars'], oddIndex: 2, connection: 'Planets in our solar system', category: 'Space' },
  { words: ['Guitar', 'Trumpet', 'Violin', 'Cello'], oddIndex: 1, connection: 'String instruments', category: 'Music' },
  { words: ['Eagle', 'Penguin', 'Salmon', 'Parrot'], oddIndex: 2, connection: 'Birds', category: 'Animals' },
  { words: ['Python', 'Cobra', 'Iguana', 'Mamba'], oddIndex: 2, connection: 'Snakes', category: 'Animals' },
  { words: ['Tennis', 'Badminton', 'Squash', 'Hockey'], oddIndex: 3, connection: 'Racket sports', category: 'Sports' },
  { words: ['Monet', 'Picasso', 'Mozart', 'Rembrandt'], oddIndex: 2, connection: 'Painters', category: 'Art' },
  { words: ['Thames', 'Amazon', 'Everest', 'Nile'], oddIndex: 2, connection: 'Rivers', category: 'Geography' },
  { words: ['Oxygen', 'Helium', 'Water', 'Nitrogen'], oddIndex: 2, connection: 'Chemical elements', category: 'Science' },
  { words: ['Hamlet', 'Othello', 'Gatsby', 'Macbeth'], oddIndex: 2, connection: 'Shakespeare plays', category: 'Literature' },
  { words: ['Ferrari', 'Lamborghini', 'Boeing', 'Porsche'], oddIndex: 2, connection: 'Car brands', category: 'Vehicles' },
  { words: ['Basil', 'Oregano', 'Cinnamon', 'Thyme'], oddIndex: 2, connection: 'Herbs (not spices)', category: 'Food' },
  { words: ['Ruby', 'Emerald', 'Diamond', 'Marble'], oddIndex: 3, connection: 'Gemstones', category: 'Nature' },
  { words: ['Espresso', 'Latte', 'Kombucha', 'Cappuccino'], oddIndex: 2, connection: 'Coffee drinks', category: 'Drinks' },
  { words: ['Oak', 'Pine', 'Tulip', 'Maple'], oddIndex: 2, connection: 'Trees', category: 'Nature' },
  { words: ['Tokyo', 'Berlin', 'Amazon', 'Paris'], oddIndex: 2, connection: 'Capital cities', category: 'Geography' },
  { words: ['Newton', 'Einstein', 'Da Vinci', 'Hawking'], oddIndex: 2, connection: 'Physicists', category: 'Science' },
  { words: ['Dollar', 'Euro', 'Bitcoin', 'Pound'], oddIndex: 2, connection: 'Traditional currencies', category: 'Finance' },
  { words: ['Whale', 'Dolphin', 'Shark', 'Porpoise'], oddIndex: 2, connection: 'Mammals', category: 'Animals' },
  { words: ['Mars', 'Snickers', 'Skittles', 'Oreo'], oddIndex: 3, connection: 'Chocolate bars', category: 'Food' },
  { words: ['Silk', 'Cotton', 'Plastic', 'Wool'], oddIndex: 2, connection: 'Natural fabrics', category: 'Materials' },
  { words: ['Drums', 'Xylophone', 'Flute', 'Bongos'], oddIndex: 2, connection: 'Percussion instruments', category: 'Music' },
  { words: ['Chess', 'Checkers', 'Poker', 'Othello'], oddIndex: 2, connection: 'Board games', category: 'Games' },
  { words: ['Sonnet', 'Haiku', 'Novel', 'Limerick'], oddIndex: 2, connection: 'Forms of poetry', category: 'Literature' },
  { words: ['Knee', 'Elbow', 'Liver', 'Shoulder'], oddIndex: 2, connection: 'Joints', category: 'Body' },
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

export interface OddWordOutData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  words: string[];
  category: string;
  connection: string | null;
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class OddWordOutGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'oddwordout',
    name: 'Odd Word Out',
    description: 'Spot the word that doesn\'t belong!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: OddWordPuzzle[] = [];
  private current!: OddWordPuzzle;
  private displayWords: string[] = [];
  private correctIdx = 0;
  private pickTimer = PICK_MS;
  private revealTimer = REVEAL_MS;
  private pickedPlayers = new Set<string>();
  private roundPhase: 'pick' | 'reveal' = 'pick';

  /* helpers */

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private preparePuzzle(): void {
    this.current = this.pool[this.round - 1];
    // Shuffle the words while tracking where the odd one ends up
    const indexed = this.current.words.map((w, i) => ({ w, isOdd: i === this.current.oddIndex }));
    const shuffled = this.shuffle(indexed);
    this.displayWords = shuffled.map((s) => s.w);
    this.correctIdx = shuffled.findIndex((s) => s.isOdd);
  }

  private makeData(): OddWordOutData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      words: this.displayWords,
      category: this.current.category,
      connection: this.roundPhase === 'reveal' ? this.current.connection : null,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
    };
  }

  private startRound(): void {
    this.preparePuzzle();
    this.pickTimer = PICK_MS;
    this.revealTimer = REVEAL_MS;
    this.pickedPlayers.clear();
    this.roundPhase = 'pick';
    this.phase = 'active';
  }

  /* lifecycle */

  protected onInit(_players: Player[]): GameState {
    this.pool = this.shuffle(PUZZLES).slice(0, DEFAULT_ROUNDS);
    this.totalRounds = this.pool.length;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.roundPhase !== 'pick') return;
    if (this.pickedPlayers.has(playerId)) return;

    this.pickedPlayers.add(playerId);
    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === this.correctIdx) {
      const bonus = Math.round((this.pickTimer / PICK_MS) * SPEED_BONUS_MAX);
      this.addScore(playerId, CORRECT_POINTS + bonus);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.phase === 'results') return this.buildState(this.makeData());

    if (this.roundPhase === 'pick') {
      this.pickTimer = Math.max(0, this.pickTimer - deltaMs);
      if (this.pickTimer <= 0 || this.pickedPlayers.size >= this.players.size) {
        this.roundPhase = 'reveal';
      }
    } else {
      this.revealTimer -= deltaMs;
      if (this.revealTimer <= 0) {
        this.advanceRound();
        if (this.round > this.totalRounds) {
          this.phase = 'results';
        } else {
          this.startRound();
        }
      }
    }

    return this.buildState(this.makeData());
  }
}

GameRegistry.register(
  { id: 'oddwordout', name: 'Odd Word Out', description: 'Spot the word that doesn\'t belong!', minPlayers: 1, maxPlayers: 100 },
  () => new OddWordOutGame(),
);
