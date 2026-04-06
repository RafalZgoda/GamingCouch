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
const PICK_MS = 5_000;
const REVEAL_MS = 2_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 200;

// ── Content ──────────────────────────────────────────────────────────────────

interface ColorEntry {
  name: string;
  hex: string;
}

const COLORS: ColorEntry[] = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'White', hex: '#f0f0f0' },
];

interface StroopPuzzle {
  word: string;       // The color word displayed
  wordHex: string;    // Actual color of the word (what the text looks like)
  inkColor: string;   // Name of the ink color (correct answer)
  options: string[];   // 4 color name options
  correctIndex: number;
}

function generatePuzzles(count: number): StroopPuzzle[] {
  const puzzles: StroopPuzzle[] = [];
  for (let i = 0; i < count; i++) {
    // Pick a word and a different ink color
    const wordIdx = Math.floor(Math.random() * COLORS.length);
    let inkIdx = Math.floor(Math.random() * COLORS.length);
    while (inkIdx === wordIdx) inkIdx = Math.floor(Math.random() * COLORS.length);

    const word = COLORS[wordIdx].name;
    const ink = COLORS[inkIdx];

    // Build 4 options: correct ink color + 3 distractors (one is always the word itself)
    const optionSet = new Set<string>();
    optionSet.add(ink.name);
    optionSet.add(word); // The tricky distractor
    while (optionSet.size < 4) {
      const r = COLORS[Math.floor(Math.random() * COLORS.length)];
      optionSet.add(r.name);
    }

    const options = [...optionSet].sort(() => Math.random() - 0.5);

    puzzles.push({
      word,
      wordHex: ink.hex,
      inkColor: ink.name,
      options,
      correctIndex: options.indexOf(ink.name),
    });
  }
  return puzzles;
}

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

export interface ColorSpyData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  word: string;
  wordHex: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class ColorSpyGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'colorspy',
    name: 'Color Spy',
    description: 'Name the ink color, not the word!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: StroopPuzzle[] = [];
  private current!: StroopPuzzle;
  private pickTimer = PICK_MS;
  private revealTimer = REVEAL_MS;
  private pickedPlayers = new Set<string>();
  private roundPhase: 'pick' | 'reveal' = 'pick';

  private makeData(): ColorSpyData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      word: this.current.word,
      wordHex: this.current.wordHex,
      options: this.current.options,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.current.correctIndex : null,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    this.pickTimer = PICK_MS;
    this.revealTimer = REVEAL_MS;
    this.pickedPlayers.clear();
    this.roundPhase = 'pick';
    this.phase = 'active';
  }

  protected onInit(_players: Player[]): GameState {
    this.pool = generatePuzzles(DEFAULT_ROUNDS);
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
    if (idx === this.current.correctIndex) {
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
  { id: 'colorspy', name: 'Color Spy', description: 'Name the ink color, not the word!', minPlayers: 1, maxPlayers: 100 },
  () => new ColorSpyGame(),
);
