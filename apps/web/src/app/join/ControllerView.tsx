'use client';

import { useRef, useState, useCallback } from 'react';
import type {
  ControllerLayout,
  ControlDefinition,
  ControllerInputEvent,
  ControlButton,
  ControlDPad,
  ControlJoystick,
  ControlSwipeArea,
} from '@gamingcouch/shared';
import { playClick, playDpadTap, playSwipe } from '@/lib/sounds';

interface Props {
  layout: ControllerLayout;
  onInput: (event: ControllerInputEvent) => void;
}

export default function ControllerView({ layout, onInput }: Props) {
  return (
    <div style={containerStyle}>
      {layout.controls.map((control) => (
        <ControlWidget key={control.id} control={control} onInput={onInput} />
      ))}
    </div>
  );
}

function ControlWidget({ control, onInput }: { control: ControlDefinition; onInput: (e: ControllerInputEvent) => void }) {
  switch (control.type) {
    case 'button':
      return <ButtonControl control={control} onInput={onInput} />;
    case 'dpad':
      return <DPadControl control={control} onInput={onInput} />;
    case 'joystick':
      return <JoystickControl control={control} onInput={onInput} />;
    case 'swipe':
      return <SwipeControl control={control} onInput={onInput} />;
  }
}

// ─── Button ──────────────────────────────────────────────────────────────────

function ButtonControl({ control, onInput }: { control: ControlButton; onInput: (e: ControllerInputEvent) => void }) {
  const [pressed, setPressed] = useState(false);

  const sizeMap = { sm: 64, md: 80, lg: 96 };
  const size = sizeMap[control.size ?? 'md'];
  const color = control.color ?? '#6366f1';

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setPressed(true);
    playClick();
    onInput({ control: control.id, action: 'button_down' });
  }

  function handlePointerUp() {
    setPressed(false);
    onInput({ control: control.id, action: 'button_up' });
  }

  return (
    <div style={positionStyle(control.position)}>
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: pressed ? lighten(color) : color,
          border: `3px solid ${pressed ? '#fff' : 'rgba(255,255,255,0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size > 72 ? '1.1rem' : '0.85rem',
          fontWeight: 700,
          color: '#fff',
          touchAction: 'none',
          userSelect: 'none',
          cursor: 'pointer',
          transform: pressed ? 'scale(0.92)' : 'scale(1)',
          transition: 'transform 80ms, background 80ms',
          boxShadow: pressed ? 'none' : `0 4px 12px ${color}66`,
        }}
      >
        {control.label}
      </div>
    </div>
  );
}

// ─── D-Pad ───────────────────────────────────────────────────────────────────

const DPAD_DIRS = ['up', 'down', 'left', 'right'] as const;
type DPadDir = typeof DPAD_DIRS[number];

function DPadControl({ control, onInput }: { control: ControlDPad; onInput: (e: ControllerInputEvent) => void }) {
  const [active, setActive] = useState<DPadDir | null>(null);

  function press(dir: DPadDir) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      setActive(dir);
      playDpadTap();
      onInput({ control: control.id, action: 'dpad', direction: dir });
    };
  }

  function release() {
    setActive(null);
    onInput({ control: control.id, action: 'dpad', direction: null });
  }

  const SIDE = 52; // px — each arrow button size

  return (
    <div style={{ ...dpadPositionStyle(control.position), position: 'relative', width: SIDE * 3, height: SIDE * 3 }}>
      {/* Up */}
      <DPadArrow dir="up" active={active === 'up'} size={SIDE}
        style={{ position: 'absolute', top: 0, left: SIDE }}
        onPointerDown={press('up')} onPointerUp={release} onPointerCancel={release} />
      {/* Down */}
      <DPadArrow dir="down" active={active === 'down'} size={SIDE}
        style={{ position: 'absolute', bottom: 0, left: SIDE }}
        onPointerDown={press('down')} onPointerUp={release} onPointerCancel={release} />
      {/* Left */}
      <DPadArrow dir="left" active={active === 'left'} size={SIDE}
        style={{ position: 'absolute', left: 0, top: SIDE }}
        onPointerDown={press('left')} onPointerUp={release} onPointerCancel={release} />
      {/* Right */}
      <DPadArrow dir="right" active={active === 'right'} size={SIDE}
        style={{ position: 'absolute', right: 0, top: SIDE }}
        onPointerDown={press('right')} onPointerUp={release} onPointerCancel={release} />
      {/* Center nub */}
      <div style={{
        position: 'absolute', top: SIDE, left: SIDE, width: SIDE, height: SIDE,
        background: '#374151', borderRadius: 4,
        pointerEvents: 'none',
      }} />
    </div>
  );
}

function DPadArrow({
  dir, active, size, style, onPointerDown, onPointerUp, onPointerCancel
}: {
  dir: DPadDir; active: boolean; size: number;
  style: React.CSSProperties;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const arrows: Record<DPadDir, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };
  const radius: Record<DPadDir, string> = {
    up: '6px 6px 0 0', down: '0 0 6px 6px',
    left: '6px 0 0 6px', right: '0 6px 6px 0',
  };
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        ...style,
        width: size, height: size,
        background: active ? '#6366f1' : '#1f2937',
        borderRadius: radius[dir],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.1rem', color: active ? '#fff' : '#9ca3af',
        touchAction: 'none', userSelect: 'none', cursor: 'pointer',
        border: '2px solid #374151',
      }}
    >
      {arrows[dir]}
    </div>
  );
}

// ─── Joystick ─────────────────────────────────────────────────────────────────

const BASE_R = 64;
const THUMB_R = 26;

function JoystickControl({ control, onInput }: { control: ControlJoystick; onInput: (e: ControllerInputEvent) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  const updateThumb = useCallback((e: React.PointerEvent) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamp = Math.min(dist, BASE_R);
    const angle = Math.atan2(dy, dx);
    const tx = clamp * Math.cos(angle);
    const ty = clamp * Math.sin(angle);
    const nx = parseFloat((tx / BASE_R).toFixed(2));
    const ny = parseFloat((ty / BASE_R).toFixed(2));
    setThumb({ x: tx, y: ty });
    onInput({ control: control.id, action: 'joystick', x: nx, y: ny });
  }, [control.id, onInput]);

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    updateThumb(e);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!(e.buttons & 1)) return;
    updateThumb(e);
  }

  function handlePointerUp() {
    setThumb({ x: 0, y: 0 });
    onInput({ control: control.id, action: 'joystick', x: 0, y: 0 });
  }

  return (
    <div style={dpadPositionStyle(control.position)}>
      {control.label && (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem', marginBottom: 8 }}>
          {control.label}
        </p>
      )}
      <div
        ref={baseRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: BASE_R * 2,
          height: BASE_R * 2,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '3px solid rgba(255,255,255,0.2)',
          position: 'relative',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: THUMB_R * 2,
            height: THUMB_R * 2,
            borderRadius: '50%',
            background: '#6366f1',
            boxShadow: '0 2px 8px rgba(99,102,241,0.6)',
            left: BASE_R - THUMB_R + thumb.x,
            top: BASE_R - THUMB_R + thumb.y,
            pointerEvents: 'none',
            transition: thumb.x === 0 && thumb.y === 0 ? 'left 120ms, top 120ms' : 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── Swipe Area ───────────────────────────────────────────────────────────────

function SwipeControl({ control, onInput }: { control: ControlSwipeArea; onInput: (e: ControllerInputEvent) => void }) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const MIN_SWIPE = 40; // px

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    startRef.current = null;

    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;

    const direction = Math.abs(dx) >= Math.abs(dy)
      ? dx > 0 ? 'right' : 'left'
      : dy > 0 ? 'down' : 'up';

    onInput({ control: control.id, action: 'swipe', direction });
    playSwipe();
    const arrows = { up: '↑', down: '↓', left: '←', right: '→' };
    setFlash(arrows[direction]);
    setTimeout(() => setFlash(null), 400);
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { startRef.current = null; }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        background: 'transparent',
      }}
    >
      <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
        {flash ? (
          <p style={{ fontSize: '4rem', color: '#6366f1', fontWeight: 900, opacity: 0.9 }}>{flash}</p>
        ) : (
          <>
            <p style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.2)' }}>↑↓←→</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
              {control.label ?? 'Swipe to play'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Layout helpers ────────────────────────────────────────────────────────────

type ButtonPosition = ControlButton['position'];
type SidePosition = 'left' | 'right' | 'center';

function positionStyle(pos: ButtonPosition): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const map: Record<ButtonPosition, React.CSSProperties> = {
    'bottom-left':  { ...base, bottom: 32, left: 32 },
    'bottom-right': { ...base, bottom: 32, right: 32 },
    'top-left':     { ...base, top: 32, left: 32 },
    'top-right':    { ...base, top: 32, right: 32 },
    'center':       { ...base, bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)' },
  };
  return map[pos];
}

function dpadPositionStyle(pos: SidePosition): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute', bottom: 32 };
  const map: Record<SidePosition, React.CSSProperties> = {
    left:   { ...base, left: 24 },
    right:  { ...base, right: 24 },
    center: { ...base, left: '50%', transform: 'translateX(-50%)' },
  };
  return map[pos];
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#0f0f1a',
  overflow: 'hidden',
};

/** Brighten a hex color slightly for pressed state */
function lighten(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 40);
  const g = Math.min(255, ((n >> 8) & 0xff) + 40);
  const b = Math.min(255, (n & 0xff) + 40);
  return `rgb(${r},${g},${b})`;
}
