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

const BOMB_TIME_MS = 30_000;
const QUESTION_TIME_MS = 6_000;
const REVEAL_MS = 2_000;
const BETWEEN_MS = 1_500;
const CORRECT_POINTS = 100;
const SURVIVE_BONUS = 200;
const LAST_STANDING_BONUS = 500;

// ── Content ──────────────────────────────────────────────────────────────────

interface TFQuestion {
  statement: string;
  answer: boolean; // true = True (A), false = False (B)
  category: string;
}

const QUESTIONS: TFQuestion[] = [
  { statement: 'The Great Wall of China is visible from space', answer: false, category: 'Myth' },
  { statement: 'Octopuses have three hearts', answer: true, category: 'Animals' },
  { statement: 'Lightning never strikes the same place twice', answer: false, category: 'Myth' },
  { statement: 'Honey never spoils', answer: true, category: 'Food' },
  { statement: 'Humans use only 10% of their brain', answer: false, category: 'Myth' },
  { statement: 'Venus is the hottest planet in our solar system', answer: true, category: 'Space' },
  { statement: 'Goldfish have a 3-second memory', answer: false, category: 'Myth' },
  { statement: 'Bananas are berries', answer: true, category: 'Food' },
  { statement: 'The Eiffel Tower grows taller in summer', answer: true, category: 'Science' },
  { statement: 'Bats are blind', answer: false, category: 'Myth' },
  { statement: 'A group of flamingos is called a flamboyance', answer: true, category: 'Animals' },
  { statement: 'Mount Everest is the tallest mountain from base to peak', answer: false, category: 'Geography' },
  { statement: 'Sharks are older than trees', answer: true, category: 'Nature' },
  { statement: 'The human body has 206 bones', answer: true, category: 'Science' },
  { statement: 'Diamonds are made from compressed coal', answer: false, category: 'Myth' },
  { statement: 'A day on Venus is longer than a year on Venus', answer: true, category: 'Space' },
  { statement: 'Elephants are the only animals that cannot jump', answer: false, category: 'Animals' },
  { statement: 'Water drains counterclockwise in the southern hemisphere', answer: false, category: 'Myth' },
  { statement: 'Oxford University is older than the Aztec Empire', answer: true, category: 'History' },
  { statement: 'Strawberries are not actual berries', answer: true, category: 'Food' },
  { statement: 'Sound travels faster in water than in air', answer: true, category: 'Science' },
  { statement: 'The Amazon River is the longest river in the world', answer: false, category: 'Geography' },
  { statement: 'Cleopatra lived closer in time to the Moon landing than to the building of the pyramids', answer: true, category: 'History' },
  { statement: 'Penguins can fly short distances', answer: false, category: 'Animals' },
  { statement: 'Glass is a liquid that flows very slowly', answer: false, category: 'Myth' },
  { statement: 'Scotland\'s national animal is the unicorn', answer: true, category: 'Fun Facts' },
  { statement: 'An ostrich\'s eye is bigger than its brain', answer: true, category: 'Animals' },
  { statement: 'The tongue is the strongest muscle in the body', answer: false, category: 'Myth' },
  { statement: 'Wombat poop is cube-shaped', answer: true, category: 'Animals' },
  { statement: 'Mars has the tallest volcano in the solar system', answer: true, category: 'Space' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const TF_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'TRUE', color: '#22c55e', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'FALSE', color: '#ef4444', size: 'md', position: 'top-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface TimeBombData {
  round: number;
  phase: 'question' | 'reveal' | 'between' | 'explode';
  bombMs: number;
  questionMs: number;
  statement: string;
  category: string;
  activePlayerId: string | null;
  turnOrder: string[];
  eliminated: string[];
  answered: boolean;
  correctAnswer: boolean | null;
  playerAnswer: boolean | null;
  wasCorrect: boolean | null;
  explodedPlayerId: string | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class TimeBombGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'timebomb',
    name: 'Time Bomb Trivia',
    description: 'True or false under pressure — the bomb is ticking! Wrong answer = boom!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'question' | 'reveal' | 'between' | 'explode' = 'question';
  private bombMs = BOMB_TIME_MS;
  private questionMs = QUESTION_TIME_MS;
  private revealMs = 0;
  private betweenMs = 0;
  private explodeMs = 0;
  private turnOrder: string[] = [];
  private turnIndex = 0;
  private eliminated: string[] = [];
  private usedQuestions: number[] = [];
  private currentQuestion: TFQuestion | null = null;
  private playerAnswer: boolean | null = null;
  private wasCorrect: boolean | null = null;
  private explodedPlayerId: string | null = null;

  protected onInit(players: Player[]): GameState {
    this.turnOrder = this.shuffle(players.filter((p) => !p.isHost).map((p) => p.id));
    this.totalRounds = 99; // game ends by elimination
    this.startQuestion();
    return { ...this.buildState(this.makeData()), controllerLayout: TF_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'question') return;
    if (playerId !== this.getActivePlayerId()) return;
    if (this.playerAnswer !== null) return;

    if (input.control === 'A') this.playerAnswer = true;
    else if (input.control === 'B') this.playerAnswer = false;
    else return;

    this.wasCorrect = this.playerAnswer === this.currentQuestion?.answer;

    if (this.wasCorrect) {
      this.addScore(playerId, CORRECT_POINTS);
    }

    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'question') {
      this.bombMs -= deltaMs;
      this.questionMs -= deltaMs;

      // Individual question timeout — treat as wrong
      if (this.questionMs <= 0) {
        this.playerAnswer = null;
        this.wasCorrect = false;
        this.subPhase = 'reveal';
        this.revealMs = REVEAL_MS;
      }

      // Bomb explodes
      if (this.bombMs <= 0) {
        this.explodedPlayerId = this.getActivePlayerId();
        this.eliminated.push(this.explodedPlayerId!);
        this.subPhase = 'explode';
        this.explodeMs = 3_000;
      }

      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'reveal') {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) {
        if (!this.wasCorrect) {
          // Wrong answer — bomb explodes on this player
          this.explodedPlayerId = this.getActivePlayerId();
          this.eliminated.push(this.explodedPlayerId!);
          this.subPhase = 'explode';
          this.explodeMs = 3_000;
        } else {
          this.subPhase = 'between';
          this.betweenMs = BETWEEN_MS;
        }
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'explode') {
      this.explodeMs -= deltaMs;
      if (this.explodeMs <= 0) {
        const alive = this.turnOrder.filter((id) => !this.eliminated.includes(id));
        if (alive.length <= 1) {
          // Game over
          if (alive.length === 1) {
            this.addScore(alive[0]!, LAST_STANDING_BONUS);
          }
          for (const id of alive) {
            this.addScore(id, SURVIVE_BONUS);
          }
          this.phase = 'results';
          return this.buildState(this.makeData());
        }
        // Reset bomb, continue
        this.bombMs = BOMB_TIME_MS;
        this.advanceTurn();
        this.startQuestion();
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'between') {
      this.betweenMs -= deltaMs;
      if (this.betweenMs <= 0) {
        this.advanceTurn();
        this.round++;
        this.startQuestion();
      }
      return this.buildState(this.makeData());
    }

    return this.buildState(this.makeData());
  }

  private getActivePlayerId(): string | null {
    const alive = this.turnOrder.filter((id) => !this.eliminated.includes(id));
    if (alive.length === 0) return null;
    return alive[this.turnIndex % alive.length] ?? null;
  }

  private advanceTurn(): void {
    const alive = this.turnOrder.filter((id) => !this.eliminated.includes(id));
    if (alive.length > 0) {
      this.turnIndex = (this.turnIndex + 1) % alive.length;
    }
  }

  private startQuestion(): void {
    this.subPhase = 'question';
    this.playerAnswer = null;
    this.wasCorrect = null;
    this.explodedPlayerId = null;
    this.questionMs = QUESTION_TIME_MS;

    const available = QUESTIONS.map((_, i) => i).filter((i) => !this.usedQuestions.includes(i));
    const pool = available.length > 0 ? available : QUESTIONS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentQuestion = QUESTIONS[idx]!;
    this.usedQuestions.push(idx);
  }

  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private makeData(): TimeBombData {
    const isRevealOrLater = this.subPhase === 'reveal' || this.subPhase === 'explode';
    return {
      round: this.round,
      phase: this.subPhase,
      bombMs: Math.max(0, this.bombMs),
      questionMs: Math.max(0, this.questionMs),
      statement: this.currentQuestion?.statement ?? '',
      category: this.currentQuestion?.category ?? '',
      activePlayerId: this.getActivePlayerId(),
      turnOrder: this.turnOrder.filter((id) => !this.eliminated.includes(id)),
      eliminated: [...this.eliminated],
      answered: this.playerAnswer !== null,
      correctAnswer: isRevealOrLater ? (this.currentQuestion?.answer ?? null) : null,
      playerAnswer: isRevealOrLater ? this.playerAnswer : null,
      wasCorrect: isRevealOrLater ? this.wasCorrect : null,
      explodedPlayerId: this.explodedPlayerId,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'timebomb',
    name: 'Time Bomb Trivia',
    description: 'True or false under pressure — the bomb is ticking! Wrong answer = boom!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new TimeBombGame(),
);
