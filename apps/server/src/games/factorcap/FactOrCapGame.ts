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
const PRESENT_MS = 10_000;
const VOTE_MS = 8_000;
const REVEAL_MS = 4_000;
const CORRECT_VOTE_POINTS = 150;
const FOOL_POINTS = 100; // presenter gets this per fooled voter

// ── Facts database ──────────────────────────────────────────────────────────

interface Fact {
  truth: string;
  lie: string;
  category: string;
}

const FACTS: Fact[] = [
  { truth: 'Honey never spoils — edible honey was found in 3000-year-old Egyptian tombs', lie: 'Honey expires after 5 years even in sealed containers', category: 'Food' },
  { truth: 'Octopuses have three hearts and blue blood', lie: 'Octopuses have two hearts and green blood', category: 'Animals' },
  { truth: 'A day on Venus is longer than a year on Venus', lie: 'A day on Venus is exactly 24 Earth hours', category: 'Space' },
  { truth: 'Bananas are technically berries, but strawberries are not', lie: 'Strawberries are the only true berry among common fruits', category: 'Food' },
  { truth: 'The Eiffel Tower can grow up to 15cm taller in summer due to heat expansion', lie: 'The Eiffel Tower shrinks by 30cm in winter due to metal contraction', category: 'Landmarks' },
  { truth: 'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid', lie: 'Cleopatra personally oversaw the construction of the Great Pyramid', category: 'History' },
  { truth: 'There are more possible chess games than atoms in the observable universe', lie: 'There are exactly 1 billion possible chess game combinations', category: 'Science' },
  { truth: 'A group of flamingos is called a "flamboyance"', lie: 'A group of flamingos is called a "blush"', category: 'Animals' },
  { truth: 'The shortest war in history lasted 38-45 minutes (Britain vs Zanzibar)', lie: 'The shortest war in history lasted 3 days (France vs Monaco)', category: 'History' },
  { truth: 'Scotland\'s national animal is the unicorn', lie: 'Scotland\'s national animal is the Highland cow', category: 'Geography' },
  { truth: 'The inventor of the Pringles can is buried in one', lie: 'The inventor of the Pringles can was allergic to potatoes', category: 'Pop Culture' },
  { truth: 'Sharks have been around longer than trees', lie: 'Trees evolved 100 million years before sharks', category: 'Science' },
  { truth: 'Oxford University is older than the Aztec Empire', lie: 'The Aztec Empire was founded 500 years before Oxford University', category: 'History' },
  { truth: 'A jiffy is an actual unit of time — 1/100th of a second', lie: 'A jiffy is slang with no scientific definition', category: 'Science' },
  { truth: 'The total weight of ants on Earth roughly equals the total weight of humans', lie: 'Ants weigh less than 1% of all human weight combined', category: 'Science' },
  { truth: 'Nintendo was founded in 1889 as a playing card company', lie: 'Nintendo was founded in 1965 as a toy company', category: 'Tech' },
  { truth: 'The human nose can detect over 1 trillion different scents', lie: 'The human nose can detect about 10,000 scents', category: 'Biology' },
  { truth: 'Wombat poop is cube-shaped', lie: 'Wombat poop is perfectly spherical', category: 'Animals' },
  { truth: 'The dot over a lowercase "i" or "j" is called a tittle', lie: 'The dot over a lowercase "i" is called a speck', category: 'Language' },
  { truth: 'Hot water can freeze faster than cold water (Mpemba effect)', lie: 'Cold water always freezes faster than hot water under all conditions', category: 'Science' },
  { truth: 'An astronaut\'s footprints on the Moon will last for millions of years', lie: 'Moon dust erases footprints within about 100 years', category: 'Space' },
  { truth: 'Cows have best friends and get stressed when separated', lie: 'Cows are solitary and prefer to graze alone', category: 'Animals' },
  { truth: 'The lighter was invented before the match', lie: 'The match was invented 200 years before the lighter', category: 'History' },
  { truth: 'A bolt of lightning is five times hotter than the surface of the Sun', lie: 'Lightning is about the same temperature as boiling water', category: 'Science' },
  { truth: 'There is a species of jellyfish that is biologically immortal', lie: 'The oldest jellyfish ever found was only 5 years old', category: 'Animals' },
  { truth: 'Humans share about 60% of their DNA with bananas', lie: 'Humans share less than 1% of their DNA with bananas', category: 'Biology' },
  { truth: 'Russia has a larger surface area than Pluto', lie: 'Pluto is about 10 times larger than Russia', category: 'Geography' },
  { truth: 'The Great Wall of China is not actually visible from space with the naked eye', lie: 'The Great Wall of China is the only man-made structure visible from space', category: 'Landmarks' },
  { truth: 'Vending machines kill more people per year than sharks', lie: 'Sharks kill 10 times more people per year than vending machines', category: 'Pop Culture' },
  { truth: 'The average cloud weighs about 1.1 million pounds', lie: 'Clouds are weightless since they float in the air', category: 'Science' },
];

// ── Controller layouts ──────────────────────────────────────────────────────

const VOTE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '📖 FACT', color: '#22c55e', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '🧢 CAP', color: '#ef4444', size: 'lg', position: 'top-right' },
  ],
};

const PRESENT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '📖 Tell Truth', color: '#22c55e', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '🧢 Tell Lie', color: '#ef4444', size: 'lg', position: 'top-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '👀', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface FactOrCapData {
  round: number;
  totalRounds: number;
  phase: 'present' | 'vote' | 'reveal';
  presenterId: string | null;
  statement: string | null;
  category: string | null;
  presentMs: number;
  voteMs: number;
  presenterChose: boolean;
  votedPlayerIds: string[];
  isTruth: boolean;
  truthStatement: string | null;
  lieStatement: string | null;
  votes: Record<string, 'fact' | 'cap'>;
  fooledPlayerIds: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class FactOrCapGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'factorcap',
    name: 'Fact or Cap',
    description: 'Is that a real fact or total cap? Vote to find out!',
    minPlayers: 3,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private subPhase: 'present' | 'vote' | 'reveal' = 'present';
  private presentMs = 0;
  private voteMs = 0;
  private revealMs = 0;
  private presenterIndex = 0;
  private playerIds: string[] = [];
  private currentFact: Fact | null = null;
  private isTruth = true;
  private presenterChose = false;
  private votes: Record<string, 'fact' | 'cap'> = {};
  private shuffledFacts: Fact[] = [];
  private factIndex = 0;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.playerIds = [...this.players.keys()];
    this.totalRounds = Math.min(this.configRounds, FACTS.length);
    this.shuffledFacts = [...FACTS].sort(() => Math.random() - 0.5);
    this.presenterIndex = 0;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: WAIT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    const presenterId = this.playerIds[this.presenterIndex % this.playerIds.length]!;

    if (this.subPhase === 'present') {
      if (playerId !== presenterId) return;
      if (this.presenterChose) return;
      if (input.control === 'A') {
        this.isTruth = true;
        this.presenterChose = true;
        this.startVoting();
      } else if (input.control === 'B') {
        this.isTruth = false;
        this.presenterChose = true;
        this.startVoting();
      }
    } else if (this.subPhase === 'vote') {
      if (playerId === presenterId) return; // presenter can't vote
      if (this.votes[playerId]) return;
      if (input.control === 'A') this.votes[playerId] = 'fact';
      else if (input.control === 'B') this.votes[playerId] = 'cap';
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'present') {
      this.presentMs -= deltaMs;
      if (this.presentMs <= 0 && !this.presenterChose) {
        // Auto-choose truth if presenter doesn't pick
        this.isTruth = true;
        this.presenterChose = true;
        this.startVoting();
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'vote') {
      this.voteMs -= deltaMs;
      const presenterId = this.playerIds[this.presenterIndex % this.playerIds.length]!;
      const eligibleVoters = this.playerIds.filter((id) => id !== presenterId);
      const allVoted = eligibleVoters.every((id) => this.votes[id] !== undefined);
      if (this.voteMs <= 0 || allVoted) {
        this.resolveRound();
      }
      return this.buildState(this.makeData());
    }

    // reveal
    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) this.nextRound();
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.subPhase = 'present';
    this.presentMs = PRESENT_MS;
    this.votes = {};
    this.presenterChose = false;
    this.isTruth = true;
    this.phase = 'active';
    this.currentFact = this.shuffledFacts[this.factIndex % this.shuffledFacts.length]!;
    this.factIndex++;
  }

  private startVoting(): void {
    this.subPhase = 'vote';
    this.voteMs = VOTE_MS;
  }

  private resolveRound(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const presenterId = this.playerIds[this.presenterIndex % this.playerIds.length]!;
    const correctVote = this.isTruth ? 'fact' : 'cap';
    let fooledCount = 0;

    for (const [id, vote] of Object.entries(this.votes)) {
      if (vote === correctVote) {
        this.addScore(id, CORRECT_VOTE_POINTS);
      } else {
        fooledCount++;
      }
    }

    // Presenter gets points for each fooled voter
    this.addScore(presenterId, fooledCount * FOOL_POINTS);
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.presenterIndex++;
      this.startRound();
    }
  }

  private makeData(): FactOrCapData {
    const presenterId = this.playerIds[this.presenterIndex % this.playerIds.length] ?? null;
    const fact = this.currentFact;
    const statement = this.subPhase === 'present'
      ? null // presenter sees both options on their phone
      : this.isTruth ? fact?.truth ?? null : fact?.lie ?? null;

    const correctVote = this.isTruth ? 'fact' : 'cap';
    const fooledPlayerIds = this.subPhase === 'reveal'
      ? Object.entries(this.votes).filter(([, v]) => v !== correctVote).map(([id]) => id)
      : [];

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      presenterId,
      statement,
      category: fact?.category ?? null,
      presentMs: Math.max(0, this.presentMs),
      voteMs: Math.max(0, this.voteMs),
      presenterChose: this.presenterChose,
      votedPlayerIds: Object.keys(this.votes),
      isTruth: this.subPhase === 'reveal' ? this.isTruth : false,
      truthStatement: this.subPhase === 'reveal' ? fact?.truth ?? null : null,
      lieStatement: this.subPhase === 'reveal' ? fact?.lie ?? null : null,
      votes: this.subPhase === 'reveal' ? { ...this.votes } : {},
      fooledPlayerIds,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'factorcap',
    name: 'Fact or Cap',
    description: 'Is that a real fact or total cap? Vote to find out!',
    minPlayers: 3,
    maxPlayers: 8,
  },
  (config) => new FactOrCapGame(config),
);
