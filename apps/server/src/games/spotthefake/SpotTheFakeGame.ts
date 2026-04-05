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
const REVEAL_MS = 3_500;
const CORRECT_POINTS = 250;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface FakePuzzle {
  category: string;
  facts: [string, string, string, string]; // 3 true + 1 fake
  fakeIndex: number;
  explanation: string;
}

const PUZZLES: FakePuzzle[] = [
  { category: 'Animals', facts: ['Octopuses have 3 hearts', 'Cows can walk upstairs but not down', 'Goldfish have a 3-second memory', 'A group of flamingos is called a flamboyance'], fakeIndex: 1, explanation: 'Cows can walk both up AND down stairs — they just prefer not to.' },
  { category: 'Space', facts: ['A day on Venus is longer than its year', 'There are more stars than grains of sand on Earth', 'The Sun is made mostly of iron', 'Saturn could float in water'], fakeIndex: 2, explanation: 'The Sun is made mostly of hydrogen and helium, not iron.' },
  { category: 'History', facts: ['Cleopatra lived closer to the Moon landing than to the pyramids', 'Oxford University is older than the Aztec Empire', 'Napoleon was extremely short', 'Vikings used urine to start fires'], fakeIndex: 2, explanation: 'Napoleon was average height (5\'7"). The "short" myth came from British propaganda.' },
  { category: 'Food', facts: ['Honey never expires', 'Bananas are berries but strawberries aren\'t', 'Carrots were originally purple', 'Chocolate was invented in Switzerland'], fakeIndex: 3, explanation: 'Chocolate originated in Mesoamerica. The Swiss perfected milk chocolate later.' },
  { category: 'Science', facts: ['Hot water freezes faster than cold water', 'Glass is actually a liquid', 'Humans share 60% DNA with bananas', 'Lightning is hotter than the surface of the Sun'], fakeIndex: 1, explanation: 'Glass is an amorphous solid, not a liquid. The "flowing glass" myth is false.' },
  { category: 'Geography', facts: ['Africa is bigger than it looks on most maps', 'Russia has 11 time zones', 'Australia is wider than the Moon', 'The Sahara Desert is the largest desert'], fakeIndex: 3, explanation: 'Antarctica is the largest desert by area. Sahara is the largest hot desert.' },
  { category: 'Body', facts: ['Your stomach acid can dissolve metal', 'Humans glow in the dark (very faintly)', 'You use 10% of your brain', 'Your nose can detect 1 trillion scents'], fakeIndex: 2, explanation: 'You use virtually all of your brain. The 10% myth is completely false.' },
  { category: 'Animals', facts: ['Dolphins sleep with one eye open', 'Elephants can\'t jump', 'Dogs can only see in black and white', 'A snail can sleep for 3 years'], fakeIndex: 2, explanation: 'Dogs can see blue and yellow. They just can\'t see red and green like humans.' },
  { category: 'Tech', facts: ['The first computer bug was an actual bug', 'Email is older than the World Wide Web', 'The first iPhone had copy-paste', 'More people have phones than toilets'], fakeIndex: 2, explanation: 'The first iPhone (2007) didn\'t get copy-paste until iOS 3.0 in 2009!' },
  { category: 'Sports', facts: ['Golf balls have dimples to fly farther', 'Tennis was originally played with bare hands', 'A baseball has exactly 216 stitches', 'Olympic gold medals are mostly silver'], fakeIndex: 2, explanation: 'A baseball has 108 double stitches (216 single stitches). Tricky one!' },
  { category: 'Music', facts: ['The shortest song ever is 1.316 seconds', 'Beethoven was deaf when he wrote his 9th Symphony', 'A piano has __(88) keys because of Mozart', 'Happy Birthday was copyrighted until 2016'], fakeIndex: 2, explanation: '88 keys became standard due to piano manufacturer Steinway, not Mozart.' },
  { category: 'Movies', facts: ['The Lion King was inspired by Hamlet', 'Toy Story was the first fully CGI feature film', 'Shrek won an Oscar before Leonardo DiCaprio', 'The Titanic movie cost more than the actual Titanic'], fakeIndex: 3, explanation: 'The Titanic ship cost ~$7.5M (1912, ~$200M today). The movie cost $200M — close but a myth in adjusted dollars.' },
  { category: 'Nature', facts: ['There are trees older than the pyramids', 'Mushrooms are closer to animals than plants', 'Rain has a smell because of bacteria', 'Sunflowers always face the Sun'], fakeIndex: 3, explanation: 'Only young sunflowers track the Sun. Mature ones face east permanently.' },
  { category: 'Language', facts: ['The dot on i and j is called a tittle', 'The shortest complete sentence is "Go"', 'English has the most words of any language', 'The word "set" has the most definitions'], fakeIndex: 2, explanation: 'It\'s nearly impossible to count "most words" in any language. This is debated and unverifiable.' },
  { category: 'Ocean', facts: ['The ocean is mostly unexplored', 'There\'s a lake at the bottom of the ocean', 'Fish can drown', 'Sharks are older than trees'], fakeIndex: 2, explanation: 'Fish don\'t "drown" — they suffocate if they can\'t get enough oxygen from water.' },
  { category: 'Space', facts: ['There\'s a planet made of diamonds', 'Astronauts grow taller in space', 'You can hear explosions in space', 'One day on Mercury lasts 59 Earth days'], fakeIndex: 2, explanation: 'Sound can\'t travel in the vacuum of space. No medium = no sound waves.' },
  { category: 'History', facts: ['Ancient Romans used urine as mouthwash', 'The Great Wall is visible from space', 'Ketchup was once sold as medicine', 'There was a war between two countries lasting 335 years with zero casualties'], fakeIndex: 1, explanation: 'The Great Wall is NOT visible from space with the naked eye — it\'s too narrow.' },
  { category: 'Body', facts: ['Your bones are stronger than steel by weight', 'Humans can survive without a stomach', 'Your tongue print is unique', 'Cracking knuckles causes arthritis'], fakeIndex: 3, explanation: 'Studies show no link between knuckle cracking and arthritis.' },
  { category: 'Animals', facts: ['Crows can recognize human faces', 'Butterflies taste with their feet', 'Penguins can fly short distances', 'Koalas have fingerprints like humans'], fakeIndex: 2, explanation: 'Penguins are flightless birds. Their wings evolved into flippers for swimming.' },
  { category: 'Food', facts: ['Peanuts aren\'t actually nuts', 'Kiwi fruit was originally called Chinese Gooseberry', 'White chocolate isn\'t real chocolate', 'Apples are part of the rose family'], fakeIndex: 2, explanation: 'White chocolate IS real chocolate — it contains cocoa butter. It just lacks cocoa solids.' },
  { category: 'Geography', facts: ['Canada has more lakes than the rest of the world combined', 'Mount Everest isn\'t the tallest mountain from base to peak', 'Finland has more saunas than cars', 'Alaska is the most eastern US state'], fakeIndex: 2, explanation: 'Finland has ~3.3M saunas and ~3.4M cars — very close but cars slightly win!' },
  { category: 'Science', facts: ['Water can boil and freeze at the same time', 'Bananas are slightly radioactive', 'Nothing can travel faster than light', 'You can\'t fold paper more than 7 times'], fakeIndex: 3, explanation: 'The record for paper folding is 12 times. The "7 times" limit is a myth.' },
  { category: 'Tech', facts: ['The average smartphone has more computing power than Apollo 11', 'The first webcam watched a coffee pot', 'WiFi stands for Wireless Fidelity', 'Amazon started as a bookstore'], fakeIndex: 2, explanation: 'WiFi doesn\'t stand for anything! It\'s a trademark name, not an acronym.' },
  { category: 'Sports', facts: ['Volleyball was originally called Mintonette', 'Soccer balls have 32 panels', 'The Tour de France started as a newspaper promotion', 'Basketball hoops have always been 10 feet high'], fakeIndex: 1, explanation: 'Traditional soccer balls have 32 panels, but modern balls vary. The "fact" is outdated for current balls.' },
  { category: 'Movies', facts: ['Sean Connery wore a toupee in every Bond film', 'The word "mafia" is never said in The Godfather', 'Jaws was filmed with a real shark', 'The Matrix code is actually sushi recipes'], fakeIndex: 2, explanation: 'Jaws used 3 mechanical sharks nicknamed "Bruce." No real sharks were used.' },
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

export interface SpotTheFakeData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  category: string;
  facts: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
  explanation: string | null;
  playerPicks: Record<string, number>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class SpotTheFakeGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'spotthefake',
    name: 'Spot the Fake',
    description: 'Three facts are true, one is fake. Can you spot it?',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'pick' | 'reveal' = 'pick';
  private pickMs = 0;
  private revealMs = 0;
  private pickStartTime = 0;
  private playerPicks: Record<string, number> = {};
  private usedPuzzles: number[] = [];
  private currentPuzzle: FakePuzzle | null = null;
  private shuffledFacts: string[] = [];
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

    const fakeItem = this.currentPuzzle.facts[this.currentPuzzle.fakeIndex]!;
    this.shuffledFacts = this.shuffle([...this.currentPuzzle.facts]);
    this.correctIdx = this.shuffledFacts.indexOf(fakeItem);
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

  private makeData(): SpotTheFakeData {
    const isReveal = this.subPhase === 'reveal';
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      category: this.currentPuzzle?.category ?? '',
      facts: [...this.shuffledFacts],
      pickMs: Math.max(0, this.pickMs),
      pickedPlayerIds: Object.keys(this.playerPicks),
      correctIndex: isReveal ? this.correctIdx : null,
      explanation: isReveal ? (this.currentPuzzle?.explanation ?? null) : null,
      playerPicks: isReveal ? { ...this.playerPicks } : {},
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'spotthefake',
    name: 'Spot the Fake',
    description: 'Three facts are true, one is fake. Can you spot it?',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new SpotTheFakeGame(),
);
