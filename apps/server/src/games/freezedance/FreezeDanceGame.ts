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
const DANCE_MIN_MS = 3_000;
const DANCE_MAX_MS = 8_000;
const FREEZE_WINDOW_MS = 2_000;
const REVEAL_MS = 3_000;
const TAP_POINTS = 10; // per tap during dance phase
const SURVIVE_BONUS = 100; // survive a freeze
const LAST_STANDING_BONUS = 500;

// ── Controller layout ────────────────────────────────────────────────────────

const DANCE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '💃 TAP!', color: '#ec4899', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface FreezeDanceData {
  round: number;
  totalRounds: number;
  phase: 'dance' | 'freeze' | 'reveal';
  danceMs: number;
  freezeMs: number;
  beatIndex: number;
  playerTaps: Record<string, number>;
  frozenTappers: string[]; // players who tapped during freeze
  survivors: string[];
  eliminated: string[];
  lives: Record<string, number>;
  alivePlayers: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class FreezeDanceGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'freezedance',
    name: 'Freeze Dance',
    description: 'Tap to the beat — but STOP when the music stops!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'dance' | 'freeze' | 'reveal' = 'dance';
  private danceMs = 0;
  private freezeMs = 0;
  private revealMs = 0;
  private playerTaps: Record<string, number> = {};
  private frozenTappers: string[] = [];
  private lives: Record<string, number> = {};
  private eliminatedPlayers: string[] = [];
  private beatIndex = 0;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = DEFAULT_ROUNDS;
    for (const id of this.players.keys()) {
      this.lives[id] = 3;
    }
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: DANCE_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (input.control !== 'A') return;
    if (this.eliminatedPlayers.includes(playerId)) return;

    if (this.subPhase === 'dance') {
      this.playerTaps[playerId] = (this.playerTaps[playerId] ?? 0) + 1;
      this.addScore(playerId, TAP_POINTS);
    } else if (this.subPhase === 'freeze') {
      // Tapped during freeze — penalty!
      if (!this.frozenTappers.includes(playerId)) {
        this.frozenTappers.push(playerId);
      }
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'dance') {
      this.danceMs -= deltaMs;
      // Advance beat index for visual pulse
      this.beatIndex = Math.floor((Date.now() / 400) % 4);

      if (this.danceMs <= 0) {
        this.subPhase = 'freeze';
        this.freezeMs = FREEZE_WINDOW_MS;
        this.frozenTappers = [];
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'freeze') {
      this.freezeMs -= deltaMs;
      if (this.freezeMs <= 0) {
        this.resolveRound();
      }
      return this.buildState(this.makeData());
    }

    // Reveal phase
    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      const alive = this.getAlivePlayers();
      if (this.round >= this.totalRounds || alive.length <= 1) {
        // Last standing bonus
        if (alive.length === 1) {
          this.addScore(alive[0]!, LAST_STANDING_BONUS);
        }
        this.phase = 'results';
      } else {
        this.round++;
        this.startRound();
      }
    }
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.subPhase = 'dance';
    this.phase = 'active';
    this.playerTaps = {};
    this.frozenTappers = [];
    // Random dance duration
    this.danceMs = DANCE_MIN_MS + Math.random() * (DANCE_MAX_MS - DANCE_MIN_MS);
  }

  private resolveRound(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const alive = this.getAlivePlayers();

    // Penalize frozen tappers
    for (const id of this.frozenTappers) {
      this.lives[id] = (this.lives[id] ?? 0) - 1;
      if ((this.lives[id] ?? 0) <= 0 && !this.eliminatedPlayers.includes(id)) {
        this.eliminatedPlayers.push(id);
      }
    }

    // Survivors get bonus
    for (const id of alive) {
      if (!this.frozenTappers.includes(id)) {
        this.addScore(id, SURVIVE_BONUS);
      }
    }
  }

  private getAlivePlayers(): string[] {
    return [...this.players.keys()].filter((id) => !this.eliminatedPlayers.includes(id));
  }

  private makeData(): FreezeDanceData {
    const alive = this.getAlivePlayers();
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      danceMs: Math.max(0, this.danceMs),
      freezeMs: Math.max(0, this.freezeMs),
      beatIndex: this.beatIndex,
      playerTaps: { ...this.playerTaps },
      frozenTappers: [...this.frozenTappers],
      survivors: alive.filter((id) => !this.frozenTappers.includes(id)),
      eliminated: [...this.eliminatedPlayers],
      lives: { ...this.lives },
      alivePlayers: alive,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'freezedance',
    name: 'Freeze Dance',
    description: 'Tap to the beat — but STOP when the music stops!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new FreezeDanceGame(),
);
