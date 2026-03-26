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

const MAX_CHAIN = 20;
const INPUT_BASE_MS = 5_000;
const INPUT_PER_STEP_MS = 1_500;
const ADD_MS = 4_000;
const REVEAL_MS = 3_000;
const CORRECT_CHAIN_POINTS = 100;
const ADD_BONUS = 50;
const LAST_STANDING_BONUS = 500;

type ChainButton = 'A' | 'B' | 'C' | 'D';
const BUTTONS: ChainButton[] = ['A', 'B', 'C', 'D'];
const BTN_EMOJI: Record<ChainButton, string> = { A: '🔴', B: '🔵', C: '🟢', D: '🟡' };

// ── Controller layouts ──────────────────────────────────────────────────────

const PLAY_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '🔴', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '🔵', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '🟢', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '🟡', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '👀', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface CopycatChainData {
  chain: ChainButton[];
  phase: 'replay' | 'add' | 'reveal';
  activePlayerId: string | null;
  inputProgress: number;
  inputTimeMs: number;
  addTimeMs: number;
  alivePlayers: string[];
  eliminatedPlayers: string[];
  lastEliminated: string | null;
  failedAtIndex: number | null;
  turnOrder: string[];
  turnIndex: number;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class CopycatChainGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'copycatchain',
    name: 'Copycat Chain',
    description: 'Repeat the chain and add one — miss a beat and you are out!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private chain: ChainButton[] = [];
  private subPhase: 'replay' | 'add' | 'reveal' = 'replay';
  private inputProgress = 0;
  private inputTimeMs = 0;
  private addTimeMs = 0;
  private revealMs = 0;
  private alivePlayers: string[] = [];
  private eliminatedPlayers: string[] = [];
  private turnOrder: string[] = [];
  private turnIndex = 0;
  private lastEliminated: string | null = null;
  private failedAtIndex: number | null = null;
  private layoutSentFor: string | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = MAX_CHAIN;
    this.alivePlayers = [...this.players.keys()];
    this.turnOrder = [...this.alivePlayers].sort(() => Math.random() - 0.5);
    this.turnIndex = 0;
    this.startTurn();
    return { ...this.buildState(this.makeData()), controllerLayout: WAIT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    const activeId = this.turnOrder[this.turnIndex];
    if (playerId !== activeId) return;
    if (!BUTTONS.includes(input.control as ChainButton)) return;
    const btn = input.control as ChainButton;

    if (this.subPhase === 'replay') {
      // Player is replaying the existing chain
      const expected = this.chain[this.inputProgress];
      if (btn === expected) {
        this.inputProgress++;
        if (this.inputProgress >= this.chain.length) {
          // Chain replayed successfully, now add phase
          this.subPhase = 'add';
          this.addTimeMs = ADD_MS;
        }
      } else {
        // Wrong button — eliminated
        this.eliminateCurrentPlayer();
      }
    } else if (this.subPhase === 'add') {
      // Player adds a new button to the chain
      this.chain.push(btn);
      this.addScore(playerId, ADD_BONUS);
      this.addScore(playerId, CORRECT_CHAIN_POINTS);
      this.advanceTurn();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'reveal') {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) {
        this.afterReveal();
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'replay') {
      this.inputTimeMs -= deltaMs;
      if (this.inputTimeMs <= 0) {
        // Ran out of time replaying — eliminated
        this.eliminateCurrentPlayer();
      }
    } else if (this.subPhase === 'add') {
      this.addTimeMs -= deltaMs;
      if (this.addTimeMs <= 0) {
        // Ran out of time adding — add random and advance
        const randomBtn = BUTTONS[Math.floor(Math.random() * 4)]!;
        this.chain.push(randomBtn);
        this.advanceTurn();
      }
    }

    const data = this.makeData();
    const state = this.buildState(data);
    const activeId = this.turnOrder[this.turnIndex] ?? null;
    if (activeId && this.layoutSentFor !== activeId) {
      this.layoutSentFor = activeId;
      return { ...state, controllerLayout: PLAY_LAYOUT };
    }
    return state;
  }

  private startTurn(): void {
    this.subPhase = this.chain.length === 0 ? 'add' : 'replay';
    this.inputProgress = 0;
    this.lastEliminated = null;
    this.failedAtIndex = null;
    this.layoutSentFor = null;
    this.phase = 'active';

    if (this.subPhase === 'replay') {
      this.inputTimeMs = INPUT_BASE_MS + this.chain.length * INPUT_PER_STEP_MS;
    } else {
      this.addTimeMs = ADD_MS;
    }
  }

  private eliminateCurrentPlayer(): void {
    const playerId = this.turnOrder[this.turnIndex]!;
    this.lastEliminated = playerId;
    this.failedAtIndex = this.inputProgress;
    this.alivePlayers = this.alivePlayers.filter((id) => id !== playerId);
    this.eliminatedPlayers.push(playerId);
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
  }

  private advanceTurn(): void {
    if (this.alivePlayers.length <= 1 || this.chain.length >= MAX_CHAIN) {
      this.endGame();
      return;
    }

    // Move to next alive player
    this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
    while (!this.alivePlayers.includes(this.turnOrder[this.turnIndex]!)) {
      this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
    }

    this.round = this.chain.length;
    this.startTurn();
  }

  private afterReveal(): void {
    if (this.alivePlayers.length <= 1 || this.chain.length >= MAX_CHAIN) {
      this.endGame();
      return;
    }

    // Remove eliminated player from turn order, advance
    this.turnIndex = this.turnIndex % this.turnOrder.length;
    while (!this.alivePlayers.includes(this.turnOrder[this.turnIndex]!)) {
      this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
    }

    this.round = this.chain.length + 1;
    this.startTurn();
  }

  private endGame(): void {
    if (this.alivePlayers.length === 1) {
      this.addScore(this.alivePlayers[0]!, LAST_STANDING_BONUS);
    }
    this.phase = 'results';
  }

  private makeData(): CopycatChainData {
    return {
      chain: [...this.chain],
      phase: this.subPhase,
      activePlayerId: this.subPhase !== 'reveal' ? (this.turnOrder[this.turnIndex] ?? null) : null,
      inputProgress: this.inputProgress,
      inputTimeMs: Math.max(0, this.inputTimeMs),
      addTimeMs: Math.max(0, this.addTimeMs),
      alivePlayers: [...this.alivePlayers],
      eliminatedPlayers: [...this.eliminatedPlayers],
      lastEliminated: this.lastEliminated,
      failedAtIndex: this.failedAtIndex,
      turnOrder: [...this.turnOrder],
      turnIndex: this.turnIndex,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'copycatchain',
    name: 'Copycat Chain',
    description: 'Repeat the chain and add one — miss a beat and you are out!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new CopycatChainGame(),
);
