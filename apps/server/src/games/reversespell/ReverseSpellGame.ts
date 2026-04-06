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

interface ReversePuzzle {
  word: string;
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: ReversePuzzle[] = [
  { word: 'ELEPHANT', distractors: ['ELEGANCE', 'ELEVATOR', 'ENVELOPE'], category: 'Animals' },
  { word: 'PINEAPPLE', distractors: ['PRINCIPLE', 'PENINSULA', 'PERPETUAL'], category: 'Fruits' },
  { word: 'CHOCOLATE', distractors: ['CHRONICLE', 'CHAMELEON', 'CHALLENGE'], category: 'Food' },
  { word: 'DINOSAUR', distractors: ['DIAMETER', 'DIAGONAL', 'DIPLOMAT'], category: 'Animals' },
  { word: 'BUTTERFLY', distractors: ['BUTTERMILK', 'BOULEVARD', 'BLUEBERRY'], category: 'Animals' },
  { word: 'MOUNTAIN', distractors: ['MUSHROOM', 'MOISTURE', 'MONUMENT'], category: 'Nature' },
  { word: 'SANDWICH', distractors: ['SUNLIGHT', 'STANDARD', 'SWITCHED'], category: 'Food' },
  { word: 'CROCODILE', distractors: ['CHRONICLE', 'CROSSWORD', 'CORKSCREW'], category: 'Animals' },
  { word: 'TELESCOPE', distractors: ['TELEPHONE', 'TRANSPORT', 'TRAMPOLINE'], category: 'Science' },
  { word: 'ADVENTURE', distractors: ['ADVANTAGE', 'ADVERTISE', 'ALTERNATE'], category: 'Words' },
  { word: 'PARACHUTE', distractors: ['PARAGRAPH', 'PARADISES', 'PARTICLES'], category: 'Objects' },
  { word: 'BROCCOLI', distractors: ['BRACELET', 'BROOKLYN', 'BACKWARD'], category: 'Food' },
  { word: 'KANGAROO', distractors: ['KEYBOARD', 'KEROSENE', 'KILOWATT'], category: 'Animals' },
  { word: 'FIREWORK', distractors: ['FIRMWARE', 'FISHBONE', 'FOLKLORE'], category: 'Objects' },
  { word: 'UMBRELLA', distractors: ['UNDERWAY', 'UNIVERSE', 'UNCOMMON'], category: 'Objects' },
  { word: 'TREASURE', distractors: ['TRANSFER', 'TRIANGLE', 'TRAINERS'], category: 'Words' },
  { word: 'DOLPHIN', distractors: ['DARLING', 'DUSTBIN', 'DOMINOS'], category: 'Animals' },
  { word: 'CALENDAR', distractors: ['CALCULUS', 'CRIMINAL', 'CAULDRON'], category: 'Objects' },
  { word: 'VOLCANO', distractors: ['VARNISH', 'VEHICLE', 'VILLAGE'], category: 'Nature' },
  { word: 'PENGUIN', distractors: ['PILGRIM', 'PROTEIN', 'PORTION'], category: 'Animals' },
  { word: 'HOSPITAL', distractors: ['HOMELAND', 'HANDSOME', 'HORRIBLE'], category: 'Places' },
  { word: 'GIRAFFE', distractors: ['GRANITE', 'GLIMPSE', 'GAZELLE'], category: 'Animals' },
  { word: 'MUSHROOM', distractors: ['MARATHON', 'MEASURED', 'MOUNTAIN'], category: 'Nature' },
  { word: 'TOMATO', distractors: ['TUXEDO', 'TROPHY', 'TURBAN'], category: 'Food' },
  { word: 'AVOCADO', distractors: ['ACADEMY', 'Arizona', 'AMAZING'], category: 'Food' },
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

export interface ReverseSpellData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  reversed: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class ReverseSpellGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'reversespell',
    name: 'Reverse Spell',
    description: 'Unscramble the backwards word!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: ReversePuzzle[] = [];
  private current!: ReversePuzzle;
  private reversed = '';
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

  private makeData(): ReverseSpellData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      reversed: this.reversed,
      category: this.current.category,
      options: this.options,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    this.reversed = this.current.word.split('').reverse().join('');
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
  { id: 'reversespell', name: 'Reverse Spell', description: 'Unscramble the backwards word!', minPlayers: 1, maxPlayers: 100 },
  () => new ReverseSpellGame(),
);
