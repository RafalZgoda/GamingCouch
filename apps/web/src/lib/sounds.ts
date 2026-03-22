/**
 * Synthesized sound effects using Web Audio API.
 * No external audio files needed — all sounds are generated programmatically.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function play(setup: (ac: AudioContext, dest: AudioNode) => void) {
  try {
    const ac = getCtx();
    const gain = ac.createGain();
    gain.connect(ac.destination);
    setup(ac, gain);
  } catch {
    // Silently fail — audio is non-critical
  }
}

// ─── Phone controller sounds ───────────────────────────────────────────────

/** Short click for button presses */
export function playClick() {
  play((ac, dest) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(800, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.06);
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);
    o.connect(g).connect(dest);
    o.start();
    o.stop(ac.currentTime + 0.06);
  });
}

/** D-pad tap — slightly different from button click */
export function playDpadTap() {
  play((ac, dest) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(500, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.05);
    g.gain.setValueAtTime(0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
    o.connect(g).connect(dest);
    o.start();
    o.stop(ac.currentTime + 0.05);
  });
}

/** Whoosh for swipe gestures */
export function playSwipe() {
  play((ac, dest) => {
    const bufferSize = ac.sampleRate * 0.15;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2000, ac.currentTime);
    bp.frequency.exponentialRampToValueAtTime(500, ac.currentTime + 0.15);
    bp.Q.value = 1.5;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.18, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    src.connect(bp).connect(g).connect(dest);
    src.start();
  });
}

/** Confirmation ding for "I'm Ready" */
export function playReady() {
  play((ac, dest) => {
    const notes = [523, 659, 784]; // C5, E5, G5 — major chord
    notes.forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t = ac.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.3);
    });
  });
}

// ─── Host / shared sounds ──────────────────────────────────────────────────

/** Player join — friendly pop */
export function playPlayerJoin() {
  play((ac, dest) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(400, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.1);
    g.gain.setValueAtTime(0.2, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
    o.connect(g).connect(dest);
    o.start();
    o.stop(ac.currentTime + 0.2);
  });
}

/** Player leave — descending tone */
export function playPlayerLeave() {
  play((ac, dest) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(600, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.15);
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
    o.connect(g).connect(dest);
    o.start();
    o.stop(ac.currentTime + 0.2);
  });
}

/** Countdown beep (3, 2, 1) */
export function playCountdownBeep() {
  play((ac, dest) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    o.connect(g).connect(dest);
    o.start();
    o.stop(ac.currentTime + 0.12);
  });
}

/** GO! — higher pitched burst */
export function playCountdownGo() {
  play((ac, dest) => {
    [1047, 1319].forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t = ac.currentTime + i * 0.05;
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.2);
    });
  });
}

/** Game start fanfare — ascending arpeggio */
export function playGameStart() {
  play((ac, dest) => {
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      const t = ac.currentTime + i * 0.1;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.35);
    });
  });
}

/** Game over / results — descending then resolution */
export function playGameOver() {
  play((ac, dest) => {
    const notes = [784, 659, 523, 659, 784]; // G5 E5 C5 E5 G5
    notes.forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t = ac.currentTime + i * 0.15;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(i === 4 ? 0.22 : 0.14, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + (i === 4 ? 0.5 : 0.25));
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + (i === 4 ? 0.5 : 0.25));
    });
  });
}

/** Correct answer — happy double beep */
export function playCorrect() {
  play((ac, dest) => {
    [660, 880].forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t = ac.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.15);
    });
  });
}

/** Wrong answer — descending buzz */
export function playWrong() {
  play((ac, dest) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(150, ac.currentTime + 0.2);
    g.gain.setValueAtTime(0.1, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
    o.connect(g).connect(dest);
    o.start();
    o.stop(ac.currentTime + 0.25);
  });
}

/** Timer tick warning — subtle tick when time is low */
export function playTimerTick() {
  play((ac, dest) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = 1000;
    g.gain.setValueAtTime(0.08, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04);
    o.connect(g).connect(dest);
    o.start();
    o.stop(ac.currentTime + 0.04);
  });
}

/** Round end — short resolve */
export function playRoundEnd() {
  play((ac, dest) => {
    [440, 554, 659].forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t = ac.currentTime + i * 0.06;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.2);
    });
  });
}
