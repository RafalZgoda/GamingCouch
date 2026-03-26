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
const TARGETS_PER_ROUND = 12;
const BASE_SHOW_MS = 1_200;
const MIN_SHOW_MS = 500;
const GAP_MS = 400;
const HIT_POINTS = 100;
const MISS_PENALTY = -50;
const DECOY_PENALTY = -75;
const ROUND_PAUSE_MS = 2_500;

type Zone = 'A' | 'B' | 'C' | 'D';

interface Target {
  zone: Zone;
  isDecoy: boolean;
  showMs: number;
}

// ── Controller layout ────────────────────────────────────────────────────────

const TAP_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '↖', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '↗', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '↙', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '↘', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface WhackAMoleData {
  round: number;
  totalRounds: number;
  activeZone: Zone | null;
  isDecoy: boolean;
  targetIndex: number;
  totalTargets: number;
  showTimeMs: number;
  isRoundPause: boolean;
  roundPauseMs: number;
  roundHits: Record<string, number>;
  roundMisses: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class WhackAMoleGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'whackamole',
    name: 'Whack-a-Mole',
    description: 'Tap the right zone when targets appear!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private targets: Target[] = [];
  private targetIndex = 0;
  private currentShowMs = 0;
  private gapMs = 0;
  private inGap = false;
  private isRoundPause = false;
  private roundPauseMs = 0;
  private tappedThisTarget: Set<string> = new Set();
  private roundHits: Record<string, number> = {};
  private roundMisses: Record<string, number> = {};

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: TAP_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isRoundPause || this.inGap) return;
    const zone = input.control as Zone;
    if (!['A', 'B', 'C', 'D'].includes(zone)) return;
    if (this.tappedThisTarget.has(playerId)) return; // one tap per target
    this.tappedThisTarget.add(playerId);

    const target = this.targets[this.targetIndex];
    if (!target) return;

    if (zone === target.zone && !target.isDecoy) {
      // Correct hit
      this.roundHits[playerId] = (this.roundHits[playerId] ?? 0) + 1;
      this.addScore(playerId, HIT_POINTS);
    } else if (zone === target.zone && target.isDecoy) {
      // Hit a decoy
      this.roundMisses[playerId] = (this.roundMisses[playerId] ?? 0) + 1;
      this.addScore(playerId, DECOY_PENALTY);
    } else {
      // Wrong zone
      this.roundMisses[playerId] = (this.roundMisses[playerId] ?? 0) + 1;
      this.addScore(playerId, MISS_PENALTY);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRoundPause) {
      this.roundPauseMs -= deltaMs;
      if (this.roundPauseMs <= 0) {
        if (this.round >= this.totalRounds) {
          this.phase = 'results';
        } else {
          this.round++;
          this.startRound();
        }
      }
      return this.buildState(this.makeData());
    }

    if (this.inGap) {
      this.gapMs -= deltaMs;
      if (this.gapMs <= 0) {
        this.inGap = false;
        this.tappedThisTarget.clear();
        const target = this.targets[this.targetIndex];
        if (target) {
          this.currentShowMs = target.showMs;
        }
      }
      return this.buildState(this.makeData());
    }

    // Active target
    this.currentShowMs -= deltaMs;
    if (this.currentShowMs <= 0) {
      this.targetIndex++;
      if (this.targetIndex >= this.targets.length) {
        // End of round
        this.isRoundPause = true;
        this.roundPauseMs = ROUND_PAUSE_MS;
        this.phase = 'round_end';
      } else {
        this.inGap = true;
        this.gapMs = GAP_MS;
      }
    }

    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.phase = 'active';
    this.isRoundPause = false;
    this.roundHits = {};
    this.roundMisses = {};
    this.targetIndex = 0;
    this.tappedThisTarget.clear();
    this.inGap = false;

    // Generate targets for this round — speed increases with rounds
    const speedFactor = Math.max(0, 1 - (this.round - 1) * 0.08);
    const showMs = Math.max(MIN_SHOW_MS, Math.round(BASE_SHOW_MS * speedFactor));
    const decoyChance = Math.min(0.35, 0.1 + (this.round - 1) * 0.04);

    this.targets = [];
    const zones: Zone[] = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < TARGETS_PER_ROUND; i++) {
      this.targets.push({
        zone: zones[Math.floor(Math.random() * 4)]!,
        isDecoy: Math.random() < decoyChance,
        showMs,
      });
    }

    this.currentShowMs = this.targets[0]!.showMs;
  }

  private makeData(): WhackAMoleData {
    const target = this.targets[this.targetIndex];
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      activeZone: (!this.inGap && !this.isRoundPause && target) ? target.zone : null,
      isDecoy: (!this.inGap && !this.isRoundPause && target) ? target.isDecoy : false,
      targetIndex: this.targetIndex,
      totalTargets: this.targets.length,
      showTimeMs: Math.max(0, this.currentShowMs),
      isRoundPause: this.isRoundPause,
      roundPauseMs: Math.max(0, this.roundPauseMs),
      roundHits: { ...this.roundHits },
      roundMisses: { ...this.roundMisses },
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'whackamole',
    name: 'Whack-a-Mole',
    description: 'Tap the right zone when targets appear!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new WhackAMoleGame(config),
);
