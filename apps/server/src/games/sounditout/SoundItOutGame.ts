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

interface PhoneticPuzzle {
  phonetic: string;
  correct: string;
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: PhoneticPuzzle[] = [
  { phonetic: 'NOM-uh-NAY-shun', correct: 'Nomination', distractors: ['Navigation', 'Notification', 'Negotiation'], category: 'Words' },
  { phonetic: 'uh-KROSS-tik', correct: 'Acoustic', distractors: ['Acrostic', 'Aquatic', 'Artistic'], category: 'Words' },
  { phonetic: 'AN-tee-DOTE', correct: 'Antidote', distractors: ['Anecdote', 'Antelope', 'Antipode'], category: 'Science' },
  { phonetic: 'kuh-MUF-lahj', correct: 'Camouflage', distractors: ['Cartilage', 'Catalogue', 'Cabbage'], category: 'Nature' },
  { phonetic: 'on-truh-pruh-NUR', correct: 'Entrepreneur', distractors: ['Entertainment', 'Environment', 'Enthusiasm'], category: 'Business' },
  { phonetic: 'hi-POP-uh-tuh-mus', correct: 'Hippopotamus', distractors: ['Hypothesis', 'Hypotenuse', 'Helicopter'], category: 'Animals' },
  { phonetic: 'NEW-moh-nee-uh', correct: 'Pneumonia', distractors: ['Paranoia', 'Ammonia', 'Insomnia'], category: 'Science' },
  { phonetic: 'SIL-oo-ET', correct: 'Silhouette', distractors: ['Cigarette', 'Cassette', 'Suffragette'], category: 'Art' },
  { phonetic: 'uh-NOM-uh-lee', correct: 'Anomaly', distractors: ['Anatomy', 'Analogy', 'Amnesty'], category: 'Words' },
  { phonetic: 'ar-kih-PEL-uh-go', correct: 'Archipelago', distractors: ['Archaeology', 'Architecture', 'Aristocracy'], category: 'Geography' },
  { phonetic: 'kuh-LID-uh-scope', correct: 'Kaleidoscope', distractors: ['Telescope', 'Stethoscope', 'Periscope'], category: 'Objects' },
  { phonetic: 'CAT-uh-struh-fee', correct: 'Catastrophe', distractors: ['Category', 'Catalogue', 'Cathedral'], category: 'Words' },
  { phonetic: 'sim-fuh-NEE', correct: 'Symphony', distractors: ['Sympathy', 'Symmetry', 'Simplicity'], category: 'Music' },
  { phonetic: 'dih-LEM-uh', correct: 'Dilemma', distractors: ['Diploma', 'Diorama', 'Dharma'], category: 'Words' },
  { phonetic: 'FIL-uh-suh-fee', correct: 'Philosophy', distractors: ['Philanthropy', 'Photography', 'Philharmonic'], category: 'Academic' },
  { phonetic: 'uh-LUM-ih-num', correct: 'Aluminum', distractors: ['Auditorium', 'Aquarium', 'Alluvium'], category: 'Science' },
  { phonetic: 'kuh-RIZ-muh', correct: 'Charisma', distractors: ['Christmas', 'Criteria', 'Chroma'], category: 'Words' },
  { phonetic: 'MEE-tee-or', correct: 'Meteor', distractors: ['Mediator', 'Monitor', 'Minotaur'], category: 'Space' },
  { phonetic: 'uh-POCK-uh-lips', correct: 'Apocalypse', distractors: ['Apostrophe', 'Apologize', 'Appaloosa'], category: 'Words' },
  { phonetic: 'PAIR-uh-shoot', correct: 'Parachute', distractors: ['Paragraph', 'Parasol', 'Paramount'], category: 'Objects' },
  { phonetic: 'kuh-MEEL-ee-un', correct: 'Chameleon', distractors: ['Champion', 'Chandelier', 'Chamomile'], category: 'Animals' },
  { phonetic: 'lab-uh-RINTH', correct: 'Labyrinth', distractors: ['Laboratory', 'Lavender', 'Liability'], category: 'Words' },
  { phonetic: 'miss-CHEE-vee-us', correct: 'Mischievous', distractors: ['Mysterious', 'Miraculous', 'Meticulous'], category: 'Words' },
  { phonetic: 'uh-RIDGE-ih-nul', correct: 'Original', distractors: ['Ornamental', 'Operational', 'Occasional'], category: 'Words' },
  { phonetic: 'sar-KAZZ-um', correct: 'Sarcasm', distractors: ['Socialism', 'Organism', 'Spasm'], category: 'Words' },
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

export interface SoundItOutData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  phonetic: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SoundItOutGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'sounditout',
    name: 'Sound It Out',
    description: 'Read the phonetics and guess the word!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: PhoneticPuzzle[] = [];
  private current!: PhoneticPuzzle;
  private options: string[] = [];
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

  private makeData(): SoundItOutData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      phonetic: this.current.phonetic,
      category: this.current.category,
      options: this.options,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      correctIndex: this.roundPhase === 'reveal' ? this.correctIdx : null,
    };
  }

  private startRound(): void {
    this.current = this.pool[this.round - 1];
    const all = [this.current.correct, ...this.current.distractors];
    this.options = this.shuffle(all);
    this.correctIdx = this.options.indexOf(this.current.correct);
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
  { id: 'sounditout', name: 'Sound It Out', description: 'Read the phonetics and guess the word!', minPlayers: 1, maxPlayers: 100 },
  () => new SoundItOutGame(),
);
