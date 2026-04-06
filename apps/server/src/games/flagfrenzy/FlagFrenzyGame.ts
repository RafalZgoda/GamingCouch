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
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface FlagPuzzle {
  flag: string;
  correct: string;
  distractors: [string, string, string];
  continent: string;
}

const PUZZLES: FlagPuzzle[] = [
  { flag: '🇧🇷', correct: 'Brazil', distractors: ['Portugal', 'Colombia', 'Mexico'], continent: 'South America' },
  { flag: '🇯🇵', correct: 'Japan', distractors: ['South Korea', 'China', 'Bangladesh'], continent: 'Asia' },
  { flag: '🇨🇦', correct: 'Canada', distractors: ['Switzerland', 'Peru', 'Denmark'], continent: 'North America' },
  { flag: '🇦🇺', correct: 'Australia', distractors: ['New Zealand', 'Fiji', 'United Kingdom'], continent: 'Oceania' },
  { flag: '🇲🇽', correct: 'Mexico', distractors: ['Italy', 'Ireland', 'Hungary'], continent: 'North America' },
  { flag: '🇩🇪', correct: 'Germany', distractors: ['Belgium', 'Luxembourg', 'Netherlands'], continent: 'Europe' },
  { flag: '🇮🇳', correct: 'India', distractors: ['Niger', 'Ireland', 'Ivory Coast'], continent: 'Asia' },
  { flag: '🇰🇷', correct: 'South Korea', distractors: ['Japan', 'Laos', 'Cambodia'], continent: 'Asia' },
  { flag: '🇫🇷', correct: 'France', distractors: ['Netherlands', 'Russia', 'Luxembourg'], continent: 'Europe' },
  { flag: '🇮🇹', correct: 'Italy', distractors: ['Ireland', 'Mexico', 'Ivory Coast'], continent: 'Europe' },
  { flag: '🇪🇸', correct: 'Spain', distractors: ['Portugal', 'Andorra', 'Ecuador'], continent: 'Europe' },
  { flag: '🇬🇧', correct: 'United Kingdom', distractors: ['Australia', 'Iceland', 'Norway'], continent: 'Europe' },
  { flag: '🇷🇺', correct: 'Russia', distractors: ['France', 'Netherlands', 'Luxembourg'], continent: 'Europe' },
  { flag: '🇨🇳', correct: 'China', distractors: ['Vietnam', 'Turkey', 'Morocco'], continent: 'Asia' },
  { flag: '🇦🇷', correct: 'Argentina', distractors: ['Uruguay', 'Honduras', 'Guatemala'], continent: 'South America' },
  { flag: '🇹🇷', correct: 'Turkey', distractors: ['Tunisia', 'Pakistan', 'Algeria'], continent: 'Europe' },
  { flag: '🇸🇪', correct: 'Sweden', distractors: ['Finland', 'Denmark', 'Ukraine'], continent: 'Europe' },
  { flag: '🇳🇴', correct: 'Norway', distractors: ['Iceland', 'Finland', 'Denmark'], continent: 'Europe' },
  { flag: '🇿🇦', correct: 'South Africa', distractors: ['Kenya', 'Ghana', 'Ethiopia'], continent: 'Africa' },
  { flag: '🇪🇬', correct: 'Egypt', distractors: ['Syria', 'Iraq', 'Yemen'], continent: 'Africa' },
  { flag: '🇳🇬', correct: 'Nigeria', distractors: ['Ghana', 'Cameroon', 'Senegal'], continent: 'Africa' },
  { flag: '🇹🇭', correct: 'Thailand', distractors: ['Costa Rica', 'Cambodia', 'Laos'], continent: 'Asia' },
  { flag: '🇨🇭', correct: 'Switzerland', distractors: ['Denmark', 'Tonga', 'Austria'], continent: 'Europe' },
  { flag: '🇵🇹', correct: 'Portugal', distractors: ['Spain', 'Brazil', 'Angola'], continent: 'Europe' },
  { flag: '🇬🇷', correct: 'Greece', distractors: ['Uruguay', 'Israel', 'Honduras'], continent: 'Europe' },
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

export interface FlagFrenzyData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  flag: string;
  continent: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class FlagFrenzyGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'flagfrenzy',
    name: 'Flag Frenzy',
    description: 'Guess which country a flag belongs to!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: FlagPuzzle[] = [];
  private current!: FlagPuzzle;
  private options: string[] = [];
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

  private makeData(): FlagFrenzyData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      flag: this.current.flag,
      continent: this.current.continent,
      options: this.options,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    const all = [this.current.correct, ...this.current.distractors];
    this.options = this.shuffle(all);
    this.correctIdx = this.options.indexOf(this.current.correct);
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
  { id: 'flagfrenzy', name: 'Flag Frenzy', description: 'Guess which country a flag belongs to!', minPlayers: 1, maxPlayers: 100 },
  () => new FlagFrenzyGame(),
);
