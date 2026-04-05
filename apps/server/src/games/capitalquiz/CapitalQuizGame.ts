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
const REVEAL_MS = 2_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface CapitalPuzzle {
  country: string;
  capital: string;
  distractors: [string, string, string];
  continent: string;
}

const PUZZLES: CapitalPuzzle[] = [
  { country: 'France', capital: 'Paris', distractors: ['Lyon', 'Madrid', 'Brussels'], continent: 'Europe' },
  { country: 'Japan', capital: 'Tokyo', distractors: ['Osaka', 'Kyoto', 'Seoul'], continent: 'Asia' },
  { country: 'Brazil', capital: 'Brasília', distractors: ['São Paulo', 'Rio de Janeiro', 'Buenos Aires'], continent: 'S. America' },
  { country: 'Australia', capital: 'Canberra', distractors: ['Sydney', 'Melbourne', 'Brisbane'], continent: 'Oceania' },
  { country: 'Canada', capital: 'Ottawa', distractors: ['Toronto', 'Vancouver', 'Montreal'], continent: 'N. America' },
  { country: 'Turkey', capital: 'Ankara', distractors: ['Istanbul', 'Izmir', 'Athens'], continent: 'Asia' },
  { country: 'South Africa', capital: 'Pretoria', distractors: ['Cape Town', 'Johannesburg', 'Nairobi'], continent: 'Africa' },
  { country: 'Switzerland', capital: 'Bern', distractors: ['Zurich', 'Geneva', 'Vienna'], continent: 'Europe' },
  { country: 'India', capital: 'New Delhi', distractors: ['Mumbai', 'Kolkata', 'Bangalore'], continent: 'Asia' },
  { country: 'Germany', capital: 'Berlin', distractors: ['Munich', 'Hamburg', 'Frankfurt'], continent: 'Europe' },
  { country: 'Morocco', capital: 'Rabat', distractors: ['Casablanca', 'Marrakech', 'Tunis'], continent: 'Africa' },
  { country: 'New Zealand', capital: 'Wellington', distractors: ['Auckland', 'Christchurch', 'Canberra'], continent: 'Oceania' },
  { country: 'Myanmar', capital: 'Naypyidaw', distractors: ['Yangon', 'Mandalay', 'Bangkok'], continent: 'Asia' },
  { country: 'Nigeria', capital: 'Abuja', distractors: ['Lagos', 'Accra', 'Nairobi'], continent: 'Africa' },
  { country: 'Vietnam', capital: 'Hanoi', distractors: ['Ho Chi Minh City', 'Bangkok', 'Phnom Penh'], continent: 'Asia' },
  { country: 'Italy', capital: 'Rome', distractors: ['Milan', 'Venice', 'Florence'], continent: 'Europe' },
  { country: 'Mexico', capital: 'Mexico City', distractors: ['Cancún', 'Guadalajara', 'Havana'], continent: 'N. America' },
  { country: 'Poland', capital: 'Warsaw', distractors: ['Krakow', 'Prague', 'Budapest'], continent: 'Europe' },
  { country: 'Thailand', capital: 'Bangkok', distractors: ['Chiang Mai', 'Phuket', 'Jakarta'], continent: 'Asia' },
  { country: 'Egypt', capital: 'Cairo', distractors: ['Alexandria', 'Luxor', 'Casablanca'], continent: 'Africa' },
  { country: 'Argentina', capital: 'Buenos Aires', distractors: ['Santiago', 'Montevideo', 'Lima'], continent: 'S. America' },
  { country: 'Spain', capital: 'Madrid', distractors: ['Barcelona', 'Lisbon', 'Seville'], continent: 'Europe' },
  { country: 'South Korea', capital: 'Seoul', distractors: ['Busan', 'Tokyo', 'Pyongyang'], continent: 'Asia' },
  { country: 'Colombia', capital: 'Bogotá', distractors: ['Medellín', 'Cartagena', 'Quito'], continent: 'S. America' },
  { country: 'Kenya', capital: 'Nairobi', distractors: ['Mombasa', 'Kampala', 'Addis Ababa'], continent: 'Africa' },
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

export interface CapitalQuizData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  country: string;
  continent: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  correctCapital: string | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class CapitalQuizGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'capitalquiz',
    name: 'Capital Quiz',
    description: 'Name the capital city! Geography meets speed.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: CapitalPuzzle | null = null;
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

    const allOptions = [this.currentPuzzle.capital, ...this.currentPuzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIdx = this.shuffledOptions.indexOf(this.currentPuzzle.capital);
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

  private makeData(): CapitalQuizData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      country: this.currentPuzzle?.country ?? '',
      continent: this.currentPuzzle?.continent ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
      correctCapital: isReveal ? (this.currentPuzzle?.capital ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'capitalquiz',
    name: 'Capital Quiz',
    description: 'Name the capital city! Geography meets speed.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new CapitalQuizGame(),
);
