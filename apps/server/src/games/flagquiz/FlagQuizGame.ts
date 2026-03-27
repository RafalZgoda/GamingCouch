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
const GUESS_MS = 10_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Quiz database ───────────────────────────────────────────────────────────

interface QuizItem {
  visual: string; // emoji or text shown on TV
  category: 'flag' | 'landmark' | 'logo' | 'symbol';
  answer: string;
  decoys: [string, string, string];
}

const ITEMS: QuizItem[] = [
  // Flags
  { visual: '🇫🇷', category: 'flag', answer: 'France', decoys: ['Italy', 'Netherlands', 'Belgium'] },
  { visual: '🇯🇵', category: 'flag', answer: 'Japan', decoys: ['South Korea', 'China', 'Bangladesh'] },
  { visual: '🇧🇷', category: 'flag', answer: 'Brazil', decoys: ['Argentina', 'Colombia', 'Portugal'] },
  { visual: '🇨🇦', category: 'flag', answer: 'Canada', decoys: ['Switzerland', 'Denmark', 'Austria'] },
  { visual: '🇦🇺', category: 'flag', answer: 'Australia', decoys: ['New Zealand', 'UK', 'Fiji'] },
  { visual: '🇩🇪', category: 'flag', answer: 'Germany', decoys: ['Belgium', 'Luxembourg', 'Hungary'] },
  { visual: '🇮🇹', category: 'flag', answer: 'Italy', decoys: ['Ireland', 'Mexico', 'Hungary'] },
  { visual: '🇬🇧', category: 'flag', answer: 'United Kingdom', decoys: ['Australia', 'Iceland', 'Norway'] },
  { visual: '🇪🇸', category: 'flag', answer: 'Spain', decoys: ['Portugal', 'Romania', 'Moldova'] },
  { visual: '🇰🇷', category: 'flag', answer: 'South Korea', decoys: ['North Korea', 'Japan', 'Laos'] },
  { visual: '🇲🇽', category: 'flag', answer: 'Mexico', decoys: ['Italy', 'Ireland', 'Hungary'] },
  { visual: '🇮🇳', category: 'flag', answer: 'India', decoys: ['Niger', 'Ireland', 'Ivory Coast'] },
  { visual: '🇹🇷', category: 'flag', answer: 'Turkey', decoys: ['Tunisia', 'Pakistan', 'Algeria'] },
  { visual: '🇸🇪', category: 'flag', answer: 'Sweden', decoys: ['Finland', 'Denmark', 'Norway'] },
  { visual: '🇨🇳', category: 'flag', answer: 'China', decoys: ['Vietnam', 'Turkey', 'Morocco'] },
  // Landmarks
  { visual: '🗼', category: 'landmark', answer: 'Eiffel Tower (Paris)', decoys: ['Tokyo Tower', 'Blackpool Tower', 'CN Tower'] },
  { visual: '🗽', category: 'landmark', answer: 'Statue of Liberty (NYC)', decoys: ['Christ the Redeemer', 'Colosseum', 'Big Ben'] },
  { visual: '🏯', category: 'landmark', answer: 'Japanese Castle', decoys: ['Chinese Temple', 'Korean Palace', 'Thai Pagoda'] },
  { visual: '🎡', category: 'landmark', answer: 'Ferris Wheel', decoys: ['Roller Coaster', 'Carousel', 'Swing Ride'] },
  { visual: '⛩️', category: 'landmark', answer: 'Shinto Shrine (Japan)', decoys: ['Buddhist Temple', 'Hindu Temple', 'Mosque'] },
  // Symbols
  { visual: '☮️', category: 'symbol', answer: 'Peace Symbol', decoys: ['Anarchy Symbol', 'Yin Yang', 'Recycle Symbol'] },
  { visual: '♻️', category: 'symbol', answer: 'Recycle', decoys: ['Refresh', 'Rewind', 'Repeat'] },
  { visual: '⚛️', category: 'symbol', answer: 'Atom / Science', decoys: ['Nuclear Warning', 'Molecule', 'Radiation'] },
  { visual: '☯️', category: 'symbol', answer: 'Yin Yang', decoys: ['Peace Symbol', 'Tao Cross', 'Zen Circle'] },
  { visual: '⚕️', category: 'symbol', answer: 'Medical / Health', decoys: ['Poison', 'Pharmacy', 'Biohazard'] },
  { visual: '♾️', category: 'symbol', answer: 'Infinity', decoys: ['Lemniscate', 'Mobius Strip', 'Recycle'] },
  { visual: '🔱', category: 'symbol', answer: 'Trident', decoys: ['Fleur-de-lis', 'Scepter', 'Spear'] },
  { visual: '⚜️', category: 'symbol', answer: 'Fleur-de-lis', decoys: ['Royal Crown', 'Lily Flower', 'French Cross'] },
  { visual: '☢️', category: 'symbol', answer: 'Radioactive', decoys: ['Biohazard', 'Toxic', 'Nuclear Energy'] },
  { visual: '⚠️', category: 'symbol', answer: 'Warning', decoys: ['Danger', 'Caution Wet Floor', 'High Voltage'] },
];

// ── Public data shape ────────────────────────────────────────────────────────

export interface FlagQuizData {
  round: number;
  totalRounds: number;
  phase: 'guess' | 'reveal';
  visual: string;
  category: string;
  options: string[];
  guessMs: number;
  guessedPlayerIds: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  playerGuesses: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class FlagQuizGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'flagquiz',
    name: 'Flag & Symbol Quiz',
    description: 'Name that flag, landmark, or symbol!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'guess' | 'reveal' = 'guess';
  private guessMs = 0;
  private revealMs = 0;
  private currentItem: QuizItem | null = null;
  private options: string[] = [];
  private correctOptionIndex = 0;
  private playerGuesses: Record<string, number> = {};
  private shuffledItems: QuizItem[] = [];
  private itemIndex = 0;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, ITEMS.length);
    this.shuffledItems = [...ITEMS].sort(() => Math.random() - 0.5);
    this.startRound();

    const layout = this.buildLayout();
    return { ...this.buildState(this.makeData()), controllerLayout: layout };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'guess') return;
    if (this.playerGuesses[playerId] !== undefined) return;

    const btnMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const idx = btnMap[input.control];
    if (idx === undefined) return;

    this.playerGuesses[playerId] = idx;

    if (idx === this.correctOptionIndex) {
      const timeLeft = Math.max(0, this.guessMs);
      const speedBonus = Math.round((timeLeft / GUESS_MS) * SPEED_BONUS_MAX);
      this.addScore(playerId, CORRECT_POINTS + speedBonus);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'guess') {
      this.guessMs -= deltaMs;
      const allGuessed = [...this.players.keys()].every((id) => this.playerGuesses[id] !== undefined);
      if (this.guessMs <= 0 || allGuessed) {
        this.subPhase = 'reveal';
        this.revealMs = REVEAL_MS;
        this.phase = 'round_end';
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
    this.subPhase = 'guess';
    this.guessMs = GUESS_MS;
    this.playerGuesses = {};
    this.phase = 'active';
    this.currentItem = this.shuffledItems[this.itemIndex % this.shuffledItems.length]!;
    this.itemIndex++;

    const allOptions = [this.currentItem.answer, ...this.currentItem.decoys];
    const shuffled = allOptions.sort(() => Math.random() - 0.5);
    this.options = shuffled;
    this.correctOptionIndex = shuffled.indexOf(this.currentItem.answer);
  }

  private buildLayout(): ControllerLayout {
    const positions: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
    return {
      controls: this.options.map((opt, i) => ({
        type: 'button' as const,
        id: (['A', 'B', 'C', 'D'] as const)[i]!,
        label: opt,
        color: colors[i]!,
        size: 'lg' as const,
        position: positions[i]!,
      })),
    };
  }

  private makeData(): FlagQuizData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      visual: this.currentItem?.visual ?? '',
      category: this.currentItem?.category ?? '',
      options: [...this.options],
      guessMs: Math.max(0, this.guessMs),
      guessedPlayerIds: Object.keys(this.playerGuesses),
      correctIndex: this.subPhase === 'reveal' ? this.correctOptionIndex : null,
      correctAnswer: this.subPhase === 'reveal' ? this.currentItem?.answer ?? null : null,
      playerGuesses: this.subPhase === 'reveal' ? { ...this.playerGuesses } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'flagquiz',
    name: 'Flag & Symbol Quiz',
    description: 'Name that flag, landmark, or symbol!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new FlagQuizGame(),
);
