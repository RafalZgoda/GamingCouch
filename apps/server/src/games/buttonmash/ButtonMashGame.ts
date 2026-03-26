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

const DEFAULT_ROUNDS = 5;
const RACE_DISTANCE = 100;
const RACE_DURATION_MS = 10_000;
const TAP_VALUE = 1;
const WRONG_TAP_PENALTY = 3;
const SWITCH_INTERVAL_MS = 3_000;
const ROUND_END_MS = 3_000;

type ActiveButton = 'A' | 'B' | 'C' | 'D';
const ALL_BUTTONS: ActiveButton[] = ['A', 'B', 'C', 'D'];
const BUTTON_COLORS: Record<ActiveButton, string> = {
  A: '#ef4444', B: '#3b82f6', C: '#22c55e', D: '#f59e0b',
};
const BUTTON_EMOJI: Record<ActiveButton, string> = {
  A: '🔴', B: '🔵', C: '🟢', D: '🟡',
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface ButtonMashData {
  round: number;
  totalRounds: number;
  activeButton: ActiveButton;
  raceTimeMs: number;
  positions: Record<string, number>;
  isRacing: boolean;
  isRoundEnd: boolean;
  roundEndMs: number;
  roundWinner: string | null;
  finishedPlayers: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class ButtonMashGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'buttonmash',
    name: 'Button Mash Race',
    description: 'Mash the right button to race across the screen!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private activeButton: ActiveButton = 'A';
  private raceTimeMs = RACE_DURATION_MS;
  private switchTimer = SWITCH_INTERVAL_MS;
  private positions: Record<string, number> = {};
  private isRacing = false;
  private isRoundEnd = false;
  private roundEndMs = 0;
  private roundWinner: string | null = null;
  private finishedPlayers: string[] = [];
  private layoutSent = false;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(10, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: this.makeLayout() };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (!this.isRacing) return;
    if (this.finishedPlayers.includes(playerId)) return;

    if (input.control === this.activeButton) {
      this.positions[playerId] = Math.min(RACE_DISTANCE, (this.positions[playerId] ?? 0) + TAP_VALUE);
      if (this.positions[playerId] >= RACE_DISTANCE && !this.finishedPlayers.includes(playerId)) {
        this.finishedPlayers.push(playerId);
        if (!this.roundWinner) this.roundWinner = playerId;
      }
    } else {
      // Wrong button penalty
      this.positions[playerId] = Math.max(0, (this.positions[playerId] ?? 0) - WRONG_TAP_PENALTY);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRoundEnd) {
      this.roundEndMs -= deltaMs;
      if (this.roundEndMs <= 0) this.nextRound();
      return this.buildState(this.makeData());
    }

    if (!this.isRacing) return this.buildState(this.makeData());

    this.raceTimeMs -= deltaMs;
    this.switchTimer -= deltaMs;

    // Switch active button
    if (this.switchTimer <= 0) {
      this.switchTimer = SWITCH_INTERVAL_MS;
      const others = ALL_BUTTONS.filter((b) => b !== this.activeButton);
      this.activeButton = others[Math.floor(Math.random() * others.length)]!;
      this.layoutSent = false;
    }

    // Check if someone finished or time ran out
    if (this.roundWinner || this.raceTimeMs <= 0) {
      this.endRound();
    }

    const data = this.makeData();
    const state = this.buildState(data);
    if (!this.layoutSent) {
      this.layoutSent = true;
      return { ...state, controllerLayout: this.makeLayout() };
    }
    return state;
  }

  private startRound(): void {
    this.activeButton = ALL_BUTTONS[Math.floor(Math.random() * 4)]!;
    this.raceTimeMs = RACE_DURATION_MS;
    this.switchTimer = SWITCH_INTERVAL_MS;
    this.positions = {};
    this.isRacing = true;
    this.isRoundEnd = false;
    this.roundWinner = null;
    this.finishedPlayers = [];
    this.layoutSent = false;
    this.phase = 'active';

    for (const id of this.players.keys()) {
      this.positions[id] = 0;
    }
  }

  private endRound(): void {
    this.isRacing = false;
    this.isRoundEnd = true;
    this.roundEndMs = ROUND_END_MS;
    this.phase = 'round_end';

    // Score based on position
    const playerIds = [...this.players.keys()];
    const sorted = playerIds.sort((a, b) => (this.positions[b] ?? 0) - (this.positions[a] ?? 0));

    for (let i = 0; i < sorted.length; i++) {
      const id = sorted[i]!;
      if (id === this.roundWinner) {
        this.addScore(id, 300);
      } else if (i === 1) {
        this.addScore(id, 150);
      } else if (i === 2) {
        this.addScore(id, 75);
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

  private makeLayout(): ControllerLayout {
    return {
      controls: ALL_BUTTONS.map((b) => ({
        type: 'button' as const,
        id: b,
        label: b === this.activeButton ? `${BUTTON_EMOJI[b]} MASH!` : BUTTON_EMOJI[b],
        color: b === this.activeButton ? BUTTON_COLORS[b] : '#374151',
        size: b === this.activeButton ? 'lg' as const : 'md' as const,
        position: b === 'A' ? 'top-left' as const : b === 'B' ? 'top-right' as const : b === 'C' ? 'bottom-left' as const : 'bottom-right' as const,
      })),
    };
  }

  private makeData(): ButtonMashData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      activeButton: this.activeButton,
      raceTimeMs: Math.max(0, this.raceTimeMs),
      positions: { ...this.positions },
      isRacing: this.isRacing,
      isRoundEnd: this.isRoundEnd,
      roundEndMs: Math.max(0, this.roundEndMs),
      roundWinner: this.roundWinner,
      finishedPlayers: [...this.finishedPlayers],
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'buttonmash',
    name: 'Button Mash Race',
    description: 'Mash the right button to race across the screen!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new ButtonMashGame(config),
);
