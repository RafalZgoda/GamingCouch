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

type Difficulty = 'easy' | 'medium' | 'hard';

interface TriviaQuestion {
  question: string;
  options: string[];    // exactly 4
  correctIndex: number; // 0–3
  difficulty: Difficulty;
}

const QUESTION_BANK: TriviaQuestion[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { difficulty: 'easy', question: 'What is the capital of France?', options: ['London', 'Berlin', 'Paris', 'Madrid'], correctIndex: 2 },
  { difficulty: 'easy', question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correctIndex: 1 },
  { difficulty: 'easy', question: 'What planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Saturn', 'Mars'], correctIndex: 3 },
  { difficulty: 'easy', question: "Which element has the chemical symbol 'O'?", options: ['Gold', 'Oxygen', 'Osmium', 'Oganesson'], correctIndex: 1 },
  { difficulty: 'easy', question: 'What is 7 × 8?', options: ['54', '56', '58', '62'], correctIndex: 1 },
  { difficulty: 'easy', question: 'Who wrote Romeo and Juliet?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correctIndex: 1 },
  { difficulty: 'easy', question: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3 },
  { difficulty: 'easy', question: 'How many colors are in a rainbow?', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { difficulty: 'easy', question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correctIndex: 2 },
  { difficulty: 'easy', question: 'Which country invented pizza?', options: ['France', 'Greece', 'Spain', 'Italy'], correctIndex: 3 },
  { difficulty: 'easy', question: 'What is the chemical formula for water?', options: ['H2O2', 'HO', 'H2O', 'H3O'], correctIndex: 2 },
  { difficulty: 'easy', question: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], correctIndex: 2 },
  { difficulty: 'easy', question: 'What is the fastest animal on land?', options: ['Lion', 'Cheetah', 'Horse', 'Greyhound'], correctIndex: 1 },
  { difficulty: 'easy', question: 'How many legs does a spider have?', options: ['6', '8', '10', '12'], correctIndex: 1 },
  { difficulty: 'easy', question: 'Which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], correctIndex: 2 },
  { difficulty: 'easy', question: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { difficulty: 'easy', question: 'What is the largest planet in our solar system?', options: ['Saturn', 'Uranus', 'Neptune', 'Jupiter'], correctIndex: 3 },
  { difficulty: 'easy', question: 'Which animal is known as the King of the Jungle?', options: ['Tiger', 'Elephant', 'Lion', 'Gorilla'], correctIndex: 2 },
  { difficulty: 'easy', question: 'How many months have 31 days?', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { difficulty: 'easy', question: 'What is the capital of Spain?', options: ['Barcelona', 'Seville', 'Madrid', 'Valencia'], correctIndex: 2 },

  // ── Medium ─────────────────────────────────────────────────────────────────
  { difficulty: 'medium', question: 'What is the approximate speed of light?', options: ['100,000 km/s', '200,000 km/s', '300,000 km/s', '400,000 km/s'], correctIndex: 2 },
  { difficulty: 'medium', question: 'Which programming language was created by Guido van Rossum?', options: ['Java', 'Ruby', 'Python', 'Perl'], correctIndex: 2 },
  { difficulty: 'medium', question: 'How many planets are in our solar system?', options: ['7', '8', '9', '10'], correctIndex: 1 },
  { difficulty: 'medium', question: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], correctIndex: 2 },
  { difficulty: 'medium', question: 'Which element has the chemical symbol Fe?', options: ['Fluorine', 'Iron', 'Francium', 'Fermium'], correctIndex: 1 },
  { difficulty: 'medium', question: 'What year was the Eiffel Tower built?', options: ['1879', '1886', '1889', '1895'], correctIndex: 2 },
  { difficulty: 'medium', question: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], correctIndex: 2 },
  { difficulty: 'medium', question: 'What is the smallest prime number?', options: ['0', '1', '2', '3'], correctIndex: 2 },
  { difficulty: 'medium', question: 'In what country is the Amazon River primarily located?', options: ['Peru', 'Colombia', 'Brazil', 'Venezuela'], correctIndex: 2 },
  { difficulty: 'medium', question: 'What is the most spoken language in the world by native speakers?', options: ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'], correctIndex: 2 },
  { difficulty: 'medium', question: 'How many bones are in the adult human body?', options: ['186', '196', '206', '216'], correctIndex: 2 },
  { difficulty: 'medium', question: 'Which country has the most natural lakes?', options: ['USA', 'Russia', 'Canada', 'Finland'], correctIndex: 2 },
  { difficulty: 'medium', question: 'What is the currency of Japan?', options: ['Won', 'Yuan', 'Yen', 'Baht'], correctIndex: 2 },
  { difficulty: 'medium', question: 'Who developed the theory of general relativity?', options: ['Isaac Newton', 'Nikola Tesla', 'Albert Einstein', 'Stephen Hawking'], correctIndex: 2 },
  { difficulty: 'medium', question: 'What is the largest desert in the world?', options: ['Sahara', 'Arabian', 'Gobi', 'Antarctic'], correctIndex: 3 },
  { difficulty: 'medium', question: 'How many strings does a standard guitar have?', options: ['4', '5', '6', '7'], correctIndex: 2 },
  { difficulty: 'medium', question: 'What is the chemical symbol for gold?', options: ['Go', 'Gd', 'Au', 'Ag'], correctIndex: 2 },
  { difficulty: 'medium', question: 'Which country is home to the Great Barrier Reef?', options: ['Brazil', 'Indonesia', 'Australia', 'Philippines'], correctIndex: 2 },
  { difficulty: 'medium', question: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Vacuole'], correctIndex: 2 },
  { difficulty: 'medium', question: 'In what year did the Berlin Wall fall?', options: ['1987', '1988', '1989', '1991'], correctIndex: 2 },

  // ── Hard ──────────────────────────────────────────────────────────────────
  { difficulty: 'hard', question: 'Which country has the longest coastline in the world?', options: ['Russia', 'Australia', 'Canada', 'Norway'], correctIndex: 2 },
  { difficulty: 'hard', question: "What is the most abundant gas in Earth's atmosphere?", options: ['Oxygen', 'Argon', 'Carbon Dioxide', 'Nitrogen'], correctIndex: 3 },
  { difficulty: 'hard', question: 'Who was the first woman to win a Nobel Prize?', options: ['Rosalind Franklin', 'Marie Curie', 'Lise Meitner', 'Dorothy Hodgkin'], correctIndex: 1 },
  { difficulty: 'hard', question: 'What is the square root of 169?', options: ['11', '12', '13', '14'], correctIndex: 2 },
  { difficulty: 'hard', question: 'In which century did the Byzantine Empire fall?', options: ['13th', '14th', '15th', '16th'], correctIndex: 2 },
  { difficulty: 'hard', question: 'What is the derivative of sin(x)?', options: ['-sin(x)', 'cos(x)', '-cos(x)', 'tan(x)'], correctIndex: 1 },
  { difficulty: 'hard', question: 'Which element has atomic number 79?', options: ['Silver', 'Platinum', 'Mercury', 'Gold'], correctIndex: 3 },
  { difficulty: 'hard', question: 'What does DNA stand for?', options: ['Deoxyribonucleic Acid', 'Diribonucleic Acid', 'Deoxyribonitric Acid', 'Dinitroribonucleic Acid'], correctIndex: 0 },
  { difficulty: 'hard', question: 'In which year did the Chernobyl disaster occur?', options: ['1984', '1985', '1986', '1987'], correctIndex: 2 },
  { difficulty: 'hard', question: 'What is the speed of sound in air at 20°C (approx)?', options: ['243 m/s', '303 m/s', '343 m/s', '383 m/s'], correctIndex: 2 },
  { difficulty: 'hard', question: "Which mathematician proved Fermat's Last Theorem in 1994?", options: ['John Nash', 'Andrew Wiles', 'Paul Erdős', 'Terence Tao'], correctIndex: 1 },
  { difficulty: 'hard', question: 'What is the smallest country in the world by area?', options: ['Monaco', 'Nauru', 'Vatican City', 'Liechtenstein'], correctIndex: 2 },
  { difficulty: 'hard', question: 'How many valence electrons does carbon have?', options: ['2', '4', '6', '8'], correctIndex: 1 },
  { difficulty: 'hard', question: 'What is the name of the deepest lake in the world?', options: ['Lake Superior', 'Lake Tanganyika', 'Caspian Sea', 'Lake Baikal'], correctIndex: 3 },
  { difficulty: 'hard', question: 'What is the half-life of Carbon-14 (approx)?', options: ['1,730 years', '5,730 years', '14,300 years', '57,300 years'], correctIndex: 1 },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const QUESTION_TIME_MS: Record<Difficulty, number> = {
  easy: 20_000,
  medium: 15_000,
  hard: 12_000,
};
const REVEAL_TIME_MS = 4_000;
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
  difficulty: Difficulty;
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

  private readonly difficulty: Difficulty;
  private readonly questionTimeMs: number;
  private readonly configRounds: number;
  private questions: TriviaQuestion[] = [];
  private currentQuestionIndex = 0;
  private timerMs = 0;
  private revealTimerMs = 0;
  private playerAnswers = new Map<string, number>();   // playerId → answer index
  private answerTimestamps = new Map<string, number>(); // playerId → ms elapsed when answered
  private questionStartMs = 0;
  private isRevealing = false;
  private currentRoundScores: Record<string, number> = {};

  constructor(config?: Record<string, unknown>) {
    super();
    const raw = config?.difficulty;
    this.difficulty = (raw === 'easy' || raw === 'medium' || raw === 'hard') ? raw : 'medium';
    this.questionTimeMs = QUESTION_TIME_MS[this.difficulty];
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : QUESTIONS_PER_GAME;
  }

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    const pool = QUESTION_BANK.filter((q) => q.difficulty === this.difficulty);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    this.questions = shuffled.slice(0, Math.min(this.configRounds, shuffled.length));
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
    this.timerMs = this.questionTimeMs;
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
        const elapsed = this.answerTimestamps.get(playerId) ?? this.questionTimeMs;
        const speedFraction = Math.max(0, 1 - elapsed / this.questionTimeMs);
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
          difficulty: this.difficulty,
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
          difficulty: this.difficulty,
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
  (config) => new TriviaGame(config),
);
