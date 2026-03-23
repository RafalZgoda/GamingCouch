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
const STARTING_LIVES = 3;
const CONFESS_WINDOW_MS = 8_000;
const REVEAL_MS = 4_000;

// ── Statements database ──────────────────────────────────────────────────────

const STATEMENTS: string[] = [
  'eaten a whole pizza alone',
  'fallen asleep in a movie theater',
  'sent a text to the wrong person',
  'pretended to laugh at a joke I didn\'t get',
  'tripped in public and pretended nothing happened',
  'stalked an ex on social media',
  'lied about my age',
  'binge-watched an entire series in one day',
  'cried during a Disney movie',
  'danced alone in my room',
  'eaten food off the floor',
  'forgotten someone\'s name right after meeting them',
  'faked being sick to skip work or school',
  'sung in the shower',
  'talked to a pet like it was a person',
  'had a crush on a fictional character',
  'worn the same outfit two days in a row',
  'laughed so hard I cried',
  'pulled an all-nighter',
  'accidentally liked a very old photo while stalking someone',
  'pretended to be on the phone to avoid someone',
  'googled something really dumb',
  'gone to the movies alone',
  'eaten cereal for dinner',
  'accidentally called a teacher "mom" or "dad"',
  'walked into a glass door',
  're-read a text message 10 times before sending it',
  'cried because of a song',
  'worn pajamas outside the house',
  'stayed in bed all day doing nothing',
  'broken something and blamed someone else',
  'talked to myself out loud',
  'eaten ice cream straight from the tub',
  'been scared by my own reflection',
  'forgotten why I walked into a room',
  'taken a nap that lasted over 4 hours',
  'used someone else\'s Netflix account',
  'pretended to text to avoid eye contact',
  'eaten food I dropped on the ground',
  'had a full conversation with my pet',
  'rewatched a movie more than 5 times',
  'been jealous of a fictional character\'s life',
  'spent more than an hour choosing what to watch',
  'accidentally waved back at someone who wasn\'t waving at me',
  'laughed at something that happened hours ago',
  'taken a selfie and immediately deleted it',
  'used my phone in the bathroom',
  'had a dream about someone and felt weird around them after',
  'gone back inside to check if I locked the door',
  'eaten an entire bag of chips in one sitting',
];

// ── Controller layout ────────────────────────────────────────────────────────

const CONFESS_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'CONFESS', label: 'I HAVE 😳', color: '#ef4444', size: 'lg', position: 'center' },
  ],
};

const WAIT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'WAIT', label: '👀', color: '#374151', size: 'lg', position: 'center' },
  ],
};

// ── Public state shape ───────────────────────────────────────────────────────

export interface NeverHaveIEverData {
  statement: string;
  confessWindowMs: number;
  confessors: string[];
  lives: Record<string, number>;
  eliminatedPlayers: string[];
  round: number;
  totalRounds: number;
  isReveal: boolean;
}

// ── Game implementation ──────────────────────────────────────────────────────

export class NeverHaveIEverGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'neverhaveiever',
    name: 'Never Have I Ever',
    description: 'Confess your secrets or keep quiet — lose all your lives and you\'re out!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private statements: string[] = [];
  private currentStatement = '';
  private confessWindowMs = CONFESS_WINDOW_MS;
  private revealMs = 0;
  private isRevealing = false;
  private confessors = new Set<string>();
  private lives: Record<string, number> = {};
  private eliminatedPlayers = new Set<string>();
  private lastLayoutPhase: 'confess' | 'wait' | null = null;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(30, Math.max(1, Math.round(r))) : DEFAULT_ROUNDS;
  }

  // ── BaseGame hooks ──────────────────────────────────────────────────────────

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = this.configRounds;
    // Shuffle and pick statements
    this.statements = [...STATEMENTS].sort(() => Math.random() - 0.5).slice(0, this.totalRounds);
    // Initialize lives
    for (const id of this.players.keys()) {
      this.lives[id] = STARTING_LIVES;
    }
    this.startRound();
    return this.currentState(true);
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down' || input.control !== 'CONFESS') return;
    if (this.isRevealing) return;
    if (this.eliminatedPlayers.has(playerId)) return;

    this.confessors.add(playerId);
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealMs -= deltaMs;
      if (this.revealMs <= 0) this.nextRound();
      return this.currentState(false);
    }

    this.confessWindowMs -= deltaMs;
    if (this.confessWindowMs <= 0) {
      this.startReveal();
    }

    return this.currentState(false);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startRound(): void {
    this.currentStatement = this.statements[this.round - 1] ?? 'done something embarrassing';
    this.confessWindowMs = CONFESS_WINDOW_MS;
    this.revealMs = 0;
    this.isRevealing = false;
    this.confessors = new Set();
    this.phase = 'active';
    this.lastLayoutPhase = null; // Force layout update
  }

  private startReveal(): void {
    this.isRevealing = true;
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';
    this.lastLayoutPhase = null; // Force layout update

    // Confessors lose a life
    for (const id of this.confessors) {
      if (this.lives[id] !== undefined) {
        this.lives[id]--;
        if (this.lives[id] <= 0) {
          this.eliminatedPlayers.add(id);
        }
      }
    }

    // Scoring: non-confessors who are still alive get points
    const alivePlayers = [...this.players.keys()].filter((id) => !this.eliminatedPlayers.has(id));
    for (const id of alivePlayers) {
      if (!this.confessors.has(id)) {
        this.addScore(id, 100);
      }
    }

    // Check if only one player left (or none)
    if (alivePlayers.length <= 1) {
      // Give survivor bonus
      if (alivePlayers.length === 1) {
        this.addScore(alivePlayers[0]!, 500);
      }
      this.round = this.totalRounds; // Force end after reveal
    }
  }

  private nextRound(): void {
    const alivePlayers = [...this.players.keys()].filter((id) => !this.eliminatedPlayers.has(id));
    if (this.round >= this.totalRounds || alivePlayers.length <= 1) {
      this.phase = 'results';
    } else {
      this.round++;
      this.startRound();
    }
  }

  private currentState(forceLayoutUpdate: boolean): GameState {
    const targetPhase = this.isRevealing ? 'wait' as const : 'confess' as const;
    const layoutChanged = targetPhase !== this.lastLayoutPhase;
    const emitLayout = forceLayoutUpdate || layoutChanged;
    if (emitLayout) this.lastLayoutPhase = targetPhase;

    const data: NeverHaveIEverData = {
      statement: this.currentStatement,
      confessWindowMs: Math.max(0, this.confessWindowMs),
      confessors: this.isRevealing ? [...this.confessors] : [],
      lives: { ...this.lives },
      eliminatedPlayers: [...this.eliminatedPlayers],
      round: this.round,
      totalRounds: this.totalRounds,
      isReveal: this.isRevealing,
    };

    const state = this.buildState(data);
    if (emitLayout) {
      return { ...state, controllerLayout: this.isRevealing ? WAIT_LAYOUT : CONFESS_LAYOUT };
    }
    return state;
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'neverhaveiever',
    name: 'Never Have I Ever',
    description: 'Confess your secrets or keep quiet — lose all your lives and you\'re out!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  (config) => new NeverHaveIEverGame(config),
);
