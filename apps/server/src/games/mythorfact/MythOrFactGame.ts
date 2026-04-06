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
const PICK_MS = 8_000;
const REVEAL_MS = 3_500;
const CORRECT_POINTS = 200;
const SPEED_BONUS_MAX = 100;

// ── Content ──────────────────────────────────────────────────────────────────

interface MythFactPuzzle {
  statement: string;
  isFact: boolean;
  explanation: string;
  category: string;
}

const PUZZLES: MythFactPuzzle[] = [
  { statement: 'Goldfish have a 3-second memory.', isFact: false, explanation: 'Goldfish can remember things for months! They can be trained to push levers and navigate mazes.', category: 'Animals' },
  { statement: 'Honey never spoils.', isFact: true, explanation: 'Archaeologists found 3,000-year-old honey in Egyptian tombs that was still edible. Its low moisture and acidity prevent bacteria.', category: 'Food' },
  { statement: 'Lightning never strikes the same place twice.', isFact: false, explanation: 'The Empire State Building gets struck about 20-25 times per year. Tall structures attract lightning repeatedly.', category: 'Nature' },
  { statement: 'Octopuses have three hearts.', isFact: true, explanation: 'Two pump blood to the gills, one pumps it to the rest of the body. The main heart stops when they swim!', category: 'Animals' },
  { statement: 'We only use 10% of our brains.', isFact: false, explanation: 'Brain scans show that virtually all areas of the brain are active, just not all simultaneously.', category: 'Science' },
  { statement: 'Bananas are berries, but strawberries are not.', isFact: true, explanation: 'Botanically, berries come from a single ovary. Bananas qualify, but strawberries are "accessory fruits."', category: 'Science' },
  { statement: 'The Great Wall of China is visible from space.', isFact: false, explanation: 'It is too narrow to be seen with the naked eye from space. Astronauts have confirmed this.', category: 'Geography' },
  { statement: 'A day on Venus is longer than its year.', isFact: true, explanation: 'Venus takes 243 Earth days to rotate once but only 225 Earth days to orbit the Sun.', category: 'Space' },
  { statement: 'Bulls are angered by the color red.', isFact: false, explanation: 'Bulls are colorblind to red. They charge at the movement of the cape, not its color.', category: 'Animals' },
  { statement: 'Humans share about 60% of their DNA with bananas.', isFact: true, explanation: 'Many fundamental cell processes are shared across life. The shared genes handle basic cellular functions.', category: 'Science' },
  { statement: 'Cracking your knuckles causes arthritis.', isFact: false, explanation: 'Multiple studies found no link. The sound comes from gas bubbles popping in the joint fluid.', category: 'Health' },
  { statement: 'Scotland\'s national animal is the unicorn.', isFact: true, explanation: 'The unicorn has been a Scottish heraldic symbol since the 12th century. It appears on the Royal Coat of Arms.', category: 'Culture' },
  { statement: 'Humans swallow an average of 8 spiders per year while sleeping.', isFact: false, explanation: 'This "fact" was fabricated in a 1993 magazine column to show how easily misinformation spreads.', category: 'Health' },
  { statement: 'A group of flamingos is called a "flamboyance."', isFact: true, explanation: 'Other fun collective nouns: a parliament of owls, a murder of crows, and a crash of rhinos.', category: 'Animals' },
  { statement: 'Napoleon was unusually short.', isFact: false, explanation: 'He was about 5\'7", average for his era. The myth came from confusion between French and English inches.', category: 'History' },
  { statement: 'There are more stars in the universe than grains of sand on Earth.', isFact: true, explanation: 'Estimates: ~10^22 stars vs ~7.5×10^18 grains of sand. That\'s roughly 1,000 stars per grain!', category: 'Space' },
  { statement: 'Shaving makes hair grow back thicker.', isFact: false, explanation: 'Shaved hair has a blunt tip that feels coarser. The hair itself doesn\'t change in thickness or rate.', category: 'Health' },
  { statement: 'Wombat poop is cube-shaped.', isFact: true, explanation: 'Their intestines have varying elasticity that shapes the droppings into cubes. This prevents them from rolling away.', category: 'Animals' },
  { statement: 'Eating carrots improves your night vision.', isFact: false, explanation: 'This was British WWII propaganda to hide radar technology. Carrots have vitamin A but won\'t give you super vision.', category: 'Food' },
  { statement: 'The Eiffel Tower can grow up to 6 inches taller in summer.', isFact: true, explanation: 'Thermal expansion causes the iron to expand in heat. It can grow 15cm (about 6 inches) on hot days.', category: 'Science' },
  { statement: 'Touching a baby bird will cause its mother to reject it.', isFact: false, explanation: 'Most birds have a limited sense of smell. They won\'t abandon their young due to human scent.', category: 'Animals' },
  { statement: 'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.', isFact: true, explanation: 'Great Pyramid: ~2560 BC. Cleopatra: ~30 BC. Moon landing: 1969 AD. She was closer to 1969 by about 500 years!', category: 'History' },
  { statement: 'You lose most body heat through your head.', isFact: false, explanation: 'Your head loses heat proportional to its surface area (~10%). The myth came from a flawed 1950s military study.', category: 'Health' },
  { statement: 'An octopus has blue blood.', isFact: true, explanation: 'Their blood uses copper-based hemocyanin instead of iron-based hemoglobin, making it blue.', category: 'Animals' },
  { statement: 'Chameleons change color to match their surroundings.', isFact: false, explanation: 'They change color primarily to regulate temperature and communicate emotions, not for camouflage.', category: 'Animals' },
];

// ── Controller layout ────────────────────────────────────────────────────────

const PICK_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'Myth', color: '#ef4444', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'B', label: 'Fact', color: '#22c55e', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface MythOrFactData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  statement: string;
  category: string;
  pickMs: number;
  pickedPlayerIds: string[];
  isFact: boolean | null;
  explanation: string | null;
  mythCount: number;
  factCount: number;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class MythOrFactGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'mythorfact',
    name: 'Myth or Fact',
    description: 'Is it a myth or a real fact?',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: MythFactPuzzle[] = [];
  private current!: MythFactPuzzle;
  private pickTimer = PICK_MS;
  private revealTimer = REVEAL_MS;
  private pickedPlayers = new Set<string>();
  private picks = new Map<string, 'myth' | 'fact'>();
  private roundPhase: 'pick' | 'reveal' = 'pick';

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private makeData(): MythOrFactData {
    let mythCount = 0;
    let factCount = 0;
    for (const v of this.picks.values()) {
      if (v === 'myth') mythCount++;
      else factCount++;
    }
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      statement: this.current.statement,
      category: this.current.category,
      pickMs: this.pickTimer,
      pickedPlayerIds: [...this.pickedPlayers],
      isFact: this.roundPhase === 'reveal' ? this.current.isFact : null,
      explanation: this.roundPhase === 'reveal' ? this.current.explanation : null,
      mythCount: this.roundPhase === 'reveal' ? mythCount : 0,
      factCount: this.roundPhase === 'reveal' ? factCount : 0,
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
    const choice = input.control === 'A' ? 'myth' : 'fact';
    this.picks.set(playerId, choice);
    const correct = this.current.isFact ? 'fact' : 'myth';
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
  { id: 'mythorfact', name: 'Myth or Fact', description: 'Is it a myth or a real fact?', minPlayers: 1, maxPlayers: 100 },
  () => new MythOrFactGame(),
);
