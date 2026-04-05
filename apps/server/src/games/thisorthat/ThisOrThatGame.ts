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

const DEFAULT_ROUNDS = 15;
const PICK_MS = 5_000;
const REVEAL_MS = 3_000;
const MAJORITY_POINTS = 200;
const UNANIMOUS_BONUS = 100;
const SPEED_BONUS_MAX = 50;

// ── Content ──────────────────────────────────────────────────────────────────

interface ThisOrThatQuestion {
  optionA: string;
  optionB: string;
  category: string;
}

const QUESTIONS: ThisOrThatQuestion[] = [
  { optionA: 'Beach vacation', optionB: 'Mountain vacation', category: 'Travel' },
  { optionA: 'Morning person', optionB: 'Night owl', category: 'Lifestyle' },
  { optionA: 'Dogs', optionB: 'Cats', category: 'Animals' },
  { optionA: 'Sweet', optionB: 'Savory', category: 'Food' },
  { optionA: 'Summer', optionB: 'Winter', category: 'Seasons' },
  { optionA: 'Movies', optionB: 'TV shows', category: 'Entertainment' },
  { optionA: 'Pizza', optionB: 'Burgers', category: 'Food' },
  { optionA: 'Invisibility', optionB: 'Flight', category: 'Superpowers' },
  { optionA: 'Books', optionB: 'Podcasts', category: 'Media' },
  { optionA: 'City life', optionB: 'Country life', category: 'Lifestyle' },
  { optionA: 'Coffee', optionB: 'Tea', category: 'Drinks' },
  { optionA: 'Early bird', optionB: 'Last minute', category: 'Planning' },
  { optionA: 'Call', optionB: 'Text', category: 'Communication' },
  { optionA: 'Rain', optionB: 'Snow', category: 'Weather' },
  { optionA: 'Cooking', optionB: 'Ordering in', category: 'Food' },
  { optionA: 'Window seat', optionB: 'Aisle seat', category: 'Travel' },
  { optionA: 'Marvel', optionB: 'DC', category: 'Comics' },
  { optionA: 'Pancakes', optionB: 'Waffles', category: 'Breakfast' },
  { optionA: 'Bath', optionB: 'Shower', category: 'Lifestyle' },
  { optionA: 'Socks on', optionB: 'Barefoot', category: 'Comfort' },
  { optionA: 'Ice cream', optionB: 'Cake', category: 'Dessert' },
  { optionA: 'Board games', optionB: 'Video games', category: 'Games' },
  { optionA: 'Sunrise', optionB: 'Sunset', category: 'Nature' },
  { optionA: 'Action movies', optionB: 'Comedy movies', category: 'Movies' },
  { optionA: 'Silence', optionB: 'Background music', category: 'Work' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'lg', position: 'top-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface ThisOrThatData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  optionA: string;
  optionB: string;
  category: string;
  pickMs: number;
  pickedPlayerIds: string[];
  countA: number | null;
  countB: number | null;
  majority: 'A' | 'B' | 'tie' | null;
  unanimous: boolean;
  playerPicks: Record<string, string>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class ThisOrThatGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'thisorthat',
    name: 'This or That',
    description: 'Pick a side! Score by matching the majority.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, string> = {};
  private usedQuestions: number[] = [];
  private currentQuestion: ThisOrThatQuestion | null = null;
  private countA = 0;
  private countB = 0;
  private majority: 'A' | 'B' | 'tie' = 'tie';
  private unanimous = false;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, QUESTIONS.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    if (input.control !== 'A' && input.control !== 'B') return;
    this.playerPicks[playerId] = input.control;

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
    this.countA = 0;
    this.countB = 0;
    this.majority = 'tie';
    this.unanimous = false;

    const available = QUESTIONS.map((_, i) => i).filter((i) => !this.usedQuestions.includes(i));
    const pool = available.length > 0 ? available : QUESTIONS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentQuestion = QUESTIONS[idx]!;
    this.usedQuestions.push(idx);
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    // Count votes
    const picks = Object.values(this.playerPicks);
    this.countA = picks.filter((p) => p === 'A').length;
    this.countB = picks.filter((p) => p === 'B').length;

    if (this.countA > this.countB) this.majority = 'A';
    else if (this.countB > this.countA) this.majority = 'B';
    else this.majority = 'tie';

    this.unanimous = picks.length > 1 && (this.countA === 0 || this.countB === 0);

    // Score: majority voters get points
    for (const [playerId, pick] of Object.entries(this.playerPicks)) {
      if (this.majority === 'tie') {
        // Everyone gets a small consolation
        this.addScore(playerId, 50);
      } else if (pick === this.majority) {
        const elapsed = Date.now() - this.pickStartTime;
        const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
        let pts = MAJORITY_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX);
        if (this.unanimous) pts += UNANIMOUS_BONUS;
        this.addScore(playerId, pts);
      }
    }
  }

  private makeData(): ThisOrThatData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      optionA: this.currentQuestion?.optionA ?? '',
      optionB: this.currentQuestion?.optionB ?? '',
      category: this.currentQuestion?.category ?? '',
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      countA: isReveal ? this.countA : null,
      countB: isReveal ? this.countB : null,
      majority: isReveal ? this.majority : null,
      unanimous: isReveal ? this.unanimous : false,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'thisorthat',
    name: 'This or That',
    description: 'Pick a side! Score by matching the majority.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new ThisOrThatGame(),
);
