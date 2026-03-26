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
const VOTE_WINDOW_MS = 8_000;
const REVEAL_MS = 4_000;

// ── Hot takes database ───────────────────────────────────────────────────────

const HOT_TAKES: string[] = [
  'Pineapple belongs on pizza',
  'Cats are better than dogs',
  'Morning people are more successful',
  'Social media does more harm than good',
  'Cereal is a soup',
  'The toilet paper should go over, not under',
  'It\'s acceptable to recline your seat on a plane',
  'Hot dogs are sandwiches',
  'Breakfast is the most important meal of the day',
  'You should shower in the morning, not at night',
  'Summer is the best season',
  'Working from home is better than office',
  'Books are better than movies',
  'Water is wet',
  'It\'s OK to wear socks with sandals',
  'Texting is better than calling',
  'GIF is pronounced "jif"',
  'Ketchup belongs on eggs',
  'The dress was blue and black',
  'Die Hard is a Christmas movie',
  'Superheroes are overrated',
  'Aliens definitely exist',
  'Time travel would cause more problems than it solves',
  'Being famous would be terrible',
  'Money can buy happiness',
  'School should start later in the day',
  'Robots will take most jobs in 20 years',
  'Reality TV is actually entertaining',
  'Cold pizza is better than reheated pizza',
  'The moon landing was humanity\'s greatest achievement',
  'You should always tip at least 20%',
  'Video games are art',
  'It\'s wrong to eat meat',
  'Parallel parking is harder than it needs to be',
  'Chocolate is overrated',
  'Everyone should learn to code',
  'Naps are for children',
  'Silence is more uncomfortable than small talk',
  'You should never lend money to friends',
  'Having a messy desk means you\'re creative',
];

// ── Controller layouts ───────────────────────────────────────────────────────

const VOTE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '👍 AGREE', color: '#22c55e', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '👎 DISAGREE', color: '#ef4444', size: 'lg', position: 'top-right' },
  ],
};

const REVOTE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '👍 AGREE', color: '#22c55e', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '👎 DISAGREE', color: '#ef4444', size: 'lg', position: 'top-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '🎤', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface DebateClubData {
  statement: string;
  round: number;
  totalRounds: number;
  phase: 'vote1' | 'reveal1' | 'revote' | 'reveal_final';
  voteWindowMs: number;
  votedPlayerIds: string[];
  // Reveal data
  agreePlayerIds: string[];
  disagreePlayerIds: string[];
  agreePercent: number;
  disagreePercent: number;
  minoritySide: 'agree' | 'disagree' | null;
  // Revote results (final)
  revoteAgreeIds: string[];
  revoteDisagreeIds: string[];
  mindsChanged: number;
  revoteAgreePercent: number;
  revoteDisagreePercent: number;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class DebateClubGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'debateclub',
    name: 'Debate Club',
    description: 'Hot takes — vote, debate, change minds!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private statement = '';
  private roundPhase: 'vote1' | 'reveal1' | 'revote' | 'reveal_final' = 'vote1';
  private voteWindowMs = VOTE_WINDOW_MS;
  private revealMs = 0;
  private votes: Record<string, 'agree' | 'disagree'> = {};
  private revotes: Record<string, 'agree' | 'disagree'> = {};
  private usedIndices = new Set<number>();
  private lastLayoutPhase: string | null = null;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(15, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(this.configRounds, HOT_TAKES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: VOTE_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (input.control !== 'A' && input.control !== 'B') return;

    const vote = input.control === 'A' ? 'agree' as const : 'disagree' as const;

    if (this.roundPhase === 'vote1') {
      this.votes[playerId] = vote;
    } else if (this.roundPhase === 'revote') {
      this.revotes[playerId] = vote;
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.roundPhase === 'vote1') {
      this.voteWindowMs -= deltaMs;
      const allVoted = [...this.players.keys()].every((id) => this.votes[id] !== undefined);
      if (this.voteWindowMs <= 0 || allVoted) {
        this.startReveal1();
      }
      return this.emitState();
    }

    if (this.roundPhase === 'reveal1') {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) {
        this.startRevote();
      }
      return this.emitState();
    }

    if (this.roundPhase === 'revote') {
      this.voteWindowMs -= deltaMs;
      const allRevoted = [...this.players.keys()].every((id) => this.revotes[id] !== undefined);
      if (this.voteWindowMs <= 0 || allRevoted) {
        this.startRevealFinal();
      }
      return this.emitState();
    }

    if (this.roundPhase === 'reveal_final') {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.emitState();
    }

    return this.emitState();
  }

  // ── Phase transitions ──────────────────────────────────────────────────────

  private startRound(): void {
    // Pick unused statement
    let idx: number;
    do {
      idx = Math.floor(Math.random() * HOT_TAKES.length);
    } while (this.usedIndices.has(idx) && this.usedIndices.size < HOT_TAKES.length);
    this.usedIndices.add(idx);
    this.statement = HOT_TAKES[idx]!;

    this.roundPhase = 'vote1';
    this.voteWindowMs = VOTE_WINDOW_MS;
    this.votes = {};
    this.revotes = {};
    this.phase = 'active';
    this.lastLayoutPhase = null;
  }

  private startReveal1(): void {
    this.roundPhase = 'reveal1';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.lastLayoutPhase = null;
  }

  private startRevote(): void {
    this.roundPhase = 'revote';
    this.voteWindowMs = VOTE_WINDOW_MS;
    // Pre-fill revotes with original votes (players can change)
    this.revotes = { ...this.votes };
    this.phase = 'active';
    this.lastLayoutPhase = null;
  }

  private startRevealFinal(): void {
    this.roundPhase = 'reveal_final';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.lastLayoutPhase = null;

    // Score: points for being in majority after revote
    const agreeCount = Object.values(this.revotes).filter((v) => v === 'agree').length;
    const disagreeCount = Object.values(this.revotes).filter((v) => v === 'disagree').length;
    const majorityVote = agreeCount >= disagreeCount ? 'agree' : 'disagree';

    for (const [id, vote] of Object.entries(this.revotes)) {
      if (vote === majorityVote) {
        this.addScore(id, 100);
      }
    }

    // Bonus for changing someone's mind (if your side gained votes)
    const origAgree = Object.values(this.votes).filter((v) => v === 'agree').length;
    const mindsChanged = Math.abs(agreeCount - origAgree);
    // Give bonus to minority side if they gained votes
    if (mindsChanged > 0) {
      const minorityOriginal = origAgree <= (Object.values(this.votes).length - origAgree) ? 'agree' : 'disagree';
      const gainedVotes = minorityOriginal === 'agree' ? agreeCount > origAgree : disagreeCount > (Object.values(this.votes).length - origAgree);
      if (gainedVotes) {
        for (const [id, origVote] of Object.entries(this.votes)) {
          if (origVote === minorityOriginal && this.revotes[id] === minorityOriginal) {
            this.addScore(id, 200); // Persuasion bonus
          }
        }
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

  // ── State helpers ──────────────────────────────────────────────────────────

  private emitState(): GameState {
    const data = this.makeData();
    const state = this.buildState(data);

    // Emit layout on phase change
    const currentLayoutPhase = this.roundPhase;
    if (currentLayoutPhase !== this.lastLayoutPhase) {
      this.lastLayoutPhase = currentLayoutPhase;
      const layout = this.roundPhase === 'vote1' ? VOTE_LAYOUT
        : this.roundPhase === 'revote' ? REVOTE_LAYOUT
        : WAIT_LAYOUT;
      return { ...state, controllerLayout: layout };
    }
    return state;
  }

  private makeData(): DebateClubData {
    const playerIds = [...this.players.keys()];
    const agreeIds = playerIds.filter((id) => this.votes[id] === 'agree');
    const disagreeIds = playerIds.filter((id) => this.votes[id] === 'disagree');
    const totalVotes = agreeIds.length + disagreeIds.length;
    const agreePercent = totalVotes > 0 ? Math.round((agreeIds.length / totalVotes) * 100) : 0;

    const revoteAgreeIds = playerIds.filter((id) => this.revotes[id] === 'agree');
    const revoteDisagreeIds = playerIds.filter((id) => this.revotes[id] === 'disagree');
    const totalRevotes = revoteAgreeIds.length + revoteDisagreeIds.length;
    const revoteAgreePercent = totalRevotes > 0 ? Math.round((revoteAgreeIds.length / totalRevotes) * 100) : 0;

    const origAgreeCount = Object.values(this.votes).filter((v) => v === 'agree').length;
    const newAgreeCount = Object.values(this.revotes).filter((v) => v === 'agree').length;
    const mindsChanged = Math.abs(newAgreeCount - origAgreeCount);

    const isRevealPhase = this.roundPhase === 'reveal1' || this.roundPhase === 'reveal_final';
    const minoritySide = totalVotes > 0
      ? (agreeIds.length < disagreeIds.length ? 'agree' : agreeIds.length > disagreeIds.length ? 'disagree' : null)
      : null;

    return {
      statement: this.statement,
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      voteWindowMs: Math.max(0, this.voteWindowMs),
      votedPlayerIds: playerIds.filter((id) =>
        this.roundPhase === 'revote' ? this.revotes[id] !== undefined : this.votes[id] !== undefined,
      ),
      agreePlayerIds: isRevealPhase || this.roundPhase === 'revote' ? agreeIds : [],
      disagreePlayerIds: isRevealPhase || this.roundPhase === 'revote' ? disagreeIds : [],
      agreePercent,
      disagreePercent: 100 - agreePercent,
      minoritySide,
      revoteAgreeIds: this.roundPhase === 'reveal_final' ? revoteAgreeIds : [],
      revoteDisagreeIds: this.roundPhase === 'reveal_final' ? revoteDisagreeIds : [],
      mindsChanged,
      revoteAgreePercent,
      revoteDisagreePercent: 100 - revoteAgreePercent,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'debateclub',
    name: 'Debate Club',
    description: 'Hot takes — vote, debate, change minds!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new DebateClubGame(config),
);
