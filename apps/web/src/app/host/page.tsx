'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  ServerToClientMessage,
  ClientToServerMessage,
  Player,
  GameState,
  AVATAR_COLOR_HEX,
  WS_PORT,
  MIN_PLAYERS_TO_START,
} from '@gamingcouch/shared';

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
  answeredPlayerIds: string[];
  correctAnswer?: number;
  playerAnswers?: Record<string, number>;
}

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
            padding: '0.6rem 1rem',
            borderRadius: 8,
            background: '#1f1f35',
            borderLeft: `4px solid ${t.color}`,
            color: '#f0f0ff',
            fontSize: '0.95rem',
            fontWeight: 600,
            minWidth: 220,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            animation: 'slideIn 0.2s ease-out',
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '2rem', background: 'var(--bg)', padding: '2rem' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 900 }}>Game Over!</h1>
        <div style={{ width: '100%', maxWidth: 640 }}>
          {sorted.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.5rem',
                background: i === 0 ? '#2d1f5e' : '#1f1f35',
                borderRadius: 10,
                marginBottom: 8,
                border: i === 0 ? '1px solid #7c3aed' : '1px solid transparent',
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
          style={{ padding: '0.875rem 2.5rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  if (gameId === 'trivia' && gameState) {
    return <TriviaHostView state={gameState} players={players} />;
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

  const addToast = useCallback((message: string, color: string) => {
    const id = ++toastCounterRef.current;
    setToasts((prev) => [...prev, { id, message, color }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
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
    ws.send(JSON.stringify({ type: 'HOST_START_GAME', gameId: 'trivia' } satisfies ClientToServerMessage));
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
  const allReady = nonHostPlayers.length >= MIN_PLAYERS_TO_START && nonHostPlayers.every((p) => p.isReady);

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
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', height: '100vh' }}>

        <div
          style={{
            background: '#13131f',
            borderRight: '1px solid #2d2d4e',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            padding: '2rem',
          }}
        >
          <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>🎮 GamingCouch</p>

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Scan to join
            </p>
            {roomCode && <QRCodeCanvas text={joinUrl} size={180} />}
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Room Code</p>
            <p style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '0.5rem', color: '#fff', lineHeight: 1 }}>
              {roomCode}
            </p>
            <p style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: '0.4rem' }}>
              gamingcouch.app/join
            </p>
          </div>

          <div style={{ width: '100%', height: 1, background: '#2d2d4e' }} />

          <p style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>
            Phone as controller.<br />No app needed.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', padding: '2.5rem', gap: '1.5rem', overflow: 'hidden' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Lobby</h1>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {nonHostPlayers.length} / 8 players connected
              </p>
            </div>
            {status === 'ready' && (
              <span style={{ background: '#14532d', color: '#22c55e', padding: '0.35rem 0.875rem', borderRadius: '9999px', fontWeight: 700, fontSize: '0.875rem' }}>
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
                  color: '#4b5563',
                  gap: '0.75rem',
                }}
              >
                <p style={{ fontSize: '3rem' }}>👥</p>
                <p style={{ fontSize: '1rem' }}>Waiting for players…</p>
                <p style={{ fontSize: '0.8rem' }}>Share the room code or QR code on the left</p>
              </div>
            ) : (
              nonHostPlayers.map((player) => (
                <PlayerCard key={player.id} player={player} onKick={kickPlayer} />
              ))
            )}
          </div>

          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '0.5rem' }}>
            <button
              onClick={startGame}
              disabled={!allReady}
              style={{
                padding: '1rem 3rem',
                background: allReady ? 'var(--accent)' : '#1f2937',
                color: allReady ? '#fff' : '#4b5563',
                border: `2px solid ${allReady ? 'var(--accent)' : '#374151'}`,
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '1.25rem',
                cursor: allReady ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s, border-color 0.15s',
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
        background: '#1a1a2e',
        borderRadius: '0.75rem',
        border: `1px solid ${player.isReady ? '#166534' : '#2d2d4e'}`,
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
          border: '1px solid #374151',
          color: '#6b7280',
          borderRadius: '0.375rem',
          padding: '0.2rem 0.5rem',
          cursor: 'pointer',
          fontSize: '0.7rem',
          flexShrink: 0,
        }}
      >
        Kick
      </button>
    </div>
  );
}
