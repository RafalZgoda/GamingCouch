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
const PICK_MS = 10_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 250;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface EmojiPuzzle {
  emojis: string;
  correct: string;
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: EmojiPuzzle[] = [
  { emojis: '🦁👑', correct: 'The Lion King', distractors: ['Madagascar', 'Narnia', 'Jungle Book'], category: 'Movies' },
  { emojis: '🕷️🧑', correct: 'Spider-Man', distractors: ['Ant-Man', 'Batman', 'Iron Man'], category: 'Movies' },
  { emojis: '⭐🔫', correct: 'Star Wars', distractors: ['Star Trek', 'Guardians of the Galaxy', 'Alien'], category: 'Movies' },
  { emojis: '🧊❄️🚢', correct: 'Titanic', distractors: ['Frozen', 'The Poseidon Adventure', 'Moby Dick'], category: 'Movies' },
  { emojis: '🧙‍♂️💍', correct: 'Lord of the Rings', distractors: ['Harry Potter', 'The Hobbit', 'Narnia'], category: 'Movies' },
  { emojis: '🦈🏊', correct: 'Jaws', distractors: ['Finding Nemo', 'The Meg', 'Sharknado'], category: 'Movies' },
  { emojis: '👻👨‍👩‍👧‍👦🏠', correct: 'Ghostbusters', distractors: ['The Haunting', 'Poltergeist', 'Casper'], category: 'Movies' },
  { emojis: '🏴‍☠️🚢💀', correct: 'Pirates of the Caribbean', distractors: ['Treasure Island', 'Black Sails', 'Hook'], category: 'Movies' },
  { emojis: '🐀👨‍🍳', correct: 'Ratatouille', distractors: ['Chef', 'The Menu', 'Gusteau'], category: 'Movies' },
  { emojis: '🧊👸❄️⛄', correct: 'Frozen', distractors: ['Ice Age', 'Snow White', 'The Snow Queen'], category: 'Movies' },
  { emojis: '🍕🐢🥷', correct: 'Teenage Mutant Ninja Turtles', distractors: ['Kung Fu Panda', 'Ninjago', 'Karate Kid'], category: 'Movies' },
  { emojis: '🐟🔍', correct: 'Finding Nemo', distractors: ['Shark Tale', 'The Little Mermaid', 'Moana'], category: 'Movies' },
  { emojis: '🤖❤️🌱', correct: 'WALL-E', distractors: ['Big Hero 6', 'Robots', 'A.I.'], category: 'Movies' },
  { emojis: '🦇🌃', correct: 'Batman', distractors: ['Dracula', 'Blade', 'Morbius'], category: 'Movies' },
  { emojis: '🏠👦🎄🔫', correct: 'Home Alone', distractors: ['Die Hard', 'Elf', 'A Christmas Story'], category: 'Movies' },
  { emojis: '🎵🔊🎤☠️', correct: 'Bohemian Rhapsody', distractors: ['Rock of Ages', 'Rocketman', 'A Star Is Born'], category: 'Movies' },
  { emojis: '🧟‍♂️🌍', correct: 'World War Z', distractors: ['The Walking Dead', 'I Am Legend', 'Zombieland'], category: 'Movies' },
  { emojis: '🎈🤡🔴', correct: 'IT', distractors: ['Joker', 'Circus', 'Pennywise'], category: 'Movies' },
  { emojis: '👨‍🚀🪐', correct: 'Interstellar', distractors: ['The Martian', 'Gravity', 'Ad Astra'], category: 'Movies' },
  { emojis: '🐒🌍🗽', correct: 'Planet of the Apes', distractors: ['King Kong', 'Jumanji', 'Congo'], category: 'Movies' },
  { emojis: '🚗⚡', correct: 'Cars', distractors: ['Fast & Furious', 'Need for Speed', 'Rush'], category: 'Movies' },
  { emojis: '👧🌈🐶🏠', correct: 'The Wizard of Oz', distractors: ['Alice in Wonderland', 'Mary Poppins', 'Peter Pan'], category: 'Movies' },
  { emojis: '🧛🩸💕', correct: 'Twilight', distractors: ['Dracula', 'Interview with the Vampire', 'True Blood'], category: 'Movies' },
  { emojis: '🦖🏝️', correct: 'Jurassic Park', distractors: ['King Kong', 'Godzilla', 'Land Before Time'], category: 'Movies' },
  { emojis: '👽📞🏠', correct: 'E.T.', distractors: ['Alien', 'Close Encounters', 'Mars Attacks'], category: 'Movies' },
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

export interface EmojiTranslateData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  emojis: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class EmojiTranslateGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'emojitranslate',
    name: 'Emoji Translate',
    description: 'Guess the movie from emojis! 🦁👑 = ?',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: EmojiPuzzle | null = null;
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

  private makeData(): EmojiTranslateData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      emojis: this.currentPuzzle?.emojis ?? '',
      category: this.currentPuzzle?.category ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'emojitranslate',
    name: 'Emoji Translate',
    description: 'Guess the movie from emojis! 🦁👑 = ?',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new EmojiTranslateGame(),
);
