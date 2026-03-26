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

const ANSWER_MS = 8_000;
const REVEAL_MS = 3_500;
const CORRECT_POINTS = 150;
const SPEED_BONUS_MAX = 100;
const PERFECT_BONUS = 200;

// ── Categories ──────────────────────────────────────────────────────────────

interface Challenge {
  category: string;
  prompt: string;
  options: string[];
  correctIndices: number[]; // which options are valid answers
}

const CHALLENGES: Challenge[] = [
  { category: 'Geography', prompt: 'Countries in South America', options: ['Brazil', 'Spain', 'Peru', 'Chile'], correctIndices: [0, 2, 3] },
  { category: 'Food', prompt: 'Types of pasta', options: ['Penne', 'Focaccia', 'Rigatoni', 'Fusilli'], correctIndices: [0, 2, 3] },
  { category: 'Animals', prompt: 'Animals that can fly', options: ['Eagle', 'Penguin', 'Bat', 'Parrot'], correctIndices: [0, 2, 3] },
  { category: 'Sports', prompt: 'Olympic summer sports', options: ['Swimming', 'Skiing', 'Fencing', 'Boxing'], correctIndices: [0, 2, 3] },
  { category: 'Music', prompt: 'String instruments', options: ['Violin', 'Flute', 'Guitar', 'Cello'], correctIndices: [0, 2, 3] },
  { category: 'Science', prompt: 'Noble gases', options: ['Helium', 'Oxygen', 'Neon', 'Argon'], correctIndices: [0, 2, 3] },
  { category: 'Movies', prompt: 'Marvel superheroes', options: ['Iron Man', 'Batman', 'Thor', 'Spider-Man'], correctIndices: [0, 2, 3] },
  { category: 'Geography', prompt: 'Capital cities in Europe', options: ['Paris', 'Sydney', 'Berlin', 'Rome'], correctIndices: [0, 2, 3] },
  { category: 'Food', prompt: 'Citrus fruits', options: ['Orange', 'Apple', 'Lemon', 'Grapefruit'], correctIndices: [0, 2, 3] },
  { category: 'Animals', prompt: 'Reptiles', options: ['Lizard', 'Frog', 'Snake', 'Turtle'], correctIndices: [0, 2, 3] },
  { category: 'History', prompt: 'Ancient civilizations', options: ['Roman', 'Victorian', 'Egyptian', 'Greek'], correctIndices: [0, 2, 3] },
  { category: 'Sports', prompt: 'Ball sports', options: ['Tennis', 'Swimming', 'Basketball', 'Soccer'], correctIndices: [0, 2, 3] },
  { category: 'Music', prompt: 'Genres of music', options: ['Jazz', 'Pottery', 'Rock', 'Classical'], correctIndices: [0, 2, 3] },
  { category: 'Science', prompt: 'Planets in our solar system', options: ['Mars', 'Moon', 'Jupiter', 'Saturn'], correctIndices: [0, 2, 3] },
  { category: 'Movies', prompt: 'Disney animated films', options: ['Frozen', 'Inception', 'Moana', 'Aladdin'], correctIndices: [0, 2, 3] },
  { category: 'Geography', prompt: 'Islands', options: ['Hawaii', 'Sahara', 'Bali', 'Madagascar'], correctIndices: [0, 2, 3] },
  { category: 'Food', prompt: 'Dairy products', options: ['Cheese', 'Bread', 'Yogurt', 'Butter'], correctIndices: [0, 2, 3] },
  { category: 'Animals', prompt: 'Ocean animals', options: ['Dolphin', 'Eagle', 'Shark', 'Octopus'], correctIndices: [0, 2, 3] },
  { category: 'Sports', prompt: 'Winter sports', options: ['Skiing', 'Surfing', 'Snowboarding', 'Ice Hockey'], correctIndices: [0, 2, 3] },
  { category: 'History', prompt: 'World War II countries (Allies)', options: ['USA', 'Switzerland', 'UK', 'France'], correctIndices: [0, 2, 3] },
  { category: 'Music', prompt: 'Percussion instruments', options: ['Drums', 'Piano', 'Xylophone', 'Tambourine'], correctIndices: [0, 2, 3] },
  { category: 'Science', prompt: 'States of matter', options: ['Solid', 'Energy', 'Liquid', 'Gas'], correctIndices: [0, 2, 3] },
  { category: 'Movies', prompt: 'Horror movie franchises', options: ['Scream', 'Shrek', 'Halloween', 'Saw'], correctIndices: [0, 2, 3] },
  { category: 'Geography', prompt: 'Asian countries', options: ['Japan', 'Brazil', 'India', 'Thailand'], correctIndices: [0, 2, 3] },
  { category: 'Food', prompt: 'Vegetables', options: ['Carrot', 'Strawberry', 'Broccoli', 'Spinach'], correctIndices: [0, 2, 3] },
  { category: 'Animals', prompt: 'Pets people commonly keep', options: ['Cat', 'Bear', 'Dog', 'Hamster'], correctIndices: [0, 2, 3] },
  { category: 'Sports', prompt: 'Racket sports', options: ['Badminton', 'Golf', 'Tennis', 'Squash'], correctIndices: [0, 2, 3] },
  { category: 'Pop Culture', prompt: 'Social media platforms', options: ['Instagram', 'Netflix', 'TikTok', 'Twitter'], correctIndices: [0, 2, 3] },
  { category: 'Science', prompt: 'Chemical elements', options: ['Iron', 'Water', 'Gold', 'Carbon'], correctIndices: [0, 2, 3] },
  { category: 'History', prompt: 'Renaissance artists', options: ['Da Vinci', 'Picasso', 'Michelangelo', 'Raphael'], correctIndices: [0, 2, 3] },
];

// ── Controller layouts ──────────────────────────────────────────────────────

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '👀', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface HotSeatData {
  round: number;
  totalRounds: number;
  phase: 'active' | 'reveal';
  hotSeatPlayerId: string | null;
  category: string;
  prompt: string;
  options: string[];
  answerMs: number;
  selectedIndices: number[];
  correctIndices: number[] | null;
  correctCount: number;
  wrongCount: number;
  isPerfect: boolean;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class HotSeatGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'hotseat',
    name: 'Hot Seat',
    description: 'You are in the spotlight — pick the right answers before time runs out!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'active' | 'reveal' = 'active';
  private answerMs = 0;
  private revealMs = 0;
  private playerIds: string[] = [];
  private playerIndex = 0;
  private shuffledChallenges: Challenge[] = [];
  private challengeIndex = 0;
  private currentChallenge: Challenge | null = null;
  private selectedIndices: number[] = [];
  private correctCount = 0;
  private wrongCount = 0;

  protected onInit(_players: Player[]): GameState {
    this.playerIds = [...this.players.keys()];
    this.shuffledChallenges = [...CHALLENGES].sort(() => Math.random() - 0.5);
    // Each player gets at least 1 turn; total rounds = number of players * 2 or capped
    this.totalRounds = Math.min(this.playerIds.length * 2, this.shuffledChallenges.length);
    this.playerIndex = 0;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: WAIT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'active') return;
    const hotSeatId = this.playerIds[this.playerIndex % this.playerIds.length]!;
    if (playerId !== hotSeatId) return;

    const btnMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const idx = btnMap[input.control];
    if (idx === undefined) return;
    if (this.selectedIndices.includes(idx)) return; // already selected

    this.selectedIndices.push(idx);
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'active') {
      this.answerMs -= deltaMs;
      if (this.answerMs <= 0) {
        this.resolveRound();
      }

      // Update controller layout with current options
      const challenge = this.currentChallenge;
      if (challenge) {
        const hotSeatId = this.playerIds[this.playerIndex % this.playerIds.length]!;
        const positions: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
        const layout: ControllerLayout = {
          controls: challenge.options.map((opt, i) => ({
            type: 'button' as const,
            id: (['A', 'B', 'C', 'D'] as const)[i]!,
            label: this.selectedIndices.includes(i) ? `✓ ${opt}` : opt,
            color: this.selectedIndices.includes(i) ? '#6b7280' : colors[i]!,
            size: 'lg' as const,
            position: positions[i]!,
          })),
        };
        return { ...this.buildState(this.makeData()), controllerLayout: layout };
      }

      return this.buildState(this.makeData());
    }

    // reveal
    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      this.nextRound();
    }
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.subPhase = 'active';
    this.answerMs = ANSWER_MS;
    this.selectedIndices = [];
    this.correctCount = 0;
    this.wrongCount = 0;
    this.phase = 'active';
    this.currentChallenge = this.shuffledChallenges[this.challengeIndex % this.shuffledChallenges.length]!;
    this.challengeIndex++;
  }

  private resolveRound(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const challenge = this.currentChallenge!;
    const hotSeatId = this.playerIds[this.playerIndex % this.playerIds.length]!;

    this.correctCount = 0;
    this.wrongCount = 0;

    for (const idx of this.selectedIndices) {
      if (challenge.correctIndices.includes(idx)) {
        this.correctCount++;
      } else {
        this.wrongCount++;
      }
    }

    const timeLeft = Math.max(0, this.answerMs);
    const speedBonus = Math.round((timeLeft / ANSWER_MS) * SPEED_BONUS_MAX);
    const points = this.correctCount * CORRECT_POINTS - this.wrongCount * 50 + speedBonus;
    this.addScore(hotSeatId, Math.max(0, points));

    // Perfect bonus
    if (this.correctCount === challenge.correctIndices.length && this.wrongCount === 0) {
      this.addScore(hotSeatId, PERFECT_BONUS);
    }
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.playerIndex++;
      this.startRound();
    }
  }

  private makeData(): HotSeatData {
    const hotSeatId = this.playerIds[this.playerIndex % this.playerIds.length] ?? null;
    const challenge = this.currentChallenge;
    const isPerfect = this.subPhase === 'reveal' && challenge !== null
      && this.correctCount === challenge.correctIndices.length && this.wrongCount === 0;

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      hotSeatPlayerId: hotSeatId,
      category: challenge?.category ?? '',
      prompt: challenge?.prompt ?? '',
      options: challenge?.options ?? [],
      answerMs: Math.max(0, this.answerMs),
      selectedIndices: [...this.selectedIndices],
      correctIndices: this.subPhase === 'reveal' ? challenge?.correctIndices ?? null : null,
      correctCount: this.correctCount,
      wrongCount: this.wrongCount,
      isPerfect,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'hotseat',
    name: 'Hot Seat',
    description: 'You are in the spotlight — pick the right answers before time runs out!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new HotSeatGame(),
);
