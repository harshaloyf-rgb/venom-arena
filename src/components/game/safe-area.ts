// ============================================================================
// Safe-area inset tracking for canvas HUD (T4-M5)
// ============================================================================
// CSS `env(safe-area-inset-*)` is invisible to <canvas> drawing code — hud.ts
// positions the minimap / score / kills boxes in canvas pixels, so on notched
// phones those elements were partially hidden under the notch and the home
// indicator. This module measures the insets via a hidden probe div (the same
// trick CSS frameworks use) and exposes them to the HUD.
//
// On desktop every inset resolves to 0 → zero visual change, so the HUD can
// apply these offsets unconditionally. Both game components call
// initSafeAreaTracking() in their main effect and invoke the returned cleanup
// on teardown; a ref-count keeps this correct even if two games ever mount.

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let current: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
let probe: HTMLDivElement | null = null;
let refCount = 0;
let listenersBound = false;

function measure(): void {
  if (!probe) return;
  const cs = window.getComputedStyle(probe);
  current = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

function onViewportChange(): void {
  measure();
}

/**
 * Start tracking safe-area insets. Returns a cleanup function that removes
 * the probe and listeners when the last consumer unmounts.
 */
export function initSafeAreaTracking(): () => void {
  refCount++;
  if (!probe && typeof document !== 'undefined') {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('data-safe-area-probe', '');
    // fixed + zero-size so it never affects layout; visibility hidden so it
    // never paints. The paddings mirror env() insets purely for measurement.
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;' +
      'visibility:hidden;pointer-events:none;border:0;margin:0;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
      'env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
    measure();
  }
  if (!listenersBound && typeof window !== 'undefined') {
    listenersBound = true;
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    // Keyboard / pinch on some mobile browsers changes the visual viewport
    // without a window resize — keep insets fresh there too.
    window.visualViewport?.addEventListener('resize', onViewportChange);
  }
  return () => {
    refCount = Math.max(0, refCount - 1);
    if (refCount > 0) return;
    if (listenersBound) {
      listenersBound = false;
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
    }
    probe?.remove();
    probe = null;
  };
}

/** Current safe-area insets in CSS pixels (0 on desktop / non-notched). */
export function getSafeInsets(): SafeInsets {
  return current;
}
