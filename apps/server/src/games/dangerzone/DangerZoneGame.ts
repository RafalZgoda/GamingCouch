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

const DEFAULT_ROUNDS = 8;
const CHOOSE_MS = 8_000;
const REVEAL_MS = 4_000;
const SAFE_POINTS = 100;
const RISK_WIN_MULTIPLIER = 3; // riskers get 3x if safe
const RISK_LOSE_PENALTY = -150;
const DANGER_CHANCE_BASE = 0.3; // 30% chance of danger in round 1
const DANGER_CHANCE_INCREMENT = 0.05; // +5% per round

// ── Controller layout ────────────────────────────────────────────────────────

const CHOOSE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'SAFE', color: '#22c55e', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'RISK', color: '#ef4444', size: 'md', position: 'top-right' },
  ],
};

// ── Danger events ────────────────────────────────────────────────────────────

const DANGER_EVENTS = [
  { safe: 'Clear skies ahead!', danger: 'Lightning strike!', emoji: '⛈️' },
  { safe: 'The bridge holds!', danger: 'The bridge collapses!', emoji: '🌉' },
  { safe: 'The coast is clear!', danger: 'Ambush!', emoji: '⚔️' },
  { safe: 'Smooth sailing!', danger: 'Iceberg ahead!', emoji: '🧊' },
  { safe: 'All systems go!', danger: 'Engine failure!', emoji: '🚀' },
  { safe: 'The path is safe!', danger: 'Quicksand!', emoji: '🏜️' },
  { safe: 'Fortune smiles!', danger: 'Earthquake!', emoji: '🌋' },
  { safe: 'Lucky escape!', danger: 'Trap activated!', emoji: '🪤' },
  { safe: 'The vault opens!', danger: 'Alarm triggered!', emoji: '🚨' },
  { safe: 'Jackpot!', danger: 'The floor drops!', emoji: '🕳️' },
];

// ── Public data shape ────────────────────────────────────────────────────────

export interface DangerZoneData {
  round: number;
  totalRounds: number;
  phase: 'choose' | 'reveal';
  chooseMs: number;
  dangerChance: number;
  chosenPlayerIds: string[];
  playerChoices: Record<string, 'safe' | 'risk'>;
  isDanger: boolean | null;
  eventMessage: string | null;
  eventEmoji: string | null;
  safeCount: number;
  riskCount: number;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class DangerZoneGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'dangerzone',
    name: 'Danger Zone',
    description: 'Bank your points or risk it all! The danger escalates every round.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'choose' | 'reveal' = 'choose';
  private chooseMs = 0;
  private revealMs = 0;
  private playerChoices: Record<string, 'safe' | 'risk'> = {};
  private isDanger = false;
  private currentEvent: (typeof DANGER_EVENTS)[0] | null = null;
  private usedEvents: number[] = [];

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = DEFAULT_ROUNDS;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: CHOOSE_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'choose') return;
    if (this.playerChoices[playerId] !== undefined) return;

    if (input.control === 'A') {
      this.playerChoices[playerId] = 'safe';
    } else if (input.control === 'B') {
      this.playerChoices[playerId] = 'risk';
    } else {
      return;
    }

    const allChosen = [...this.players.keys()].every((id) => this.playerChoices[id] !== undefined);
    if (allChosen) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'choose') {
      this.chooseMs -= deltaMs;
      if (this.chooseMs <= 0) {
        // Default unchosen players to 'safe'
        for (const id of this.players.keys()) {
          if (this.playerChoices[id] === undefined) {
            this.playerChoices[id] = 'safe';
          }
        }
        this.goToReveal();
      }
      return this.buildState(this.makeData());
    }

    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      if (this.round >= this.totalRounds) {
        this.phase = 'results';
      } else {
        this.round++;
        this.startRound();
      }
    }
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.subPhase = 'choose';
    this.phase = 'active';
    this.playerChoices = {};
    this.chooseMs = CHOOSE_MS;
    this.isDanger = false;
    this.currentEvent = null;
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    // Determine danger
    const dangerChance = DANGER_CHANCE_BASE + (this.round - 1) * DANGER_CHANCE_INCREMENT;
    this.isDanger = Math.random() < dangerChance;

    // Pick event
    const available = DANGER_EVENTS.map((_, i) => i).filter((i) => !this.usedEvents.includes(i));
    const pool = available.length > 0 ? available : DANGER_EVENTS.map((_, i) => i);
    const eventIdx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentEvent = DANGER_EVENTS[eventIdx]!;
    this.usedEvents.push(eventIdx);

    // Score players
    for (const [pid, choice] of Object.entries(this.playerChoices)) {
      if (choice === 'safe') {
        this.addScore(pid, SAFE_POINTS);
      } else {
        // Risk
        if (this.isDanger) {
          this.addScore(pid, RISK_LOSE_PENALTY);
        } else {
          this.addScore(pid, SAFE_POINTS * RISK_WIN_MULTIPLIER);
        }
      }
    }
  }

  private makeData(): DangerZoneData {
    const isReveal = this.subPhase === 'reveal';
    const dangerChance = DANGER_CHANCE_BASE + (this.round - 1) * DANGER_CHANCE_INCREMENT;

    let safeCount = 0;
    let riskCount = 0;
    if (isReveal) {
      for (const choice of Object.values(this.playerChoices)) {
        if (choice === 'safe') safeCount++;
        else riskCount++;
      }
    }

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      chooseMs: Math.max(0, this.chooseMs),
      dangerChance: Math.round(dangerChance * 100),
      chosenPlayerIds: Object.keys(this.playerChoices),
      playerChoices: isReveal ? { ...this.playerChoices } : {},
      isDanger: isReveal ? this.isDanger : null,
      eventMessage: isReveal ? (this.isDanger ? this.currentEvent?.danger ?? null : this.currentEvent?.safe ?? null) : null,
      eventEmoji: isReveal ? (this.currentEvent?.emoji ?? null) : null,
      safeCount,
      riskCount,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'dangerzone',
    name: 'Danger Zone',
    description: 'Bank your points or risk it all! The danger escalates every round.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new DangerZoneGame(),
);
