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

const MAX_ROUNDS = 20;
const PICK_MS = 8_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 150;
const SPEED_BONUS_MAX = 100;
const CHAIN_BONUS = 50; // bonus for long chains

// ── Word chain rules ─────────────────────────────────────────────────────────

interface ChainRule {
  name: string;
  description: string;
  validate: (prev: string, next: string) => boolean;
}

const CHAIN_RULES: ChainRule[] = [
  {
    name: 'Same First Letter',
    description: 'Pick a word that starts with the same letter',
    validate: (prev, next) => next.charAt(0).toLowerCase() === prev.charAt(0).toLowerCase(),
  },
  {
    name: 'Last Letter → First Letter',
    description: 'Pick a word starting with the last letter of the previous word',
    validate: (prev, next) => next.charAt(0).toLowerCase() === prev.charAt(prev.length - 1)!.toLowerCase(),
  },
  {
    name: 'Same Category',
    description: 'Pick a word from the same category',
    validate: () => true, // validated by pre-curated options
  },
  {
    name: 'Rhymes With',
    description: 'Pick a word that rhymes',
    validate: () => true, // validated by pre-curated options
  },
];

// Pre-curated word chains per rule type
interface ChainSet {
  rule: number; // index into CHAIN_RULES
  startWord: string;
  // Each step: [correct answer, ...distractors] — 4 options total
  steps: Array<{ correct: string; distractors: [string, string, string] }>;
}

const CHAIN_SETS: ChainSet[] = [
  {
    rule: 0, startWord: 'Cat',
    steps: [
      { correct: 'Car', distractors: ['Dog', 'Pen', 'Box'] },
      { correct: 'Cup', distractors: ['Hat', 'Bag', 'Run'] },
      { correct: 'Cloud', distractors: ['Tree', 'Moon', 'Fish'] },
      { correct: 'Chair', distractors: ['Table', 'Light', 'Road'] },
    ],
  },
  {
    rule: 1, startWord: 'Apple',
    steps: [
      { correct: 'Eagle', distractors: ['Bear', 'Fish', 'Lion'] },
      { correct: 'Egg', distractors: ['Cat', 'Dog', 'Rat'] },
      { correct: 'Gold', distractors: ['Milk', 'Salt', 'Fire'] },
      { correct: 'Dragon', distractors: ['Mouse', 'Snake', 'Tiger'] },
    ],
  },
  {
    rule: 2, startWord: 'Pizza',
    steps: [
      { correct: 'Burger', distractors: ['Guitar', 'Planet', 'River'] },
      { correct: 'Taco', distractors: ['Mountain', 'Laptop', 'Soccer'] },
      { correct: 'Sushi', distractors: ['Rocket', 'Hammer', 'Violin'] },
      { correct: 'Pasta', distractors: ['Compass', 'Anchor', 'Blanket'] },
    ],
  },
  {
    rule: 0, startWord: 'Sun',
    steps: [
      { correct: 'Star', distractors: ['Moon', 'Rain', 'Wind'] },
      { correct: 'Snow', distractors: ['Leaf', 'Rock', 'Wave'] },
      { correct: 'Sand', distractors: ['Dirt', 'Mist', 'Hail'] },
      { correct: 'Storm', distractors: ['Cloud', 'Dusk', 'Glow'] },
    ],
  },
  {
    rule: 2, startWord: 'Soccer',
    steps: [
      { correct: 'Tennis', distractors: ['Piano', 'Cookie', 'Bridge'] },
      { correct: 'Hockey', distractors: ['Candle', 'Ladder', 'Pillow'] },
      { correct: 'Boxing', distractors: ['Forest', 'Castle', 'Sunset'] },
      { correct: 'Cricket', distractors: ['Diamond', 'Feather', 'Marble'] },
    ],
  },
  {
    rule: 1, startWord: 'Banana',
    steps: [
      { correct: 'Ant', distractors: ['Bee', 'Fly', 'Cat'] },
      { correct: 'Tiger', distractors: ['Horse', 'Snake', 'Goat'] },
      { correct: 'Rain', distractors: ['Snow', 'Wind', 'Hail'] },
      { correct: 'Nest', distractors: ['Tree', 'Bush', 'Rock'] },
    ],
  },
  {
    rule: 2, startWord: 'Guitar',
    steps: [
      { correct: 'Piano', distractors: ['Hammer', 'Ladder', 'Rocket'] },
      { correct: 'Drums', distractors: ['Shovel', 'Bucket', 'Mirror'] },
      { correct: 'Violin', distractors: ['Helmet', 'Anchor', 'Pencil'] },
      { correct: 'Flute', distractors: ['Wrench', 'Basket', 'Candle'] },
    ],
  },
  {
    rule: 0, startWord: 'Blue',
    steps: [
      { correct: 'Bird', distractors: ['Fish', 'Frog', 'Deer'] },
      { correct: 'Ball', distractors: ['Ring', 'Coin', 'Dice'] },
      { correct: 'Beach', distractors: ['River', 'Lake', 'Creek'] },
      { correct: 'Bread', distractors: ['Cake', 'Soup', 'Rice'] },
    ],
  },
  {
    rule: 1, startWord: 'Red',
    steps: [
      { correct: 'Dog', distractors: ['Cat', 'Rat', 'Pig'] },
      { correct: 'Giraffe', distractors: ['Monkey', 'Parrot', 'Turtle'] },
      { correct: 'Elephant', distractors: ['Dolphin', 'Penguin', 'Hamster'] },
      { correct: 'Train', distractors: ['Plane', 'Truck', 'Canoe'] },
    ],
  },
  {
    rule: 2, startWord: 'France',
    steps: [
      { correct: 'Japan', distractors: ['Guitar', 'Banana', 'Rocket'] },
      { correct: 'Brazil', distractors: ['Purple', 'Hammer', 'Cookie'] },
      { correct: 'Egypt', distractors: ['Tennis', 'Violin', 'Pillow'] },
      { correct: 'Canada', distractors: ['Pencil', 'Marble', 'Candle'] },
    ],
  },
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

export interface ComboChainData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  ruleName: string;
  ruleDescription: string;
  chain: string[];
  currentWord: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  playerPicks: Record<string, number>;
  correctPlayerIds: string[];
  chainLength: number;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class ComboChainGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'combochain',
    name: 'Combo Chain',
    description: 'Pick the right word to keep the chain going!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private chain: string[] = [];
  private currentWord = '';
  private options: string[] = [];
  private correctIndex = -1;
  private playerPicks: Record<string, number> = {};
  private correctPlayerIds: string[] = [];
  private pickStartTime = 0;
  private usedSets: number[] = [];
  private currentSet: ChainSet | null = null;
  private stepIndex = 0;
  private ruleName = '';
  private ruleDescription = '';

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = MAX_ROUNDS;
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
      this.correctPlayerIds.push(playerId);
      const elapsed = Date.now() - this.pickStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
      const bonus = Math.round(speedRatio * SPEED_BONUS_MAX);
      this.addScore(playerId, CORRECT_POINTS + bonus + this.chain.length * CHAIN_BONUS);
    }

    // Check if all players answered
    const allPicked = [...this.players.keys()].every((id) => this.playerPicks[id] !== undefined);
    if (allPicked) {
      this.goToReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'pick') {
      this.pickMs -= deltaMs;
      if (this.pickMs <= 0) {
        this.goToReveal();
      }
      return this.buildState(this.makeData());
    }

    // Reveal
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
    this.correctPlayerIds = [];
    this.pickMs = PICK_MS;
    this.pickStartTime = Date.now();

    // Pick a chain set or continue current one
    if (!this.currentSet || this.stepIndex >= this.currentSet.steps.length) {
      // Pick new set
      const available = CHAIN_SETS.map((_, i) => i).filter((i) => !this.usedSets.includes(i));
      if (available.length === 0) {
        this.usedSets = [];
        this.pickNewSet(CHAIN_SETS.map((_, i) => i));
      } else {
        this.pickNewSet(available);
      }
    }

    const step = this.currentSet!.steps[this.stepIndex]!;
    this.currentWord = this.chain[this.chain.length - 1] ?? this.currentSet!.startWord;

    // Shuffle options
    const allOptions = [step.correct, ...step.distractors];
    const shuffled = this.shuffle(allOptions);
    this.options = shuffled;
    this.correctIndex = shuffled.indexOf(step.correct);
    this.stepIndex++;
  }

  private pickNewSet(available: number[]): void {
    const idx = available[Math.floor(Math.random() * available.length)]!;
    this.currentSet = CHAIN_SETS[idx]!;
    this.usedSets.push(idx);
    this.stepIndex = 0;
    this.chain = [this.currentSet.startWord];
    const rule = CHAIN_RULES[this.currentSet.rule]!;
    this.ruleName = rule.name;
    this.ruleDescription = rule.description;
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    // Add correct word to chain
    const step = this.currentSet!.steps[this.stepIndex - 1]!;
    this.chain.push(step.correct);
  }

  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private makeData(): ComboChainData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      ruleName: this.ruleName,
      ruleDescription: this.ruleDescription,
      chain: [...this.chain],
      currentWord: this.currentWord,
      options: [...this.options],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: this.subPhase === 'reveal' ? this.correctIndex : null,
      playerPicks: this.subPhase === 'reveal' ? { ...this.playerPicks } : {},
      correctPlayerIds: this.subPhase === 'reveal' ? [...this.correctPlayerIds] : [],
      chainLength: this.chain.length,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'combochain',
    name: 'Combo Chain',
    description: 'Pick the right word to keep the chain going!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new ComboChainGame(),
);
