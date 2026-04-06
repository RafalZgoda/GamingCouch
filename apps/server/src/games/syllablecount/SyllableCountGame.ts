import type {
  Player,
  ControllerInputEvent,
  GameState,
  GameDefinition,
  ControllerLayout,
} from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

const DEFAULT_ROUNDS = 10;
const PICK_MS = 7_000;
const REVEAL_MS = 2_000;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 150;

interface SyllablePuzzle {
  word: string;
  syllables: number;
  options: [number, number, number, number];
  breakdown: string;
  category: string;
}

const PUZZLES: SyllablePuzzle[] = [
  { word: 'CHOCOLATE', syllables: 3, options: [2, 3, 4, 5], breakdown: 'CHOC-O-LATE', category: 'Food' },
  { word: 'COMFORTABLE', syllables: 3, options: [2, 3, 4, 5], breakdown: 'COMF-TA-BLE', category: 'Words' },
  { word: 'ONOMATOPOEIA', syllables: 6, options: [4, 5, 6, 7], breakdown: 'ON-O-MAT-O-POE-IA', category: 'Words' },
  { word: 'SQUIRREL', syllables: 2, options: [1, 2, 3, 4], breakdown: 'SQUIR-REL', category: 'Animals' },
  { word: 'BEAUTIFUL', syllables: 3, options: [2, 3, 4, 5], breakdown: 'BEAU-TI-FUL', category: 'Words' },
  { word: 'HIPPOPOTAMUS', syllables: 5, options: [3, 4, 5, 6], breakdown: 'HIP-PO-POT-A-MUS', category: 'Animals' },
  { word: 'WEDNESDAY', syllables: 2, options: [2, 3, 4, 5], breakdown: 'WENS-DAY', category: 'Days' },
  { word: 'ENCYCLOPEDIA', syllables: 6, options: [4, 5, 6, 7], breakdown: 'EN-CY-CLO-PE-DI-A', category: 'Words' },
  { word: 'RHYTHM', syllables: 2, options: [1, 2, 3, 4], breakdown: 'RHY-THM', category: 'Music' },
  { word: 'VEGETABLE', syllables: 3, options: [2, 3, 4, 5], breakdown: 'VEG-TA-BLE', category: 'Food' },
  { word: 'EXTRAORDINARY', syllables: 5, options: [4, 5, 6, 7], breakdown: 'EX-TRAOR-DI-NA-RY', category: 'Words' },
  { word: 'CROCODILE', syllables: 3, options: [2, 3, 4, 5], breakdown: 'CROC-O-DILE', category: 'Animals' },
  { word: 'TEMPERATURE', syllables: 4, options: [2, 3, 4, 5], breakdown: 'TEM-PER-A-TURE', category: 'Science' },
  { word: 'BROCCOLI', syllables: 3, options: [2, 3, 4, 5], breakdown: 'BROC-CO-LI', category: 'Food' },
  { word: 'INVISIBLE', syllables: 4, options: [2, 3, 4, 5], breakdown: 'IN-VIS-I-BLE', category: 'Words' },
  { word: 'ALLIGATOR', syllables: 4, options: [2, 3, 4, 5], breakdown: 'AL-LI-GA-TOR', category: 'Animals' },
  { word: 'SUPERCALIFRAGILISTIC', syllables: 8, options: [6, 7, 8, 9], breakdown: 'SU-PER-CAL-I-FRAG-I-LIS-TIC', category: 'Movies' },
  { word: 'TRAMPOLINE', syllables: 3, options: [2, 3, 4, 5], breakdown: 'TRAM-PO-LINE', category: 'Objects' },
  { word: 'UNIVERSE', syllables: 3, options: [2, 3, 4, 5], breakdown: 'U-NI-VERSE', category: 'Space' },
  { word: 'REFRIGERATOR', syllables: 5, options: [3, 4, 5, 6], breakdown: 'RE-FRIG-ER-A-TOR', category: 'Objects' },
  { word: 'CAMERA', syllables: 3, options: [2, 3, 4, 5], breakdown: 'CAM-ER-A', category: 'Objects' },
  { word: 'ELEPHANT', syllables: 3, options: [2, 3, 4, 5], breakdown: 'EL-E-PHANT', category: 'Animals' },
  { word: 'BANANA', syllables: 3, options: [2, 3, 4, 5], breakdown: 'BA-NA-NA', category: 'Food' },
  { word: 'CATASTROPHE', syllables: 4, options: [3, 4, 5, 6], breakdown: 'CA-TAS-TRO-PHE', category: 'Words' },
  { word: 'IMAGINATION', syllables: 5, options: [3, 4, 5, 6], breakdown: 'I-MAG-I-NA-TION', category: 'Words' },
];

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

export interface SyllableCountData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  word: string;
  category: string;
  options: number[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  breakdown: string | null;
}

export class SyllableCountGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'syllablecount',
    name: 'Syllable Count',
    description: 'How many syllables in the word?',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: SyllablePuzzle[] = [];
  private current!: SyllablePuzzle;
  private correctIdx = 0;
  private pickTimer = PICK_MS;
  private revealTimer = REVEAL_MS;
  private pickedPlayers = new Set<string>();
  private roundPhase: 'pick' | 'reveal' = 'pick';

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private makeData(): SyllableCountData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      word: this.current.word,
      category: this.current.category,
      options: [...this.current.options],
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
      breakdown: this.roundPhase === 'reveal' ? this.current.breakdown : null,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    this.correctIdx = this.current.options.indexOf(this.current.syllables);
    this.pickTimer = PICK_MS;
    this.revealTimer = REVEAL_MS;
    this.pickedPlayers.clear();
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
    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === this.correctIdx) {
      const bonus = Math.round((this.pickTimer / PICK_MS) * SPEED_BONUS_MAX);
      this.addScore(playerId, CORRECT_POINTS + bonus);
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.phase === 'results') return this.buildState(this.makeData());
    if (this.roundPhase === 'pick') {
      this.pickTimer = Math.max(0, this.pickTimer - deltaMs);
      if (this.pickTimer <= 0 || this.pickedPlayers.size >= this.players.size) this.roundPhase = 'reveal';
    } else {
      this.revealTimer -= deltaMs;
      if (this.revealTimer <= 0) {
        this.advanceRound();
        if (this.round > this.totalRounds) this.phase = 'results';
        else this.startRound();
      }
    }
    return this.buildState(this.makeData());
  }
}

GameRegistry.register(
  { id: 'syllablecount', name: 'Syllable Count', description: 'How many syllables in the word?', minPlayers: 1, maxPlayers: 100 },
  () => new SyllableCountGame(),
);
