import type { ControllerLayout } from './controller';

export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export interface RoundState {
  round: number;
  totalRounds: number;
  /** Per-player scores earned this round only */
  roundScores: Record<string, number>;
}

export interface GameState {
  gameId: string;
  phase: 'waiting' | 'active' | 'round_end' | 'results';
  /** Cumulative scores across all rounds */
  scores: Record<string, number>;
  round: RoundState;
  /** Game-specific payload — host display and controller UI consume this */
  data: unknown;
  /** When set, clients should update their controller UI immediately */
  controllerLayout?: ControllerLayout;
}

export interface FinalScores {
  scores: Record<string, number>;
  /** playerId of the winner, or null on a tie */
  winner: string | null;
}
