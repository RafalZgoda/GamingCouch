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
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface TwisterPuzzle {
  full: string;
  blanked: string;
  correct: string;
  distractors: [string, string, string];
}

const PUZZLES: TwisterPuzzle[] = [
  { full: 'She sells seashells by the seashore', blanked: 'She sells ___ by the seashore', correct: 'seashells', distractors: ['seagulls', 'sandals', 'secrets'] },
  { full: 'Peter Piper picked a peck of pickled peppers', blanked: 'Peter Piper picked a peck of ___ peppers', correct: 'pickled', distractors: ['purple', 'packed', 'prickly'] },
  { full: 'How much wood would a woodchuck chuck', blanked: 'How much ___ would a woodchuck chuck', correct: 'wood', distractors: ['food', 'wool', 'good'] },
  { full: 'Betty Botter bought some butter', blanked: 'Betty Botter ___ some butter', correct: 'bought', distractors: ['brought', 'caught', 'sought'] },
  { full: 'Red lorry yellow lorry', blanked: 'Red ___ yellow ___', correct: 'lorry', distractors: ['lolly', 'lobby', 'lordy'] },
  { full: 'Unique New York unique New York', blanked: '___ New York ___ New York', correct: 'Unique', distractors: ['Unite', 'Until', 'Under'] },
  { full: 'Toy boat toy boat toy boat', blanked: 'Toy ___ toy ___ toy ___', correct: 'boat', distractors: ['goat', 'coat', 'moat'] },
  { full: 'She sees cheese', blanked: 'She sees ___', correct: 'cheese', distractors: ['trees', 'fleas', 'knees'] },
  { full: 'Fresh French fried fish', blanked: 'Fresh French ___ fish', correct: 'fried', distractors: ['freed', 'dried', 'tried'] },
  { full: 'Six slippery snails slid slowly seaward', blanked: 'Six ___ snails slid slowly seaward', correct: 'slippery', distractors: ['silvery', 'slithery', 'slimy'] },
  { full: 'A proper copper coffee pot', blanked: 'A proper ___ coffee pot', correct: 'copper', distractors: ['cozy', 'corner', 'crimson'] },
  { full: 'Black background brown background', blanked: 'Black ___ brown ___', correct: 'background', distractors: ['backyard', 'backward', 'backstage'] },
  { full: 'Eleven benevolent elephants', blanked: 'Eleven ___ elephants', correct: 'benevolent', distractors: ['bewildered', 'belligerent', 'beleaguered'] },
  { full: 'Irish wristwatch Swiss wristwatch', blanked: 'Irish ___ Swiss ___', correct: 'wristwatch', distractors: ['wristband', 'wishbone', 'windswept'] },
  { full: 'Fuzzy Wuzzy was a bear', blanked: 'Fuzzy Wuzzy was a ___', correct: 'bear', distractors: ['deer', 'hare', 'pair'] },
  { full: 'Which witch wished which wicked wish', blanked: 'Which ___ wished which wicked wish', correct: 'witch', distractors: ['watch', 'switch', 'stitch'] },
  { full: 'Six thick thistle sticks', blanked: 'Six thick ___ sticks', correct: 'thistle', distractors: ['thimble', 'throttle', 'trickle'] },
  { full: 'A big black bug bit a big black bear', blanked: 'A big black bug ___ a big black bear', correct: 'bit', distractors: ['hit', 'hid', 'sat'] },
  { full: 'I scream you scream we all scream for ice cream', blanked: 'I scream you scream we all scream for ice ___', correct: 'cream', distractors: ['dream', 'stream', 'gleam'] },
  { full: 'Round the rugged rocks the ragged rascal ran', blanked: 'Round the rugged ___ the ragged rascal ran', correct: 'rocks', distractors: ['roads', 'roots', 'ropes'] },
  { full: 'The great Greek grape growers grow great Greek grapes', blanked: 'The great Greek ___ growers grow great Greek grapes', correct: 'grape', distractors: ['grain', 'grave', 'grace'] },
  { full: 'Can you can a can as a canner can can a can', blanked: 'Can you ___ a can as a canner can ___ a can', correct: 'can', distractors: ['fan', 'ban', 'pan'] },
  { full: 'Lesser leather never weathered wetter weather better', blanked: 'Lesser ___ never weathered wetter weather better', correct: 'leather', distractors: ['feather', 'weather', 'tether'] },
  { full: 'Fred fed Ted bread and Ted fed Fred bread', blanked: 'Fred fed Ted ___ and Ted fed Fred ___', correct: 'bread', distractors: ['thread', 'dread', 'spread'] },
  { full: 'Pad kid poured curd pulled cod', blanked: 'Pad kid poured ___ pulled cod', correct: 'curd', distractors: ['cord', 'card', 'crud'] },
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

export interface TongueTwisterData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  blanked: string;
  full: string | null;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class TongueTwisterGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'tonguetwister',
    name: 'Tongue Twister',
    description: 'Complete the tongue twister!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: TwisterPuzzle[] = [];
  private current!: TwisterPuzzle;
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

  private makeData(): TongueTwisterData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      blanked: this.current.blanked,
      full: this.roundPhase === 'reveal' ? this.current.full : null,
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
  { id: 'tonguetwister', name: 'Tongue Twister', description: 'Complete the tongue twister!', minPlayers: 1, maxPlayers: 100 },
  () => new TongueTwisterGame(),
);
