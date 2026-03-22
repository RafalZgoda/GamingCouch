import type { Player, ControllerInputEvent, GameState, GameDefinition, ControllerLayout } from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUNDS = 6;
const MIN_FUSE_MS = 10_000;
const MAX_FUSE_MS = 25_000;
const REVEAL_MS = 3_000;
const LOSE_POINTS = 500;
const SURVIVE_POINTS = 100;

// ── Controller layout ─────────────────────────────────────────────────────────

const PASS_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'PASS', label: '🥔 PASS!', color: '#f97316', size: 'lg', position: 'center' },
  ],
};

// ── Public state shape ────────────────────────────────────────────────────────

export interface HotPotatoData {
  holderPlayerId: string;
  round: number;
  totalRounds: number;
  /** Counting down but exact duration is hidden from clients to keep suspense */
  ticking: boolean;
  /** Only set during reveal */
  explodedPlayerId?: string;
}

// ── Game ──────────────────────────────────────────────────────────────────────

export class HotPotatoGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'hotpotato',
    name: 'Hot Potato',
    description: "Pass the 🥔 before it explodes! The holder when it goes off loses points.",
    minPlayers: 2,
    maxPlayers: 8,
  };

  private holderPlayerId = '';
  private fuseMs = 0;
  private revealMs = 0;
  private isRevealing = false;
  private explodedPlayerId = '';

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = ROUNDS;
    this.startRound();
    return this.currentState();
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down' || input.control !== 'PASS') return;
    if (this.isRevealing || this.phase !== 'active') return;
    if (playerId !== this.holderPlayerId) return; // only holder can pass

    // Pass to a random other player
    const others = [...this.players.keys()].filter((id) => id !== playerId);
    if (others.length === 0) return;
    const nextIdx = Math.floor(Math.random() * others.length);
    this.holderPlayerId = others[nextIdx]!;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
    } else if (this.phase === 'active') {
      this.fuseMs -= deltaMs;
      if (this.fuseMs <= 0) {
        this.explode();
      }
    }
    return this.currentState();
  }

  protected handlePlayerLeave(playerId: string): void {
    // If holder left, pass to someone else
    if (this.holderPlayerId === playerId) {
      const remaining = [...this.players.keys()];
      if (remaining.length > 0) {
        this.holderPlayerId = remaining[Math.floor(Math.random() * remaining.length)]!;
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private startRound(): void {
    const playerIds = [...this.players.keys()];
    this.holderPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)]!;
    this.fuseMs = MIN_FUSE_MS + Math.random() * (MAX_FUSE_MS - MIN_FUSE_MS);
    this.revealMs = 0;
    this.isRevealing = false;
    this.explodedPlayerId = '';
    this.phase = 'active';
  }

  private explode(): void {
    this.explodedPlayerId = this.holderPlayerId;
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    // Holder loses points, everyone else gains
    this.addScore(this.explodedPlayerId, -LOSE_POINTS);
    for (const id of this.players.keys()) {
      if (id !== this.explodedPlayerId) {
        this.addScore(id, SURVIVE_POINTS);
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

  private currentState(): GameState {
    const data: HotPotatoData = {
      holderPlayerId: this.holderPlayerId,
      round: this.round,
      totalRounds: this.totalRounds,
      ticking: !this.isRevealing && this.phase === 'active',
      ...(this.isRevealing && { explodedPlayerId: this.explodedPlayerId }),
    };

    return {
      ...this.buildState(data),
      controllerLayout: PASS_LAYOUT,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'hotpotato',
    name: 'Hot Potato',
    description: "Pass the 🥔 before it explodes! The holder when it goes off loses points.",
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new HotPotatoGame(),
);
