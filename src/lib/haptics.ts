// VA-HAPTICS: vibration feedback gated by the user's settings toggle.
// Uses the standard Vibration API — supported on Android Chrome/WebView.
// iOS Safari does not expose navigator.vibrate; calls degrade to no-ops.

import { getSettings } from './settings';

export function hapticSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function haptic(pattern: number | number[]): void {
  if (!getSettings().haptics) return;
  if (!hapticSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Never let feedback break gameplay.
  }
}

/** Presets so game + UI use consistent feels. */
export const HAPTIC = {
  /** In-game: elimination. */
  death: [60, 50, 90] as number[],
  /** In-game: successful extraction (cash-out). */
  cash: [30, 40, 30, 40, 70] as number[],
  /** UI: toggle switched on. */
  tickOn: 15 as number,
};
