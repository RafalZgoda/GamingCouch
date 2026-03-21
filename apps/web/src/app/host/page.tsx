'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ServerToClientMessage,
  ClientToServerMessage,
  Player,
  AVATAR_COLOR_HEX,
  WS_PORT,
  MIN_PLAYERS_TO_START,
} from '@gamingcouch/shared';

export default function HostPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'ready' | 'playing' | 'error'>('connecting');

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
          break;
        case 'PLAYER_LEFT':
          setPlayers((prev) => prev.filter((p) => p.id !== msg.playerId));
          break;
        case 'PLAYER_KICKED':
          setPlayers((prev) => prev.filter((p) => p.id !== msg.playerId));
          break;
        case 'PLAYER_READY_CHANGED':
          setPlayers((prev) =>
            prev.map((p) => (p.id === msg.playerId ? { ...p, isReady: msg.isReady } : p)),
          );
          break;
        case 'ROOM_STATUS_CHANGED':
          if (msg.status === 'ready' || msg.status === 'waiting') {
            setStatus(msg.status);
          }
          break;
        case 'GAME_STARTED':
          setStatus('playing');
          break;
      }
    };

    ws.onerror = () => setStatus('error');

    return () => ws.close();
  }, []);

  function kickPlayer(playerId: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientToServerMessage = { type: 'HOST_KICK_PLAYER', playerId };
    ws.send(JSON.stringify(msg));
  }

  function startGame() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientToServerMessage = { type: 'HOST_START_GAME', gameId: 'trivia' };
    ws.send(JSON.stringify(msg));
  }

  const nonHostPlayers = players.filter((p) => !p.isHost);
  const allReady =
    nonHostPlayers.length >= MIN_PLAYERS_TO_START && nonHostPlayers.every((p) => p.isReady);

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
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Players join at <strong>gamingcouch.app/join</strong>
            </p>
          </div>

          <div style={{ width: '100%', maxWidth: 400 }}>
            <h2 style={{ marginBottom: '1rem' }}>
              Players ({nonHostPlayers.length} / 8)
              {status === 'ready' && (
                <span style={{ color: '#22c55e', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                  All ready!
                </span>
              )}
            </h2>
            {nonHostPlayers.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Waiting for players…</p>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {nonHostPlayers.map((player) => (
                  <li
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: '#1f1f35',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: AVATAR_COLOR_HEX[player.avatarColor],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        color: '#fff',
                        fontSize: '0.875rem',
                        flexShrink: 0,
                      }}
                    >
                      {player.name[0]?.toUpperCase()}
                    </div>
                    <span style={{ flex: 1 }}>{player.name}</span>
                    {player.isReady ? (
                      <span style={{ color: '#22c55e', fontSize: '0.875rem' }}>✓ Ready</span>
                    ) : (
                      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>…</span>
                    )}
                    <button
                      onClick={() => kickPlayer(player.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #374151',
                        color: '#9ca3af',
                        borderRadius: '0.375rem',
                        padding: '0.25rem 0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      Kick
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {status !== 'playing' && (
            <button
              onClick={startGame}
              disabled={!allReady}
              style={{
                padding: '0.875rem 2.5rem',
                background: allReady ? 'var(--accent)' : '#374151',
                color: allReady ? '#fff' : '#6b7280',
                border: 'none',
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '1.1rem',
                cursor: allReady ? 'pointer' : 'not-allowed',
              }}
            >
              {allReady
                ? 'Start Game →'
                : nonHostPlayers.length < MIN_PLAYERS_TO_START
                  ? `Need ${MIN_PLAYERS_TO_START - nonHostPlayers.length} more player(s)…`
                  : 'Waiting for players to ready up…'}
            </button>
          )}

          {status === 'playing' && (
            <p style={{ color: 'var(--accent-light)', fontSize: '1.25rem' }}>🎮 Game in progress</p>
          )}
        </>
      )}
    </main>
  );
}
