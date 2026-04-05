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

// ── Content ──────────────────────────────────────────────────────────────────

interface AlphabetPuzzle {
  letter: string;
  category: string;
  prompt: string;            // e.g. "Animal starting with B"
  correct: string;
  correctIndex: number;      // position in options array
  distractors: [string, string, string]; // wrong answers (wrong letter)
}

const PUZZLES: AlphabetPuzzle[] = [
  { letter: 'A', category: 'Animals', prompt: 'Animal starting with A', correct: 'Alligator', correctIndex: 0, distractors: ['Bear', 'Cheetah', 'Dolphin'] },
  { letter: 'B', category: 'Countries', prompt: 'Country starting with B', correct: 'Brazil', correctIndex: 0, distractors: ['Canada', 'Denmark', 'France'] },
  { letter: 'C', category: 'Food', prompt: 'Food starting with C', correct: 'Croissant', correctIndex: 0, distractors: ['Donut', 'Falafel', 'Pasta'] },
  { letter: 'D', category: 'Movies', prompt: 'Disney movie starting with D', correct: 'Dumbo', correctIndex: 0, distractors: ['Frozen', 'Mulan', 'Aladdin'] },
  { letter: 'E', category: 'Cities', prompt: 'City starting with E', correct: 'Edinburgh', correctIndex: 0, distractors: ['Bangkok', 'Chicago', 'Dublin'] },
  { letter: 'F', category: 'Fruits', prompt: 'Fruit starting with F', correct: 'Fig', correctIndex: 0, distractors: ['Grape', 'Kiwi', 'Lemon'] },
  { letter: 'G', category: 'Sports', prompt: 'Sport starting with G', correct: 'Golf', correctIndex: 0, distractors: ['Tennis', 'Hockey', 'Boxing'] },
  { letter: 'H', category: 'Animals', prompt: 'Animal starting with H', correct: 'Hedgehog', correctIndex: 0, distractors: ['Iguana', 'Jaguar', 'Koala'] },
  { letter: 'I', category: 'Countries', prompt: 'Country starting with I', correct: 'Iceland', correctIndex: 0, distractors: ['Japan', 'Kenya', 'Libya'] },
  { letter: 'J', category: 'Food', prompt: 'Food starting with J', correct: 'Jambalaya', correctIndex: 0, distractors: ['Kebab', 'Lasagna', 'Nachos'] },
  { letter: 'K', category: 'Animals', prompt: 'Animal starting with K', correct: 'Kangaroo', correctIndex: 0, distractors: ['Llama', 'Moose', 'Newt'] },
  { letter: 'L', category: 'Cities', prompt: 'City starting with L', correct: 'Lisbon', correctIndex: 0, distractors: ['Miami', 'Naples', 'Oslo'] },
  { letter: 'M', category: 'Fruits', prompt: 'Fruit starting with M', correct: 'Mango', correctIndex: 0, distractors: ['Banana', 'Cherry', 'Guava'] },
  { letter: 'N', category: 'Countries', prompt: 'Country starting with N', correct: 'Norway', correctIndex: 0, distractors: ['Poland', 'Romania', 'Sweden'] },
  { letter: 'O', category: 'Food', prompt: 'Food starting with O', correct: 'Omelette', correctIndex: 0, distractors: ['Pizza', 'Ravioli', 'Sushi'] },
  { letter: 'P', category: 'Animals', prompt: 'Animal starting with P', correct: 'Penguin', correctIndex: 0, distractors: ['Raccoon', 'Squirrel', 'Tiger'] },
  { letter: 'R', category: 'Sports', prompt: 'Sport starting with R', correct: 'Rugby', correctIndex: 0, distractors: ['Baseball', 'Cricket', 'Fencing'] },
  { letter: 'S', category: 'Movies', prompt: 'Superhero starting with S', correct: 'Spider-Man', correctIndex: 0, distractors: ['Batman', 'Flash', 'Hulk'] },
  { letter: 'T', category: 'Food', prompt: 'Food starting with T', correct: 'Tacos', correctIndex: 0, distractors: ['Burger', 'Curry', 'Fondue'] },
  { letter: 'V', category: 'Countries', prompt: 'Country starting with V', correct: 'Vietnam', correctIndex: 0, distractors: ['Australia', 'Belgium', 'Croatia'] },
  { letter: 'W', category: 'Animals', prompt: 'Animal starting with W', correct: 'Walrus', correctIndex: 0, distractors: ['Falcon', 'Gorilla', 'Leopard'] },
  { letter: 'Z', category: 'Animals', prompt: 'Animal starting with Z', correct: 'Zebra', correctIndex: 0, distractors: ['Camel', 'Donkey', 'Eagle'] },
  { letter: 'B', category: 'Food', prompt: 'Breakfast food starting with B', correct: 'Bagel', correctIndex: 0, distractors: ['Cereal', 'Toast', 'Waffle'] },
  { letter: 'C', category: 'Colors', prompt: 'Color starting with C', correct: 'Crimson', correctIndex: 0, distractors: ['Beige', 'Indigo', 'Magenta'] },
  { letter: 'P', category: 'Cities', prompt: 'City starting with P', correct: 'Prague', correctIndex: 0, distractors: ['Berlin', 'Madrid', 'Vienna'] },
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

export interface AlphabetRaceData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  letter: string;
  category: string;
  prompt: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class AlphabetRaceGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'alphabetrace',
    name: 'Alphabet Race',
    description: 'Find the answer that starts with the right letter!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: AlphabetPuzzle | null = null;
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

  private makeData(): AlphabetRaceData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      letter: this.currentPuzzle?.letter ?? '',
      category: this.currentPuzzle?.category ?? '',
      prompt: this.currentPuzzle?.prompt ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
      correctAnswer: isReveal ? (this.currentPuzzle?.correct ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'alphabetrace',
    name: 'Alphabet Race',
    description: 'Find the answer that starts with the right letter!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new AlphabetRaceGame(),
);
