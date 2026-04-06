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
const REVEAL_MS = 2_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface FirstLastPuzzle {
  word: string;
  category: string;
  distractors: [string, string, string];
}

function makeHint(word: string): string {
  if (word.length <= 2) return word;
  return word[0] + '_'.repeat(word.length - 2) + word[word.length - 1];
}

const PUZZLES: FirstLastPuzzle[] = [
  { word: 'AVOCADO', category: 'Fruit', distractors: ['APRICOT', 'ARTICHOKE', 'AMARETTO'] },
  { word: 'ELEPHANT', category: 'Animal', distractors: ['EGGPLANT', 'ESCALATOR', 'EXPONENT'] },
  { word: 'GUITAR', category: 'Instrument', distractors: ['GUTTER', 'GLAMOUR', 'GLACIER'] },
  { word: 'JUPITER', category: 'Planet', distractors: ['JUNIPER', 'JOUSTER', 'JESTER'] },
  { word: 'TORNADO', category: 'Weather', distractors: ['TORPEDO', 'TUXEDO', 'TOBACCO'] },
  { word: 'PENGUIN', category: 'Animal', distractors: ['PROTEIN', 'PORCELAIN', 'PALADIN'] },
  { word: 'DIAMOND', category: 'Gemstone', distractors: ['DEMAND', 'DISCORD', 'DISBAND'] },
  { word: 'VOLCANO', category: 'Geography', distractors: ['VERTIGO', 'VELCRO', 'VIBRATO'] },
  { word: 'BROCCOLI', category: 'Vegetable', distractors: ['BISCOTTI', 'BUTTERFLY', 'BRACELET'] },
  { word: 'MERCURY', category: 'Planet', distractors: ['MASTERY', 'MYSTERY', 'MILITARY'] },
  { word: 'KANGAROO', category: 'Animal', distractors: ['KAZOO', 'KILIMANJARO', 'KOKOMO'] },
  { word: 'TRUMPET', category: 'Instrument', distractors: ['TRIPLET', 'TORRENT', 'TABLET'] },
  { word: 'CINNAMON', category: 'Spice', distractors: ['CHAMPION', 'CRITERION', 'CARDIGAN'] },
  { word: 'DOLPHIN', category: 'Animal', distractors: ['DARWIN', 'DOMAIN', 'DUNGEON'] },
  { word: 'PYRAMID', category: 'Shape', distractors: ['PARANOID', 'PINBOARD', 'PAYLOAD'] },
  { word: 'UMBRELLA', category: 'Object', distractors: ['UTOPIA', 'UREA', 'UVULA'] },
  { word: 'SALMON', category: 'Fish', distractors: ['SULTAN', 'SILICON', 'SKELETON'] },
  { word: 'TITANIUM', category: 'Metal', distractors: ['TERRARIUM', 'TRIFORIUM', 'TROPISM'] },
  { word: 'CHOCOLATE', category: 'Food', distractors: ['CHRONICLE', 'CANDIDATE', 'CELEBRATE'] },
  { word: 'FLAMINGO', category: 'Bird', distractors: ['FIASCO', 'FANDANGO', 'FALSETTO'] },
  { word: 'HARMONICA', category: 'Instrument', distractors: ['HIBISCUS', 'HYDRAULICA', 'HELVETICA'] },
  { word: 'MANGO', category: 'Fruit', distractors: ['METRO', 'MACHO', 'MOTTO'] },
  { word: 'SATURN', category: 'Planet', distractors: ['SATIN', 'SKELETON', 'STALLION'] },
  { word: 'WALRUS', category: 'Animal', distractors: ['WITNESS', 'WALTZ', 'WICKETS'] },
  { word: 'IGLOO', category: 'Building', distractors: ['INDIGO', 'IMPROV', 'INTO'] },
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

export interface FirstAndLastData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  hint: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class FirstAndLastGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'firstandlast',
    name: 'First & Last',
    description: 'Guess the word from its first and last letters!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: FirstLastPuzzle[] = [];
  private current!: FirstLastPuzzle;
  private hint = '';
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

  private makeData(): FirstAndLastData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      hint: this.roundPhase === 'reveal' ? this.current.word : this.hint,
      category: this.current.category,
      options: this.options,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    this.hint = makeHint(this.current.word);
    const all = [this.current.word, ...this.current.distractors];
    this.options = this.shuffle(all);
    this.correctIdx = this.options.indexOf(this.current.word);
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
  { id: 'firstandlast', name: 'First & Last', description: 'Guess the word from its first and last letters!', minPlayers: 1, maxPlayers: 100 },
  () => new FirstAndLastGame(),
);
