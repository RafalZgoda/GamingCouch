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
const BID_WINDOW_MS = 8_000;
const REVEAL_MS = 4_000;
const BID_VALUES = [100, 200, 500, 1000] as const;

// ── Mystery items ────────────────────────────────────────────────────────────

interface AuctionItem {
  name: string;
  hint: string;
  value: number;
}

const ITEMS: AuctionItem[] = [
  { name: 'Golden Crown', hint: 'Worn by royalty', value: 800 },
  { name: 'Rusty Spoon', hint: 'Kitchen relic', value: 50 },
  { name: 'Diamond Ring', hint: 'Sparkles forever', value: 1000 },
  { name: 'Vintage Guitar', hint: 'Rock legend played this', value: 700 },
  { name: 'Mystery Box', hint: 'Could be anything!', value: 500 },
  { name: 'Rare Stamp', hint: 'Collectors dream', value: 300 },
  { name: 'Broken Clock', hint: 'Right twice a day', value: 25 },
  { name: 'Signed Baseball', hint: 'Hall of famer', value: 600 },
  { name: 'Ancient Coin', hint: 'From a lost empire', value: 450 },
  { name: 'Rubber Duck', hint: 'Bath time champion', value: 10 },
  { name: 'Moon Rock', hint: 'Out of this world', value: 900 },
  { name: 'Old Painting', hint: 'Art or junk?', value: 750 },
  { name: 'Magic Wand', hint: 'Wave it carefully', value: 400 },
  { name: 'Crystal Ball', hint: 'See the future', value: 350 },
  { name: 'Haunted Doll', hint: 'Eyes follow you', value: 150 },
  { name: 'First Edition Book', hint: 'Literary gold', value: 550 },
  { name: 'Pirate Map', hint: 'X marks the spot', value: 650 },
  { name: 'Dinosaur Bone', hint: 'Millions of years old', value: 850 },
  { name: 'Lucky Penny', hint: 'Heads up', value: 1 },
  { name: 'Space Helmet', hint: 'One small step', value: 500 },
  { name: 'Royal Scepter', hint: 'Command respect', value: 700 },
  { name: 'Pet Rock', hint: 'Low maintenance', value: 5 },
  { name: 'Time Capsule', hint: 'From 1950', value: 400 },
  { name: 'Invisible Ink', hint: 'You can\'t see it', value: 200 },
  { name: 'Thunder Hammer', hint: 'Forged in storms', value: 600 },
];

// ── Controller layout ────────────────────────────────────────────────────────

const BID_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '💰 100', color: '#22c55e', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '💰 200', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '💰 500', color: '#f59e0b', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '💰 1000', color: '#ef4444', size: 'lg', position: 'bottom-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '🔨', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface AuctionHouseData {
  itemName: string;
  itemHint: string;
  round: number;
  totalRounds: number;
  bidWindowMs: number;
  bidderIds: string[];
  // Reveal
  isReveal: boolean;
  itemValue: number | null;
  bids: Record<string, number>;         // playerId → bid amount
  winnerId: string | null;
  winnerBid: number | null;
  tiedBids: number[];                    // bid amounts that were tied (nobody wins)
  profit: number | null;                 // winner profit (value - bid)
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class AuctionHouseGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'auctionhouse',
    name: 'Auction House',
    description: 'Bid on mystery items — highest UNIQUE bid wins!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private currentItem!: AuctionItem;
  private bidWindowMs = BID_WINDOW_MS;
  private revealMs = 0;
  private isReveal = false;
  private bids: Record<string, number> = {};
  private winnerId: string | null = null;
  private winnerBid: number | null = null;
  private tiedBids: number[] = [];
  private profit: number | null = null;
  private usedIndices = new Set<number>();
  private lastPhase: 'bid' | 'reveal' | null = null;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(this.configRounds, ITEMS.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: BID_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isReveal) return;
    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx < 0) return;
    // Allow changing bid
    this.bids[playerId] = BID_VALUES[idx]!;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isReveal) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.emitState();
    }

    this.bidWindowMs -= deltaMs;
    const allBid = [...this.players.keys()].every((id) => this.bids[id] !== undefined);
    if (this.bidWindowMs <= 0 || allBid) {
      this.resolveAuction();
    }

    return this.emitState();
  }

  private startRound(): void {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * ITEMS.length);
    } while (this.usedIndices.has(idx) && this.usedIndices.size < ITEMS.length);
    this.usedIndices.add(idx);
    this.currentItem = ITEMS[idx]!;

    this.bidWindowMs = BID_WINDOW_MS;
    this.bids = {};
    this.isReveal = false;
    this.winnerId = null;
    this.winnerBid = null;
    this.tiedBids = [];
    this.profit = null;
    this.phase = 'active';
    this.lastPhase = null;
  }

  private resolveAuction(): void {
    this.isReveal = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.lastPhase = null;

    // Find highest UNIQUE bid
    const bidCounts = new Map<number, string[]>();
    for (const [id, bid] of Object.entries(this.bids)) {
      const list = bidCounts.get(bid) ?? [];
      list.push(id);
      bidCounts.set(bid, list);
    }

    // Tied bids (more than one person bid the same amount)
    this.tiedBids = [...bidCounts.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([bid]) => bid);

    // Unique bids sorted highest first
    const uniqueBids = [...bidCounts.entries()]
      .filter(([, ids]) => ids.length === 1)
      .sort(([a], [b]) => b - a);

    if (uniqueBids.length > 0) {
      const [bid, [winnerId]] = uniqueBids[0]!;
      this.winnerId = winnerId!;
      this.winnerBid = bid;
      this.profit = this.currentItem.value - bid;

      // Score: item value (always positive) + profit bonus
      const score = Math.max(50, this.currentItem.value + Math.round(this.profit * 0.5));
      this.addScore(this.winnerId, score);
    }

    // Consolation: everyone who bid gets 25 pts
    for (const id of Object.keys(this.bids)) {
      if (id !== this.winnerId) {
        this.addScore(id, 25);
      }
    }
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private emitState(): GameState {
    const data = this.makeData();
    const state = this.buildState(data);
    const currentPhase = this.isReveal ? 'reveal' as const : 'bid' as const;
    if (currentPhase !== this.lastPhase) {
      this.lastPhase = currentPhase;
      return { ...state, controllerLayout: this.isReveal ? WAIT_LAYOUT : BID_LAYOUT };
    }
    return state;
  }

  private makeData(): AuctionHouseData {
    return {
      itemName: this.currentItem.name,
      itemHint: this.currentItem.hint,
      round: this.round,
      totalRounds: this.totalRounds,
      bidWindowMs: Math.max(0, this.bidWindowMs),
      bidderIds: Object.keys(this.bids),
      isReveal: this.isReveal,
      itemValue: this.isReveal ? this.currentItem.value : null,
      bids: this.isReveal ? { ...this.bids } : {},
      winnerId: this.winnerId,
      winnerBid: this.winnerBid,
      tiedBids: [...this.tiedBids],
      profit: this.profit,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'auctionhouse',
    name: 'Auction House',
    description: 'Bid on mystery items — highest UNIQUE bid wins!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new AuctionHouseGame(config),
);
