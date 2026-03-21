'use client';

import { useRef, useState } from 'react';
import { ClientToServerMessage, ServerToClientMessage, WS_PORT } from '@gamingcouch/shared';

export default function JoinPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  function handleJoin() {
    if (code.length !== 4 || !name.trim()) {
      setError('Enter a 4-digit room code and your name.');
      return;
    }
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const msg: ClientToServerMessage = { type: 'PLAYER_JOIN_ROOM', code, playerName: name.trim() };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerToClientMessage;
      if (msg.type === 'ROOM_JOINED') {
        setJoined(true);
        setError('');
      } else if (msg.type === 'ERROR') {
        setError(msg.message);
        ws.close();
      }
    };

    ws.onerror = () => setError('Connection failed.');
  }

  if (joined) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', padding: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>You&apos;re in! 🎉</h1>
        <p style={{ color: 'var(--accent-light)' }}>Waiting for the host to start the game…</p>
      </main>
    );
  }

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1.5rem', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Join a Game</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '2px solid var(--accent)', background: '#1f1f35', color: '#fff', fontSize: '1rem', width: '100%', maxWidth: '300px' }}
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="Room code (4 digits)"
        maxLength={4}
        inputMode="numeric"
        style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '2px solid var(--accent)', background: '#1f1f35', color: '#fff', fontSize: '2rem', letterSpacing: '0.5rem', width: '100%', maxWidth: '300px', textAlign: 'center' }}
      />
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      <button
        onClick={handleJoin}
        style={{ padding: '0.875rem 2rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}
      >
        Join
      </button>
    </main>
  );
}
