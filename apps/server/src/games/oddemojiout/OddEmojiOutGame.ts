import type {
  Player,
  ControllerInputEvent,
  GameState,
  GameDefinition,
  ControllerLayout,
} from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

const DEFAULT_ROUNDS = 10;
const PICK_MS = 8_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

interface EmojiOddPuzzle {
  emojis: [string, string, string, string];
  oddIndex: number;
  connection: string;
  category: string;
}

const PUZZLES: EmojiOddPuzzle[] = [
  { emojis: ['🍎', '🍊', '🍋', '🥦'], oddIndex: 3, connection: 'Fruits', category: 'Food' },
  { emojis: ['🐶', '🐱', '🐸', '🐰'], oddIndex: 2, connection: 'Common pets', category: 'Animals' },
  { emojis: ['⚽', '🏀', '🎸', '🏈'], oddIndex: 2, connection: 'Ball sports', category: 'Sports' },
  { emojis: ['🌧️', '☀️', '❄️', '🌋'], oddIndex: 3, connection: 'Weather', category: 'Nature' },
  { emojis: ['🚗', '🚌', '🚂', '🛥️'], oddIndex: 3, connection: 'Land vehicles', category: 'Transport' },
  { emojis: ['🎹', '🎸', '🎺', '🎨'], oddIndex: 3, connection: 'Musical instruments', category: 'Music' },
  { emojis: ['🇫🇷', '🇩🇪', '🇯🇵', '🇮🇹'], oddIndex: 2, connection: 'European countries', category: 'Geography' },
  { emojis: ['🍕', '🍔', '🌮', '🍰'], oddIndex: 3, connection: 'Savory fast food', category: 'Food' },
  { emojis: ['🌹', '🌻', '🌵', '🌷'], oddIndex: 2, connection: 'Flowers', category: 'Nature' },
  { emojis: ['🦁', '🐯', '🐻', '🐧'], oddIndex: 3, connection: 'Predators/big mammals', category: 'Animals' },
  { emojis: ['📱', '💻', '⌚', '📚'], oddIndex: 3, connection: 'Electronic devices', category: 'Tech' },
  { emojis: ['🎄', '🎃', '🎆', '🏖️'], oddIndex: 3, connection: 'Holiday celebrations', category: 'Holidays' },
  { emojis: ['👑', '💍', '💎', '🧢'], oddIndex: 3, connection: 'Jewelry/royalty', category: 'Objects' },
  { emojis: ['🌙', '⭐', '☀️', '🌍'], oddIndex: 3, connection: 'Things that shine in the sky', category: 'Space' },
  { emojis: ['✈️', '🚁', '🎈', '🚢'], oddIndex: 3, connection: 'Things that fly', category: 'Transport' },
  { emojis: ['🧊', '❄️', '🌨️', '🔥'], oddIndex: 3, connection: 'Cold things', category: 'Nature' },
  { emojis: ['🎭', '🎬', '🎤', '🔬'], oddIndex: 3, connection: 'Performing arts', category: 'Art' },
  { emojis: ['🍷', '🍺', '🥤', '🍸'], oddIndex: 2, connection: 'Alcoholic drinks', category: 'Drinks' },
  { emojis: ['👟', '👢', '🥾', '🎩'], oddIndex: 3, connection: 'Footwear', category: 'Clothing' },
  { emojis: ['🏀', '🎾', '🏐', '🏒'], oddIndex: 3, connection: 'Ball sports', category: 'Sports' },
  { emojis: ['🐍', '🦎', '🐊', '🐝'], oddIndex: 3, connection: 'Reptiles', category: 'Animals' },
  { emojis: ['🍞', '🥐', '🥖', '🍣'], oddIndex: 3, connection: 'Bread/bakery items', category: 'Food' },
  { emojis: ['🎻', '🎸', '🪕', '🥁'], oddIndex: 3, connection: 'String instruments', category: 'Music' },
  { emojis: ['🏠', '🏰', '🏢', '⛺'], oddIndex: 3, connection: 'Permanent buildings', category: 'Buildings' },
  { emojis: ['🌊', '🏊', '🐠', '🏔️'], oddIndex: 3, connection: 'Water/ocean related', category: 'Nature' },
];

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

export interface OddEmojiOutData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  emojis: string[];
  category: string;
  connection: string | null;
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

export class OddEmojiOutGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'oddemojiout',
    name: 'Odd Emoji Out',
    description: 'Spot the emoji that doesn\'t belong!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: EmojiOddPuzzle[] = [];
  private current!: EmojiOddPuzzle;
  private displayEmojis: string[] = [];
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

  private preparePuzzle(): void {
    this.current = this.pool[this.round - 1];
    const indexed = this.current.emojis.map((e, i) => ({ e, isOdd: i === this.current.oddIndex }));
    const shuffled = this.shuffle(indexed);
    this.displayEmojis = shuffled.map((s) => s.e);
    this.correctIdx = shuffled.findIndex((s) => s.isOdd);
  }

  private makeData(): OddEmojiOutData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      emojis: this.displayEmojis,
      category: this.current.category,
      connection: this.roundPhase === 'reveal' ? this.current.connection : null,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
    };
  }

  private startRound(): void {
    this.preparePuzzle();
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
      if (this.pickTimer <= 0 || this.pickedPlayers.size >= this.players.size) this.roundPhase = 'reveal';
    } else {
      this.revealTimer -= deltaMs;
      if (this.revealTimer <= 0) {
        this.advanceRound();
        if (this.round > this.totalRounds) this.phase = 'results';
        else this.startRound();
      }
    }
    return this.buildState(this.makeData());
  }
}

GameRegistry.register(
  { id: 'oddemojiout', name: 'Odd Emoji Out', description: 'Spot the emoji that doesn\'t belong!', minPlayers: 1, maxPlayers: 100 },
  () => new OddEmojiOutGame(),
);
