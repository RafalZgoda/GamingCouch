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
const VOTE_WINDOW_MS = 10_000;
const REVEAL_MS = 5_000;

// ── Dilemmas database ─────────────────────────────────────────────────────────

const DILEMMAS: Array<[string, string]> = [
  ['Be able to fly', 'Be able to read minds'],
  ['Always be 10 minutes late', 'Always be 20 minutes early'],
  ['Have unlimited money', 'Have unlimited time'],
  ['Live without music', 'Live without movies'],
  ['Be famous', 'Be rich but unknown'],
  ['Have no phone for a year', 'Have no dessert for a year'],
  ['Always speak your mind', 'Never speak again'],
  ['Be the funniest person', 'Be the smartest person'],
  ['Live in the past', 'Live in the future'],
  ['Only eat pizza forever', 'Never eat pizza again'],
  ['Have a rewind button for life', 'Have a pause button for life'],
  ['Be able to talk to animals', 'Speak every human language'],
  ['Always be cold', 'Always be hot'],
  ['Have free WiFi everywhere', 'Have free coffee everywhere'],
  ['Give up social media', 'Give up streaming services'],
  ['Be a kid your whole life', 'Be an adult your whole life'],
  ['Have a personal chef', 'Have a personal driver'],
  ['Know how you die', 'Know when you die'],
  ['Be invisible', 'Be able to teleport'],
  ['Win the lottery', 'Live twice as long'],
  ['Fight 100 duck-sized horses', 'Fight 1 horse-sized duck'],
  ['Have no elbows', 'Have no knees'],
  ['Always have to sing instead of talk', 'Always have to dance instead of walk'],
  ['Be locked in a library', 'Be locked in an amusement park'],
  ['Have hands for feet', 'Have feet for hands'],
  ['Be a famous athlete', 'Be a famous inventor'],
  ['Live without air conditioning', 'Live without heating'],
  ['Only use a flip phone', 'Only use a desktop computer'],
  ['Always wear wet socks', 'Always have an itchy tag on your shirt'],
  ['Eat a whole raw onion', 'Drink a glass of soy sauce'],
  ['Have a permanent unibrow', 'Have a permanent mullet'],
  ['Be able to see 10 minutes into the future', 'Be able to see 10 years into the future'],
  ['Never be able to use a touchscreen', 'Never be able to use a keyboard'],
  ['Be the best player on a losing team', 'Be the worst player on a winning team'],
  ['Always have a song stuck in your head', 'Always have an itch you can\'t scratch'],
  ['Live in a treehouse', 'Live in a houseboat'],
  ['Have super speed', 'Have super strength'],
  ['Always overdressed', 'Always underdressed'],
  ['Only eat breakfast food', 'Only eat dinner food'],
  ['Have a photographic memory', 'Have the ability to forget anything you want'],
];

// ── Controller layout ────────────────────────────────────────────────────────

function voteLayout(optionA: string, optionB: string): ControllerLayout {
  return {
    controls: [
      { type: 'button', id: 'A', label: 'A', color: '#3b82f6', size: 'lg', position: 'bottom-left' },
      { type: 'button', id: 'B', label: 'B', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
    ],
  };
}

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '👀', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public state shape ───────────────────────────────────────────────────────

export interface WouldYouRatherData {
  optionA: string;
  optionB: string;
  voteWindowMs: number;
  votedPlayerIds: string[];
  round: number;
  totalRounds: number;
  isReveal: boolean;
  revealVotesA: string[];
  revealVotesB: string[];
  percentA: number;
  percentB: number;
}

// ── Game implementation ──────────────────────────────────────────────────────

export class WouldYouRatherGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'wouldyourather',
    name: 'Would You Rather',
    description: 'Vote on impossible dilemmas — majority wins!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private dilemmas: Array<[string, string]> = [];
  private currentA = '';
  private currentB = '';
  private voteWindowMs = VOTE_WINDOW_MS;
  private revealMs = 0;
  private isRevealing = false;
  private votes: Record<string, 'A' | 'B'> = {};
  private minorityStreak: Record<string, number> = {};
  private lastLayoutPhase: 'vote' | 'wait' | null = null;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(30, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.dilemmas = [...DILEMMAS].sort(() => Math.random() - 0.5).slice(0, this.totalRounds);
    for (const id of this.players.keys()) {
      this.minorityStreak[id] = 0;
    }
    this.startRound();
    return this.currentState(true);
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isRevealing) return;
    if (input.control !== 'A' && input.control !== 'B') return;
    // Allow changing vote during the window
    this.votes[playerId] = input.control as 'A' | 'B';
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.currentState(false);
    }

    this.voteWindowMs -= deltaMs;

    // End early if everyone voted
    const allVoted = [...this.players.keys()].every((id) => this.votes[id] !== undefined);
    if (this.voteWindowMs <= 0 || allVoted) {
      this.startReveal();
    }

    return this.currentState(false);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startRound(): void {
    const dilemma = this.dilemmas[this.round - 1] ?? ['Option A', 'Option B'];
    this.currentA = dilemma[0];
    this.currentB = dilemma[1];
    this.voteWindowMs = VOTE_WINDOW_MS;
    this.revealMs = 0;
    this.isRevealing = false;
    this.votes = {};
    this.phase = 'active';
    this.lastLayoutPhase = null;
  }

  private startReveal(): void {
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.lastLayoutPhase = null;

    const playerIds = [...this.players.keys()];
    const votesA = playerIds.filter((id) => this.votes[id] === 'A');
    const votesB = playerIds.filter((id) => this.votes[id] === 'B');

    // Determine majority (if tie, both sides get points)
    const majority = votesA.length >= votesB.length ? 'A' : 'B';
    const isTie = votesA.length === votesB.length;

    for (const id of playerIds) {
      const vote = this.votes[id];
      if (!vote) {
        // Didn't vote — no points, reset streak
        this.minorityStreak[id] = 0;
        continue;
      }

      if (isTie) {
        // Everyone gets points on a tie
        this.addScore(id, 100);
        this.minorityStreak[id] = 0;
      } else if (vote === majority) {
        this.addScore(id, 100);
        this.minorityStreak[id] = 0;
      } else {
        // Minority — build streak
        this.minorityStreak[id] = (this.minorityStreak[id] ?? 0) + 1;
        if (this.minorityStreak[id] >= 3) {
          this.addScore(id, 300);
          this.minorityStreak[id] = 0; // Reset after bonus
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

  private currentState(forceLayoutUpdate: boolean): GameState {
    const targetPhase = this.isRevealing ? 'wait' as const : 'vote' as const;
    const layoutChanged = targetPhase !== this.lastLayoutPhase;
    const emitLayout = forceLayoutUpdate || layoutChanged;
    if (emitLayout) this.lastLayoutPhase = targetPhase;

    const playerIds = [...this.players.keys()];
    const votesA = playerIds.filter((id) => this.votes[id] === 'A');
    const votesB = playerIds.filter((id) => this.votes[id] === 'B');
    const totalVotes = votesA.length + votesB.length;

    const data: WouldYouRatherData = {
      optionA: this.currentA,
      optionB: this.currentB,
      voteWindowMs: Math.max(0, this.voteWindowMs),
      votedPlayerIds: playerIds.filter((id) => this.votes[id] !== undefined),
      round: this.round,
      totalRounds: this.totalRounds,
      isReveal: this.isRevealing,
      revealVotesA: this.isRevealing ? votesA : [],
      revealVotesB: this.isRevealing ? votesB : [],
      percentA: totalVotes > 0 ? Math.round((votesA.length / totalVotes) * 100) : 0,
      percentB: totalVotes > 0 ? Math.round((votesB.length / totalVotes) * 100) : 0,
    };

    const state = this.buildState(data);
    if (emitLayout) {
      return {
        ...state,
        controllerLayout: this.isRevealing ? WAIT_LAYOUT : voteLayout(this.currentA, this.currentB),
      };
    }
    return state;
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'wouldyourather',
    name: 'Would You Rather',
    description: 'Vote on impossible dilemmas — majority wins!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new WouldYouRatherGame(config),
);
