import type { Player, ControllerInputEvent, GameState, FinalScores, GameDefinition } from '@gamingcouch/shared';

/**
 * Contract every GamingCouch game must implement.
 * Instantiated once per active room; the engine owns the lifecycle.
 */
export interface Game {
  readonly definition: GameDefinition;

  /** Called once when HOST_START_GAME fires. Returns initial state. */
  init(players: Player[]): GameState;

  /** Called when a new player joins mid-game. */
  onPlayerJoin(player: Player): void;

  /** Called when a player disconnects or is kicked. */
  onPlayerLeave(playerId: string): void;

  /** Called for every PLAYER_INPUT message from a phone controller. */
  onInput(playerId: string, input: ControllerInputEvent): void;

  /** Called every TICK_INTERVAL_MS by the engine. Returns current state. */
  tick(deltaMs: number): GameState;

  /** Returns the current state without advancing it. */
  getState(): GameState;

  /** Finalise the game and return scores. Engine stops ticking after this. */
  end(): FinalScores;
}
