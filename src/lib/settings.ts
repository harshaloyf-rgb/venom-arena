// VA-SETTINGS: per-device game settings, persisted in localStorage.
//
// Why localStorage (not Player columns): settings are device-scoped by
// nature (orientation/perf are hardware properties, not account
// properties), they must work offline, and reading them in the render
// loop must never touch the network or a React provider. Cloud-sync of
// preferences can be layered later without changing call sites — every
// consumer reads through getSettings()/subscribe().

export type OrientationMode = 'portrait' | 'landscape';

export interface GameSettings {
  /** Ambient music bed (procedural, starts after first user gesture). */
  music: boolean;
  /** Sound effects (clicks, chip pickup, death, cash-out). */
  sound: boolean;
  /** Vibration feedback (native Android; no-op where unsupported). */
  haptics: boolean;
  /** Mobile screen orientation. Default portrait (user decision). */
  orientation: OrientationMode;
  /**
   * Performance mode: renders at 1x device pixels instead of the 2x cap
   * (halves fragment work on low-end phones — battery saver).
   */
  perfMode: boolean;
}

const STORAGE_KEY = 'va.settings.v1';

export const DEFAULT_SETTINGS: GameSettings = {
  music: true,
  sound: true,
  haptics: true,
  orientation: 'portrait',
  perfMode: false,
};

export const SUPPORT_EMAIL = 'venomarena@support.com';
export const APP_ENTITY = 'TRILLINAIRE Games';
export const APP_VERSION = 'v0.2.1';

type Listener = (s: GameSettings) => void;

let cached: GameSettings | null = null;
const listeners = new Set<Listener>();

function readStore(): GameSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    // Merge so new settings added later always have safe defaults.
    return {
      music: typeof parsed.music === 'boolean' ? parsed.music : DEFAULT_SETTINGS.music,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_SETTINGS.sound,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULT_SETTINGS.haptics,
      orientation:
        parsed.orientation === 'landscape' ? 'landscape' : 'portrait',
      perfMode:
        typeof parsed.perfMode === 'boolean' ? parsed.perfMode : DEFAULT_SETTINGS.perfMode,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSettings(): GameSettings {
  if (!cached) cached = readStore();
  return cached;
}

/** Patch settings, persist, notify subscribers. Returns the new state. */
export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  const next = { ...getSettings(), ...patch };
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / storage full — in-memory settings still work.
  }
  for (const fn of listeners) {
    try {
      fn(next);
    } catch {
      // A broken listener must never break the settings write path.
    }
  }
  return next;
}

export function subscribeSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * DPR for canvas rendering with the Performance-mode lever applied.
 * Single source of truth — GameCanvas and OnlineSnakeGame both call this
 * so the cap can never drift between the two loops.
 */
export function renderDpr(): number {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(raw, getSettings().perfMode ? 1 : 2);
}
