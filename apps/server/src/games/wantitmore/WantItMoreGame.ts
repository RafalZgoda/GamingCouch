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
const MASH_MS = 5_000;
const REVEAL_MS = 3_000;
const POINTS_PER_TAP = 10;
const TRAP_PENALTY_PER_TAP = -15;

// ── Content ──────────────────────────────────────────────────────────────────

interface Prize {
  name: string;
  emoji: string;
  isTrap: boolean;
  trapReveal?: string;
}

const PRIZES: Prize[] = [
  { name: 'Gold Coins!', emoji: '🪙', isTrap: false },
  { name: 'Diamond Ring!', emoji: '💎', isTrap: false },
  { name: 'Treasure Chest!', emoji: '🏴‍☠️', isTrap: false },
  { name: 'Magic Lamp!', emoji: '🪔', isTrap: false },
  { name: 'Crown Jewels!', emoji: '👑', isTrap: false },
  { name: 'Lucky Horseshoe!', emoji: '🍀', isTrap: false },
  { name: 'Mystery Box!', emoji: '📦', isTrap: true, trapReveal: 'It was full of spiders!' },
  { name: 'Free Pizza!', emoji: '🍕', isTrap: false },
  { name: 'Golden Ticket!', emoji: '🎫', isTrap: false },
  { name: 'Cursed Amulet!', emoji: '🔮', isTrap: true, trapReveal: 'The curse drains your points!' },
  { name: 'Trophy!', emoji: '🏆', isTrap: false },
  { name: 'Suspicious Cake!', emoji: '🎂', isTrap: true, trapReveal: 'The cake was a lie!' },
  { name: 'Rocket Ship!', emoji: '🚀', isTrap: false },
  { name: 'Pandora\'s Box!', emoji: '🗃️', isTrap: true, trapReveal: 'You unleashed chaos!' },
  { name: 'Jackpot!', emoji: '🎰', isTrap: false },
  { name: 'Glowing Potion!', emoji: '🧪', isTrap: true, trapReveal: 'It was poison!' },
  { name: 'Star Power!', emoji: '⭐', isTrap: false },
  { name: 'Ancient Scroll!', emoji: '📜', isTrap: false },
  { name: 'Shiny Apple!', emoji: '🍎', isTrap: true, trapReveal: 'It was booby-trapped!' },
  { name: 'Victory Banner!', emoji: '🚩', isTrap: false },
];

// ── Controller layout ────────────────────────────────────────────────────────

const MASH_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'GRAB!', color: '#f59e0b', size: 'md', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface WantItMoreData {
  round: number;
  totalRounds: number;
  phase: 'mash' | 'reveal';
  prizeName: string;
  prizeEmoji: string;
  mashMs: number;
  tapCounts: Record<string, number>;
  isTrap: boolean | null;
  trapReveal: string | null;
  winnerId: string | null;
  winnerTaps: number;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class WantItMoreGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'wantitmore',
    name: 'Who Wants It More',
    description: 'Mash to claim the prize — but watch out for traps! Most taps wins... or loses.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'mash' | 'reveal' = 'mash';
  private mashMs = 0;
  private revealMs = 0;
  private tapCounts: Record<string, number> = {};
  private usedPrizes: number[] = [];
  private currentPrize: Prize | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PRIZES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: MASH_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (input.control !== 'A') return;
    if (this.subPhase !== 'mash') return;

    this.tapCounts[playerId] = (this.tapCounts[playerId] ?? 0) + 1;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'mash') {
      this.mashMs -= deltaMs;
      if (this.mashMs <= 0) this.goToReveal();
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
    this.subPhase = 'mash';
    this.phase = 'active';
    this.tapCounts = {};
    this.mashMs = MASH_MS;

    const available = PRIZES.map((_, i) => i).filter((i) => !this.usedPrizes.includes(i));
    const pool = available.length > 0 ? available : PRIZES.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPrize = PRIZES[idx]!;
    this.usedPrizes.push(idx);
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    // Find winner (most taps)
    let maxTaps = 0;
    let winnerId: string | null = null;
    for (const [id, taps] of Object.entries(this.tapCounts)) {
      if (taps > maxTaps) { maxTaps = taps; winnerId = id; }
    }

    // Score all players based on taps
    const isTrap = this.currentPrize?.isTrap ?? false;
    for (const [id, taps] of Object.entries(this.tapCounts)) {
      if (isTrap) {
        this.addScore(id, Math.round(taps * TRAP_PENALTY_PER_TAP));
      } else {
        this.addScore(id, taps * POINTS_PER_TAP);
      }
    }
  }

  private makeData(): WantItMoreData {
    const isReveal = this.subPhase === 'reveal';

    let maxTaps = 0;
    let winnerId: string | null = null;
    for (const [id, taps] of Object.entries(this.tapCounts)) {
      if (taps > maxTaps) { maxTaps = taps; winnerId = id; }
    }

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      prizeName: this.currentPrize?.name ?? '',
      prizeEmoji: this.currentPrize?.emoji ?? '',
      mashMs: Math.max(0, this.mashMs),
      tapCounts: { ...this.tapCounts },
      isTrap: isReveal ? (this.currentPrize?.isTrap ?? false) : null,
      trapReveal: isReveal && this.currentPrize?.isTrap ? (this.currentPrize.trapReveal ?? null) : null,
      winnerId: isReveal ? winnerId : null,
      winnerTaps: isReveal ? maxTaps : 0,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'wantitmore',
    name: 'Who Wants It More',
    description: 'Mash to claim the prize — but watch out for traps! Most taps wins... or loses.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new WantItMoreGame(),
);
