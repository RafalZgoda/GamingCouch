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

interface LetterPuzzle {
  display: string;
  fullWord: string;
  correct: string;
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: LetterPuzzle[] = [
  { display: 'E_EPHANT', fullWord: 'ELEPHANT', correct: 'L', distractors: ['A', 'I', 'O'], category: 'Animals' },
  { display: 'GU_TAR', fullWord: 'GUITAR', correct: 'I', distractors: ['E', 'A', 'O'], category: 'Music' },
  { display: 'PY_AMID', fullWord: 'PYRAMID', correct: 'R', distractors: ['L', 'N', 'T'], category: 'Places' },
  { display: 'CH_COLATE', fullWord: 'CHOCOLATE', correct: 'O', distractors: ['A', 'E', 'I'], category: 'Food' },
  { display: 'DI_OSAUR', fullWord: 'DINOSAUR', correct: 'N', distractors: ['L', 'M', 'R'], category: 'Animals' },
  { display: 'AS_RONAUT', fullWord: 'ASTRONAUT', correct: 'T', distractors: ['P', 'C', 'K'], category: 'Space' },
  { display: 'BU_TERFLY', fullWord: 'BUTTERFLY', correct: 'T', distractors: ['L', 'N', 'S'], category: 'Animals' },
  { display: 'TELE_HONE', fullWord: 'TELEPHONE', correct: 'P', distractors: ['F', 'V', 'S'], category: 'Tech' },
  { display: 'UMB_ELLA', fullWord: 'UMBRELLA', correct: 'R', distractors: ['E', 'A', 'I'], category: 'Objects' },
  { display: 'VOL_ANO', fullWord: 'VOLCANO', correct: 'C', distractors: ['K', 'T', 'G'], category: 'Nature' },
  { display: 'KAN_AROO', fullWord: 'KANGAROO', correct: 'G', distractors: ['D', 'T', 'B'], category: 'Animals' },
  { display: 'TRA_POLINE', fullWord: 'TRAMPOLINE', correct: 'M', distractors: ['N', 'S', 'L'], category: 'Sports' },
  { display: 'SPA_HETTI', fullWord: 'SPAGHETTI', correct: 'G', distractors: ['C', 'K', 'T'], category: 'Food' },
  { display: 'HAM_URGER', fullWord: 'HAMBURGER', correct: 'B', distractors: ['M', 'P', 'D'], category: 'Food' },
  { display: 'CHAM_ION', fullWord: 'CHAMPION', correct: 'P', distractors: ['B', 'N', 'T'], category: 'Sports' },
  { display: 'CALEN_AR', fullWord: 'CALENDAR', correct: 'D', distractors: ['T', 'N', 'B'], category: 'Objects' },
  { display: 'MO_NTAIN', fullWord: 'MOUNTAIN', correct: 'U', distractors: ['N', 'L', 'R'], category: 'Nature' },
  { display: 'RAIN_OW', fullWord: 'RAINBOW', correct: 'B', distractors: ['C', 'D', 'G'], category: 'Nature' },
  { display: 'MILLI_NAIRE', fullWord: 'MILLIONAIRE', correct: 'O', distractors: ['A', 'E', 'I'], category: 'Money' },
  { display: 'WHIS_ER', fullWord: 'WHISPER', correct: 'P', distractors: ['K', 'T', 'C'], category: 'Words' },
  { display: 'SKEL_TON', fullWord: 'SKELETON', correct: 'E', distractors: ['A', 'I', 'O'], category: 'Body' },
  { display: 'DOLPH_N', fullWord: 'DOLPHIN', correct: 'I', distractors: ['A', 'E', 'O'], category: 'Animals' },
  { display: 'PENG_IN', fullWord: 'PENGUIN', correct: 'U', distractors: ['A', 'E', 'I'], category: 'Animals' },
  { display: 'ADVE_TURE', fullWord: 'ADVENTURE', correct: 'N', distractors: ['R', 'S', 'T'], category: 'Words' },
  { display: 'STR_WBERRY', fullWord: 'STRAWBERRY', correct: 'A', distractors: ['E', 'I', 'O'], category: 'Food' },
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

export interface MissingLetterData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  display: string;
  fullWord: string | null;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class MissingLetterGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'missingletter',
    name: 'Missing Letter',
    description: 'Fill in the blank letter! Spelling under pressure.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: LetterPuzzle | null = null;
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

  private makeData(): MissingLetterData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      display: this.currentPuzzle?.display ?? '',
      fullWord: isReveal ? (this.currentPuzzle?.fullWord ?? null) : null,
      category: this.currentPuzzle?.category ?? '',
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
    id: 'missingletter',
    name: 'Missing Letter',
    description: 'Fill in the blank letter! Spelling under pressure.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new MissingLetterGame(),
);
