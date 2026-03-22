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

const ROUNDS = 8;
const SHOW_MS = 2_500;    // window to tap the matching color
const REVEAL_MS = 2_000;  // show results before next round
const MAX_SCORE = 1_000;
const MIN_SCORE = 200;
const WRONG_PENALTY = 100;

const COLORS = ['red', 'blue', 'green', 'yellow'] as const;
type TargetColor = typeof COLORS[number];

// Button A=red, B=blue, C=green, D=yellow
const COLOR_TO_BUTTON: Record<TargetColor, string> = {
  red: 'A', blue: 'B', green: 'C', yellow: 'D',
};

const COLOR_HEX: Record<TargetColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
};

// ── Controller layout (A/B/C/D colored) ──────────────────────────────────────

const COLORMATCH_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: COLOR_HEX.red,    size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: COLOR_HEX.blue,   size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: COLOR_HEX.green,  size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: COLOR_HEX.yellow, size: 'lg', position: 'bottom-right' },
  ],
};

// ── Public state shape ────────────────────────────────────────────────────────

export interface ColorMatchData {
  color: TargetColor;
  colorHex: string;
  round: number;
  totalRounds: number;
  timeRemainingMs: number;
  /** Only during round_end */
  playerTimes?: Record<string, number>; // playerId → reaction ms
  wrongTappers?: string[];              // tapped wrong button
  missedPlayers?: string[];             // didn't tap in time
}

// ── Game implementation ───────────────────────────────────────────────────────

export class ColorMatchGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'colormatch',
    name: 'Color Match',
    description: 'Tap the button matching the displayed color as fast as possible!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private targetColor: TargetColor = 'red';
  private showMs = 0;
  private revealMs = 0;
  private isRevealing = false;
  private readonly configRounds: number;
  private roundStartMs = 0;
  private playerTaps = new Map<string, { button: string; timeMs: number }>();
  private currentRoundScores: Record<string, number> = {};

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(3, Math.round(r))) : ROUNDS;
  }

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.startRound();
    return this.currentState();
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isRevealing) return;
    if (this.phase !== 'active') return;
    if (this.playerTaps.has(playerId)) return; // already tapped

    const timeMs = Date.now() - this.roundStartMs;
    this.playerTaps.set(playerId, { button: input.control, timeMs });

    // All players tapped → reveal early
    if (this.playerTaps.size >= this.players.size) {
      this.startReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
    } else if (this.phase === 'active') {
      this.showMs -= deltaMs;
      if (this.showMs <= 0) {
        this.showMs = 0;
        this.startReveal();
      }
    }
    return this.currentState();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startRound(): void {
    const idx = Math.floor(Math.random() * COLORS.length);
    this.targetColor = COLORS[idx]!;
    this.showMs = SHOW_MS;
    this.revealMs = 0;
    this.isRevealing = false;
    this.playerTaps = new Map();
    this.currentRoundScores = {};
    this.phase = 'active';
    this.roundStartMs = Date.now();
  }

  private startReveal(): void {
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    const correctButton = COLOR_TO_BUTTON[this.targetColor];
    const validTaps: Array<{ playerId: string; timeMs: number }> = [];

    for (const [playerId, tap] of this.playerTaps) {
      if (tap.button === correctButton) {
        validTaps.push({ playerId, timeMs: tap.timeMs });
      } else {
        // Wrong button
        this.currentRoundScores[playerId] = -WRONG_PENALTY;
        this.addScore(playerId, -WRONG_PENALTY);
      }
    }

    validTaps.sort((a, b) => a.timeMs - b.timeMs);
    for (const { playerId, timeMs } of validTaps) {
      const fraction = Math.max(0, 1 - timeMs / SHOW_MS);
      const pts = MIN_SCORE + Math.round((MAX_SCORE - MIN_SCORE) * fraction);
      this.currentRoundScores[playerId] = pts;
      this.addScore(playerId, pts);
    }
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private currentState(): GameState {
    const correctButton = COLOR_TO_BUTTON[this.targetColor];
    const playerTimes: Record<string, number> = {};
    const wrongTappers: string[] = [];
    const missedPlayers: string[] = [];

    if (this.isRevealing) {
      for (const [id, tap] of this.playerTaps) {
        if (tap.button === correctButton) {
          playerTimes[id] = tap.timeMs;
        } else {
          wrongTappers.push(id);
        }
      }
      for (const id of this.players.keys()) {
        if (!this.playerTaps.has(id)) missedPlayers.push(id);
      }
    }

    const data: ColorMatchData = {
      color: this.targetColor,
      colorHex: COLOR_HEX[this.targetColor],
      round: this.round,
      totalRounds: this.totalRounds,
      timeRemainingMs: Math.max(0, this.showMs),
      ...(this.isRevealing && { playerTimes, wrongTappers, missedPlayers }),
    };

    return {
      ...this.buildState(data, this.currentRoundScores),
      controllerLayout: COLORMATCH_LAYOUT,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'colormatch',
    name: 'Color Match',
    description: 'Tap the button matching the displayed color as fast as possible!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  (config) => new ColorMatchGame(config),
);
