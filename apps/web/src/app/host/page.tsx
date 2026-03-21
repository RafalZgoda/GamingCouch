'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  ServerToClientMessage,
  ClientToServerMessage,
  Player,
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

// ── Game View ─────────────────────────────────────────────────────────────────

function GameView({
  gameId,
  players,
  scores,
  onEndGame,
}: {
  gameId: string;
  players: Player[];
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

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Player bar */}
      <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 1.5rem', background: 'rgba(15,15,26,0.9)', justifyContent: 'center', flexWrap: 'wrap' }}>
        {nonHostPlayers.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f0f0ff' }}>{p.name}</span>
          </div>
        ))}
      </div>
      {/* Game content area */}
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
          setScores(null);
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
  }

  const nonHostPlayers = players.filter((p) => !p.isHost);
  const allReady = nonHostPlayers.length >= MIN_PLAYERS_TO_START && nonHostPlayers.every((p) => p.isReady);

  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join#${roomCode}`
      : `http://localhost:3000/join#${roomCode}`;

  // ── Connecting ──

  if (status === 'connecting') {
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--accent-light)', fontSize: '1.25rem' }}>Connecting to server…</p>
      </main>
    );
  }

  // ── Error ──

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

  // ── Game (active or ended) ──

  if (status === 'playing' || scores !== null) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        <GameView gameId={gameId} players={players} scores={scores} onEndGame={endGame} />
      </>
    );
  }

  // ── Lobby (landscape TV layout) ──

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

        {/* ── Left panel: QR + join info ── */}
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

        {/* ── Right panel: players + controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '2.5rem', gap: '1.5rem', overflow: 'hidden' }}>

          {/* Header */}
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

          {/* Players grid */}
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

          {/* Start button */}
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
