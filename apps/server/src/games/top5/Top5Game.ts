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
const PICK_MS = 6_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface Top5Puzzle {
  category: string;
  question: string;
  items: [string, string, string, string]; // 4 displayed, one does NOT belong
  fakeIndex: number; // index of the item that doesn't belong to the top 5
}

const PUZZLES: Top5Puzzle[] = [
  { category: 'Countries', question: 'Top 5 largest countries by area', items: ['Russia', 'Canada', 'Germany', 'China'], fakeIndex: 2 },
  { category: 'Planets', question: 'Top 5 largest planets in our solar system', items: ['Jupiter', 'Saturn', 'Neptune', 'Mercury'], fakeIndex: 3 },
  { category: 'Animals', question: 'Top 5 fastest land animals', items: ['Cheetah', 'Pronghorn', 'Sloth', 'Lion'], fakeIndex: 2 },
  { category: 'Food', question: 'Top 5 most consumed foods worldwide', items: ['Rice', 'Wheat', 'Caviar', 'Corn'], fakeIndex: 2 },
  { category: 'Sports', question: 'Top 5 most watched sports globally', items: ['Soccer', 'Cricket', 'Curling', 'Tennis'], fakeIndex: 2 },
  { category: 'Cities', question: 'Top 5 most populated cities', items: ['Tokyo', 'Delhi', 'Zurich', 'Shanghai'], fakeIndex: 2 },
  { category: 'Movies', question: 'Top 5 highest-grossing films ever', items: ['Avatar', 'Avengers: Endgame', 'Sharknado', 'Titanic'], fakeIndex: 2 },
  { category: 'Languages', question: 'Top 5 most spoken languages', items: ['English', 'Mandarin', 'Finnish', 'Hindi'], fakeIndex: 2 },
  { category: 'Elements', question: 'Top 5 most abundant elements in the universe', items: ['Hydrogen', 'Helium', 'Gold', 'Oxygen'], fakeIndex: 2 },
  { category: 'Oceans', question: 'Top 5 largest bodies of water', items: ['Pacific', 'Atlantic', 'Lake Michigan', 'Indian Ocean'], fakeIndex: 2 },
  { category: 'Mountains', question: 'Top 5 tallest mountains', items: ['Everest', 'K2', 'Mont Blanc', 'Kangchenjunga'], fakeIndex: 2 },
  { category: 'Fruit', question: 'Top 5 most produced fruits worldwide', items: ['Banana', 'Apple', 'Dragon Fruit', 'Watermelon'], fakeIndex: 2 },
  { category: 'Music', question: 'Top 5 best-selling music artists ever', items: ['The Beatles', 'Elvis Presley', 'Nickelback', 'Elton John'], fakeIndex: 2 },
  { category: 'Rivers', question: 'Top 5 longest rivers in the world', items: ['Nile', 'Amazon', 'Thames', 'Yangtze'], fakeIndex: 2 },
  { category: 'Animals', question: 'Top 5 heaviest land animals', items: ['Elephant', 'White Rhino', 'House Cat', 'Hippo'], fakeIndex: 2 },
  { category: 'Tech', question: 'Top 5 most valuable tech companies', items: ['Apple', 'Microsoft', 'MySpace', 'Google'], fakeIndex: 2 },
  { category: 'Countries', question: 'Top 5 most populated countries', items: ['China', 'India', 'Iceland', 'USA'], fakeIndex: 2 },
  { category: 'Desserts', question: 'Top 5 most popular desserts worldwide', items: ['Ice Cream', 'Chocolate Cake', 'Pickled Herring', 'Tiramisu'], fakeIndex: 2 },
  { category: 'Sports', question: 'Top 5 Olympic sports by viewership', items: ['Swimming', 'Gymnastics', 'Dressage', 'Track & Field'], fakeIndex: 2 },
  { category: 'Continents', question: 'Top 5 continents by population', items: ['Asia', 'Africa', 'Antarctica', 'Europe'], fakeIndex: 2 },
  { category: 'Pets', question: 'Top 5 most popular pets worldwide', items: ['Dog', 'Cat', 'Komodo Dragon', 'Fish'], fakeIndex: 2 },
  { category: 'Instruments', question: 'Top 5 most played musical instruments', items: ['Piano', 'Guitar', 'Bagpipes', 'Violin'], fakeIndex: 2 },
  { category: 'Inventions', question: 'Top 5 most impactful inventions', items: ['Printing Press', 'Electricity', 'Pet Rock', 'Internet'], fakeIndex: 2 },
  { category: 'Drinks', question: 'Top 5 most consumed beverages', items: ['Water', 'Tea', 'Pickle Juice', 'Coffee'], fakeIndex: 2 },
  { category: 'Games', question: 'Top 5 best-selling video games ever', items: ['Minecraft', 'Tetris', 'E.T. Atari', 'GTA V'], fakeIndex: 2 },
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

export interface Top5Data {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  category: string;
  question: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class Top5Game extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'top5',
    name: 'Top 5',
    description: 'Spot the imposter! Which one does NOT belong in the Top 5?',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: Top5Puzzle | null = null;
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

    // Shuffle the 4 items so the fake isn't always in position 2
    const items = [...this.currentPuzzle.items];
    const fakeItem = items[this.currentPuzzle.fakeIndex]!;
    this.shuffledOptions = this.shuffle(items);
    this.correctIdx = this.shuffledOptions.indexOf(fakeItem);
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

  private makeData(): Top5Data {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      category: this.currentPuzzle?.category ?? '',
      question: this.currentPuzzle?.question ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'top5',
    name: 'Top 5',
    description: 'Spot the imposter! Which one does NOT belong in the Top 5?',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new Top5Game(),
);
