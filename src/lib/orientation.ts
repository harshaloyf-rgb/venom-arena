// VA-ORIENTATION: applies the user's portrait/landscape choice.
//
// Native (Capacitor Android): locks via @capacitor/screen-orientation —
// this overrides the manifest's portrait default at runtime.
// Web: window.screen.orientation.lock() is best-effort (most desktop
// browsers reject it outside fullscreen — silently ignored; the game
// simply follows the window).
//
// The plugin import is dynamic so the web bundle never hard-depends on
// the native bridge being present at startup.

import { Capacitor } from '@capacitor/core';
import type { OrientationMode } from './settings';

export async function applyOrientation(mode: OrientationMode): Promise<void> {
  // Native app — the authoritative path.
  if (Capacitor.isNativePlatform()) {
    try {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      await ScreenOrientation.lock({ orientation: mode });
      return;
    } catch {
      // Fall through to the web path (harmless if it also rejects).
    }
  }
  // Web / WebView fallback. (DOM lib does not type lock() — cast required.)
  try {
    const so = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (m: string) => Promise<void> })
      | undefined;
    if (so?.lock) await so.lock(mode);
  } catch {
    // Desktop browsers reject lock() outside fullscreen — expected no-op.
  }
}
