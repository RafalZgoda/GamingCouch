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
const SPOT_MS = 8_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;
const WRONG_PENALTY = -50;

type Zone = 'A' | 'B' | 'C' | 'D';
const ZONES: Zone[] = ['A', 'B', 'C', 'D'];

// ── Puzzle database ─────────────────────────────────────────────────────────

interface Puzzle {
  theme: string;
  baseEmojis: [string, string, string, string]; // 4 zones
  diffZone: Zone;
  diffEmoji: string; // what replaces the base emoji in diffZone
}

const PUZZLES: Puzzle[] = [
  { theme: 'Fruit Bowl', baseEmojis: ['🍎', '🍊', '🍋', '🍇'], diffZone: 'B', diffEmoji: '🍑' },
  { theme: 'Animal Farm', baseEmojis: ['🐄', '🐖', '🐔', '🐑'], diffZone: 'C', diffEmoji: '🐓' },
  { theme: 'Space', baseEmojis: ['🌟', '🌙', '⭐', '🌟'], diffZone: 'D', diffEmoji: '💫' },
  { theme: 'Sports', baseEmojis: ['⚽', '🏀', '🎾', '⚾'], diffZone: 'A', diffEmoji: '🏐' },
  { theme: 'Weather', baseEmojis: ['☀️', '🌧️', '⛈️', '🌤️'], diffZone: 'B', diffEmoji: '🌦️' },
  { theme: 'Ocean', baseEmojis: ['🐟', '🐠', '🐡', '🦈'], diffZone: 'C', diffEmoji: '🐙' },
  { theme: 'Music', baseEmojis: ['🎵', '🎶', '🎸', '🎹'], diffZone: 'D', diffEmoji: '🎺' },
  { theme: 'Flowers', baseEmojis: ['🌹', '🌻', '🌷', '🌺'], diffZone: 'A', diffEmoji: '🌸' },
  { theme: 'Food', baseEmojis: ['🍕', '🍔', '🌮', '🍟'], diffZone: 'B', diffEmoji: '🌯' },
  { theme: 'Vehicles', baseEmojis: ['🚗', '🚕', '🚙', '🏎️'], diffZone: 'C', diffEmoji: '🚐' },
  { theme: 'Faces', baseEmojis: ['😀', '😃', '😄', '😁'], diffZone: 'D', diffEmoji: '😆' },
  { theme: 'Hearts', baseEmojis: ['❤️', '💙', '💚', '💛'], diffZone: 'A', diffEmoji: '💜' },
  { theme: 'Hands', baseEmojis: ['👍', '✌️', '🤞', '👌'], diffZone: 'B', diffEmoji: '🤙' },
  { theme: 'Trees', baseEmojis: ['🌲', '🌳', '🌴', '🎄'], diffZone: 'C', diffEmoji: '🌵' },
  { theme: 'Bugs', baseEmojis: ['🐛', '🦋', '🐞', '🐝'], diffZone: 'D', diffEmoji: '🪲' },
  { theme: 'Gems', baseEmojis: ['💎', '💍', '🔮', '👑'], diffZone: 'A', diffEmoji: '🪩' },
  { theme: 'Cats', baseEmojis: ['🐱', '😺', '😸', '😻'], diffZone: 'B', diffEmoji: '🙀' },
  { theme: 'Tools', baseEmojis: ['🔨', '🪛', '🔧', '⚙️'], diffZone: 'C', diffEmoji: '🪚' },
  { theme: 'Sweets', baseEmojis: ['🍰', '🧁', '🍩', '🍪'], diffZone: 'D', diffEmoji: '🎂' },
  { theme: 'Birds', baseEmojis: ['🦅', '🦆', '🦉', '🐦'], diffZone: 'A', diffEmoji: '🦜' },
  { theme: 'Shoes', baseEmojis: ['👟', '👠', '👢', '🥿'], diffZone: 'B', diffEmoji: '👞' },
  { theme: 'Drinks', baseEmojis: ['🍺', '🍷', '🥤', '☕'], diffZone: 'C', diffEmoji: '🧃' },
  { theme: 'Flags', baseEmojis: ['🏴', '🏳️', '🚩', '🏁'], diffZone: 'D', diffEmoji: '🎌' },
  { theme: 'Balls', baseEmojis: ['⚽', '🏀', '🎱', '🏈'], diffZone: 'A', diffEmoji: '🎳' },
  { theme: 'Clocks', baseEmojis: ['🕐', '🕑', '🕒', '🕓'], diffZone: 'B', diffEmoji: '🕔' },
];

// ── Controller layout ───────────────────────────────────────────────────────

const PLAY_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '↖ Top-Left', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '↗ Top-Right', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: '↙ Bot-Left', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '↘ Bot-Right', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface SpotTheDiffData {
  round: number;
  totalRounds: number;
  phase: 'spot' | 'reveal';
  theme: string;
  leftGrid: [string, string, string, string];
  rightGrid: [string, string, string, string];
  spotMs: number;
  spottedPlayerIds: string[];
  wrongPlayerIds: string[];
  correctZone: Zone | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SpotTheDiffGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'spotthediff',
    name: 'Spot the Difference',
    description: 'Find the one difference between two grids — fastest spotter wins!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'spot' | 'reveal' = 'spot';
  private spotMs = 0;
  private revealMs = 0;
  private currentPuzzle: Puzzle | null = null;
  private spottedPlayerIds: string[] = [];
  private wrongPlayerIds: string[] = [];
  private shuffledPuzzles: Puzzle[] = [];
  private puzzleIndex = 0;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.shuffledPuzzles = [...PUZZLES].sort(() => Math.random() - 0.5);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PLAY_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'spot') return;
    if (!ZONES.includes(input.control as Zone)) return;
    if (this.spottedPlayerIds.includes(playerId) || this.wrongPlayerIds.includes(playerId)) return;

    const zone = input.control as Zone;
    if (zone === this.currentPuzzle!.diffZone) {
      this.spottedPlayerIds.push(playerId);
      const timeLeft = Math.max(0, this.spotMs);
      const speedBonus = Math.round((timeLeft / SPOT_MS) * SPEED_BONUS_MAX);
      this.addScore(playerId, CORRECT_POINTS + speedBonus);
    } else {
      this.wrongPlayerIds.push(playerId);
      this.addScore(playerId, WRONG_PENALTY);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'spot') {
      this.spotMs -= deltaMs;
      if (this.spotMs <= 0) {
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
    this.subPhase = 'spot';
    this.spotMs = SPOT_MS;
    this.spottedPlayerIds = [];
    this.wrongPlayerIds = [];
    this.phase = 'active';
    this.currentPuzzle = this.shuffledPuzzles[this.puzzleIndex % this.shuffledPuzzles.length]!;
    this.puzzleIndex++;
  }

  private makeData(): SpotTheDiffData {
    const puzzle = this.currentPuzzle!;
    const leftGrid = [...puzzle.baseEmojis] as [string, string, string, string];
    const rightGrid = [...puzzle.baseEmojis] as [string, string, string, string];
    const zoneIdx = ZONES.indexOf(puzzle.diffZone);
    rightGrid[zoneIdx] = puzzle.diffEmoji;

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      theme: puzzle.theme,
      leftGrid,
      rightGrid,
      spotMs: Math.max(0, this.spotMs),
      spottedPlayerIds: [...this.spottedPlayerIds],
      wrongPlayerIds: [...this.wrongPlayerIds],
      correctZone: this.subPhase === 'reveal' ? puzzle.diffZone : null,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'spotthediff',
    name: 'Spot the Difference',
    description: 'Find the one difference between two grids — fastest spotter wins!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SpotTheDiffGame(),
);
