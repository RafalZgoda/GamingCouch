'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  ServerToClientMessage,
  ClientToServerMessage,
  Player,
  GameState,
  AVATAR_COLOR_HEX,
  MIN_PLAYERS_TO_START,
} from '@gamingcouch/shared';
import { getWsUrl } from '@/lib/wsUrl';
import { playPlayerJoin, playPlayerLeave, playGameStart, playGameOver, playRoundEnd, playCountdownBeep } from '@/lib/sounds';

// ── Types ──────────────────────────────────────────────────────────────────────

type HostStatus = 'connecting' | 'waiting' | 'ready' | 'playing' | 'finished' | 'error';

interface Toast {
  id: number;
  message: string;
  color: string;
}

// Trivia-specific data shape matching TriviaData on the server
interface TriviaData {
  question: string;
  options: string[];
  questionIndex: number;
  totalQuestions: number;
  timeRemainingMs: number;
  difficulty: 'easy' | 'medium' | 'hard';
  answeredPlayerIds: string[];
  correctAnswer?: number;
  playerAnswers?: Record<string, number>;
}

// Reaction game data shape
interface ReactionData {
  signal: 'waiting' | 'go';
  waitRemainingMs: number;
  goRemainingMs: number;
  round: number;
  totalRounds: number;
  playerTaps: Record<string, number>;
  earlyTappers: string[];
}

// Color Match data shape
interface ColorMatchData {
  color: string;
  colorHex: string;
  round: number;
  totalRounds: number;
  timeRemainingMs: number;
  playerTimes?: Record<string, number>;
  wrongTappers?: string[];
  missedPlayers?: string[];
}

// Math Race data shape
interface MathRaceData {
  equation: string;
  options: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  questionIndex: number;
  totalQuestions: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  correctAnswer?: number;
  playerAnswers?: Record<string, number>;
}

// Word Scramble data shape
interface WordScrambleData {
  scrambled: string;
  options: string[];
  correctIndex: number;
  round: number;
  totalRounds: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  playerAnswers?: Record<string, number>;
}

// Hot Potato data shape
interface HotPotatoData {
  holderPlayerId: string;
  round: number;
  totalRounds: number;
  ticking: boolean;
  explodedPlayerId?: string;
}

// True or False data shape
interface TrueFalseData {
  statement: string;
  category: string;
  questionIndex: number;
  totalQuestions: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  correctAnswer?: boolean;
  playerAnswers?: Record<string, boolean>;
}

// Tap Frenzy data shape
interface TapFrenzyData {
  tappingPhase: 'countdown' | 'tapping' | 'reveal';
  countdownMs: number;
  tappingMs: number;
  playerTaps: Record<string, number>;
  round: number;
  totalRounds: number;
}

// Blind Test data shape
interface BlindTestData {
  hint: string;
  genre: string;
  year: number;
  options: string[];
  questionIndex: number;
  totalQuestions: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  previewUrl?: string;
  correctAnswer?: number;
  playerAnswers?: Record<string, number>;
}

// Dodge Master data shape
interface DodgeMasterData {
  arena: number;
  playerRadius: number;
  obstacleRadius: number;
  players: Record<string, { x: number; y: number; alive: boolean }>;
  obstacles: Array<{ x: number; y: number; radius: number }>;
  timeRemainingMs: number;
  round: number;
  totalRounds: number;
}

// Swipe Duel data shape
interface SwipeDuelData {
  roundPhase: 'countdown' | 'go' | 'reveal';
  targetDirection: 'up' | 'down' | 'left' | 'right';
  countdownMs: number;
  responseMs: number;
  correctPlayers: string[];
  wrongPlayers: string[];
  missedPlayers: string[];
  round: number;
  totalRounds: number;
}

// Direction Dash data shape
interface DirectionDashData {
  roundPhase: 'showing' | 'input' | 'reveal';
  sequence: string[];
  sequenceLength: number;
  showTimeMs: number;
  inputTimeMs: number;
  playerProgress: Record<string, number>;
  playerResults: Record<string, { correct: number; total: number; failed: boolean }>;
  round: number;
  totalRounds: number;
}

// Color Flash data shape
interface ColorFlashData {
  flashColor: string | null;
  flashColorName: string | null;
  flashIndex: number;
  flashesTotal: number;
  round: number;
  totalRounds: number;
  playerColors: Record<string, { hex: string; name: string }>;
  tappedPlayers: string[];
  isReveal: boolean;
  revealResults: Array<{
    playerId: string;
    correct: number;
    wrong: number;
    missed: number;
  }>;
}

// Would You Rather data shape
interface WouldYouRatherData {
  optionA: string;
  optionB: string;
  voteWindowMs: number;
  votedPlayerIds: string[];
  round: number;
  totalRounds: number;
  isReveal: boolean;
  revealVotesA: string[];
  revealVotesB: string[];
  percentA: number;
  percentB: number;
}

// Auction House data shape
interface AuctionHouseData {
  itemName: string;
  itemHint: string;
  round: number;
  totalRounds: number;
  bidWindowMs: number;
  bidderIds: string[];
  isReveal: boolean;
  itemValue: number | null;
  bids: Record<string, number>;
  winnerId: string | null;
  winnerBid: number | null;
  tiedBids: number[];
  profit: number | null;
}

// Category Sprint data shape
interface CategorySprintData {
  category: string;
  options: string[];
  round: number;
  totalRounds: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  frozenPlayers: Record<string, number>;
  correctAnswer?: number[];
  playerAnswers?: Record<string, number>;
}

// Debate Club data shape
interface DebateClubData {
  statement: string;
  round: number;
  totalRounds: number;
  phase: 'vote1' | 'reveal1' | 'revote' | 'reveal_final';
  voteWindowMs: number;
  votedPlayerIds: string[];
  agreePlayerIds: string[];
  disagreePlayerIds: string[];
  agreePercent: number;
  disagreePercent: number;
  minoritySide: 'agree' | 'disagree' | null;
  revoteAgreeIds: string[];
  revoteDisagreeIds: string[];
  mindsChanged: number;
  revoteAgreePercent: number;
  revoteDisagreePercent: number;
}

// Simon Says data shape
interface SimonSaysData {
  sequenceLength: number;
  maxSequence: number;
  showPhase: boolean;
  highlightIndex: number;
  highlightButton: string | null;
  inputPhase: boolean;
  inputTimeMs: number;
  playerProgress: Record<string, number>;
  alivePlayers: string[];
  eliminatedPlayers: string[];
  isReveal: boolean;
  revealMs: number;
  roundSurvivors: string[];
}

// Tug of War data shape
interface TugOfWarData {
  ropePosition: number;
  teamA: string[];
  teamB: string[];
  teamATaps: number;
  teamBTaps: number;
  timeRemainingMs: number;
  round: number;
  totalRounds: number;
  isReveal: boolean;
  roundWinner: 'A' | 'B' | 'draw' | null;
  teamAWins: number;
  teamBWins: number;
}

// Emoji Decoder data shape
interface EmojiDecoderData {
  emojis: string;
  options: string[];
  round: number;
  totalRounds: number;
  timeRemainingMs: number;
  answeredPlayerIds: string[];
  correctAnswer?: number;
  playerAnswers?: Record<string, number>;
}

// Retro Pong data shape
interface RetroPongData {
  arena: number;
  ball: { x: number; y: number; radius: number } | null;
  paddles: Record<string, { side: number; pos: number; length: number; offset: number; thickness: number; eliminated: boolean }>;
  roundScoresNeeded: number;
  roundPoints: Record<string, number>;
  round: number;
  totalRounds: number;
  isServing: boolean;
  serveMs: number;
  isRoundEnd: boolean;
  roundEndMs: number;
  lastScorer: string | null;
  eliminatedThisRound: string[];
}

// Lucky Number data shape
interface LuckyNumberData {
  pickWindowMs: number;
  pickedPlayerIds: string[];
  round: number;
  totalRounds: number;
  isSpinning: boolean;
  spinMs: number;
  winningChoice: string | null;
  winningNumber: number | null;
  playerPicks: Record<string, string>;
  winners: string[];
  streaks: Record<string, number>;
}

// Never Have I Ever data shape
interface NeverHaveIEverData {
  statement: string;
  confessWindowMs: number;
  confessors: string[];
  lives: Record<string, number>;
  eliminatedPlayers: string[];
  round: number;
  totalRounds: number;
  isReveal: boolean;
}

// Rock Paper Scissors data shape
interface RPSData {
  round: number;
  totalRounds: number;
  pickWindowMs: number;
  pickedPlayerIds: string[];
  isReveal: boolean;
  choices: Record<string, 'rock' | 'paper' | 'scissors'>;
  results: Record<string, { wins: number; losses: number; draws: number }>;
}

// Bomb Defuse data shape
interface BombDefuseData {
  round: number;
  totalRounds: number;
  pickWindowMs: number;
  maxPickMs: number;
  cutPlayerIds: string[];
  isReveal: boolean;
  correctWire: 'red' | 'blue' | 'green' | 'yellow' | null;
  playerCuts: Record<string, 'red' | 'blue' | 'green' | 'yellow'>;
  survivors: string[];
  exploded: string[];
  streaks: Record<string, number>;
}

// Whack-a-Mole data shape
interface WhackAMoleData {
  round: number;
  totalRounds: number;
  activeZone: 'A' | 'B' | 'C' | 'D' | null;
  isDecoy: boolean;
  targetIndex: number;
  totalTargets: number;
  showTimeMs: number;
  isRoundPause: boolean;
  roundPauseMs: number;
  roundHits: Record<string, number>;
  roundMisses: Record<string, number>;
}

// Floor is Lava data shape
interface FloorIsLavaData {
  round: number;
  totalRounds: number;
  safePlatform: 'A' | 'B' | 'C' | 'D' | null;
  isFlashing: boolean;
  flashMs: number;
  jumpWindowMs: number;
  maxJumpMs: number;
  jumpedPlayerIds: string[];
  isReveal: boolean;
  playerJumps: Record<string, 'A' | 'B' | 'C' | 'D'>;
  survivors: string[];
  fallen: string[];
  lives: Record<string, number>;
  eliminatedPlayers: string[];
}

// Button Mash Race data shape
interface ButtonMashData {
  round: number;
  totalRounds: number;
  activeButton: 'A' | 'B' | 'C' | 'D';
  raceTimeMs: number;
  positions: Record<string, number>;
  isRacing: boolean;
  isRoundEnd: boolean;
  roundEndMs: number;
  roundWinner: string | null;
  finishedPlayers: string[];
}

// Dodge Ball data shape
interface DodgeBallData {
  round: number;
  totalRounds: number;
  hazardDirection: 'up' | 'down' | 'left' | 'right' | null;
  isWarning: boolean;
  warnMs: number;
  reactMs: number;
  maxReactMs: number;
  isReveal: boolean;
  playerDodges: Record<string, 'up' | 'down' | 'left' | 'right'>;
  dodgedPlayerIds: string[];
  survivors: string[];
  hitPlayers: string[];
  lives: Record<string, number>;
  eliminatedPlayers: string[];
}

// Price is Right data shape
interface PriceIsRightData {
  round: number;
  totalRounds: number;
  prompt: string;
  category: string;
  unit: string;
  ranges: string[];
  guessWindowMs: number;
  guessedPlayerIds: string[];
  isReveal: boolean;
  correctIndex: number | null;
  closeIndex: number | null;
  answer: number | null;
  playerGuesses: Record<string, number>;
}

// Spin the Wheel data shape
interface SpinTheWheelData {
  round: number;
  totalRounds: number;
  phase: 'spinning' | 'challenge' | 'voting' | 'reveal';
  spinMs: number;
  challengeMs: number;
  voteMs: number;
  targetPlayerId: string | null;
  challenge: string | null;
  challengeType: string | null;
  votedPlayerIds: string[];
  yesVotes: number;
  noVotes: number;
  passed: boolean;
  votes: Record<string, boolean>;
}

const GAME_LABELS: Record<string, string> = {
  trivia: '🧠 Trivia',
  reaction: '⚡ Reaction',
  colormatch: '🎨 Color Match',
  mathrace: '🔢 Math Race',
  wordscramble: '🔤 Word Scramble',
  hotpotato: '🥔 Hot Potato',
  trueorfalse: '✅ True or False',
  tapfrenzy: '👇 Tap Frenzy',
  blindtest: '🎵 Blind Test',
  dodgemaster: '🕹️ Dodge Master',
  swipeduel: '👆 Swipe Duel',
  directiondash: '🎯 Direction Dash',
  neverhaveiever: '🙈 Never Have I Ever',
  colorflash: '🔴 Color Flash',
  wouldyourather: '🤔 Would You Rather',
  luckynumber: '🎰 Lucky Number',
  retropong: '🏓 Retro Pong',
  emojidecoder: '😎 Emoji Decoder',
  tugofwar: '🪢 Tug of War',
  simonsays: '🧠 Simon Says',
  debateclub: '🎤 Debate Club',
  categorysprint: '📋 Category Sprint',
  auctionhouse: '🔨 Auction House',
  rps: '✊ Rock Paper Scissors',
  bombdefuse: '💣 Bomb Defuse',
  whackamole: '🔨 Whack-a-Mole',
  floorislava: '🌋 Floor is Lava',
  buttonmash: '🏃 Button Mash Race',
  dodgeball: '🏐 Dodge Ball',
  priceisright: '💰 Price is Right',
  spinthewheel: '🎡 Spin the Wheel',
};

// ── QR Code ───────────────────────────────────────────────────────────────────

function QRCodeCanvas({ text, size = 180 }: { text: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, text, {
      width: size,
      margin: 2,
      color: { dark: '#0f0f1a', light: '#f0f0ff' },
    }).catch(console.error);
  }, [text, size]);

  return <canvas ref={canvasRef} style={{ borderRadius: 8, display: 'block' }} />;
}

// ── Toast Notifications ────────────────────────────────────────────────────────

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 200 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '0.7rem 1.25rem',
            borderRadius: 12,
            background: 'rgba(15,15,30,0.85)',
            backdropFilter: 'blur(16px)',
            borderLeft: `3px solid ${t.color}`,
            border: `1px solid rgba(255,255,255,0.06)`,
            color: '#eeeef8',
            fontSize: '0.9rem',
            fontWeight: 600,
            minWidth: 220,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)`,
            animation: 'slideIn 0.25s ease-out',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Trivia Host View ──────────────────────────────────────────────────────────

const ANSWER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

function TriviaHostView({
  state,
  players,
}: {
  state: GameState;
  players: Player[];
}) {
  const data = state.data as TriviaData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isReveal = state.phase === 'round_end';
  const timerFraction = data.timeRemainingMs / 20_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* ── Main area ── */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', gap: '1.5rem', overflow: 'hidden' }}>

        {/* Progress + timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
            Question {data.questionIndex + 1} / {data.totalQuestions}
          </span>
          {data.difficulty && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
              padding: '0.2rem 0.6rem', borderRadius: '9999px',
              background: data.difficulty === 'easy' ? '#14532d' : data.difficulty === 'hard' ? '#7f1d1d' : '#78350f',
              color: data.difficulty === 'easy' ? '#22c55e' : data.difficulty === 'hard' ? '#f87171' : '#f59e0b',
            }}>
              {data.difficulty}
            </span>
          )}
          <div style={{ flex: 1, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(data.questionIndex / data.totalQuestions) * 100}%`,
              background: '#6366f1',
              borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>
          {!isReveal && (
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: timerColor, minWidth: 48, textAlign: 'right' }}>
              {Math.ceil(data.timeRemainingMs / 1000)}s
            </span>
          )}
        </div>

        {/* Timer bar */}
        {!isReveal && (
          <div style={{ height: 6, background: '#1f2937', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{
              height: '100%',
              width: `${timerFraction * 100}%`,
              background: timerColor,
              borderRadius: 4,
              transition: 'width 0.1s linear, background 0.3s',
            }} />
          </div>
        )}

        {/* Question + answers */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2rem',
        }}>
          <h1 style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2.75rem)',
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.3,
            color: '#f0f0ff',
            maxWidth: 900,
          }}>
            {data.question}
          </h1>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            width: '100%',
            maxWidth: 900,
          }}>
            {data.options.map((option, i) => {
              const isCorrect = isReveal && data.correctAnswer === i;
              const wasChosen = isReveal && Object.values(data.playerAnswers ?? {}).includes(i);
              const color = ANSWER_COLORS[i]!;

              let bg = '#1a1a2e';
              let border = `2px solid ${color}44`;
              let opacity = 1;

              if (isReveal) {
                if (isCorrect) {
                  bg = `${color}33`;
                  border = `2px solid ${color}`;
                } else if (wasChosen) {
                  opacity = 0.5;
                } else {
                  opacity = 0.3;
                }
              }

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1.25rem 1.5rem',
                    background: bg,
                    border,
                    borderRadius: 12,
                    opacity,
                    transition: 'all 0.3s',
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}>
                    {ANSWER_LABELS[i]}
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{option}</span>
                  {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '1.5rem' }}>✓</span>}
                </div>
              );
            })}
          </div>

          {!isReveal && (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {data.answeredPlayerIds.length} / {nonHostPlayers.length} answered
            </p>
          )}
        </div>

        {/* Round score banners during reveal */}
        {isReveal && state.round.roundScores && Object.keys(state.round.roundScores).length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            {Object.entries(state.round.roundScores).map(([playerId, pts]) => {
              const player = nonHostPlayers.find((p) => p.id === playerId);
              if (!player || !pts) return null;
              return (
                <div key={playerId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: '#14532d',
                  border: '1px solid #22c55e',
                  borderRadius: 8,
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_COLOR_HEX[player.avatarColor] }} />
                  <span style={{ fontWeight: 700 }}>{player.name}</span>
                  <span style={{ color: '#22c55e', fontWeight: 900 }}>+{pts}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Leaderboard sidebar ── */}
      <div style={{
        background: '#0d0d1f',
        borderLeft: '1px solid #1f1f35',
        padding: '1.5rem 1rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Leaderboard
        </p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.625rem 0.75rem',
            background: i === 0 ? '#1a1036' : '#131326',
            borderRadius: 8,
            border: i === 0 ? '1px solid #7c3aed44' : '1px solid transparent',
          }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
            </span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>
              {state.scores[p.id] ?? 0}
            </span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p style={{ color: '#374151', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>No players yet</p>
        )}
      </div>
    </div>
  );
}

// ── Reaction Host View ────────────────────────────────────────────────────────

function ReactionHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as ReactionData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isReveal = state.phase === 'round_end';
  const isGo = data.signal === 'go' && !isReveal;

  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* ── Main area ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>

        {/* Round counter */}
        <p style={{ color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.875rem' }}>
          Round {data.round} / {data.totalRounds}
        </p>

        {/* Signal circle */}
        <div style={{
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: isReveal ? '#374151' : isGo ? '#22c55e' : '#ef4444',
          boxShadow: isReveal ? 'none' : isGo
            ? '0 0 80px #22c55e88'
            : '0 0 40px #ef444466',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '4rem',
          fontWeight: 900,
          transition: 'background 0.15s, box-shadow 0.15s',
        }}>
          {isReveal ? '✓' : isGo ? 'GO!' : '...'}
        </div>

        {/* Timer bar during go phase */}
        {isGo && (
          <div style={{ width: '100%', maxWidth: 400, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(data.goRemainingMs / 2500) * 100}%`,
              background: '#22c55e',
              borderRadius: 4,
              transition: 'width 0.1s linear',
            }} />
          </div>
        )}

        {/* Tap results during reveal */}
        {isReveal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 400 }}>
            {nonHostPlayers
              .sort((a, b) => {
                const ta = data.playerTaps[a.id];
                const tb = data.playerTaps[b.id];
                if (ta !== undefined && tb !== undefined) return ta - tb;
                if (ta !== undefined) return -1;
                if (tb !== undefined) return 1;
                return 0;
              })
              .map((p) => {
                const ms = data.playerTaps[p.id];
                const early = data.earlyTappers.includes(p.id);
                const pts = state.round.roundScores[p.id];
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem 1rem',
                    background: early ? '#2d1515' : ms !== undefined ? '#14532d' : '#1f2937',
                    borderRadius: 8,
                    border: `1px solid ${early ? '#7f1d1d' : ms !== undefined ? '#166534' : '#374151'}`,
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                    {early && <span style={{ color: '#f87171', fontSize: '0.875rem' }}>Early! −100</span>}
                    {ms !== undefined && !early && (
                      <>
                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{ms}ms</span>
                        {pts && <span style={{ color: '#22c55e', fontWeight: 900 }}>+{pts}</span>}
                      </>
                    )}
                    {ms === undefined && !early && <span style={{ color: '#4b5563', fontSize: '0.875rem' }}>No tap</span>}
                  </div>
                );
              })
            }
          </div>
        )}
      </div>

      {/* ── Leaderboard sidebar ── */}
      <div style={{
        background: '#0d0d1f', borderLeft: '1px solid #1f1f35',
        padding: '1.5rem 1rem', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Leaderboard
        </p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.625rem 0.75rem',
            background: i === 0 ? '#1a1036' : '#131326',
            borderRadius: 8,
            border: i === 0 ? '1px solid #7c3aed44' : '1px solid transparent',
          }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
            </span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Color Match Host View ─────────────────────────────────────────────────────

function ColorMatchHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as ColorMatchData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isReveal = state.phase === 'round_end';
  const timerFraction = data.timeRemainingMs / 2500;
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
        <p style={{ color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.875rem' }}>
          Round {data.round} / {data.totalRounds}
        </p>

        {/* Color circle */}
        <div style={{
          width: 280, height: 280, borderRadius: '50%',
          background: isReveal ? '#374151' : data.colorHex,
          boxShadow: isReveal ? 'none' : `0 0 80px ${data.colorHex}88`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 900,
          transition: 'background 0.2s, box-shadow 0.2s',
        }}>
          {isReveal ? '✓' : data.color.toUpperCase()}
        </div>

        {/* Timer bar */}
        {!isReveal && (
          <div style={{ width: '100%', maxWidth: 400, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${timerFraction * 100}%`,
              background: data.colorHex, borderRadius: 4,
              transition: 'width 0.1s linear',
            }} />
          </div>
        )}

        {/* Results */}
        {isReveal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 400 }}>
            {nonHostPlayers
              .sort((a, b) => {
                const ta = data.playerTimes?.[a.id];
                const tb = data.playerTimes?.[b.id];
                if (ta !== undefined && tb !== undefined) return ta - tb;
                if (ta !== undefined) return -1;
                if (tb !== undefined) return 1;
                return 0;
              })
              .map((p) => {
                const ms = data.playerTimes?.[p.id];
                const wrong = data.wrongTappers?.includes(p.id);
                const missed = data.missedPlayers?.includes(p.id);
                const pts = state.round.roundScores[p.id];
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.5rem 1rem',
                    background: wrong ? '#2d1515' : missed ? '#1f2937' : '#14532d',
                    borderRadius: 8,
                    border: `1px solid ${wrong ? '#7f1d1d' : missed ? '#374151' : '#166534'}`,
                  }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                    {wrong && <span style={{ color: '#f87171', fontSize: '0.875rem' }}>Wrong! −{100}</span>}
                    {missed && <span style={{ color: '#4b5563', fontSize: '0.875rem' }}>No tap</span>}
                    {ms !== undefined && !wrong && (
                      <>
                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{ms}ms</span>
                        {pts && <span style={{ color: '#22c55e', fontWeight: 900 }}>+{pts}</span>}
                      </>
                    )}
                  </div>
                );
              })
            }
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{ background: '#0d0d1f', borderLeft: '1px solid #1f1f35', padding: '1.5rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leaderboard</p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: i === 0 ? '#1a1036' : '#131326', borderRadius: 8, border: i === 0 ? '1px solid #7c3aed44' : '1px solid transparent' }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Math Race Host View ───────────────────────────────────────────────────────

const MR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const MR_LABELS = ['A', 'B', 'C', 'D'];

function MathRaceHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as MathRaceData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isReveal = state.phase === 'round_end';
  const timerFraction = data.timeRemainingMs / 10_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', gap: '1.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
            Question {data.questionIndex + 1} / {data.totalQuestions}
          </span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
            padding: '0.2rem 0.6rem', borderRadius: '9999px',
            background: data.difficulty === 'hard' ? '#7f1d1d' : data.difficulty === 'medium' ? '#78350f' : '#14532d',
            color: data.difficulty === 'hard' ? '#f87171' : data.difficulty === 'medium' ? '#f59e0b' : '#22c55e',
          }}>
            {data.difficulty}
          </span>
          <div style={{ flex: 1 }} />
          {!isReveal && <span style={{ fontSize: '1.5rem', fontWeight: 900, color: timerColor }}>{Math.ceil(data.timeRemainingMs / 1000)}s</span>}
        </div>

        {!isReveal && (
          <div style={{ height: 6, background: '#1f2937', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ height: '100%', width: `${timerFraction * 100}%`, background: timerColor, borderRadius: 4, transition: 'width 0.1s linear, background 0.3s' }} />
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, textAlign: 'center', color: '#f0f0ff' }}>
            {data.equation}
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: 700 }}>
            {data.options.map((opt, i) => {
              const isCorrect = isReveal && data.correctAnswer === i;
              const wasChosen = isReveal && Object.values(data.playerAnswers ?? {}).includes(i);
              const color = MR_COLORS[i]!;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1.25rem 1.5rem',
                  background: isReveal ? (isCorrect ? `${color}33` : '#1a1a2e') : '#1a1a2e',
                  border: `2px solid ${isReveal ? (isCorrect ? color : (wasChosen ? color + '44' : color + '22')) : color + '44'}`,
                  borderRadius: 12,
                  opacity: isReveal && !isCorrect && !wasChosen ? 0.4 : 1,
                  transition: 'all 0.3s',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem', flexShrink: 0 }}>
                    {MR_LABELS[i]}
                  </div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{opt}</span>
                  {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '1.5rem' }}>✓</span>}
                </div>
              );
            })}
          </div>
          {!isReveal && (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {data.answeredPlayerIds.length} / {nonHostPlayers.length} answered
            </p>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ background: '#0d0d1f', borderLeft: '1px solid #1f1f35', padding: '1.5rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leaderboard</p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: i === 0 ? '#1a1036' : '#131326', borderRadius: 8, border: i === 0 ? '1px solid #7c3aed44' : '1px solid transparent' }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Word Scramble Host View ───────────────────────────────────────────────────

const WS_ANSWER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const WS_ANSWER_LABELS = ['A', 'B', 'C', 'D'];

function WordScrambleHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as WordScrambleData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isReveal = state.phase === 'round_end';
  const timerFraction = data.timeRemainingMs / 15_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', gap: '1.5rem', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280', fontWeight: 700, fontSize: '0.875rem' }}>
          Round {data.round} / {data.totalRounds}
        </p>

        {!isReveal && (
          <div style={{ width: '100%', maxWidth: 600, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${timerFraction * 100}%`, background: timerColor, borderRadius: 4, transition: 'width 0.1s linear' }} />
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Unscramble this word:</p>
          <h1 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 900, letterSpacing: '0.4rem', color: '#a78bfa', fontFamily: 'monospace' }}>
            {data.scrambled}
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: 700 }}>
          {data.options.map((option, i) => {
            const isCorrect = isReveal && data.correctIndex === i;
            const color = WS_ANSWER_COLORS[i]!;
            const bg = isReveal ? (isCorrect ? `${color}33` : '#0d0d1f') : '#1a1a2e';
            const border = isReveal ? (isCorrect ? `2px solid ${color}` : `2px solid ${color}22`) : `2px solid ${color}44`;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: bg, border, borderRadius: 12, transition: 'all 0.3s' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem', flexShrink: 0 }}>
                  {WS_ANSWER_LABELS[i]}
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.05rem' }}>{option}</span>
                {isCorrect && <span style={{ marginLeft: 'auto' }}>✓</span>}
              </div>
            );
          })}
        </div>

        {!isReveal && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            {data.answeredPlayerIds.length} / {nonHostPlayers.length} answered
          </p>
        )}
      </div>

      <div style={{ background: '#0d0d1f', borderLeft: '1px solid #1f1f35', padding: '1.5rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leaderboard</p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: i === 0 ? '#1a1036' : '#131326', borderRadius: 8 }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hot Potato Host View ───────────────────────────────────────────────────────

function HotPotatoHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as HotPotatoData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const holder = nonHostPlayers.find((p) => p.id === data.holderPlayerId);
  const exploded = nonHostPlayers.find((p) => p.id === data.explodedPlayerId);
  const isReveal = state.phase === 'round_end';
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
        <p style={{ color: '#6b7280', fontWeight: 700, fontSize: '0.875rem' }}>
          Round {data.round} / {data.totalRounds}
        </p>

        {isReveal && exploded ? (
          <>
            <div style={{ fontSize: '6rem', animation: 'none' }}>💥</div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>{exploded.name} got burned!</h2>
            <p style={{ color: '#6b7280' }}>−500 points</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '7rem', filter: 'drop-shadow(0 0 40px #f9731688)' }}>🥔</div>
            {holder && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#1f1028', border: '2px solid #f97316', borderRadius: '1rem', padding: '0.875rem 1.5rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: AVATAR_COLOR_HEX[holder.avatarColor], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '1.1rem' }}>
                    {holder.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>{holder.name}</p>
                    <p style={{ color: '#f97316', fontSize: '0.8rem', margin: 0 }}>is holding the potato!</p>
                  </div>
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                  Tap <strong style={{ color: '#f97316' }}>PASS 🥔</strong> on your phone to pass it!
                </p>
              </>
            )}
          </>
        )}
      </div>

      <div style={{ background: '#0d0d1f', borderLeft: '1px solid #1f1f35', padding: '1.5rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leaderboard</p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: p.id === data.holderPlayerId && !isReveal ? '#2a1205' : i === 0 ? '#1a1036' : '#131326', borderRadius: 8, border: p.id === data.holderPlayerId && !isReveal ? '1px solid #f97316' : '1px solid transparent' }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center' }}>{p.id === data.holderPlayerId && !isReveal ? '🥔' : i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── True or False Host View ───────────────────────────────────────────────────

function TrueFalseHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as TrueFalseData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isReveal = state.phase === 'round_end';
  const timerFraction = data.timeRemainingMs / 15_000;
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 700 }}>
            {data.questionIndex + 1} / {data.totalQuestions}
          </span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
            padding: '0.2rem 0.6rem', borderRadius: '9999px',
            background: '#1e1b4b', color: '#a78bfa',
          }}>
            {data.category}
          </span>
        </div>

        {/* Timer bar */}
        {!isReveal && (
          <div style={{ width: '100%', maxWidth: 600, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${timerFraction * 100}%`,
              background: timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444',
              borderRadius: 4, transition: 'width 0.1s linear',
            }} />
          </div>
        )}

        {/* Statement */}
        <div style={{
          background: '#13131f', border: '2px solid #2d2d4e', borderRadius: '1rem',
          padding: '2rem 2.5rem', maxWidth: 700, textAlign: 'center',
        }}>
          <p style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)', fontWeight: 700, lineHeight: 1.4 }}>
            {data.statement}
          </p>
        </div>

        {/* True / False buttons */}
        <div style={{ display: 'flex', gap: '2rem' }}>
          {[
            { label: '✓ TRUE', isTrue: true, color: '#22c55e' },
            { label: '✗ FALSE', isTrue: false, color: '#ef4444' },
          ].map(({ label, isTrue, color }) => {
            const isCorrect = isReveal && data.correctAnswer === isTrue;
            const isWrong = isReveal && data.correctAnswer !== isTrue;
            return (
              <div key={String(isTrue)} style={{
                width: 200, height: 100, borderRadius: '1rem',
                background: isCorrect ? `${color}33` : isWrong ? '#0d0d1f' : `${color}22`,
                border: `3px solid ${isCorrect ? color : isWrong ? `${color}33` : color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 900, color: isWrong ? '#374151' : color,
                transition: 'all 0.3s',
              }}>
                {label}
                {isCorrect && <span style={{ marginLeft: '0.5rem' }}>✓</span>}
              </div>
            );
          })}
        </div>

        {/* Who answered */}
        {!isReveal && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            {data.answeredPlayerIds.length} / {nonHostPlayers.length} answered
          </p>
        )}

        {/* Reveal results */}
        {isReveal && data.playerAnswers && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 500 }}>
            {nonHostPlayers.map((p) => {
              const answer = data.playerAnswers![p.id];
              const correct = answer !== undefined && answer === data.correctAnswer;
              const pts = state.round.roundScores[p.id];
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 1rem', borderRadius: 8,
                  background: answer === undefined ? '#1f2937' : correct ? '#14532d' : '#2d1515',
                  border: `1px solid ${answer === undefined ? '#374151' : correct ? '#166534' : '#7f1d1d'}`,
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                  {answer === undefined && <span style={{ color: '#4b5563', fontSize: '0.875rem' }}>No answer</span>}
                  {answer !== undefined && (
                    <span style={{ color: answer ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                      {answer ? '✓ True' : '✗ False'}
                    </span>
                  )}
                  {pts && <span style={{ color: '#22c55e', fontWeight: 900 }}>+{pts}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{ background: '#0d0d1f', borderLeft: '1px solid #1f1f35', padding: '1.5rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leaderboard</p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: i === 0 ? '#1a1036' : '#131326', borderRadius: 8 }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tap Frenzy Host View ───────────────────────────────────────────────────────

function TapFrenzyHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as TapFrenzyData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isReveal = state.phase === 'round_end';
  const countdownSec = Math.ceil(data.countdownMs / 1000);
  const tappingSec = Math.ceil(data.tappingMs / 1000);
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  // Sort players by taps for this round (during tapping & reveal)
  const byTaps = [...nonHostPlayers].sort(
    (a, b) => (data.playerTaps[b.id] ?? 0) - (data.playerTaps[a.id] ?? 0),
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem' }}>
        <p style={{ color: '#6b7280', fontWeight: 700, fontSize: '0.875rem' }}>
          Round {data.round} / {data.totalRounds}
        </p>

        {data.tappingPhase === 'countdown' && (
          <>
            <div style={{ fontSize: '8rem', fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>
              {countdownSec}
            </div>
            <p style={{ color: '#a78bfa', fontSize: '1.5rem', fontWeight: 700 }}>Get ready to tap!</p>
          </>
        )}

        {data.tappingPhase === 'tapping' && (
          <>
            <div style={{ fontSize: '6rem' }}>👇</div>
            <div style={{ fontSize: '5rem', fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>
              {tappingSec}s
            </div>
            <p style={{ color: '#22c55e', fontSize: '1.25rem', fontWeight: 700 }}>TAP TAP TAP!</p>
            {/* Live tap counts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 500 }}>
              {byTaps.map((p) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 1rem', borderRadius: 8, background: '#13131f',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontWeight: 900, color: '#6366f1', fontSize: '1.25rem' }}>
                    {data.playerTaps[p.id] ?? 0}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>taps</span>
                </div>
              ))}
            </div>
          </>
        )}

        {isReveal && (
          <>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>Round results!</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 500 }}>
              {byTaps.map((p, i) => {
                const taps = data.playerTaps[p.id] ?? 0;
                const pts = state.round.roundScores[p.id];
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem 1rem', borderRadius: 8,
                    background: i === 0 ? '#1a1036' : '#13131f',
                    border: i === 0 ? '1px solid #7c3aed44' : '1px solid transparent',
                  }}>
                    <span style={{ width: 24, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                    <span style={{ color: '#6366f1', fontWeight: 900 }}>{taps} taps</span>
                    {pts && <span style={{ color: '#22c55e', fontWeight: 900, marginLeft: '0.5rem' }}>+{pts}</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{ background: '#0d0d1f', borderLeft: '1px solid #1f1f35', padding: '1.5rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leaderboard</p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: i === 0 ? '#1a1036' : '#131326', borderRadius: 8 }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Blind Test Host View ─────────────────────────────────────────────────────

const BT_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const BT_LABELS = ['A', 'B', 'C', 'D'];

function BlindTestHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as BlindTestData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const isReveal = state.phase === 'round_end';
  const timerFraction = data.timeRemainingMs / 20_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  // Audio playback — play preview when available, stop on reveal
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (data.previewUrl && !isReveal) {
      if (audio.src !== data.previewUrl) {
        audio.src = data.previewUrl;
        audio.volume = 0.5;
        audio.loop = true;
        void audio.play().catch(() => {/* autoplay blocked – user gesture needed */});
      }
    } else {
      audio.pause();
    }
    return () => { audio.pause(); };
  }, [data.previewUrl, isReveal]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', gap: '1.5rem', overflow: 'hidden' }}>

        {/* Progress + timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <span style={{ color: '#8888aa', fontSize: '0.875rem', fontWeight: 600 }}>
            Song {data.questionIndex + 1} / {data.totalQuestions}
          </span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
            padding: '0.2rem 0.6rem', borderRadius: '9999px',
            background: 'rgba(124,58,237,0.15)', color: '#a78bfa',
          }}>
            {data.genre}
          </span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 600,
            color: '#8888aa',
          }}>
            {data.year}
          </span>
          <div style={{ flex: 1, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(data.questionIndex / data.totalQuestions) * 100}%`,
              background: '#6366f1', borderRadius: 4, transition: 'width 0.3s',
            }} />
          </div>
          {!isReveal && (
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: timerColor, minWidth: 48, textAlign: 'right' }}>
              {Math.ceil(data.timeRemainingMs / 1000)}s
            </span>
          )}
        </div>

        {/* Timer bar */}
        {!isReveal && (
          <div style={{ height: 6, background: '#1f2937', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{
              height: '100%', width: `${timerFraction * 100}%`,
              background: timerColor, borderRadius: 4,
              transition: 'width 0.1s linear, background 0.3s',
            }} />
          </div>
        )}

        {/* Hint + options */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '2rem',
        }}>
          {/* Musical note icon + audio indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '3rem', animation: 'float 3s ease-in-out infinite' }}>🎵</div>
            {data.previewUrl && !isReveal && (
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#a78bfa', background: 'rgba(124,58,237,0.15)',
                padding: '0.2rem 0.7rem', borderRadius: '9999px',
              }}>
                ♪ Playing
              </span>
            )}
          </div>

          {/* Lyric hint */}
          <div style={{
            background: 'rgba(20,20,40,0.6)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '1rem', padding: '1.5rem 2rem', maxWidth: 800, textAlign: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <p style={{
              fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 700,
              lineHeight: 1.4, fontStyle: 'italic', color: '#eeeef8',
            }}>
              {data.hint}
            </p>
          </div>

          {/* Answer options */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '1rem', width: '100%', maxWidth: 900,
          }}>
            {data.options.map((option, i) => {
              const isCorrect = isReveal && data.correctAnswer === i;
              const wasChosen = isReveal && Object.values(data.playerAnswers ?? {}).includes(i);
              const color = BT_COLORS[i]!;

              let bg = 'rgba(20,20,40,0.6)';
              let border = `2px solid ${color}44`;
              let opacity = 1;

              if (isReveal) {
                if (isCorrect) {
                  bg = `${color}33`;
                  border = `2px solid ${color}`;
                } else if (wasChosen) {
                  opacity = 0.5;
                } else {
                  opacity = 0.3;
                }
              }

              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1.25rem 1.5rem', background: bg, border,
                  borderRadius: 12, opacity, transition: 'all 0.3s',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '1.25rem', flexShrink: 0,
                  }}>
                    {BT_LABELS[i]}
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: 600 }}>{option}</span>
                  {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '1.5rem' }}>✓</span>}
                </div>
              );
            })}
          </div>

          {!isReveal && (
            <p style={{ color: '#8888aa', fontSize: '0.875rem' }}>
              {data.answeredPlayerIds.length} / {nonHostPlayers.length} answered
            </p>
          )}
        </div>

        {/* Round score banners during reveal */}
        {isReveal && state.round.roundScores && Object.keys(state.round.roundScores).length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            {Object.entries(state.round.roundScores).map(([playerId, pts]) => {
              const player = nonHostPlayers.find((p) => p.id === playerId);
              if (!player || !pts) return null;
              return (
                <div key={playerId} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 8,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: AVATAR_COLOR_HEX[player.avatarColor],
                    boxShadow: `0 0 8px ${AVATAR_COLOR_HEX[player.avatarColor]}44`,
                  }} />
                  <span style={{ fontWeight: 700 }}>{player.name}</span>
                  <span style={{ color: '#22c55e', fontWeight: 900 }}>+{pts}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard sidebar */}
      <div style={{
        background: 'rgba(13,13,31,0.8)', borderLeft: '1px solid rgba(255,255,255,0.06)',
        padding: '1.5rem 1rem', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <p style={{ color: '#8888aa', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Leaderboard
        </p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.625rem 0.75rem',
            background: i === 0 ? 'rgba(124,58,237,0.1)' : 'rgba(19,19,38,0.8)',
            borderRadius: 8,
            border: i === 0 ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
          }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#8888aa' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
            </span>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0,
              boxShadow: `0 0 8px ${AVATAR_COLOR_HEX[p.avatarColor]}44`,
            }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>
              {state.scores[p.id] ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dodge Master Host View ────────────────────────────────────────────────────

function DodgeMasterHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as DodgeMasterData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));
  const isReveal = state.phase === 'round_end';
  const arenaScale = 4.5; // pixels per arena unit

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
        <p style={{ color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.875rem' }}>
          Round {data.round} / {data.totalRounds}
        </p>

        {/* Timer */}
        <div style={{ width: '100%', maxWidth: 450, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(data.timeRemainingMs / 12000) * 100}%`,
            background: data.timeRemainingMs < 3000 ? '#ef4444' : '#22c55e',
            borderRadius: 4,
            transition: 'width 0.1s linear',
          }} />
        </div>

        {/* Arena */}
        <div style={{
          position: 'relative',
          width: data.arena * arenaScale,
          height: data.arena * arenaScale,
          background: '#111827',
          border: '2px solid #374151',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Obstacles */}
          {data.obstacles.map((obs, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: obs.x * arenaScale - obs.radius * arenaScale,
              top: obs.y * arenaScale - obs.radius * arenaScale,
              width: obs.radius * 2 * arenaScale,
              height: obs.radius * 2 * arenaScale,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 12px #ef444466',
            }} />
          ))}

          {/* Players */}
          {nonHostPlayers.map((p) => {
            const ps = data.players[p.id];
            if (!ps) return null;
            return (
              <div key={p.id} style={{
                position: 'absolute',
                left: ps.x * arenaScale - data.playerRadius * arenaScale,
                top: ps.y * arenaScale - data.playerRadius * arenaScale,
                width: data.playerRadius * 2 * arenaScale,
                height: data.playerRadius * 2 * arenaScale,
                borderRadius: '50%',
                background: ps.alive ? AVATAR_COLOR_HEX[p.avatarColor] : '#4b556366',
                border: ps.alive ? '2px solid #fff' : '2px solid #4b5563',
                boxShadow: ps.alive ? `0 0 10px ${AVATAR_COLOR_HEX[p.avatarColor]}88` : 'none',
                opacity: ps.alive ? 1 : 0.4,
                transition: 'opacity 0.3s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 800, color: '#fff',
              }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
            );
          })}
        </div>

        {isReveal && (
          <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '1.25rem' }}>Round over!</p>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{
        background: '#0d0d1f', borderLeft: '1px solid #1f1f35',
        padding: '1.5rem 1rem', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Leaderboard
        </p>
        {sorted.map((p, i) => {
          const ps = data.players[p.id];
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              background: i === 0 ? '#1a1036' : '#131326',
              borderRadius: 8,
              border: i === 0 ? '1px solid #7c3aed44' : '1px solid transparent',
              opacity: ps?.alive === false ? 0.5 : 1,
            }}>
              <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ fontSize: '0.75rem', color: ps?.alive ? '#22c55e' : '#ef4444' }}>
                {ps?.alive ? 'ALIVE' : 'OUT'}
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Swipe Duel Host View ──────────────────────────────────────────────────────

const DIRECTION_ARROWS: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const DIRECTION_COLORS: Record<string, string> = { up: '#3b82f6', down: '#ef4444', left: '#f59e0b', right: '#22c55e' };

function SwipeDuelHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as SwipeDuelData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));
  const isReveal = data.roundPhase === 'reveal';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
        <p style={{ color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.875rem' }}>
          Round {data.round} / {data.totalRounds}
        </p>

        {data.roundPhase === 'countdown' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', color: '#9ca3af', fontWeight: 700 }}>Get ready...</p>
            <p style={{ fontSize: '4rem', fontWeight: 900, color: '#f59e0b' }}>{Math.ceil(data.countdownMs / 1000)}</p>
          </div>
        )}

        {data.roundPhase === 'go' && (
          <>
            <div style={{
              width: 200, height: 200, borderRadius: 24,
              background: DIRECTION_COLORS[data.targetDirection],
              boxShadow: `0 0 80px ${DIRECTION_COLORS[data.targetDirection]}88`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '8rem', fontWeight: 900,
            }}>
              {DIRECTION_ARROWS[data.targetDirection]}
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>
              Swipe {data.targetDirection}!
            </p>
            <div style={{ width: '100%', maxWidth: 400, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(data.responseMs / 3000) * 100}%`,
                background: DIRECTION_COLORS[data.targetDirection],
                borderRadius: 4,
                transition: 'width 0.1s linear',
              }} />
            </div>
          </>
        )}

        {isReveal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 400 }}>
            {nonHostPlayers.map((p) => {
              const correct = data.correctPlayers.includes(p.id);
              const wrong = data.wrongPlayers.includes(p.id);
              const pts = state.round.roundScores[p.id];
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  background: correct ? '#14532d' : wrong ? '#2d1515' : '#1f2937',
                  borderRadius: 8,
                  border: `1px solid ${correct ? '#166534' : wrong ? '#7f1d1d' : '#374151'}`,
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                  {correct && pts && <span style={{ color: '#22c55e', fontWeight: 900 }}>+{pts}</span>}
                  {wrong && <span style={{ color: '#f87171', fontSize: '0.875rem' }}>Wrong! {pts}</span>}
                  {!correct && !wrong && <span style={{ color: '#4b5563', fontSize: '0.875rem' }}>No swipe</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{
        background: '#0d0d1f', borderLeft: '1px solid #1f1f35',
        padding: '1.5rem 1rem', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Leaderboard
        </p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.625rem 0.75rem',
            background: i === 0 ? '#1a1036' : '#131326',
            borderRadius: 8,
            border: i === 0 ? '1px solid #7c3aed44' : '1px solid transparent',
          }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
            </span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Direction Dash Host View ──────────────────────────────────────────────────

const DIR_ARROWS: Record<string, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };
const DIR_COLORS: Record<string, string> = { up: '#3b82f6', down: '#ef4444', left: '#f59e0b', right: '#22c55e' };

function DirectionDashHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as DirectionDashData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const sorted = [...nonHostPlayers].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh', background: '#0a0a16', color: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
        <p style={{ color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.875rem' }}>
          Round {data.round} / {data.totalRounds}
        </p>

        {data.roundPhase === 'showing' && (
          <>
            <p style={{ fontSize: '1.5rem', color: '#9ca3af', fontWeight: 700 }}>Memorize the sequence!</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {data.sequence.map((dir, i) => (
                <div key={i} style={{
                  width: 64, height: 64, borderRadius: 12,
                  background: DIR_COLORS[dir],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem', fontWeight: 900, color: '#fff',
                  boxShadow: `0 0 20px ${DIR_COLORS[dir]}66`,
                }}>
                  {DIR_ARROWS[dir]}
                </div>
              ))}
            </div>
            <div style={{ width: '100%', maxWidth: 400, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(data.showTimeMs / (3000 + (data.sequenceLength - 3) * 500)) * 100}%`,
                background: '#a78bfa',
                borderRadius: 4,
                transition: 'width 0.1s linear',
              }} />
            </div>
          </>
        )}

        {data.roundPhase === 'input' && (
          <>
            <p style={{ fontSize: '1.5rem', color: '#22c55e', fontWeight: 700 }}>Now repeat it!</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Array.from({ length: data.sequenceLength }).map((_, i) => (
                <div key={i} style={{
                  width: 48, height: 48, borderRadius: 8,
                  background: '#1f2937',
                  border: '2px solid #374151',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', color: '#6b7280',
                }}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Player progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 400 }}>
              {nonHostPlayers.map((p) => {
                const progress = data.playerProgress[p.id] ?? 0;
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.5rem 1rem', background: '#131326', borderRadius: 8,
                  }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 700, fontSize: '0.875rem' }}>{p.name}</span>
                    <div style={{ width: 80, height: 6, background: '#1f2937', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(progress / data.sequenceLength) * 100}%`, background: '#22c55e', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{progress}/{data.sequenceLength}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ width: '100%', maxWidth: 400, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(data.inputTimeMs / (5000 + (data.sequenceLength - 3) * 500)) * 100}%`,
                background: '#22c55e',
                borderRadius: 4,
                transition: 'width 0.1s linear',
              }} />
            </div>
          </>
        )}

        {data.roundPhase === 'reveal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 400 }}>
            {nonHostPlayers.map((p) => {
              const result = data.playerResults[p.id];
              const pts = state.round.roundScores[p.id];
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  background: result?.failed ? '#2d1515' : result && result.correct === result.total ? '#14532d' : '#1f2937',
                  borderRadius: 8,
                  border: `1px solid ${result?.failed ? '#7f1d1d' : result && result.correct === result.total ? '#166534' : '#374151'}`,
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                  {result?.failed && <span style={{ color: '#f87171', fontSize: '0.875rem' }}>Wrong!</span>}
                  {result && !result.failed && (
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{result.correct}/{result.total}</span>
                  )}
                  {pts !== undefined && pts > 0 && <span style={{ color: '#22c55e', fontWeight: 900 }}>+{pts}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{
        background: '#0d0d1f', borderLeft: '1px solid #1f1f35',
        padding: '1.5rem 1rem', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Leaderboard
        </p>
        {sorted.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.625rem 0.75rem',
            background: i === 0 ? '#1a1036' : '#131326',
            borderRadius: 8,
            border: i === 0 ? '1px solid #7c3aed44' : '1px solid transparent',
          }}>
            <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', color: '#6b7280' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
            </span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a78bfa' }}>{state.scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Never Have I Ever Host View ──────────────────────────────────────────────

function NeverHaveIEverHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as NeverHaveIEverData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.confessWindowMs / 8_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header: round + lives */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1, height: 6, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(data.round / data.totalRounds) * 100}%`,
            background: '#6366f1',
            borderRadius: 4,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Main area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem',
      }}>
        {/* Statement */}
        <div style={{ textAlign: 'center', maxWidth: 700 }}>
          <p style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>
            Never have I ever...
          </p>
          <p style={{
            fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.2,
            background: 'linear-gradient(135deg, #fff 0%, #f0abfc 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {data.statement}
          </p>
        </div>

        {/* Timer bar (only during active phase) */}
        {!data.isReveal && (
          <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ width: '100%', height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${timerFraction * 100}%`,
                background: timerColor,
                borderRadius: 4,
                transition: 'width 0.1s linear, background 0.3s',
              }} />
            </div>
            <span style={{ color: timerColor, fontWeight: 800, fontSize: '1.5rem' }}>
              {Math.ceil(data.confessWindowMs / 1000)}s
            </span>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Press the button on your phone if you HAVE done it...
            </p>
          </div>
        )}

        {/* Reveal: who confessed */}
        {data.isReveal && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            {data.confessors.length > 0 ? (
              <>
                <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.25rem' }}>
                  Caught! 😳
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {data.confessors.map((id) => {
                    const p = nonHostPlayers.find((pl) => pl.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 1rem', borderRadius: '9999px',
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                        animation: 'fadeInScale 0.3s ease-out',
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{p.name}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.25rem' }}>
                Nobody confessed! 😇
              </p>
            )}
          </div>
        )}
      </div>

      {/* Player bar with lives */}
      <div style={{
        display: 'flex', gap: '0.75rem', padding: '1rem 2rem',
        background: 'rgba(15,15,30,0.9)', justifyContent: 'center', flexWrap: 'wrap', flexShrink: 0,
      }}>
        {nonHostPlayers.map((p) => {
          const lives = data.lives[p.id] ?? 0;
          const eliminated = data.eliminatedPlayers.includes(p.id);
          const justConfessed = data.isReveal && data.confessors.includes(p.id);
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.875rem', borderRadius: '0.75rem',
              background: eliminated ? 'rgba(239,68,68,0.1)' : justConfessed ? 'rgba(239,68,68,0.15)' : 'rgba(20,20,40,0.6)',
              border: `1px solid ${eliminated ? 'rgba(239,68,68,0.2)' : justConfessed ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
              opacity: eliminated ? 0.5 : 1,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.75rem', color: '#fff',
              }}>
                {p.name[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{p.name}</span>
              <span style={{ fontSize: '0.875rem' }}>
                {eliminated ? '💀' : '❤️'.repeat(Math.max(0, lives))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Game View ─────────────────────────────────────────────────────────────────

function GameView({
  gameId,
  players,
  gameState,
  scores,
  onEndGame,
}: {
  gameId: string;
  players: Player[];
  gameState: GameState | null;
  scores: Record<string, number> | null;
  onEndGame: () => void;
}) {
  const prevPhaseRef = useRef<string | null>(null);
  const nonHostPlayers = players.filter((p) => !p.isHost);

  // Play round-end sound when phase transitions to round_end
  useEffect(() => {
    const phase = gameState?.phase ?? null;
    if (phase === 'round_end' && prevPhaseRef.current === 'active') {
      playRoundEnd();
    }
    prevPhaseRef.current = phase;
  }, [gameState?.phase]);

  if (scores !== null) {
    const sorted = [...nonHostPlayers].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: '2rem', padding: '2rem',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.12) 0%, transparent 60%), #0a0a12',
      }}>
        <div style={{ fontSize: '4rem', animation: 'float 3s ease-in-out infinite' }}>🏆</div>
        <h1 style={{
          fontSize: '3.5rem', fontWeight: 900,
          background: 'linear-gradient(135deg, #fff 0%, #fbbf24 50%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Game Over!</h1>
        <div style={{ width: '100%', maxWidth: 640 }}>
          {sorted.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.5rem',
                background: i === 0 ? 'rgba(124,58,237,0.12)' : 'rgba(20,20,40,0.6)',
                borderRadius: 12,
                marginBottom: 8,
                border: i === 0 ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(8px)',
                animation: `slideUp 0.4s ease-out ${i * 0.08}s both`,
              }}
            >
              <span style={{ fontSize: '1.75rem', width: 48, textAlign: 'center' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: AVATAR_COLOR_HEX[p.avatarColor],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1rem', color: '#fff', flexShrink: 0,
                  boxShadow: `0 0 12px ${AVATAR_COLOR_HEX[p.avatarColor]}44`,
                }}
              >
                {p.name[0]?.toUpperCase()}
              </div>
              <span style={{ flex: 1, fontSize: '1.25rem', fontWeight: 700 }}>{p.name}</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a78bfa' }}>
                {scores[p.id] ?? 0} pts
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onEndGame}
          style={{
            padding: '0.875rem 2.5rem',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: '#fff', border: 'none', borderRadius: '0.875rem',
            fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
            transition: 'transform 0.15s',
          }}
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  if (gameId === 'trivia' && gameState) {
    return <TriviaHostView state={gameState} players={players} />;
  }

  if (gameId === 'reaction' && gameState) {
    return <ReactionHostView state={gameState} players={players} />;
  }

  if (gameId === 'colormatch' && gameState) {
    return <ColorMatchHostView state={gameState} players={players} />;
  }

  if (gameId === 'mathrace' && gameState) {
    return <MathRaceHostView state={gameState} players={players} />;
  }

  if (gameId === 'wordscramble' && gameState) {
    return <WordScrambleHostView state={gameState} players={players} />;
  }

  if (gameId === 'hotpotato' && gameState) {
    return <HotPotatoHostView state={gameState} players={players} />;
  }

  if (gameId === 'trueorfalse' && gameState) {
    return <TrueFalseHostView state={gameState} players={players} />;
  }

  if (gameId === 'tapfrenzy' && gameState) {
    return <TapFrenzyHostView state={gameState} players={players} />;
  }

  if (gameId === 'blindtest' && gameState) {
    return <BlindTestHostView state={gameState} players={players} />;
  }

  if (gameId === 'dodgemaster' && gameState) {
    return <DodgeMasterHostView state={gameState} players={players} />;
  }

  if (gameId === 'swipeduel' && gameState) {
    return <SwipeDuelHostView state={gameState} players={players} />;
  }

  if (gameId === 'directiondash' && gameState) {
    return <DirectionDashHostView state={gameState} players={players} />;
  }

  if (gameId === 'neverhaveiever' && gameState) {
    return <NeverHaveIEverHostView state={gameState} players={players} />;
  }

  if (gameId === 'colorflash' && gameState) {
    return <ColorFlashHostView state={gameState} players={players} />;
  }

  if (gameId === 'wouldyourather' && gameState) {
    return <WouldYouRatherHostView state={gameState} players={players} />;
  }

  if (gameId === 'luckynumber' && gameState) {
    return <LuckyNumberHostView state={gameState} players={players} />;
  }

  if (gameId === 'retropong' && gameState) {
    return <RetroPongHostView state={gameState} players={players} />;
  }

  if (gameId === 'emojidecoder' && gameState) {
    return <EmojiDecoderHostView state={gameState} players={players} />;
  }

  if (gameId === 'tugofwar' && gameState) {
    return <TugOfWarHostView state={gameState} players={players} />;
  }

  if (gameId === 'simonsays' && gameState) {
    return <SimonSaysHostView state={gameState} players={players} />;
  }

  if (gameId === 'debateclub' && gameState) {
    return <DebateClubHostView state={gameState} players={players} />;
  }

  if (gameId === 'categorysprint' && gameState) {
    return <CategorySprintHostView state={gameState} players={players} />;
  }

  if (gameId === 'auctionhouse' && gameState) {
    return <AuctionHouseHostView state={gameState} players={players} />;
  }

  if (gameId === 'rps' && gameState) {
    return <RPSHostView state={gameState} players={players} />;
  }

  if (gameId === 'bombdefuse' && gameState) {
    return <BombDefuseHostView state={gameState} players={players} />;
  }

  if (gameId === 'whackamole' && gameState) {
    return <WhackAMoleHostView state={gameState} players={players} />;
  }

  if (gameId === 'floorislava' && gameState) {
    return <FloorIsLavaHostView state={gameState} players={players} />;
  }

  if (gameId === 'buttonmash' && gameState) {
    return <ButtonMashHostView state={gameState} players={players} />;
  }

  if (gameId === 'dodgeball' && gameState) {
    return <DodgeBallHostView state={gameState} players={players} />;
  }

  if (gameId === 'priceisright' && gameState) {
    return <PriceIsRightHostView state={gameState} players={players} />;
  }

  if (gameId === 'spinthewheel' && gameState) {
    return <SpinTheWheelHostView state={gameState} players={players} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 1.5rem', background: 'rgba(15,15,26,0.9)', justifyContent: 'center', flexWrap: 'wrap' }}>
        {nonHostPlayers.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '1rem' }}>
        <p style={{ fontSize: '5rem' }}>🎮</p>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#a78bfa', textTransform: 'capitalize' }}>{gameId}</h2>
        <p style={{ color: '#4b5563', fontSize: '1rem' }}>Game in progress — watch this screen!</p>
      </div>
    </div>
  );
}

// ── Would You Rather Host View ──────────────────────────────────────────────

function WouldYouRatherHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as WouldYouRatherData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.voteWindowMs / 10_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1, height: 6, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(data.round / data.totalRounds) * 100}%`,
            background: '#6366f1',
            borderRadius: 4,
            transition: 'width 0.3s',
          }} />
        </div>
        {!data.isReveal && (
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: timerColor }}>
            {Math.ceil(data.voteWindowMs / 1000)}s
          </span>
        )}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '0 2rem', flexShrink: 0 }}>
        <p style={{
          fontSize: '1.5rem', fontWeight: 900, color: '#a78bfa',
        }}>
          Would you rather...
        </p>
      </div>

      {/* Options */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '2rem', padding: '2rem 3rem', alignItems: 'center',
      }}>
        {/* Option A */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '1.5rem', padding: '2rem',
          borderRadius: 20,
          background: data.isReveal ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
          border: `2px solid ${data.isReveal ? '#3b82f6' : 'rgba(59,130,246,0.2)'}`,
          transition: 'all 0.3s',
        }}>
          <span style={{
            fontSize: '1.5rem', fontWeight: 900, color: '#3b82f6',
            background: 'rgba(59,130,246,0.15)', borderRadius: '50%',
            width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>A</span>
          <p style={{
            fontSize: '1.75rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.3,
          }}>
            {data.optionA}
          </p>
          {data.isReveal && (
            <>
              <p style={{ fontSize: '3rem', fontWeight: 900, color: '#3b82f6' }}>{data.percentA}%</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {data.revealVotesA.map((id) => {
                  const p = nonHostPlayers.find((pl) => pl.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.3rem 0.6rem', borderRadius: '9999px',
                      background: 'rgba(59,130,246,0.15)', fontSize: '0.8rem', fontWeight: 700,
                    }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: AVATAR_COLOR_HEX[p.avatarColor],
                      }} />
                      {p.name}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Option B */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '1.5rem', padding: '2rem',
          borderRadius: 20,
          background: data.isReveal ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.05)',
          border: `2px solid ${data.isReveal ? '#f59e0b' : 'rgba(245,158,11,0.2)'}`,
          transition: 'all 0.3s',
        }}>
          <span style={{
            fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b',
            background: 'rgba(245,158,11,0.15)', borderRadius: '50%',
            width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>B</span>
          <p style={{
            fontSize: '1.75rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.3,
          }}>
            {data.optionB}
          </p>
          {data.isReveal && (
            <>
              <p style={{ fontSize: '3rem', fontWeight: 900, color: '#f59e0b' }}>{data.percentB}%</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {data.revealVotesB.map((id) => {
                  const p = nonHostPlayers.find((pl) => pl.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.3rem 0.6rem', borderRadius: '9999px',
                      background: 'rgba(245,158,11,0.15)', fontSize: '0.8rem', fontWeight: 700,
                    }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: AVATAR_COLOR_HEX[p.avatarColor],
                      }} />
                      {p.name}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Timer bar + voted count */}
      {!data.isReveal && (
        <div style={{ padding: '0 3rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 500, height: 6, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${timerFraction * 100}%`,
              background: timerColor,
              borderRadius: 4,
              transition: 'width 0.1s linear, background 0.3s',
            }} />
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            {data.votedPlayerIds.length} / {nonHostPlayers.length} voted
          </p>
        </div>
      )}

      {/* Scoreboard */}
      <div style={{
        display: 'flex', gap: '0.75rem', justifyContent: 'center',
        padding: '0 2rem 1.5rem', flexWrap: 'wrap', flexShrink: 0,
      }}>
        {[...nonHostPlayers]
          .sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
          .map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.35rem 0.75rem', borderRadius: '9999px',
              background: 'rgba(20,20,40,0.6)', border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.8rem',
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0,
              }} />
              <span style={{ fontWeight: 700 }}>{p.name}</span>
              <span style={{ color: '#a78bfa', fontWeight: 800 }}>{state.scores[p.id] ?? 0}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Color Flash Host View ───────────────────────────────────────────────────

function ColorFlashHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as ColorFlashData;
  const nonHostPlayers = players.filter((p) => !p.isHost);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1, height: 6, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(data.round / data.totalRounds) * 100}%`,
            background: '#6366f1',
            borderRadius: 4,
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Flash {Math.min(data.flashIndex + 1, data.flashesTotal)} / {data.flashesTotal}
        </span>
      </div>

      {/* Player color assignments */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', padding: '0 2rem', flexShrink: 0 }}>
        {nonHostPlayers.map((p) => {
          const pc = data.playerColors[p.id];
          if (!pc) return null;
          const tapped = data.tappedPlayers.includes(p.id);
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: '9999px',
              background: tapped ? `${pc.hex}22` : 'rgba(20,20,40,0.6)',
              border: `2px solid ${tapped ? pc.hex : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.15s',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: pc.hex, flexShrink: 0,
                boxShadow: `0 0 8px ${pc.hex}66`,
              }} />
              <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{p.name}</span>
              <span style={{ color: '#a78bfa', fontWeight: 800, fontSize: '0.8rem' }}>
                {state.scores[p.id] ?? 0}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main flash area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '2rem',
      }}>
        {data.isReveal ? (
          /* Round results */
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a78bfa' }}>Round Results</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: 500 }}>
              {data.revealResults.map((r) => {
                const player = nonHostPlayers.find((p) => p.id === r.playerId);
                const pc = data.playerColors[r.playerId];
                if (!player || !pc) return null;
                return (
                  <div key={r.playerId} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.75rem 1.25rem', borderRadius: 12,
                    background: 'rgba(20,20,40,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: pc.hex, flexShrink: 0,
                    }} />
                    <span style={{ fontWeight: 700, flex: 1 }}>{player.name}</span>
                    <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 700 }}>
                      {r.correct} hit{r.correct !== 1 ? 's' : ''}
                    </span>
                    {r.wrong > 0 && (
                      <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700 }}>
                        {r.wrong} wrong
                      </span>
                    )}
                    {r.missed > 0 && (
                      <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 700 }}>
                        {r.missed} missed
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : data.flashColor ? (
          /* Active flash */
          <div style={{
            width: 280, height: 280, borderRadius: '50%',
            background: `radial-gradient(circle, ${data.flashColor} 0%, ${data.flashColor}88 60%, transparent 100%)`,
            boxShadow: `0 0 120px ${data.flashColor}88, 0 0 60px ${data.flashColor}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeInScale 0.15s ease-out',
            transition: 'background 0.1s',
          }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              {data.flashColorName}
            </span>
          </div>
        ) : (
          /* Gap between flashes */
          <div style={{
            width: 280, height: 280, borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            border: '2px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '1.5rem', color: '#374151', fontWeight: 700 }}>...</span>
          </div>
        )}

        {!data.isReveal && (
          <p style={{ color: '#6b7280', fontSize: '1rem', fontWeight: 600 }}>
            Tap ONLY when your color appears!
          </p>
        )}
      </div>
    </div>
  );
}

// ── Lucky Number Host View ──────────────────────────────────────────────────

const LUCKY_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const LUCKY_LABELS = ['1', '2', '3', '4'];
const LUCKY_CHOICE_IDS = ['A', 'B', 'C', 'D'];

function LuckyNumberHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as LuckyNumberData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.pickWindowMs / 8_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>🎰</span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {!data.isSpinning ? (
          <>
            {/* Pick phase */}
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textAlign: 'center', color: '#f0f0ff' }}>
              Pick your lucky number!
            </h2>

            {/* Timer bar */}
            <div style={{ width: '100%', maxWidth: 500, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`,
                height: '100%',
                background: timerColor,
                borderRadius: 4,
                transition: 'width 0.3s linear',
              }} />
            </div>

            {/* Number choices display */}
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              {LUCKY_LABELS.map((label, i) => (
                <div key={i} style={{
                  width: 100, height: 100, borderRadius: 16,
                  background: `${LUCKY_COLORS[i]}22`,
                  border: `3px solid ${LUCKY_COLORS[i]}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.5rem', fontWeight: 900, color: LUCKY_COLORS[i],
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Who has picked */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nonHostPlayers.map((p) => {
                const hasPicked = data.pickedPlayerIds.includes(p.id);
                return (
                  <div key={p.id} style={{
                    padding: '0.5rem 1rem', borderRadius: 12,
                    background: hasPicked ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${hasPicked ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: hasPicked ? '#22c55e' : '#6b7280' }}>
                      {p.name}
                    </span>
                    {hasPicked && <span style={{ fontSize: '0.75rem' }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Spin/reveal phase */}
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#a78bfa', textAlign: 'center' }}>
              The lucky number is...
            </h2>

            {/* Winning number - big reveal */}
            {data.winningNumber !== null && (
              <div style={{
                width: 200, height: 200, borderRadius: '50%',
                background: `${LUCKY_COLORS[data.winningNumber - 1]}22`,
                border: `6px solid ${LUCKY_COLORS[data.winningNumber - 1]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '6rem', fontWeight: 900,
                color: LUCKY_COLORS[data.winningNumber - 1],
                boxShadow: `0 0 60px ${LUCKY_COLORS[data.winningNumber - 1]}44`,
                animation: 'pulse 0.6s ease-in-out infinite alternate',
              }}>
                {data.winningNumber}
              </div>
            )}

            {/* Player picks & results */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nonHostPlayers.map((p) => {
                const pick = data.playerPicks[p.id];
                const isWinner = data.winners.includes(p.id);
                const pickIdx = pick ? LUCKY_CHOICE_IDS.indexOf(pick) : -1;
                const streak = data.streaks[p.id] ?? 0;
                return (
                  <div key={p.id} style={{
                    padding: '0.75rem 1.25rem', borderRadius: 16,
                    background: isWinner ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.08)',
                    border: `2px solid ${isWinner ? '#22c55e' : 'rgba(239,68,68,0.2)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                    minWidth: 100,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0f0ff' }}>{p.name}</span>
                    </div>
                    {pick ? (
                      <span style={{
                        fontSize: '2rem', fontWeight: 900,
                        color: pickIdx >= 0 ? LUCKY_COLORS[pickIdx] : '#6b7280',
                      }}>
                        {pickIdx >= 0 ? LUCKY_LABELS[pickIdx] : '?'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '1rem', color: '#6b7280' }}>No pick</span>
                    )}
                    {isWinner && (
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#22c55e' }}>
                        {streak >= 3 ? `🔥 ${streak}x STREAK!` : streak === 2 ? '⚡ 2x STREAK!' : '✅ MATCH!'}
                      </span>
                    )}
                    {!isWinner && pick && (
                      <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>✗</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Auction House Host View ─────────────────────────────────────────────────

const BID_COLORS: Record<number, string> = { 100: '#22c55e', 200: '#3b82f6', 500: '#f59e0b', 1000: '#ef4444' };

function AuctionHouseHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as AuctionHouseData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const getName = (id: string) => nonHostPlayers.find((p) => p.id === id)?.name ?? '?';
  const timerFraction = data.bidWindowMs / 8_000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>🔨</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Item display */}
        <div style={{
          padding: '2rem 3rem', borderRadius: 20,
          background: 'rgba(245,158,11,0.08)',
          border: '2px solid rgba(245,158,11,0.25)',
          maxWidth: 500, textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>MYSTERY ITEM</p>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b', margin: '0.5rem 0' }}>
            {data.itemName}
          </h2>
          <p style={{ fontSize: '1rem', color: '#9ca3af', fontStyle: 'italic' }}>
            &ldquo;{data.itemHint}&rdquo;
          </p>
          {data.isReveal && data.itemValue !== null && (
            <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a78bfa', marginTop: '1rem' }}>
              True value: {data.itemValue} pts
            </p>
          )}
        </div>

        {/* Bidding phase */}
        {!data.isReveal && (
          <>
            <p style={{ color: '#a78bfa', fontSize: '1.2rem', fontWeight: 700 }}>
              Place your bid! Highest UNIQUE bid wins.
            </p>

            <div style={{ width: '100%', maxWidth: 400, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`, height: '100%',
                background: timerFraction > 0.3 ? '#22c55e' : '#ef4444',
                borderRadius: 3, transition: 'width 0.3s linear',
              }} />
            </div>

            {/* Bid options */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[100, 200, 500, 1000].map((v) => (
                <div key={v} style={{
                  padding: '0.75rem 1.5rem', borderRadius: 12,
                  background: `${BID_COLORS[v]}15`, border: `2px solid ${BID_COLORS[v]}44`,
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: BID_COLORS[v] }}>{v}</span>
                </div>
              ))}
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              {data.bidderIds.length} / {nonHostPlayers.length} placed bids
            </p>
          </>
        )}

        {/* Reveal phase */}
        {data.isReveal && (
          <>
            {/* All bids */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nonHostPlayers.map((p) => {
                const bid = data.bids[p.id];
                const isWinner = p.id === data.winnerId;
                const isTied = bid !== undefined && data.tiedBids.includes(bid);
                return (
                  <div key={p.id} style={{
                    padding: '0.75rem 1.25rem', borderRadius: 16,
                    background: isWinner ? 'rgba(34,197,94,0.15)' : isTied ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${isWinner ? '#22c55e' : isTied ? '#ef444444' : 'rgba(255,255,255,0.06)'}`,
                    textAlign: 'center', minWidth: 90,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', marginBottom: '0.3rem' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
                    </div>
                    {bid !== undefined ? (
                      <span style={{ fontSize: '1.5rem', fontWeight: 900, color: BID_COLORS[bid] ?? '#888' }}>{bid}</span>
                    ) : (
                      <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>No bid</span>
                    )}
                    {isWinner && <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#22c55e', margin: 0 }}>WINNER!</p>}
                    {isTied && <p style={{ fontSize: '0.7rem', color: '#ef4444', margin: 0 }}>TIED</p>}
                  </div>
                );
              })}
            </div>

            {/* Result */}
            {data.winnerId ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#22c55e' }}>
                  {getName(data.winnerId)} wins with a bid of {data.winnerBid}!
                </p>
                {data.profit !== null && (
                  <p style={{ fontSize: '1rem', color: data.profit >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                    {data.profit >= 0 ? `Profit: +${data.profit}` : `Overpaid by ${Math.abs(data.profit)}`}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>
                No unique bids — nobody wins!
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Spin the Wheel Host View ─────────────────────────────────────────────────

const CHALLENGE_TYPE_EMOJI: Record<string, string> = { truth: '🤔', dare: '😈', category: '📋', trivia: '🧠' };
const CHALLENGE_TYPE_COLOR: Record<string, string> = { truth: '#3b82f6', dare: '#ef4444', category: '#22c55e', trivia: '#f59e0b' };

function SpinTheWheelHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as SpinTheWheelData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const targetPlayer = nonHostPlayers.find((p) => p.id === data.targetPlayerId);
  const timerFraction = data.phase === 'challenge' ? data.challengeMs / 15_000 : data.voteMs / 8_000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>🎡</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Spinning */}
        {data.phase === 'spinning' && (
          <>
            <div style={{ fontSize: '5rem', animation: 'spin 1s linear infinite' }}>🎡</div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a78bfa' }}>Spinning...</p>
          </>
        )}

        {/* Challenge phase */}
        {data.phase === 'challenge' && targetPlayer && (
          <>
            {/* Target player */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_COLOR_HEX[targetPlayer.avatarColor] }} />
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0ff' }}>{targetPlayer.name}</span>
            </div>

            {/* Challenge card */}
            <div style={{
              padding: '2rem 3rem', borderRadius: 20, maxWidth: 500, textAlign: 'center',
              background: `${CHALLENGE_TYPE_COLOR[data.challengeType ?? 'truth']}10`,
              border: `2px solid ${CHALLENGE_TYPE_COLOR[data.challengeType ?? 'truth']}40`,
            }}>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
                {CHALLENGE_TYPE_EMOJI[data.challengeType ?? 'truth']} {data.challengeType}
              </p>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0ff', margin: '0.5rem 0' }}>
                {data.challenge}
              </h2>
            </div>

            {/* Timer */}
            <div style={{ width: '100%', maxWidth: 400, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`, height: '100%',
                background: timerFraction > 0.3 ? '#22c55e' : '#ef4444',
                borderRadius: 3, transition: 'width 0.3s linear',
              }} />
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              Others will vote if you did it!
            </p>
          </>
        )}

        {/* Voting phase */}
        {data.phase === 'voting' && targetPlayer && (
          <>
            <p style={{ fontSize: '1rem', color: '#6b7280' }}>Did {targetPlayer.name} do it?</p>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ padding: '1rem 2rem', borderRadius: 16, background: 'rgba(34,197,94,0.1)', border: '2px solid #22c55e44', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem' }}>✅</span>
                <p style={{ fontWeight: 700, color: '#22c55e', margin: '0.25rem 0 0' }}>YES</p>
              </div>
              <div style={{ padding: '1rem 2rem', borderRadius: 16, background: 'rgba(239,68,68,0.1)', border: '2px solid #ef444444', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem' }}>❌</span>
                <p style={{ fontWeight: 700, color: '#ef4444', margin: '0.25rem 0 0' }}>NO</p>
              </div>
            </div>
            <div style={{ width: '100%', maxWidth: 400, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`, height: '100%',
                background: timerFraction > 0.3 ? '#22c55e' : '#ef4444',
                borderRadius: 3, transition: 'width 0.3s linear',
              }} />
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              {data.votedPlayerIds.length} voted
            </p>
          </>
        )}

        {/* Reveal phase */}
        {data.phase === 'reveal' && targetPlayer && (
          <>
            <div style={{
              padding: '1.5rem 3rem', borderRadius: 20, textAlign: 'center',
              background: data.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `2px solid ${data.passed ? '#22c55e' : '#ef4444'}`,
            }}>
              <span style={{ fontSize: '3rem' }}>{data.passed ? '✅' : '❌'}</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: data.passed ? '#22c55e' : '#ef4444' }}>
                {data.passed ? `${targetPlayer.name} did it!` : `${targetPlayer.name} failed!`}
              </h2>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>
                Yes: {data.yesVotes} — No: {data.noVotes}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nonHostPlayers.filter((p) => p.id !== data.targetPlayerId).map((p) => {
                const vote = data.votes[p.id];
                return (
                  <div key={p.id} style={{
                    padding: '0.3rem 0.6rem', borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
                    <span style={{ fontSize: '0.8rem' }}>{vote === true ? '✅' : vote === false ? '❌' : '🤷'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Price is Right Host View ─────────────────────────────────────────────────

const PIR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

function PriceIsRightHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as PriceIsRightData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.guessWindowMs / 10_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        {!data.isReveal && (
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: timerColor }}>
            {Math.ceil(data.guessWindowMs / 1000)}s
          </span>
        )}
        <span style={{ fontSize: '1.5rem' }}>💰</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '0 2rem' }}>

        {/* Category + prompt */}
        <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>{data.category}</span>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#a78bfa', textAlign: 'center', margin: 0 }}>
          {data.prompt}
        </h2>

        {/* Answer reveal */}
        {data.isReveal && data.answer !== null && (
          <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b' }}>
            {data.answer.toLocaleString()} {data.unit}
          </p>
        )}

        {/* Timer */}
        {!data.isReveal && (
          <div style={{ width: '100%', maxWidth: 500, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${timerFraction * 100}%`, height: '100%',
              background: timerColor, borderRadius: 3, transition: 'width 0.3s linear',
            }} />
          </div>
        )}

        {/* Options grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: 600 }}>
          {data.ranges.map((range, i) => {
            const isCorrect = data.isReveal && data.correctIndex === i;
            const isClose = data.isReveal && data.closeIndex === i;
            const bg = data.isReveal
              ? isCorrect ? 'rgba(34,197,94,0.2)' : isClose ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.08)'
              : `${PIR_COLORS[i]}15`;
            const border = data.isReveal
              ? isCorrect ? '#22c55e' : isClose ? '#f59e0b' : '#ef444444'
              : `${PIR_COLORS[i]}44`;

            return (
              <div key={i} style={{
                padding: '1rem', borderRadius: 12,
                background: bg, border: `2px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <span style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: `${PIR_COLORS[i]}25`, color: PIR_COLORS[i],
                  fontWeight: 900, fontSize: '0.9rem',
                }}>
                  {['A', 'B', 'C', 'D'][i]}
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{range}</span>
                {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 800, color: '#22c55e' }}>CORRECT</span>}
                {isClose && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b' }}>CLOSE</span>}
              </div>
            );
          })}
        </div>

        {/* Player guesses on reveal */}
        {data.isReveal && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {nonHostPlayers.map((p) => {
              const guess = data.playerGuesses[p.id];
              const isCorrect = guess === data.correctIndex;
              const isClose = guess === data.closeIndex;
              return (
                <div key={p.id} style={{
                  padding: '0.4rem 0.8rem', borderRadius: 12,
                  background: isCorrect ? 'rgba(34,197,94,0.12)' : isClose ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isCorrect ? '#22c55e' : isClose ? '#f59e0b' : 'rgba(255,255,255,0.06)'}`,
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
                  {guess !== undefined && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: PIR_COLORS[guess] }}>
                      {['A', 'B', 'C', 'D'][guess]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!data.isReveal && (
          <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {data.guessedPlayerIds.length} / {nonHostPlayers.length} guessed
          </p>
        )}
      </div>
    </div>
  );
}

// ── Dodge Ball Host View ─────────────────────────────────────────────────────

const DIR_EMOJI_MAP: Record<string, string> = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };
const DIR_OPPOSITE: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' };

function DodgeBallHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as DodgeBallData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.reactMs / data.maxReactMs;
  const safeDir = data.hazardDirection ? DIR_OPPOSITE[data.hazardDirection] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>🏐</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Warning phase — show incoming hazard */}
        {data.isWarning && data.hazardDirection && (
          <>
            <p style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 600 }}>INCOMING FROM</p>
            <div style={{
              fontSize: '5rem',
              animation: 'pulse 0.4s infinite',
            }}>
              {DIR_EMOJI_MAP[data.hazardDirection]}
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>
              {data.hazardDirection}!
            </p>
            <p style={{ fontSize: '1rem', color: '#f59e0b' }}>Get ready to dodge!</p>
          </>
        )}

        {/* React phase */}
        {!data.isWarning && !data.isReveal && (
          <>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22c55e' }}>DODGE NOW!</p>

            <div style={{ width: '100%', maxWidth: 400, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`, height: '100%',
                background: timerFraction > 0.3 ? '#22c55e' : '#ef4444',
                borderRadius: 4, transition: 'width 0.3s linear',
              }} />
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              {data.dodgedPlayerIds.length} dodged
            </p>
          </>
        )}

        {/* Reveal phase */}
        {data.isReveal && (
          <>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Safe direction was</p>
              <span style={{ fontSize: '3rem' }}>{safeDir ? DIR_EMOJI_MAP[safeDir] : '?'}</span>
              <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase' }}>{safeDir}</p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nonHostPlayers.map((p) => {
                const dodge = data.playerDodges[p.id];
                const survived = data.survivors.includes(p.id);
                const eliminated = data.eliminatedPlayers.includes(p.id);
                const lives = data.lives[p.id] ?? 0;
                return (
                  <div key={p.id} style={{
                    padding: '0.5rem 1rem', borderRadius: 14,
                    background: eliminated ? 'rgba(100,100,100,0.1)' : survived ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                    border: `2px solid ${eliminated ? '#555' : survived ? '#22c55e' : '#ef4444'}`,
                    textAlign: 'center', minWidth: 75, opacity: eliminated ? 0.5 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center', marginBottom: '0.2rem' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
                    </div>
                    {dodge && <span style={{ fontSize: '1.2rem' }}>{DIR_EMOJI_MAP[dodge]}</span>}
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: survived ? '#22c55e' : '#ef4444', margin: '0.1rem 0 0' }}>
                      {eliminated ? 'OUT' : survived ? 'SAFE' : 'HIT'}
                    </p>
                    <p style={{ fontSize: '0.6rem', color: '#6b7280', margin: 0 }}>
                      {'❤️'.repeat(lives)}{'🖤'.repeat(Math.max(0, 3 - lives))}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Button Mash Race Host View ───────────────────────────────────────────────

const MASH_BUTTON_COLORS: Record<string, string> = { A: '#ef4444', B: '#3b82f6', C: '#22c55e', D: '#f59e0b' };

function ButtonMashHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as ButtonMashData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.raceTimeMs / 10_000;
  const activeColor = MASH_BUTTON_COLORS[data.activeButton] ?? '#888';
  const getName = (id: string) => nonHostPlayers.find((p) => p.id === id)?.name ?? '?';

  // Sort players by position for display
  const sorted = [...nonHostPlayers].sort((a, b) => (data.positions[b.id] ?? 0) - (data.positions[a.id] ?? 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        {data.isRacing && (
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: timerFraction > 0.3 ? '#22c55e' : '#ef4444' }}>
            {Math.ceil(data.raceTimeMs / 1000)}s
          </span>
        )}
        <span style={{ fontSize: '1.5rem' }}>🏃</span>
      </div>

      {/* Active button indicator */}
      {data.isRacing && (
        <div style={{ textAlign: 'center', padding: '0.5rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>MASH THIS BUTTON</p>
          <span style={{ fontSize: '3rem', fontWeight: 900, color: activeColor }}>{data.activeButton}</span>
        </div>
      )}

      {/* Race lanes */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.75rem', padding: '0 2rem' }}>
        {sorted.map((p) => {
          const pos = data.positions[p.id] ?? 0;
          const fraction = pos / 100;
          const isWinner = p.id === data.roundWinner;
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 80, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f0f0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </div>
              <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${fraction * 100}%`,
                  height: '100%',
                  background: isWinner
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : `linear-gradient(90deg, ${AVATAR_COLOR_HEX[p.avatarColor]}88, ${AVATAR_COLOR_HEX[p.avatarColor]})`,
                  borderRadius: 12,
                  transition: 'width 0.1s linear',
                }} />
                {isWinner && (
                  <span style={{ position: 'absolute', right: 8, top: 2, fontSize: '0.75rem', fontWeight: 900, color: '#fff' }}>
                    WINNER!
                  </span>
                )}
              </div>
              <span style={{ width: 35, fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textAlign: 'right' }}>
                {pos}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Round end */}
      {data.isRoundEnd && data.roundWinner && (
        <div style={{ textAlign: 'center', padding: '1rem', flexShrink: 0 }}>
          <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#22c55e' }}>
            {getName(data.roundWinner)} wins the race!
          </p>
        </div>
      )}
    </div>
  );
}

// ── Floor is Lava Host View ──────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = { A: '#ef4444', B: '#3b82f6', C: '#22c55e', D: '#f59e0b' };

function FloorIsLavaHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as FloorIsLavaData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.jumpWindowMs / data.maxJumpMs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>🌋</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Platforms 2x2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: 400 }}>
          {(['A', 'B', 'C', 'D'] as const).map((p) => {
            const isSafe = data.safePlatform === p;
            const showSafe = (data.isFlashing || data.isReveal) && isSafe;
            const color = PLATFORM_COLORS[p];
            return (
              <div key={p} style={{
                aspectRatio: '1.5', borderRadius: 16,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: showSafe ? `${color}30` : data.isReveal && !isSafe ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                border: `3px solid ${showSafe ? color : data.isReveal && !isSafe ? '#ef444466' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: showSafe ? `0 0 25px ${color}44` : 'none',
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: showSafe ? color : '#555' }}>{p}</span>
                {showSafe && <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>SAFE!</span>}
                {data.isReveal && !isSafe && <span style={{ fontSize: '1.5rem' }}>🌋</span>}
              </div>
            );
          })}
        </div>

        {/* Phase messages */}
        {data.isFlashing && (
          <p style={{ color: '#f59e0b', fontSize: '1.3rem', fontWeight: 800, textAlign: 'center' }}>
            Remember the safe platform!
          </p>
        )}

        {!data.isFlashing && !data.isReveal && (
          <>
            <p style={{ color: '#ef4444', fontSize: '1.3rem', fontWeight: 800 }}>JUMP NOW!</p>
            <div style={{ width: '100%', maxWidth: 400, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`, height: '100%',
                background: timerFraction > 0.3 ? '#22c55e' : '#ef4444',
                borderRadius: 4, transition: 'width 0.3s linear',
              }} />
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              {data.jumpedPlayerIds.length} jumped
            </p>
          </>
        )}

        {/* Reveal — player results */}
        {data.isReveal && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {nonHostPlayers.map((p) => {
              const jump = data.playerJumps[p.id];
              const survived = data.survivors.includes(p.id);
              const eliminated = data.eliminatedPlayers.includes(p.id);
              const lives = data.lives[p.id] ?? 0;
              return (
                <div key={p.id} style={{
                  padding: '0.6rem 1rem', borderRadius: 14,
                  background: eliminated ? 'rgba(100,100,100,0.1)' : survived ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                  border: `2px solid ${eliminated ? '#555' : survived ? '#22c55e' : '#ef4444'}`,
                  textAlign: 'center', minWidth: 80, opacity: eliminated ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center', marginBottom: '0.2rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
                  </div>
                  {jump && <span style={{ fontSize: '1.2rem', fontWeight: 900, color: PLATFORM_COLORS[jump] }}>{jump}</span>}
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: survived ? '#22c55e' : '#ef4444', margin: '0.15rem 0 0' }}>
                    {eliminated ? 'OUT' : survived ? 'SAFE' : 'FELL'}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: '#6b7280', margin: 0 }}>
                    {'❤️'.repeat(lives)}{'🖤'.repeat(Math.max(0, 3 - lives))}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Whack-a-Mole Host View ───────────────────────────────────────────────────

const ZONE_POS: Record<string, { row: number; col: number }> = {
  A: { row: 0, col: 0 }, B: { row: 0, col: 1 },
  C: { row: 1, col: 0 }, D: { row: 1, col: 1 },
};
const ZONE_COLORS = { A: '#ef4444', B: '#3b82f6', C: '#22c55e', D: '#f59e0b' };

function WhackAMoleHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as WhackAMoleData;
  const nonHostPlayers = players.filter((p) => !p.isHost);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>
          Target {Math.min(data.targetIndex + 1, data.totalTargets)} / {data.totalTargets}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>🔨</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {data.isRoundPause ? (
          <>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a78bfa' }}>Round {data.round} Complete!</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nonHostPlayers.map((p) => {
                const hits = data.roundHits[p.id] ?? 0;
                const misses = data.roundMisses[p.id] ?? 0;
                return (
                  <div key={p.id} style={{
                    padding: '0.75rem 1.25rem', borderRadius: 16,
                    background: 'rgba(255,255,255,0.03)',
                    border: '2px solid rgba(255,255,255,0.06)',
                    textAlign: 'center', minWidth: 90,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', marginBottom: '0.3rem' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#22c55e', fontWeight: 800, margin: 0 }}>{hits} hits</p>
                    {misses > 0 && <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: 0 }}>{misses} miss</p>}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* 2x2 Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem', width: '100%', maxWidth: 400,
            }}>
              {(['A', 'B', 'C', 'D'] as const).map((zone) => {
                const isActive = data.activeZone === zone;
                const color = ZONE_COLORS[zone];
                return (
                  <div key={zone} style={{
                    aspectRatio: '1', borderRadius: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive
                      ? data.isDecoy ? 'rgba(239,68,68,0.3)' : `${color}30`
                      : 'rgba(255,255,255,0.03)',
                    border: `3px solid ${isActive
                      ? data.isDecoy ? '#ef4444' : color
                      : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.1s',
                    boxShadow: isActive ? `0 0 30px ${data.isDecoy ? '#ef444444' : color + '44'}` : 'none',
                  }}>
                    {isActive ? (
                      <span style={{ fontSize: '3rem' }}>{data.isDecoy ? '❌' : '🎯'}</span>
                    ) : (
                      <span style={{ fontSize: '1.5rem', color: '#333', fontWeight: 900 }}>{zone}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {data.isDecoy && data.activeZone && (
              <p style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 700 }}>DECOY! Don&apos;t tap!</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Bomb Defuse Host View ────────────────────────────────────────────────────

const WIRE_HEX: Record<string, string> = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308' };
const WIRE_EMOJI: Record<string, string> = { red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡' };

function BombDefuseHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as BombDefuseData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.pickWindowMs / data.maxPickMs;
  const isUrgent = timerFraction < 0.3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>💣</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {!data.isReveal ? (
          <>
            {/* Bomb */}
            <div style={{
              fontSize: isUrgent ? '6rem' : '5rem',
              transition: 'font-size 0.3s',
              animation: isUrgent ? 'pulse 0.5s infinite' : undefined,
            }}>
              💣
            </div>

            <p style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 800 }}>
              CUT A WIRE!
            </p>

            {/* Wire options */}
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              {(['red', 'blue', 'green', 'yellow'] as const).map((w) => (
                <div key={w} style={{
                  padding: '0.75rem 1.5rem', borderRadius: 12,
                  background: `${WIRE_HEX[w]}15`, border: `2px solid ${WIRE_HEX[w]}44`,
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: '2rem' }}>{WIRE_EMOJI[w]}</span>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: WIRE_HEX[w], textTransform: 'capitalize', margin: '0.25rem 0 0' }}>{w}</p>
                </div>
              ))}
            </div>

            {/* Timer */}
            <div style={{ width: '100%', maxWidth: 400, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`, height: '100%',
                background: isUrgent ? '#ef4444' : '#22c55e',
                borderRadius: 4, transition: 'width 0.3s linear',
              }} />
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              {data.cutPlayerIds.length} / {nonHostPlayers.length} cut a wire
            </p>
          </>
        ) : (
          <>
            {/* Reveal */}
            <p style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 600 }}>THE SAFE WIRE WAS</p>
            <div style={{
              padding: '1rem 3rem', borderRadius: 16,
              background: data.correctWire ? `${WIRE_HEX[data.correctWire]}20` : 'transparent',
              border: `3px solid ${data.correctWire ? WIRE_HEX[data.correctWire] : '#888'}`,
            }}>
              <span style={{ fontSize: '3rem' }}>{data.correctWire ? WIRE_EMOJI[data.correctWire] : '?'}</span>
              <p style={{ fontSize: '1.2rem', fontWeight: 900, color: data.correctWire ? WIRE_HEX[data.correctWire] : '#888', textTransform: 'capitalize', textAlign: 'center', margin: '0.25rem 0 0' }}>
                {data.correctWire}
              </p>
            </div>

            {/* Player results */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nonHostPlayers.map((p) => {
                const cut = data.playerCuts[p.id];
                const survived = data.survivors.includes(p.id);
                const streak = data.streaks[p.id] ?? 0;
                return (
                  <div key={p.id} style={{
                    padding: '0.75rem 1.25rem', borderRadius: 16,
                    background: survived ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                    border: `2px solid ${survived ? '#22c55e' : '#ef4444'}`,
                    textAlign: 'center', minWidth: 90,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', marginBottom: '0.3rem' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
                    </div>
                    {cut ? (
                      <span style={{ fontSize: '1.5rem' }}>{WIRE_EMOJI[cut]}</span>
                    ) : (
                      <span style={{ fontSize: '1rem', color: '#6b7280' }}>No cut</span>
                    )}
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: survived ? '#22c55e' : '#ef4444', margin: '0.2rem 0 0' }}>
                      {survived ? 'SAFE!' : 'BOOM!'}
                    </p>
                    {streak >= 3 && survived && (
                      <p style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, margin: 0 }}>
                        {streak} streak!
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Rock Paper Scissors Host View ────────────────────────────────────────────

const MOVE_EMOJI: Record<string, string> = { rock: '🪨', paper: '📄', scissors: '✂️' };
const MOVE_COLOR: Record<string, string> = { rock: '#6b7280', paper: '#3b82f6', scissors: '#ef4444' };

function RPSHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as RPSData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.pickWindowMs / 5_000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>✊</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {!data.isReveal ? (
          <>
            {/* Pick phase */}
            <div style={{ display: 'flex', gap: '2rem', fontSize: '4rem' }}>
              <span>🪨</span><span>📄</span><span>✂️</span>
            </div>

            <p style={{ color: '#a78bfa', fontSize: '1.5rem', fontWeight: 800 }}>
              Choose your move!
            </p>

            {/* Timer */}
            <div style={{ width: '100%', maxWidth: 400, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`, height: '100%',
                background: timerFraction > 0.3 ? '#22c55e' : '#ef4444',
                borderRadius: 4, transition: 'width 0.3s linear',
              }} />
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              {data.pickedPlayerIds.length} / {nonHostPlayers.length} locked in
            </p>
          </>
        ) : (
          <>
            {/* Reveal phase */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nonHostPlayers.map((p) => {
                const choice = data.choices[p.id];
                const result = data.results[p.id];
                const isNetWinner = result && result.wins > result.losses;
                return (
                  <div key={p.id} style={{
                    padding: '1rem 1.5rem', borderRadius: 16,
                    background: isNetWinner ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${isNetWinner ? '#22c55e' : 'rgba(255,255,255,0.06)'}`,
                    textAlign: 'center', minWidth: 100,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0f0ff' }}>{p.name}</span>
                    </div>
                    {choice ? (
                      <>
                        <span style={{ fontSize: '3rem' }}>{MOVE_EMOJI[choice]}</span>
                        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: MOVE_COLOR[choice], textTransform: 'capitalize', margin: '0.25rem 0 0' }}>
                          {choice}
                        </p>
                      </>
                    ) : (
                      <span style={{ fontSize: '2rem', color: '#6b7280' }}>?</span>
                    )}
                    {result && (
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                        {result.wins}W {result.losses}L {result.draws}D
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Category Sprint Host View ───────────────────────────────────────────────

function CategorySprintHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as CategorySprintData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.timeRemainingMs / 8_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';
  const isReveal = data.correctAnswer !== undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>📋</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Category */}
        <div style={{
          padding: '1rem 2.5rem', borderRadius: 16,
          background: 'rgba(124,58,237,0.1)',
          border: '2px solid rgba(124,58,237,0.3)',
        }}>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, textAlign: 'center' }}>CATEGORY</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#a78bfa', textAlign: 'center' }}>
            {data.category}
          </h2>
        </div>

        <p style={{ color: '#9ca3af', fontSize: '1rem', fontWeight: 600 }}>
          {isReveal ? 'Correct answers highlighted!' : 'Tap the one that belongs!'}
        </p>

        {/* Timer */}
        {!isReveal && (
          <div style={{ width: '100%', maxWidth: 500, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${timerFraction * 100}%`, height: '100%',
              background: timerColor, borderRadius: 4, transition: 'width 0.3s linear',
            }} />
          </div>
        )}

        {/* Options grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: 600 }}>
          {data.options.map((opt, i) => {
            const optColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
            const labels = ['A', 'B', 'C', 'D'];
            const isCorrect = isReveal && data.correctAnswer?.includes(i);
            const bg = isReveal
              ? isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.08)'
              : `${optColors[i]}15`;
            const border = isReveal
              ? isCorrect ? '#22c55e' : '#ef444444'
              : `${optColors[i]}44`;

            return (
              <div key={i} style={{
                padding: '1rem 1.25rem', borderRadius: 12,
                background: bg, border: `2px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <span style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: optColors[i], display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.85rem', color: '#fff', flexShrink: 0,
                }}>{labels[i]}</span>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: isCorrect ? '#22c55e' : '#f0f0ff' }}>{opt}</span>
                {isReveal && isCorrect && <span style={{ marginLeft: 'auto' }}>✅</span>}
                {isReveal && !isCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>❌</span>}
              </div>
            );
          })}
        </div>

        {/* Players */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {nonHostPlayers.map((p) => {
            const answered = data.answeredPlayerIds.includes(p.id);
            const frozen = (data.frozenPlayers[p.id] ?? 0) > 0;
            const gotRight = isReveal && data.playerAnswers?.[p.id] !== undefined && data.correctAnswer?.includes(data.playerAnswers[p.id]!);
            return (
              <div key={p.id} style={{
                padding: '0.4rem 0.8rem', borderRadius: 10,
                background: frozen ? 'rgba(59,130,246,0.15)' : answered ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${frozen ? '#3b82f644' : answered ? '#7c3aed33' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: frozen ? '#3b82f6' : '#f0f0ff' }}>{p.name}</span>
                {frozen && <span style={{ fontSize: '0.65rem', color: '#3b82f6' }}>🧊 FROZEN</span>}
                {isReveal && gotRight && <span style={{ fontSize: '0.7rem' }}>✅</span>}
                {isReveal && answered && !gotRight && <span style={{ fontSize: '0.7rem' }}>❌</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Debate Club Host View ───────────────────────────────────────────────────

function DebateClubHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as DebateClubData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const getName = (id: string) => nonHostPlayers.find((p) => p.id === id)?.name ?? '?';
  const timerFraction = data.voteWindowMs / 8_000;

  const isVoting = data.phase === 'vote1' || data.phase === 'revote';
  const isReveal = data.phase === 'reveal1' || data.phase === 'reveal_final';
  const isFinalReveal = data.phase === 'reveal_final';

  const agreeP = isFinalReveal ? data.revoteAgreePercent : data.agreePercent;
  const disagreeP = isFinalReveal ? data.revoteDisagreePercent : data.disagreePercent;
  const agreeNames = isFinalReveal ? data.revoteAgreeIds : data.agreePlayerIds;
  const disagreeNames = isFinalReveal ? data.revoteDisagreeIds : data.disagreePlayerIds;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        {data.phase === 'revote' && (
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>REVOTE!</span>
        )}
        <span style={{ fontSize: '1.5rem' }}>🎤</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Statement */}
        <div style={{
          padding: '2rem 3rem', borderRadius: 20,
          background: 'rgba(124,58,237,0.08)',
          border: '2px solid rgba(124,58,237,0.2)',
          maxWidth: 700, textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>HOT TAKE</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#f0f0ff', lineHeight: 1.3 }}>
            &ldquo;{data.statement}&rdquo;
          </h2>
        </div>

        {/* Voting phase */}
        {isVoting && (
          <>
            <div style={{ width: '100%', maxWidth: 400, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${timerFraction * 100}%`, height: '100%',
                background: timerFraction > 0.3 ? '#22c55e' : '#ef4444',
                borderRadius: 3, transition: 'width 0.3s linear',
              }} />
            </div>

            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ padding: '1rem 2rem', borderRadius: 16, background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem' }}>👍</span>
                <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem' }}>AGREE</p>
              </div>
              <div style={{ padding: '1rem 2rem', borderRadius: 16, background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem' }}>👎</span>
                <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem' }}>DISAGREE</p>
              </div>
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              {data.votedPlayerIds.length} / {nonHostPlayers.length} voted
            </p>
          </>
        )}

        {/* Reveal phase */}
        {isReveal && (
          <>
            {/* Bar chart */}
            <div style={{ width: '100%', maxWidth: 600, display: 'flex', height: 50, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                width: `${agreeP}%`, background: '#22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '1.2rem', color: '#fff',
                transition: 'width 0.5s ease',
                minWidth: agreeP > 0 ? 50 : 0,
              }}>
                {agreeP > 0 && `${agreeP}%`}
              </div>
              <div style={{
                width: `${disagreeP}%`, background: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '1.2rem', color: '#fff',
                transition: 'width 0.5s ease',
                minWidth: disagreeP > 0 ? 50 : 0,
              }}>
                {disagreeP > 0 && `${disagreeP}%`}
              </div>
            </div>

            {/* Voter names */}
            <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>AGREE</p>
                {agreeNames.map((id) => (
                  <p key={id} style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{getName(id)}</p>
                ))}
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>DISAGREE</p>
                {disagreeNames.map((id) => (
                  <p key={id} style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{getName(id)}</p>
                ))}
              </div>
            </div>

            {isFinalReveal && data.mindsChanged > 0 && (
              <p style={{ color: '#f59e0b', fontWeight: 800, fontSize: '1.1rem' }}>
                {data.mindsChanged} mind{data.mindsChanged > 1 ? 's' : ''} changed!
              </p>
            )}

            {data.phase === 'reveal1' && (
              <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '1rem' }}>
                Minority must defend their position... Revote incoming!
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Simon Says Host View ────────────────────────────────────────────────────

const SIMON_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const SIMON_LABELS = ['Red', 'Blue', 'Green', 'Yellow'];
const SIMON_IDS = ['A', 'B', 'C', 'D'];

function SimonSaysHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as SimonSaysData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const getName = (id: string) => nonHostPlayers.find((p) => p.id === id)?.name ?? '?';
  const getColor = (id: string) => {
    const p = nonHostPlayers.find((pl) => pl.id === id);
    return p ? AVATAR_COLOR_HEX[p.avatarColor] : '#888';
  };

  const highlightIdx = data.highlightButton ? SIMON_IDS.indexOf(data.highlightButton) : -1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Sequence: {data.sequenceLength} / {data.maxSequence}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: 600 }}>
          {data.alivePlayers.length} alive
        </span>
        <span style={{ fontSize: '1.5rem' }}>🧠</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Phase label */}
        {data.showPhase && (
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a78bfa' }}>Watch the sequence...</h2>
        )}
        {data.inputPhase && (
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>Your turn! Repeat it!</h2>
        )}
        {data.isReveal && (
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e' }}>
            {data.roundSurvivors.length > 0 ? 'Round complete!' : 'Everyone eliminated!'}
          </h2>
        )}

        {/* Color buttons grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {SIMON_IDS.map((id, i) => {
            const isHighlighted = data.showPhase && highlightIdx === i;
            return (
              <div key={id} style={{
                width: 120, height: 120, borderRadius: 20,
                background: isHighlighted ? SIMON_COLORS[i] : `${SIMON_COLORS[i]}33`,
                border: `3px solid ${SIMON_COLORS[i]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s ease',
                boxShadow: isHighlighted ? `0 0 40px ${SIMON_COLORS[i]}88` : 'none',
              }}>
                <span style={{
                  fontSize: '1.2rem', fontWeight: 800,
                  color: isHighlighted ? '#fff' : SIMON_COLORS[i],
                  opacity: isHighlighted ? 1 : 0.6,
                }}>
                  {SIMON_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Input timer */}
        {data.inputPhase && (
          <div style={{ width: '100%', maxWidth: 400, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${(data.inputTimeMs / 3000) * 100}%`,
              height: '100%',
              background: data.inputTimeMs > 1500 ? '#22c55e' : '#ef4444',
              borderRadius: 3,
              transition: 'width 0.2s linear',
            }} />
          </div>
        )}

        {/* Players status */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {nonHostPlayers.map((p) => {
            const alive = data.alivePlayers.includes(p.id);
            const eliminated = data.eliminatedPlayers.includes(p.id);
            const progress = data.playerProgress[p.id] ?? 0;
            const survived = data.isReveal && data.roundSurvivors.includes(p.id);
            return (
              <div key={p.id} style={{
                padding: '0.5rem 0.8rem', borderRadius: 12,
                background: eliminated ? 'rgba(239,68,68,0.08)' : survived ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${eliminated ? '#ef444433' : survived ? '#22c55e33' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                opacity: eliminated ? 0.5 : 1,
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: getColor(p.id) }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f0f0ff' }}>{getName(p.id)}</span>
                {data.inputPhase && alive && (
                  <span style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 700 }}>
                    {progress}/{data.sequenceLength}
                  </span>
                )}
                {eliminated && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>OUT</span>}
                {survived && <span style={{ fontSize: '0.7rem' }}>✅</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tug of War Host View ────────────────────────────────────────────────────

function TugOfWarHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as TugOfWarData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.timeRemainingMs / 10_000;
  const getName = (id: string) => nonHostPlayers.find((p) => p.id === id)?.name ?? '?';
  const getColor = (id: string) => {
    const p = nonHostPlayers.find((pl) => pl.id === id);
    return p ? AVATAR_COLOR_HEX[p.avatarColor] : '#888';
  };

  // Rope visual: position 0-100 maps to left-right
  const ropePercent = data.ropePosition;
  const teamAColor = '#ef4444';
  const teamBColor = '#3b82f6';
  const ropeColor = ropePercent < 45 ? teamAColor : ropePercent > 55 ? teamBColor : '#f59e0b';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: teamAColor }}>
          Team A: {data.teamAWins}
        </span>
        <span style={{ color: '#374151' }}>|</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: teamBColor }}>
          Team B: {data.teamBWins}
        </span>
        <span style={{ fontSize: '1.5rem' }}>🪢</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Team labels */}
        <div style={{ display: 'flex', width: '100%', maxWidth: 700, justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: teamAColor }}>Team A</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
              {data.teamA.map((id) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.5rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(id) }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f0f0ff' }}>{getName(id)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: teamBColor }}>Team B</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
              {data.teamB.map((id) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.5rem', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(id) }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f0f0ff' }}>{getName(id)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rope visualization */}
        <div style={{ width: '100%', maxWidth: 700, position: 'relative' }}>
          {/* Track */}
          <div style={{
            width: '100%', height: 16, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            position: 'relative', overflow: 'visible',
          }}>
            {/* Center mark */}
            <div style={{ position: 'absolute', left: '50%', top: -8, bottom: -8, width: 2, background: 'rgba(255,255,255,0.2)' }} />
            {/* Win zones */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '20%', background: `${teamAColor}22`, borderRadius: '8px 0 0 8px' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '20%', background: `${teamBColor}22`, borderRadius: '0 8px 8px 0' }} />
            {/* Rope knot */}
            <div style={{
              position: 'absolute',
              left: `${ropePercent}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 40, height: 40, borderRadius: '50%',
              background: ropeColor,
              boxShadow: `0 0 20px ${ropeColor}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', fontWeight: 900, color: '#fff',
              transition: 'left 0.1s linear',
            }}>
              🪢
            </div>
          </div>

          {/* Tap counts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: teamAColor }}>{data.teamATaps}</span>
            <span style={{ fontSize: '0.85rem', color: '#6b7280', alignSelf: 'center' }}>taps</span>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: teamBColor }}>{data.teamBTaps}</span>
          </div>
        </div>

        {/* Timer */}
        {!data.isReveal && (
          <div style={{ width: '100%', maxWidth: 500, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${timerFraction * 100}%`,
              height: '100%',
              background: timerFraction > 0.3 ? '#22c55e' : '#ef4444',
              borderRadius: 3,
              transition: 'width 0.3s linear',
            }} />
          </div>
        )}

        {/* Round result */}
        {data.isReveal && data.roundWinner && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '2.5rem', fontWeight: 900,
              color: data.roundWinner === 'A' ? teamAColor : data.roundWinner === 'B' ? teamBColor : '#f59e0b',
            }}>
              {data.roundWinner === 'draw' ? 'Draw!' : `Team ${data.roundWinner} wins!`}
            </div>
          </div>
        )}

        {!data.isReveal && (
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a78bfa', textAlign: 'center' }}>
            TAP TAP TAP!
          </p>
        )}
      </div>
    </div>
  );
}

// ── Emoji Decoder Host View ─────────────────────────────────────────────────

function EmojiDecoderHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as EmojiDecoderData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const timerFraction = data.timeRemainingMs / 12_000;
  const timerColor = timerFraction > 0.5 ? '#22c55e' : timerFraction > 0.25 ? '#f59e0b' : '#ef4444';
  const isReveal = data.correctAnswer !== undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem 2rem', flexShrink: 0 }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '1.5rem' }}>😎</span>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0 2rem' }}>

        {/* Emoji display */}
        <div style={{
          fontSize: '6rem',
          lineHeight: 1.2,
          textAlign: 'center',
          padding: '1rem',
          filter: isReveal ? 'none' : 'drop-shadow(0 0 20px rgba(255,255,255,0.2))',
        }}>
          {data.emojis}
        </div>

        {!isReveal && (
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a78bfa', textAlign: 'center' }}>
            What does this mean?
          </h2>
        )}

        {/* Timer */}
        {!isReveal && (
          <div style={{ width: '100%', maxWidth: 500, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${timerFraction * 100}%`,
              height: '100%',
              background: timerColor,
              borderRadius: 4,
              transition: 'width 0.3s linear',
            }} />
          </div>
        )}

        {/* Answer options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: 600 }}>
          {data.options.map((opt, i) => {
            const optColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
            const labels = ['A', 'B', 'C', 'D'];
            const isCorrect = isReveal && i === data.correctAnswer;
            const bg = isReveal
              ? isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)'
              : `${optColors[i]}15`;
            const border = isReveal
              ? isCorrect ? '#22c55e' : 'rgba(255,255,255,0.06)'
              : `${optColors[i]}44`;

            return (
              <div key={i} style={{
                padding: '1rem 1.25rem',
                borderRadius: 12,
                background: bg,
                border: `2px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <span style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: optColors[i],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.85rem', color: '#fff', flexShrink: 0,
                }}>
                  {labels[i]}
                </span>
                <span style={{
                  fontWeight: 700, fontSize: '1rem',
                  color: isCorrect ? '#22c55e' : '#f0f0ff',
                }}>
                  {opt}
                </span>
                {isReveal && isCorrect && <span style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>✅</span>}
              </div>
            );
          })}
        </div>

        {/* Player answer status */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {nonHostPlayers.map((p) => {
            const answered = data.answeredPlayerIds.includes(p.id);
            const playerAnswer = data.playerAnswers?.[p.id];
            const gotItRight = isReveal && playerAnswer === data.correctAnswer;
            return (
              <div key={p.id} style={{
                padding: '0.4rem 0.8rem', borderRadius: 10,
                background: isReveal
                  ? gotItRight ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.08)'
                  : answered ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isReveal ? (gotItRight ? '#22c55e33' : '#ef444433') : answered ? '#7c3aed33' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor] }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: answered ? '#f0f0ff' : '#6b7280' }}>
                  {p.name}
                </span>
                {isReveal && gotItRight && <span style={{ fontSize: '0.7rem' }}>✅</span>}
                {isReveal && !gotItRight && answered && <span style={{ fontSize: '0.7rem' }}>❌</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Retro Pong Host View ───────────────────────────────────────────────────

const SIDE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b']; // left, right, top, bottom
const SIDE_NAMES = ['Left', 'Right', 'Top', 'Bottom'];

function RetroPongHostView({ state, players }: { state: GameState; players: Player[] }) {
  const data = state.data as RetroPongData;
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const arenaSize = 500; // px
  const scale = arenaSize / data.arena;

  const getName = (id: string) => nonHostPlayers.find((p) => p.id === id)?.name ?? '?';
  const getColor = (id: string) => {
    const p = nonHostPlayers.find((pl) => pl.id === id);
    return p ? AVATAR_COLOR_HEX[p.avatarColor] : '#888';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a16', color: '#fff', alignItems: 'center' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 2rem', flexShrink: 0, width: '100%' }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>
          Round {data.round} / {data.totalRounds}
        </span>
        <div style={{ flex: 1 }} />
        {/* Round points */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          {Object.entries(data.paddles).map(([id, paddle]) => (
            <span key={id} style={{ fontSize: '0.85rem', fontWeight: 700, color: SIDE_COLORS[paddle.side] }}>
              {getName(id)}: {data.roundPoints[id] ?? 0}/{data.roundScoresNeeded}
            </span>
          ))}
        </div>
        <span style={{ fontSize: '1.5rem' }}>🏓</span>
      </div>

      {/* Arena */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          position: 'relative',
          width: arenaSize,
          height: arenaSize,
          background: '#111122',
          border: '2px solid rgba(255,255,255,0.1)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          {/* Center line */}
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Paddles */}
          {Object.entries(data.paddles).map(([id, paddle]) => {
            const color = getColor(id);
            const len = paddle.length * scale;
            const thick = paddle.thickness * scale;
            const offset = paddle.offset * scale;
            const pos = paddle.pos * scale;

            let style: React.CSSProperties;
            if (paddle.side === 0) { // left
              style = { left: offset, top: pos - len / 2, width: thick, height: len };
            } else if (paddle.side === 1) { // right
              style = { right: offset, top: pos - len / 2, width: thick, height: len };
            } else if (paddle.side === 2) { // top
              style = { top: offset, left: pos - len / 2, height: thick, width: len };
            } else { // bottom
              style = { bottom: offset, left: pos - len / 2, height: thick, width: len };
            }

            return (
              <div key={id} style={{
                position: 'absolute',
                ...style,
                background: paddle.eliminated ? '#374151' : color,
                borderRadius: 2,
                transition: 'top 0.05s linear, left 0.05s linear',
                boxShadow: paddle.eliminated ? 'none' : `0 0 10px ${color}66`,
              }} />
            );
          })}

          {/* Ball */}
          {data.ball && (
            <div style={{
              position: 'absolute',
              left: data.ball.x * scale - data.ball.radius * scale,
              top: data.ball.y * scale - data.ball.radius * scale,
              width: data.ball.radius * 2 * scale,
              height: data.ball.radius * 2 * scale,
              borderRadius: '50%',
              background: '#f0f0ff',
              boxShadow: '0 0 12px rgba(240,240,255,0.6)',
            }} />
          )}

          {/* Serve countdown */}
          {data.isServing && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.3)',
            }}>
              <span style={{ fontSize: '3rem', fontWeight: 900, color: '#a78bfa' }}>
                {Math.ceil(data.serveMs / 1000)}
              </span>
            </div>
          )}

          {/* Round end overlay */}
          {data.isRoundEnd && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              gap: '1rem',
            }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#22c55e' }}>Round Over!</span>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                {Object.entries(data.roundPoints)
                  .sort(([, a], [, b]) => b - a)
                  .map(([id, pts]) => (
                    <div key={id} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getColor(id) }}>{pts}</div>
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{getName(id)}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Player labels on sides */}
          {Object.entries(data.paddles).map(([id, paddle]) => {
            const name = getName(id);
            let labelStyle: React.CSSProperties;
            if (paddle.side === 0) labelStyle = { left: 8, top: '50%', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'center' };
            else if (paddle.side === 1) labelStyle = { right: 8, top: '50%', transform: 'translateY(-50%) rotate(90deg)', transformOrigin: 'center' };
            else if (paddle.side === 2) labelStyle = { top: 8, left: '50%', transform: 'translateX(-50%)' };
            else labelStyle = { bottom: 8, left: '50%', transform: 'translateX(-50%)' };

            return (
              <span key={`label-${id}`} style={{
                position: 'absolute',
                ...labelStyle,
                fontSize: '0.7rem',
                fontWeight: 700,
                color: SIDE_COLORS[paddle.side],
                opacity: 0.6,
                whiteSpace: 'nowrap',
              }}>
                {name}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Host Page ─────────────────────────────────────────────────────────────

export default function HostPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const toastCounterRef = useRef(0);

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<HostStatus>('connecting');
  const [gameId, setGameId] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Game picker state
  const [selectedGame, setSelectedGame] = useState<'trivia' | 'reaction' | 'colormatch' | 'mathrace' | 'wordscramble' | 'hotpotato' | 'trueorfalse' | 'tapfrenzy' | 'blindtest' | 'neverhaveiever' | 'colorflash' | 'wouldyourather' | 'luckynumber' | 'retropong' | 'emojidecoder' | 'tugofwar' | 'simonsays' | 'debateclub' | 'categorysprint' | 'auctionhouse' | 'rps' | 'bombdefuse' | 'whackamole' | 'floorislava' | 'buttonmash' | 'dodgeball' | 'priceisright' | 'spinthewheel'>('trivia');
  const [triviaDifficulty, setTriviaDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [selectedRounds, setSelectedRounds] = useState(1);
  // Session scores — cumulative across all games in this party session
  const [sessionScores, setSessionScores] = useState<Record<string, number>>({});

  const addToast = useCallback((message: string, color: string) => {
    const id = ++toastCounterRef.current;
    setToasts((prev) => [...prev, { id, message, color }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      const msg: ClientToServerMessage = { type: 'HOST_CREATE_ROOM' };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerToClientMessage;
      switch (msg.type) {
        case 'ROOM_CREATED':
          setRoomCode(msg.roomCode);
          setStatus('waiting');
          break;
        case 'PLAYER_JOINED':
          setPlayers((prev) => [...prev, msg.player]);
          addToast(`${msg.player.name} joined!`, '#22c55e');
          playPlayerJoin();
          break;
        case 'PLAYER_LEFT':
          setPlayers((prev) => {
            const leaving = prev.find((p) => p.id === msg.playerId);
            if (leaving && !leaving.isHost) addToast(`${leaving.name} left`, '#f97316');
            return prev.filter((p) => p.id !== msg.playerId);
          });
          playPlayerLeave();
          break;
        case 'PLAYER_KICKED':
          setPlayers((prev) => {
            const kicked = prev.find((p) => p.id === msg.playerId);
            if (kicked) addToast(`${kicked.name} was kicked`, '#f87171');
            return prev.filter((p) => p.id !== msg.playerId);
          });
          break;
        case 'PLAYER_READY_CHANGED':
          setPlayers((prev) =>
            prev.map((p) => (p.id === msg.playerId ? { ...p, isReady: msg.isReady } : p)),
          );
          break;
        case 'ROOM_STATUS_CHANGED':
          if (msg.status === 'ready' || msg.status === 'waiting' || msg.status === 'finished') {
            setStatus(msg.status);
          }
          break;
        case 'GAME_STARTED':
          setStatus('playing');
          setGameId(msg.gameId);
          setGameState(null);
          setScores(null);
          playGameStart();
          break;
        case 'GAME_STATE_UPDATE':
          setGameState(msg.state);
          break;
        case 'GAME_ENDED':
          setScores(msg.scores);
          playGameOver();
          setSessionScores((prev) => {
            const next = { ...prev };
            for (const [id, pts] of Object.entries(msg.scores)) {
              next[id] = (next[id] ?? 0) + pts;
            }
            return next;
          });
          break;
      }
    };

    ws.onerror = () => setStatus('error');

    return () => ws.close();
  }, [addToast]);

  function kickPlayer(playerId: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'HOST_KICK_PLAYER', playerId } satisfies ClientToServerMessage));
  }

  function startGame() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const config: Record<string, unknown> = { rounds: selectedRounds };
    if (selectedGame === 'trivia') config.difficulty = triviaDifficulty;

    ws.send(JSON.stringify({ type: 'HOST_START_GAME', gameId: selectedGame, config } satisfies ClientToServerMessage));
  }

  function endGame() {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'HOST_END_GAME' } satisfies ClientToServerMessage));
    }
    setStatus('waiting');
    setScores(null);
    setGameId('');
    setGameState(null);
  }

  const nonHostPlayers = players.filter((p) => !p.isHost);
  const allReady = nonHostPlayers.length === 0 || (nonHostPlayers.length >= MIN_PLAYERS_TO_START && nonHostPlayers.every((p) => p.isReady));

  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join#${roomCode}`
      : `http://localhost:3000/join#${roomCode}`;

  if (status === 'connecting') {
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--accent-light)', fontSize: '1.25rem' }}>Connecting to server…</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <p style={{ fontSize: '2.5rem' }}>⚠️</p>
        <p style={{ color: '#f87171', fontSize: '1.25rem' }}>Failed to connect to server.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '0.75rem 1.5rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700 }}
        >
          Retry
        </button>
      </main>
    );
  }

  if (status === 'playing' || scores !== null) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        <GameView gameId={gameId} players={players} gameState={gameState} scores={scores} onEndGame={endGame} />
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} />
      <div style={{
        display: 'grid', gridTemplateColumns: '360px 1fr', height: '100vh',
        background: 'radial-gradient(ellipse at 0% 50%, rgba(124,58,237,0.08) 0%, transparent 50%), #0a0a12',
      }}>

        {/* ── QR Panel (left) ── */}
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(20,20,40,0.8) 0%, rgba(15,15,30,0.9) 100%)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.75rem',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle glow */}
          <div style={{
            position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <p style={{
            fontSize: '1.5rem', fontWeight: 900, position: 'relative',
            background: 'linear-gradient(135deg, #fff 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            GamingCouch
          </p>

          <div style={{ textAlign: 'center', position: 'relative' }}>
            <p style={{ color: '#8888aa', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 600 }}>
              Scan to join
            </p>
            <div style={{
              padding: 12, borderRadius: 16,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'inline-block',
            }}>
              {roomCode && <QRCodeCanvas text={joinUrl} size={180} />}
            </div>
          </div>

          <div style={{ textAlign: 'center', position: 'relative' }}>
            <p style={{ color: '#8888aa', fontSize: '0.7rem', marginBottom: '0.35rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Room Code</p>
            <p style={{
              fontSize: '3.5rem', fontWeight: 900, letterSpacing: '0.6rem', lineHeight: 1,
              background: 'linear-gradient(135deg, #fff 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {roomCode}
            </p>
            <p style={{ color: '#555577', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              gamingcouch.app/join
            </p>
          </div>

          <div style={{
            width: '80%', height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)',
          }} />

          <p style={{ color: '#8888aa', fontSize: '0.85rem', textAlign: 'center', position: 'relative' }}>
            Phone as controller.<br />No app needed.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', padding: '2.5rem', gap: '1.5rem', overflow: 'hidden' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <h1 style={{
                fontSize: '2rem', fontWeight: 900,
                background: 'linear-gradient(135deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Lobby</h1>
              <p style={{ color: '#8888aa', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {nonHostPlayers.length} / 8 players connected
              </p>
            </div>
            {status === 'ready' && (
              <span style={{
                background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                padding: '0.4rem 1rem', borderRadius: '9999px',
                fontWeight: 700, fontSize: '0.875rem',
                border: '1px solid rgba(34,197,94,0.25)',
                animation: 'pulse 2s ease-in-out infinite',
              }}>
                All Ready!
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: '0.75rem',
              alignContent: 'start',
              overflowY: 'auto',
            }}
          >
            {nonHostPlayers.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 200,
                  color: '#555577',
                  gap: '0.75rem',
                }}
              >
                <p style={{ fontSize: '3rem', animation: 'float 4s ease-in-out infinite' }}>👥</p>
                <p style={{ fontSize: '1rem', color: '#8888aa' }}>Waiting for players…</p>
                <p style={{ fontSize: '0.8rem' }}>Share the room code or QR code on the left</p>
              </div>
            ) : (
              nonHostPlayers.map((player) => (
                <PlayerCard key={player.id} player={player} onKick={kickPlayer} />
              ))
            )}
          </div>

          {/* ── Session standings ── */}
          {Object.keys(sessionScores).length > 0 && (
            <div style={{ flexShrink: 0, background: '#0d0d1f', border: '1px solid #1f1f35', borderRadius: '0.75rem', padding: '0.875rem 1rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                🏆 Session Standings
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[...nonHostPlayers]
                  .sort((a, b) => (sessionScores[b.id] ?? 0) - (sessionScores[a.id] ?? 0))
                  .map((p, i) => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.3rem 0.7rem',
                      background: i === 0 ? '#1a1036' : '#131326',
                      border: `1px solid ${i === 0 ? '#7c3aed44' : 'transparent'}`,
                      borderRadius: '9999px',
                    }}>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.name}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#a78bfa' }}>{sessionScores[p.id] ?? 0}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Game picker ── */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {(['trivia', 'reaction', 'colormatch', 'mathrace', 'wordscramble', 'hotpotato', 'trueorfalse', 'tapfrenzy', 'blindtest', 'neverhaveiever', 'colorflash', 'wouldyourather', 'luckynumber', 'retropong', 'emojidecoder', 'tugofwar', 'simonsays', 'debateclub', 'categorysprint', 'auctionhouse', 'rps', 'bombdefuse', 'whackamole', 'floorislava', 'buttonmash', 'dodgeball', 'priceisright', 'spinthewheel'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGame(g)}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.625rem',
                    border: `2px solid ${selectedGame === g ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.06)'}`,
                    background: selectedGame === g ? 'rgba(124,58,237,0.15)' : 'rgba(20,20,40,0.6)',
                    color: selectedGame === g ? '#a78bfa' : '#8888aa',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: selectedGame === g ? '0 0 16px rgba(124,58,237,0.2)' : 'none',
                  }}
                >
                  {GAME_LABELS[g]}
                </button>
              ))}
            </div>

            {selectedGame === 'trivia' && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {(['easy', 'medium', 'hard'] as const).map((d) => {
                  const colors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
                  const active = triviaDifficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setTriviaDifficulty(d)}
                      style={{
                        padding: '0.35rem 0.875rem',
                        borderRadius: '9999px',
                        border: `2px solid ${active ? colors[d] : '#374151'}`,
                        background: active ? `${colors[d]}22` : 'transparent',
                        color: active ? colors[d] : '#6b7280',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Round picker ── */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 600 }}>Rounds:</span>
              {([1, 3, 5, 10] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedRounds(n)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    border: `2px solid ${selectedRounds === n ? 'var(--accent)' : '#374151'}`,
                    background: selectedRounds === n ? '#1e1b4b' : 'transparent',
                    color: selectedRounds === n ? '#a78bfa' : '#6b7280',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={startGame}
                disabled={!allReady}
                style={{
                  padding: '1rem 3rem',
                  background: allReady
                    ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                    : 'rgba(20,20,40,0.6)',
                  color: allReady ? '#fff' : '#555577',
                  border: allReady
                    ? '2px solid rgba(124,58,237,0.5)'
                    : '2px solid rgba(255,255,255,0.06)',
                  borderRadius: '0.875rem',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  cursor: allReady ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  boxShadow: allReady
                    ? '0 4px 24px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : 'none',
                }}
              >
                {allReady
                  ? 'Start Game →'
                  : nonHostPlayers.length < MIN_PLAYERS_TO_START
                    ? `Need ${MIN_PLAYERS_TO_START - nonHostPlayers.length} more player(s) to start`
                    : 'Waiting for all players to ready up…'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

// ── Player Card ───────────────────────────────────────────────────────────────

function PlayerCard({ player, onKick }: { player: Player; onKick: (id: string) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        background: player.isReady ? 'rgba(34,197,94,0.06)' : 'rgba(20,20,40,0.6)',
        borderRadius: '0.875rem',
        border: `1px solid ${player.isReady ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
        backdropFilter: 'blur(8px)',
        animation: 'fadeInScale 0.3s ease-out both',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: AVATAR_COLOR_HEX[player.avatarColor],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '1rem',
          color: '#fff',
          flexShrink: 0,
          boxShadow: `0 0 12px ${AVATAR_COLOR_HEX[player.avatarColor]}44`,
        }}
      >
        {player.name[0]?.toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {player.name}
        </p>
        <p style={{ fontSize: '0.75rem', color: player.isReady ? '#22c55e' : '#6b7280' }}>
          {player.isReady ? '✓ Ready' : 'Not ready'}
        </p>
      </div>
      <button
        onClick={() => onKick(player.id)}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#555577',
          borderRadius: '0.375rem',
          padding: '0.2rem 0.5rem',
          cursor: 'pointer',
          fontSize: '0.7rem',
          flexShrink: 0,
          transition: 'color 0.15s, border-color 0.15s',
        }}
      >
        Kick
      </button>
    </div>
  );
}
