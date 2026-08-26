// ============================================================================
// Damped Path View — Creates a PathLike wrapper using CST-damped positions.
//
// This wraps a PathBuffer's getVisualX/getVisualY into the PathLike interface
// so renderers can use it transparently.
//
// RENDER-ONLY — collision, food, and all game logic use raw path positions.
// ============================================================================

import type { PathLike } from './coil-path';
import type { PathBuffer } from '@/lib/snake/pool';

/** Type guard: check if a path has CST damping support */
function hasDamping(p: any): p is PathBuffer {
  return p && typeof p.updateDampedTrail === 'function';
}

/**
 * Create a PathLike view that uses CST-damped visual positions.
 * The head position (headX/headY) is always exact (no damping).
 *
 * If the path doesn't support damping (e.g. online mode plain objects),
 * returns a passthrough wrapper.
 *
 * @param path The raw path (PathBuffer or IPathBuffer)
 * @param cst Damping constant (0.43 = snek-game default)
 * @returns PathLike with damped segment positions
 */
export function makeDampedPathView(path: any, cst: number = 0.43): PathLike {
  if (hasDamping(path)) {
    // Update damped positions for this frame
    path.updateDampedTrail(cst);
    return {
      getX: (i: number) => path.getVisualX(i),
      getY: (i: number) => path.getVisualY(i),
      length: path.length,
      headX: path.headX,
      headY: path.headY,
    };
  }
  // Fallback: return passthrough (online mode or non-PathBuffer)
  return {
    getX: (i: number) => path.getX(i),
    getY: (i: number) => path.getY(i),
    length: path.length,
    headX: path.headX,
    headY: path.headY,
  };
}
