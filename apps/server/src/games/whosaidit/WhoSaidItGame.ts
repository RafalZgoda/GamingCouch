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
const PICK_MS = 12_000;
const REVEAL_MS = 3_000;
const CORRECT_POINTS = 250;
const SPEED_BONUS_MAX = 150;

// ── Content ──────────────────────────────────────────────────────────────────

interface QuotePuzzle {
  quote: string;
  correct: string;
  distractors: [string, string, string];
  category: string;
}

const PUZZLES: QuotePuzzle[] = [
  { quote: 'I think, therefore I am.', correct: 'René Descartes', distractors: ['Aristotle', 'Plato', 'Socrates'], category: 'Philosophy' },
  { quote: 'To be or not to be, that is the question.', correct: 'William Shakespeare', distractors: ['Charles Dickens', 'Oscar Wilde', 'Mark Twain'], category: 'Literature' },
  { quote: 'That\'s one small step for man, one giant leap for mankind.', correct: 'Neil Armstrong', distractors: ['Buzz Aldrin', 'John Glenn', 'Yuri Gagarin'], category: 'History' },
  { quote: 'I have a dream.', correct: 'Martin Luther King Jr.', distractors: ['Nelson Mandela', 'Malcolm X', 'Barack Obama'], category: 'History' },
  { quote: 'Imagination is more important than knowledge.', correct: 'Albert Einstein', distractors: ['Isaac Newton', 'Stephen Hawking', 'Nikola Tesla'], category: 'Science' },
  { quote: 'The only thing we have to fear is fear itself.', correct: 'Franklin D. Roosevelt', distractors: ['Winston Churchill', 'Abraham Lincoln', 'John F. Kennedy'], category: 'Politics' },
  { quote: 'Float like a butterfly, sting like a bee.', correct: 'Muhammad Ali', distractors: ['Mike Tyson', 'Joe Louis', 'Sugar Ray Leonard'], category: 'Sports' },
  { quote: 'Stay hungry, stay foolish.', correct: 'Steve Jobs', distractors: ['Bill Gates', 'Elon Musk', 'Mark Zuckerberg'], category: 'Tech' },
  { quote: 'In the middle of difficulty lies opportunity.', correct: 'Albert Einstein', distractors: ['Thomas Edison', 'Benjamin Franklin', 'Nikola Tesla'], category: 'Science' },
  { quote: 'I came, I saw, I conquered.', correct: 'Julius Caesar', distractors: ['Alexander the Great', 'Napoleon', 'Augustus'], category: 'History' },
  { quote: 'Be the change you wish to see in the world.', correct: 'Mahatma Gandhi', distractors: ['Mother Teresa', 'Nelson Mandela', 'Dalai Lama'], category: 'Activism' },
  { quote: 'The future belongs to those who believe in the beauty of their dreams.', correct: 'Eleanor Roosevelt', distractors: ['Oprah Winfrey', 'Michelle Obama', 'Maya Angelou'], category: 'Politics' },
  { quote: 'Houston, we\'ve had a problem.', correct: 'Jim Lovell', distractors: ['Neil Armstrong', 'Buzz Aldrin', 'Alan Shepard'], category: 'Space' },
  { quote: 'Knowledge is power.', correct: 'Francis Bacon', distractors: ['Aristotle', 'Voltaire', 'John Locke'], category: 'Philosophy' },
  { quote: 'Life is what happens when you\'re busy making other plans.', correct: 'John Lennon', distractors: ['Paul McCartney', 'Bob Dylan', 'Mick Jagger'], category: 'Music' },
  { quote: 'Elementary, my dear Watson.', correct: 'Sherlock Holmes (Arthur Conan Doyle)', distractors: ['Agatha Christie', 'Edgar Allan Poe', 'Charles Dickens'], category: 'Literature' },
  { quote: 'May the Force be with you.', correct: 'Star Wars (George Lucas)', distractors: ['Star Trek', 'The Matrix', 'Lord of the Rings'], category: 'Movies' },
  { quote: 'I\'ll be back.', correct: 'The Terminator (Arnold Schwarzenegger)', distractors: ['Rambo', 'Die Hard', 'Predator'], category: 'Movies' },
  { quote: 'An eye for an eye makes the whole world blind.', correct: 'Mahatma Gandhi', distractors: ['Martin Luther King Jr.', 'Mother Teresa', 'Nelson Mandela'], category: 'Activism' },
  { quote: 'To infinity and beyond!', correct: 'Buzz Lightyear (Toy Story)', distractors: ['Finding Nemo', 'The Incredibles', 'Monsters Inc'], category: 'Movies' },
  { quote: 'There is no try, only do.', correct: 'Yoda (Star Wars)', distractors: ['Gandalf', 'Dumbledore', 'Morpheus'], category: 'Movies' },
  { quote: 'If you build it, they will come.', correct: 'Field of Dreams', distractors: ['The Sandlot', 'Bull Durham', 'Major League'], category: 'Movies' },
  { quote: 'That which does not kill us makes us stronger.', correct: 'Friedrich Nietzsche', distractors: ['Sigmund Freud', 'Carl Jung', 'Jean-Paul Sartre'], category: 'Philosophy' },
  { quote: 'Eureka!', correct: 'Archimedes', distractors: ['Pythagoras', 'Galileo', 'Aristotle'], category: 'Science' },
  { quote: 'Music is the universal language of mankind.', correct: 'Henry Wadsworth Longfellow', distractors: ['Mark Twain', 'Walt Whitman', 'Ralph Waldo Emerson'], category: 'Literature' },
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

export interface WhoSaidItData {
  round: number;
  totalRounds: number;
  phase: 'pick' | 'reveal';
  quote: string;
  category: string;
  options: string[];
  pickMs: number;
  pickedPlayerIds: string[];
  correctIndex: number | null;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class WhoSaidItGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'whosaidit',
    name: 'Who Said It?',
    description: 'Guess who said the famous quote!',
    minPlayers: 1,
    maxPlayers: 100,
  };

  private pool: QuotePuzzle[] = [];
  private current!: QuotePuzzle;
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

  private makeData(): WhoSaidItData {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.roundPhase,
      quote: this.current.quote,
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
  { id: 'whosaidit', name: 'Who Said It?', description: 'Guess who said the famous quote!', minPlayers: 1, maxPlayers: 100 },
  () => new WhoSaidItGame(),
);
