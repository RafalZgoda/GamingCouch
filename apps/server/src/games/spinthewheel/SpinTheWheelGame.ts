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
const SPIN_MS = 3_000;
const CHALLENGE_MS = 15_000;
const VOTE_MS = 8_000;
const REVEAL_MS = 3_500;
const COMPLETE_POINTS = 200;
const VOTER_MAJORITY_POINTS = 50;

// ── Challenges database ─────────────────────────────────────────────────────

interface Challenge {
  text: string;
  type: 'truth' | 'dare' | 'category' | 'trivia';
}

const CHALLENGES: Challenge[] = [
  { text: 'What is your most embarrassing moment?', type: 'truth' },
  { text: 'What is the worst gift you ever received?', type: 'truth' },
  { text: 'What is a secret talent you have?', type: 'truth' },
  { text: 'What was your worst date ever?', type: 'truth' },
  { text: 'What is the weirdest food you have ever eaten?', type: 'truth' },
  { text: 'Who in this room would survive a zombie apocalypse?', type: 'truth' },
  { text: 'What is your guilty pleasure TV show?', type: 'truth' },
  { text: 'What was the last lie you told?', type: 'truth' },
  { text: 'Do your best impression of someone in this room!', type: 'dare' },
  { text: 'Sing the chorus of a popular song!', type: 'dare' },
  { text: 'Do 10 push-ups right now!', type: 'dare' },
  { text: 'Talk in an accent for the next 2 rounds!', type: 'dare' },
  { text: 'Do your best dance move!', type: 'dare' },
  { text: 'Make the funniest face you can!', type: 'dare' },
  { text: 'Tell a joke — it better be funny!', type: 'dare' },
  { text: 'Speak in only questions for 30 seconds!', type: 'dare' },
  { text: 'Name 3 countries in South America!', type: 'category' },
  { text: 'Name 3 Marvel superheroes!', type: 'category' },
  { text: 'Name 3 types of cheese!', type: 'category' },
  { text: 'Name 3 songs by The Beatles!', type: 'category' },
  { text: 'Name 3 dog breeds!', type: 'category' },
  { text: 'Name 3 pizza toppings!', type: 'category' },
  { text: 'Name 3 Olympic sports!', type: 'category' },
  { text: 'Name 3 planets in our solar system!', type: 'category' },
  { text: 'Name 3 Shakespeare plays!', type: 'category' },
  { text: 'Name 3 capital cities in Europe!', type: 'category' },
  { text: 'Name 3 types of pasta!', type: 'category' },
  { text: 'Name 3 car brands!', type: 'category' },
  { text: 'Name 3 Taylor Swift songs!', type: 'category' },
  { text: 'Name 3 ice cream flavors!', type: 'category' },
];

const TYPE_EMOJI: Record<string, string> = {
  truth: '🤔', dare: '😈', category: '📋', trivia: '🧠',
};

// ── Controller layouts ──────────────────────────────────────────────────────

const VOTE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '✅ Yes', color: '#22c55e', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '❌ No', color: '#ef4444', size: 'lg', position: 'top-right' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '🎡', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface SpinTheWheelData {
  round: number;
  totalRounds: number;
  phase: 'spinning' | 'challenge' | 'voting' | 'reveal';
  spinMs: number;
  challengeMs: number;
  voteMs: number;
  targetPlayerId: string | null;
  challenge: string | null;
  challengeType: string | null;
  votedPlayerIds: string[];
  yesVotes: number;
  noVotes: number;
  passed: boolean;
  votes: Record<string, boolean>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SpinTheWheelGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'spinthewheel',
    name: 'Spin the Wheel',
    description: 'Spin the wheel for truth, dare, or category challenges!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private subPhase: 'spinning' | 'challenge' | 'voting' | 'reveal' = 'spinning';
  private spinMs = 0;
  private challengeMs = 0;
  private voteMs = 0;
  private revealMs = 0;
  private targetPlayerId: string | null = null;
  private currentChallenge: Challenge | null = null;
  private votes: Record<string, boolean> = {};
  private shuffledChallenges: Challenge[] = [];
  private challengeIndex = 0;
  private playerIds: string[] = [];

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    this.playerIds = [...this.players.keys()];
    this.shuffledChallenges = [...CHALLENGES].sort(() => Math.random() - 0.5);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: WAIT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'voting') return;
    if (playerId === this.targetPlayerId) return; // target can't vote
    if (this.votes[playerId] !== undefined) return;
    if (input.control === 'A') this.votes[playerId] = true;
    else if (input.control === 'B') this.votes[playerId] = false;
  }

  protected onTick(deltaMs: number): GameState {
    switch (this.subPhase) {
      case 'spinning':
        this.spinMs -= deltaMs;
        if (this.spinMs <= 0) {
          this.subPhase = 'challenge';
          this.challengeMs = CHALLENGE_MS;
        }
        return this.buildState(this.makeData());

      case 'challenge':
        this.challengeMs -= deltaMs;
        if (this.challengeMs <= 0) {
          this.subPhase = 'voting';
          this.voteMs = VOTE_MS;
          return { ...this.buildState(this.makeData()), controllerLayout: VOTE_LAYOUT };
        }
        return this.buildState(this.makeData());

      case 'voting': {
        this.voteMs -= deltaMs;
        const eligibleVoters = this.playerIds.filter((id) => id !== this.targetPlayerId);
        const allVoted = eligibleVoters.every((id) => this.votes[id] !== undefined);
        if (this.voteMs <= 0 || allVoted) {
          this.resolveRound();
        }
        return this.buildState(this.makeData());
      }

      case 'reveal':
        this.revealMs -= deltaMs;
        if (this.revealMs <= 0) this.nextRound();
        return this.buildState(this.makeData());
    }
  }

  private startRound(): void {
    this.subPhase = 'spinning';
    this.spinMs = SPIN_MS;
    this.votes = {};
    this.phase = 'active';

    // Pick random target player
    this.targetPlayerId = this.playerIds[Math.floor(Math.random() * this.playerIds.length)]!;

    // Pick challenge
    this.currentChallenge = this.shuffledChallenges[this.challengeIndex % this.shuffledChallenges.length]!;
    this.challengeIndex++;
  }

  private resolveRound(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const yesVotes = Object.values(this.votes).filter((v) => v).length;
    const noVotes = Object.values(this.votes).filter((v) => !v).length;
    const passed = yesVotes >= noVotes;

    if (passed && this.targetPlayerId) {
      this.addScore(this.targetPlayerId, COMPLETE_POINTS);
    }

    // Voters in majority get points
    const majorityVote = passed;
    for (const [id, vote] of Object.entries(this.votes)) {
      if (vote === majorityVote) {
        this.addScore(id, VOTER_MAJORITY_POINTS);
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

  private makeData(): SpinTheWheelData {
    const yesVotes = Object.values(this.votes).filter((v) => v).length;
    const noVotes = Object.values(this.votes).filter((v) => !v).length;
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      spinMs: Math.max(0, this.spinMs),
      challengeMs: Math.max(0, this.challengeMs),
      voteMs: Math.max(0, this.voteMs),
      targetPlayerId: this.subPhase !== 'spinning' ? this.targetPlayerId : null,
      challenge: this.subPhase !== 'spinning' ? this.currentChallenge?.text ?? null : null,
      challengeType: this.subPhase !== 'spinning' ? this.currentChallenge?.type ?? null : null,
      votedPlayerIds: Object.keys(this.votes),
      yesVotes: this.subPhase === 'reveal' ? yesVotes : 0,
      noVotes: this.subPhase === 'reveal' ? noVotes : 0,
      passed: this.subPhase === 'reveal' ? yesVotes >= noVotes : false,
      votes: this.subPhase === 'reveal' ? { ...this.votes } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'spinthewheel',
    name: 'Spin the Wheel',
    description: 'Spin the wheel for truth, dare, or category challenges!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new SpinTheWheelGame(config),
);
