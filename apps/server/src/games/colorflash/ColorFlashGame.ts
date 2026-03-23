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
const FLASHES_PER_ROUND = 8;
const FLASH_DISPLAY_MS = 1_200; // How long a color is shown
const FLASH_GAP_MS = 600;       // Gap between flashes
const ROUND_END_MS = 3_000;
const SPEED_INCREASE = 0.88;     // Multiply durations each round

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'] as const;
const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow'] as const;

// ── Controller layout ────────────────────────────────────────────────────────

const TAP_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'TAP', label: 'TAP!', color: '#6366f1', size: 'lg', position: 'center' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '👀', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public state shape ───────────────────────────────────────────────────────

export interface ColorFlashData {
  flashColor: string | null;      // Current color hex being shown, null = gap
  flashColorName: string | null;
  flashIndex: number;
  flashesTotal: number;
  round: number;
  totalRounds: number;
  playerColors: Record<string, { hex: string; name: string }>;
  tappedPlayers: string[];        // Who tapped this flash
  isReveal: boolean;
  revealResults: Array<{
    playerId: string;
    correct: number;
    wrong: number;
    missed: number;
  }>;
}

// ── Game implementation ──────────────────────────────────────────────────────

export class ColorFlashGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'colorflash',
    name: 'Color Flash',
    description: 'Tap when YOUR color flashes — don\'t tap on others!',
    minPlayers: 2,
    maxPlayers: 4,
  };

  private readonly configRounds: number;
  private playerColorMap: Record<string, number> = {}; // playerId -> color index
  private flashIndex = 0;
  private flashSequence: number[] = [];  // Color index for each flash
  private flashTimerMs = 0;
  private isShowingFlash = true;
  private currentFlashDurationMs = FLASH_DISPLAY_MS;
  private currentGapMs = FLASH_GAP_MS;
  private isRoundEnd = false;
  private roundEndMs = 0;
  private tappedThisFlash = new Set<string>();
  private roundCorrect: Record<string, number> = {};
  private roundWrong: Record<string, number> = {};
  private roundMissed: Record<string, number> = {};
  private lastLayoutPhase: 'tap' | 'wait' | null = null;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(10, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    // Assign colors to players (max 4)
    const playerIds = [...this.players.keys()];
    playerIds.forEach((id, i) => {
      this.playerColorMap[id] = i % COLORS.length;
    });
    this.startRound();
    return this.currentState(true);
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down' || input.control !== 'TAP') return;
    if (this.isRoundEnd || !this.isShowingFlash) return;

    // Only count first tap per flash
    if (this.tappedThisFlash.has(playerId)) return;
    this.tappedThisFlash.add(playerId);

    const playerColorIndex = this.playerColorMap[playerId];
    const currentColorIndex = this.flashSequence[this.flashIndex];

    if (currentColorIndex === playerColorIndex) {
      // Correct tap — their color is showing
      const speedBonus = Math.round((this.flashTimerMs / this.currentFlashDurationMs) * 100);
      this.addScore(playerId, 150 + speedBonus);
      this.roundCorrect[playerId] = (this.roundCorrect[playerId] ?? 0) + 1;
    } else {
      // Wrong tap — not their color
      this.addScore(playerId, -200);
      this.roundWrong[playerId] = (this.roundWrong[playerId] ?? 0) + 1;
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRoundEnd) {
      this.roundEndMs -= deltaMs;
      if (this.roundEndMs <= 0) {
        this.nextRound();
      }
      return this.currentState(false);
    }

    this.flashTimerMs -= deltaMs;

    if (this.flashTimerMs <= 0) {
      if (this.isShowingFlash) {
        // Flash just ended — check for missed taps
        this.checkMissedTaps();
        this.isShowingFlash = false;
        this.flashTimerMs = this.currentGapMs;
        this.tappedThisFlash = new Set();
      } else {
        // Gap just ended — show next flash or end round
        this.flashIndex++;
        if (this.flashIndex >= FLASHES_PER_ROUND) {
          this.endRound();
        } else {
          this.isShowingFlash = true;
          this.flashTimerMs = this.currentFlashDurationMs;
          this.tappedThisFlash = new Set();
        }
      }
    }

    return this.currentState(false);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startRound(): void {
    const speedFactor = Math.pow(SPEED_INCREASE, this.round - 1);
    this.currentFlashDurationMs = FLASH_DISPLAY_MS * speedFactor;
    this.currentGapMs = FLASH_GAP_MS * speedFactor;

    // Generate random flash sequence
    this.flashSequence = [];
    const numColors = Math.min(this.players.size, COLORS.length);
    for (let i = 0; i < FLASHES_PER_ROUND; i++) {
      this.flashSequence.push(Math.floor(Math.random() * numColors));
    }

    this.flashIndex = 0;
    this.isShowingFlash = true;
    this.flashTimerMs = this.currentFlashDurationMs;
    this.isRoundEnd = false;
    this.tappedThisFlash = new Set();
    this.roundCorrect = {};
    this.roundWrong = {};
    this.roundMissed = {};
    this.phase = 'active';
    this.lastLayoutPhase = null;
  }

  private checkMissedTaps(): void {
    const currentColorIndex = this.flashSequence[this.flashIndex];
    for (const [playerId, colorIndex] of Object.entries(this.playerColorMap)) {
      if (colorIndex === currentColorIndex && !this.tappedThisFlash.has(playerId)) {
        // Player's color was showing but they didn't tap
        this.addScore(playerId, -100);
        this.roundMissed[playerId] = (this.roundMissed[playerId] ?? 0) + 1;
      }
    }
  }

  private endRound(): void {
    this.isRoundEnd = true;
    this.isShowingFlash = false;
    this.roundEndMs = ROUND_END_MS;
    this.phase = 'round_end';
    this.lastLayoutPhase = null;
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private currentState(forceLayoutUpdate: boolean): GameState {
    const targetPhase = this.isRoundEnd ? 'wait' as const : 'tap' as const;
    const layoutChanged = targetPhase !== this.lastLayoutPhase;
    const emitLayout = forceLayoutUpdate || layoutChanged;
    if (emitLayout) this.lastLayoutPhase = targetPhase;

    const playerColors: Record<string, { hex: string; name: string }> = {};
    for (const [id, idx] of Object.entries(this.playerColorMap)) {
      playerColors[id] = { hex: COLORS[idx]!, name: COLOR_NAMES[idx]! };
    }

    const currentColorIndex = this.isShowingFlash ? this.flashSequence[this.flashIndex] : null;

    const data: ColorFlashData = {
      flashColor: currentColorIndex !== null && currentColorIndex !== undefined ? (COLORS[currentColorIndex] ?? null) : null,
      flashColorName: currentColorIndex !== null && currentColorIndex !== undefined ? (COLOR_NAMES[currentColorIndex] ?? null) : null,
      flashIndex: this.flashIndex,
      flashesTotal: FLASHES_PER_ROUND,
      round: this.round,
      totalRounds: this.totalRounds,
      playerColors,
      tappedPlayers: [...this.tappedThisFlash],
      isReveal: this.isRoundEnd,
      revealResults: this.isRoundEnd
        ? [...this.players.keys()].map((id) => ({
            playerId: id,
            correct: this.roundCorrect[id] ?? 0,
            wrong: this.roundWrong[id] ?? 0,
            missed: this.roundMissed[id] ?? 0,
          }))
        : [],
    };

    const state = this.buildState(data);
    if (emitLayout) {
      return { ...state, controllerLayout: this.isRoundEnd ? WAIT_LAYOUT : TAP_LAYOUT };
    }
    return state;
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'colorflash',
    name: 'Color Flash',
    description: 'Tap when YOUR color flashes — don\'t tap on others!',
    minPlayers: 2,
    maxPlayers: 4,
  },
  (config) => new ColorFlashGame(config),
);
