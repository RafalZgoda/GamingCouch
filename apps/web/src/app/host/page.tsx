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
  const nonHostPlayers = players.filter((p) => !p.isHost);

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
  const [selectedGame, setSelectedGame] = useState<'trivia' | 'reaction' | 'colormatch' | 'mathrace' | 'wordscramble' | 'hotpotato' | 'trueorfalse' | 'tapfrenzy' | 'blindtest'>('trivia');
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
          break;
        case 'PLAYER_LEFT':
          setPlayers((prev) => {
            const leaving = prev.find((p) => p.id === msg.playerId);
            if (leaving && !leaving.isHost) addToast(`${leaving.name} left`, '#f97316');
            return prev.filter((p) => p.id !== msg.playerId);
          });
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
          break;
        case 'GAME_STATE_UPDATE':
          setGameState(msg.state);
          break;
        case 'GAME_ENDED':
          setScores(msg.scores);
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
              {(['trivia', 'reaction', 'colormatch', 'mathrace', 'wordscramble', 'hotpotato', 'trueorfalse', 'tapfrenzy', 'blindtest'] as const).map((g) => (
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
