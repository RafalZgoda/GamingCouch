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
const PICK_MS = 7_000;
const REVEAL_MS = 2_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface BlitzPuzzle {
  category: string;
  letter: string;
  correct: string;
  distractors: [string, string, string];
}

const PUZZLES: BlitzPuzzle[] = [
  { category: 'Animals', letter: 'P', correct: 'PENGUIN', distractors: ['PICKLE', 'PIANO', 'PILLOW'] },
  { category: 'Fruits', letter: 'M', correct: 'MANGO', distractors: ['MARBLE', 'MAGNET', 'MIRROR'] },
  { category: 'Countries', letter: 'S', correct: 'SWEDEN', distractors: ['SOCCER', 'SANDWICH', 'SILVER'] },
  { category: 'Colors', letter: 'T', correct: 'TURQUOISE', distractors: ['TIGER', 'TRUMPET', 'TRACTOR'] },
  { category: 'Sports', letter: 'B', correct: 'BASEBALL', distractors: ['BLANKET', 'BATTERY', 'BALLOON'] },
  { category: 'Food', letter: 'L', correct: 'LASAGNA', distractors: ['LADDER', 'LAPTOP', 'LANTERN'] },
  { category: 'Cities', letter: 'D', correct: 'DUBLIN', distractors: ['DOLPHIN', 'DIAMOND', 'DONKEY'] },
  { category: 'Movies', letter: 'J', correct: 'JAWS', distractors: ['JUNGLE', 'JACKET', 'JUGGLE'] },
  { category: 'Instruments', letter: 'V', correct: 'VIOLIN', distractors: ['VACUUM', 'VOLCANO', 'VILLAGE'] },
  { category: 'Vehicles', letter: 'H', correct: 'HELICOPTER', distractors: ['HAMMER', 'HONEY', 'HARBOR'] },
  { category: 'Animals', letter: 'G', correct: 'GIRAFFE', distractors: ['GARAGE', 'GARDEN', 'GLACIER'] },
  { category: 'Fruits', letter: 'K', correct: 'KIWI', distractors: ['KETTLE', 'KERNEL', 'KAYAK'] },
  { category: 'Countries', letter: 'N', correct: 'NORWAY', distractors: ['NAPKIN', 'NOODLE', 'NEEDLE'] },
  { category: 'Sports', letter: 'F', correct: 'FENCING', distractors: ['FOSSIL', 'FABRIC', 'FOUNTAIN'] },
  { category: 'Food', letter: 'W', correct: 'WAFFLE', distractors: ['WALLET', 'WHISTLE', 'WRENCH'] },
  { category: 'Cities', letter: 'R', correct: 'ROME', distractors: ['ROBOT', 'ROCKET', 'RIBBON'] },
  { category: 'Animals', letter: 'C', correct: 'CHEETAH', distractors: ['CUSHION', 'CURTAIN', 'CANDLE'] },
  { category: 'Colors', letter: 'I', correct: 'INDIGO', distractors: ['ISLAND', 'INSECT', 'IGLOO'] },
  { category: 'Instruments', letter: 'D', correct: 'DRUM', distractors: ['DESK', 'DICE', 'DOCK'] },
  { category: 'Vehicles', letter: 'S', correct: 'SUBMARINE', distractors: ['SANDWICH', 'SCISSORS', 'STATUE'] },
  { category: 'Movies', letter: 'A', correct: 'AVATAR', distractors: ['ANCHOR', 'APRON', 'ACORN'] },
  { category: 'Countries', letter: 'E', correct: 'EGYPT', distractors: ['ERASER', 'ENGINE', 'ELBOW'] },
  { category: 'Food', letter: 'P', correct: 'PIZZA', distractors: ['PARROT', 'PUDDLE', 'PEBBLE'] },
  { category: 'Sports', letter: 'T', correct: 'TENNIS', distractors: ['TOILET', 'TIMBER', 'TUNNEL'] },
  { category: 'Cities', letter: 'L', correct: 'LONDON', distractors: ['LEMON', 'LIZARD', 'LOCKER'] },
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

export interface CategoryBlitzData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  category: string;
  letter: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class CategoryBlitzGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'categoryblitz',
    name: 'Category Blitz',
    description: 'Pick the item that fits the category and letter!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: BlitzPuzzle | null = null;
  private shuffledOptions: string[] = [];
  private correctIdx = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerPicks[playerId] = idx;

    if (idx === this.correctIdx) {
      const elapsed = Date.now() - this.pickStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    }

    const allPicked = [...this.players.keys()].every((id) => this.playerPicks[id] !== undefined);
    if (allPicked) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'pick') {
      this.pickMs -= deltaMs;
      if (this.pickMs <= 0) this.goToReveal();
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
    this.subPhase = 'pick';
    this.phase = 'active';
    this.playerPicks = {};
    this.pickMs = PICK_MS;
    this.pickStartTime = Date.now();

    const available = PUZZLES.map((_, i) => i).filter((i) => !this.usedPuzzles.includes(i));
    const pool = available.length > 0 ? available : PUZZLES.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPuzzle = PUZZLES[idx]!;
    this.usedPuzzles.push(idx);

    const allOptions = [this.currentPuzzle.correct, ...this.currentPuzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIdx = this.shuffledOptions.indexOf(this.currentPuzzle.correct);
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

  private makeData(): CategoryBlitzData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      category: this.currentPuzzle?.category ?? '',
      letter: this.currentPuzzle?.letter ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'categoryblitz',
    name: 'Category Blitz',
    description: 'Pick the item that fits the category and letter!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new CategoryBlitzGame(),
);
