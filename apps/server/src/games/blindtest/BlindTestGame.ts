import type {
  Player,
  ControllerInputEvent,
  GameState,
  GameDefinition,
  ControllerLayout,
} from '@gamingcouch/shared';
import { BaseGame } from '../BaseGame.js';
import { GameRegistry } from '../GameRegistry.js';

// ── Song bank ──────────────────────────────────────────────────────────────────

interface BlindTestSong {
  title: string;
  artist: string;
  year: number;
  genre: string;
  hint: string; // a lyric snippet or description
}

const SONGS: BlindTestSong[] = [
  // Pop
  { title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, genre: 'Rock', hint: '"Is this the real life? Is this just fantasy?"' },
  { title: 'Billie Jean', artist: 'Michael Jackson', year: 1982, genre: 'Pop', hint: '"She was more like a beauty queen from a movie scene"' },
  { title: 'Like a Prayer', artist: 'Madonna', year: 1989, genre: 'Pop', hint: '"Life is a mystery, everyone must stand alone"' },
  { title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, genre: 'Rock', hint: '"With the lights out, it\'s less dangerous"' },
  { title: 'Wannabe', artist: 'Spice Girls', year: 1996, genre: 'Pop', hint: '"If you wanna be my lover, you gotta get with my friends"' },
  { title: 'Lose Yourself', artist: 'Eminem', year: 2002, genre: 'Hip-Hop', hint: '"His palms are sweaty, knees weak, arms are heavy"' },
  { title: 'Crazy in Love', artist: 'Beyoncé', year: 2003, genre: 'R&B', hint: '"Uh oh, uh oh, uh oh, oh no no"' },
  { title: 'Mr. Brightside', artist: 'The Killers', year: 2003, genre: 'Rock', hint: '"Coming out of my cage and I\'ve been doing just fine"' },
  { title: 'Single Ladies', artist: 'Beyoncé', year: 2008, genre: 'Pop', hint: '"If you liked it then you shoulda put a ring on it"' },
  { title: 'Bad Romance', artist: 'Lady Gaga', year: 2009, genre: 'Pop', hint: '"Ra-ra-ah-ah-ah, roma-roma-ma"' },
  { title: 'Rolling in the Deep', artist: 'Adele', year: 2010, genre: 'Pop', hint: '"There\'s a fire starting in my heart"' },
  { title: 'Gangnam Style', artist: 'PSY', year: 2012, genre: 'K-Pop', hint: '"Oppan Gangnam Style"' },
  { title: 'Happy', artist: 'Pharrell Williams', year: 2013, genre: 'Pop', hint: '"Because I\'m happy, clap along if you feel like a room without a roof"' },
  { title: 'Uptown Funk', artist: 'Bruno Mars', year: 2014, genre: 'Funk', hint: '"Don\'t believe me just watch!"' },
  { title: 'Shape of You', artist: 'Ed Sheeran', year: 2017, genre: 'Pop', hint: '"I\'m in love with the shape of you"' },
  { title: 'Old Town Road', artist: 'Lil Nas X', year: 2019, genre: 'Country/Hip-Hop', hint: '"I\'m gonna take my horse to the old town road"' },
  { title: 'Blinding Lights', artist: 'The Weeknd', year: 2019, genre: 'Synth-Pop', hint: '"I said ooh, I\'m blinded by the lights"' },
  { title: 'Watermelon Sugar', artist: 'Harry Styles', year: 2019, genre: 'Pop', hint: '"Tastes like strawberries on a summer evening"' },
  { title: 'Levitating', artist: 'Dua Lipa', year: 2020, genre: 'Disco-Pop', hint: '"If you wanna run away with me, I know a galaxy"' },
  { title: 'drivers license', artist: 'Olivia Rodrigo', year: 2021, genre: 'Pop', hint: '"I got my driver\'s license last week"' },
  // Classics
  { title: 'Imagine', artist: 'John Lennon', year: 1971, genre: 'Rock', hint: '"Imagine there\'s no heaven, it\'s easy if you try"' },
  { title: 'Stayin\' Alive', artist: 'Bee Gees', year: 1977, genre: 'Disco', hint: '"Ah ha ha ha, stayin\' alive, stayin\' alive"' },
  { title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', year: 1987, genre: 'Rock', hint: '"She\'s got a smile that it seems to me"' },
  { title: 'I Will Always Love You', artist: 'Whitney Houston', year: 1992, genre: 'Pop', hint: '"And I will always love you"' },
  { title: 'No Diggity', artist: 'Blackstreet', year: 1996, genre: 'R&B', hint: '"I like the way you work it, no diggity"' },
  { title: 'Toxic', artist: 'Britney Spears', year: 2003, genre: 'Pop', hint: '"With a taste of your lips, I\'m on a ride"' },
  { title: 'Hey Ya!', artist: 'OutKast', year: 2003, genre: 'Hip-Hop', hint: '"Shake it, shake it, shake it like a Polaroid picture"' },
  { title: 'Umbrella', artist: 'Rihanna', year: 2007, genre: 'Pop', hint: '"Under my umbrella, ella, ella"' },
  { title: 'Poker Face', artist: 'Lady Gaga', year: 2008, genre: 'Pop', hint: '"Can\'t read my, can\'t read my, no he can\'t read my poker face"' },
  { title: 'Call Me Maybe', artist: 'Carly Rae Jepsen', year: 2011, genre: 'Pop', hint: '"Hey, I just met you, and this is crazy"' },
  // French
  { title: 'La Vie en Rose', artist: 'Édith Piaf', year: 1947, genre: 'Chanson', hint: '"Quand il me prend dans ses bras, il me parle tout bas"' },
  { title: 'Get Lucky', artist: 'Daft Punk', year: 2013, genre: 'Disco', hint: '"We\'re up all night to get lucky"' },
  { title: 'Alors on danse', artist: 'Stromae', year: 2009, genre: 'Electro', hint: '"Alors on danse, alors on danse, alors on danse"' },
  { title: 'Papaoutai', artist: 'Stromae', year: 2013, genre: 'Electro', hint: '"Où est ton papa? Dis-moi où est ton papa"' },
  { title: 'Djadja', artist: 'Aya Nakamura', year: 2018, genre: 'Pop', hint: '"J\'suis pas ta catin, Djadja"' },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const ANSWER_TIME_MS = 20_000;
const REVEAL_TIME_MS = 3_500;
const BASE_POINTS = 1000;
const SPEED_BONUS_MAX = 500;
const QUESTIONS_PER_GAME = 10;

// ── Controller layout ─────────────────────────────────────────────────────────

const BLINDTEST_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: 'A', color: '#ef4444', size: 'lg', position: 'top-left' },
    { type: 'button', id: 'B', label: 'B', color: '#3b82f6', size: 'lg', position: 'top-right' },
    { type: 'button', id: 'C', label: 'C', color: '#22c55e', size: 'lg', position: 'bottom-left' },
    { type: 'button', id: 'D', label: 'D', color: '#f59e0b', size: 'lg', position: 'bottom-right' },
  ],
};

// ── iTunes preview fetcher ────────────────────────────────────────────────────

async function fetchItunesPreview(title: string, artist: string): Promise<string | undefined> {
  try {
    const q = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=5`);
    if (!res.ok) return undefined;
    const json = (await res.json()) as { results?: Array<{ previewUrl?: string; trackName?: string; artistName?: string }> };
    // Prefer an exact match, fall back to first result with a preview
    const results = json.results ?? [];
    const exact = results.find(
      (r) =>
        r.trackName?.toLowerCase() === title.toLowerCase() &&
        r.artistName?.toLowerCase() === artist.toLowerCase() &&
        r.previewUrl,
    );
    const fallback = results.find((r) => r.previewUrl);
    return (exact ?? fallback)?.previewUrl;
  } catch {
    return undefined;
  }
}

// ── Public state shape ────────────────────────────────────────────────────────

export interface BlindTestData {
  hint: string;
  genre: string;
  year: number;
  options: string[]; // 4 "Artist – Title" strings
  questionIndex: number;
  totalQuestions: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  previewUrl?: string; // 30-second iTunes preview for the current song
  correctAnswer?: number; // index in options
  playerAnswers?: Record<string, number>;
}

// ── Game implementation ───────────────────────────────────────────────────────

export class BlindTestGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'blindtest',
    name: 'Blind Test',
    description: 'Guess the song from the lyric hint! Answer fast for bonus points.',
    minPlayers: 1,
    maxPlayers: 8,
  };

  private readonly configRounds: number;
  private questions: BlindTestSong[] = [];
  private currentIndex = 0;
  private timerMs = 0;
  private revealTimerMs = 0;
  private playerAnswers = new Map<string, number>();
  private answerTimestamps = new Map<string, number>();
  private questionStartMs = 0;
  private isRevealing = false;
  private currentRoundScores: Record<string, number> = {};
  private currentOptions: string[] = [];
  private currentCorrectIndex = 0;
  private currentPreviewUrl: string | undefined = undefined;

  constructor(config?: Record<string, unknown>) {
    super();
    const r = config?.rounds;
    this.configRounds = typeof r === 'number' ? Math.min(20, Math.max(3, Math.round(r))) : QUESTIONS_PER_GAME;
  }

  protected onInit(_players: Player[]): GameState {
    const shuffled = [...SONGS].sort(() => Math.random() - 0.5);
    this.questions = shuffled.slice(0, Math.min(this.configRounds, shuffled.length));
    this.totalRounds = this.questions.length;
    this.currentIndex = 0;
    this.startQuestion();
    return this.currentState();
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (this.phase !== 'active') return;
    if (this.playerAnswers.has(playerId)) return;
    if (input.action !== 'button_down') return;

    const btnMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const idx = btnMap[input.control];
    if (idx === undefined) return;

    const elapsed = Date.now() - this.questionStartMs;
    this.playerAnswers.set(playerId, idx);
    this.answerTimestamps.set(playerId, elapsed);

    if (this.playerAnswers.size >= this.players.size) {
      this.startReveal();
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.isRevealing) {
      this.revealTimerMs -= deltaMs;
      if (this.revealTimerMs <= 0) this.advanceQuestion();
    } else if (this.phase === 'active') {
      this.timerMs -= deltaMs;
      if (this.timerMs <= 0) {
        this.timerMs = 0;
        this.startReveal();
      }
    }
    return this.currentState();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private startQuestion(): void {
    this.timerMs = ANSWER_TIME_MS;
    this.revealTimerMs = 0;
    this.playerAnswers = new Map();
    this.answerTimestamps = new Map();
    this.questionStartMs = Date.now();
    this.isRevealing = false;
    this.currentRoundScores = {};
    this.currentPreviewUrl = undefined;
    this.phase = 'active';
    this.round = this.currentIndex + 1;

    // Build options: correct answer + 3 random wrong answers
    const correct = this.questions[this.currentIndex]!;

    // Fetch iTunes 30-second preview in the background (fire-and-forget)
    void fetchItunesPreview(correct.title, correct.artist).then((url) => {
      if (url) this.currentPreviewUrl = url;
    });
    const wrongPool = SONGS.filter(
      (s) => s.title !== correct.title || s.artist !== correct.artist,
    ).sort(() => Math.random() - 0.5);
    const wrongs = wrongPool.slice(0, 3);

    const all = [correct, ...wrongs].sort(() => Math.random() - 0.5);
    this.currentOptions = all.map((s) => `${s.artist} – ${s.title}`);
    this.currentCorrectIndex = all.findIndex(
      (s) => s.title === correct.title && s.artist === correct.artist,
    );
  }

  private startReveal(): void {
    this.isRevealing = true;
    this.revealTimerMs = REVEAL_TIME_MS;
    this.phase = 'round_end';
    this.currentRoundScores = {};

    for (const [playerId, answer] of this.playerAnswers) {
      if (answer === this.currentCorrectIndex) {
        const elapsed = this.answerTimestamps.get(playerId) ?? ANSWER_TIME_MS;
        const speedFraction = Math.max(0, 1 - elapsed / ANSWER_TIME_MS);
        const points = BASE_POINTS + Math.round(SPEED_BONUS_MAX * speedFraction);
        this.currentRoundScores[playerId] = points;
        this.addScore(playerId, points);
      }
    }
  }

  private advanceQuestion(): void {
    this.currentIndex++;
    if (this.currentIndex >= this.questions.length) {
      this.phase = 'results';
    } else {
      this.startQuestion();
    }
  }

  private currentState(): GameState {
    const question = this.questions[this.currentIndex];

    const data: BlindTestData = question
      ? {
          hint: question.hint,
          genre: question.genre,
          year: question.year,
          options: this.currentOptions,
          questionIndex: this.currentIndex,
          totalQuestions: this.questions.length,
          timeRemainingMs: Math.max(0, this.timerMs),
          answeredPlayerIds: [...this.playerAnswers.keys()],
          previewUrl: this.isRevealing ? undefined : this.currentPreviewUrl,
          ...(this.isRevealing && {
            correctAnswer: this.currentCorrectIndex,
            playerAnswers: Object.fromEntries(
              [...this.playerAnswers.entries()].map(([id, v]) => [id, v]),
            ),
          }),
        }
      : {
          hint: '',
          genre: '',
          year: 0,
          options: [],
          questionIndex: this.currentIndex,
          totalQuestions: this.questions.length,
          timeRemainingMs: 0,
          answeredPlayerIds: [],
        };

    return {
      ...this.buildState(data, this.currentRoundScores),
      controllerLayout: BLINDTEST_LAYOUT,
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'blindtest',
    name: 'Blind Test',
    description: 'Guess the song from the lyric hint! Answer fast for bonus points.',
    minPlayers: 1,
    maxPlayers: 8,
  },
  (config) => new BlindTestGame(config),
);
