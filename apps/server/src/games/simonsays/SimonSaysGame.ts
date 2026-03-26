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

const MAX_SEQUENCE = 12;          // sequence length to win
const SHOW_PER_STEP_MS = 600;     // time to display each step
const GAP_MS = 200;               // gap between displayed steps
const INPUT_TIMEOUT_MS = 3_000;   // time per input step
const REVEAL_MS = 3_000;
const BUTTONS = ['A', 'B', 'C', 'D'] as const;
const BUTTON_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const BUTTON_LABELS = ['Red', 'Blue', 'Green', 'Yellow'];

// ── Controller layout ────────────────────────────────────────────────────────

const LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '🔴', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '🔵', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '🟢', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '🟡', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface SimonSaysData {
  sequenceLength: number;
  maxSequence: number;
  // Showing phase: which button is currently highlighted (-1 = gap)
  showPhase: boolean;
  highlightIndex: number;           // index in sequence being shown
  highlightButton: string | null;   // 'A'|'B'|'C'|'D' or null during gap
  // Input phase
  inputPhase: boolean;
  inputTimeMs: number;
  // Player status
  playerProgress: Record<string, number>;   // how many correct inputs so far
  alivePlayers: string[];
  eliminatedPlayers: string[];
  // Round end
  isReveal: boolean;
  revealMs: number;
  roundSurvivors: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SimonSaysGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'simonsays',
    name: 'Simon Says',
    description: 'Watch the sequence, repeat it back. Memory + speed!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private sequence: string[] = [];
  private alivePlayers = new Set<string>();
  private eliminatedPlayers = new Set<string>();
  private playerProgress = new Map<string, number>();
  private playerFailed = new Set<string>();

  // Phase control
  private showPhase = false;
  private showTimer = 0;
  private showStepIndex = 0;
  private showingGap = false;

  private inputPhase = false;
  private inputTimer = 0;

  private isReveal = false;
  private revealMs = 0;
  private roundSurvivors: string[] = [];

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = MAX_SEQUENCE;
    for (const id of this.players.keys()) {
      this.alivePlayers.add(id);
    }
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (!this.inputPhase) return;
    if (!this.alivePlayers.has(playerId)) return;
    if (this.playerFailed.has(playerId)) return;

    const progress = this.playerProgress.get(playerId) ?? 0;
    if (progress >= this.sequence.length) return; // already done

    const expected = this.sequence[progress];
    if (input.control === expected) {
      this.playerProgress.set(playerId, progress + 1);
      // Reset input timer on correct press
      this.inputTimer = INPUT_TIMEOUT_MS;
    } else {
      // Wrong! Eliminated for this round
      this.playerFailed.add(playerId);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isReveal) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.buildState(this.makeData());
    }

    if (this.showPhase) {
      this.showTimer -= deltaMs;
      if (this.showTimer <= 0) {
        if (this.showingGap) {
          // Move to next step
          this.showStepIndex++;
          if (this.showStepIndex >= this.sequence.length) {
            // Done showing — start input phase
            this.showPhase = false;
            this.inputPhase = true;
            this.inputTimer = INPUT_TIMEOUT_MS;
          } else {
            this.showingGap = false;
            this.showTimer = SHOW_PER_STEP_MS;
          }
        } else {
          // Start gap
          this.showingGap = true;
          this.showTimer = GAP_MS;
        }
      }
      return this.buildState(this.makeData());
    }

    if (this.inputPhase) {
      this.inputTimer -= deltaMs;

      // Check if all alive players have completed or failed
      const allDone = [...this.alivePlayers].every((id) => {
        if (this.playerFailed.has(id)) return true;
        return (this.playerProgress.get(id) ?? 0) >= this.sequence.length;
      });

      if (this.inputTimer <= 0 || allDone) {
        this.endRound();
      }

      return this.buildState(this.makeData());
    }

    return this.buildState(this.makeData());
  }

  // ── Round management ───────────────────────────────────────────────────────

  private startRound(): void {
    // Add one more step to the sequence
    this.sequence.push(BUTTONS[Math.floor(Math.random() * 4)]!);
    this.phase = 'active';

    // Reset player progress
    this.playerProgress.clear();
    this.playerFailed.clear();
    for (const id of this.alivePlayers) {
      this.playerProgress.set(id, 0);
    }

    // Start show phase
    this.showPhase = true;
    this.inputPhase = false;
    this.isReveal = false;
    this.showStepIndex = 0;
    this.showingGap = false;
    this.showTimer = SHOW_PER_STEP_MS;
  }

  private endRound(): void {
    this.inputPhase = false;
    this.isReveal = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.roundSurvivors = [];

    for (const id of this.alivePlayers) {
      const progress = this.playerProgress.get(id) ?? 0;
      const completed = progress >= this.sequence.length && !this.playerFailed.has(id);
      if (completed) {
        // Survived this round
        const pts = 100 + this.sequence.length * 50;
        this.addScore(id, pts);
        this.roundSurvivors.push(id);
      } else {
        // Eliminated
        this.eliminatedPlayers.add(id);
        this.alivePlayers.delete(id);
        // Consolation points based on sequence progress
        this.addScore(id, this.sequence.length * 20);
      }
    }
  }

  private nextRound(): void {
    // Game ends if 0 or 1 players alive, or max sequence reached
    if (this.alivePlayers.size <= 1 || this.sequence.length >= MAX_SEQUENCE) {
      // Bonus for last player(s) standing
      for (const id of this.alivePlayers) {
        this.addScore(id, 500);
      }
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private makeData(): SimonSaysData {
    return {
      sequenceLength: this.sequence.length,
      maxSequence: MAX_SEQUENCE,
      showPhase: this.showPhase,
      highlightIndex: this.showStepIndex,
      highlightButton: this.showPhase && !this.showingGap ? (this.sequence[this.showStepIndex] ?? null) : null,
      inputPhase: this.inputPhase,
      inputTimeMs: Math.max(0, this.inputTimer),
      playerProgress: Object.fromEntries(this.playerProgress),
      alivePlayers: [...this.alivePlayers],
      eliminatedPlayers: [...this.eliminatedPlayers],
      isReveal: this.isReveal,
      revealMs: Math.max(0, this.revealMs),
      roundSurvivors: [...this.roundSurvivors],
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'simonsays',
    name: 'Simon Says',
    description: 'Watch the sequence, repeat it back. Memory + speed!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SimonSaysGame(),
);
