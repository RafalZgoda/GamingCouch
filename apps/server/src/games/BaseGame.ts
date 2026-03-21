import type { Player, ControllerInputEvent, GameState, FinalScores, GameDefinition } from '@gamingcouch/shared';
import type { Game } from './Game.js';

/**
 * Abstract base class that handles shared round/scoring bookkeeping.
 * Games extend this and implement onInit, onTick, and onInput.
 */
export abstract class BaseGame implements Game {
  abstract readonly definition: GameDefinition;

  protected players: Map<string, Player> = new Map();
  protected scores: Record<string, number> = {};
  protected round = 1;
  protected totalRounds = 1;
  protected phase: GameState['phase'] = 'waiting';

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  init(players: Player[]): GameState {
    const nonHost = players.filter((p) => !p.isHost);
    this.players = new Map(nonHost.map((p) => [p.id, p]));
    this.scores = Object.fromEntries(nonHost.map((p) => [p.id, 0]));
    this.phase = 'active';
    return this.onInit(players);
  }

  onPlayerJoin(player: Player): void {
    if (!player.isHost) {
      this.players.set(player.id, player);
      this.scores[player.id] ??= 0;
    }
    this.handlePlayerJoin(player);
  }

  onPlayerLeave(playerId: string): void {
    this.players.delete(playerId);
    this.handlePlayerLeave(playerId);
  }

  tick(deltaMs: number): GameState {
    return this.onTick(deltaMs);
  }

  getState(): GameState {
    return this.buildState({});
  }

  end(): FinalScores {
    this.phase = 'results';
    return this.computeFinalScores();
  }

  abstract onInput(playerId: string, input: ControllerInputEvent): void;

  // ── Hooks for subclasses ───────────────────────────────────────────────────

  protected abstract onInit(players: Player[]): GameState;
  protected abstract onTick(deltaMs: number): GameState;

  protected handlePlayerJoin(_player: Player): void {}
  protected handlePlayerLeave(_playerId: string): void {}

  // ── Scoring helpers ────────────────────────────────────────────────────────

  protected addScore(playerId: string, points: number): void {
    this.scores[playerId] = (this.scores[playerId] ?? 0) + points;
  }

  /**
   * Call at the end of a round. Increments round counter or moves to results
   * when all rounds are complete.
   */
  protected advanceRound(): void {
    if (this.round < this.totalRounds) {
      this.round++;
      this.phase = 'round_end';
    } else {
      this.phase = 'results';
    }
  }

  /**
   * Helper to build a GameState snapshot from game-specific data.
   * @param data    Game-specific payload (consumed by host display).
   * @param roundScores  Per-player points earned this round (optional).
   */
  protected buildState(data: unknown, roundScores: Record<string, number> = {}): GameState {
    return {
      gameId: this.definition.id,
      phase: this.phase,
      scores: { ...this.scores },
      round: {
        round: this.round,
        totalRounds: this.totalRounds,
        roundScores,
      },
      data,
    };
  }

  private computeFinalScores(): FinalScores {
    const entries = Object.entries(this.scores);
    if (entries.length === 0) return { scores: {}, winner: null };
    const maxScore = Math.max(...entries.map(([, s]) => s));
    const winners = entries.filter(([, s]) => s === maxScore).map(([id]) => id);
    return {
      scores: { ...this.scores },
      winner: winners.length === 1 ? (winners[0] ?? null) : null,
    };
  }
}
