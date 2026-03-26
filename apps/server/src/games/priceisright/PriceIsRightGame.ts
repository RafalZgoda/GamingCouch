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
const GUESS_WINDOW_MS = 10_000;
const REVEAL_MS = 4_000;
const CORRECT_POINTS = 200;
const CLOSE_POINTS = 100;
const SPEED_BONUS_MAX = 100;

// ── Questions database ──────────────────────────────────────────────────────

interface PriceQuestion {
  prompt: string;
  category: string;
  answer: number;
  unit: string;
  ranges: [string, string, string, string];
  correctIndex: number;
  closeIndex: number | null; // adjacent range that gets partial credit
}

const QUESTIONS: PriceQuestion[] = [
  { prompt: 'Height of the Eiffel Tower', category: 'Landmarks', answer: 330, unit: 'meters', ranges: ['100-200m', '200-300m', '300-400m', '400-500m'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Year the Internet was invented', category: 'History', answer: 1969, unit: '', ranges: ['1945-1955', '1955-1965', '1965-1975', '1975-1985'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Population of Australia', category: 'Geography', answer: 26, unit: 'million', ranges: ['10-15M', '16-20M', '21-30M', '31-40M'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Speed of light', category: 'Science', answer: 300000, unit: 'km/s', ranges: ['100K km/s', '200K km/s', '300K km/s', '400K km/s'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Number of bones in the human body', category: 'Biology', answer: 206, unit: 'bones', ranges: ['106', '156', '206', '256'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Average depth of the ocean', category: 'Geography', answer: 3688, unit: 'meters', ranges: ['1-2 km', '2-3 km', '3-4 km', '4-5 km'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Weight of a blue whale', category: 'Animals', answer: 150, unit: 'tons', ranges: ['50-80 tons', '80-120 tons', '120-170 tons', '170-220 tons'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Distance from Earth to the Moon', category: 'Space', answer: 384400, unit: 'km', ranges: ['184K km', '284K km', '384K km', '484K km'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Boiling point of water on Mt Everest', category: 'Science', answer: 70, unit: '°C', ranges: ['50-60°C', '60-75°C', '75-85°C', '85-95°C'], correctIndex: 1, closeIndex: 2 },
  { prompt: 'Number of countries in Africa', category: 'Geography', answer: 54, unit: 'countries', ranges: ['34', '44', '54', '64'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Age of the universe', category: 'Space', answer: 13800, unit: 'million years', ranges: ['4.6B yrs', '9.8B yrs', '13.8B yrs', '18.2B yrs'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Length of the Great Wall of China', category: 'Landmarks', answer: 21196, unit: 'km', ranges: ['5K km', '10K km', '15K km', '21K km'], correctIndex: 3, closeIndex: 2 },
  { prompt: 'Temperature at the Sun\'s surface', category: 'Space', answer: 5500, unit: '°C', ranges: ['1500°C', '3500°C', '5500°C', '7500°C'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Year the first iPhone launched', category: 'Tech', answer: 2007, unit: '', ranges: ['2003', '2005', '2007', '2009'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'World record 100m sprint time', category: 'Sports', answer: 9.58, unit: 'seconds', ranges: ['8.5-9.0s', '9.0-9.5s', '9.5-10.0s', '10.0-10.5s'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Number of teeth an adult human has', category: 'Biology', answer: 32, unit: 'teeth', ranges: ['24', '28', '32', '36'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Height of Mount Everest', category: 'Geography', answer: 8849, unit: 'meters', ranges: ['6849m', '7849m', '8849m', '9849m'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Number of Harry Potter books', category: 'Pop Culture', answer: 7, unit: 'books', ranges: ['5', '6', '7', '8'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Year the Titanic sank', category: 'History', answer: 1912, unit: '', ranges: ['1898', '1905', '1912', '1920'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Diameter of Earth', category: 'Science', answer: 12742, unit: 'km', ranges: ['6700 km', '9700 km', '12700 km', '15700 km'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Top speed of a cheetah', category: 'Animals', answer: 120, unit: 'km/h', ranges: ['70-85 km/h', '85-100 km/h', '100-120 km/h', '120-140 km/h'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Number of elements in the periodic table', category: 'Science', answer: 118, unit: 'elements', ranges: ['98', '108', '118', '128'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Year humans first walked on the Moon', category: 'History', answer: 1969, unit: '', ranges: ['1963', '1966', '1969', '1972'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Average human heart beats per minute', category: 'Biology', answer: 72, unit: 'bpm', ranges: ['50-60', '60-70', '70-80', '80-90'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Number of rings on the Olympic flag', category: 'Sports', answer: 5, unit: 'rings', ranges: ['3', '4', '5', '6'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Length of a marathon', category: 'Sports', answer: 42, unit: 'km', ranges: ['32 km', '37 km', '42 km', '47 km'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Number of strings on a guitar', category: 'Music', answer: 6, unit: 'strings', ranges: ['4', '5', '6', '8'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Year World War II ended', category: 'History', answer: 1945, unit: '', ranges: ['1939', '1942', '1945', '1948'], correctIndex: 2, closeIndex: 1 },
  { prompt: 'Number of players on a soccer team', category: 'Sports', answer: 11, unit: 'players', ranges: ['7', '9', '11', '13'], correctIndex: 2, closeIndex: 3 },
  { prompt: 'Wingspan of a Boeing 747', category: 'Tech', answer: 64, unit: 'meters', ranges: ['44m', '54m', '64m', '74m'], correctIndex: 2, closeIndex: 1 },
];

// ── Game ─────────────────────────────────────────────────────────────────────

export class PriceIsRightGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'priceisright',
    name: 'Price is Right',
    description: 'Guess the closest value — everyone is terrible at estimating!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private shuffledQuestions: PriceQuestion[] = [];
  private currentQuestion!: PriceQuestion;
  private guessWindowMs = GUESS_WINDOW_MS;
  private revealMs = 0;
  private isReveal = false;
  private playerGuesses: Record<string, number> = {};
  private guessTimestamps: Record<string, number> = {};

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(this.configRounds, QUESTIONS.length);
    this.shuffledQuestions = [...QUESTIONS].sort(() => Math.random() - 0.5);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: this.makeLayout() };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isReveal) return;
    if (this.playerGuesses[playerId] !== undefined) return;
    const indexMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const idx = indexMap[input.control];
    if (idx === undefined) return;
    this.playerGuesses[playerId] = idx;
    this.guessTimestamps[playerId] = this.guessWindowMs;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isReveal) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.buildState(this.makeData());
    }

    this.guessWindowMs -= deltaMs;
    const allGuessed = [...this.players.keys()].every((id) => this.playerGuesses[id] !== undefined);

    if (this.guessWindowMs <= 0 || allGuessed) {
      this.resolveRound();
    }

    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.currentQuestion = this.shuffledQuestions[this.round - 1]!;
    this.guessWindowMs = GUESS_WINDOW_MS;
    this.isReveal = false;
    this.playerGuesses = {};
    this.guessTimestamps = {};
    this.phase = 'active';
  }

  private resolveRound(): void {
    this.isReveal = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    for (const id of this.players.keys()) {
      const guess = this.playerGuesses[id];
      if (guess === undefined) continue;

      if (guess === this.currentQuestion.correctIndex) {
        const speedFraction = (this.guessTimestamps[id] ?? 0) / GUESS_WINDOW_MS;
        const speedBonus = Math.round(speedFraction * SPEED_BONUS_MAX);
        this.addScore(id, CORRECT_POINTS + speedBonus);
      } else if (guess === this.currentQuestion.closeIndex) {
        this.addScore(id, CLOSE_POINTS);
      }
    }
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private makeLayout(): ControllerLayout {
    const q = this.currentQuestion;
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
    const positions: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    return {
      controls: q.ranges.map((range, i) => ({
        type: 'button' as const,
        id: ['A', 'B', 'C', 'D'][i]!,
        label: range,
        color: colors[i]!,
        size: 'md' as const,
        position: positions[i]!,
      })),
    };
  }

  private makeData() {
    const q = this.currentQuestion;
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      prompt: q.prompt,
      category: q.category,
      unit: q.unit,
      ranges: [...q.ranges],
      guessWindowMs: Math.max(0, this.guessWindowMs),
      guessedPlayerIds: Object.keys(this.playerGuesses),
      isReveal: this.isReveal,
      correctIndex: this.isReveal ? q.correctIndex : null,
      closeIndex: this.isReveal ? q.closeIndex : null,
      answer: this.isReveal ? q.answer : null,
      playerGuesses: this.isReveal ? { ...this.playerGuesses } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'priceisright',
    name: 'Price is Right',
    description: 'Guess the closest value — everyone is terrible at estimating!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new PriceIsRightGame(config),
);
