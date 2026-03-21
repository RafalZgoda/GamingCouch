import type { Player, ControllerInputEvent, GameState, FinalScores } from '@gamingcouch/shared';
import { GameRegistry } from './GameRegistry.js';
import type { Game } from './Game.js';

const TICK_INTERVAL_MS = 100;

/**
 * Per-room game runtime.
 * Owns the active Game instance, drives the tick loop, and routes events.
 */
export class GameEngine {
  private readonly game: Game;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  private ended = false;

  constructor(
    readonly roomId: string,
    readonly gameId: string,
    /** Called on every tick with the latest state — broadcast to all room clients. */
    private readonly onStateUpdate: (state: GameState) => void,
    /** Called once when the game reaches 'results' phase. */
    private readonly onGameEnd: (final: FinalScores) => void,
  ) {
    const game = GameRegistry.create(gameId);
    if (!game) throw new Error(`Unknown game id: "${gameId}"`);
    this.game = game;
  }

  /** Start the game and begin ticking. Returns the initial state. */
  start(players: Player[]): GameState {
    const state = this.game.init(players);
    this.startTick();
    return state;
  }

  onPlayerJoin(player: Player): void {
    this.game.onPlayerJoin(player);
  }

  onPlayerLeave(playerId: string): void {
    this.game.onPlayerLeave(playerId);
  }

  /** Route a phone controller input to the active game. */
  onInput(playerId: string, input: ControllerInputEvent): void {
    if (!this.ended) this.game.onInput(playerId, input);
  }

  getState(): GameState {
    return this.game.getState();
  }

  /** Stop the engine and finalise scores. Idempotent. */
  end(): FinalScores {
    if (this.ended) return this.game.end();
    this.ended = true;
    this.stopTick();
    return this.game.end();
  }

  private startTick(): void {
    this.lastTickAt = Date.now();
    this.tickTimer = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastTickAt;
      this.lastTickAt = now;

      const state = this.game.tick(delta);
      this.onStateUpdate(state);

      if (state.phase === 'results' && !this.ended) {
        this.ended = true;
        this.stopTick();
        this.onGameEnd(this.game.end());
      }
    }, TICK_INTERVAL_MS);
  }

  private stopTick(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
