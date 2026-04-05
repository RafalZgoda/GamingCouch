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
const PICK_MS = 8_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const CLOSE_POINTS = 100; // within 1 decade
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface YearPuzzle {
  event: string;
  year: number;
  options: [number, number, number, number]; // 4 year choices
  correctIndex: number;
  category: string;
}

const PUZZLES: YearPuzzle[] = [
  { event: 'First Moon Landing', year: 1969, options: [1959, 1965, 1969, 1973], correctIndex: 2, category: 'Space' },
  { event: 'Titanic sank', year: 1912, options: [1905, 1912, 1920, 1898], correctIndex: 1, category: 'History' },
  { event: 'World Wide Web invented', year: 1989, options: [1985, 1989, 1993, 1991], correctIndex: 1, category: 'Tech' },
  { event: 'Berlin Wall fell', year: 1989, options: [1987, 1989, 1991, 1985], correctIndex: 1, category: 'History' },
  { event: 'First iPhone released', year: 2007, options: [2005, 2006, 2007, 2009], correctIndex: 2, category: 'Tech' },
  { event: 'Dinosaurs went extinct', year: -65000000, options: [65, 150, 200, 30], correctIndex: 0, category: 'Science' },
  { event: 'Shakespeare born', year: 1564, options: [1492, 1564, 1601, 1650], correctIndex: 1, category: 'Culture' },
  { event: 'Eiffel Tower built', year: 1889, options: [1875, 1889, 1900, 1910], correctIndex: 1, category: 'Landmarks' },
  { event: 'First Olympic Games (modern)', year: 1896, options: [1880, 1896, 1904, 1912], correctIndex: 1, category: 'Sports' },
  { event: 'Facebook launched', year: 2004, options: [2002, 2004, 2006, 2008], correctIndex: 1, category: 'Tech' },
  { event: 'Penicillin discovered', year: 1928, options: [1918, 1928, 1935, 1942], correctIndex: 1, category: 'Science' },
  { event: 'Napoleon defeated at Waterloo', year: 1815, options: [1805, 1812, 1815, 1820], correctIndex: 2, category: 'History' },
  { event: 'First Star Wars movie released', year: 1977, options: [1975, 1977, 1980, 1983], correctIndex: 1, category: 'Movies' },
  { event: 'Mona Lisa painted', year: 1503, options: [1450, 1503, 1550, 1600], correctIndex: 1, category: 'Art' },
  { event: 'First World Cup (football)', year: 1930, options: [1920, 1926, 1930, 1934], correctIndex: 2, category: 'Sports' },
  { event: 'Great Fire of London', year: 1666, options: [1600, 1642, 1666, 1700], correctIndex: 2, category: 'History' },
  { event: 'First Harry Potter book published', year: 1997, options: [1995, 1997, 1999, 2001], correctIndex: 1, category: 'Books' },
  { event: 'Electricity discovered (Franklin)', year: 1752, options: [1700, 1732, 1752, 1776], correctIndex: 2, category: 'Science' },
  { event: 'YouTube launched', year: 2005, options: [2003, 2005, 2007, 2009], correctIndex: 1, category: 'Tech' },
  { event: 'Cleopatra ruled Egypt', year: -51, options: [3000, 1000, 500, 50], correctIndex: 3, category: 'History' },
  { event: 'First photograph taken', year: 1826, options: [1800, 1826, 1850, 1870], correctIndex: 1, category: 'Tech' },
  { event: 'Minecraft released', year: 2011, options: [2009, 2011, 2013, 2015], correctIndex: 1, category: 'Games' },
  { event: 'Great Wall of China started', year: -700, options: [500, 700, 200, 100], correctIndex: 1, category: 'Landmarks' },
  { event: 'First airplane flight (Wright Bros)', year: 1903, options: [1895, 1900, 1903, 1910], correctIndex: 2, category: 'History' },
  { event: 'Instagram launched', year: 2010, options: [2008, 2010, 2012, 2014], correctIndex: 1, category: 'Tech' },
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

export interface GuessTheYearData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  event: string;
  category: string;
  options: number[];
  optionLabels: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  correctYear: number | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class GuessTheYearGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'guesstheyear',
    name: 'Guess the Year',
    description: 'When did it happen? Pick the right year!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: YearPuzzle | null = null;

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

    if (this.currentPuzzle) {
      if (idx === this.currentPuzzle.correctIndex) {
        const elapsed = Date.now() - this.pickStartTime;
        const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
        this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
      } else {
        // Close answer: within 1 position of correct (adjacent decade)
        const diff = Math.abs(idx - this.currentPuzzle.correctIndex);
        if (diff === 1) this.addScore(playerId, CLOSE_POINTS);
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

  private formatYear(y: number): string {
    if (y < 0) return `${Math.abs(y)} BC`;
    return `${y}`;
  }

  private makeData(): GuessTheYearData {
    const isReveal = this.subPhase === 'reveal';
    const puzzle = this.currentPuzzle;
    const options = puzzle?.options ?? [0, 0, 0, 0];

    // For ancient events, labels show simplified (e.g. "65 million BC" → just the number shown)
    const optionLabels = options.map((o) => {
      if (puzzle && puzzle.year < -10000) return `${o} million years ago`;
      if (puzzle && puzzle.year < 0) return `${o} BC`;
      return `${o}`;
    });

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      event: puzzle?.event ?? '',
      category: puzzle?.category ?? '',
      options: [...options],
      optionLabels,
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? (puzzle?.correctIndex ?? null) : null,
      correctYear: isReveal ? (puzzle?.year ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'guesstheyear',
    name: 'Guess the Year',
    description: 'When did it happen? Pick the right year!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new GuessTheYearGame(),
);
