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
const QUESTION_MS = 4_000; // ultra-fast: 4 seconds
const REVEAL_MS = 1_500;
const CORRECT_POINTS = 150;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface BlitzQuestion {
  question: string;
  options: [string, string, string, string]; // correct at [0]
  category: string;
}

const QUESTIONS: BlitzQuestion[] = [
  { question: 'Capital of France?', options: ['Paris', 'London', 'Berlin', 'Rome'], category: 'Geography' },
  { question: 'Largest ocean?', options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], category: 'Geography' },
  { question: 'H2O is...', options: ['Water', 'Oxygen', 'Hydrogen', 'Carbon'], category: 'Science' },
  { question: 'How many legs does a spider have?', options: ['8', '6', '10', '12'], category: 'Animals' },
  { question: 'Planet closest to the Sun?', options: ['Mercury', 'Venus', 'Mars', 'Earth'], category: 'Space' },
  { question: 'Who painted the Mona Lisa?', options: ['Da Vinci', 'Picasso', 'Van Gogh', 'Monet'], category: 'Art' },
  { question: 'Biggest mammal?', options: ['Blue whale', 'Elephant', 'Giraffe', 'Hippo'], category: 'Animals' },
  { question: 'How many continents?', options: ['7', '5', '6', '8'], category: 'Geography' },
  { question: 'Currency of Japan?', options: ['Yen', 'Won', 'Yuan', 'Rupee'], category: 'General' },
  { question: 'Freezing point of water in °C?', options: ['0', '-10', '10', '32'], category: 'Science' },
  { question: 'Which blood type is universal donor?', options: ['O-', 'AB+', 'A+', 'B-'], category: 'Science' },
  { question: 'Smallest country by area?', options: ['Vatican', 'Monaco', 'Malta', 'Liechtenstein'], category: 'Geography' },
  { question: 'How many strings on a standard guitar?', options: ['6', '4', '8', '5'], category: 'Music' },
  { question: 'What year did WW2 end?', options: ['1945', '1943', '1944', '1946'], category: 'History' },
  { question: 'Chemical symbol for gold?', options: ['Au', 'Ag', 'Fe', 'Cu'], category: 'Science' },
  { question: 'Tallest mountain?', options: ['Everest', 'K2', 'Kilimanjaro', 'Denali'], category: 'Geography' },
  { question: 'How many players in a soccer team?', options: ['11', '9', '10', '12'], category: 'Sports' },
  { question: 'Hardest natural substance?', options: ['Diamond', 'Steel', 'Titanium', 'Quartz'], category: 'Science' },
  { question: 'What does CPU stand for?', options: ['Central Processing Unit', 'Central Power Unit', 'Computer Processing Unit', 'Core Processing Unit'], category: 'Tech' },
  { question: 'Which planet has the most moons?', options: ['Saturn', 'Jupiter', 'Neptune', 'Uranus'], category: 'Space' },
  { question: 'Fastest land animal?', options: ['Cheetah', 'Lion', 'Horse', 'Gazelle'], category: 'Animals' },
  { question: 'How many minutes in a day?', options: ['1440', '1200', '1380', '1560'], category: 'Math' },
  { question: 'Author of Romeo and Juliet?', options: ['Shakespeare', 'Dickens', 'Austen', 'Wilde'], category: 'Literature' },
  { question: 'Primary colors of light?', options: ['Red Green Blue', 'Red Yellow Blue', 'Red Blue White', 'Red Green Yellow'], category: 'Science' },
  { question: 'Longest river in the world?', options: ['Nile', 'Amazon', 'Yangtze', 'Mississippi'], category: 'Geography' },
  { question: 'What element does O represent?', options: ['Oxygen', 'Osmium', 'Oganesson', 'Olive'], category: 'Science' },
  { question: 'How many sides does a hexagon have?', options: ['6', '5', '7', '8'], category: 'Math' },
  { question: 'Capital of Australia?', options: ['Canberra', 'Sydney', 'Melbourne', 'Brisbane'], category: 'Geography' },
  { question: 'Who discovered gravity?', options: ['Newton', 'Einstein', 'Galileo', 'Tesla'], category: 'Science' },
  { question: 'Boiling point of water in °F?', options: ['212', '200', '220', '100'], category: 'Science' },
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

export interface BlitzQuizData {
  round: number;
  totalRounds: number;
  phase: 'question' | 'reveal';
  question: string;
  category: string;
  options: string[];
  questionMs: number;
  answeredPlayerIds: string[];
  correctIndex: number | null;
  playerAnswers: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class BlitzQuizGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'blitzquiz',
    name: 'Blitz Quiz',
    description: 'Lightning-fast trivia — 4 seconds per question! Pure speed, pure knowledge.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'question' | 'reveal' = 'question';
  private questionMs = 0;
  private revealMs = 0;
  private questionStartTime = 0;
  private playerAnswers: Record<string, number> = {};
  private usedQuestions: number[] = [];
  private currentQ: BlitzQuestion | null = null;
  private shuffledOptions: string[] = [];
  private correctIndex = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, QUESTIONS.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: ANSWER_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'question') return;
    if (this.playerAnswers[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerAnswers[playerId] = idx;

    if (idx === this.correctIndex) {
      const elapsed = Date.now() - this.questionStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / QUESTION_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    }

    const allAnswered = [...this.players.keys()].every((id) => this.playerAnswers[id] !== undefined);
    if (allAnswered) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'question') {
      this.questionMs -= deltaMs;
      if (this.questionMs <= 0) this.goToReveal();
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
    this.subPhase = 'question';
    this.phase = 'active';
    this.playerAnswers = {};
    this.questionMs = QUESTION_MS;
    this.questionStartTime = Date.now();

    const available = QUESTIONS.map((_, i) => i).filter((i) => !this.usedQuestions.includes(i));
    const pool = available.length > 0 ? available : QUESTIONS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentQ = QUESTIONS[idx]!;
    this.usedQuestions.push(idx);

    this.shuffledOptions = this.shuffle([...this.currentQ.options]);
    this.correctIndex = this.shuffledOptions.indexOf(this.currentQ.options[0]!);
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

  private makeData(): BlitzQuizData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      question: this.currentQ?.question ?? '',
      category: this.currentQ?.category ?? '',
      options: [...this.shuffledOptions],
      questionMs: Math.max(0, this.questionMs),
      answeredPlayerIds: Object.keys(this.playerAnswers),
      correctIndex: isReveal ? this.correctIndex : null,
      playerAnswers: isReveal ? { ...this.playerAnswers } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'blitzquiz',
    name: 'Blitz Quiz',
    description: 'Lightning-fast trivia — 4 seconds per question! Pure speed, pure knowledge.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new BlitzQuizGame(),
);
