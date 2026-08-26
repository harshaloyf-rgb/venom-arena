// ============================================================================
// Venom Arena — 3D Radial Gradient System
// Caches gradients by radius in 2px buckets to avoid creating every frame.
// ============================================================================

import type { SnakeConfig } from '@/lib/snake/config';

// ── Color Helpers ──────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

export function brighten(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(
    c.r + (255 - c.r) * amount,
    c.g + (255 - c.g) * amount,
    c.b + (255 - c.b) * amount,
  );
}

export function darken(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(c.r * (1 - amount), c.g * (1 - amount), c.b * (1 - amount));
}

// ── Gradient Cache ────────────────────────────────────────────────────────

interface CacheEntry {
  gradient: CanvasGradient;
  baseColor: string;
}

/**
 * Caches CanvasGradient objects by radius (bucketed in 2px steps).
 * Avoids creating a new gradient object every frame for the same radius.
 */
export class GradientCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;

  constructor(maxEntries = 256) {
    this.maxEntries = maxEntries;
  }

  private bucketKey(radius: number, baseColor: string): string {
    const r = Math.round(radius / 2) * 2;
    return `${r}:${baseColor}`;
  }

  get(radius: number, baseColor: string): CanvasGradient | null {
    const key = this.bucketKey(radius, baseColor);
    const entry = this.cache.get(key);
    if (entry && entry.baseColor === baseColor) {
      return entry.gradient;
    }
    return null;
  }

  set(radius: number, baseColor: string, gradient: CanvasGradient): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    const key = this.bucketKey(radius, baseColor);
    this.cache.set(key, { gradient, baseColor });
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Singleton gradient cache instance */
export const gradientCache = new GradientCache(512);

// ── 3D Gradient Creation ──────────────────────────────────────────────────

/**
 * Create a 3D radial gradient that gives segments a spherical look.
 * Highlight is positioned at an offset (0.35) from center, shadow at edge.
 */
export function create3DGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  baseColor: string,
  config: SnakeConfig,
): CanvasGradient {
  // Check cache first
  const cached = gradientCache.get(radius, baseColor);
  if (cached) return cached;

  const lightOffset = config.lightOffset;
  const brightBoost = config.brightBoost;
  const shadowDark = config.shadowDark;

  const r = Math.max(1, radius);

  // Highlight position (top-left of center)
  const hx = x - r * lightOffset;
  const hy = y - r * lightOffset;

  const gradient = ctx.createRadialGradient(hx, hy, r * 0.15, x, y, r);

  const highlightColor = brighten(baseColor, brightBoost / 255);
  const shadowColor = darken(baseColor, shadowDark / 255);

  gradient.addColorStop(0, highlightColor);
  gradient.addColorStop(0.5, baseColor);
  gradient.addColorStop(1, shadowColor);

  gradientCache.set(radius, baseColor, gradient);
  return gradient;
}
