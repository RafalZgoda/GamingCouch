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
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface SoundPuzzle {
  clue: string;
  correct: string;
  distractors: [string, string, string];
  hint: string;
}

const PUZZLES: SoundPuzzle[] = [
  { clue: 'FLOWER / WHEAT', correct: 'FLOUR', distractors: ['FLOOR', 'FLAIR', 'FLARE'], hint: 'Baking ingredient' },
  { clue: 'OCEAN ANIMAL', correct: 'WHALE', distractors: ['WAIL', 'WELL', 'WILL'], hint: 'Not the cry' },
  { clue: 'CORRECT', correct: 'RIGHT', distractors: ['WRITE', 'RITE', 'WRIT'], hint: 'Opposite of wrong' },
  { clue: 'ROYAL SEAT', correct: 'THRONE', distractors: ['THROWN', 'THORN', 'TONE'], hint: 'Where a king sits' },
  { clue: 'SEVEN DAYS', correct: 'WEEK', distractors: ['WEAK', 'WICK', 'WAKE'], hint: 'Not feeble' },
  { clue: 'RABBIT-LIKE', correct: 'HARE', distractors: ['HAIR', 'HERE', 'HIRE'], hint: 'The animal' },
  { clue: 'METAL FASTENER', correct: 'STEEL', distractors: ['STEAL', 'STALE', 'STYLE'], hint: 'Not a crime' },
  { clue: 'FOOTWEAR', correct: 'SOLE', distractors: ['SOUL', 'SOIL', 'SAIL'], hint: 'Bottom of a shoe' },
  { clue: 'WIND MOVEMENT', correct: 'BREEZE', distractors: ['BREES', 'BRAISE', 'BRUISE'], hint: 'Light air' },
  { clue: 'LOOK WITH EYES', correct: 'SEE', distractors: ['SEA', 'SHE', 'SKI'], hint: 'Not the ocean' },
  { clue: 'STORY / LEGEND', correct: 'TALE', distractors: ['TAIL', 'TALL', 'TILE'], hint: 'Once upon a time' },
  { clue: 'SUNRISE HOUR', correct: 'MORNING', distractors: ['MOURNING', 'MOORING', 'MOVING'], hint: 'Not sadness' },
  { clue: 'COST / VALUE', correct: 'PRICE', distractors: ['PRIZE', 'PRISE', 'PRESS'], hint: 'What you pay' },
  { clue: 'SMALL FRUIT', correct: 'BERRY', distractors: ['BURY', 'BURRY', 'BARRY'], hint: 'Strawberry type' },
  { clue: 'OAR ACTION', correct: 'ROW', distractors: ['ROE', 'RUE', 'RAW'], hint: 'Move a boat' },
  { clue: 'STOP / HALT', correct: 'BRAKE', distractors: ['BREAK', 'BRICK', 'BROOK'], hint: 'In a car' },
  { clue: 'DEER ANIMAL', correct: 'DEER', distractors: ['DEAR', 'DARE', 'DOOR'], hint: 'The animal' },
  { clue: 'GRAIN FOOD', correct: 'CEREAL', distractors: ['SERIAL', 'SURREAL', 'CORAL'], hint: 'Breakfast bowl' },
  { clue: 'BEACH EDGE', correct: 'SHORE', distractors: ['SURE', 'SHARE', 'SHEER'], hint: 'Where waves meet land' },
  { clue: 'PRECIPITATION', correct: 'RAIN', distractors: ['REIGN', 'REIN', 'RUNE'], hint: 'Water from clouds' },
  { clue: 'EXIST / LIVE', correct: 'BE', distractors: ['BEE', 'BAY', 'BOW'], hint: 'To ___ or not to ___' },
  { clue: 'KNIGHT ARMOR', correct: 'KNIGHT', distractors: ['NIGHT', 'KNIT', 'KNOT'], hint: 'Medieval warrior' },
  { clue: 'WALK HEAVILY', correct: 'TRUDGE', distractors: ['TRUDGE', 'JUDGE', 'BRIDGE'], hint: 'Stomp through mud' },
  { clue: 'POSSESS / OWN', correct: 'OWE', distractors: ['OH', 'AWE', 'OAR'], hint: 'To be in debt' },
  { clue: 'SENT BY POST', correct: 'MAIL', distractors: ['MALE', 'MEAL', 'MILE'], hint: 'Letters and packages' },
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

export interface SoundAlikeData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  clue: string;
  hint: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SoundAlikeGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'soundalike',
    name: 'Sound Alike',
    description: 'Pick the right homophone! They sound the same but mean different things.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: SoundPuzzle | null = null;
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

  private makeData(): SoundAlikeData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      clue: this.currentPuzzle?.clue ?? '',
      hint: this.currentPuzzle?.hint ?? '',
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
    id: 'soundalike',
    name: 'Sound Alike',
    description: 'Pick the right homophone! They sound the same but mean different things.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SoundAlikeGame(),
);
