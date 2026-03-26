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

const ACT_MS = 20_000;
const GUESS_MS = 10_000;
const REVEAL_MS = 3_500;
const CORRECT_GUESS_POINTS = 150;
const SPEED_BONUS_MAX = 100;
const ACTOR_POINTS_PER_GUESSER = 75;

// ── Word database ───────────────────────────────────────────────────────────

interface MimeWord {
  word: string;
  category: string;
  decoys: [string, string, string]; // 3 wrong options
}

const WORDS: MimeWord[] = [
  { word: 'Swimming', category: 'Action', decoys: ['Running', 'Dancing', 'Climbing'] },
  { word: 'Cooking', category: 'Action', decoys: ['Painting', 'Cleaning', 'Gardening'] },
  { word: 'Guitar', category: 'Object', decoys: ['Drums', 'Piano', 'Violin'] },
  { word: 'Elephant', category: 'Animal', decoys: ['Giraffe', 'Monkey', 'Lion'] },
  { word: 'Airplane', category: 'Vehicle', decoys: ['Helicopter', 'Boat', 'Train'] },
  { word: 'Boxing', category: 'Sport', decoys: ['Wrestling', 'Fencing', 'Karate'] },
  { word: 'Sleeping', category: 'Action', decoys: ['Eating', 'Stretching', 'Meditating'] },
  { word: 'Fishing', category: 'Activity', decoys: ['Hunting', 'Camping', 'Hiking'] },
  { word: 'Robot', category: 'Character', decoys: ['Zombie', 'Ghost', 'Alien'] },
  { word: 'Penguin', category: 'Animal', decoys: ['Duck', 'Chicken', 'Flamingo'] },
  { word: 'Brushing teeth', category: 'Action', decoys: ['Combing hair', 'Washing face', 'Shaving'] },
  { word: 'Basketball', category: 'Sport', decoys: ['Soccer', 'Tennis', 'Baseball'] },
  { word: 'Crying baby', category: 'Character', decoys: ['Laughing kid', 'Sleeping baby', 'Angry toddler'] },
  { word: 'Surfing', category: 'Sport', decoys: ['Skiing', 'Skateboarding', 'Snowboarding'] },
  { word: 'Monkey', category: 'Animal', decoys: ['Bear', 'Kangaroo', 'Gorilla'] },
  { word: 'Taking selfie', category: 'Action', decoys: ['Making call', 'Texting', 'Filming'] },
  { word: 'Snake', category: 'Animal', decoys: ['Worm', 'Lizard', 'Crocodile'] },
  { word: 'Weightlifting', category: 'Sport', decoys: ['Push-ups', 'Yoga', 'Running'] },
  { word: 'Driving', category: 'Action', decoys: ['Flying', 'Cycling', 'Rowing'] },
  { word: 'Cat', category: 'Animal', decoys: ['Dog', 'Rabbit', 'Fox'] },
  { word: 'Dancing', category: 'Action', decoys: ['Jumping', 'Skipping', 'Marching'] },
  { word: 'Superhero', category: 'Character', decoys: ['Villain', 'Wizard', 'Knight'] },
  { word: 'Bowling', category: 'Sport', decoys: ['Golf', 'Darts', 'Pool'] },
  { word: 'Chicken', category: 'Animal', decoys: ['Turkey', 'Parrot', 'Eagle'] },
  { word: 'Ironing', category: 'Action', decoys: ['Sewing', 'Folding', 'Knitting'] },
  { word: 'Pirate', category: 'Character', decoys: ['Ninja', 'Cowboy', 'Viking'] },
  { word: 'Roller coaster', category: 'Thing', decoys: ['Ferris wheel', 'Carousel', 'Waterslide'] },
  { word: 'Snowball fight', category: 'Action', decoys: ['Building snowman', 'Ice skating', 'Sledding'] },
  { word: 'Frog', category: 'Animal', decoys: ['Toad', 'Turtle', 'Salamander'] },
  { word: 'Playing drums', category: 'Action', decoys: ['Playing guitar', 'Playing piano', 'Singing'] },
];

// ── Controller layouts ──────────────────────────────────────────────────────

const ACTOR_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'READY', label: '🎬 ACT IT OUT!', color: '#a855f7', size: 'lg', position: 'center' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '👀 Watch!', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface MimeTimeData {
  round: number;
  totalRounds: number;
  phase: 'act' | 'guess' | 'reveal';
  actorId: string | null;
  actMs: number;
  guessMs: number;
  options: string[];
  guessedPlayerIds: string[];
  correctWord: string | null;
  correctIndex: number | null;
  playerGuesses: Record<string, number>;
  correctPlayerIds: string[];
  category: string;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class MimeTimeGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'mimetime',
    name: 'Mime Time',
    description: 'Act it out — no talking! Others guess what you are miming.',
    minPlayers: 3,
    maxPlayers: 8,
  };

  private subPhase: 'act' | 'guess' | 'reveal' = 'act';
  private actMs = 0;
  private guessMs = 0;
  private revealMs = 0;
  private playerIds: string[] = [];
  private actorIndex = 0;
  private currentWord: MimeWord | null = null;
  private options: string[] = [];
  private correctOptionIndex = 0;
  private playerGuesses: Record<string, number> = {};
  private shuffledWords: MimeWord[] = [];
  private wordIndex = 0;

  protected onInit(_players: Player[]): GameState {
    this.playerIds = [...this.players.keys()];
    this.shuffledWords = [...WORDS].sort(() => Math.random() - 0.5);
    this.totalRounds = Math.min(this.playerIds.length * 2, this.shuffledWords.length);
    this.actorIndex = 0;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: WAIT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    const actorId = this.playerIds[this.actorIndex % this.playerIds.length]!;

    if (this.subPhase === 'act') {
      // Actor presses ready to start guessing phase
      if (playerId === actorId && input.control === 'READY') {
        this.subPhase = 'guess';
        this.guessMs = GUESS_MS;
      }
      return;
    }

    if (this.subPhase !== 'guess') return;
    if (playerId === actorId) return; // actor can't guess
    if (this.playerGuesses[playerId] !== undefined) return;

    const btnMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const idx = btnMap[input.control];
    if (idx === undefined) return;

    this.playerGuesses[playerId] = idx;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'act') {
      this.actMs -= deltaMs;
      if (this.actMs <= 0) {
        // Auto-start guessing
        this.subPhase = 'guess';
        this.guessMs = GUESS_MS;
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'guess') {
      this.guessMs -= deltaMs;
      const actorId = this.playerIds[this.actorIndex % this.playerIds.length]!;
      const guessers = this.playerIds.filter((id) => id !== actorId);
      const allGuessed = guessers.every((id) => this.playerGuesses[id] !== undefined);
      if (this.guessMs <= 0 || allGuessed) {
        this.resolveRound();
      }
      // Send guess layout to non-actors
      const layout: ControllerLayout = {
        controls: this.options.map((opt, i) => ({
          type: 'button' as const,
          id: (['A', 'B', 'C', 'D'] as const)[i]!,
          label: opt,
          color: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'][i]!,
          size: 'lg' as const,
          position: (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const)[i]!,
        })),
      };
      return { ...this.buildState(this.makeData()), controllerLayout: layout };
    }

    // reveal
    this.revealMs -= deltaMs;
    if (this.revealMs <= 0) {
      if (this.round >= this.totalRounds) {
        this.phase = 'results';
      } else {
        this.round++;
        this.actorIndex++;
        this.startRound();
      }
    }
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.subPhase = 'act';
    this.actMs = ACT_MS;
    this.playerGuesses = {};
    this.phase = 'active';
    this.currentWord = this.shuffledWords[this.wordIndex % this.shuffledWords.length]!;
    this.wordIndex++;

    // Build shuffled options
    const allOptions = [this.currentWord.word, ...this.currentWord.decoys];
    const shuffled = allOptions.sort(() => Math.random() - 0.5);
    this.options = shuffled;
    this.correctOptionIndex = shuffled.indexOf(this.currentWord.word);
  }

  private resolveRound(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const actorId = this.playerIds[this.actorIndex % this.playerIds.length]!;
    let correctCount = 0;

    for (const [id, guess] of Object.entries(this.playerGuesses)) {
      if (guess === this.correctOptionIndex) {
        correctCount++;
        const timeLeft = Math.max(0, this.guessMs);
        const speedBonus = Math.round((timeLeft / GUESS_MS) * SPEED_BONUS_MAX);
        this.addScore(id, CORRECT_GUESS_POINTS + speedBonus);
      }
    }

    // Actor gets points per correct guesser
    this.addScore(actorId, correctCount * ACTOR_POINTS_PER_GUESSER);
  }

  private makeData(): MimeTimeData {
    const actorId = this.playerIds[this.actorIndex % this.playerIds.length] ?? null;
    const correctPlayerIds = this.subPhase === 'reveal'
      ? Object.entries(this.playerGuesses)
        .filter(([, g]) => g === this.correctOptionIndex)
        .map(([id]) => id)
      : [];

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      actorId,
      actMs: Math.max(0, this.actMs),
      guessMs: Math.max(0, this.guessMs),
      options: [...this.options],
      guessedPlayerIds: Object.keys(this.playerGuesses),
      correctWord: this.subPhase === 'reveal' ? this.currentWord?.word ?? null : null,
      correctIndex: this.subPhase === 'reveal' ? this.correctOptionIndex : null,
      playerGuesses: this.subPhase === 'reveal' ? { ...this.playerGuesses } : {},
      correctPlayerIds,
      category: this.currentWord?.category ?? '',
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'mimetime',
    name: 'Mime Time',
    description: 'Act it out — no talking! Others guess what you are miming.',
    minPlayers: 3,
    maxPlayers: 8,
  },
  () => new MimeTimeGame(),
);
