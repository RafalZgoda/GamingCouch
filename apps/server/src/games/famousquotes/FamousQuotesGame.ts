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
const CORRECT_POINTS = 250;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface QuotePuzzle {
  quote: string;
  correct: string;
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: QuotePuzzle[] = [
  { quote: '"To be, or not to be, that is the question."', correct: 'Shakespeare', distractors: ['Homer', 'Plato', 'Dickens'], category: 'Literature' },
  { quote: '"I have a dream."', correct: 'Martin Luther King Jr.', distractors: ['Nelson Mandela', 'Abraham Lincoln', 'Barack Obama'], category: 'History' },
  { quote: '"That\'s one small step for man, one giant leap for mankind."', correct: 'Neil Armstrong', distractors: ['Buzz Aldrin', 'John Glenn', 'Yuri Gagarin'], category: 'Science' },
  { quote: '"I think, therefore I am."', correct: 'René Descartes', distractors: ['Aristotle', 'Socrates', 'Voltaire'], category: 'Philosophy' },
  { quote: '"May the Force be with you."', correct: 'Star Wars', distractors: ['Star Trek', 'The Matrix', 'Lord of the Rings'], category: 'Movies' },
  { quote: '"Elementary, my dear Watson."', correct: 'Sherlock Holmes', distractors: ['Hercule Poirot', 'James Bond', 'Indiana Jones'], category: 'Fiction' },
  { quote: '"Life is like a box of chocolates."', correct: 'Forrest Gump', distractors: ['The Wizard of Oz', 'Willy Wonka', 'Mary Poppins'], category: 'Movies' },
  { quote: '"Houston, we have a problem."', correct: 'Apollo 13', distractors: ['Gravity', 'The Martian', 'Interstellar'], category: 'Movies' },
  { quote: '"The only thing we have to fear is fear itself."', correct: 'Franklin D. Roosevelt', distractors: ['Winston Churchill', 'Theodore Roosevelt', 'John F. Kennedy'], category: 'History' },
  { quote: '"Imagination is more important than knowledge."', correct: 'Albert Einstein', distractors: ['Isaac Newton', 'Nikola Tesla', 'Stephen Hawking'], category: 'Science' },
  { quote: '"I\'ll be back."', correct: 'The Terminator', distractors: ['Rambo', 'Die Hard', 'Predator'], category: 'Movies' },
  { quote: '"In the middle of difficulty lies opportunity."', correct: 'Albert Einstein', distractors: ['Steve Jobs', 'Thomas Edison', 'Benjamin Franklin'], category: 'Science' },
  { quote: '"Float like a butterfly, sting like a bee."', correct: 'Muhammad Ali', distractors: ['Mike Tyson', 'Rocky Balboa', 'Sugar Ray Leonard'], category: 'Sports' },
  { quote: '"Winter is coming."', correct: 'Game of Thrones', distractors: ['Lord of the Rings', 'The Witcher', 'Vikings'], category: 'TV' },
  { quote: '"Just do it."', correct: 'Nike', distractors: ['Adidas', 'Reebok', 'Puma'], category: 'Brands' },
  { quote: '"Here\'s looking at you, kid."', correct: 'Casablanca', distractors: ['Gone with the Wind', 'Citizen Kane', 'The Godfather'], category: 'Movies' },
  { quote: '"Stay hungry, stay foolish."', correct: 'Steve Jobs', distractors: ['Elon Musk', 'Bill Gates', 'Mark Zuckerberg'], category: 'Tech' },
  { quote: '"I came, I saw, I conquered."', correct: 'Julius Caesar', distractors: ['Alexander the Great', 'Napoleon', 'Genghis Khan'], category: 'History' },
  { quote: '"To infinity and beyond!"', correct: 'Buzz Lightyear', distractors: ['Woody', 'Iron Man', 'Superman'], category: 'Movies' },
  { quote: '"With great power comes great responsibility."', correct: 'Spider-Man', distractors: ['Batman', 'Superman', 'Captain America'], category: 'Comics' },
  { quote: '"That\'s what she said."', correct: 'The Office', distractors: ['Friends', 'How I Met Your Mother', 'Parks and Recreation'], category: 'TV' },
  { quote: '"You can\'t handle the truth!"', correct: 'A Few Good Men', distractors: ['The Departed', 'Goodfellas', 'Scarface'], category: 'Movies' },
  { quote: '"Keep calm and carry on."', correct: 'British Government (WWII)', distractors: ['Winston Churchill', 'Queen Elizabeth', 'Margaret Thatcher'], category: 'History' },
  { quote: '"Live long and prosper."', correct: 'Star Trek', distractors: ['Star Wars', 'Doctor Who', 'Battlestar Galactica'], category: 'TV' },
  { quote: '"Be the change you wish to see in the world."', correct: 'Mahatma Gandhi', distractors: ['Mother Teresa', 'Dalai Lama', 'Nelson Mandela'], category: 'History' },
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

export interface FamousQuotesData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  quote: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class FamousQuotesGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'famousquotes',
    name: 'Famous Quotes',
    description: 'Who said it? Match the quote to the source!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: QuotePuzzle | null = null;
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

    const allOptions = [this.currentPuzzle.correct, ...this.currentPuzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIdx = this.shuffledOptions.indexOf(this.currentPuzzle.correct);
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

  private makeData(): FamousQuotesData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      quote: this.currentPuzzle?.quote ?? '',
      category: this.currentPuzzle?.category ?? '',
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
    id: 'famousquotes',
    name: 'Famous Quotes',
    description: 'Who said it? Match the quote to the source!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new FamousQuotesGame(),
);
