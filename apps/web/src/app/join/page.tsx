'use client';

import { useRef, useState } from 'react';
import {
  ClientToServerMessage,
  ServerToClientMessage,
  AvatarColor,
  AVATAR_COLORS,
  AVATAR_COLOR_HEX,
  WS_PORT,
} from '@gamingcouch/shared';

export default function JoinPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState<AvatarColor>('blue');
  const [joined, setJoined] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const [roomStatus, setRoomStatus] = useState<'waiting' | 'ready' | 'playing' | 'finished'>('waiting');

  function handleJoin() {
    if (code.length !== 4 || !name.trim()) {
      setError('Enter a 4-digit room code and your name.');
      return;
    }
    setError('');
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const msg: ClientToServerMessage = {
        type: 'PLAYER_JOIN_ROOM',
        code,
        playerName: name.trim(),
        avatarColor,
      };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerToClientMessage;
      switch (msg.type) {
        case 'ROOM_JOINED':
          setJoined(true);
          break;
        case 'ROOM_STATUS_CHANGED':
          setRoomStatus(msg.status);
          break;
        case 'GAME_STARTED':
          setRoomStatus('playing');
          break;
        case 'ERROR':
          setError(msg.message);
          ws.close();
          break;
      }
    };

    ws.onerror = () => setError('Connection failed. Is the server running?');
    ws.onclose = () => {
      if (joined) setError('Disconnected from server.');
    };
  }

  function handleReady() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientToServerMessage = { type: 'PLAYER_READY' };
    ws.send(JSON.stringify(msg));
    setIsReady(true);
  }

  if (joined && roomStatus === 'playing') {
    return (
      <main style={centeredLayout}>
        <p style={{ fontSize: '3rem' }}>🎮</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Game Started!</h1>
        <p style={{ color: 'var(--accent-light)' }}>Watch the TV screen and use your phone as a controller.</p>
      </main>
    );
  }

  if (joined) {
    return (
      <main style={centeredLayout}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: AVATAR_COLOR_HEX[avatarColor],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 800,
            color: '#fff',
          }}
        >
          {name[0]?.toUpperCase() ?? '?'}
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{name}</h1>
        <p style={{ color: 'var(--accent-light)' }}>
          {roomStatus === 'ready' ? '🟢 All players ready! Waiting for host…' : 'Waiting for players and host…'}
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
                width: 36,
                height: 36,
                borderRadius: '50%',
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

      <button onClick={handleJoin} style={primaryBtn}>
        Join
      </button>
    </main>
  );
}

const centeredLayout: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  gap: '1.5rem',
  padding: '2rem',
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
