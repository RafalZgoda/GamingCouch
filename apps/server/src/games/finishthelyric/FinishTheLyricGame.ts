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

const DEFAULT_ROUNDS = 12;
const PICK_MS = 8_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface LyricPuzzle {
  lyric: string;        // lyric with ___ for the missing word
  correct: string;
  distractors: [string, string, string];
  song: string;
  artist: string;
}

const PUZZLES: LyricPuzzle[] = [
  { lyric: 'Is this the real life? Is this just ___?', correct: 'fantasy', distractors: ['a dream', 'reality', 'pretend'], song: 'Bohemian Rhapsody', artist: 'Queen' },
  { lyric: 'Just a small town girl, living in a ___ world', correct: 'lonely', distractors: ['crazy', 'modern', 'broken'], song: "Don't Stop Believin'", artist: 'Journey' },
  { lyric: "I got my mind set on you, I got my mind set on ___", correct: 'you', distractors: ['it', 'me', 'love'], song: 'Got My Mind Set on You', artist: 'George Harrison' },
  { lyric: "We will, we will ___ you", correct: 'rock', distractors: ['shock', 'love', 'find'], song: 'We Will Rock You', artist: 'Queen' },
  { lyric: "I'm walking on ___", correct: 'sunshine', distractors: ['water', 'clouds', 'air'], song: "Walking on Sunshine", artist: 'Katrina & The Waves' },
  { lyric: "Every breath you take, every move you ___", correct: 'make', distractors: ['take', 'fake', 'break'], song: 'Every Breath You Take', artist: 'The Police' },
  { lyric: "Sweet dreams are made of ___", correct: 'this', distractors: ['love', 'gold', 'pain'], song: 'Sweet Dreams', artist: 'Eurythmics' },
  { lyric: "Don't stop me now, I'm having such a good ___", correct: 'time', distractors: ['life', 'day', 'ride'], song: "Don't Stop Me Now", artist: 'Queen' },
  { lyric: "I will always ___ you", correct: 'love', distractors: ['need', 'miss', 'want'], song: 'I Will Always Love You', artist: 'Whitney Houston' },
  { lyric: "We are the ___ of the world", correct: 'champions', distractors: ['children', 'leaders', 'people'], song: 'We Are the Champions', artist: 'Queen' },
  { lyric: "Somewhere over the ___", correct: 'rainbow', distractors: ['mountain', 'horizon', 'ocean'], song: 'Over the Rainbow', artist: 'Judy Garland' },
  { lyric: "I believe I can ___", correct: 'fly', distractors: ['try', 'cry', 'die'], song: 'I Believe I Can Fly', artist: 'R. Kelly' },
  { lyric: "Let it be, let it be, let it be, let it ___", correct: 'be', distractors: ['go', 'flow', 'show'], song: 'Let It Be', artist: 'The Beatles' },
  { lyric: "You make me feel like a ___ woman", correct: 'natural', distractors: ['brand new', 'real', 'perfect'], song: '(You Make Me Feel Like) A Natural Woman', artist: 'Aretha Franklin' },
  { lyric: "Imagine all the ___ living life in peace", correct: 'people', distractors: ['world', 'nations', 'children'], song: 'Imagine', artist: 'John Lennon' },
  { lyric: "I can't get no ___", correct: 'satisfaction', distractors: ['attention', 'connection', 'reaction'], song: 'Satisfaction', artist: 'The Rolling Stones' },
  { lyric: "Hit me baby one more ___", correct: 'time', distractors: ['chance', 'day', 'way'], song: '...Baby One More Time', artist: 'Britney Spears' },
  { lyric: "I will ___ for you", correct: 'survive', distractors: ['fight', 'live', 'die'], song: 'I Will Survive', artist: 'Gloria Gaynor' },
  { lyric: "Happy birthday to ___", correct: 'you', distractors: ['me', 'us', 'all'], song: 'Happy Birthday', artist: 'Traditional' },
  { lyric: "We don't talk about ___", correct: 'Bruno', distractors: ['love', 'problems', 'feelings'], song: "We Don't Talk About Bruno", artist: 'Encanto' },
  { lyric: "Twinkle twinkle little ___", correct: 'star', distractors: ['light', 'heart', 'spark'], song: 'Twinkle Twinkle Little Star', artist: 'Traditional' },
  { lyric: "All you need is ___", correct: 'love', distractors: ['faith', 'hope', 'time'], song: 'All You Need Is Love', artist: 'The Beatles' },
  { lyric: "I'm gonna make him an offer he can't ___", correct: 'refuse', distractors: ['resist', 'ignore', 'forget'], song: 'The Godfather', artist: 'Movie Quote' },
  { lyric: "Hakuna ___", correct: 'Matata', distractors: ['forever', 'banana', 'Wakanda'], song: 'Hakuna Matata', artist: 'The Lion King' },
  { lyric: "Let it go, let it ___", correct: 'go', distractors: ['flow', 'snow', 'show'], song: 'Let It Go', artist: 'Frozen' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface FinishTheLyricData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  lyric: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  correctWord: string | null;
  song: string | null;
  artist: string | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class FinishTheLyricGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'finishthelyric',
    name: 'Finish the Lyric',
    description: 'Complete the famous song lyric!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: LyricPuzzle | null = null;
  private shuffledOptions: string[] = [];
  private correctIdx = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerPicks[playerId] = idx;

    if (idx === this.correctIdx) {
      const elapsed = Date.now() - this.pickStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    }

    const allPicked = [...this.players.keys()].every((id) => this.playerPicks[id] !== undefined);
    if (allPicked) this.goToReveal();
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'pick') {
      this.pickMs -= deltaMs;
      if (this.pickMs <= 0) this.goToReveal();
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
    this.subPhase = 'pick';
    this.phase = 'active';
    this.playerPicks = {};
    this.pickMs = PICK_MS;
    this.pickStartTime = Date.now();

    const available = PUZZLES.map((_, i) => i).filter((i) => !this.usedPuzzles.includes(i));
    const pool = available.length > 0 ? available : PUZZLES.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPuzzle = PUZZLES[idx]!;
    this.usedPuzzles.push(idx);

    const allOptions = [this.currentPuzzle.correct, ...this.currentPuzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIdx = this.shuffledOptions.indexOf(this.currentPuzzle.correct);
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
  }

  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private makeData(): FinishTheLyricData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      lyric: this.currentPuzzle?.lyric ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
      correctWord: isReveal ? (this.currentPuzzle?.correct ?? null) : null,
      song: isReveal ? (this.currentPuzzle?.song ?? null) : null,
      artist: isReveal ? (this.currentPuzzle?.artist ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'finishthelyric',
    name: 'Finish the Lyric',
    description: 'Complete the famous song lyric!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new FinishTheLyricGame(),
);
