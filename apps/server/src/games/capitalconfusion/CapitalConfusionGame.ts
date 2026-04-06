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
const PICK_MS = 7_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface CapitalPuzzle {
  city: string;
  country: string;
  isCapital: boolean;
  realCapital: string;
  funFact: string;
}

const PUZZLES: CapitalPuzzle[] = [
  { city: 'Sydney', country: 'Australia', isCapital: false, realCapital: 'Canberra', funFact: 'Canberra was built as a compromise because Sydney and Melbourne couldn\'t agree.' },
  { city: 'Istanbul', country: 'Turkey', isCapital: false, realCapital: 'Ankara', funFact: 'Istanbul is the largest city but Ankara became capital in 1923 under Ataturk.' },
  { city: 'Rio de Janeiro', country: 'Brazil', isCapital: false, realCapital: 'Brasilia', funFact: 'Brasilia was purpose-built in the 1960s and is shaped like an airplane from above.' },
  { city: 'New York', country: 'United States', isCapital: false, realCapital: 'Washington D.C.', funFact: 'New York was briefly the US capital from 1785-1790.' },
  { city: 'Tokyo', country: 'Japan', isCapital: true, realCapital: 'Tokyo', funFact: 'Tokyo means "Eastern Capital" and has been the capital since 1868.' },
  { city: 'Paris', country: 'France', isCapital: true, realCapital: 'Paris', funFact: 'Paris has been the French capital for over 1,000 years.' },
  { city: 'Mumbai', country: 'India', isCapital: false, realCapital: 'New Delhi', funFact: 'Mumbai is the financial capital but New Delhi is the political capital.' },
  { city: 'Shanghai', country: 'China', isCapital: false, realCapital: 'Beijing', funFact: 'Shanghai is the largest city by population but Beijing (meaning "Northern Capital") is the capital.' },
  { city: 'Zurich', country: 'Switzerland', isCapital: false, realCapital: 'Bern', funFact: 'Switzerland technically has no official capital — Bern is the "Federal City."' },
  { city: 'Berlin', country: 'Germany', isCapital: true, realCapital: 'Berlin', funFact: 'Berlin was divided during the Cold War and reunified as capital in 1990.' },
  { city: 'Toronto', country: 'Canada', isCapital: false, realCapital: 'Ottawa', funFact: 'Queen Victoria chose Ottawa as capital in 1857 partly because it was far from the US border.' },
  { city: 'Dubai', country: 'UAE', isCapital: false, realCapital: 'Abu Dhabi', funFact: 'Dubai is the most famous city but Abu Dhabi is the capital and largest emirate.' },
  { city: 'London', country: 'United Kingdom', isCapital: true, realCapital: 'London', funFact: 'London has been the English capital since the Roman era (Londinium).' },
  { city: 'Auckland', country: 'New Zealand', isCapital: false, realCapital: 'Wellington', funFact: 'Auckland is the largest city but Wellington became capital in 1865 for its central location.' },
  { city: 'Lagos', country: 'Nigeria', isCapital: false, realCapital: 'Abuja', funFact: 'Abuja replaced Lagos as capital in 1991 — it was purpose-built in central Nigeria.' },
  { city: 'Moscow', country: 'Russia', isCapital: true, realCapital: 'Moscow', funFact: 'Moscow briefly lost capital status to St. Petersburg (1712-1918) before regaining it.' },
  { city: 'Casablanca', country: 'Morocco', isCapital: false, realCapital: 'Rabat', funFact: 'Casablanca is the economic hub but Rabat has been the capital since 1912.' },
  { city: 'Ho Chi Minh City', country: 'Vietnam', isCapital: false, realCapital: 'Hanoi', funFact: 'Ho Chi Minh City (formerly Saigon) is the largest city but Hanoi is the capital.' },
  { city: 'Seoul', country: 'South Korea', isCapital: true, realCapital: 'Seoul', funFact: 'Seoul means "capital" in Korean and has been the capital for over 600 years.' },
  { city: 'Cairo', country: 'Egypt', isCapital: true, realCapital: 'Cairo', funFact: 'Cairo is the largest city in both Africa and the Arab world.' },
  { city: 'Marrakech', country: 'Morocco', isCapital: false, realCapital: 'Rabat', funFact: 'Marrakech was a historic capital but Rabat is the modern capital.' },
  { city: 'Geneva', country: 'Switzerland', isCapital: false, realCapital: 'Bern', funFact: 'Geneva hosts many UN agencies but is not the capital.' },
  { city: 'Yangon', country: 'Myanmar', isCapital: false, realCapital: 'Naypyidaw', funFact: 'Naypyidaw replaced Yangon as capital in 2006 — it was built in secret.' },
  { city: 'Athens', country: 'Greece', isCapital: true, realCapital: 'Athens', funFact: 'Athens has been inhabited for over 3,400 years and is considered the cradle of democracy.' },
  { city: 'Johannesburg', country: 'South Africa', isCapital: false, realCapital: 'Pretoria', funFact: 'South Africa has three capitals: Pretoria (executive), Cape Town (legislative), Bloemfontein (judicial).' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'Yes', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'B', label: 'No', color: '#ef4444', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface CapitalConfusionData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  city: string;
  country: string;
  pickMs: number;
  pickedPlayerIds: string[];
  isCapital: boolean | null;
  realCapital: string | null;
  funFact: string | null;
  yesCount: number;
  noCount: number;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class CapitalConfusionGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'capitalconfusion',
    name: 'Capital Confusion',
    description: 'Is this really the capital city?',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: CapitalPuzzle[] = [];
  private current!: CapitalPuzzle;
  private pickTimer = PICK_MS;
  private revealTimer = REVEAL_MS;
  private pickedPlayers = new Set<string>();
  private picks = new Map<string, 'yes' | 'no'>();
  private roundPhase: 'pick' | 'reveal' = 'pick';

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private makeData(): CapitalConfusionData {
    let yesCount = 0;
    let noCount = 0;
    for (const v of this.picks.values()) {
      if (v === 'yes') yesCount++;
      else noCount++;
    }
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      city: this.current.city,
      country: this.current.country,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      isCapital: this.roundPhase === 'reveal' ? this.current.isCapital : null,
      realCapital: this.roundPhase === 'reveal' && !this.current.isCapital ? this.current.realCapital : null,
      funFact: this.roundPhase === 'reveal' ? this.current.funFact : null,
      yesCount: this.roundPhase === 'reveal' ? yesCount : 0,
      noCount: this.roundPhase === 'reveal' ? noCount : 0,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    this.pickTimer = PICK_MS;
    this.revealTimer = REVEAL_MS;
    this.pickedPlayers.clear();
    this.picks.clear();
    this.roundPhase = 'pick';
    this.phase = 'active';
  }

  protected onInit(_players: Player[]): GameState {
    this.pool = this.shuffle(PUZZLES).slice(0, DEFAULT_ROUNDS);
    this.totalRounds = this.pool.length;
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.roundPhase !== 'pick') return;
    if (this.pickedPlayers.has(playerId)) return;

    this.pickedPlayers.add(playerId);
    const choice = input.control === 'A' ? 'yes' : 'no';
    this.picks.set(playerId, choice);
    const correct = this.current.isCapital ? 'yes' : 'no';
    if (choice === correct) {
      const bonus = Math.round((this.pickTimer / PICK_MS) * SPEED_BONUS_MAX);
      this.addScore(playerId, CORRECT_POINTS + bonus);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.phase === 'results') return this.buildState(this.makeData());

    if (this.roundPhase === 'pick') {
      this.pickTimer = Math.max(0, this.pickTimer - deltaMs);
      if (this.pickTimer <= 0 || this.pickedPlayers.size >= this.players.size) {
        this.roundPhase = 'reveal';
      }
    } else {
      this.revealTimer -= deltaMs;
      if (this.revealTimer <= 0) {
        this.advanceRound();
        if (this.round > this.totalRounds) {
          this.phase = 'results';
        } else {
          this.startRound();
        }
      }
    }

    return this.buildState(this.makeData());
  }
}

GameRegistry.register(
  { id: 'capitalconfusion', name: 'Capital Confusion', description: 'Is this really the capital city?', minPlayers: 1, maxPlayers: 100 },
  () => new CapitalConfusionGame(),
);
