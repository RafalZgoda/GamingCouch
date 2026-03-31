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
const PICK_MS = 5_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface SnapPuzzle {
  question: string;       // e.g. "Which is taller?"
  itemA: string;
  itemB: string;
  answer: 'A' | 'B';     // which item wins
  funFact: string;
  category: string;
}

const PUZZLES: SnapPuzzle[] = [
  { question: 'Which is taller?', itemA: 'Eiffel Tower (330m)', itemB: 'Statue of Liberty (93m)', answer: 'A', funFact: 'The Eiffel Tower is 3.5x taller!', category: 'Landmarks' },
  { question: 'Which is heavier?', itemA: 'Blue Whale', itemB: 'African Elephant', answer: 'A', funFact: 'A blue whale weighs ~150 tonnes vs ~6 tonnes', category: 'Animals' },
  { question: 'Which is faster?', itemA: 'Cheetah', itemB: 'Peregrine Falcon', answer: 'B', funFact: 'Peregrine falcon dives at 390 km/h!', category: 'Animals' },
  { question: 'Which has more people?', itemA: 'Tokyo', itemB: 'New York City', answer: 'A', funFact: 'Tokyo metro: ~37M vs NYC: ~8M', category: 'Cities' },
  { question: 'Which came first?', itemA: 'Pizza', itemB: 'Hamburger', answer: 'A', funFact: 'Pizza dates to 1700s Naples, hamburgers to 1880s', category: 'Food' },
  { question: 'Which is longer?', itemA: 'Amazon River', itemB: 'Nile River', answer: 'B', funFact: 'Nile is ~6,650km vs Amazon ~6,400km', category: 'Geography' },
  { question: 'Which is older?', itemA: 'Great Wall of China', itemB: 'Roman Colosseum', answer: 'A', funFact: 'Great Wall started ~700 BC vs Colosseum 70 AD', category: 'History' },
  { question: 'Which is hotter?', itemA: 'Surface of the Sun', itemB: 'Lightning bolt', answer: 'B', funFact: 'Lightning can reach 30,000°C vs Sun surface 5,500°C', category: 'Science' },
  { question: 'Which has more calories?', itemA: 'Avocado', itemB: 'Banana', answer: 'A', funFact: 'Avocado ~240 cal vs banana ~100 cal', category: 'Food' },
  { question: 'Which is deeper?', itemA: 'Grand Canyon', itemB: 'Mariana Trench', answer: 'B', funFact: 'Mariana Trench: 11km deep vs Grand Canyon: 1.8km', category: 'Geography' },
  { question: 'Which is faster?', itemA: 'Speed of Sound', itemB: 'Speed of Light', answer: 'B', funFact: 'Light is ~880,000x faster than sound', category: 'Science' },
  { question: 'Which weighs more?', itemA: 'A gallon of milk', itemB: 'A gallon of honey', answer: 'B', funFact: 'Honey is ~1.4x denser than milk', category: 'Food' },
  { question: 'Which has more bones?', itemA: 'Adult human', itemB: 'Baby human', answer: 'B', funFact: 'Babies have ~270 bones, adults ~206 (they fuse)', category: 'Body' },
  { question: 'Which is bigger?', itemA: 'Jupiter', itemB: 'Saturn', answer: 'A', funFact: 'Jupiter could fit 1,400 Earths vs Saturn 764', category: 'Space' },
  { question: 'Which country is larger?', itemA: 'Australia', itemB: 'Brazil', answer: 'B', funFact: 'Brazil: 8.5M km² vs Australia: 7.7M km²', category: 'Geography' },
  { question: 'Which is louder?', itemA: 'Rock concert', itemB: 'Space shuttle launch', answer: 'B', funFact: 'Shuttle launch ~180dB vs concert ~120dB', category: 'Science' },
  { question: 'Which can hold its breath longer?', itemA: 'Dolphin', itemB: 'Elephant seal', answer: 'B', funFact: 'Elephant seals: up to 2 hours vs dolphin: ~10 min', category: 'Animals' },
  { question: 'Which is taller?', itemA: 'Giraffe', itemB: 'Double-decker bus', answer: 'A', funFact: 'Giraffe: ~5.5m vs double-decker: ~4.4m', category: 'Animals' },
  { question: 'Which has more sugar?', itemA: 'Can of Coke', itemB: 'Glass of orange juice', answer: 'A', funFact: 'Coke: ~39g sugar vs OJ: ~21g per glass', category: 'Food' },
  { question: 'Which is older?', itemA: 'Sharks', itemB: 'Trees', answer: 'A', funFact: 'Sharks: ~450M years vs trees: ~350M years', category: 'Nature' },
  { question: 'Which spins faster?', itemA: 'Earth', itemB: 'Mars', answer: 'A', funFact: 'Earth: 1,670 km/h vs Mars: 870 km/h at equator', category: 'Space' },
  { question: 'Which is more expensive?', itemA: 'Gold (per kg)', itemB: 'Saffron (per kg)', answer: 'A', funFact: 'Gold: ~$65K/kg vs Saffron: ~$5K/kg', category: 'Money' },
  { question: 'Which has more teeth?', itemA: 'Shark', itemB: 'Snail', answer: 'B', funFact: 'Snails have ~20,000 teeth vs shark ~300', category: 'Animals' },
  { question: 'Which is colder?', itemA: 'Antarctica', itemB: 'North Pole', answer: 'A', funFact: 'Antarctica: -89.2°C record vs Arctic: -68°C', category: 'Geography' },
  { question: 'Which was invented first?', itemA: 'Telephone', itemB: 'Light bulb', answer: 'A', funFact: 'Telephone: 1876 vs practical light bulb: 1879', category: 'History' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'lg', position: 'top-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface SnapJudgeData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  question: string;
  category: string;
  itemA: string;
  itemB: string;
  pickMs: number;
  pickedPlayerIds: string[];
  correctAnswer: 'A' | 'B' | null;
  funFact: string | null;
  playerPicks: Record<string, string>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SnapJudgeGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'snapjudge',
    name: 'Snap Judge',
    description: 'Which is bigger, faster, heavier? Trust your gut — speed counts!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, 'A' | 'B'> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: SnapPuzzle | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    if (input.control !== 'A' && input.control !== 'B') return;

    this.playerPicks[playerId] = input.control;

    if (this.currentPuzzle && input.control === this.currentPuzzle.answer) {
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
  }

  private goToReveal(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
  }

  private makeData(): SnapJudgeData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      question: this.currentPuzzle?.question ?? '',
      category: this.currentPuzzle?.category ?? '',
      itemA: this.currentPuzzle?.itemA ?? '',
      itemB: this.currentPuzzle?.itemB ?? '',
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctAnswer: isReveal ? (this.currentPuzzle?.answer ?? null) : null,
      funFact: isReveal ? (this.currentPuzzle?.funFact ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'snapjudge',
    name: 'Snap Judge',
    description: 'Which is bigger, faster, heavier? Trust your gut — speed counts!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SnapJudgeGame(),
);
