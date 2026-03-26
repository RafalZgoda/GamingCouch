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

const DEFAULT_ROUNDS = 8;
const PAIRS_PER_ROUND = 4; // 4 positions = 2 pairs
const FLASH_MS = 1_200;
const INPUT_MS = 6_000;
const REVEAL_MS = 3_000;
const CORRECT_PAIR_POINTS = 200;
const SPEED_BONUS_MAX = 100;

const SYMBOLS = ['🍎', '🍊', '🍋', '🍇', '🌟', '🔥', '💎', '🎵', '🦋', '🌺', '🐱', '🐶', '🎯', '🏆', '⚡', '🌙'];

type Position = 'A' | 'B' | 'C' | 'D';
const POSITIONS: Position[] = ['A', 'B', 'C', 'D'];

// ── Controller layout ───────────────────────────────────────────────────────

const PLAY_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '⬆️', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '⬆️', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '⬇️', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '⬇️', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '👀', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface MatchMadnessData {
  round: number;
  totalRounds: number;
  phase: 'flash' | 'input' | 'reveal';
  grid: Record<Position, string | null>; // symbol or null (hidden)
  flashMs: number;
  inputMs: number;
  playerFirstPick: Record<string, Position>;
  playerSecondPick: Record<string, Position>;
  matchedPlayers: string[];
  failedPlayers: string[];
  pairSymbol: string | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class MatchMadnessGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'matchmadness',
    name: 'Match Madness',
    description: 'Memorize the grid then find the matching pair!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'flash' | 'input' | 'reveal' = 'flash';
  private flashMs = 0;
  private inputMs = 0;
  private revealMs = 0;
  private grid: Record<Position, string> = { A: '', B: '', C: '', D: '' };
  private pairPositions: [Position, Position] = ['A', 'B'];
  private pairSymbol = '';
  private playerFirstPick: Record<string, Position> = {};
  private playerSecondPick: Record<string, Position> = {};
  private matchedPlayers: string[] = [];
  private failedPlayers: string[] = [];
  private usedSymbols: Set<string> = new Set();

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = DEFAULT_ROUNDS;
    this.generateGrid();
    this.subPhase = 'flash';
    this.flashMs = FLASH_MS;
    return { ...this.buildState(this.makeData()), controllerLayout: WAIT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'input') return;
    if (!POSITIONS.includes(input.control as Position)) return;
    const pos = input.control as Position;

    // Already finished
    if (this.matchedPlayers.includes(playerId) || this.failedPlayers.includes(playerId)) return;

    if (!this.playerFirstPick[playerId]) {
      this.playerFirstPick[playerId] = pos;
    } else if (!this.playerSecondPick[playerId]) {
      if (pos === this.playerFirstPick[playerId]) return; // same position, ignore
      this.playerSecondPick[playerId] = pos;

      // Check if pair matches
      const p1 = this.playerFirstPick[playerId]!;
      const p2 = pos;
      const isPair =
        (p1 === this.pairPositions[0] && p2 === this.pairPositions[1]) ||
        (p1 === this.pairPositions[1] && p2 === this.pairPositions[0]);

      if (isPair) {
        this.matchedPlayers.push(playerId);
        const timeLeft = Math.max(0, this.inputMs);
        const speedBonus = Math.round((timeLeft / INPUT_MS) * SPEED_BONUS_MAX);
        this.addScore(playerId, CORRECT_PAIR_POINTS + speedBonus);
      } else {
        this.failedPlayers.push(playerId);
      }
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'flash') {
      this.flashMs -= deltaMs;
      if (this.flashMs <= 0) {
        this.subPhase = 'input';
        this.inputMs = INPUT_MS;
        this.playerFirstPick = {};
        this.playerSecondPick = {};
        this.matchedPlayers = [];
        this.failedPlayers = [];
        return { ...this.buildState(this.makeData()), controllerLayout: PLAY_LAYOUT };
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'input') {
      this.inputMs -= deltaMs;
      const allDone = [...this.players.keys()].every(
        (id) => this.matchedPlayers.includes(id) || this.failedPlayers.includes(id),
      );
      if (this.inputMs <= 0 || allDone) {
        this.subPhase = 'reveal';
        this.revealMs = REVEAL_MS;
        this.phase = 'round_end';
      }
      return this.buildState(this.makeData());
    }

    // reveal
    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      if (this.round >= this.totalRounds) {
        this.phase = 'results';
      } else {
        this.round++;
        this.generateGrid();
        this.subPhase = 'flash';
        this.flashMs = Math.max(600, FLASH_MS - (this.round - 1) * 75); // gets harder
        this.phase = 'active';
      }
    }
    return this.buildState(this.makeData());
  }

  private generateGrid(): void {
    // Pick 2 unique symbols for 4 positions (2 pairs, each symbol appears twice)
    // Actually: 4 positions, 1 matching pair + 2 unique distractors
    const available = SYMBOLS.filter((s) => !this.usedSymbols.has(s));
    const shuffled = available.length >= 3
      ? available.sort(() => Math.random() - 0.5)
      : SYMBOLS.sort(() => Math.random() - 0.5);

    this.pairSymbol = shuffled[0]!;
    const distractor1 = shuffled[1]!;
    const distractor2 = shuffled[2]!;
    this.usedSymbols.add(this.pairSymbol);

    // Place pair in 2 random positions, distractors in remaining 2
    const positions = [...POSITIONS].sort(() => Math.random() - 0.5);
    this.pairPositions = [positions[0]!, positions[1]!];

    const gridEntries: [Position, string][] = [
      [positions[0]!, this.pairSymbol],
      [positions[1]!, this.pairSymbol],
      [positions[2]!, distractor1],
      [positions[3]!, distractor2],
    ];
    this.grid = Object.fromEntries(gridEntries) as Record<Position, string>;
  }

  private makeData(): MatchMadnessData {
    const showGrid = this.subPhase === 'flash' || this.subPhase === 'reveal';
    const gridView: Record<Position, string | null> = {
      A: showGrid ? this.grid.A : null,
      B: showGrid ? this.grid.B : null,
      C: showGrid ? this.grid.C : null,
      D: showGrid ? this.grid.D : null,
    };

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      grid: gridView,
      flashMs: Math.max(0, this.flashMs),
      inputMs: Math.max(0, this.inputMs),
      playerFirstPick: this.subPhase === 'input' ? { ...this.playerFirstPick } : {},
      playerSecondPick: this.subPhase === 'input' ? { ...this.playerSecondPick } : {},
      matchedPlayers: [...this.matchedPlayers],
      failedPlayers: [...this.failedPlayers],
      pairSymbol: this.subPhase === 'reveal' ? this.pairSymbol : null,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'matchmadness',
    name: 'Match Madness',
    description: 'Memorize the grid then find the matching pair!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new MatchMadnessGame(),
);
