'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  ClientToServerMessage,
  ServerToClientMessage,
  AvatarColor,
  AVATAR_COLORS,
  AVATAR_COLOR_HEX,
  ControllerLayout,
  ControllerInputEvent,
  Player,
  GameDefinition,
  WS_PORT,
} from '@gamingcouch/shared';
import ControllerView from './ControllerView';
import { getWsUrl } from '@/lib/wsUrl';

function getApiUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return `http://localhost:${WS_PORT}`;
}

type ConnStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const MAX_RECONNECT_ATTEMPTS = 4;
const RECONNECT_BASE_MS = 1500;

export default function JoinPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState<AvatarColor>('blue');

  const [joined, setJoined] = useState(false);
  const joinedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const [roomStatus, setRoomStatus] = useState<'waiting' | 'ready' | 'playing' | 'finished'>('waiting');
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle');
  const [controllerLayout, setControllerLayout] = useState<ControllerLayout | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [ownPlayerId, setOwnPlayerId] = useState<string | null>(null);
  const [finalScores, setFinalScores] = useState<Record<string, number> | null>(null);
  const [finalWinner, setFinalWinner] = useState<string | null>(null);
  const [games, setGames] = useState<GameDefinition[]>([]);
  const [startingGame, setStartingGame] = useState<string | null>(null);
  const [triviaDifficulty, setTriviaDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Saved join params for reconnect
  const joinParamsRef = useRef<{ code: string; name: string; avatarColor: AvatarColor } | null>(null);

  // Keep joinedRef in sync so closures always read the latest value
  useEffect(() => { joinedRef.current = joined; }, [joined]);

  // Pre-fill room code from URL hash (e.g. /join#1234 from QR code scan)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (/^\d{4}$/.test(hash)) setCode(hash);
  }, []);

  // Fetch available games when entering the lobby
  useEffect(() => {
    if (!joined) return;
    fetch(`${getApiUrl()}/api/games`)
      .then((r) => r.json())
      .then((data: GameDefinition[]) => setGames(data))
      .catch(() => {});
  }, [joined]);

  const connect = useCallback((joinCode: string, joinName: string, color: AvatarColor, isReconnect = false) => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    setConnStatus(isReconnect ? 'reconnecting' : 'connecting');
    setError('');

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      setConnStatus('connected');
      const msg: ClientToServerMessage = {
        type: 'PLAYER_JOIN_ROOM',
        code: joinCode,
        playerName: joinName.trim(),
        avatarColor: color,
      };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerToClientMessage;
      switch (msg.type) {
        case 'ROOM_JOINED': {
          joinedRef.current = true;
          setJoined(true);
          const nonHostPlayers = msg.room.players.filter((p) => !p.isHost);
          // Use joinName (the parameter) not name (stale closure)
          const self = nonHostPlayers.find((p) => p.name === joinName.trim());
          if (self) setOwnPlayerId(self.id);
          // Exclude self from the players list — self is shown separately in the header
          setPlayers(nonHostPlayers.filter((p) => p.id !== self?.id));
          setRoomStatus(msg.room.status);
          break;
        }
        case 'PLAYER_JOINED':
          if (!msg.player.isHost) setPlayers((prev) => [...prev, msg.player]);
          break;
        case 'PLAYER_LEFT':
          setPlayers((prev) => prev.filter((p) => p.id !== msg.playerId));
          break;
        case 'PLAYER_READY_CHANGED':
          setPlayers((prev) =>
            prev.map((p) => (p.id === msg.playerId ? { ...p, isReady: msg.isReady } : p)),
          );
          break;
        case 'ROOM_STATUS_CHANGED':
          setRoomStatus(msg.status);
          if (msg.status === 'waiting') {
            setFinalScores(null);
            setFinalWinner(null);
            setIsReady(false);
            setPlayers((prev) => prev.map((p) => ({ ...p, isReady: false })));
          }
          break;
        case 'GAME_STARTED':
          setRoomStatus('playing');
          setFinalScores(null);
          setFinalWinner(null);
          setStartingGame(null);
          break;
        case 'GAME_ENDED':
          setRoomStatus('finished');
          setFinalScores(msg.scores);
          setFinalWinner(msg.winner);
          setControllerLayout(null);
          break;
        case 'CONTROLLER_LAYOUT':
          setControllerLayout(msg.layout);
          break;
        case 'PLAYER_KICKED':
          setError('You were kicked from the room.');
          joinedRef.current = false;
          setJoined(false);
          setConnStatus('disconnected');
          ws.close();
          break;
        case 'ERROR':
          setError(msg.message);
          if (!joined) {
            setConnStatus('idle');
            ws.close();
          }
          break;
      }
    };

    ws.onerror = () => {
      // onclose will fire next and handle reconnect
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!joinedRef.current) {
        setConnStatus('idle');
        return;
      }
      // Attempt auto-reconnect
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS && joinParamsRef.current) {
        reconnectAttempts.current++;
        const delay = RECONNECT_BASE_MS * reconnectAttempts.current;
        setConnStatus('reconnecting');
        reconnectTimer.current = setTimeout(() => {
          if (joinParamsRef.current) {
            connect(joinParamsRef.current.code, joinParamsRef.current.name, joinParamsRef.current.avatarColor, true);
          }
        }, delay);
      } else {
        setConnStatus('disconnected');
        setError('Lost connection to server.');
      }
    };
  }, []);

  function handleJoin() {
    if (code.length !== 4 || !name.trim()) {
      setError('Enter a 4-digit room code and your name.');
      return;
    }
    joinParamsRef.current = { code, name, avatarColor };
    connect(code, name, avatarColor);
  }

  function handleReady() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientToServerMessage = { type: 'PLAYER_READY' };
    ws.send(JSON.stringify(msg));
    setIsReady(true);
  }

  function handleStartGame(gameId: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setStartingGame(gameId);
    const config = gameId === 'trivia' ? { difficulty: triviaDifficulty } : undefined;
    const msg: ClientToServerMessage = { type: 'PLAYER_START_GAME', gameId, config };
    ws.send(JSON.stringify(msg));
  }

  function sendInput(event: ControllerInputEvent) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientToServerMessage = { type: 'PLAYER_INPUT', payload: event };
    ws.send(JSON.stringify(msg));
  }

  // ── Game over / scores ───────────────────────────────────────────────────
  if (joined && roomStatus === 'finished') {
    const sortedPlayers = [...players].sort(
      (a, b) => (finalScores?.[b.id] ?? 0) - (finalScores?.[a.id] ?? 0),
    );
    const winnerName = finalWinner ? players.find((p) => p.id === finalWinner)?.name : null;
    return (
      <main style={centeredLayout}>
        <StatusBar status={connStatus} inline />
        <p style={{ fontSize: '3rem' }}>🏆</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Game Over!</h1>
        {winnerName && (
          <p style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1.1rem' }}>
            🥇 {winnerName} wins!
          </p>
        )}
        {sortedPlayers.length > 0 && (
          <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sortedPlayers.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem 1rem', borderRadius: '0.5rem',
                  background: p.id === ownPlayerId ? 'rgba(99,102,241,0.2)' : '#1f1f35',
                  border: p.id === ownPlayerId ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <span style={{ fontWeight: 700, color: '#6b7280', minWidth: 24 }}>#{i + 1}</span>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontWeight: 800, color: '#a78bfa' }}>{finalScores?.[p.id] ?? 0} pts</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ color: 'var(--accent-light)', fontSize: '0.875rem' }}>Waiting for next game…</p>
      </main>
    );
  }

  // ── Playing with layout ──────────────────────────────────────────────────
  if (joined && roomStatus === 'playing' && controllerLayout) {
    return (
      <>
        <StatusBar status={connStatus} />
        <ControllerView layout={controllerLayout} onInput={sendInput} />
      </>
    );
  }

  // ── Playing but no layout yet ───────────────────────────────────────────
  if (joined && roomStatus === 'playing') {
    return (
      <main style={centeredLayout}>
        <StatusBar status={connStatus} inline />
        <p style={{ fontSize: '3rem' }}>🎮</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Game in progress</h1>
        <p style={{ color: 'var(--accent-light)' }}>Watch the TV screen for instructions.</p>
      </main>
    );
  }

  // ── Lobby ────────────────────────────────────────────────────────────────
  if (joined) {
    return (
      <main style={{ ...centeredLayout, justifyContent: 'flex-start', paddingTop: '1.5rem' }}>
        <StatusBar status={connStatus} inline />

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: AVATAR_COLOR_HEX[avatarColor],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem', fontWeight: 800, color: '#fff', flexShrink: 0,
            }}
          >
            {name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p style={{ fontWeight: 700, margin: 0 }}>{name}</p>
            <p style={{ color: 'var(--accent-light)', fontSize: '0.8rem', margin: 0 }}>
              {players.length + 1} player{players.length + 1 !== 1 ? 's' : ''} in lobby
            </p>
          </div>
        </div>

        {/* Other players chips */}
        {players.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 320 }}>
            {players.map((p) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                background: '#1f1f35', borderRadius: '9999px',
                padding: '0.25rem 0.6rem', fontSize: '0.8rem',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: AVATAR_COLOR_HEX[p.avatarColor], flexShrink: 0 }} />
                {p.name}
                {p.isReady && <span style={{ color: '#22c55e' }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {/* Ready button */}
        {!isReady ? (
          <button onClick={handleReady} style={{ ...primaryBtn, padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}>
            I&apos;m Ready!
          </button>
        ) : (
          <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem' }}>✓ You&apos;re ready</p>
        )}

        {/* Game picker */}
        {games.length > 0 && (
          <>
            <p style={{ color: 'var(--accent-light)', fontWeight: 600, fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
              Choose a game to start:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: 340 }}>
              {games.map((g) => (
                <div
                  key={g.id}
                  style={{
                    background: '#1a1a2e',
                    border: '2px solid #2d2d4e',
                    borderRadius: '0.75rem',
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{g.name}</span>
                    <button
                      onClick={() => handleStartGame(g.id)}
                      disabled={startingGame !== null}
                      style={{
                        padding: '0.4rem 0.9rem',
                        background: startingGame === g.id ? '#4f46e5' : 'var(--accent)',
                        color: '#fff', border: 'none', borderRadius: '0.5rem',
                        fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                        opacity: startingGame !== null && startingGame !== g.id ? 0.5 : 1,
                        flexShrink: 0,
                      }}
                    >
                      {startingGame === g.id ? '⏳' : '▶ Start'}
                    </button>
                  </div>
                  <p style={{ color: 'var(--accent-light)', fontSize: '0.8rem', margin: 0 }}>{g.description}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>
                    {g.minPlayers}–{g.maxPlayers} players
                  </p>
                  {g.id === 'trivia' && (
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                      {(['easy', 'medium', 'hard'] as const).map((d) => {
                        const colors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
                        const active = triviaDifficulty === d;
                        return (
                          <button
                            key={d}
                            onClick={() => setTriviaDifficulty(d)}
                            style={{
                              flex: 1, padding: '0.25rem 0',
                              borderRadius: '0.375rem',
                              border: `2px solid ${active ? colors[d] : '#374151'}`,
                              background: active ? `${colors[d]}22` : 'transparent',
                              color: active ? colors[d] : '#6b7280',
                              fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                              textTransform: 'capitalize',
                            }}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {error && <p style={{ color: '#f87171' }}>{error}</p>}
      </main>
    );
  }

  // ── Join form ─────────────────────────────────────────────────────────────
  return (
    <main style={centeredLayout}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Join a Game</h1>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        style={inputStyle}
      />

      <div style={{ width: '100%', maxWidth: 300 }}>
        <p style={{ color: 'var(--accent-light)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          Pick your color
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setAvatarColor(color)}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: AVATAR_COLOR_HEX[color],
                border: avatarColor === color ? '3px solid #fff' : '3px solid transparent',
                cursor: 'pointer',
                boxShadow: avatarColor === color ? '0 0 0 2px var(--accent)' : 'none',
              }}
              aria-label={color}
            />
          ))}
        </div>
      </div>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="Room code"
        maxLength={4}
        inputMode="numeric"
        style={{ ...inputStyle, fontSize: '2rem', letterSpacing: '0.5rem', textAlign: 'center' }}
      />

      {error && <p style={{ color: '#f87171' }}>{error}</p>}

      <button
        onClick={handleJoin}
        disabled={connStatus === 'connecting'}
        style={{ ...primaryBtn, opacity: connStatus === 'connecting' ? 0.6 : 1 }}
      >
        {connStatus === 'connecting' ? 'Connecting…' : 'Join'}
      </button>
    </main>
  );
}

// ── Connection Status Bar ─────────────────────────────────────────────────────

function StatusBar({ status, inline = false }: { status: ConnStatus; inline?: boolean }) {
  if (status === 'connected' || status === 'idle') return null;

  const cfg: Record<Exclude<ConnStatus, 'idle' | 'connected'>, { color: string; label: string }> = {
    connecting:    { color: '#facc15', label: '⏳ Connecting…' },
    reconnecting:  { color: '#f97316', label: '🔄 Reconnecting…' },
    disconnected:  { color: '#ef4444', label: '⚠ Disconnected' },
  };

  const { color, label } = cfg[status as Exclude<ConnStatus, 'idle' | 'connected'>];

  if (inline) {
    return <p style={{ color, fontWeight: 600, fontSize: '0.875rem' }}>{label}</p>;
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: color, color: '#000', fontWeight: 700,
      textAlign: 'center', padding: '0.4rem',
      fontSize: '0.875rem', zIndex: 100,
    }}>
      {label}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const centeredLayout: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', gap: '1.5rem', padding: '2rem',
};

const inputStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: '2px solid var(--accent)',
  background: '#1f1f35',
  color: '#fff',
  fontSize: '1rem',
  width: '100%',
  maxWidth: 300,
};

const primaryBtn: React.CSSProperties = {
  padding: '0.875rem 2rem',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: '0.75rem',
  fontWeight: 700,
  fontSize: '1.1rem',
  cursor: 'pointer',
};
