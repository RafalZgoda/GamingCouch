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
const PICK_MS = 8_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface DecadePuzzle {
  event: string;
  correct: string;
  distractors: [string, string, string];
  year: number;
  category: string;
}

const PUZZLES: DecadePuzzle[] = [
  { event: 'First iPhone released', correct: '2000s', distractors: ['1990s', '2010s', '1980s'], year: 2007, category: 'Tech' },
  { event: 'Man walks on the Moon', correct: '1960s', distractors: ['1970s', '1950s', '1980s'], year: 1969, category: 'Space' },
  { event: 'Titanic sinks', correct: '1910s', distractors: ['1920s', '1900s', '1930s'], year: 1912, category: 'History' },
  { event: 'Facebook launches', correct: '2000s', distractors: ['2010s', '1990s', '2020s'], year: 2004, category: 'Tech' },
  { event: 'Berlin Wall falls', correct: '1980s', distractors: ['1990s', '1970s', '1960s'], year: 1989, category: 'History' },
  { event: 'Pac-Man arcade game released', correct: '1980s', distractors: ['1970s', '1990s', '1960s'], year: 1980, category: 'Gaming' },
  { event: 'First Harry Potter book published', correct: '1990s', distractors: ['2000s', '1980s', '2010s'], year: 1997, category: 'Books' },
  { event: 'YouTube goes live', correct: '2000s', distractors: ['2010s', '1990s', '2020s'], year: 2005, category: 'Tech' },
  { event: 'First World Cup held', correct: '1930s', distractors: ['1920s', '1940s', '1950s'], year: 1930, category: 'Sports' },
  { event: 'Minecraft released', correct: '2010s', distractors: ['2000s', '2020s', '1990s'], year: 2011, category: 'Gaming' },
  { event: 'Elvis Presley\'s first hit', correct: '1950s', distractors: ['1960s', '1940s', '1970s'], year: 1954, category: 'Music' },
  { event: 'Netflix starts streaming', correct: '2000s', distractors: ['2010s', '1990s', '2020s'], year: 2007, category: 'Entertainment' },
  { event: 'Jurassic Park movie released', correct: '1990s', distractors: ['2000s', '1980s', '2010s'], year: 1993, category: 'Movies' },
  { event: 'Instagram launches', correct: '2010s', distractors: ['2000s', '2020s', '1990s'], year: 2010, category: 'Tech' },
  { event: 'First commercial airplane flight', correct: '1910s', distractors: ['1920s', '1900s', '1930s'], year: 1914, category: 'Travel' },
  { event: 'Microwave oven invented', correct: '1940s', distractors: ['1950s', '1960s', '1930s'], year: 1945, category: 'Inventions' },
  { event: 'Tetris created', correct: '1980s', distractors: ['1970s', '1990s', '1960s'], year: 1984, category: 'Gaming' },
  { event: 'First emoji set created', correct: '1990s', distractors: ['2000s', '2010s', '1980s'], year: 1999, category: 'Tech' },
  { event: 'Woodstock music festival', correct: '1960s', distractors: ['1970s', '1950s', '1980s'], year: 1969, category: 'Music' },
  { event: 'First Star Wars movie', correct: '1970s', distractors: ['1980s', '1960s', '1990s'], year: 1977, category: 'Movies' },
  { event: 'Wi-Fi technology introduced', correct: '1990s', distractors: ['2000s', '1980s', '2010s'], year: 1997, category: 'Tech' },
  { event: 'TikTok launches globally', correct: '2010s', distractors: ['2020s', '2000s', '1990s'], year: 2018, category: 'Tech' },
  { event: 'First Super Bowl played', correct: '1960s', distractors: ['1970s', '1950s', '1980s'], year: 1967, category: 'Sports' },
  { event: 'Penicillin discovered', correct: '1920s', distractors: ['1930s', '1910s', '1940s'], year: 1928, category: 'Science' },
  { event: 'Bitcoin created', correct: '2000s', distractors: ['2010s', '2020s', '1990s'], year: 2009, category: 'Tech' },
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

export interface DecadeDetectorData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  event: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  year: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class DecadeDetectorGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'decadedetector',
    name: 'Decade Detector',
    description: 'Which decade did it happen? Place the event in time!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: DecadePuzzle | null = null;
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

  private makeData(): DecadeDetectorData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      event: this.currentPuzzle?.event ?? '',
      category: this.currentPuzzle?.category ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
      year: isReveal ? (this.currentPuzzle?.year ?? null) : null,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'decadedetector',
    name: 'Decade Detector',
    description: 'Which decade did it happen? Place the event in time!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new DecadeDetectorGame(),
);
