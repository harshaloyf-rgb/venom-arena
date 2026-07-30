/**
 * Venom Arena — procedural game audio using Web Audio API.
 *
 * All sounds are synthesized at runtime — no audio files needed.
 * Sounds are short and non-intrusive, designed for competitive gameplay.
 */

let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Mute/unmute all game sounds. */
export function setGameAudioMuted(value: boolean): void {
  muted = value;
}

/** Check if game audio is muted. */
export function isGameAudioMuted(): boolean {
  return muted;
}

/** Resume AudioContext on first user interaction (required by browsers). */
export function initGameAudio(): void {
  getCtx();
}

// ── Helper: play a short oscillator tone ──
function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.08,
  detune = 0,
): void {
  if (muted) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Silently fail if audio context is not available
  }
}

// ── Helper: play a noise burst (for impacts/crashes) ──
function playNoise(duration: number, volume = 0.06): void {
  if (muted) return;
  try {
    const ctx = getCtx();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  } catch {
    // Silently fail
  }
}

// ═══════════════════════════════════════════════════════════════
// Sound effects
// ═══════════════════════════════════════════════════════════════

/** Food collection — short blip (higher pitch for larger food). */
export function playFoodCollect(size: 'small' | 'medium' | 'large' | 'star'): void {
  const freqMap = { small: 660, medium: 880, large: 1100, star: 1320 };
  const durMap = { small: 0.08, medium: 0.1, large: 0.12, star: 0.15 };
  playTone(freqMap[size], durMap[size], 'sine', 0.06);
  if (size === 'star') {
    // Star chip: play a secondary harmonic
    playTone(1760, 0.12, 'sine', 0.03);
  }
}

/** Kill / elimination — satisfying impact sound. */
export function playKill(): void {
  playNoise(0.15, 0.08);
  playTone(220, 0.2, 'sawtooth', 0.04);
}

/** Death (you died) — dramatic crash. */
export function playDeath(): void {
  playNoise(0.3, 0.1);
  playTone(150, 0.4, 'sawtooth', 0.06);
  setTimeout(() => playTone(100, 0.3, 'sine', 0.04), 100);
}

/** Extraction start — ascending chime. */
export function playExtractStart(): void {
  playTone(523, 0.1, 'sine', 0.05); // C5
  setTimeout(() => playTone(659, 0.1, 'sine', 0.05), 80); // E5
}

/** Extraction success — triumphant ascending arpeggio. */
export function playExtractSuccess(): void {
  playTone(523, 0.15, 'sine', 0.07); // C5
  setTimeout(() => playTone(659, 0.15, 'sine', 0.07), 100); // E5
  setTimeout(() => playTone(784, 0.2, 'sine', 0.07), 200); // G5
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.06), 300); // C6
}

/** Extraction cancelled / restarted — descending tone. */
export function playExtractRestart(): void {
  playTone(440, 0.12, 'sine', 0.05);
  setTimeout(() => playTone(330, 0.15, 'sine', 0.04), 80);
}

/** Boost activation — short whoosh. */
export function playBoost(): void {
  playNoise(0.08, 0.03);
  playTone(200, 0.1, 'sine', 0.03, -200);
}

/** Wall collision — heavy thud. */
export function playWallHit(): void {
  playNoise(0.2, 0.1);
  playTone(80, 0.3, 'sine', 0.06);
}
