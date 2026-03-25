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
const ANSWER_WINDOW_MS = 12_000;
const REVEAL_MS = 3_000;
const SPEED_BONUS_MAX = 150;

// ── Emoji puzzles — emoji combo → answer (4 options, index 0 = correct) ──────

interface Puzzle {
  emojis: string;
  answer: string;
  decoys: [string, string, string];
}

const PUZZLES: Puzzle[] = [
  { emojis: '🏠🔥', answer: 'Housefire', decoys: ['Fireplace', 'Hot House', 'Arson'] },
  { emojis: '⭐⚔️', answer: 'Star Wars', decoys: ['Star Trek', 'Space Battle', 'Galaxy Quest'] },
  { emojis: '🦁👑', answer: 'Lion King', decoys: ['Jungle Book', 'Simba', 'Pride Rock'] },
  { emojis: '❄️👸', answer: 'Frozen', decoys: ['Ice Queen', 'Winter', 'Elsa'] },
  { emojis: '🕷️🧑', answer: 'Spider-Man', decoys: ['Bug Boy', 'Web Slinger', 'Arachnid'] },
  { emojis: '🧙‍♂️💍', answer: 'Lord of the Rings', decoys: ['The Hobbit', 'Magic Ring', 'Gandalf'] },
  { emojis: '🦈🌪️', answer: 'Sharknado', decoys: ['Jaws', 'Shark Week', 'Tornado'] },
  { emojis: '👻🔫', answer: 'Ghostbusters', decoys: ['Ghost Hunter', 'Phantom', 'Casper'] },
  { emojis: '🍫🏭', answer: 'Charlie and the Chocolate Factory', decoys: ['Willy Wonka', 'Candy Shop', 'Sweet Factory'] },
  { emojis: '🧟‍♂️🌎', answer: 'World War Z', decoys: ['Zombie Land', 'Walking Dead', 'Undead World'] },
  { emojis: '🐍✈️', answer: 'Snakes on a Plane', decoys: ['Flying Serpent', 'Air Snake', 'Viper Flight'] },
  { emojis: '💀💎', answer: 'Skull and Bones', decoys: ['Pirate Treasure', 'Dead Diamond', 'Bone Jewel'] },
  { emojis: '🐀👨‍🍳', answer: 'Ratatouille', decoys: ['Chef Mouse', 'Kitchen Rat', 'Cooking Rodent'] },
  { emojis: '🎈🏠', answer: 'Up', decoys: ['Balloon House', 'Flying Home', 'Lift Off'] },
  { emojis: '🔵💊', answer: 'The Matrix', decoys: ['Blue Pill', 'Cyber World', 'Virtual Reality'] },
  { emojis: '🦇🌃', answer: 'Batman', decoys: ['Dark Knight', 'Gotham', 'Night Wing'] },
  { emojis: '🌊🏄', answer: 'Surfing', decoys: ['Wave Rider', 'Beach Day', 'Tidal Wave'] },
  { emojis: '👽📞', answer: 'E.T.', decoys: ['Alien Call', 'Phone Home', 'Space Phone'] },
  { emojis: '🎪🤡', answer: 'Circus', decoys: ['Carnival', 'Clown Show', 'Big Top'] },
  { emojis: '🏴‍☠️🗺️', answer: 'Treasure Map', decoys: ['Pirate Quest', 'Gold Hunt', 'X Marks the Spot'] },
  { emojis: '🐋🌊', answer: 'Moby Dick', decoys: ['Blue Whale', 'Ocean Giant', 'Sea Monster'] },
  { emojis: '🏰👻', answer: 'Haunted Mansion', decoys: ['Ghost Castle', 'Spooky House', 'Creepy Manor'] },
  { emojis: '🎵👂', answer: 'Earworm', decoys: ['Music Lover', 'Sound Bite', 'Catchy Tune'] },
  { emojis: '🌹🥀', answer: 'Beauty and the Beast', decoys: ['Dying Rose', 'Flower Power', 'Rose Garden'] },
  { emojis: '🐒🍌', answer: 'Monkey Business', decoys: ['Banana Split', 'Ape Escape', 'Jungle Fun'] },
  { emojis: '🦷🧚', answer: 'Tooth Fairy', decoys: ['Dental Magic', 'Fairy Teeth', 'Magic Tooth'] },
  { emojis: '🌙🐺', answer: 'Werewolf', decoys: ['Moon Dog', 'Night Wolf', 'Lunar Beast'] },
  { emojis: '🍕🐢', answer: 'Teenage Mutant Ninja Turtles', decoys: ['Pizza Turtle', 'Shell Shock', 'Turtle Power'] },
  { emojis: '⚡🧙', answer: 'Harry Potter', decoys: ['Magic Bolt', 'Wizard Lightning', 'Thunder Mage'] },
  { emojis: '🎭😢', answer: 'Drama', decoys: ['Sad Mask', 'Theater', 'Tragedy'] },
  { emojis: '🌍🔥', answer: 'Global Warming', decoys: ['Hot Earth', 'Fire Planet', 'Climate Change'] },
  { emojis: '🐈⬛🍀', answer: 'Black Cat / Bad Luck', decoys: ['Lucky Cat', 'Dark Feline', 'Cat Clover'] },
  { emojis: '🧊🏔️', answer: 'Iceberg', decoys: ['Cold Mountain', 'Frozen Peak', 'Glacier'] },
  { emojis: '💰🏦', answer: 'Bank Robbery', decoys: ['Money Bank', 'Cash Vault', 'Gold Heist'] },
  { emojis: '🐉🔥', answer: 'Dragon', decoys: ['Fire Lizard', 'Flame Beast', 'Game of Thrones'] },
  { emojis: '🍎📱', answer: 'Apple', decoys: ['iPhone', 'Smart Fruit', 'Tech Snack'] },
  { emojis: '🎸⚡', answer: 'Rock and Roll', decoys: ['Electric Guitar', 'Thunder Music', 'AC/DC'] },
  { emojis: '🌺🏝️', answer: 'Hawaii', decoys: ['Tropical Island', 'Beach Paradise', 'Flower Island'] },
  { emojis: '🐧❄️', answer: 'Happy Feet', decoys: ['Ice Penguin', 'Arctic Bird', 'Cool Penguin'] },
  { emojis: '🚀🌕', answer: 'Moon Landing', decoys: ['Space Travel', 'Rocket Launch', 'Apollo Mission'] },
];

// ── Controller layout (4 answer buttons) ─────────────────────────────────────

function makeLayout(options: string[]): ControllerLayout {
  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
  const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
  return {
    controls: options.map((label, i) => ({
      type: 'button' as const,
      id: ['A', 'B', 'C', 'D'][i]!,
      label,
      color: colors[i]!,
      size: 'lg' as const,
      position: positions[i]!,
    })),
  };
}

// ── Public data shape ────────────────────────────────────────────────────────

export interface EmojiDecoderData {
  emojis: string;
  options: string[];
  round: number;
  totalRounds: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  correctAnswer?: number;
  playerAnswers?: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class EmojiDecoderGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'emojidecoder',
    name: 'Emoji Decoder',
    description: 'Decode the emoji combo — pick the right answer!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private currentPuzzle!: Puzzle;
  private shuffledOptions: string[] = [];
  private correctIndex = 0;
  private timeRemainingMs = ANSWER_WINDOW_MS;
  private revealMs = 0;
  private isRevealing = false;
  private playerAnswers: Record<string, number> = {};
  private usedPuzzleIndices = new Set<number>();
  private roundScoreMap: Record<string, number> = {};

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(this.configRounds, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: makeLayout(this.shuffledOptions) };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isRevealing) return;
    if (this.playerAnswers[playerId] !== undefined) return;
    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx < 0) return;
    this.playerAnswers[playerId] = idx;

    // Score if correct
    if (idx === this.correctIndex) {
      const timeFraction = this.timeRemainingMs / ANSWER_WINDOW_MS;
      const speedBonus = Math.round(SPEED_BONUS_MAX * timeFraction);
      const pts = 200 + speedBonus;
      this.addScore(playerId, pts);
      this.roundScoreMap[playerId] = pts;
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.buildState(this.makeRevealData());
    }

    this.timeRemainingMs -= deltaMs;

    // End early if everyone answered
    const allAnswered = [...this.players.keys()].every((id) => this.playerAnswers[id] !== undefined);
    if (this.timeRemainingMs <= 0 || allAnswered) {
      this.startReveal();
    }

    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.phase = 'active';
    this.timeRemainingMs = ANSWER_WINDOW_MS;
    this.playerAnswers = {};
    this.roundScoreMap = {};
    this.isRevealing = false;

    // Pick an unused puzzle
    let idx: number;
    do {
      idx = Math.floor(Math.random() * PUZZLES.length);
    } while (this.usedPuzzleIndices.has(idx) && this.usedPuzzleIndices.size < PUZZLES.length);
    this.usedPuzzleIndices.add(idx);
    this.currentPuzzle = PUZZLES[idx]!;

    // Shuffle options
    const options = [this.currentPuzzle.answer, ...this.currentPuzzle.decoys];
    this.shuffledOptions = shuffle(options);
    this.correctIndex = this.shuffledOptions.indexOf(this.currentPuzzle.answer);
  }

  private startReveal(): void {
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
  }

  private nextRound(): void {
    if (this.round >= this.totalRounds) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private makeData(): EmojiDecoderData {
    return {
      emojis: this.currentPuzzle.emojis,
      options: [...this.shuffledOptions],
      round: this.round,
      totalRounds: this.totalRounds,
      timeRemainingMs: Math.max(0, this.timeRemainingMs),
      answeredPlayerIds: Object.keys(this.playerAnswers),
    };
  }

  private makeRevealData(): EmojiDecoderData {
    return {
      ...this.makeData(),
      correctAnswer: this.correctIndex,
      playerAnswers: { ...this.playerAnswers },
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'emojidecoder',
    name: 'Emoji Decoder',
    description: 'Decode the emoji combo — pick the right answer!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new EmojiDecoderGame(config),
);
