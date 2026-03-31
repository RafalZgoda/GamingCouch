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
const PICK_MS = 7_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface SynonymPuzzle {
  word: string;
  synonym: string; // correct answer
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: SynonymPuzzle[] = [
  { word: 'Happy', synonym: 'Joyful', distractors: ['Angry', 'Tired', 'Scared'], category: 'Emotions' },
  { word: 'Big', synonym: 'Enormous', distractors: ['Tiny', 'Narrow', 'Short'], category: 'Size' },
  { word: 'Fast', synonym: 'Rapid', distractors: ['Slow', 'Heavy', 'Quiet'], category: 'Speed' },
  { word: 'Smart', synonym: 'Clever', distractors: ['Foolish', 'Lazy', 'Brave'], category: 'Traits' },
  { word: 'Angry', synonym: 'Furious', distractors: ['Calm', 'Happy', 'Shy'], category: 'Emotions' },
  { word: 'Beautiful', synonym: 'Gorgeous', distractors: ['Ugly', 'Plain', 'Rough'], category: 'Appearance' },
  { word: 'Brave', synonym: 'Courageous', distractors: ['Cowardly', 'Weak', 'Gentle'], category: 'Traits' },
  { word: 'Cold', synonym: 'Freezing', distractors: ['Warm', 'Humid', 'Dry'], category: 'Temperature' },
  { word: 'Quiet', synonym: 'Silent', distractors: ['Loud', 'Bright', 'Heavy'], category: 'Sound' },
  { word: 'Rich', synonym: 'Wealthy', distractors: ['Poor', 'Cheap', 'Stingy'], category: 'Money' },
  { word: 'Scary', synonym: 'Terrifying', distractors: ['Funny', 'Boring', 'Relaxing'], category: 'Emotions' },
  { word: 'Old', synonym: 'Ancient', distractors: ['Modern', 'Fresh', 'Young'], category: 'Age' },
  { word: 'Funny', synonym: 'Hilarious', distractors: ['Serious', 'Sad', 'Boring'], category: 'Humor' },
  { word: 'Tired', synonym: 'Exhausted', distractors: ['Energetic', 'Alert', 'Excited'], category: 'Energy' },
  { word: 'Wet', synonym: 'Soaked', distractors: ['Dry', 'Dusty', 'Crispy'], category: 'State' },
  { word: 'Hard', synonym: 'Difficult', distractors: ['Easy', 'Soft', 'Light'], category: 'Difficulty' },
  { word: 'Tasty', synonym: 'Delicious', distractors: ['Bland', 'Bitter', 'Sour'], category: 'Food' },
  { word: 'Small', synonym: 'Tiny', distractors: ['Giant', 'Wide', 'Tall'], category: 'Size' },
  { word: 'Loud', synonym: 'Deafening', distractors: ['Quiet', 'Soft', 'Gentle'], category: 'Sound' },
  { word: 'Kind', synonym: 'Generous', distractors: ['Mean', 'Selfish', 'Rude'], category: 'Traits' },
  { word: 'Dark', synonym: 'Gloomy', distractors: ['Bright', 'Clear', 'Sunny'], category: 'Light' },
  { word: 'Strong', synonym: 'Powerful', distractors: ['Weak', 'Fragile', 'Gentle'], category: 'Strength' },
  { word: 'Hungry', synonym: 'Starving', distractors: ['Full', 'Satisfied', 'Stuffed'], category: 'Food' },
  { word: 'Sick', synonym: 'Ill', distractors: ['Healthy', 'Strong', 'Fit'], category: 'Health' },
  { word: 'Strange', synonym: 'Bizarre', distractors: ['Normal', 'Common', 'Typical'], category: 'Traits' },
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

export interface SynonymSprintData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  word: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SynonymSprintGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'synonymsprint',
    name: 'Synonym Sprint',
    description: 'Find the word that means the same thing! Vocabulary meets speed.',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: SynonymPuzzle | null = null;
  private shuffledOptions: string[] = [];
  private correctIndex = -1;

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

    if (idx === this.correctIndex) {
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

    const allOptions = [this.currentPuzzle.synonym, ...this.currentPuzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIndex = this.shuffledOptions.indexOf(this.currentPuzzle.synonym);
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

  private makeData(): SynonymSprintData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      word: this.currentPuzzle?.word ?? '',
      category: this.currentPuzzle?.category ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIndex : null,
      correctAnswer: isReveal ? (this.currentPuzzle?.synonym ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'synonymsprint',
    name: 'Synonym Sprint',
    description: 'Find the word that means the same thing! Vocabulary meets speed.',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SynonymSprintGame(),
);
