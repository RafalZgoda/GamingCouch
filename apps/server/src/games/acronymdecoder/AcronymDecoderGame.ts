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

interface AcronymPuzzle {
  acronym: string;
  correct: string;
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: AcronymPuzzle[] = [
  { acronym: 'NASA', correct: 'National Aeronautics and Space Administration', distractors: ['North American Space Agency', 'National Air and Space Association', 'New Aerospace Science Alliance'], category: 'Science' },
  { acronym: 'FIFA', correct: 'Fédération Internationale de Football Association', distractors: ['Federal International Football Agency', 'First International Football Association', 'Federation of International Field Athletics'], category: 'Sports' },
  { acronym: 'LASER', correct: 'Light Amplification by Stimulated Emission of Radiation', distractors: ['Light And Sound Energy Reflector', 'Linear Amplified Signal Emitting Ray', 'Luminous Active Source of Electronic Radiation'], category: 'Science' },
  { acronym: 'SCUBA', correct: 'Self-Contained Underwater Breathing Apparatus', distractors: ['Sub-Coastal Underwater Breathing Aid', 'Sealed Container for Underwater Body Assistance', 'Standard Compression Underwater Breathing Attachment'], category: 'Adventure' },
  { acronym: 'GIF', correct: 'Graphics Interchange Format', distractors: ['Graphical Image File', 'General Image Framework', 'Global Internet Format'], category: 'Tech' },
  { acronym: 'ASAP', correct: 'As Soon As Possible', distractors: ['Always Send A Priority', 'Act Swiftly And Promptly', 'Assigned Special Action Priority'], category: 'Business' },
  { acronym: 'RADAR', correct: 'Radio Detection And Ranging', distractors: ['Rapid Area Detection And Response', 'Remote Audio Detection And Relay', 'Radio Direction And Relay'], category: 'Military' },
  { acronym: 'WiFi', correct: 'Wireless Fidelity', distractors: ['Wide Frequency Internet', 'Wireless Field Integration', 'Web Interface for Frequencies'], category: 'Tech' },
  { acronym: 'SOS', correct: 'Save Our Souls', distractors: ['Send Our Signal', 'Standard Operating Signal', 'Secure Our Ship'], category: 'Maritime' },
  { acronym: 'ATM', correct: 'Automated Teller Machine', distractors: ['Any Time Money', 'Automatic Transaction Manager', 'Advanced Transaction Module'], category: 'Finance' },
  { acronym: 'DNA', correct: 'Deoxyribonucleic Acid', distractors: ['Digital Nucleic Array', 'Dynamic Nitrogen Acid', 'Distributed Neural Architecture'], category: 'Science' },
  { acronym: 'RSVP', correct: 'Répondez S\'il Vous Plaît', distractors: ['Reply Sent Very Promptly', 'Respond Soon Via Post', 'Required Standard Verification Process'], category: 'Etiquette' },
  { acronym: 'FAQ', correct: 'Frequently Asked Questions', distractors: ['Fast Answer Query', 'First Available Question', 'Forum And Queries'], category: 'Tech' },
  { acronym: 'DIY', correct: 'Do It Yourself', distractors: ['Design It Yourself', 'Draft In Yellow', 'Direct Instruction for Youth'], category: 'Lifestyle' },
  { acronym: 'CEO', correct: 'Chief Executive Officer', distractors: ['Central Enterprise Operator', 'Corporate Executive Organizer', 'Company Executive Official'], category: 'Business' },
  { acronym: 'PIN', correct: 'Personal Identification Number', distractors: ['Private Internet Number', 'Protected Input Network', 'Permanent Identity Number'], category: 'Finance' },
  { acronym: 'JPEG', correct: 'Joint Photographic Experts Group', distractors: ['Just Picture Easy Graphics', 'Java Photo Encoding Grid', 'Joint Pixel Enhancement Generator'], category: 'Tech' },
  { acronym: 'VIP', correct: 'Very Important Person', distractors: ['Verified Identity Pass', 'Virtual Invitation Program', 'Valued Internal Priority'], category: 'Lifestyle' },
  { acronym: 'LOL', correct: 'Laughing Out Loud', distractors: ['Lots Of Love', 'Living On Laughs', 'Level Of Laughter'], category: 'Internet' },
  { acronym: 'ETA', correct: 'Estimated Time of Arrival', distractors: ['Expected Travel Announcement', 'Early Transit Alert', 'Estimated Transit Appointment'], category: 'Travel' },
  { acronym: 'SWAT', correct: 'Special Weapons And Tactics', distractors: ['Strategic Warfare And Training', 'Specialized Wing Attack Team', 'Swift Weapons And Technology'], category: 'Military' },
  { acronym: 'HTML', correct: 'HyperText Markup Language', distractors: ['High Tech Modern Language', 'Home Tool for Managing Links', 'Hyperlink Text Management Layer'], category: 'Tech' },
  { acronym: 'UFO', correct: 'Unidentified Flying Object', distractors: ['Unknown Foreign Origin', 'Universal Flight Observation', 'Uncharted Flying Orbit'], category: 'Science' },
  { acronym: 'YOLO', correct: 'You Only Live Once', distractors: ['Young Ones Love Outdoors', 'Your Original Life Objective', 'Youth On Liberty Outing'], category: 'Internet' },
  { acronym: 'BRB', correct: 'Be Right Back', distractors: ['Busy Right Below', 'Brief Return Break', 'Begin Return Broadcast'], category: 'Internet' },
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

export interface AcronymDecoderData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  acronym: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class AcronymDecoderGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'acronymdecoder',
    name: 'Acronym Decoder',
    description: 'What does it stand for? Decode the acronym!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: AcronymPuzzle | null = null;
  private shuffledOptions: string[] = [];
  private correctIdx = -1;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, PUZZLES.length);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: PICK_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'pick') return;
    if (this.playerPicks[playerId] !== undefined) return;

    const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
    if (idx === -1) return;

    this.playerPicks[playerId] = idx;

    if (idx === this.correctIdx) {
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

    const allOptions = [this.currentPuzzle.correct, ...this.currentPuzzle.distractors];
    this.shuffledOptions = this.shuffle(allOptions);
    this.correctIdx = this.shuffledOptions.indexOf(this.currentPuzzle.correct);
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

  private makeData(): AcronymDecoderData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      acronym: this.currentPuzzle?.acronym ?? '',
      category: this.currentPuzzle?.category ?? '',
      options: [...this.shuffledOptions],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'acronymdecoder',
    name: 'Acronym Decoder',
    description: 'What does it stand for? Decode the acronym!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new AcronymDecoderGame(),
);
