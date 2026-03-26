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

const DEFAULT_ROUNDS = 8;
const QUESTION_TIME_MS = 8_000;
const REVEAL_MS = 3_000;
const FREEZE_MS = 2_000;
const CORRECT_POINTS = 150;
const SPEED_BONUS_MAX = 100;

// ── Category database ────────────────────────────────────────────────────────

interface CategoryQuestion {
  category: string;
  options: [string, string, string, string]; // 4 options
  correctIndices: number[];                   // which are valid (can be multiple)
}

const QUESTIONS: CategoryQuestion[] = [
  { category: 'Countries in Europe', options: ['France', 'Brazil', 'Germany', 'Japan'], correctIndices: [0, 2] },
  { category: 'Countries in Europe', options: ['Spain', 'Australia', 'Italy', 'Mexico'], correctIndices: [0, 2] },
  { category: 'Fruits', options: ['Apple', 'Carrot', 'Banana', 'Broccoli'], correctIndices: [0, 2] },
  { category: 'Fruits', options: ['Mango', 'Potato', 'Grape', 'Onion'], correctIndices: [0, 2] },
  { category: 'Ocean Animals', options: ['Dolphin', 'Eagle', 'Shark', 'Lion'], correctIndices: [0, 2] },
  { category: 'Ocean Animals', options: ['Whale', 'Parrot', 'Octopus', 'Tiger'], correctIndices: [0, 2] },
  { category: 'Musical Instruments', options: ['Guitar', 'Hammer', 'Piano', 'Ladder'], correctIndices: [0, 2] },
  { category: 'Musical Instruments', options: ['Drums', 'Shovel', 'Violin', 'Wrench'], correctIndices: [0, 2] },
  { category: 'Colors of the Rainbow', options: ['Red', 'Brown', 'Green', 'Pink'], correctIndices: [0, 2] },
  { category: 'Colors of the Rainbow', options: ['Blue', 'Black', 'Yellow', 'White'], correctIndices: [0, 2] },
  { category: 'Planets in our Solar System', options: ['Mars', 'Moon', 'Jupiter', 'Sun'], correctIndices: [0, 2] },
  { category: 'Planets in our Solar System', options: ['Saturn', 'Pluto', 'Venus', 'Asteroid'], correctIndices: [0, 2] },
  { category: 'Sports played with a ball', options: ['Soccer', 'Swimming', 'Tennis', 'Boxing'], correctIndices: [0, 2] },
  { category: 'Sports played with a ball', options: ['Basketball', 'Running', 'Baseball', 'Skiing'], correctIndices: [0, 2] },
  { category: 'Things that fly', options: ['Eagle', 'Snake', 'Airplane', 'Fish'], correctIndices: [0, 2] },
  { category: 'Things that fly', options: ['Helicopter', 'Car', 'Butterfly', 'Train'], correctIndices: [0, 2] },
  { category: 'Types of Pasta', options: ['Spaghetti', 'Croissant', 'Penne', 'Bagel'], correctIndices: [0, 2] },
  { category: 'Types of Pasta', options: ['Ravioli', 'Pretzel', 'Fusilli', 'Baguette'], correctIndices: [0, 2] },
  { category: 'Capital Cities', options: ['Paris', 'Barcelona', 'Tokyo', 'Sydney'], correctIndices: [0, 2] },
  { category: 'Capital Cities', options: ['London', 'Milan', 'Berlin', 'Dubai'], correctIndices: [0, 2] },
  { category: 'Things with wheels', options: ['Bicycle', 'Table', 'Car', 'Chair'], correctIndices: [0, 2] },
  { category: 'Things with wheels', options: ['Skateboard', 'Lamp', 'Bus', 'Book'], correctIndices: [0, 2] },
  { category: 'Disney Movies', options: ['Frozen', 'Titanic', 'Moana', 'Jaws'], correctIndices: [0, 2] },
  { category: 'Disney Movies', options: ['Aladdin', 'Matrix', 'Lion King', 'Inception'], correctIndices: [0, 2] },
  { category: 'Things in a kitchen', options: ['Oven', 'Pillow', 'Fridge', 'Curtain'], correctIndices: [0, 2] },
  { category: 'Things in a kitchen', options: ['Toaster', 'Sofa', 'Blender', 'Carpet'], correctIndices: [0, 2] },
  { category: 'Programming Languages', options: ['Python', 'English', 'JavaScript', 'Spanish'], correctIndices: [0, 2] },
  { category: 'Programming Languages', options: ['Rust', 'French', 'TypeScript', 'Latin'], correctIndices: [0, 2] },
  { category: 'Superheroes', options: ['Spider-Man', 'Sherlock', 'Batman', 'Gandalf'], correctIndices: [0, 2] },
  { category: 'Superheroes', options: ['Superman', 'James Bond', 'Wonder Woman', 'Harry Potter'], correctIndices: [0, 2] },
  { category: 'Board Games', options: ['Chess', 'Soccer', 'Monopoly', 'Tennis'], correctIndices: [0, 2] },
  { category: 'Board Games', options: ['Scrabble', 'Basketball', 'Risk', 'Swimming'], correctIndices: [0, 2] },
];

// Shuffle correct answers into random positions at runtime
function shuffleQuestion(q: CategoryQuestion): CategoryQuestion {
  const entries = q.options.map((opt, i) => ({
    opt,
    correct: q.correctIndices.includes(i),
  }));
  // Fisher-Yates
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j]!, entries[i]!];
  }
  return {
    category: q.category,
    options: entries.map((e) => e.opt) as [string, string, string, string],
    correctIndices: entries.map((e, i) => (e.correct ? i : -1)).filter((i) => i >= 0),
  };
}

// ── Public data shape ────────────────────────────────────────────────────────

export interface CategorySprintData {
  category: string;
  options: string[];
  round: number;
  totalRounds: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  frozenPlayers: Record<string, number>;  // playerId → freeze remaining ms
  correctAnswer?: number[];               // during reveal
  playerAnswers?: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class CategorySprintGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'categorysprint',
    name: 'Category Sprint',
    description: 'Tap the items that belong! Wrong tap = freeze!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private currentQuestion!: CategoryQuestion;
  private timeRemainingMs = QUESTION_TIME_MS;
  private revealMs = 0;
  private isRevealing = false;
  private playerAnswers: Record<string, number> = {};
  private frozenPlayers: Record<string, number> = {};
  private usedIndices = new Set<number>();

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(this.configRounds, QUESTIONS.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: this.makeLayout() };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.isRevealing) return;
    if (this.playerAnswers[playerId] !== undefined) return;

    // Check if frozen
    if ((this.frozenPlayers[playerId] ?? 0) > 0) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx < 0) return;

    this.playerAnswers[playerId] = idx;

    if (this.currentQuestion.correctIndices.includes(idx)) {
      // Correct
      const timeFraction = this.timeRemainingMs / QUESTION_TIME_MS;
      const speedBonus = Math.round(SPEED_BONUS_MAX * timeFraction);
      this.addScore(playerId, CORRECT_POINTS + speedBonus);
    } else {
      // Wrong — freeze!
      this.frozenPlayers[playerId] = FREEZE_MS;
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.buildState(this.makeRevealData());
    }

    // Update freeze timers
    for (const id of Object.keys(this.frozenPlayers)) {
      this.frozenPlayers[id] = Math.max(0, (this.frozenPlayers[id] ?? 0) - deltaMs);
    }

    this.timeRemainingMs -= deltaMs;

    const allAnswered = [...this.players.keys()].every((id) => this.playerAnswers[id] !== undefined);
    if (this.timeRemainingMs <= 0 || allAnswered) {
      this.startReveal();
    }

    return this.buildState(this.makeData());
  }

  private startRound(): void {
    this.phase = 'active';
    this.timeRemainingMs = QUESTION_TIME_MS;
    this.playerAnswers = {};
    this.frozenPlayers = {};
    this.isRevealing = false;

    let idx: number;
    do {
      idx = Math.floor(Math.random() * QUESTIONS.length);
    } while (this.usedIndices.has(idx) && this.usedIndices.size < QUESTIONS.length);
    this.usedIndices.add(idx);
    this.currentQuestion = shuffleQuestion(QUESTIONS[idx]!);
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

  private makeLayout(): ControllerLayout {
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
    return {
      controls: this.currentQuestion.options.map((label, i) => ({
        type: 'button' as const,
        id: ['A', 'B', 'C', 'D'][i]!,
        label,
        color: colors[i]!,
        size: 'lg' as const,
        position: positions[i]!,
      })),
    };
  }

  private makeData(): CategorySprintData {
    return {
      category: this.currentQuestion.category,
      options: [...this.currentQuestion.options],
      round: this.round,
      totalRounds: this.totalRounds,
      timeRemainingMs: Math.max(0, this.timeRemainingMs),
      answeredPlayerIds: Object.keys(this.playerAnswers),
      frozenPlayers: { ...this.frozenPlayers },
    };
  }

  private makeRevealData(): CategorySprintData {
    return {
      ...this.makeData(),
      correctAnswer: [...this.currentQuestion.correctIndices],
      playerAnswers: { ...this.playerAnswers },
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'categorysprint',
    name: 'Category Sprint',
    description: 'Tap the items that belong! Wrong tap = freeze!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new CategorySprintGame(config),
);
