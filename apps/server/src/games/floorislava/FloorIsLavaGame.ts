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
const BASE_JUMP_MS = 4_000;
const MIN_JUMP_MS = 1_800;
const SPEED_DECREASE_PER_ROUND = 200;
const FLASH_MS = 1_500;   // safe platform highlighted
const REVEAL_MS = 3_000;
const SURVIVE_POINTS = 150;
const PERFECT_BONUS = 100; // if jumped during flash (before it ended)
const STARTING_LIVES = 3;

type Platform = 'A' | 'B' | 'C' | 'D';

const PLATFORM_COLORS: Record<Platform, string> = {
  A: '#ef4444', B: '#3b82f6', C: '#22c55e', D: '#f59e0b',
};

// ── Controller layout ────────────────────────────────────────────────────────

const JUMP_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '🔴 A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '🔵 B', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '🟢 C', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '🟡 D', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '🌋', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface FloorIsLavaData {
  round: number;
  totalRounds: number;
  safePlatform: Platform | null;
  isFlashing: boolean;
  flashMs: number;
  jumpWindowMs: number;
  maxJumpMs: number;
  jumpedPlayerIds: string[];
  isReveal: boolean;
  playerJumps: Record<string, Platform>;
  survivors: string[];
  fallen: string[];
  lives: Record<string, number>;
  eliminatedPlayers: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class FloorIsLavaGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'floorislava',
    name: 'Floor is Lava',
    description: 'Jump to the safe platform before the lava rises!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private safePlatform: Platform = 'A';
  private isFlashing = false;
  private flashMs = 0;
  private jumpWindowMs = 0;
  private maxJumpMs = BASE_JUMP_MS;
  private isReveal = false;
  private revealMs = 0;
  private playerJumps: Record<string, Platform> = {};
  private survivors: string[] = [];
  private fallen: string[] = [];
  private lives: Record<string, number> = {};
  private eliminatedPlayers: string[] = [];
  private lastWasReveal = false;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    for (const id of this.players.keys()) {
      this.lives[id] = STARTING_LIVES;
    }
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: WAIT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isReveal || this.isFlashing) return;
    if (this.eliminatedPlayers.includes(playerId)) return;
    if (this.playerJumps[playerId]) return;
    const platform = input.control as Platform;
    if (!['A', 'B', 'C', 'D'].includes(platform)) return;
    this.playerJumps[playerId] = platform;
  }

  protected onTick(deltaMs: number): GameState {
    // Reveal phase
    if (this.isReveal) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.emitState();
    }

    // Flash phase — show the safe platform
    if (this.isFlashing) {
      this.flashMs -= deltaMs;
      if (this.flashMs <= 0) {
        this.isFlashing = false;
        this.jumpWindowMs = this.maxJumpMs;
      }
      return this.emitState();
    }

    // Jump window
    this.jumpWindowMs -= deltaMs;
    const alivePlayers = [...this.players.keys()].filter((id) => !this.eliminatedPlayers.includes(id));
    const allJumped = alivePlayers.every((id) => this.playerJumps[id] !== undefined);

    if (this.jumpWindowMs <= 0 || allJumped) {
      this.resolveRound();
    }

    return this.emitState();
  }

  private startRound(): void {
    const platforms: Platform[] = ['A', 'B', 'C', 'D'];
    this.safePlatform = platforms[Math.floor(Math.random() * 4)]!;
    this.isFlashing = true;
    this.flashMs = FLASH_MS;
    this.isReveal = false;
    this.playerJumps = {};
    this.survivors = [];
    this.fallen = [];
    this.phase = 'active';
    this.lastWasReveal = false;

    // Speed increases each round
    this.maxJumpMs = Math.max(MIN_JUMP_MS, BASE_JUMP_MS - (this.round - 1) * SPEED_DECREASE_PER_ROUND);
  }

  private resolveRound(): void {
    this.isReveal = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const alivePlayers = [...this.players.keys()].filter((id) => !this.eliminatedPlayers.includes(id));

    for (const id of alivePlayers) {
      const jump = this.playerJumps[id];
      if (jump === this.safePlatform) {
        this.survivors.push(id);
        this.addScore(id, SURVIVE_POINTS);
      } else {
        this.fallen.push(id);
        this.lives[id] = Math.max(0, (this.lives[id] ?? 0) - 1);
        if (this.lives[id] === 0) {
          this.eliminatedPlayers.push(id);
        }
      }
    }
  }

  private nextRound(): void {
    // Check if game should end
    const alivePlayers = [...this.players.keys()].filter((id) => !this.eliminatedPlayers.includes(id));
    if (this.round >= this.totalRounds || alivePlayers.length <= 1) {
      // Bonus for last player standing
      if (alivePlayers.length === 1) {
        this.addScore(alivePlayers[0]!, 500);
      }
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private emitState(): GameState {
    const data = this.makeData();
    const state = this.buildState(data);

    // Send controller layout transitions
    if (this.isReveal && !this.lastWasReveal) {
      this.lastWasReveal = true;
      return { ...state, controllerLayout: WAIT_LAYOUT };
    }
    if (!this.isReveal && !this.isFlashing && this.jumpWindowMs >= this.maxJumpMs - 100) {
      return { ...state, controllerLayout: JUMP_LAYOUT };
    }
    if (this.isFlashing && this.flashMs >= FLASH_MS - 100) {
      return { ...state, controllerLayout: WAIT_LAYOUT };
    }

    return state;
  }

  private makeData(): FloorIsLavaData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      safePlatform: this.isFlashing || this.isReveal ? this.safePlatform : null,
      isFlashing: this.isFlashing,
      flashMs: Math.max(0, this.flashMs),
      jumpWindowMs: Math.max(0, this.jumpWindowMs),
      maxJumpMs: this.maxJumpMs,
      jumpedPlayerIds: Object.keys(this.playerJumps),
      isReveal: this.isReveal,
      playerJumps: this.isReveal ? { ...this.playerJumps } : {},
      survivors: [...this.survivors],
      fallen: [...this.fallen],
      lives: { ...this.lives },
      eliminatedPlayers: [...this.eliminatedPlayers],
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'floorislava',
    name: 'Floor is Lava',
    description: 'Jump to the safe platform before the lava rises!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new FloorIsLavaGame(config),
);
