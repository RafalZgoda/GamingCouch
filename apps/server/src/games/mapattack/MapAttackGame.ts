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
const GUESS_MS = 10_000;
const REVEAL_MS = 3_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Geography questions ──────────────────────────────────────────────────────

interface GeoQuestion {
  emoji: string; // flag or landmark emoji shown on TV
  prompt: string;
  category: 'flag' | 'capital' | 'landmark' | 'continent' | 'fact';
  options: [string, string, string, string]; // correct at [0]
}

const QUESTIONS: GeoQuestion[] = [
  // Flags
  { emoji: '🇫🇷', prompt: 'Which country does this flag belong to?', category: 'flag', options: ['France', 'Italy', 'Belgium', 'Netherlands'] },
  { emoji: '🇯🇵', prompt: 'Which country does this flag belong to?', category: 'flag', options: ['Japan', 'China', 'South Korea', 'Vietnam'] },
  { emoji: '🇧🇷', prompt: 'Which country does this flag belong to?', category: 'flag', options: ['Brazil', 'Portugal', 'Colombia', 'Argentina'] },
  { emoji: '🇨🇦', prompt: 'Which country does this flag belong to?', category: 'flag', options: ['Canada', 'Switzerland', 'Denmark', 'Peru'] },
  { emoji: '🇦🇺', prompt: 'Which country does this flag belong to?', category: 'flag', options: ['Australia', 'New Zealand', 'Fiji', 'UK'] },
  { emoji: '🇮🇳', prompt: 'Which country does this flag belong to?', category: 'flag', options: ['India', 'Ireland', 'Ivory Coast', 'Niger'] },
  { emoji: '🇲🇽', prompt: 'Which country does this flag belong to?', category: 'flag', options: ['Mexico', 'Italy', 'Hungary', 'Ireland'] },
  { emoji: '🇰🇷', prompt: 'Which country does this flag belong to?', category: 'flag', options: ['South Korea', 'Japan', 'Laos', 'Paraguay'] },
  // Capitals
  { emoji: '🏛️', prompt: 'What is the capital of Australia?', category: 'capital', options: ['Canberra', 'Sydney', 'Melbourne', 'Brisbane'] },
  { emoji: '🏛️', prompt: 'What is the capital of Brazil?', category: 'capital', options: ['Brasília', 'São Paulo', 'Rio de Janeiro', 'Salvador'] },
  { emoji: '🏛️', prompt: 'What is the capital of Turkey?', category: 'capital', options: ['Ankara', 'Istanbul', 'Izmir', 'Antalya'] },
  { emoji: '🏛️', prompt: 'What is the capital of Canada?', category: 'capital', options: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'] },
  { emoji: '🏛️', prompt: 'What is the capital of Switzerland?', category: 'capital', options: ['Bern', 'Zurich', 'Geneva', 'Basel'] },
  { emoji: '🏛️', prompt: 'What is the capital of Myanmar?', category: 'capital', options: ['Naypyidaw', 'Yangon', 'Mandalay', 'Bago'] },
  // Landmarks
  { emoji: '🗼', prompt: 'Where is the Eiffel Tower?', category: 'landmark', options: ['Paris, France', 'London, UK', 'Rome, Italy', 'Berlin, Germany'] },
  { emoji: '🗽', prompt: 'Where is the Statue of Liberty?', category: 'landmark', options: ['New York, USA', 'Washington DC', 'Paris, France', 'London, UK'] },
  { emoji: '🏔️', prompt: 'In which country is Mount Everest?', category: 'landmark', options: ['Nepal/China', 'India', 'Pakistan', 'Switzerland'] },
  { emoji: '🎡', prompt: 'Where is the London Eye?', category: 'landmark', options: ['London, UK', 'Paris, France', 'Vienna, Austria', 'Amsterdam, NL'] },
  // Continents / Facts
  { emoji: '🌍', prompt: 'Which is the largest continent by area?', category: 'continent', options: ['Asia', 'Africa', 'North America', 'Europe'] },
  { emoji: '🌊', prompt: 'Which is the largest ocean?', category: 'fact', options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'] },
  { emoji: '🏜️', prompt: 'Which is the largest desert?', category: 'fact', options: ['Sahara', 'Gobi', 'Kalahari', 'Atacama'] },
  { emoji: '🌍', prompt: 'Which country has the most people?', category: 'fact', options: ['India', 'China', 'USA', 'Indonesia'] },
  { emoji: '🌍', prompt: 'Which is the smallest country by area?', category: 'fact', options: ['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein'] },
  { emoji: '🏞️', prompt: 'Which is the longest river?', category: 'fact', options: ['Nile', 'Amazon', 'Yangtze', 'Mississippi'] },
  { emoji: '🌍', prompt: 'How many continents are there?', category: 'fact', options: ['7', '5', '6', '8'] },
  { emoji: '🏝️', prompt: 'Which is the largest island?', category: 'fact', options: ['Greenland', 'Borneo', 'Madagascar', 'New Guinea'] },
];

// ── Controller layout ────────────────────────────────────────────────────────

const ANSWER_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface MapAttackData {
  round: number;
  totalRounds: number;
  phase: 'guess' | 'reveal';
  emoji: string;
  prompt: string;
  category: string;
  options: string[];
  guessMs: number;
  guessedPlayerIds: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  playerGuesses: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class MapAttackGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'mapattack',
    name: 'Map Attack',
    description: 'Geography quiz — flags, capitals, landmarks, and world facts!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'guess' | 'reveal' = 'guess';
  private guessMs = 0;
  private revealMs = 0;
  private guessStartTime = 0;
  private playerGuesses: Record<string, number> = {};
  private usedQuestions: number[] = [];
  private currentQuestion: GeoQuestion | null = null;
  private shuffledOptions: string[] = [];
  private correctIndex = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, QUESTIONS.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: ANSWER_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'guess') return;
    if (this.playerGuesses[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerGuesses[playerId] = idx;

    if (idx === this.correctIndex) {
      const elapsed = Date.now() - this.guessStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / GUESS_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    }

    const allGuessed = [...this.players.keys()].every((id) => this.playerGuesses[id] !== undefined);
    if (allGuessed) {
      this.goToReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'guess') {
      this.guessMs -= deltaMs;
      if (this.guessMs <= 0) {
        this.goToReveal();
      }
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
    this.subPhase = 'guess';
    this.phase = 'active';
    this.playerGuesses = {};
    this.guessMs = GUESS_MS;
    this.guessStartTime = Date.now();

    const available = QUESTIONS.map((_, i) => i).filter((i) => !this.usedQuestions.includes(i));
    const pool = available.length > 0 ? available : QUESTIONS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentQuestion = QUESTIONS[idx]!;
    this.usedQuestions.push(idx);

    // Shuffle options
    this.shuffledOptions = this.shuffle([...this.currentQuestion.options]);
    this.correctIndex = this.shuffledOptions.indexOf(this.currentQuestion.options[0]!);
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

  private makeData(): MapAttackData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      emoji: this.currentQuestion?.emoji ?? '',
      prompt: this.currentQuestion?.prompt ?? '',
      category: this.currentQuestion?.category ?? '',
      options: [...this.shuffledOptions],
      guessMs: Math.max(0, this.guessMs),
      guessedPlayerIds: Object.keys(this.playerGuesses),
      correctIndex: isReveal ? this.correctIndex : null,
      correctAnswer: isReveal ? (this.currentQuestion?.options[0] ?? null) : null,
      playerGuesses: isReveal ? { ...this.playerGuesses } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'mapattack',
    name: 'Map Attack',
    description: 'Geography quiz — flags, capitals, landmarks, and world facts!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new MapAttackGame(),
);
