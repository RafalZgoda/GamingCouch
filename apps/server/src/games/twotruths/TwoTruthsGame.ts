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
const VOTE_MS = 12_000;
const REVEAL_MS = 4_000;
const CORRECT_VOTE_POINTS = 200;
const FOOL_BONUS = 50; // per person who picked wrong

// ── Statement sets ──────────────────────────────────────────────────────────

interface StatementSet {
  category: string;
  statements: [string, string, string]; // index 0,1,2 — one is the lie
  lieIndex: number;
}

const SETS: StatementSet[] = [
  { category: 'Animals', statements: ['Elephants can jump', 'Dolphins sleep with one eye open', 'Octopuses have three hearts'], lieIndex: 0 },
  { category: 'Science', statements: ['Water is denser than ice', 'Light travels faster than sound', 'Humans have 206 bones'], lieIndex: 0 },
  { category: 'History', statements: ['Napoleon was extremely short for his era', 'Cleopatra was Greek, not Egyptian', 'The Great Fire of London destroyed 87 churches'], lieIndex: 0 },
  { category: 'Food', statements: ['Peanuts are tree nuts', 'Honey never spoils', 'Bananas are technically berries'], lieIndex: 0 },
  { category: 'Geography', statements: ['Alaska is the most northern, eastern, AND western US state', 'Australia is wider than the Moon', 'Africa has 55 countries'], lieIndex: 2 },
  { category: 'Space', statements: ['Venus spins in the opposite direction to most planets', 'The Sun is a yellow star', "Jupiter's Great Red Spot is shrinking"], lieIndex: 1 },
  { category: 'Sports', statements: ['Golf balls have exactly 300 dimples', 'A marathon is 26.2 miles', 'Tennis was originally played with bare hands'], lieIndex: 0 },
  { category: 'Music', statements: ['Beethoven was completely deaf when he composed his 9th Symphony', 'The Beatles were originally called The Silver Beetles', 'Mozart composed his first piece at age 2'], lieIndex: 2 },
  { category: 'Movies', statements: ['The first Star Wars movie released was Episode IV', "The word 'mafia' is never said in The Godfather", 'Toy Story was the first fully CGI animated feature film'], lieIndex: 1 },
  { category: 'Technology', statements: ['The first computer mouse was made of wood', 'Email existed before the World Wide Web', 'The first iPhone had copy and paste'], lieIndex: 2 },
  { category: 'Animals', statements: ['A shrimp has its heart in its head', 'Cows can walk upstairs but not downstairs', 'Cats have fewer toes on their back paws than front paws'], lieIndex: 1 },
  { category: 'Science', statements: ['Glass is technically a liquid', 'Hot water freezes faster than cold water', 'A teaspoon of a neutron star weighs about 6 billion tons'], lieIndex: 0 },
  { category: 'History', statements: ['Oxford University predates the Aztec Empire', 'Vikings wore horned helmets', "Cleopatra's reign was closer in time to the Moon landing than to the building of the Great Pyramid"], lieIndex: 1 },
  { category: 'Food', statements: ['Ketchup was once sold as medicine', 'Carrots were originally purple', 'Chocolate is poisonous to all mammals except humans'], lieIndex: 2 },
  { category: 'Geography', statements: ['Canada has more lakes than all other countries combined', 'Mount Everest grows about 4mm every year', 'Russia spans 12 time zones'], lieIndex: 2 },
  { category: 'Pop Culture', statements: ['Barbie has over 200 careers', "Monopoly's longest game lasted 70 days", 'LEGO is the largest tire manufacturer in the world'], lieIndex: 0 },
  { category: 'Nature', statements: ['Lightning strikes the Earth 100 times per second', 'A single tree can have 200,000 leaves', 'Raindrops are perfectly round'], lieIndex: 2 },
  { category: 'Language', statements: ['There are more English words starting with S than any other letter', "'Strengths' is the longest one-syllable word in English", "The dot over an 'i' is called a tittle"], lieIndex: 0 },
  { category: 'Human Body', statements: ['Your nose can detect over 1 trillion scents', 'Humans glow in the dark (bioluminescence)', 'Your eyes are the same size from birth'], lieIndex: 2 },
  { category: 'Technology', statements: ['The QWERTY keyboard was designed to slow typists down', 'The first domain ever registered was symbolics.com', 'WiFi stands for Wireless Fidelity'], lieIndex: 2 },
  { category: 'Animals', statements: ['Flamingos are born pink', 'A group of crows is called a murder', 'Seahorses are the only animal where males give birth'], lieIndex: 0 },
  { category: 'Science', statements: ['Saturn could float in water', 'The average human body contains enough iron to make a 3-inch nail', 'Diamonds are the hardest substance in the universe'], lieIndex: 2 },
  { category: 'History', statements: ['Ancient Romans used urine as mouthwash', 'Abraham Lincoln was a champion wrestler', 'Shakespeare invented the word "banana"'], lieIndex: 2 },
  { category: 'Sports', statements: ['Table tennis balls travel at over 100 mph in professional play', 'Volleyball was invented by a gym teacher', 'The Olympic gold medal is made entirely of gold'], lieIndex: 2 },
  { category: 'Movies', statements: ['Sean Connery wore a toupee in every James Bond film', 'The Lion King was originally called King of the Jungle', 'The first movie ever made was a horror film'], lieIndex: 2 },
];

// ── Controller layout ───────────────────────────────────────────────────────

const VOTE_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'Statement 1', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'Statement 2', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: 'Statement 3', color: '#22c55e', size: 'lg', position: 'bottom-left' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface TwoTruthsData {
  round: number;
  totalRounds: number;
  phase: 'vote' | 'reveal';
  category: string;
  statements: [string, string, string];
  voteMs: number;
  votedPlayerIds: string[];
  lieIndex: number | null;
  playerVotes: Record<string, number>;
  correctPlayerIds: string[];
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class TwoTruthsGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'twotruths',
    name: 'Two Truths One Lie',
    description: 'Which statement is the lie? Spot the fake!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'vote' | 'reveal' = 'vote';
  private voteMs = 0;
  private revealMs = 0;
  private currentSet: StatementSet | null = null;
  private playerVotes: Record<string, number> = {};
  private shuffledSets: StatementSet[] = [];
  private setIndex = 0;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = Math.min(DEFAULT_ROUNDS, SETS.length);
    this.shuffledSets = [...SETS].sort(() => Math.random() - 0.5);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: VOTE_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;
    if (this.subPhase !== 'vote') return;
    if (this.playerVotes[playerId] !== undefined) return;

    const btnMap: Record<string, number> = { A: 0, B: 1, C: 2 };
    const idx = btnMap[input.control];
    if (idx === undefined) return;

    this.playerVotes[playerId] = idx;
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'vote') {
      this.voteMs -= deltaMs;
      const allVoted = [...this.players.keys()].every((id) => this.playerVotes[id] !== undefined);
      if (this.voteMs <= 0 || allVoted) {
        this.resolveRound();
      }
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
    this.subPhase = 'vote';
    this.voteMs = VOTE_MS;
    this.playerVotes = {};
    this.phase = 'active';
    this.currentSet = this.shuffledSets[this.setIndex % this.shuffledSets.length]!;
    this.setIndex++;
  }

  private resolveRound(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;
    this.phase = 'round_end';

    const lieIdx = this.currentSet!.lieIndex;
    let wrongCount = 0;

    for (const [id, vote] of Object.entries(this.playerVotes)) {
      if (vote === lieIdx) {
        this.addScore(id, CORRECT_VOTE_POINTS);
      } else {
        wrongCount++;
      }
    }

    // Bonus: the lie "fooled" people who didn't pick it
    // (distributed as flavor — no specific recipient since it's AI-generated)
  }

  private makeData(): TwoTruthsData {
    const set = this.currentSet!;
    const lieIdx = set.lieIndex;
    const correctPlayerIds = this.subPhase === 'reveal'
      ? Object.entries(this.playerVotes).filter(([, v]) => v === lieIdx).map(([id]) => id)
      : [];

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      category: set.category,
      statements: [...set.statements],
      voteMs: Math.max(0, this.voteMs),
      votedPlayerIds: Object.keys(this.playerVotes),
      lieIndex: this.subPhase === 'reveal' ? lieIdx : null,
      playerVotes: this.subPhase === 'reveal' ? { ...this.playerVotes } : {},
      correctPlayerIds,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'twotruths',
    name: 'Two Truths One Lie',
    description: 'Which statement is the lie? Spot the fake!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new TwoTruthsGame(),
);
