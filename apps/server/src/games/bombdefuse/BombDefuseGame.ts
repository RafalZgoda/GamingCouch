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
const BASE_PICK_MS = 6_000;
const MIN_PICK_MS = 3_000;
const SPEED_DECREASE_PER_ROUND = 300;
const REVEAL_MS = 3_500;
const CORRECT_POINTS = 200;
const STREAK_BONUS_3 = 300;
const STREAK_BONUS_5 = 500;

const WIRE_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
type WireColor = typeof WIRE_COLORS[number];

const WIRE_HEX: Record<WireColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
};

const WIRE_EMOJI: Record<WireColor, string> = {
  red: '🔴',
  blue: '🔵',
  green: '🟢',
  yellow: '🟡',
};

// ── Controller layout ────────────────────────────────────────────────────────

const CUT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '🔴 Red', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '🔵 Blue', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '🟢 Green', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '🟡 Yellow', color: '#eab308', size: 'lg', position: 'bottom-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '💣', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface BombDefuseData {
  round: number;
  totalRounds: number;
  pickWindowMs: number;
  maxPickMs: number;
  cutPlayerIds: string[];
  isReveal: boolean;
  correctWire: WireColor | null;
  playerCuts: Record<string, WireColor>;
  survivors: string[];
  exploded: string[];
  streaks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class BombDefuseGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'bombdefuse',
    name: 'Bomb Defuse',
    description: 'Cut the right wire before the bomb explodes!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private pickWindowMs = BASE_PICK_MS;
  private maxPickMs = BASE_PICK_MS;
  private revealMs = 0;
  private isReveal = false;
  private correctWire: WireColor | null = null;
  private playerCuts: Record<string, WireColor> = {};
  private survivors: string[] = [];
  private exploded: string[] = [];
  private streaks: Record<string, number> = {};

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    // Init streaks
    for (const id of this.players.keys()) {
      this.streaks[id] = 0;
    }
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: CUT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isReveal) return;
    if (this.playerCuts[playerId]) return; // already cut
    const wireMap: Record<string, WireColor> = { A: 'red', B: 'blue', C: 'green', D: 'yellow' };
    const wire = wireMap[input.control];
    if (!wire) return;
    this.playerCuts[playerId] = wire;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isReveal) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.emitState();
    }

    this.pickWindowMs -= deltaMs;
    const allCut = [...this.players.keys()].every((id) => this.playerCuts[id] !== undefined);
    if (this.pickWindowMs <= 0 || allCut) {
      this.resolveRound();
    }

    return this.emitState();
  }

  private startRound(): void {
    // Speed increases each round
    this.maxPickMs = Math.max(MIN_PICK_MS, BASE_PICK_MS - (this.round - 1) * SPEED_DECREASE_PER_ROUND);
    this.pickWindowMs = this.maxPickMs;
    this.isReveal = false;
    this.correctWire = WIRE_COLORS[Math.floor(Math.random() * 4)]!;
    this.playerCuts = {};
    this.survivors = [];
    this.exploded = [];
    this.phase = 'active';
  }

  private resolveRound(): void {
    this.isReveal = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const playerIds = [...this.players.keys()];

    for (const id of playerIds) {
      const cut = this.playerCuts[id];
      if (cut === this.correctWire) {
        this.survivors.push(id);
        this.streaks[id] = (this.streaks[id] ?? 0) + 1;
        let points = CORRECT_POINTS;
        const streak = this.streaks[id]!;
        if (streak >= 5) points += STREAK_BONUS_5;
        else if (streak >= 3) points += STREAK_BONUS_3;
        this.addScore(id, points);
      } else {
        this.exploded.push(id);
        this.streaks[id] = 0;
      }
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

  private emitState(): GameState {
    const data = this.makeData();
    const state = this.buildState(data);
    if (this.isReveal && this.revealMs >= REVEAL_MS - 100) {
      return { ...state, controllerLayout: WAIT_LAYOUT };
    }
    if (!this.isReveal && this.pickWindowMs >= this.maxPickMs - 100) {
      return { ...state, controllerLayout: CUT_LAYOUT };
    }
    return state;
  }

  private makeData(): BombDefuseData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      pickWindowMs: Math.max(0, this.pickWindowMs),
      maxPickMs: this.maxPickMs,
      cutPlayerIds: Object.keys(this.playerCuts),
      isReveal: this.isReveal,
      correctWire: this.isReveal ? this.correctWire : null,
      playerCuts: this.isReveal ? { ...this.playerCuts } : {},
      survivors: [...this.survivors],
      exploded: [...this.exploded],
      streaks: { ...this.streaks },
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'bombdefuse',
    name: 'Bomb Defuse',
    description: 'Cut the right wire before the bomb explodes!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new BombDefuseGame(config),
);
