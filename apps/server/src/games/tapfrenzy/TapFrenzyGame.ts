import type {
  Player,
  ControllerInputEvent,
  GameState,
  GameDefinition,
  ControllerLayout,
} from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const TAP_DURATION_MS = 5_000;
const BETWEEN_ROUNDS_MS = 3_000;
const TOTAL_ROUNDS = 5;

const POINTS_BY_RANK = [1000, 700, 500, 300, 200, 100, 50, 25];

// ── Controller layout ─────────────────────────────────────────────────────────

const TAP_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'TAP', label: '👇 TAP!', color: '#6366f1', size: 'lg', position: 'center' },
  ],
};

// ── Public state shape ────────────────────────────────────────────────────────

export interface TapFrenzyData {
  tappingPhase: 'countdown' | 'tapping' | 'reveal';
  countdownMs: number;
  tappingMs: number;
  playerTaps: Record<string, number>;
  round: number;
  totalRounds: number;
}

// ── Game implementation ───────────────────────────────────────────────────────

export class TapFrenzyGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'tapfrenzy',
    name: 'Tap Frenzy',
    description: 'Tap as fast as you can in 5 seconds! Most taps wins each round!',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private tappingPhase: 'countdown' | 'tapping' | 'reveal' = 'countdown';
  private timerMs = 0;
  private playerTaps: Record<string, number> = {};
  private currentRoundScores: Record<string, number> = {};

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(3, Math.round(r))) : TOTAL_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.round = 1;
    this.startCountdown();
    return this.currentState();
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (this.tappingPhase !== 'tapping') return;
    if (input.action !== 'button_down') return;
    if (input.control !== 'TAP') return;
    this.playerTaps[playerId] = (this.playerTaps[playerId] ?? 0) + 1;
  }

  protected onTick(deltaMs: number): GameState {
    this.timerMs -= deltaMs;

    if (this.timerMs <= 0) {
      if (this.tappingPhase === 'countdown') {
        this.startTapping();
      } else if (this.tappingPhase === 'tapping') {
        this.startReveal();
      } else {
        // reveal → next round or end
        if (this.round < this.totalRounds) {
          this.round++;
          this.startCountdown();
        } else {
          this.phase = 'results';
        }
      }
    }

    return this.currentState();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startCountdown(): void {
    this.tappingPhase = 'countdown';
    this.timerMs = BETWEEN_ROUNDS_MS;
    this.playerTaps = {};
    this.currentRoundScores = {};
    this.phase = 'active';
  }

  private startTapping(): void {
    this.tappingPhase = 'tapping';
    this.timerMs = TAP_DURATION_MS;
  }

  private startReveal(): void {
    this.tappingPhase = 'reveal';
    this.timerMs = BETWEEN_ROUNDS_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    // Score by tap rank — more taps = higher rank
    const sorted = Object.entries(this.playerTaps).sort(([, a], [, b]) => b - a);
    sorted.forEach(([playerId], index) => {
      const pts = POINTS_BY_RANK[index] ?? 10;
      this.currentRoundScores[playerId] = pts;
      this.addScore(playerId, pts);
    });
  }

  private currentState(): GameState {
    const data: TapFrenzyData = {
      tappingPhase: this.tappingPhase,
      countdownMs: this.tappingPhase === 'countdown' ? Math.max(0, this.timerMs) : 0,
      tappingMs: this.tappingPhase === 'tapping' ? Math.max(0, this.timerMs) : 0,
      playerTaps: { ...this.playerTaps },
      round: this.round,
      totalRounds: this.totalRounds,
    };

    return {
      ...this.buildState(data, this.currentRoundScores),
      controllerLayout: TAP_LAYOUT,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'tapfrenzy',
    name: 'Tap Frenzy',
    description: 'Tap as fast as you can in 5 seconds! Most taps wins each round!',
    minPlayers: 1,
    maxPlayers: 8,
  },
  (config) => new TapFrenzyGame(config),
);
