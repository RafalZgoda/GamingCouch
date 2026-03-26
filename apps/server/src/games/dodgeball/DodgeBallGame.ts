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

const DEFAULT_ROUNDS = 10;
const BASE_REACT_MS = 2_500;
const MIN_REACT_MS = 1_000;
const SPEED_DECREASE = 150;
const WARN_MS = 1_200;
const REVEAL_MS = 3_000;
const DODGE_POINTS = 100;
const STARTING_LIVES = 3;
const LAST_STANDING_BONUS = 500;

type Direction = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const DIR_BUTTON: Record<Direction, string> = { up: 'A', down: 'B', left: 'C', right: 'D' };
const DIR_EMOJI: Record<Direction, string> = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };

// ── Controller layout ────────────────────────────────────────────────────────

const DODGE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '⬆️ Up', color: '#3b82f6', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '⬇️ Down', color: '#ef4444', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'C', label: '⬅️ Left', color: '#22c55e', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'D', label: '➡️ Right', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '🏃', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface DodgeBallData {
  round: number;
  totalRounds: number;
  hazardDirection: Direction | null;
  isWarning: boolean;
  warnMs: number;
  reactMs: number;
  maxReactMs: number;
  isReveal: boolean;
  playerDodges: Record<string, Direction>;
  dodgedPlayerIds: string[];
  survivors: string[];
  hitPlayers: string[];
  lives: Record<string, number>;
  eliminatedPlayers: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class DodgeBallGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'dodgeball',
    name: 'Dodge Ball',
    description: 'Dodge hazards from 4 directions — last one standing wins!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private hazardDirection: Direction = 'up';
  private isWarning = false;
  private warnMs = 0;
  private reactMs = 0;
  private maxReactMs = BASE_REACT_MS;
  private isReveal = false;
  private revealMs = 0;
  private playerDodges: Record<string, Direction> = {};
  private survivors: string[] = [];
  private hitPlayers: string[] = [];
  private lives: Record<string, number> = {};
  private eliminatedPlayers: string[] = [];

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
    if (this.isReveal || this.isWarning) return;
    if (this.eliminatedPlayers.includes(playerId)) return;
    if (this.playerDodges[playerId]) return;

    const dirMap: Record<string, Direction> = { A: 'up', B: 'down', C: 'left', D: 'right' };
    const dir = dirMap[input.control];
    if (!dir) return;
    this.playerDodges[playerId] = dir;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isReveal) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.buildState(this.makeData());
    }

    if (this.isWarning) {
      this.warnMs -= deltaMs;
      if (this.warnMs <= 0) {
        this.isWarning = false;
        this.reactMs = this.maxReactMs;
        return { ...this.buildState(this.makeData()), controllerLayout: DODGE_LAYOUT };
      }
      return this.buildState(this.makeData());
    }

    // React window
    this.reactMs -= deltaMs;
    const alivePlayers = [...this.players.keys()].filter((id) => !this.eliminatedPlayers.includes(id));
    const allDodged = alivePlayers.every((id) => this.playerDodges[id] !== undefined);

    if (this.reactMs <= 0 || allDodged) {
      this.resolveRound();
    }

    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.hazardDirection = DIRECTIONS[Math.floor(Math.random() * 4)]!;
    this.isWarning = true;
    this.warnMs = WARN_MS;
    this.isReveal = false;
    this.playerDodges = {};
    this.survivors = [];
    this.hitPlayers = [];
    this.phase = 'active';
    this.maxReactMs = Math.max(MIN_REACT_MS, BASE_REACT_MS - (this.round - 1) * SPEED_DECREASE);
  }

  private resolveRound(): void {
    this.isReveal = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    // The correct dodge = same direction as hazard (dodge INTO the hazard direction to avoid it)
    // Actually: hazard comes FROM a direction, so you dodge the OPPOSITE way
    const safeDir = this.getOpposite(this.hazardDirection);

    const alivePlayers = [...this.players.keys()].filter((id) => !this.eliminatedPlayers.includes(id));

    for (const id of alivePlayers) {
      const dodge = this.playerDodges[id];
      if (dodge === safeDir) {
        this.survivors.push(id);
        this.addScore(id, DODGE_POINTS);
      } else {
        this.hitPlayers.push(id);
        this.lives[id] = Math.max(0, (this.lives[id] ?? 0) - 1);
        if (this.lives[id] === 0) {
          this.eliminatedPlayers.push(id);
        }
      }
    }
  }

  private getOpposite(dir: Direction): Direction {
    switch (dir) {
      case 'up': return 'down';
      case 'down': return 'up';
      case 'left': return 'right';
      case 'right': return 'left';
    }
  }

  private nextRound(): void {
    const alivePlayers = [...this.players.keys()].filter((id) => !this.eliminatedPlayers.includes(id));
    if (this.round >= this.totalRounds || alivePlayers.length <= 1) {
      if (alivePlayers.length === 1) {
        this.addScore(alivePlayers[0]!, LAST_STANDING_BONUS);
      }
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private makeData(): DodgeBallData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      hazardDirection: this.isWarning || this.isReveal ? this.hazardDirection : null,
      isWarning: this.isWarning,
      warnMs: Math.max(0, this.warnMs),
      reactMs: Math.max(0, this.reactMs),
      maxReactMs: this.maxReactMs,
      isReveal: this.isReveal,
      playerDodges: this.isReveal ? { ...this.playerDodges } : {},
      dodgedPlayerIds: Object.keys(this.playerDodges),
      survivors: [...this.survivors],
      hitPlayers: [...this.hitPlayers],
      lives: { ...this.lives },
      eliminatedPlayers: [...this.eliminatedPlayers],
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'dodgeball',
    name: 'Dodge Ball',
    description: 'Dodge hazards from 4 directions — last one standing wins!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new DodgeBallGame(config),
);
