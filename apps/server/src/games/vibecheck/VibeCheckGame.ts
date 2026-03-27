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
const VOTE_MS = 10_000;
const REVEAL_MS = 4_000;
const MAJORITY_POINTS = 200;
const UNANIMOUS_BONUS = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface VibePoll {
  question: string;
  options: [string, string, string, string];
  category: string;
  emoji: string;
}

const POLLS: VibePoll[] = [
  { question: 'Best pizza topping?', options: ['Pepperoni', 'Mushroom', 'Hawaiian', 'Margherita'], category: 'Food', emoji: '🍕' },
  { question: 'Best superpower?', options: ['Flying', 'Invisibility', 'Super strength', 'Time travel'], category: 'Fantasy', emoji: '🦸' },
  { question: 'Best season?', options: ['Spring', 'Summer', 'Autumn', 'Winter'], category: 'Life', emoji: '🌸' },
  { question: 'Best pet?', options: ['Dog', 'Cat', 'Fish', 'Hamster'], category: 'Animals', emoji: '🐾' },
  { question: 'Best movie genre?', options: ['Comedy', 'Action', 'Horror', 'Romance'], category: 'Movies', emoji: '🎬' },
  { question: 'Best vacation?', options: ['Beach', 'Mountains', 'City trip', 'Road trip'], category: 'Travel', emoji: '✈️' },
  { question: 'Best ice cream flavor?', options: ['Chocolate', 'Vanilla', 'Strawberry', 'Cookie dough'], category: 'Food', emoji: '🍦' },
  { question: 'Best way to spend a rainy day?', options: ['Movies', 'Gaming', 'Reading', 'Sleeping'], category: 'Life', emoji: '🌧️' },
  { question: 'Best decade for music?', options: ['80s', '90s', '2000s', '2010s'], category: 'Music', emoji: '🎵' },
  { question: 'Best social media?', options: ['Instagram', 'TikTok', 'YouTube', 'Twitter/X'], category: 'Tech', emoji: '📱' },
  { question: 'Best breakfast?', options: ['Pancakes', 'Eggs & bacon', 'Cereal', 'Croissant'], category: 'Food', emoji: '🥞' },
  { question: 'Best sport to watch?', options: ['Football/Soccer', 'Basketball', 'Tennis', 'F1 Racing'], category: 'Sports', emoji: '⚽' },
  { question: 'Best party game?', options: ['Charades', 'Card games', 'Board games', 'Video games'], category: 'Fun', emoji: '🎉' },
  { question: 'Best fast food?', options: ['Burger', 'Pizza', 'Tacos', 'Sushi'], category: 'Food', emoji: '🍔' },
  { question: 'Best emoji?', options: ['😂', '🥺', '💀', '🔥'], category: 'Fun', emoji: '😎' },
  { question: 'Best way to exercise?', options: ['Running', 'Swimming', 'Gym', 'Dancing'], category: 'Health', emoji: '💪' },
  { question: 'Best Disney movie?', options: ['Lion King', 'Frozen', 'Toy Story', 'Aladdin'], category: 'Movies', emoji: '🏰' },
  { question: 'Best midnight snack?', options: ['Chips', 'Ice cream', 'Leftover pizza', 'Cereal'], category: 'Food', emoji: '🌙' },
  { question: 'Best school subject?', options: ['Math', 'Science', 'Art', 'History'], category: 'Education', emoji: '📚' },
  { question: 'Best weather?', options: ['Sunny & warm', 'Cool & breezy', 'Snowy', 'Thunderstorm'], category: 'Nature', emoji: '☀️' },
  { question: 'Best drink?', options: ['Coffee', 'Tea', 'Juice', 'Soda'], category: 'Food', emoji: '☕' },
  { question: 'Best fictional world?', options: ['Hogwarts', 'Middle Earth', 'Star Wars galaxy', 'Marvel universe'], category: 'Fantasy', emoji: '🧙' },
  { question: 'Best color?', options: ['Blue', 'Red', 'Green', 'Purple'], category: 'Fun', emoji: '🎨' },
  { question: 'Best instrument?', options: ['Guitar', 'Piano', 'Drums', 'Violin'], category: 'Music', emoji: '🎸' },
  { question: 'Best date night?', options: ['Dinner out', 'Movie night', 'Cooking together', 'Walk & talk'], category: 'Life', emoji: '❤️' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const VOTE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface VibeCheckData {
  round: number;
  totalRounds: number;
  phase: 'vote' | 'reveal';
  question: string;
  emoji: string;
  category: string;
  options: string[];
  voteMs: number;
  votedPlayerIds: string[];
  playerVotes: Record<string, number>;
  voteCounts: number[];
  majorityIndex: number | null;
  majorityPlayerIds: string[];
  isUnanimous: boolean;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class VibeCheckGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'vibecheck',
    name: 'Vibe Check',
    description: 'Vote with the majority to score! Match the group vibe or get left behind.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'vote' | 'reveal' = 'vote';
  private voteMs = 0;
  private revealMs = 0;
  private playerVotes: Record<string, number> = {};
  private usedPolls: number[] = [];
  private currentPoll: VibePoll | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, POLLS.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: VOTE_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'vote') return;
    if (this.playerVotes[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerVotes[playerId] = idx;

    const allVoted = [...this.players.keys()].every((id) => this.playerVotes[id] !== undefined);
    if (allVoted) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'vote') {
      this.voteMs -= deltaMs;
      if (this.voteMs <= 0) this.goToReveal();
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
    this.subPhase = 'vote';
    this.phase = 'active';
    this.playerVotes = {};
    this.voteMs = VOTE_MS;

    const available = POLLS.map((_, i) => i).filter((i) => !this.usedPolls.includes(i));
    const pool = available.length > 0 ? available : POLLS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPoll = POLLS[idx]!;
    this.usedPolls.push(idx);
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    // Calculate majority and award points
    const counts = [0, 0, 0, 0];
    for (const vote of Object.values(this.playerVotes)) {
      counts[vote]!++;
    }

    let maxCount = 0;
    let majorityIdx = -1;
    for (let i = 0; i < 4; i++) {
      if (counts[i]! > maxCount) {
        maxCount = counts[i]!;
        majorityIdx = i;
      }
    }

    const totalVoters = Object.keys(this.playerVotes).length;
    const isUnanimous = maxCount === totalVoters && totalVoters > 1;

    for (const [pid, vote] of Object.entries(this.playerVotes)) {
      if (vote === majorityIdx) {
        this.addScore(pid, MAJORITY_POINTS + (isUnanimous ? UNANIMOUS_BONUS : 0));
      }
    }
  }

  private makeData(): VibeCheckData {
    const isReveal = this.subPhase === 'reveal';

    const counts = [0, 0, 0, 0];
    if (isReveal) {
      for (const vote of Object.values(this.playerVotes)) {
        counts[vote]!++;
      }
    }

    let maxCount = 0;
    let majorityIdx = -1;
    for (let i = 0; i < 4; i++) {
      if (counts[i]! > maxCount) {
        maxCount = counts[i]!;
        majorityIdx = i;
      }
    }

    const majorityPlayerIds = isReveal
      ? Object.entries(this.playerVotes).filter(([_, v]) => v === majorityIdx).map(([id]) => id)
      : [];

    const totalVoters = Object.keys(this.playerVotes).length;

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      question: this.currentPoll?.question ?? '',
      emoji: this.currentPoll?.emoji ?? '',
      category: this.currentPoll?.category ?? '',
      options: this.currentPoll?.options ? [...this.currentPoll.options] : [],
      voteMs: Math.max(0, this.voteMs),
      votedPlayerIds: Object.keys(this.playerVotes),
      playerVotes: isReveal ? { ...this.playerVotes } : {},
      voteCounts: isReveal ? counts : [],
      majorityIndex: isReveal ? majorityIdx : null,
      majorityPlayerIds,
      isUnanimous: isReveal && maxCount === totalVoters && totalVoters > 1,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'vibecheck',
    name: 'Vibe Check',
    description: 'Vote with the majority to score! Match the group vibe or get left behind.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new VibeCheckGame(),
);
