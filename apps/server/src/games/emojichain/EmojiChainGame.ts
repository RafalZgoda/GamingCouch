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
const PICK_MS = 10_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 250;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface EmojiChainPuzzle {
  emojis: string;
  hint: string;
  correct: string;
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: EmojiChainPuzzle[] = [
  { emojis: '🌻🌞🔥', hint: 'What word links all three?', correct: 'Sun', distractors: ['Fire', 'Light', 'Heat'], category: 'Nature' },
  { emojis: '❄️🏔️⛷️', hint: 'What word links all three?', correct: 'Snow', distractors: ['Ice', 'Cold', 'Winter'], category: 'Nature' },
  { emojis: '🌊🏄🐚', hint: 'What word links all three?', correct: 'Sea', distractors: ['Wave', 'Beach', 'Water'], category: 'Nature' },
  { emojis: '🎸🎵🎤', hint: 'What word links all three?', correct: 'Rock', distractors: ['Music', 'Band', 'Song'], category: 'Music' },
  { emojis: '🔑🚪🏠', hint: 'What word links all three?', correct: 'House', distractors: ['Lock', 'Home', 'Door'], category: 'Objects' },
  { emojis: '📖📚🐛', hint: 'What word links all three?', correct: 'Book', distractors: ['Read', 'Story', 'Page'], category: 'Words' },
  { emojis: '⭐🐟🌊', hint: 'What word links all three?', correct: 'Star', distractors: ['Fish', 'Sea', 'Night'], category: 'Nature' },
  { emojis: '🍯🐝🌸', hint: 'What word links all three?', correct: 'Honey', distractors: ['Bee', 'Sweet', 'Flower'], category: 'Nature' },
  { emojis: '🏀🌍🎱', hint: 'What word links all three?', correct: 'Ball', distractors: ['Round', 'Game', 'Sport'], category: 'Sports' },
  { emojis: '💎🐍💍', hint: 'What word links all three?', correct: 'Ring', distractors: ['Gold', 'Stone', 'Jewel'], category: 'Objects' },
  { emojis: '🌙🐺🧛', hint: 'What word links all three?', correct: 'Night', distractors: ['Dark', 'Moon', 'Blood'], category: 'Fantasy' },
  { emojis: '🎄🎁⭐', hint: 'What word links all three?', correct: 'Christmas', distractors: ['Holiday', 'Winter', 'Gift'], category: 'Holidays' },
  { emojis: '🧊🍦❄️', hint: 'What word links all three?', correct: 'Ice', distractors: ['Cold', 'Freeze', 'Snow'], category: 'Nature' },
  { emojis: '👑🦁🏰', hint: 'What word links all three?', correct: 'King', distractors: ['Royal', 'Castle', 'Crown'], category: 'Fantasy' },
  { emojis: '🌹❤️🍷', hint: 'What word links all three?', correct: 'Red', distractors: ['Love', 'Wine', 'Rose'], category: 'Colors' },
  { emojis: '⚡🔋🎸', hint: 'What word links all three?', correct: 'Electric', distractors: ['Power', 'Energy', 'Shock'], category: 'Science' },
  { emojis: '🐔🥚🌅', hint: 'What word links all three?', correct: 'Sunrise', distractors: ['Morning', 'Dawn', 'Chicken'], category: 'Nature' },
  { emojis: '🎭😂😢', hint: 'What word links all three?', correct: 'Drama', distractors: ['Comedy', 'Theater', 'Emotion'], category: 'Art' },
  { emojis: '🧠💡🤔', hint: 'What word links all three?', correct: 'Think', distractors: ['Brain', 'Idea', 'Smart'], category: 'Words' },
  { emojis: '🌊🏰🧱', hint: 'What word links all three?', correct: 'Sand', distractors: ['Beach', 'Build', 'Wall'], category: 'Nature' },
  { emojis: '🎯🏹💘', hint: 'What word links all three?', correct: 'Arrow', distractors: ['Target', 'Aim', 'Heart'], category: 'Objects' },
  { emojis: '🌈🎨🦜', hint: 'What word links all three?', correct: 'Color', distractors: ['Rainbow', 'Paint', 'Bright'], category: 'Art' },
  { emojis: '🔥🐉⚔️', hint: 'What word links all three?', correct: 'Dragon', distractors: ['Fire', 'Battle', 'Knight'], category: 'Fantasy' },
  { emojis: '🍕🇮🇹🤌', hint: 'What word links all three?', correct: 'Italian', distractors: ['Pizza', 'Food', 'Rome'], category: 'Culture' },
  { emojis: '💰🏦🐷', hint: 'What word links all three?', correct: 'Bank', distractors: ['Money', 'Save', 'Rich'], category: 'Finance' },
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

export interface EmojiChainData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  emojis: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class EmojiChainGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'emojichain',
    name: 'Emoji Chain',
    description: 'Find the word that links the emojis!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: EmojiChainPuzzle[] = [];
  private current!: EmojiChainPuzzle;
  private options: string[] = [];
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

  private makeData(): EmojiChainData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      emojis: this.current.emojis,
      category: this.current.category,
      options: this.options,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    const all = [this.current.correct, ...this.current.distractors];
    this.options = this.shuffle(all);
    this.correctIdx = this.options.indexOf(this.current.correct);
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
  { id: 'emojichain', name: 'Emoji Chain', description: 'Find the word that links the emojis!', minPlayers: 1, maxPlayers: 100 },
  () => new EmojiChainGame(),
);
