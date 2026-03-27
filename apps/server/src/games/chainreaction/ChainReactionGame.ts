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
const PICK_MS = 8_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;
const CHAIN_BONUS = 50; // bonus per consecutive correct in a chain set

// ── Content ──────────────────────────────────────────────────────────────────

interface ChainPuzzle {
  /** The starting word shown on TV */
  start: string;
  /** The correct next compound word */
  answer: string;
  /** The full compound (start+answer) */
  compound: string;
  /** 3 distractors */
  distractors: [string, string, string];
  /** Hint shown after reveal */
  hint: string;
}

const PUZZLES: ChainPuzzle[] = [
  { start: 'Sun', answer: 'Flower', compound: 'Sunflower', distractors: ['Light', 'Burn', 'Set'], hint: '🌻' },
  { start: 'Fire', answer: 'Fly', compound: 'Firefly', distractors: ['Place', 'Work', 'Truck'], hint: '✨' },
  { start: 'Rain', answer: 'Bow', compound: 'Rainbow', distractors: ['Drop', 'Coat', 'Storm'], hint: '🌈' },
  { start: 'Star', answer: 'Fish', compound: 'Starfish', distractors: ['Light', 'Dust', 'Board'], hint: '⭐🐟' },
  { start: 'Snow', answer: 'Ball', compound: 'Snowball', distractors: ['Flake', 'Man', 'Board'], hint: '❄️⚽' },
  { start: 'Book', answer: 'Worm', compound: 'Bookworm', distractors: ['Shelf', 'Mark', 'Case'], hint: '📚🐛' },
  { start: 'Tooth', answer: 'Paste', compound: 'Toothpaste', distractors: ['Brush', 'Ache', 'Fairy'], hint: '🦷' },
  { start: 'Cup', answer: 'Cake', compound: 'Cupcake', distractors: ['Board', 'Handle', 'Tea'], hint: '🧁' },
  { start: 'Butter', answer: 'Fly', compound: 'Butterfly', distractors: ['Cup', 'Milk', 'Scotch'], hint: '🦋' },
  { start: 'Water', answer: 'Fall', compound: 'Waterfall', distractors: ['Melon', 'Proof', 'Color'], hint: '💧⬇️' },
  { start: 'Pan', answer: 'Cake', compound: 'Pancake', distractors: ['Handle', 'Fry', 'Dora'], hint: '🥞' },
  { start: 'Foot', answer: 'Ball', compound: 'Football', distractors: ['Print', 'Note', 'Step'], hint: '⚽' },
  { start: 'Basket', answer: 'Ball', compound: 'Basketball', distractors: ['Case', 'Weave', 'Hound'], hint: '🏀' },
  { start: 'Pine', answer: 'Apple', compound: 'Pineapple', distractors: ['Cone', 'Tree', 'Needle'], hint: '🍍' },
  { start: 'Eye', answer: 'Brow', compound: 'Eyebrow', distractors: ['Lash', 'Ball', 'Sight'], hint: '👁️' },
  { start: 'Pop', answer: 'Corn', compound: 'Popcorn', distractors: ['Star', 'Music', 'Art'], hint: '🍿' },
  { start: 'Straw', answer: 'Berry', compound: 'Strawberry', distractors: ['Hat', 'Man', 'Poll'], hint: '🍓' },
  { start: 'Jelly', answer: 'Fish', compound: 'Jellyfish', distractors: ['Bean', 'Roll', 'Belly'], hint: '🪼' },
  { start: 'Dragon', answer: 'Fly', compound: 'Dragonfly', distractors: ['Fire', 'Scale', 'Fruit'], hint: '🐉' },
  { start: 'Key', answer: 'Board', compound: 'Keyboard', distractors: ['Chain', 'Ring', 'Hole'], hint: '⌨️' },
  { start: 'Lip', answer: 'Stick', compound: 'Lipstick', distractors: ['Gloss', 'Balm', 'Sync'], hint: '💄' },
  { start: 'Bed', answer: 'Room', compound: 'Bedroom', distractors: ['Bug', 'Sheet', 'Time'], hint: '🛏️' },
  { start: 'Moon', answer: 'Light', compound: 'Moonlight', distractors: ['Shine', 'Walk', 'Stone'], hint: '🌙💡' },
  { start: 'Day', answer: 'Dream', compound: 'Daydream', distractors: ['Light', 'Break', 'Time'], hint: '☀️💭' },
  { start: 'Black', answer: 'Berry', compound: 'Blackberry', distractors: ['Board', 'Bird', 'Out'], hint: '🫐' },
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

export interface ChainReactionData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  startWord: string;
  hint: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  compound: string | null;
  playerPicks: Record<string, number>;
  streak: Record<string, number>; // per-player current streak
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class ChainReactionGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'chainreaction',
    name: 'Chain Reaction',
    description: 'Complete the compound word! Sun + ??? = Sunflower. Build streaks for bonus points.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private playerStreaks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: ChainPuzzle | null = null;
  private shuffledOptions: string[] = [];
  private correctIndex = -1;

  protected onInit(players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    for (const p of players) this.playerStreaks[p.id] = 0;
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

    if (idx === this.correctIndex) {
      this.playerStreaks[playerId] = (this.playerStreaks[playerId] ?? 0) + 1;
      const elapsed = Date.now() - this.pickStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
      const streakBonus = CHAIN_BONUS * (this.playerStreaks[playerId] ?? 1);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX) + streakBonus);
    } else {
      this.playerStreaks[playerId] = 0;
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

    // Reset streaks for players who timed out last round
    for (const id of this.players.keys()) {
      if (this.round > 1 && this.playerPicks[id] === undefined) {
        this.playerStreaks[id] = 0;
      }
    }

    const available = PUZZLES.map((_, i) => i).filter((i) => !this.usedPuzzles.includes(i));
    const pool = available.length > 0 ? available : PUZZLES.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPuzzle = PUZZLES[idx]!;
    this.usedPuzzles.push(idx);

    const allOptions = [this.currentPuzzle.answer, ...this.currentPuzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIndex = this.shuffledOptions.indexOf(this.currentPuzzle.answer);
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    // Break streaks for those who didn't answer
    for (const id of this.players.keys()) {
      if (this.playerPicks[id] === undefined) {
        this.playerStreaks[id] = 0;
      }
    }
  }

  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private makeData(): ChainReactionData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      startWord: this.currentPuzzle?.start ?? '',
      hint: isReveal ? (this.currentPuzzle?.hint ?? '') : '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIndex : null,
      compound: isReveal ? (this.currentPuzzle?.compound ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
      streak: { ...this.playerStreaks },
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'chainreaction',
    name: 'Chain Reaction',
    description: 'Complete the compound word! Sun + ??? = Sunflower. Build streaks for bonus points.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new ChainReactionGame(),
);
