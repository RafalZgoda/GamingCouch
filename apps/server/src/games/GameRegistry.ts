import type { GameDefinition } from '@gamingcouch/shared';
import type { Game } from './Game.js';

type GameFactory = (config?: Record<string, unknown>) => Game;

/**
 * Singleton registry that maps game IDs to their factory functions.
 * Games call GameRegistry.register() at module load time (side-effect import).
 */
class GameRegistryClass {
  private readonly entries = new Map<string, { definition: GameDefinition; factory: GameFactory }>();

  /**
   * Register a game.
   * @param definition  Metadata shown in the lobby game picker.
   * @param factory     Called each time a room starts this game.
   */
  register(definition: GameDefinition, factory: GameFactory): void {
    if (this.entries.has(definition.id)) {
      throw new Error(`Game already registered: ${definition.id}`);
    }
    this.entries.set(definition.id, { definition, factory });
  }

  /** Create a fresh game instance for a room. Returns null if unknown id. */
  create(gameId: string, config?: Record<string, unknown>): Game | null {
    const entry = this.entries.get(gameId);
    return entry ? entry.factory(config) : null;
  }

  /** List all registered game definitions (for the lobby picker). */
  list(): GameDefinition[] {
    return [...this.entries.values()].map((e) => e.definition);
  }

  has(gameId: string): boolean {
    return this.entries.has(gameId);
  }
}

export const GameRegistry = new GameRegistryClass();
