// VA-AUDIO: minimal procedural audio engine (no asset files).
//
// Design constraints (legendary-emitter lesson applied):
//  - Event-driven only: zero per-frame allocations, zero rAF loops.
//  - Everything synthesized with oscillators — no downloads, no decode
//    latency, nothing to cache-bust.
//  - The AudioContext is created lazily on the FIRST user gesture
//    (browser autoplay policy) and resumed there if suspended.
//  - Music is a quiet ambient bed (two detuned pads + slow pentatonic
//    pluck arp) scheduled 2s ahead via setInterval — a throttled
//    background tab just pauses the arp, nothing breaks.
//  - Toggles read through the settings store; `sound: false` short-
//    circuits playSfx before any node is touched.

import { getSettings, subscribeSettings } from './settings';

export type SfxName = 'click' | 'eat' | 'death' | 'cash';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicStarted = false;
let arpTimer: ReturnType<typeof setInterval> | null = null;
let arpStep = 0;
let initialized = false;

// Throttles (chips can be eaten in bursts; clicks can machine-gun).
let lastClickAt = 0;
let lastEatAt = 0;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.5;
      musicBus.connect(masterGain);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1.0;
      sfxBus.connect(masterGain);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => undefined);
  }
  return ctx;
}

// ── SFX voices (one-shot, self-disconnecting) ─────────────────────────

function blip(freqFrom: number, freqTo: number, dur: number, peak: number, type: OscillatorType, when = 0): void {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t);
  if (freqTo !== freqFrom) osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function sfxClick(): void {
  blip(1750, 1400, 0.05, 0.08, 'square');
}

function sfxEat(): void {
  blip(620, 980, 0.09, 0.14, 'sine');
}

function sfxDeath(): void {
  blip(320, 55, 0.55, 0.22, 'sawtooth');
  blip(180, 40, 0.7, 0.12, 'triangle', 0.05);
}

function sfxCash(): void {
  blip(523.25, 523.25, 0.14, 0.16, 'sine');
  blip(783.99, 783.99, 0.22, 0.14, 'sine', 0.12);
  blip(1046.5, 1046.5, 0.3, 0.1, 'sine', 0.24);
}

export function playSfx(name: SfxName): void {
  if (!getSettings().sound) return;
  if (!ensureCtx()) return;
  const now = performance.now();
  if (name === 'click') {
    if (now - lastClickAt < 70) return;
    lastClickAt = now;
    sfxClick();
  } else if (name === 'eat') {
    if (now - lastEatAt < 90) return;
    lastEatAt = now;
    sfxEat();
  } else if (name === 'death') {
    sfxDeath();
  } else if (name === 'cash') {
    sfxCash();
  }
}

// ── Music bed ─────────────────────────────────────────────────────────

// A-minor pentatonic, two octaves up — calm, never melancholic.
const ARP_NOTES = [440.0, 523.25, 659.25, 783.99, 880.0, 659.25, 523.25, 587.33];

function scheduleArpNote(): void {
  if (!ctx || !musicBus) return;
  const freq = ARP_NOTES[arpStep % ARP_NOTES.length];
  arpStep++;
  const t = ctx.currentTime + 0.05;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.075, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  osc.connect(g);
  g.connect(musicBus);
  osc.start(t);
  osc.stop(t + 1.6);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function startMusic(): void {
  if (musicStarted || !ensureCtx() || !ctx || !musicBus) return;
  musicStarted = true;

  // Two detuned low pads with a slow breathing LFO on their gain.
  const padG = ctx.createGain();
  padG.gain.value = 0.055;
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.06;
  lfoDepth.gain.value = 0.02;
  lfo.connect(lfoDepth);
  lfoDepth.connect(padG.gain);
  const pad1 = ctx.createOscillator();
  pad1.type = 'sine';
  pad1.frequency.value = 110; // A2
  const pad2 = ctx.createOscillator();
  pad2.type = 'triangle';
  pad2.frequency.value = 164.81; // E3
  pad1.connect(padG);
  pad2.connect(padG);
  padG.connect(musicBus);
  pad1.start();
  pad2.start();
  lfo.start();

  // Slow pluck arp, 2s lookahead cadence.
  scheduleArpNote();
  arpTimer = setInterval(scheduleArpNote, 2000);
}

function stopMusic(): void {
  if (!musicStarted) return;
  musicStarted = false;
  if (arpTimer) {
    clearInterval(arpTimer);
    arpTimer = null;
  }
  // Bus is disconnected/recreated lazily; oscillators fade with the context.
  // Simplest reliable stop: silence the bus (pads keep draining at zero).
  if (musicBus && ctx) {
    musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    // Rebuild the bus so a re-enable starts clean.
    const fresh = ctx.createGain();
    fresh.gain.value = 0.5;
    fresh.connect(masterGain!);
    musicBus = fresh;
    musicBus.gain.setValueAtTime(0.5, ctx.currentTime);
  }
}

function syncMusic(): void {
  if (getSettings().music) startMusic();
  else stopMusic();
}

// ── Boot ──────────────────────────────────────────────────────────────

/**
 * Call once at app boot. Wires:
 *  1. first-gesture unlock (autoplay policy),
 *  2. the delegated UI-click SFX listener (buttons/links only — canvas
 *     gameplay taps never tick),
 *  3. the settings subscription that starts/stops the music bed.
 */
export function initAudio(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const unlock = () => {
    ensureCtx();
    syncMusic();
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });

  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button, a, [role="button"]');
      if (!el) return;
      if (el.hasAttribute('data-no-sfx')) return;
      playSfx('click');
    },
    { passive: true },
  );

  subscribeSettings(() => syncMusic());
}
