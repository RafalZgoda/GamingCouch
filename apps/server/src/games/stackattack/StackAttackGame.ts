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

const DEFAULT_ROUNDS = 15;
const ARENA_WIDTH = 400;
const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_WIDTH = 200;
const MIN_BLOCK_WIDTH = 20;
const BASE_SPEED = 150; // px per second
const SPEED_INCREMENT = 15; // increases each round
const REVEAL_MS = 2_500;
const PERFECT_POINTS = 250;
const PLACED_POINTS = 100;
const SPEED_BONUS_MAX = 80;

// ── Controller layout ────────────────────────────────────────────────────────

const TAP_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '🧱 DROP!', color: '#f59e0b', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface StackAttackData {
  round: number;
  totalRounds: number;
  phase: 'moving' | 'reveal';
  arenaWidth: number;
  blockHeight: number;
  // The tower: array of { x, width } from bottom to top
  tower: Array<{ x: number; width: number }>;
  // The moving block for this round
  movingX: number;
  movingWidth: number;
  movingDirection: 1 | -1;
  speed: number;
  // Who has placed this round
  placedPlayerIds: string[];
  // Per-player tower state (each player builds their own tower)
  playerTowers: Record<string, Array<{ x: number; width: number }>>;
  playerMovingX: Record<string, number>;
  playerPlaced: Record<string, boolean>;
  playerEliminated: string[];
  alivePlayers: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class StackAttackGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'stackattack',
    name: 'Stack Attack',
    description: 'Time your tap to stack blocks — miss and the tower shrinks!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'moving' | 'reveal' = 'moving';
  private revealMs = 0;
  private speed = BASE_SPEED;

  // Each player has their own tower
  private playerTowers: Record<string, Array<{ x: number; width: number }>> = {};
  private playerMovingX: Record<string, number> = {};
  private playerMovingDir: Record<string, 1 | -1> = {};
  private playerCurrentWidth: Record<string, number> = {};
  private playerPlaced: Record<string, boolean> = {};
  private playerEliminated: string[] = [];

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = DEFAULT_ROUNDS;
    for (const id of this.players.keys()) {
      // Everyone starts with one base block centered
      const baseX = (ARENA_WIDTH - INITIAL_BLOCK_WIDTH) / 2;
      this.playerTowers[id] = [{ x: baseX, width: INITIAL_BLOCK_WIDTH }];
      this.playerCurrentWidth[id] = INITIAL_BLOCK_WIDTH;
      this.playerMovingX[id] = 0;
      this.playerMovingDir[id] = 1;
      this.playerPlaced[id] = false;
    }
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: TAP_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (input.control !== 'A') return;
    if (this.subPhase !== 'moving') return;
    if (this.playerPlaced[playerId]) return;
    if (this.playerEliminated.includes(playerId)) return;

    this.placeBlock(playerId);
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'moving') {
      const deltaSec = deltaMs / 1000;
      const alive = this.getAlivePlayers();

      // Move each alive player's block
      for (const id of alive) {
        if (this.playerPlaced[id]) continue;
        let x = this.playerMovingX[id]!;
        const dir = this.playerMovingDir[id]!;
        const w = this.playerCurrentWidth[id]!;

        x += dir * this.speed * deltaSec;

        // Bounce off walls
        if (x + w >= ARENA_WIDTH) {
          x = ARENA_WIDTH - w;
          this.playerMovingDir[id] = -1;
        } else if (x <= 0) {
          x = 0;
          this.playerMovingDir[id] = 1;
        }

        this.playerMovingX[id] = x;
      }

      // Check if all alive players placed
      const allPlaced = alive.every((id) => this.playerPlaced[id]);
      if (allPlaced) {
        this.subPhase = 'reveal';
        this.revealMs = REVEAL_MS;
        this.phase = 'round_end';
      }

      return this.buildState(this.makeData());
    }

    // Reveal phase
    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      if (this.round >= this.totalRounds || this.getAlivePlayers().length <= 1) {
        this.phase = 'results';
      } else {
        this.round++;
        this.startRound();
      }
    }
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.subPhase = 'moving';
    this.phase = 'active';
    this.speed = BASE_SPEED + (this.round - 1) * SPEED_INCREMENT;

    const alive = this.getAlivePlayers();
    for (const id of alive) {
      this.playerPlaced[id] = false;
      // Start from left side, moving right
      this.playerMovingX[id] = 0;
      this.playerMovingDir[id] = 1;
    }
  }

  private placeBlock(playerId: string): void {
    this.playerPlaced[playerId] = true;

    const tower = this.playerTowers[playerId]!;
    const topBlock = tower[tower.length - 1]!;
    const movX = this.playerMovingX[playerId]!;
    const movW = this.playerCurrentWidth[playerId]!;

    // Calculate overlap
    const overlapLeft = Math.max(topBlock.x, movX);
    const overlapRight = Math.min(topBlock.x + topBlock.width, movX + movW);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // Complete miss — eliminated
      this.playerEliminated.push(playerId);
      return;
    }

    // Perfect placement bonus
    const isPerfect = Math.abs(movX - topBlock.x) < 3;
    const finalWidth = isPerfect ? topBlock.width : Math.round(overlapWidth);
    const finalX = isPerfect ? topBlock.x : overlapLeft;

    tower.push({ x: finalX, width: finalWidth });
    this.playerCurrentWidth[playerId] = finalWidth;

    // Score
    if (isPerfect) {
      this.addScore(playerId, PERFECT_POINTS);
    } else {
      const ratio = finalWidth / topBlock.width;
      const bonus = Math.round(ratio * SPEED_BONUS_MAX);
      this.addScore(playerId, PLACED_POINTS + bonus);
    }

    // If block too narrow, eliminated next round
    if (finalWidth < MIN_BLOCK_WIDTH) {
      this.playerEliminated.push(playerId);
    }
  }

  private getAlivePlayers(): string[] {
    return [...this.players.keys()].filter((id) => !this.playerEliminated.includes(id));
  }

  private makeData(): StackAttackData {
    const alive = this.getAlivePlayers();
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      arenaWidth: ARENA_WIDTH,
      blockHeight: BLOCK_HEIGHT,
      tower: [], // legacy field
      movingX: 0,
      movingWidth: 0,
      movingDirection: 1,
      speed: this.speed,
      placedPlayerIds: Object.entries(this.playerPlaced).filter(([, v]) => v).map(([id]) => id),
      playerTowers: Object.fromEntries(
        alive.map((id) => [id, [...(this.playerTowers[id] ?? [])]]),
      ),
      playerMovingX: Object.fromEntries(
        alive.map((id) => [id, this.playerMovingX[id] ?? 0]),
      ),
      playerPlaced: Object.fromEntries(
        alive.map((id) => [id, this.playerPlaced[id] ?? false]),
      ),
      playerEliminated: [...this.playerEliminated],
      alivePlayers: alive,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'stackattack',
    name: 'Stack Attack',
    description: 'Time your tap to stack blocks — miss and the tower shrinks!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new StackAttackGame(),
);
