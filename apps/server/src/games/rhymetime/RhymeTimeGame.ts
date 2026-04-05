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
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface RhymePuzzle {
  word: string;
  correct: string;
  distractors: [string, string, string];
}

const PUZZLES: RhymePuzzle[] = [
  { word: 'CAT', correct: 'BAT', distractors: ['CUP', 'DOG', 'PEN'] },
  { word: 'MOON', correct: 'SPOON', distractors: ['STAR', 'LIGHT', 'ROCK'] },
  { word: 'CAKE', correct: 'LAKE', distractors: ['PIE', 'FORK', 'BREAD'] },
  { word: 'BLUE', correct: 'SHOE', distractors: ['RED', 'SKY', 'DARK'] },
  { word: 'NIGHT', correct: 'LIGHT', distractors: ['DARK', 'MOON', 'SLEEP'] },
  { word: 'TREE', correct: 'BEE', distractors: ['WOOD', 'LEAF', 'BARK'] },
  { word: 'KING', correct: 'SING', distractors: ['CROWN', 'QUEEN', 'RULE'] },
  { word: 'ROCK', correct: 'SOCK', distractors: ['STONE', 'HARD', 'HILL'] },
  { word: 'TRAIN', correct: 'RAIN', distractors: ['TRACK', 'FAST', 'RIDE'] },
  { word: 'LOVE', correct: 'DOVE', distractors: ['HEART', 'FEEL', 'KISS'] },
  { word: 'BEAR', correct: 'PEAR', distractors: ['CAVE', 'WILD', 'HONEY'] },
  { word: 'BOAT', correct: 'GOAT', distractors: ['SHIP', 'WATER', 'SAIL'] },
  { word: 'BALL', correct: 'TALL', distractors: ['KICK', 'ROUND', 'SPORT'] },
  { word: 'HOUSE', correct: 'MOUSE', distractors: ['HOME', 'DOOR', 'ROOF'] },
  { word: 'TIME', correct: 'DIME', distractors: ['CLOCK', 'HOUR', 'LATE'] },
  { word: 'STAR', correct: 'JAR', distractors: ['SKY', 'MOON', 'GLOW'] },
  { word: 'FIRE', correct: 'WIRE', distractors: ['FLAME', 'HOT', 'BURN'] },
  { word: 'SNOW', correct: 'BLOW', distractors: ['COLD', 'ICE', 'WHITE'] },
  { word: 'RING', correct: 'THING', distractors: ['GOLD', 'BAND', 'JEWEL'] },
  { word: 'FISH', correct: 'DISH', distractors: ['SWIM', 'WATER', 'HOOK'] },
  { word: 'DREAM', correct: 'CREAM', distractors: ['SLEEP', 'NIGHT', 'WISH'] },
  { word: 'WALL', correct: 'FALL', distractors: ['BRICK', 'HIGH', 'PAINT'] },
  { word: 'SAND', correct: 'LAND', distractors: ['BEACH', 'WAVE', 'DUST'] },
  { word: 'BOOK', correct: 'COOK', distractors: ['READ', 'PAGE', 'WORD'] },
  { word: 'SMILE', correct: 'MILE', distractors: ['HAPPY', 'FACE', 'LAUGH'] },
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

export interface RhymeTimeData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  word: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class RhymeTimeGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'rhymetime',
    name: 'Rhyme Time',
    description: 'Find the word that rhymes! Fast, fun, poetic.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: RhymePuzzle | null = null;
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

  private makeData(): RhymeTimeData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      word: this.currentPuzzle?.word ?? '',
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
    id: 'rhymetime',
    name: 'Rhyme Time',
    description: 'Find the word that rhymes! Fast, fun, poetic.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new RhymeTimeGame(),
);
