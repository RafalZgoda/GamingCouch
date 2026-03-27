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

const TOTAL_ROUNDS = 4; // 4 collaborative rounds
const BEATS_PER_BAR = 8;
const PLACE_MS = 12_000;
const PLAYBACK_MS = 6_000;
const VOTE_MS = 10_000;
const REVEAL_MS = 4_000;
const PLACE_POINTS = 50;
const VOTE_RECEIVED_POINTS = 100;

const SOUNDS = ['A', 'B', 'C', 'D'] as const;
const SOUND_LABELS: Record<string, string> = {
  A: '🥁 Kick',
  B: '🪘 Snare',
  C: '🎩 Hi-hat',
  D: '🎸 Bass',
};
const SOUND_COLORS: Record<string, string> = {
  A: '#ef4444',
  B: '#3b82f6',
  C: '#22c55e',
  D: '#f59e0b',
};

// ── Controller layout ────────────────────────────────────────────────────────

const BEAT_LAYOUT: ControllerLayout = {
  controls: [
    { type: 'button', id: 'A', label: '🥁 Kick', color: '#ef4444', size: 'md', position: 'top-left' },
    { type: 'button', id: 'B', label: '🪘 Snare', color: '#3b82f6', size: 'md', position: 'top-right' },
    { type: 'button', id: 'C', label: '🎩 Hi-hat', color: '#22c55e', size: 'md', position: 'bottom-left' },
    { type: 'button', id: 'D', label: '🎸 Bass', color: '#f59e0b', size: 'md', position: 'bottom-right' },
  ],
};

// ── Public data shape ────────────────────────────────────────────────────────

export interface BeatDropData {
  round: number;
  totalRounds: number;
  phase: 'place' | 'playback' | 'vote' | 'reveal';
  beatsPerBar: number;
  // The beat grid: each beat slot has sound placements by player
  grid: Array<Array<{ playerId: string; sound: string }>>;
  // Current turn: which player is placing
  activePlayerId: string | null;
  placeMs: number;
  playbackMs: number;
  voteMs: number;
  playbackBeatIndex: number;
  // Track who placed what this round
  roundPlacements: Record<string, Array<{ beat: number; sound: string }>>;
  placedThisRound: string[];
  // Voting
  votedPlayerIds: string[];
  votes: Record<string, string>; // voterId → voted-for playerId
  voteResults: Record<string, number>; // playerId → vote count (reveal only)
  roundMVP: string | null;
  turnOrder: string[];
  turnIndex: number;
  soundLabels: Record<string, string>;
  soundColors: Record<string, string>;
}

// ── Game ─────────────────────────────────────────────────────────────────────

export class BeatDropGame extends BaseGame {
  readonly definition: GameDefinition = {
    id: 'beatdrop',
    name: 'Beat Drop',
    description: 'Build a beat together — each player adds sounds to the loop!',
    minPlayers: 2,
    maxPlayers: 8,
  };

  private subPhase: 'place' | 'playback' | 'vote' | 'reveal' = 'place';
  private grid: Array<Array<{ playerId: string; sound: string }>> = [];
  private placeMs = 0;
  private playbackMs = 0;
  private voteMs = 0;
  private revealMs = 0;
  private playbackBeatIndex = 0;
  private roundPlacements: Record<string, Array<{ beat: number; sound: string }>> = {};
  private placedThisRound: string[] = [];
  private turnOrder: string[] = [];
  private turnIndex = 0;
  private votes: Record<string, string> = {};
  private votedPlayerIds: string[] = [];
  private roundMVP: string | null = null;

  protected onInit(_players: Player[]): GameState {
    this.totalRounds = TOTAL_ROUNDS;
    // Initialize empty grid
    this.grid = Array.from({ length: BEATS_PER_BAR }, () => []);
    this.turnOrder = this.shuffle([...this.players.keys()]);
    this.startRound();
    return { ...this.buildState(this.makeData()), controllerLayout: BEAT_LAYOUT };
  }

  onInput(playerId: string, input: ControllerInputEvent): void {
    if (input.action !== 'button_down') return;

    if (this.subPhase === 'place') {
      // Only active player can place
      if (playerId !== this.turnOrder[this.turnIndex]) return;
      if (this.placedThisRound.includes(playerId)) return;

      const sound = input.control;
      if (!SOUNDS.includes(sound as typeof SOUNDS[number])) return;

      // Place sound on the next available beat slot for this player
      const placements = this.roundPlacements[playerId] ?? [];
      if (placements.length >= 2) return; // max 2 placements per turn

      // Find the beat with fewest sounds
      let minBeat = 0;
      let minCount = Infinity;
      for (let i = 0; i < BEATS_PER_BAR; i++) {
        const count = this.grid[i]!.length;
        if (count < minCount) {
          minCount = count;
          minBeat = i;
        }
      }

      // Place on that beat
      this.grid[minBeat]!.push({ playerId, sound });
      placements.push({ beat: minBeat, sound });
      this.roundPlacements[playerId] = placements;
      this.addScore(playerId, PLACE_POINTS);

      // After 2 placements, advance to next player
      if (placements.length >= 2) {
        this.placedThisRound.push(playerId);
        this.turnIndex++;
        if (this.turnIndex >= this.turnOrder.length) {
          // All players placed — go to playback
          this.subPhase = 'playback';
          this.playbackMs = PLAYBACK_MS;
          this.playbackBeatIndex = 0;
        }
      }
    } else if (this.subPhase === 'vote') {
      // Vote for best contributor (can't vote for self)
      if (this.votedPlayerIds.includes(playerId)) return;
      const idx = ['A', 'B', 'C', 'D'].indexOf(input.control);
      if (idx === -1 || idx >= this.turnOrder.length) return;
      const votedFor = this.turnOrder[idx]!;
      if (votedFor === playerId) return; // can't self-vote

      this.votes[playerId] = votedFor;
      this.votedPlayerIds.push(playerId);

      if (this.votedPlayerIds.length >= this.players.size) {
        this.resolveVotes();
      }
    }
  }

  protected onTick(deltaMs: number): GameState {
    if (this.subPhase === 'place') {
      this.placeMs -= deltaMs;
      if (this.placeMs <= 0) {
        // Force advance
        const currentPlayer = this.turnOrder[this.turnIndex];
        if (currentPlayer && !this.placedThisRound.includes(currentPlayer)) {
          this.placedThisRound.push(currentPlayer);
        }
        this.turnIndex++;
        if (this.turnIndex >= this.turnOrder.length) {
          this.subPhase = 'playback';
          this.playbackMs = PLAYBACK_MS;
          this.playbackBeatIndex = 0;
        } else {
          this.placeMs = PLACE_MS;
        }
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'playback') {
      this.playbackMs -= deltaMs;
      // Advance beat index for visual playback
      const beatDuration = PLAYBACK_MS / BEATS_PER_BAR;
      this.playbackBeatIndex = Math.min(
        BEATS_PER_BAR - 1,
        Math.floor((PLAYBACK_MS - this.playbackMs) / beatDuration),
      );
      if (this.playbackMs <= 0) {
        this.subPhase = 'vote';
        this.voteMs = VOTE_MS;
        this.votes = {};
        this.votedPlayerIds = [];
        this.phase = 'round_end';
      }
      return this.buildState(this.makeData());
    }

    if (this.subPhase === 'vote') {
      this.voteMs -= deltaMs;
      if (this.voteMs <= 0) {
        this.resolveVotes();
      }
      return this.buildState(this.makeData());
    }

    // Reveal
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
    this.subPhase = 'place';
    this.phase = 'active';
    this.roundPlacements = {};
    this.placedThisRound = [];
    this.turnIndex = 0;
    this.placeMs = PLACE_MS;
    this.roundMVP = null;
    // Rotate turn order
    this.turnOrder = this.shuffle([...this.players.keys()]);
  }

  private resolveVotes(): void {
    this.subPhase = 'reveal';
    this.revealMs = REVEAL_MS;

    // Count votes
    const voteCounts: Record<string, number> = {};
    for (const votedFor of Object.values(this.votes)) {
      voteCounts[votedFor] = (voteCounts[votedFor] ?? 0) + 1;
    }

    // Find MVP
    let maxVotes = 0;
    let mvpId: string | null = null;
    for (const [pid, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        mvpId = pid;
      }
    }
    this.roundMVP = mvpId;

    // Award points for votes received
    for (const [pid, count] of Object.entries(voteCounts)) {
      this.addScore(pid, count * VOTE_RECEIVED_POINTS);
    }
  }

  private shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private makeData(): BeatDropData {
    const isReveal = this.subPhase === 'reveal';
    const voteCounts: Record<string, number> = {};
    if (isReveal) {
      for (const votedFor of Object.values(this.votes)) {
        voteCounts[votedFor] = (voteCounts[votedFor] ?? 0) + 1;
      }
    }

    return {
      round: this.round,
      totalRounds: this.totalRounds,
      phase: this.subPhase,
      beatsPerBar: BEATS_PER_BAR,
      grid: this.grid.map((slot) => slot.map((s) => ({ ...s }))),
      activePlayerId: this.subPhase === 'place' ? (this.turnOrder[this.turnIndex] ?? null) : null,
      placeMs: Math.max(0, this.placeMs),
      playbackMs: Math.max(0, this.playbackMs),
      voteMs: Math.max(0, this.voteMs),
      playbackBeatIndex: this.playbackBeatIndex,
      roundPlacements: Object.fromEntries(
        Object.entries(this.roundPlacements).map(([k, v]) => [k, v.map((p) => ({ ...p }))]),
      ),
      placedThisRound: [...this.placedThisRound],
      votedPlayerIds: [...this.votedPlayerIds],
      votes: isReveal ? { ...this.votes } : {},
      voteResults: isReveal ? voteCounts : {},
      roundMVP: isReveal ? this.roundMVP : null,
      turnOrder: [...this.turnOrder],
      turnIndex: this.turnIndex,
      soundLabels: { ...SOUND_LABELS },
      soundColors: { ...SOUND_COLORS },
    };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

GameRegistry.register(
  {
    id: 'beatdrop',
    name: 'Beat Drop',
    description: 'Build a beat together — each player adds sounds to the loop!',
    minPlayers: 2,
    maxPlayers: 8,
  },
  () => new BeatDropGame(),
);
