import type { Player, ControllerInputEvent, GameState, GameDefinition, ControllerLayout } from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

// ── Word bank ──────────────────────────────────────────────────────────────────

const WORDS = [
  'PLANET', 'JUNGLE', 'ROCKET', 'CANDLE', 'BRIDGE', 'FROZEN', 'GOBLIN',
  'LIZARD', 'MUFFIN', 'PILLOW', 'CASTLE', 'DRAGON', 'RABBIT', 'SPIDER',
  'TROPHY', 'VIOLIN', 'WALLET', 'YELLOW', 'ZOMBIE', 'ANCHOR', 'BUTTON',
  'CACTUS', 'DONKEY', 'FUDGE', 'GRAVEL', 'HELMET', 'IGLOO', 'JACKET',
  'KITTEN', 'LEMON', 'MAGNET', 'NOODLE', 'ORANGE', 'PICKLE', 'QUARTZ',
];

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUNDS = 8;
const ROUND_MS = 15_000;
const REVEAL_MS = 3_000;
const SCORE_FIRST = 1000;
const SCORE_SECOND = 600;
const SCORE_THIRD = 300;
const SCORE_REST = 100;
const WRONG_PENALTY = 200;

const ANSWER_SCORES = [SCORE_FIRST, SCORE_SECOND, SCORE_THIRD, SCORE_REST];

// ── Controller layout (A/B/C/D) ───────────────────────────────────────────────

const SCRAMBLE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

// ── Public state shape ────────────────────────────────────────────────────────

export interface WordScrambleData {
  scrambled: string;
  options: string[];            // [A, B, C, D]
  correctIndex: number;
  round: number;
  totalRounds: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  /** Only present during round_end */
  playerAnswers?: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scrambleWord(word: string): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  // Avoid returning the original word as the scrambled version
  const result = arr.join('');
  return result === word ? scrambleWord(word) : result;
}

function pickDistractors(correct: string, pool: string[], count: number): string[] {
  const candidates = pool.filter((w) => w !== correct);
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Game implementation ───────────────────────────────────────────────────────

export class WordScrambleGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'wordscramble',
    name: 'Word Scramble',
    description: 'Unscramble the letters and pick the correct word first!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private word = '';
  private scrambled = '';
  private options: string[] = [];
  private correctIndex = 0;
  private timeMs = 0;
  private revealMs = 0;
  private isRevealing = false;
  private playerAnswers = new Map<string, number>(); // playerId → chosen index
  private correctOrder: string[] = [];               // ordered by who answered correctly first
  private usedWords: Set<string> = new Set();

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = ROUNDS;
    this.startRound();
    return this.currentState();
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isRevealing || this.phase !== 'active') return;
    if (this.playerAnswers.has(playerId)) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerAnswers.set(playerId, idx);
    if (idx === this.correctIndex) {
      this.correctOrder.push(playerId);
    }

    if (this.playerAnswers.size >= this.players.size) {
      this.startReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
    } else if (this.phase === 'active') {
      this.timeMs -= deltaMs;
      if (this.timeMs <= 0) {
        this.timeMs = 0;
        this.startReveal();
      }
    }
    return this.currentState();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private startRound(): void {
    const available = WORDS.filter((w) => !this.usedWords.has(w));
    const pool = available.length > 0 ? available : WORDS;
    const idx = Math.floor(Math.random() * pool.length);
    this.word = pool[idx]!;
    this.usedWords.add(this.word);

    this.scrambled = scrambleWord(this.word);
    const distractors = pickDistractors(this.word, WORDS, 3);
    const options = [this.word, ...distractors].sort(() => Math.random() - 0.5);
    this.correctIndex = options.indexOf(this.word);
    this.options = options;

    this.timeMs = ROUND_MS;
    this.revealMs = 0;
    this.isRevealing = false;
    this.playerAnswers = new Map();
    this.correctOrder = [];
    this.phase = 'active';
  }

  private startReveal(): void {
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const roundScores: Record<string, number> = {};

    // Award points to correct answerers in order
    for (let i = 0; i < this.correctOrder.length; i++) {
      const playerId = this.correctOrder[i]!;
      const pts = ANSWER_SCORES[i] ?? ANSWER_SCORES[ANSWER_SCORES.length - 1]!;
      roundScores[playerId] = pts;
      this.addScore(playerId, pts);
    }

    // Penalize wrong answers
    for (const [playerId, chosenIdx] of this.playerAnswers) {
      if (chosenIdx !== this.correctIndex) {
        roundScores[playerId] = -WRONG_PENALTY;
        this.addScore(playerId, -WRONG_PENALTY);
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

  private currentState(): GameState {
    const answeredPlayerIds = [...this.playerAnswers.keys()];
    const data: WordScrambleData = {
      scrambled: this.scrambled,
      options: this.options,
      correctIndex: this.isRevealing ? this.correctIndex : -1,
      round: this.round,
      totalRounds: this.totalRounds,
      timeRemainingMs: Math.max(0, this.timeMs),
      answeredPlayerIds,
      ...(this.isRevealing && {
        playerAnswers: Object.fromEntries(this.playerAnswers),
      }),
    };

    return {
      ...this.buildState(data),
      controllerLayout: SCRAMBLE_LAYOUT,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'wordscramble',
    name: 'Word Scramble',
    description: 'Unscramble the letters and pick the correct word first!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  () => new WordScrambleGame(),
);
