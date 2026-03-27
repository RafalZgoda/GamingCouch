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
const REVEAL_MS = 4_000;
const CORRECT_POINTS = 300;
const PARTIAL_POINTS = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface RankPuzzle {
  prompt: string;
  category: string;
  items: [string, string, string, string]; // already in correct order (1st→4th)
}

const PUZZLES: RankPuzzle[] = [
  { prompt: 'Largest to smallest planet', category: 'Space', items: ['Jupiter', 'Saturn', 'Neptune', 'Earth'] },
  { prompt: 'Tallest to shortest building', category: 'Architecture', items: ['Burj Khalifa', 'Shanghai Tower', 'Eiffel Tower', 'Statue of Liberty'] },
  { prompt: 'Fastest to slowest animal', category: 'Animals', items: ['Cheetah', 'Horse', 'Elephant', 'Tortoise'] },
  { prompt: 'Most to least populated country', category: 'Geography', items: ['India', 'USA', 'Brazil', 'Australia'] },
  { prompt: 'Hottest to coldest place', category: 'Geography', items: ['Sahara Desert', 'Miami', 'London', 'Antarctica'] },
  { prompt: 'Oldest to newest invention', category: 'History', items: ['Wheel', 'Printing press', 'Telephone', 'Internet'] },
  { prompt: 'Heaviest to lightest fruit', category: 'Food', items: ['Watermelon', 'Pineapple', 'Apple', 'Strawberry'] },
  { prompt: 'Longest to shortest river', category: 'Geography', items: ['Nile', 'Amazon', 'Mississippi', 'Thames'] },
  { prompt: 'Most to fewest Olympic gold medals (country)', category: 'Sports', items: ['USA', 'UK', 'France', 'Japan'] },
  { prompt: 'Deepest to shallowest ocean', category: 'Geography', items: ['Pacific', 'Atlantic', 'Indian', 'Arctic'] },
  { prompt: 'Biggest to smallest continent', category: 'Geography', items: ['Asia', 'Africa', 'North America', 'Europe'] },
  { prompt: 'Fastest to slowest sport ball', category: 'Sports', items: ['Golf ball', 'Tennis ball', 'Baseball', 'Bowling ball'] },
  { prompt: 'Most to least expensive gemstone', category: 'General', items: ['Diamond', 'Emerald', 'Ruby', 'Amethyst'] },
  { prompt: 'Hardest to softest material', category: 'Science', items: ['Diamond', 'Steel', 'Wood', 'Cotton'] },
  { prompt: 'Largest to smallest country by area', category: 'Geography', items: ['Russia', 'Canada', 'USA', 'France'] },
  { prompt: 'Longest to shortest bone in human body', category: 'Science', items: ['Femur', 'Tibia', 'Humerus', 'Stapes'] },
  { prompt: 'Most to fewest strings on instrument', category: 'Music', items: ['Piano (88 keys)', 'Harp', 'Guitar', 'Violin'] },
  { prompt: 'Oldest to newest movie franchise', category: 'Movies', items: ['James Bond', 'Star Wars', 'Harry Potter', 'Marvel MCU'] },
  { prompt: 'Largest to smallest big cat', category: 'Animals', items: ['Tiger', 'Lion', 'Jaguar', 'Cheetah'] },
  { prompt: 'Most to fewest letters in the word', category: 'Language', items: ['Hippopotamus', 'Butterfly', 'Tiger', 'Cat'] },
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

export interface RankingGameData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  prompt: string;
  category: string;
  items: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctOrder: number[] | null;
  playerPicks: Record<string, number>;
  correctPlayerIds: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class RankingGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'rankinggame',
    name: 'Ranking Game',
    description: 'Four items, one order — which comes first? Race to pick the right answer!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private correctPlayerIds: string[] = [];
  private usedPuzzles: number[] = [];
  private currentPuzzle: RankPuzzle | null = null;
  private shuffledItems: string[] = [];
  private firstItemCorrectIndex = -1; // index of the #1 ranked item in shuffled array

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

    if (idx === this.firstItemCorrectIndex) {
      this.correctPlayerIds.push(playerId);
      this.addScore(playerId, CORRECT_POINTS);
    } else {
      // Partial credit if they picked #2
      const pickedItem = this.shuffledItems[idx];
      if (pickedItem === this.currentPuzzle?.items[1]) {
        this.addScore(playerId, PARTIAL_POINTS);
      }
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
    this.correctPlayerIds = [];
    this.pickMs = PICK_MS;
    this.pickStartTime = Date.now();

    const available = PUZZLES.map((_, i) => i).filter((i) => !this.usedPuzzles.includes(i));
    const pool = available.length > 0 ? available : PUZZLES.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPuzzle = PUZZLES[idx]!;
    this.usedPuzzles.push(idx);

    this.shuffledItems = this.shuffle([...this.currentPuzzle.items]);
    this.firstItemCorrectIndex = this.shuffledItems.indexOf(this.currentPuzzle.items[0]!);
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

  private makeData(): RankingGameData {
    const isReveal = this.subPhase === 'reveal';
    // Build correct order: map original items[0..3] to their shuffled indices
    const correctOrder = isReveal
      ? this.currentPuzzle!.items.map((item) => this.shuffledItems.indexOf(item))
      : null;

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      prompt: this.currentPuzzle?.prompt ?? '',
      category: this.currentPuzzle?.category ?? '',
      items: [...this.shuffledItems],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctOrder,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
      correctPlayerIds: isReveal ? [...this.correctPlayerIds] : [],
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'rankinggame',
    name: 'Ranking Game',
    description: 'Four items, one order — which comes first? Race to pick the right answer!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new RankingGame(),
);
