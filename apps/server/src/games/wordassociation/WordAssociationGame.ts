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
const PICK_MS = 7_000;
const REVEAL_MS = 2_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface AssocPuzzle {
  word: string;
  correct: string;
  distractors: [string, string, string];
}

const PUZZLES: AssocPuzzle[] = [
  { word: 'SALT', correct: 'PEPPER', distractors: ['SUGAR', 'WATER', 'FLOUR'] },
  { word: 'BREAD', correct: 'BUTTER', distractors: ['CHEESE', 'MILK', 'TOAST'] },
  { word: 'THUNDER', correct: 'LIGHTNING', distractors: ['RAIN', 'CLOUD', 'WIND'] },
  { word: 'PEANUT', correct: 'BUTTER', distractors: ['ALMOND', 'CASHEW', 'WALNUT'] },
  { word: 'LOCK', correct: 'KEY', distractors: ['DOOR', 'CHAIN', 'SAFE'] },
  { word: 'BLACK', correct: 'WHITE', distractors: ['DARK', 'NIGHT', 'SHADOW'] },
  { word: 'NEEDLE', correct: 'THREAD', distractors: ['PIN', 'FABRIC', 'BUTTON'] },
  { word: 'ROMEO', correct: 'JULIET', distractors: ['HAMLET', 'OPHELIA', 'CLEOPATRA'] },
  { word: 'HAMMER', correct: 'NAIL', distractors: ['SCREW', 'WOOD', 'WRENCH'] },
  { word: 'COFFEE', correct: 'CREAM', distractors: ['TEA', 'SUGAR', 'MILK'] },
  { word: 'FISH', correct: 'CHIPS', distractors: ['WATER', 'HOOK', 'BOAT'] },
  { word: 'SOAP', correct: 'WATER', distractors: ['CLEAN', 'TOWEL', 'BUBBLE'] },
  { word: 'KING', correct: 'QUEEN', distractors: ['CROWN', 'THRONE', 'CASTLE'] },
  { word: 'PILLOW', correct: 'BLANKET', distractors: ['BED', 'SLEEP', 'DREAM'] },
  { word: 'BACON', correct: 'EGGS', distractors: ['HAM', 'TOAST', 'SAUSAGE'] },
  { word: 'ROCK', correct: 'ROLL', distractors: ['STONE', 'PAPER', 'HARD'] },
  { word: 'CUP', correct: 'SAUCER', distractors: ['PLATE', 'BOWL', 'MUG'] },
  { word: 'SHOES', correct: 'SOCKS', distractors: ['FEET', 'LACES', 'BOOTS'] },
  { word: 'STARS', correct: 'STRIPES', distractors: ['MOON', 'SKY', 'NIGHT'] },
  { word: 'BOW', correct: 'ARROW', distractors: ['RIBBON', 'TIE', 'STRING'] },
  { word: 'HORSE', correct: 'CARRIAGE', distractors: ['SADDLE', 'RIDER', 'STABLE'] },
  { word: 'SMOKE', correct: 'FIRE', distractors: ['ASH', 'FLAME', 'HEAT'] },
  { word: 'TABLE', correct: 'CHAIR', distractors: ['DESK', 'WOOD', 'LAMP'] },
  { word: 'BRIDE', correct: 'GROOM', distractors: ['WEDDING', 'DRESS', 'RING'] },
  { word: 'CHALK', correct: 'BOARD', distractors: ['DUST', 'SCHOOL', 'WHITE'] },
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

export interface WordAssociationData {
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

export class WordAssociationGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'wordassociation',
    name: 'Word Association',
    description: 'Pick the most associated word! Classic pairs under pressure.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: AssocPuzzle | null = null;
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

  private makeData(): WordAssociationData {
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
    id: 'wordassociation',
    name: 'Word Association',
    description: 'Pick the most associated word! Classic pairs under pressure.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new WordAssociationGame(),
);
