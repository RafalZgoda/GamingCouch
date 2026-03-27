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
const GUESS_MS = 8_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface SoundPuzzle {
  sound: string; // onomatopoeia / description shown on TV
  emoji: string;
  category: string;
  options: [string, string, string, string]; // correct at [0]
}

const PUZZLES: SoundPuzzle[] = [
  { sound: 'BUZZ BUZZ BUZZ', emoji: '🐝', category: 'Animal', options: ['Bee', 'Fly', 'Mosquito', 'Wasp'] },
  { sound: 'TICK TOCK TICK TOCK', emoji: '⏰', category: 'Object', options: ['Clock', 'Metronome', 'Timer', 'Heartbeat'] },
  { sound: 'SPLASH!', emoji: '💦', category: 'Action', options: ['Diving into water', 'Breaking glass', 'Popping balloon', 'Stomping puddle'] },
  { sound: 'MOO', emoji: '🐄', category: 'Animal', options: ['Cow', 'Bull', 'Goat', 'Sheep'] },
  { sound: 'VROOM VROOM', emoji: '🏎️', category: 'Vehicle', options: ['Race car', 'Motorcycle', 'Lawnmower', 'Helicopter'] },
  { sound: 'ACHOO!', emoji: '🤧', category: 'Human', options: ['Sneeze', 'Cough', 'Hiccup', 'Yawn'] },
  { sound: 'CRACK! BOOM!', emoji: '⛈️', category: 'Nature', options: ['Thunder', 'Earthquake', 'Avalanche', 'Volcano'] },
  { sound: 'DING DONG', emoji: '🔔', category: 'Object', options: ['Doorbell', 'Church bell', 'Bicycle bell', 'Alarm'] },
  { sound: 'RIBBIT RIBBIT', emoji: '🐸', category: 'Animal', options: ['Frog', 'Toad', 'Cricket', 'Gecko'] },
  { sound: 'WHOOOOSH', emoji: '💨', category: 'Nature', options: ['Strong wind', 'Rocket launch', 'Speeding train', 'Waterfall'] },
  { sound: 'SIZZLE SIZZLE', emoji: '🍳', category: 'Kitchen', options: ['Frying pan', 'BBQ grill', 'Toaster', 'Microwave'] },
  { sound: 'WOOF WOOF', emoji: '🐕', category: 'Animal', options: ['Dog', 'Seal', 'Wolf', 'Fox'] },
  { sound: 'BANG BANG BANG', emoji: '🚪', category: 'Action', options: ['Knocking on door', 'Fireworks', 'Gunshot', 'Hammer'] },
  { sound: 'DRIP DRIP DRIP', emoji: '🚰', category: 'Object', options: ['Leaky faucet', 'Rain on roof', 'IV drip', 'Melting ice'] },
  { sound: 'CLIP CLOP CLIP CLOP', emoji: '🐴', category: 'Animal', options: ['Horse hooves', 'Tap dancing', 'High heels', 'Woodpecker'] },
  { sound: 'POP POP POP', emoji: '🍿', category: 'Food', options: ['Popcorn popping', 'Bubble wrap', 'Champagne cork', 'Firecrackers'] },
  { sound: 'CHOMP CHOMP', emoji: '🍔', category: 'Action', options: ['Eating food', 'Alligator bite', 'Cutting paper', 'Chewing gum'] },
  { sound: 'SCREECH!', emoji: '🚗', category: 'Vehicle', options: ['Car braking', 'Owl cry', 'Chalk on board', 'Monkey'] },
  { sound: 'GURGLE GURGLE', emoji: '🫃', category: 'Human', options: ['Hungry stomach', 'Gargling mouthwash', 'Drain pipe', 'Baby laughing'] },
  { sound: 'CHOO CHOO', emoji: '🚂', category: 'Vehicle', options: ['Steam train', 'Car horn', 'Factory whistle', 'Boat horn'] },
  { sound: 'CRUNCH CRUNCH', emoji: '🥕', category: 'Food', options: ['Biting a carrot', 'Walking on gravel', 'Crumpling paper', 'Breaking ice'] },
  { sound: 'TWEET TWEET', emoji: '🐦', category: 'Animal', options: ['Bird singing', 'Whistle', 'Phone notification', 'Baby chick'] },
  { sound: 'RUMBLE RUMBLE', emoji: '🌋', category: 'Nature', options: ['Volcano', 'Thunder', 'Earthquake', 'Avalanche'] },
  { sound: 'CLANG CLANG', emoji: '🔔', category: 'Object', options: ['Sword fight', 'Pots and pans', 'Cymbals', 'Church bells'] },
  { sound: 'HISS', emoji: '🐍', category: 'Animal', options: ['Snake', 'Cat', 'Tire deflating', 'Steam pipe'] },
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

export interface SoundBitesData {
  round: number;
  totalRounds: number;
  phase: 'guess' | 'reveal';
  sound: string;
  emoji: string;
  category: string;
  options: string[];
  guessMs: number;
  guessedPlayerIds: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  playerGuesses: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SoundBitesGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'soundbites',
    name: 'Sound Bites',
    description: 'Guess what makes the sound — match the onomatopoeia to its source!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'guess' | 'reveal' = 'guess';
  private guessMs = 0;
  private revealMs = 0;
  private guessStartTime = 0;
  private playerGuesses: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: SoundPuzzle | null = null;
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
    if (allGuessed) this.goToReveal();
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

  private makeData(): SoundBitesData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      sound: this.currentPuzzle?.sound ?? '',
      emoji: this.currentPuzzle?.emoji ?? '',
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
    id: 'soundbites',
    name: 'Sound Bites',
    description: 'Guess what makes the sound — match the onomatopoeia to its source!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SoundBitesGame(),
);
