'use client';

import { useRef, useState, useCallback } from 'react';
import {
  ClientToServerMessage,
  ServerToClientMessage,
  AvatarColor,
  AVATAR_COLORS,
  AVATAR_COLOR_HEX,
  WS_PORT,
  ControllerLayout,
  ControllerInputEvent,
} from '@gamingcouch/shared';
import ControllerView from './ControllerView';

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
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const [roomStatus, setRoomStatus] = useState<'waiting' | 'ready' | 'playing' | 'finished'>('waiting');
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle');
  const [controllerLayout, setControllerLayout] = useState<ControllerLayout | null>(null);

  // Saved join params for reconnect
  const joinParamsRef = useRef<{ code: string; name: string; avatarColor: AvatarColor } | null>(null);

  const connect = useCallback((joinCode: string, joinName: string, color: AvatarColor, isReconnect = false) => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    setConnStatus(isReconnect ? 'reconnecting' : 'connecting');
    setError('');

    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
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
        case 'ROOM_JOINED':
          setJoined(true);
          setRoomStatus(msg.room.status === 'playing' ? 'playing' : 'waiting');
          break;
        case 'ROOM_STATUS_CHANGED':
          setRoomStatus(msg.status);
          break;
        case 'GAME_STARTED':
          setRoomStatus('playing');
          break;
        case 'CONTROLLER_LAYOUT':
          setControllerLayout(msg.layout);
          break;
        case 'PLAYER_KICKED':
          setError('You were kicked from the room.');
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
      if (!joined) {
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
  }, [joined]);

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

  function sendInput(event: ControllerInputEvent) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientToServerMessage = { type: 'PLAYER_INPUT', payload: event };
    ws.send(JSON.stringify(msg));
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
      <main style={centeredLayout}>
        <StatusBar status={connStatus} inline />
        <div
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: AVATAR_COLOR_HEX[avatarColor],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', fontWeight: 800, color: '#fff',
          }}
        >
          {name[0]?.toUpperCase() ?? '?'}
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{name}</h1>
        <p style={{ color: 'var(--accent-light)' }}>
          {roomStatus === 'ready' ? '🟢 All players ready! Waiting for host…' : 'Waiting in lobby…'}
        </p>
        {!isReady && (
          <button onClick={handleReady} style={primaryBtn}>
            I&apos;m Ready!
          </button>
        )}
        {isReady && (
          <p style={{ color: '#22c55e', fontWeight: 700 }}>✓ You&apos;re ready</p>
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
