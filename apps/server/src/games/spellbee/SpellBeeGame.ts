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

const DEFAULT_ROUNDS = 12;
const PICK_MS = 8_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface SpellPuzzle {
  definition: string;
  correct: string;
  misspellings: [string, string, string];
  difficulty: 'easy' | 'medium' | 'hard';
}

const PUZZLES: SpellPuzzle[] = [
  { definition: 'To receive or take something offered', correct: 'Accept', misspellings: ['Acept', 'Aksept', 'Axcept'], difficulty: 'easy' },
  { definition: 'A room for sleeping', correct: 'Accommodate', misspellings: ['Accomodate', 'Acommodate', 'Acomodate'], difficulty: 'hard' },
  { definition: 'To gain or come into possession of', correct: 'Acquire', misspellings: ['Aquire', 'Aqcuire', 'Accquire'], difficulty: 'medium' },
  { definition: 'Clear and obvious, easy to see', correct: 'Apparent', misspellings: ['Apparant', 'Aparent', 'Apperant'], difficulty: 'medium' },
  { definition: 'Without a doubt, certainly', correct: 'Definitely', misspellings: ['Definately', 'Definatley', 'Defenitely'], difficulty: 'hard' },
  { definition: 'A large piece of furniture for storage', correct: 'Wardrobe', misspellings: ['Wardobe', 'Wardrob', 'Wardrope'], difficulty: 'easy' },
  { definition: 'To go beyond or be greater than', correct: 'Exceed', misspellings: ['Excede', 'Exseed', 'Excead'], difficulty: 'medium' },
  { definition: 'Something that happens, an event', correct: 'Occurrence', misspellings: ['Occurence', 'Ocurrence', 'Occurance'], difficulty: 'hard' },
  { definition: 'To embarrass or cause to feel awkward', correct: 'Embarrass', misspellings: ['Embarass', 'Embarras', 'Embaress'], difficulty: 'hard' },
  { definition: 'A person who lives nearby', correct: 'Neighbour', misspellings: ['Nieghbour', 'Neigbour', 'Neighbur'], difficulty: 'medium' },
  { definition: 'Existing in fact, real', correct: 'Genuine', misspellings: ['Geniune', 'Genuene', 'Genuin'], difficulty: 'medium' },
  { definition: 'Related to the body rather than the mind', correct: 'Physical', misspellings: ['Phisical', 'Fysical', 'Physicle'], difficulty: 'easy' },
  { definition: 'The surroundings in which a person lives', correct: 'Environment', misspellings: ['Enviroment', 'Envirnoment', 'Enviorment'], difficulty: 'hard' },
  { definition: 'To make sure of something', correct: 'Guarantee', misspellings: ['Garantee', 'Gaurantee', 'Guarentee'], difficulty: 'hard' },
  { definition: 'Not the same as another', correct: 'Different', misspellings: ['Diffrent', 'Diferent', 'Differant'], difficulty: 'easy' },
  { definition: 'A tropical yellow fruit', correct: 'Banana', misspellings: ['Bannana', 'Bananna', 'Bananah'], difficulty: 'easy' },
  { definition: 'An opinion or suggestion about what to do', correct: 'Advice', misspellings: ['Advise', 'Advize', 'Addvice'], difficulty: 'easy' },
  { definition: 'To get or reach a goal', correct: 'Achieve', misspellings: ['Acheive', 'Achive', 'Acheeve'], difficulty: 'medium' },
  { definition: 'A formal dance event', correct: 'Ballet', misspellings: ['Balley', 'Balet', 'Ballete'], difficulty: 'medium' },
  { definition: 'Extremely beautiful or attractive', correct: 'Gorgeous', misspellings: ['Goregous', 'Georgous', 'Gorjeous'], difficulty: 'medium' },
  { definition: 'A piece of furniture with shelves for books', correct: 'Bookshelf', misspellings: ['Bookshellf', 'Bookshelv', 'Bookshef'], difficulty: 'easy' },
  { definition: 'Having or showing courage', correct: 'Courageous', misspellings: ['Couragous', 'Corageous', 'Curageous'], difficulty: 'hard' },
  { definition: 'A hot and arid region', correct: 'Desert', misspellings: ['Dessert', 'Desart', 'Dezert'], difficulty: 'easy' },
  { definition: 'Freedom from disturbance', correct: 'Peaceful', misspellings: ['Peacful', 'Peeceful', 'Peaseful'], difficulty: 'easy' },
  { definition: 'To keep something in existence', correct: 'Maintain', misspellings: ['Mantain', 'Maintane', 'Maintan'], difficulty: 'medium' },
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

export interface SpellBeeData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  definition: string;
  difficulty: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SpellBeeGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'spellbee',
    name: 'Spell Bee',
    description: 'Pick the correct spelling! One right, three wrong.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: SpellPuzzle | null = null;
  private shuffledOptions: string[] = [];
  private correctIndex = -1;

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

    if (idx === this.correctIndex) {
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

    const allOptions = [this.currentPuzzle.correct, ...this.currentPuzzle.misspellings];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIndex = this.shuffledOptions.indexOf(this.currentPuzzle.correct);
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

  private makeData(): SpellBeeData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      definition: this.currentPuzzle?.definition ?? '',
      difficulty: this.currentPuzzle?.difficulty ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIndex : null,
      correctAnswer: isReveal ? (this.currentPuzzle?.correct ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'spellbee',
    name: 'Spell Bee',
    description: 'Pick the correct spelling! One right, three wrong.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SpellBeeGame(),
);
