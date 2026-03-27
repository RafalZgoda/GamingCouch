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
const BID_MS = 10_000;
const REVEAL_MS = 4_000;
const EXACT_POINTS = 500;
const CLOSE_POINTS = 300;
const OK_POINTS = 150;
const BUST_PENALTY = -50;

// ── Content: items with hidden values ─────────────────────────────────────────

interface BidItem {
  prompt: string;
  category: string;
  unit: string;
  value: number;
  ranges: [string, string, string, string]; // A, B, C, D — numeric ranges
  rangeValues: [number, number, number, number]; // actual bid values
}

const BID_ITEMS: BidItem[] = [
  { prompt: 'Height of the Eiffel Tower', category: 'Landmarks', unit: 'meters', value: 330, ranges: ['200m', '330m', '450m', '600m'], rangeValues: [200, 330, 450, 600] },
  { prompt: 'Year the iPhone was released', category: 'Tech', unit: 'year', value: 2007, ranges: ['2005', '2007', '2009', '2011'], rangeValues: [2005, 2007, 2009, 2011] },
  { prompt: 'Speed of sound in air', category: 'Science', unit: 'km/h', value: 1235, ranges: ['800', '1235', '1500', '2000'], rangeValues: [800, 1235, 1500, 2000] },
  { prompt: 'Population of Australia (approx)', category: 'Geography', unit: 'million', value: 26, ranges: ['15M', '26M', '40M', '55M'], rangeValues: [15, 26, 40, 55] },
  { prompt: 'Calories in a Big Mac', category: 'Food', unit: 'kcal', value: 550, ranges: ['350', '550', '750', '950'], rangeValues: [350, 550, 750, 950] },
  { prompt: 'Distance from Earth to Moon', category: 'Space', unit: 'km', value: 384400, ranges: ['200K km', '384K km', '500K km', '750K km'], rangeValues: [200000, 384000, 500000, 750000] },
  { prompt: 'Weight of an adult elephant', category: 'Animals', unit: 'kg', value: 6000, ranges: ['3000 kg', '6000 kg', '9000 kg', '12000 kg'], rangeValues: [3000, 6000, 9000, 12000] },
  { prompt: 'Length of the Great Wall of China', category: 'Landmarks', unit: 'km', value: 21196, ranges: ['5000 km', '10000 km', '21000 km', '35000 km'], rangeValues: [5000, 10000, 21000, 35000] },
  { prompt: 'Temperature of the Sun surface', category: 'Science', unit: '°C', value: 5500, ranges: ['2500°C', '5500°C', '8000°C', '12000°C'], rangeValues: [2500, 5500, 8000, 12000] },
  { prompt: 'Number of bones in human body', category: 'Science', unit: 'bones', value: 206, ranges: ['150', '206', '270', '350'], rangeValues: [150, 206, 270, 350] },
  { prompt: 'Year Titanic sank', category: 'History', unit: 'year', value: 1912, ranges: ['1898', '1912', '1925', '1940'], rangeValues: [1898, 1912, 1925, 1940] },
  { prompt: 'Height of Mount Everest', category: 'Geography', unit: 'meters', value: 8849, ranges: ['6500m', '8849m', '10000m', '12000m'], rangeValues: [6500, 8849, 10000, 12000] },
  { prompt: 'Average human heart beats per day', category: 'Science', unit: 'beats', value: 100000, ranges: ['50K', '100K', '150K', '200K'], rangeValues: [50000, 100000, 150000, 200000] },
  { prompt: 'Speed of a cheetah', category: 'Animals', unit: 'km/h', value: 112, ranges: ['80', '112', '145', '180'], rangeValues: [80, 112, 145, 180] },
  { prompt: 'Year pizza was invented', category: 'Food', unit: 'year', value: 1889, ranges: ['1750', '1889', '1920', '1950'], rangeValues: [1750, 1889, 1920, 1950] },
  { prompt: 'Depth of the Mariana Trench', category: 'Geography', unit: 'meters', value: 11034, ranges: ['5000m', '8000m', '11000m', '15000m'], rangeValues: [5000, 8000, 11000, 15000] },
  { prompt: 'Number of countries in the world', category: 'Geography', unit: 'countries', value: 195, ranges: ['150', '195', '230', '280'], rangeValues: [150, 195, 230, 280] },
  { prompt: 'Year first email was sent', category: 'Tech', unit: 'year', value: 1971, ranges: ['1960', '1971', '1983', '1995'], rangeValues: [1960, 1971, 1983, 1995] },
  { prompt: 'Average lifespan of a house cat', category: 'Animals', unit: 'years', value: 15, ranges: ['8 yrs', '15 yrs', '22 yrs', '30 yrs'], rangeValues: [8, 15, 22, 30] },
  { prompt: 'Diameter of the Earth', category: 'Science', unit: 'km', value: 12742, ranges: ['8000 km', '12742 km', '18000 km', '25000 km'], rangeValues: [8000, 12742, 18000, 25000] },
];

// ── Controller layout ────────────────────────────────────────────────────────

const BID_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface BidOrBustData {
  round: number;
  totalRounds: number;
  phase: 'bid' | 'reveal';
  prompt: string;
  category: string;
  unit: string;
  ranges: string[];
  bidMs: number;
  bidderIds: string[];
  actualValue: number | null;
  playerBids: Record<string, number>; // player → index
  playerBidLabels: Record<string, string>;
  closestPlayerId: string | null;
  exactPlayerIds: string[];
  bustPlayerIds: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class BidOrBustGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'bidorbust',
    name: 'Bid or Bust',
    description: 'Guess closest without going over — bust and you lose points!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'bid' | 'reveal' = 'bid';
  private bidMs = 0;
  private revealMs = 0;
  private playerBids: Record<string, number> = {};
  private usedItems: number[] = [];
  private currentItem: BidItem | null = null;
  private closestPlayerId: string | null = null;
  private exactPlayerIds: string[] = [];
  private bustPlayerIds: string[] = [];

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, BID_ITEMS.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: BID_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'bid') return;
    if (this.playerBids[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerBids[playerId] = idx;

    const allBid = [...this.players.keys()].every((id) => this.playerBids[id] !== undefined);
    if (allBid) {
      this.resolveRound();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'bid') {
      this.bidMs -= deltaMs;
      if (this.bidMs <= 0) {
        this.resolveRound();
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
    this.subPhase = 'bid';
    this.phase = 'active';
    this.playerBids = {};
    this.closestPlayerId = null;
    this.exactPlayerIds = [];
    this.bustPlayerIds = [];
    this.bidMs = BID_MS;

    const available = BID_ITEMS.map((_, i) => i).filter((i) => !this.usedItems.includes(i));
    const pool = available.length > 0 ? available : BID_ITEMS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentItem = BID_ITEMS[idx]!;
    this.usedItems.push(idx);
  }

  private resolveRound(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const item = this.currentItem!;
    const actualValue = item.value;

    let closestDist = Infinity;
    let closestId: string | null = null;

    for (const [playerId, bidIdx] of Object.entries(this.playerBids)) {
      const bidValue = item.rangeValues[bidIdx]!;
      const diff = bidValue - actualValue;

      if (bidValue === actualValue) {
        // Exact match
        this.exactPlayerIds.push(playerId);
        this.addScore(playerId, EXACT_POINTS);
      } else if (diff > 0) {
        // Over — bust!
        this.bustPlayerIds.push(playerId);
        this.addScore(playerId, BUST_PENALTY);
      } else {
        // Under — valid bid
        const dist = Math.abs(diff);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = playerId;
        }
      }
    }

    // Award closest (non-bust, non-exact) player
    if (closestId && !this.exactPlayerIds.includes(closestId)) {
      this.closestPlayerId = closestId;
      // Scale points by how close they were
      const ratio = 1 - closestDist / actualValue;
      const points = ratio > 0.9 ? CLOSE_POINTS : OK_POINTS;
      this.addScore(closestId, points);
    }
  }

  private makeData(): BidOrBustData {
    const item = this.currentItem!;
    const isReveal = this.subPhase === 'reveal';

    const playerBidLabels: Record<string, string> = {};
    if (isReveal) {
      for (const [pid, idx] of Object.entries(this.playerBids)) {
        playerBidLabels[pid] = item.ranges[idx] ?? '?';
      }
    }

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      prompt: item.prompt,
      category: item.category,
      unit: item.unit,
      ranges: [...item.ranges],
      bidMs: Math.max(0, this.bidMs),
      bidderIds: Object.keys(this.playerBids),
      actualValue: isReveal ? item.value : null,
      playerBids: isReveal ? { ...this.playerBids } : {},
      playerBidLabels,
      closestPlayerId: isReveal ? this.closestPlayerId : null,
      exactPlayerIds: isReveal ? [...this.exactPlayerIds] : [],
      bustPlayerIds: isReveal ? [...this.bustPlayerIds] : [],
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'bidorbust',
    name: 'Bid or Bust',
    description: 'Guess closest without going over — bust and you lose points!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new BidOrBustGame(),
);
