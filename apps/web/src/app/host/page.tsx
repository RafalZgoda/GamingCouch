'use client';

import { useEffect, useRef, useState } from 'react';
import { ServerToClientMessage, ClientToServerMessage, WS_PORT } from '@gamingcouch/shared';

export default function HostPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'playing' | 'error'>('connecting');

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const msg: ClientToServerMessage = { type: 'HOST_CREATE_ROOM' };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerToClientMessage;
      if (msg.type === 'ROOM_CREATED') {
        setRoomCode(msg.roomCode);
        setStatus('waiting');
      } else if (msg.type === 'PLAYER_JOINED') {
        setPlayers((prev) => [...prev, msg.player.name]);
      } else if (msg.type === 'PLAYER_LEFT') {
        // refresh handled by playerId, simplified here
        setPlayers((prev) => prev.slice(0, -1));
      } else if (msg.type === 'GAME_STARTED') {
        setStatus('playing');
      }
    };

    ws.onerror = () => setStatus('error');

    return () => ws.close();
  }, []);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '2rem', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Host Lobby</h1>
      {status === 'connecting' && <p>Connecting to server…</p>}
      {status === 'error' && <p style={{ color: '#f87171' }}>Failed to connect to server.</p>}
      {roomCode && (
        <>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--accent-light)', marginBottom: '0.5rem' }}>Room Code</p>
            <p style={{ fontSize: '4rem', fontWeight: 900, letterSpacing: '0.5rem', color: '#fff' }}>{roomCode}</p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Players join at <strong>gamingcouch.app/join</strong></p>
          </div>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1rem' }}>Players ({players.length})</h2>
            {players.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Waiting for players…</p>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {players.map((name, i) => (
                  <li key={i} style={{ padding: '0.75rem 1rem', background: '#1f1f35', borderRadius: '0.5rem' }}>{name}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
