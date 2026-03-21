import type {
  Player,
  ControllerInputEvent,
  GameState,
  GameDefinition,
  ControllerLayout,
} from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

// ── Question bank ─────────────────────────────────────────────────────────────

interface TriviaQuestion {
  question: string;
  options: string[];    // exactly 4
  correctIndex: number; // 0–3
}

const QUESTION_BANK: TriviaQuestion[] = [
  { question: 'What is the capital of France?', options: ['London', 'Berlin', 'Paris', 'Madrid'], correctIndex: 2 },
  { question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correctIndex: 1 },
  { question: 'What planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Saturn', 'Mars'], correctIndex: 3 },
  { question: "Which element has the chemical symbol 'O'?", options: ['Gold', 'Oxygen', 'Osmium', 'Oganesson'], correctIndex: 1 },
  { question: 'What is 7 × 8?', options: ['54', '56', '58', '62'], correctIndex: 1 },
  { question: 'Who wrote Romeo and Juliet?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correctIndex: 1 },
  { question: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3 },
  { question: 'How many colors are in a rainbow?', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correctIndex: 2 },
  { question: 'Which country invented pizza?', options: ['France', 'Greece', 'Spain', 'Italy'], correctIndex: 3 },
  { question: 'What is the approximate speed of light?', options: ['100,000 km/s', '200,000 km/s', '300,000 km/s', '400,000 km/s'], correctIndex: 2 },
  { question: 'Which programming language was created by Guido van Rossum?', options: ['Java', 'Ruby', 'Python', 'Perl'], correctIndex: 2 },
  { question: 'How many planets are in our solar system?', options: ['7', '8', '9', '10'], correctIndex: 1 },
  { question: 'What is the chemical formula for water?', options: ['H2O2', 'HO', 'H2O', 'H3O'], correctIndex: 2 },
  { question: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], correctIndex: 2 },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const QUESTION_TIME_MS = 20_000; // 20 s to answer
const REVEAL_TIME_MS = 4_000;    // 4 s showing the correct answer
const BASE_POINTS = 1000;
const SPEED_BONUS_MAX = 500;
const QUESTIONS_PER_GAME = 10;

// ── Controller layout ─────────────────────────────────────────────────────────

const TRIVIA_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

// ── Public state shape (consumed by host display) ─────────────────────────────

export interface TriviaData {
  question: string;
  options: string[];
  questionIndex: number;
  totalQuestions: number;
  timeRemainingMs: number;
  /** IDs of players who have already submitted an answer this round */
  answeredPlayerIds: string[];
  /** Only present during round_end phase */
  correctAnswer?: number;
  /** playerId → answer index; only present during round_end phase */
  playerAnswers?: Record<string, number>;
}

// ── Game implementation ───────────────────────────────────────────────────────

export class TriviaGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'trivia',
    name: 'Trivia',
    description: 'Answer questions correctly and fast to score points!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private questions: TriviaQuestion[] = [];
  private currentQuestionIndex = 0;
  private timerMs = 0;
  private revealTimerMs = 0;
  private playerAnswers = new Map<string, number>();   // playerId → answer index
  private answerTimestamps = new Map<string, number>(); // playerId → ms elapsed when answered
  private questionStartMs = 0;
  private isRevealing = false;
  private currentRoundScores: Record<string, number> = {};

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    const shuffled = [...QUESTION_BANK].sort(() => Math.random() - 0.5);
    this.questions = shuffled.slice(0, QUESTIONS_PER_GAME);
    this.totalRounds = this.questions.length;
    this.currentQuestionIndex = 0;
    this.startQuestion();
    return this.currentState();
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (this.phase !== 'active') return;
    if (this.playerAnswers.has(playerId)) return; // already answered
    if (input.action !== 'button_down') return;

    const answerMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const answerIndex = answerMap[input.control];
    if (answerIndex === undefined) return;

    const elapsed = Date.now() - this.questionStartMs;
    this.playerAnswers.set(playerId, answerIndex);
    this.answerTimestamps.set(playerId, elapsed);

    // All players answered — reveal immediately
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
    this.timerMs = QUESTION_TIME_MS;
    this.revealTimerMs = 0;
    this.playerAnswers = new Map();
    this.answerTimestamps = new Map();
    this.questionStartMs = Date.now();
    this.isRevealing = false;
    this.currentRoundScores = {};
    this.phase = 'active';
    this.round = this.currentQuestionIndex + 1;
  }

  private startReveal(): void {
    const question = this.questions[this.currentQuestionIndex]!;
    this.isRevealing = true;
    this.revealTimerMs = REVEAL_TIME_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    for (const [playerId, answerIndex] of this.playerAnswers) {
      if (answerIndex === question.correctIndex) {
        const elapsed = this.answerTimestamps.get(playerId) ?? QUESTION_TIME_MS;
        const speedFraction = Math.max(0, 1 - elapsed / QUESTION_TIME_MS);
        const points = BASE_POINTS + Math.round(SPEED_BONUS_MAX * speedFraction);
        this.currentRoundScores[playerId] = points;
        this.addScore(playerId, points);
      }
    }
  }

  private advanceQuestion(): void {
    this.currentQuestionIndex++;
    if (this.currentQuestionIndex >= this.questions.length) {
      this.phase = 'results';
    } else {
      this.startQuestion();
    }
  }

  private currentState(): GameState {
    const question = this.questions[this.currentQuestionIndex];

    const data: TriviaData = question
      ? {
          question: question.question,
          options: question.options,
          questionIndex: this.currentQuestionIndex,
          totalQuestions: this.questions.length,
          timeRemainingMs: Math.max(0, this.timerMs),
          answeredPlayerIds: [...this.playerAnswers.keys()],
          ...(this.isRevealing && {
            correctAnswer: question.correctIndex,
            playerAnswers: Object.fromEntries(this.playerAnswers),
          }),
        }
      : {
          question: '',
          options: [],
          questionIndex: this.currentQuestionIndex,
          totalQuestions: this.questions.length,
          timeRemainingMs: 0,
          answeredPlayerIds: [],
        };

    return {
      ...this.buildState(data, this.currentRoundScores),
      controllerLayout: TRIVIA_LAYOUT,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'trivia',
    name: 'Trivia',
    description: 'Answer questions correctly and fast to score points!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  () => new TriviaGame(),
);
