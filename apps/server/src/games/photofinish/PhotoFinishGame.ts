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

const FINISH_LINE = 10; // steps to win
const ANSWER_MS = 8_000;
const REVEAL_MS = 2_500;
const MAX_ROUNDS = 20; // safety cap
const CORRECT_ADVANCE = 2;
const WRONG_PENALTY_STEPS = 1;
const CORRECT_POINTS = 100;
const SPEED_BONUS_MAX = 50;
const WINNER_BONUS = 500;

// ── Trivia questions ─────────────────────────────────────────────────────────

interface RaceQuestion {
  question: string;
  category: string;
  options: [string, string, string, string]; // correct at [0]
}

const QUESTIONS: RaceQuestion[] = [
  { question: 'What planet is closest to the Sun?', category: 'Space', options: ['Mercury', 'Venus', 'Mars', 'Jupiter'] },
  { question: 'How many legs does a spider have?', category: 'Animals', options: ['8', '6', '10', '12'] },
  { question: 'What is the chemical symbol for water?', category: 'Science', options: ['H₂O', 'CO₂', 'NaCl', 'O₂'] },
  { question: 'Which country hosted the 2020 Olympics?', category: 'Sports', options: ['Japan', 'China', 'Brazil', 'UK'] },
  { question: 'What is the hardest natural substance?', category: 'Science', options: ['Diamond', 'Titanium', 'Quartz', 'Steel'] },
  { question: 'Who painted the Mona Lisa?', category: 'Art', options: ['Leonardo da Vinci', 'Michelangelo', 'Picasso', 'Van Gogh'] },
  { question: 'How many bones in the adult human body?', category: 'Science', options: ['206', '186', '226', '256'] },
  { question: 'What is the capital of Japan?', category: 'Geography', options: ['Tokyo', 'Osaka', 'Kyoto', 'Seoul'] },
  { question: 'Which gas do plants absorb?', category: 'Science', options: ['CO₂', 'O₂', 'N₂', 'H₂'] },
  { question: 'How many strings on a standard guitar?', category: 'Music', options: ['6', '4', '8', '5'] },
  { question: 'What year did World War II end?', category: 'History', options: ['1945', '1943', '1944', '1946'] },
  { question: 'Which is the longest bone in the body?', category: 'Science', options: ['Femur', 'Tibia', 'Humerus', 'Spine'] },
  { question: 'What is the speed of light?', category: 'Science', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '1M km/s'] },
  { question: 'Which animal is the tallest?', category: 'Animals', options: ['Giraffe', 'Elephant', 'Ostrich', 'Camel'] },
  { question: 'What color is a ruby?', category: 'General', options: ['Red', 'Blue', 'Green', 'Purple'] },
  { question: 'How many sides has a hexagon?', category: 'Math', options: ['6', '5', '7', '8'] },
  { question: 'Which ocean is the deepest?', category: 'Geography', options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'] },
  { question: 'Who wrote Romeo and Juliet?', category: 'Literature', options: ['Shakespeare', 'Dickens', 'Austen', 'Hemingway'] },
  { question: 'What is the boiling point of water?', category: 'Science', options: ['100°C', '90°C', '110°C', '120°C'] },
  { question: 'Which planet has the most moons?', category: 'Space', options: ['Saturn', 'Jupiter', 'Neptune', 'Uranus'] },
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

export interface PhotoFinishData {
  round: number;
  phase: 'answer' | 'reveal';
  finishLine: number;
  question: string;
  category: string;
  options: string[];
  answerMs: number;
  answeredPlayerIds: string[];
  correctIndex: number | null;
  playerAnswers: Record<string, number>;
  positions: Record<string, number>;
  winnerId: string | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class PhotoFinishGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'photofinish',
    name: 'Photo Finish',
    description: 'Trivia race — correct answers advance you, wrong ones slow you down!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'answer' | 'reveal' = 'answer';
  private answerMs = 0;
  private revealMs = 0;
  private answerStartTime = 0;
  private playerAnswers: Record<string, number> = {};
  private positions: Record<string, number> = {};
  private usedQuestions: number[] = [];
  private currentQuestion: RaceQuestion | null = null;
  private shuffledOptions: string[] = [];
  private correctIndex = -1;
  private winnerId: string | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = MAX_ROUNDS;
    for (const id of this.players.keys()) {
      this.positions[id] = 0;
    }
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: ANSWER_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'answer') return;
    if (this.playerAnswers[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerAnswers[playerId] = idx;

    if (idx === this.correctIndex) {
      this.positions[playerId] = Math.min(FINISH_LINE, (this.positions[playerId] ?? 0) + CORRECT_ADVANCE);
      const elapsed = Date.now() - this.answerStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / ANSWER_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    } else {
      this.positions[playerId] = Math.max(0, (this.positions[playerId] ?? 0) - WRONG_PENALTY_STEPS);
    }

    const allAnswered = [...this.players.keys()].every((id) => this.playerAnswers[id] !== undefined);
    if (allAnswered) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'answer') {
      this.answerMs -= deltaMs;
      if (this.answerMs <= 0) this.goToReveal();
      return this.buildState(this.makeData());
    }

    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      // Check for winner
      for (const [id, pos] of Object.entries(this.positions)) {
        if (pos >= FINISH_LINE) {
          this.winnerId = id;
          this.addScore(id, WINNER_BONUS);
          this.phase = 'results';
          return this.buildState(this.makeData());
        }
      }

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
    this.subPhase = 'answer';
    this.phase = 'active';
    this.playerAnswers = {};
    this.answerMs = ANSWER_MS;
    this.answerStartTime = Date.now();

    const available = QUESTIONS.map((_, i) => i).filter((i) => !this.usedQuestions.includes(i));
    const pool = available.length > 0 ? available : QUESTIONS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentQuestion = QUESTIONS[idx]!;
    this.usedQuestions.push(idx);

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

  private makeData(): PhotoFinishData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      phase: this.subPhase,
      finishLine: FINISH_LINE,
      question: this.currentQuestion?.question ?? '',
      category: this.currentQuestion?.category ?? '',
      options: [...this.shuffledOptions],
      answerMs: Math.max(0, this.answerMs),
      answeredPlayerIds: Object.keys(this.playerAnswers),
      correctIndex: isReveal ? this.correctIndex : null,
      playerAnswers: isReveal ? { ...this.playerAnswers } : {},
      positions: { ...this.positions },
      winnerId: this.winnerId,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'photofinish',
    name: 'Photo Finish',
    description: 'Trivia race — correct answers advance you, wrong ones slow you down!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new PhotoFinishGame(),
);
