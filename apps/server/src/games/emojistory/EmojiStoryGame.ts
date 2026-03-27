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
const GUESS_MS = 12_000;
const REVEAL_MS = 3_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface StoryPuzzle {
  emojis: string;
  category: string;
  options: [string, string, string, string]; // correct at [0]
}

const PUZZLES: StoryPuzzle[] = [
  { emojis: '👸🍎💀☠️', category: 'Fairy Tale', options: ['Snow White', 'Cinderella', 'Sleeping Beauty', 'Rapunzel'] },
  { emojis: '🚢🧊💔🌊', category: 'Movie', options: ['Titanic', 'Frozen', 'Moana', 'Life of Pi'] },
  { emojis: '🦁👑🌅🐗', category: 'Movie', options: ['The Lion King', 'Madagascar', 'Tarzan', 'Jungle Book'] },
  { emojis: '🧙‍♂️💍🌋🗡️', category: 'Movie', options: ['Lord of the Rings', 'Harry Potter', 'The Hobbit', 'Narnia'] },
  { emojis: '🕷️🦸‍♂️🏙️🕸️', category: 'Superhero', options: ['Spider-Man', 'Batman', 'Superman', 'Iron Man'] },
  { emojis: '🤖🔴🌌👁️', category: 'Movie', options: ['2001: A Space Odyssey', 'Star Wars', 'Blade Runner', 'The Matrix'] },
  { emojis: '🧛‍♂️🩸🌙🏰', category: 'Monster', options: ['Dracula', 'Frankenstein', 'Werewolf', 'Mummy'] },
  { emojis: '🐕🦴❄️🛷', category: 'Story', options: ['Call of the Wild', 'Marley & Me', '101 Dalmatians', 'Old Yeller'] },
  { emojis: '🎸⚡🎤🤘', category: 'Music', options: ['Rock Concert', 'Jazz Night', 'Opera', 'DJ Set'] },
  { emojis: '🏠🎈👴🐕', category: 'Movie', options: ['Up', 'Coco', 'Inside Out', 'Wall-E'] },
  { emojis: '🐀👨‍🍳🇫🇷⭐', category: 'Movie', options: ['Ratatouille', 'The Chef', 'Julie & Julia', 'Burnt'] },
  { emojis: '🦈🏖️😱🩸', category: 'Movie', options: ['Jaws', 'Sharknado', 'The Meg', 'Deep Blue Sea'] },
  { emojis: '🏴‍☠️💀🗺️💎', category: 'Adventure', options: ['Treasure Island', 'Pirates of Caribbean', 'Peter Pan', 'Goonies'] },
  { emojis: '🐒🍌👑🏰', category: 'Story', options: ['King Kong', 'Planet of the Apes', 'Tarzan', 'Curious George'] },
  { emojis: '🧊❄️👸⛄', category: 'Movie', options: ['Frozen', 'Ice Age', 'Snow White', 'Narnia'] },
  { emojis: '🐠🌊👨‍👦🔍', category: 'Movie', options: ['Finding Nemo', 'Shark Tale', 'Moana', 'Aquaman'] },
  { emojis: '🏎️⚡🏁🔥', category: 'Movie', options: ['Cars', 'Fast & Furious', 'Speed Racer', 'Rush'] },
  { emojis: '👽📞🌙🚲', category: 'Movie', options: ['E.T.', 'Alien', 'Close Encounters', 'Men in Black'] },
  { emojis: '🍫🏭👦🎩', category: 'Movie', options: ['Charlie and the Chocolate Factory', 'Hansel & Gretel', 'Candy Land', 'Matilda'] },
  { emojis: '🤴⚔️🐉🏰', category: 'Fantasy', options: ['Game of Thrones', 'Lord of the Rings', 'Narnia', 'Harry Potter'] },
  { emojis: '👩‍🚀🌍🔧🛰️', category: 'Movie', options: ['Gravity', 'Interstellar', 'The Martian', 'Alien'] },
  { emojis: '🐘🎪🎈👂', category: 'Movie', options: ['Dumbo', 'Madagascar', 'Circus', 'Zootopia'] },
  { emojis: '🧟‍♂️🧠🏃💀', category: 'Genre', options: ['Zombie Apocalypse', 'Ghost Story', 'Vampire Movie', 'Haunted House'] },
  { emojis: '⚡🧙‍♂️📚🏫', category: 'Movie', options: ['Harry Potter', 'Lord of the Rings', 'Narnia', 'Percy Jackson'] },
  { emojis: '🦖🏝️🔬🚁', category: 'Movie', options: ['Jurassic Park', 'King Kong', 'Lost World', 'Avatar'] },
];

// ── Controller layout ────────────────────────────────────────────────────────

const GUESS_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface EmojiStoryData {
  round: number;
  totalRounds: number;
  phase: 'guess' | 'reveal';
  emojis: string;
  category: string;
  options: string[];
  guessMs: number;
  guessedPlayerIds: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  playerGuesses: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class EmojiStoryGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'emojistory',
    name: 'Emoji Story',
    description: 'Decode the emoji sequence — what movie, story, or scene do they tell?',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'guess' | 'reveal' = 'guess';
  private guessMs = 0;
  private revealMs = 0;
  private guessStartTime = 0;
  private playerGuesses: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: StoryPuzzle | null = null;
  private shuffledOptions: string[] = [];
  private correctIndex = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: GUESS_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'guess') return;
    if (this.playerGuesses[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerGuesses[playerId] = idx;

    if (idx === this.correctIndex) {
      const elapsed = Date.now() - this.guessStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / GUESS_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    }

    const allGuessed = [...this.players.keys()].every((id) => this.playerGuesses[id] !== undefined);
    if (allGuessed) {
      this.goToReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'guess') {
      this.guessMs -= deltaMs;
      if (this.guessMs <= 0) this.goToReveal();
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
    this.phase = 'active';
    this.playerGuesses = {};
    this.guessMs = GUESS_MS;
    this.guessStartTime = Date.now();

    const available = PUZZLES.map((_, i) => i).filter((i) => !this.usedPuzzles.includes(i));
    const pool = available.length > 0 ? available : PUZZLES.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentPuzzle = PUZZLES[idx]!;
    this.usedPuzzles.push(idx);

    this.shuffledOptions = this.shuffle([...this.currentPuzzle.options]);
    this.correctIndex = this.shuffledOptions.indexOf(this.currentPuzzle.options[0]!);
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

  private makeData(): EmojiStoryData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      emojis: this.currentPuzzle?.emojis ?? '',
      category: this.currentPuzzle?.category ?? '',
      options: [...this.shuffledOptions],
      guessMs: Math.max(0, this.guessMs),
      guessedPlayerIds: Object.keys(this.playerGuesses),
      correctIndex: isReveal ? this.correctIndex : null,
      correctAnswer: isReveal ? (this.currentPuzzle?.options[0] ?? null) : null,
      playerGuesses: isReveal ? { ...this.playerGuesses } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'emojistory',
    name: 'Emoji Story',
    description: 'Decode the emoji sequence — what movie, story, or scene do they tell?',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new EmojiStoryGame(),
);
