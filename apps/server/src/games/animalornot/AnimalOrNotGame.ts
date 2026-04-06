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
const PICK_MS = 6_000;
const REVEAL_MS = 2_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface AnimalPuzzle {
  name: string;
  isReal: boolean;
  fact: string;
}

const PUZZLES: AnimalPuzzle[] = [
  { name: 'Axolotl', isReal: true, fact: 'A Mexican salamander that can regenerate limbs' },
  { name: 'Flumpleback', isReal: false, fact: 'Made up — doesn\'t exist!' },
  { name: 'Narwhal', isReal: true, fact: 'An arctic whale with a long spiral tusk' },
  { name: 'Quokka', isReal: true, fact: 'A small marsupial known as the happiest animal' },
  { name: 'Snazzleworm', isReal: false, fact: 'Made up — doesn\'t exist!' },
  { name: 'Aye-Aye', isReal: true, fact: 'A lemur with a long skeleton-like finger' },
  { name: 'Blobfish', isReal: true, fact: 'Looks like a sad blob at surface pressure' },
  { name: 'Crumblehopper', isReal: false, fact: 'Made up — doesn\'t exist!' },
  { name: 'Pangolin', isReal: true, fact: 'A scaly anteater — the most trafficked mammal' },
  { name: 'Fossa', isReal: true, fact: 'Madagascar\'s top predator, cat-like but related to mongooses' },
  { name: 'Dripplefish', isReal: false, fact: 'Made up — doesn\'t exist!' },
  { name: 'Okapi', isReal: true, fact: 'Looks like a zebra-giraffe hybrid from the Congo' },
  { name: 'Tufted Puffin', isReal: true, fact: 'A colorful seabird with orange beak tufts' },
  { name: 'Wobblesnout', isReal: false, fact: 'Made up — doesn\'t exist!' },
  { name: 'Jerboa', isReal: true, fact: 'A tiny jumping rodent with kangaroo legs' },
  { name: 'Glasswing Butterfly', isReal: true, fact: 'Has transparent wings you can see through' },
  { name: 'Frizzlegill', isReal: false, fact: 'Made up — doesn\'t exist!' },
  { name: 'Kakapo', isReal: true, fact: 'A flightless parrot from New Zealand, critically endangered' },
  { name: 'Dugong', isReal: true, fact: 'A marine mammal related to manatees, inspired mermaid legends' },
  { name: 'Snorkelmoose', isReal: false, fact: 'Made up — doesn\'t exist!' },
  { name: 'Shoebill', isReal: true, fact: 'A massive African bird with a shoe-shaped bill' },
  { name: 'Numbat', isReal: true, fact: 'An Australian marsupial with a striped back' },
  { name: 'Bumblecrab', isReal: false, fact: 'Made up — doesn\'t exist!' },
  { name: 'Gerenuk', isReal: true, fact: 'An antelope that stands on hind legs to eat from trees' },
  { name: 'Fluffadillo', isReal: false, fact: 'Made up — doesn\'t exist!' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '✅ Real', color: '#22c55e', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: '❌ Fake', color: '#ef4444', size: 'lg', position: 'top-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface AnimalOrNotData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  name: string;
  isReal: boolean | null;
  fact: string | null;
  pickMs: number;
  pickedPlayerIds: string[];
  correctAnswer: 'A' | 'B' | null;
  playerPicks: Record<string, string>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class AnimalOrNotGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'animalornot',
    name: 'Animal or Not',
    description: 'Real animal or totally made up? You decide!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, string> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: AnimalPuzzle | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    const pick = input.control;
    if (pick !== 'A' && pick !== 'B') return;

    this.playerPicks[playerId] = pick;

    if (this.currentPuzzle) {
      const correctPick = this.currentPuzzle.isReal ? 'A' : 'B';
      if (pick === correctPick) {
        const elapsed = Date.now() - this.pickStartTime;
        const speedRatio = Math.max(0, 1 - elapsed / PICK_MS);
        this.addScore(playerId, CORRECT_POINTS + Math.round(speedRatio * SPEED_BONUS_MAX));
      }
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

  private makeData(): AnimalOrNotData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      name: this.currentPuzzle?.name ?? '',
      isReal: isReveal ? (this.currentPuzzle?.isReal ?? null) : null,
      fact: isReveal ? (this.currentPuzzle?.fact ?? null) : null,
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctAnswer: isReveal ? (this.currentPuzzle?.isReal ? 'A' : 'B') : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'animalornot',
    name: 'Animal or Not',
    description: 'Real animal or totally made up? You decide!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new AnimalOrNotGame(),
);
