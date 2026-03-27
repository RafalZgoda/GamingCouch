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

const DEFAULT_ROUNDS = 5;
const PICK_MS = 10_000;
const REVEAL_MS = 4_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content: phrase → 4 drawing emoji options → 4 phrase options ──────────────

interface TelephoneChain {
  originalPhrase: string;
  category: string;
  // Step 1: phrase → pick a drawing (emoji combo)
  drawingOptions: [string, string, string, string]; // correct at [0]
  // Step 2: drawing → pick a phrase
  phraseOptions: [string, string, string, string]; // correct at [0]
}

const CHAINS: TelephoneChain[] = [
  {
    originalPhrase: 'Cat on a hot tin roof',
    category: 'Idiom',
    drawingOptions: ['🐱🔥🏠', '🐶❄️🏠', '🐱💤🛏️', '🐱🌧️⛺'],
    phraseOptions: ['Cat on a hot tin roof', 'Dog in the cold house', 'Cat napping in bed', 'Cat in the rain'],
  },
  {
    originalPhrase: 'When pigs fly',
    category: 'Idiom',
    drawingOptions: ['🐷✈️☁️', '🐷🏊💧', '🐦✈️☁️', '🐷🏃💨'],
    phraseOptions: ['When pigs fly', 'Pig goes swimming', 'Bird takes flight', 'Pig runs fast'],
  },
  {
    originalPhrase: 'Raining cats and dogs',
    category: 'Idiom',
    drawingOptions: ['🌧️🐱🐶', '☀️🐱🐶', '🌧️🐦🐟', '🌧️👫🏃'],
    phraseOptions: ['Raining cats and dogs', 'Sunny day with pets', 'Raining birds and fish', 'Running in the rain'],
  },
  {
    originalPhrase: 'Shark attack at the beach',
    category: 'Scene',
    drawingOptions: ['🦈😱🏖️', '🐬😊🏖️', '🦈😱🏔️', '🐙😱🏖️'],
    phraseOptions: ['Shark attack at the beach', 'Dolphin fun at the beach', 'Shark in the mountains', 'Octopus scare at beach'],
  },
  {
    originalPhrase: 'Astronaut dancing on the moon',
    category: 'Scene',
    drawingOptions: ['🧑‍🚀💃🌙', '🧑‍🚀💃☀️', '🧑‍🚀😴🌙', '👽💃🌙'],
    phraseOptions: ['Astronaut dancing on the moon', 'Astronaut dancing on the sun', 'Astronaut sleeping on the moon', 'Alien dancing on the moon'],
  },
  {
    originalPhrase: 'Monkey stealing bananas',
    category: 'Scene',
    drawingOptions: ['🐒🍌💨', '🐒🍎💨', '🦧🍌😊', '🐒🍌🛒'],
    phraseOptions: ['Monkey stealing bananas', 'Monkey stealing apples', 'Orangutan eating bananas', 'Monkey shopping for bananas'],
  },
  {
    originalPhrase: 'Break a leg',
    category: 'Idiom',
    drawingOptions: ['🦵💥🎭', '🦵💥⚽', '💪💥🎭', '🦵❤️🎭'],
    phraseOptions: ['Break a leg', 'Soccer injury', 'Flex on stage', 'Leg love theater'],
  },
  {
    originalPhrase: 'Birthday party surprise',
    category: 'Event',
    drawingOptions: ['🎂🎉😲', '🎂🎉😊', '🎂😢💔', '🎁🎉😲'],
    phraseOptions: ['Birthday party surprise', 'Happy birthday party', 'Sad birthday', 'Surprise gift opening'],
  },
  {
    originalPhrase: 'Ghost in the haunted house',
    category: 'Scene',
    drawingOptions: ['👻🏚️😱', '👻🏠😊', '🧟🏚️😱', '👻⛪😱'],
    phraseOptions: ['Ghost in the haunted house', 'Friendly ghost at home', 'Zombie in haunted house', 'Ghost in the church'],
  },
  {
    originalPhrase: 'Cooking disaster in the kitchen',
    category: 'Scene',
    drawingOptions: ['👨‍🍳🔥😫', '👨‍🍳🍳😊', '👨‍🍳💧😫', '🔥🏠😫'],
    phraseOptions: ['Cooking disaster in the kitchen', 'Happy cooking time', 'Flooding the kitchen', 'House on fire'],
  },
  {
    originalPhrase: 'Pirate finding treasure',
    category: 'Scene',
    drawingOptions: ['🏴‍☠️💎🗺️', '🏴‍☠️⚔️🗺️', '👑💎🗺️', '🏴‍☠️💎🌊'],
    phraseOptions: ['Pirate finding treasure', 'Pirate in a sword fight', 'King finding treasure', 'Pirate treasure at sea'],
  },
  {
    originalPhrase: 'Robot taking over the world',
    category: 'Scene',
    drawingOptions: ['🤖🌍👑', '🤖🌍💀', '🤖🏠🔧', '👽🌍👑'],
    phraseOptions: ['Robot taking over the world', 'Robot destroying the world', 'Robot fixing a house', 'Alien ruling the world'],
  },
  {
    originalPhrase: 'Elvis has left the building',
    category: 'Idiom',
    drawingOptions: ['🎤🚪👋', '🎤🎸🎶', '🎤🚪😢', '🎤🏠💤'],
    phraseOptions: ['Elvis has left the building', 'Rock concert jamming', 'Singer leaving sadly', 'Singer sleeping at home'],
  },
  {
    originalPhrase: 'Dragon breathing fire',
    category: 'Fantasy',
    drawingOptions: ['🐉🔥💨', '🐉❄️💨', '🦎🔥💨', '🐉🔥🏰'],
    phraseOptions: ['Dragon breathing fire', 'Dragon breathing ice', 'Lizard breathing fire', 'Dragon attacking castle'],
  },
  {
    originalPhrase: 'Winning the lottery',
    category: 'Event',
    drawingOptions: ['🎰💰🎉', '🎰💰😢', '🎲💰🎉', '🎰🎟️🎉'],
    phraseOptions: ['Winning the lottery', 'Losing the lottery', 'Winning at dice', 'Buying a ticket'],
  },
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

export interface BrokenTelephoneData {
  round: number;
  totalRounds: number;
  phase: 'pick_drawing' | 'pick_phrase' | 'reveal';
  category: string;
  originalPhrase: string | null; // shown on reveal
  // Step 1: pick drawing for phrase
  promptPhrase: string | null;
  drawingOptions: string[];
  // Step 2: pick phrase for drawing
  promptDrawing: string | null;
  phraseOptions: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  playerPicks: Record<string, number>;
  correctPlayerIds: string[];
  // Reveal: show the chain
  chosenDrawing: string | null;
  chosenPhrase: string | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class BrokenTelephoneGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'brokentelephone',
    name: 'Broken Telephone',
    description: 'Pick drawings for phrases and phrases for drawings — watch the message mutate!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick_drawing' | 'pick_phrase' | 'reveal' = 'pick_drawing';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private correctPlayerIds: string[] = [];

  private usedChains: number[] = [];
  private currentChain: TelephoneChain | null = null;
  private shuffledDrawings: string[] = [];
  private drawingCorrectIndex = -1;
  private shuffledPhrases: string[] = [];
  private phraseCorrectIndex = -1;
  private chosenDrawing: string | null = null;
  private chosenPhrase: string | null = null;
  private currentCorrectIndex = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, Math.floor(CHAINS.length));
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase === 'reveal') return;
    if (this.playerPicks[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerPicks[playerId] = idx;

    if (idx === this.currentCorrectIndex) {
      this.correctPlayerIds.push(playerId);
      const elapsed = Date.now() - this.pickStartTime;
      const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
      this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
    }

    const allPicked = [...this.players.keys()].every((id) => this.playerPicks[id] !== undefined);
    if (allPicked) {
      this.advanceSubPhase();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'reveal') {
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

    this.pickMs -= deltaMs;
    if (this.pickMs <= 0) {
      this.advanceSubPhase();
    }
    return this.buildState(this.makeData());
  }

  private startRound(): void {
    // Pick a chain
    const available = CHAINS.map((_, i) => i).filter((i) => !this.usedChains.includes(i));
    const pool = available.length > 0 ? available : CHAINS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)]!;
    this.currentChain = CHAINS[idx]!;
    this.usedChains.push(idx);

    // Setup step 1: pick drawing
    this.shuffledDrawings = this.shuffle([...this.currentChain.drawingOptions]);
    this.drawingCorrectIndex = this.shuffledDrawings.indexOf(this.currentChain.drawingOptions[0]!);

    this.shuffledPhrases = this.shuffle([...this.currentChain.phraseOptions]);
    this.phraseCorrectIndex = this.shuffledPhrases.indexOf(this.currentChain.phraseOptions[0]!);

    this.subPhase = 'pick_drawing';
    this.phase = 'active';
    this.currentCorrectIndex = this.drawingCorrectIndex;
    this.playerPicks = {};
    this.correctPlayerIds = [];
    this.pickMs = PICK_MS;
    this.pickStartTime = Date.now();
    this.chosenDrawing = null;
    this.chosenPhrase = null;
  }

  private advanceSubPhase(): void {
    if (this.subPhase === 'pick_drawing') {
      // Determine most-picked drawing (majority vote)
      this.chosenDrawing = this.getMajorityChoice(this.shuffledDrawings);

      // Move to step 2: pick phrase for the chosen drawing
      this.subPhase = 'pick_phrase';
      this.currentCorrectIndex = this.phraseCorrectIndex;
      this.playerPicks = {};
      this.correctPlayerIds = [];
      this.pickMs = PICK_MS;
      this.pickStartTime = Date.now();
    } else if (this.subPhase === 'pick_phrase') {
      this.chosenPhrase = this.getMajorityChoice(this.shuffledPhrases);

      // Reveal
      this.subPhase = 'reveal';
      this.revealMs = REVEAL_MS;
      this.phase = 'round_end';
    }
  }

  private getMajorityChoice(options: string[]): string {
    const counts: Record<number, number> = {};
    for (const pick of Object.values(this.playerPicks)) {
      counts[pick] = (counts[pick] ?? 0) + 1;
    }
    let maxCount = 0;
    let maxIdx = 0;
    for (const [idx, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxIdx = Number(idx);
      }
    }
    return options[maxIdx] ?? options[0]!;
  }

  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private makeData(): BrokenTelephoneData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      category: this.currentChain?.category ?? '',
      originalPhrase: isReveal ? (this.currentChain?.originalPhrase ?? null) : null,
      promptPhrase: this.subPhase === 'pick_drawing' ? (this.currentChain?.originalPhrase ?? null) : null,
      drawingOptions: this.subPhase === 'pick_drawing' ? [...this.shuffledDrawings] : [],
      promptDrawing: this.subPhase === 'pick_phrase' ? this.chosenDrawing : null,
      phraseOptions: this.subPhase === 'pick_phrase' ? [...this.shuffledPhrases] : [],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.currentCorrectIndex : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
      correctPlayerIds: isReveal ? [...this.correctPlayerIds] : [],
      chosenDrawing: isReveal ? this.chosenDrawing : null,
      chosenPhrase: isReveal ? this.chosenPhrase : null,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'brokentelephone',
    name: 'Broken Telephone',
    description: 'Pick drawings for phrases and phrases for drawings — watch the message mutate!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new BrokenTelephoneGame(),
);
