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

const DEFAULT_ROUNDS = 10;
const PICK_MS = 6_000;
const REVEAL_MS = 2_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface LetterPuzzle {
  word: string;
  options: [number, number, number, number];
  category: string;
}

const PUZZLES: LetterPuzzle[] = [
  { word: 'RHYTHM', options: [5, 6, 7, 8], category: 'Words' },
  { word: 'QUEUE', options: [4, 5, 6, 7], category: 'Words' },
  { word: 'MISSISSIPPI', options: [9, 10, 11, 12], category: 'Geography' },
  { word: 'NECESSARY', options: [8, 9, 10, 11], category: 'Words' },
  { word: 'Wednesday', options: [8, 9, 10, 11], category: 'Days' },
  { word: 'BUREAUCRACY', options: [10, 11, 12, 13], category: 'Words' },
  { word: 'ONOMATOPOEIA', options: [11, 12, 13, 14], category: 'Words' },
  { word: 'RESTAURANT', options: [9, 10, 11, 12], category: 'Places' },
  { word: 'CZECHOSLOVAKIA', options: [12, 13, 14, 15], category: 'Geography' },
  { word: 'PNEUMONIA', options: [8, 9, 10, 11], category: 'Science' },
  { word: 'PHARAOH', options: [6, 7, 8, 9], category: 'History' },
  { word: 'SILHOUETTE', options: [9, 10, 11, 12], category: 'Art' },
  { word: 'BEAUTIFUL', options: [8, 9, 10, 11], category: 'Words' },
  { word: 'HIPPOPOTAMUS', options: [11, 12, 13, 14], category: 'Animals' },
  { word: 'ALPHABET', options: [7, 8, 9, 10], category: 'Words' },
  { word: 'FEBRUARY', options: [7, 8, 9, 10], category: 'Months' },
  { word: 'BROCCOLI', options: [7, 8, 9, 10], category: 'Food' },
  { word: 'DIARRHEA', options: [7, 8, 9, 10], category: 'Words' },
  { word: 'SURVEILLANCE', options: [11, 12, 13, 14], category: 'Words' },
  { word: 'INDEPENDENT', options: [10, 11, 12, 13], category: 'Words' },
  { word: 'ACHIEVEMENT', options: [10, 11, 12, 13], category: 'Words' },
  { word: 'SQUIRREL', options: [7, 8, 9, 10], category: 'Animals' },
  { word: 'LIGHTNING', options: [8, 9, 10, 11], category: 'Nature' },
  { word: 'THOROUGHLY', options: [9, 10, 11, 12], category: 'Words' },
  { word: 'ANTIDISESTABLISHMENTARIANISM', options: [26, 27, 28, 29], category: 'Words' },
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

export interface LetterCountData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  word: string;
  category: string;
  options: number[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  letterCount: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class LetterCountGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'lettercount',
    name: 'Letter Count',
    description: 'How many letters in the word?',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: LetterPuzzle[] = [];
  private current!: LetterPuzzle;
  private correctIdx = 0;
  private pickTimer = PICK_MS;
  private revealTimer = REVEAL_MS;
  private pickedPlayers = new Set<string>();
  private roundPhase: 'pick' | 'reveal' = 'pick';

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private makeData(): LetterCountData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      word: this.current.word,
      category: this.current.category,
      options: [...this.current.options],
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
      letterCount: this.roundPhase === 'reveal' ? this.current.word.length : null,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    this.correctIdx = this.current.options.indexOf(this.current.word.length);
    this.pickTimer = PICK_MS;
    this.revealTimer = REVEAL_MS;
    this.pickedPlayers.clear();
    this.roundPhase = 'pick';
    this.phase = 'active';
  }

  protected onInit(_players: Player[]): GameState {
    this.pool = this.shuffle(PUZZLES).slice(0, DEFAULT_ROUNDS);
    this.totalRounds = this.pool.length;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.roundPhase !== 'pick') return;
    if (this.pickedPlayers.has(playerId)) return;

    this.pickedPlayers.add(playerId);
    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === this.correctIdx) {
      const bonus = Math.round((this.pickTimer / PICK_MS) * SPEED_BONUS_MAX);
      this.addScore(playerId, CORRECT_POINTS + bonus);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.phase === 'results') return this.buildState(this.makeData());

    if (this.roundPhase === 'pick') {
      this.pickTimer = Math.max(0, this.pickTimer - deltaMs);
      if (this.pickTimer <= 0 || this.pickedPlayers.size >= this.players.size) {
        this.roundPhase = 'reveal';
      }
    } else {
      this.revealTimer -= deltaMs;
      if (this.revealTimer <= 0) {
        this.advanceRound();
        if (this.round > this.totalRounds) {
          this.phase = 'results';
        } else {
          this.startRound();
        }
      }
    }

    return this.buildState(this.makeData());
  }
}

GameRegistry.register(
  { id: 'lettercount', name: 'Letter Count', description: 'How many letters in the word?', minPlayers: 1, maxPlayers: 100 },
  () => new LetterCountGame(),
);
