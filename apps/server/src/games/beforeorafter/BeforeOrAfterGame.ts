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
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface TimelinePuzzle {
  eventA: string;
  yearA: number;
  eventB: string;
  yearB: number;
  answer: 'A' | 'B';  // which came first
  category: string;
}

const PUZZLES: TimelinePuzzle[] = [
  { eventA: 'First email sent', yearA: 1971, eventB: 'Moon landing', yearB: 1969, answer: 'B', category: 'Tech' },
  { eventA: 'Eiffel Tower built', yearA: 1889, eventB: 'Statue of Liberty unveiled', yearB: 1886, answer: 'B', category: 'Landmarks' },
  { eventA: 'Titanic sank', yearA: 1912, eventB: 'Wright Brothers first flight', yearB: 1903, answer: 'B', category: 'History' },
  { eventA: 'iPhone released', yearA: 2007, eventB: 'Facebook launched', yearB: 2004, answer: 'B', category: 'Tech' },
  { eventA: 'Shakespeare born', yearA: 1564, eventB: 'Printing press invented', yearB: 1440, answer: 'B', category: 'Culture' },
  { eventA: 'Berlin Wall fell', yearA: 1989, eventB: 'Chernobyl disaster', yearB: 1986, answer: 'B', category: 'History' },
  { eventA: 'First Star Wars movie', yearA: 1977, eventB: 'Jaws released', yearB: 1975, answer: 'B', category: 'Movies' },
  { eventA: 'Nintendo founded', yearA: 1889, eventB: 'Coca-Cola invented', yearB: 1886, answer: 'B', category: 'Brands' },
  { eventA: 'Penicillin discovered', yearA: 1928, eventB: 'Theory of Relativity published', yearB: 1905, answer: 'B', category: 'Science' },
  { eventA: 'First Olympics (modern)', yearA: 1896, eventB: 'First World Cup', yearB: 1930, answer: 'A', category: 'Sports' },
  { eventA: 'Instagram launched', yearA: 2010, eventB: 'Twitter launched', yearB: 2006, answer: 'B', category: 'Tech' },
  { eventA: 'Great Fire of London', yearA: 1666, eventB: 'Newton discovers gravity', yearB: 1687, answer: 'A', category: 'History' },
  { eventA: 'Mona Lisa painted', yearA: 1503, eventB: 'Columbus reaches America', yearB: 1492, answer: 'B', category: 'Culture' },
  { eventA: 'First photograph taken', yearA: 1826, eventB: 'First telephone call', yearB: 1876, answer: 'A', category: 'Tech' },
  { eventA: 'Minecraft released', yearA: 2011, eventB: 'Fortnite released', yearB: 2017, answer: 'A', category: 'Games' },
  { eventA: 'Harry Potter book 1', yearA: 1997, eventB: 'Lord of the Rings movie 1', yearB: 2001, answer: 'A', category: 'Culture' },
  { eventA: 'DNA structure discovered', yearA: 1953, eventB: 'First heart transplant', yearB: 1967, answer: 'A', category: 'Science' },
  { eventA: 'YouTube launched', yearA: 2005, eventB: 'Netflix started streaming', yearB: 2007, answer: 'A', category: 'Tech' },
  { eventA: 'French Revolution', yearA: 1789, eventB: 'American Revolution', yearB: 1776, answer: 'B', category: 'History' },
  { eventA: 'Pizza Margherita created', yearA: 1889, eventB: 'Hamburger invented', yearB: 1900, answer: 'A', category: 'Food' },
  { eventA: 'First Super Bowl', yearA: 1967, eventB: 'Woodstock festival', yearB: 1969, answer: 'A', category: 'Culture' },
  { eventA: 'Amazon founded', yearA: 1994, eventB: 'Google founded', yearB: 1998, answer: 'A', category: 'Tech' },
  { eventA: 'Cleopatra ruled Egypt', yearA: -51, eventB: 'Julius Caesar assassinated', yearB: -44, answer: 'A', category: 'History' },
  { eventA: 'First color TV broadcast', yearA: 1951, eventB: 'First microwave oven sold', yearB: 1947, answer: 'B', category: 'Tech' },
  { eventA: 'LEGO founded', yearA: 1932, eventB: 'Monopoly board game released', yearB: 1935, answer: 'A', category: 'Games' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'lg', position: 'top-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface BeforeOrAfterData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  eventA: string;
  eventB: string;
  category: string;
  pickMs: number;
  pickedPlayerIds: string[];
  correctAnswer: 'A' | 'B' | null;
  yearA: number | null;
  yearB: number | null;
  playerPicks: Record<string, string>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class BeforeOrAfterGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'beforeorafter',
    name: 'Before or After',
    description: 'Which happened first? Test your timeline knowledge!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, string> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: TimelinePuzzle | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    if (input.control !== 'A' && input.control !== 'B') return;
    this.playerPicks[playerId] = input.control;

    if (this.currentPuzzle && input.control === this.currentPuzzle.answer) {
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

  private makeData(): BeforeOrAfterData {
    const isReveal = this.subPhase === 'reveal';
    const puzzle = this.currentPuzzle;
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      eventA: puzzle?.eventA ?? '',
      eventB: puzzle?.eventB ?? '',
      category: puzzle?.category ?? '',
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctAnswer: isReveal ? (puzzle?.answer ?? null) : null,
      yearA: isReveal ? (puzzle?.yearA ?? null) : null,
      yearB: isReveal ? (puzzle?.yearB ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'beforeorafter',
    name: 'Before or After',
    description: 'Which happened first? Test your timeline knowledge!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new BeforeOrAfterGame(),
);
