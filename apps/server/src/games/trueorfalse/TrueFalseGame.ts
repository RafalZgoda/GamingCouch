import type {
  Player,
  ControllerInputEvent,
  GameState,
  GameDefinition,
  ControllerLayout,
} from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

// ── Question bank ──────────────────────────────────────────────────────────────

interface TrueFalseQuestion {
  statement: string;
  isTrue: boolean;
  category: string;
}

const QUESTIONS: TrueFalseQuestion[] = [
  // Science
  { category: 'Science', statement: 'The sun is a star.', isTrue: true },
  { category: 'Science', statement: 'Lightning never strikes the same place twice.', isTrue: false },
  { category: 'Science', statement: 'A day on Venus is longer than a year on Venus.', isTrue: true },
  { category: 'Science', statement: 'Humans use only 10% of their brain.', isTrue: false },
  { category: 'Science', statement: 'Sound travels faster in water than in air.', isTrue: true },
  { category: 'Science', statement: 'Diamonds are made of compressed coal.', isTrue: false },
  { category: 'Science', statement: 'Hot water can freeze faster than cold water under certain conditions.', isTrue: true },
  { category: 'Science', statement: 'The Great Wall of China is visible from space with the naked eye.', isTrue: false },
  { category: 'Science', statement: 'Bats are blind.', isTrue: false },
  { category: 'Science', statement: 'Oxygen is the most abundant gas in Earth\'s atmosphere.', isTrue: false },
  // History
  { category: 'History', statement: 'Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.', isTrue: true },
  { category: 'History', statement: 'Napoleon Bonaparte was extremely short for his time.', isTrue: false },
  { category: 'History', statement: 'The Berlin Wall fell in 1989.', isTrue: true },
  { category: 'History', statement: 'The Titanic sank on its maiden voyage.', isTrue: true },
  { category: 'History', statement: 'World War I started in 1918.', isTrue: false },
  { category: 'History', statement: 'The Eiffel Tower was originally intended to be a temporary structure.', isTrue: true },
  { category: 'History', statement: 'Ancient Egyptians were the first to invent the wheel.', isTrue: false },
  // Nature
  { category: 'Nature', statement: 'A group of flamingos is called a flamboyance.', isTrue: true },
  { category: 'Nature', statement: 'Octopuses have three hearts.', isTrue: true },
  { category: 'Nature', statement: 'Sharks are mammals.', isTrue: false },
  { category: 'Nature', statement: 'Honey never expires.', isTrue: true },
  { category: 'Nature', statement: 'Penguins live in the Arctic.', isTrue: false },
  { category: 'Nature', statement: 'A snail can sleep for up to 3 years.', isTrue: true },
  { category: 'Nature', statement: 'Tigers have striped skin, not just striped fur.', isTrue: true },
  { category: 'Nature', statement: 'Goldfish have a 3-second memory.', isTrue: false },
  // Pop Culture
  { category: 'Pop Culture', statement: 'The Harry Potter series has 8 books.', isTrue: false },
  { category: 'Pop Culture', statement: 'Darth Vader says "Luke, I am your father" in The Empire Strikes Back.', isTrue: false },
  { category: 'Pop Culture', statement: 'The Simpsons first aired in 1989.', isTrue: true },
  { category: 'Pop Culture', statement: 'Mario\'s full name is Mario Mario.', isTrue: true },
  // Geography
  { category: 'Geography', statement: 'Australia is both a country and a continent.', isTrue: true },
  { category: 'Geography', statement: 'The Amazon River flows through Brazil.', isTrue: true },
  { category: 'Geography', statement: 'Canada is the second largest country in the world by area.', isTrue: true },
  { category: 'Geography', statement: 'The Sahara is the largest desert in the world.', isTrue: false },
  { category: 'Geography', statement: 'The capital of Australia is Sydney.', isTrue: false },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const ANSWER_TIME_MS = 15_000;
const REVEAL_TIME_MS = 3_000;
const BASE_POINTS = 1000;
const SPEED_BONUS_MAX = 500;
const QUESTIONS_PER_GAME = 10;

// ── Controller layout ─────────────────────────────────────────────────────────

const TRUEFALSE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'TRUE', label: '✓ TRUE', color: '#22c55e', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'FALSE', label: '✗ FALSE', color: '#ef4444', size: 'lg', position: 'top-right' },
  ],
};

// ── Public state shape ────────────────────────────────────────────────────────

export interface TrueFalseData {
  statement: string;
  category: string;
  questionIndex: number;
  totalQuestions: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  correctAnswer?: boolean;
  playerAnswers?: Record<string, boolean>;
}

// ── Game implementation ───────────────────────────────────────────────────────

export class TrueFalseGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'trueorfalse',
    name: 'True or False',
    description: 'Is the statement true or false? Answer fast to score more points!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private questions: TrueFalseQuestion[] = [];
  private currentIndex = 0;
  private timerMs = 0;
  private revealTimerMs = 0;
  private playerAnswers = new Map<string, boolean>();
  private answerTimestamps = new Map<string, number>();
  private questionStartMs = 0;
  private isRevealing = false;
  private currentRoundScores: Record<string, number> = {};

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(3, Math.round(r))) : QUESTIONS_PER_GAME;
  }

  protected onInit(_players: Player[]): GameState {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
    this.questions = shuffled.slice(0, Math.min(this.configRounds, shuffled.length));
    this.totalRounds = this.questions.length;
    this.currentIndex = 0;
    this.startQuestion();
    return this.currentState();
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (this.phase !== 'active') return;
    if (this.playerAnswers.has(playerId)) return;
    if (input.action !== 'button_down') return;
    if (input.control !== 'TRUE' && input.control !== 'FALSE') return;

    const elapsed = Date.now() - this.questionStartMs;
    const answer = input.control === 'TRUE';
    this.playerAnswers.set(playerId, answer);
    this.answerTimestamps.set(playerId, elapsed);

    if (this.playerAnswers.size >= this.players.size) {
      this.startReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealTimerMs -= deltaMs;
      if (this.revealTimerMs <= 0) this.advanceQuestion();
    } else if (this.phase === 'active') {
      this.timerMs -= deltaMs;
      if (this.timerMs <= 0) {
        this.timerMs = 0;
        this.startReveal();
      }
    }
    return this.currentState();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startQuestion(): void {
    this.timerMs = ANSWER_TIME_MS;
    this.revealTimerMs = 0;
    this.playerAnswers = new Map();
    this.answerTimestamps = new Map();
    this.questionStartMs = Date.now();
    this.isRevealing = false;
    this.currentRoundScores = {};
    this.phase = 'active';
    this.round = this.currentIndex + 1;
  }

  private startReveal(): void {
    const question = this.questions[this.currentIndex]!;
    this.isRevealing = true;
    this.revealTimerMs = REVEAL_TIME_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    for (const [playerId, answer] of this.playerAnswers) {
      if (answer === question.isTrue) {
        const elapsed = this.answerTimestamps.get(playerId) ?? ANSWER_TIME_MS;
        const speedFraction = Math.max(0, 1 - elapsed / ANSWER_TIME_MS);
        const points = BASE_POINTS + Math.round(SPEED_BONUS_MAX * speedFraction);
        this.currentRoundScores[playerId] = points;
        this.addScore(playerId, points);
      }
    }
  }

  private advanceQuestion(): void {
    this.currentIndex++;
    if (this.currentIndex >= this.questions.length) {
      this.phase = 'results';
    } else {
      this.startQuestion();
    }
  }

  private currentState(): GameState {
    const question = this.questions[this.currentIndex];

    const data: TrueFalseData = question
      ? {
          statement: question.statement,
          category: question.category,
          questionIndex: this.currentIndex,
          totalQuestions: this.questions.length,
          timeRemainingMs: Math.max(0, this.timerMs),
          answeredPlayerIds: [...this.playerAnswers.keys()],
          ...(this.isRevealing && {
            correctAnswer: question.isTrue,
            playerAnswers: Object.fromEntries(
              [...this.playerAnswers.entries()].map(([id, v]) => [id, v]),
            ),
          }),
        }
      : {
          statement: '',
          category: '',
          questionIndex: this.currentIndex,
          totalQuestions: this.questions.length,
          timeRemainingMs: 0,
          answeredPlayerIds: [],
        };

    return {
      ...this.buildState(data, this.currentRoundScores),
      controllerLayout: TRUEFALSE_LAYOUT,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'trueorfalse',
    name: 'True or False',
    description: 'Is the statement true or false? Answer fast to score more points!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  (config) => new TrueFalseGame(config),
);
