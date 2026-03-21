export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export interface GameState {
  gameId: string;
  phase: 'waiting' | 'active' | 'results';
  scores: Record<string, number>; // playerId -> score
  data: unknown; // game-specific state
}
