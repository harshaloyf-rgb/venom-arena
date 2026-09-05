// ============================================================================
// Background Themes — static procedural arena backgrounds (cosmetic only)
// ============================================================================
// 8 fully-static themes (zero per-frame animation, zero particles, zero new
// rAF loops). Each theme is PURE DATA: a base (solid or gradient, cached per
// viewport size), a repeating pattern drawn world-locked with the same
// batched-path discipline as the original grid, and a theme-tinted arena
// boundary + minimap accent.
//
// Readability contract (every theme):
//   - base stays dark; line-pattern alpha ≤ 0.10 so food / snakes / boosts
//     remain the brightest elements on screen
//   - 'bg-classic-dark' reproduces the original #0a0a0f + 6% white grid
//     pixel-identically and is always the fallback default
//
// This module is isomorphic: the equip API imports getBackgroundById() for
// validation, the game render path imports the painters, the shop UI imports
// the catalog + drawBackgroundSample() for WYSIWYG swatches (same code path
// as gameplay → preview can never drift from the real thing).

import { ARENA_GRID_SIZE } from './config';
import type { Camera, Viewport } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type BackgroundPatternType =
  | 'grid'      // square grid, both axes (classic / synthwave / blood moon)
  | 'pinstripe' // vertical world-locked lines only (championship gold)
  | 'dunes'     // static sine bands (desert pit)
  | 'dots'      // world-lattice dots (deep ocean)
  | 'hex'       // flat-top hexagon cells (venom pit)
  | 'stars'     // deterministic two-depth star specks (nebula)
  | 'none';

export interface BackgroundPattern {
  type: BackgroundPatternType;
  /** 'r,g,b' triple — composed into the precomputed patternStyle */
  rgb: string;
  /** max alpha (≤ 0.10 for line patterns per the readability contract) */
  opacity: number;
  /** world-px spacing; omitted for grid/pinstripe → ARENA_GRID_SIZE */
  size?: number;
  /** optional second glow stroke (neon grid) / second star depth */
  glowRgb?: string;
  glowOpacity?: number;
}

export interface BackgroundBase {
  type: 'solid' | 'linear' | 'radial';
  /** solid: single color; linear: [top, bottom]; radial: [center, edge] */
  colors: string[];
}

export interface BackgroundTheme {
  id: string;
  name: string;
  base: BackgroundBase;
  pattern: BackgroundPattern;
  /** boundary ring + minimap accent tint, 'r,g,b' */
  accentRgb: string;
  /** precomputed stroke styles for the 3 boundary rings (0.08 / 0.15 / 0.5) */
  boundaryStrokes: [string, string, string];
  /** precomputed pattern style, e.g. 'rgba(255,255,255,0.06)' */
  patternStyle: string;
  /** precomputed glow style for neon grids / second star depth */
  patternGlowStyle?: string;
}

// ─── Catalog ───────────────────────────────────────────────────────────────

export const DEFAULT_BACKGROUND_ID = 'bg-classic-dark';

interface ThemeSpec {
  id: string;
  name: string;
  base: BackgroundBase;
  pattern: BackgroundPattern;
  accentRgb: string;
}

function makeTheme(spec: ThemeSpec): BackgroundTheme {
  return {
    ...spec,
    boundaryStrokes: [
      `rgba(${spec.accentRgb},0.08)`,
      `rgba(${spec.accentRgb},0.15)`,
      `rgba(${spec.accentRgb},0.5)`,
    ],
    patternStyle: `rgba(${spec.pattern.rgb},${spec.pattern.opacity})`,
    patternGlowStyle: spec.pattern.glowRgb
      ? `rgba(${spec.pattern.glowRgb},${spec.pattern.glowOpacity ?? 0.05})`
      : undefined,
  };
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
  makeTheme({
    id: 'bg-classic-dark',
    name: 'Classic Dark',
    base: { type: 'solid', colors: ['#0a0a0f'] },
    pattern: { type: 'grid', rgb: '255,255,255', opacity: 0.06 },
    accentRgb: '239,68,68',
  }),
  makeTheme({
    id: 'bg-neon-synthwave',
    name: 'Neon Synthwave',
    base: { type: 'linear', colors: ['#1a1033', '#0d0a1f'] },
    pattern: { type: 'grid', rgb: '236,72,153', opacity: 0.09, glowRgb: '34,211,238', glowOpacity: 0.05 },
    accentRgb: '236,72,153',
  }),
  makeTheme({
    id: 'bg-venom-pit',
    name: 'Venom Pit',
    base: { type: 'radial', colors: ['#0d1b12', '#050a06'] },
    pattern: { type: 'hex', rgb: '52,211,153', opacity: 0.07, size: 120 },
    accentRgb: '52,211,153',
  }),
  makeTheme({
    id: 'bg-deep-ocean',
    name: 'Deep Ocean',
    base: { type: 'linear', colors: ['#07253a', '#04121e'] },
    pattern: { type: 'dots', rgb: '125,211,252', opacity: 0.1, size: 90 },
    accentRgb: '56,189,248',
  }),
  makeTheme({
    id: 'bg-desert-pit',
    name: 'Desert Pit',
    base: { type: 'linear', colors: ['#2a1f12', '#140f08'] },
    pattern: { type: 'dunes', rgb: '217,119,6', opacity: 0.08, size: 150 },
    accentRgb: '245,158,11',
  }),
  makeTheme({
    id: 'bg-blood-moon',
    name: 'Blood Moon',
    base: { type: 'radial', colors: ['#1c0b10', '#070304'] },
    pattern: { type: 'grid', rgb: '239,68,68', opacity: 0.06 },
    accentRgb: '239,68,68',
  }),
  makeTheme({
    id: 'bg-nebula',
    name: 'Nebula',
    base: { type: 'solid', colors: ['#05050c'] },
    pattern: { type: 'stars', rgb: '196,181,253', opacity: 0.3, size: 170, glowRgb: '129,140,248', glowOpacity: 0.2 },
    accentRgb: '139,92,246',
  }),
  makeTheme({
    id: 'bg-championship-gold',
    name: 'Championship Gold',
    base: { type: 'linear', colors: ['#15130c', '#0a0906'] },
    pattern: { type: 'pinstripe', rgb: '202,138,4', opacity: 0.07, size: 130 },
    accentRgb: '234,179,8',
  }),
];

export function getBackgroundById(id: string): BackgroundTheme | undefined {
  return BACKGROUND_THEMES.find((t) => t.id === id);
}

// ─── Active theme (module-level, mirrors minimap-zoom state pattern) ───────

let activeTheme: BackgroundTheme = BACKGROUND_THEMES[0];

/** Called from AuthProvider whenever the player profile loads/refreshes. */
export function setActiveBackgroundTheme(id: string | null | undefined): void {
  activeTheme = getBackgroundById(id ?? '') ?? BACKGROUND_THEMES[0];
}

export function getActiveBackgroundTheme(): BackgroundTheme {
  return activeTheme;
}

// ─── Base painting (gradient cached per ctx+size — never per frame) ────────

let baseCache: {
  ctx: CanvasRenderingContext2D;
  key: string;
  style: string | CanvasGradient;
} | null = null;

export function drawBackgroundBase(
  ctx: CanvasRenderingContext2D,
  theme: BackgroundTheme,
  w: number,
  h: number,
): void {
  const b = theme.base;
  if (b.type === 'solid') {
    ctx.fillStyle = b.colors[0];
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const key = `${theme.id}|${w}x${h}`;
  if (!baseCache || baseCache.ctx !== ctx || baseCache.key !== key) {
    let grad: CanvasGradient;
    if (b.type === 'linear') {
      grad = ctx.createLinearGradient(0, 0, 0, h);
    } else {
      grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.sqrt(w * w + h * h) / 2);
    }
    grad.addColorStop(0, b.colors[0]);
    grad.addColorStop(1, b.colors[1]);
    baseCache = { ctx, key, style: grad };
  }
  ctx.fillStyle = baseCache.style as CanvasGradient;
  ctx.fillRect(0, 0, w, h);
}

// ─── Pattern painting ──────────────────────────────────────────────────────
// Line patterns (grid/pinstripe) use the original pixel-snapped screen-space
// algorithm (crisp at any DPR — see "CRITICAL BLUR FIX" heritage). Lattice
// patterns (dots/hex/dunes) draw in world transform. Stars draw in screen
// space (constant speck size, like real sky).

function dpr(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

function drawLinesPattern(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewport: Viewport,
  spacingWorld: number,
  style: string,
  verticalOnly: boolean,
  glowStyle?: string,
): void {
  const zoom = camera.zoom;
  const zoomed = spacingWorld * zoom;
  // Sparse patterns cull earlier than the classic grid (dense unreadable).
  if (zoomed < (verticalOnly ? 14 : 4)) return;
  const dp = dpr();
  const cw = viewport.width;
  const ch = viewport.height;

  ctx.lineWidth = 1 / dp;
  ctx.strokeStyle = style;

  let offsetX = (-camera.x * zoom + cw / 2) % zoomed;
  if (offsetX < 0) offsetX += zoomed;
  ctx.beginPath();
  for (let x = offsetX; x < cw; x += zoomed) {
    const ix = (x + 0.5) | 0;
    ctx.moveTo(ix, 0);
    ctx.lineTo(ix, ch);
  }
  if (!verticalOnly) {
    let offsetY = (-camera.y * zoom + ch / 2) % zoomed;
    if (offsetY < 0) offsetY += zoomed;
    for (let y = offsetY; y < ch; y += zoomed) {
      const iy = (y + 0.5) | 0;
      ctx.moveTo(0, iy);
      ctx.lineTo(cw, iy);
    }
  }
  // Neon glow: stroke the SAME path wide+faint first, then crisp main stroke.
  if (glowStyle) {
    ctx.lineWidth = 3 / dp;
    ctx.strokeStyle = glowStyle;
    ctx.stroke();
    ctx.lineWidth = 1 / dp;
    ctx.strokeStyle = style;
  }
  ctx.stroke();
}

function withWorldTransform(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewport: Viewport,
  fn: (bounds: { left: number; right: number; top: number; bottom: number }) => void,
): void {
  const zoom = camera.zoom;
  ctx.save();
  ctx.translate(viewport.width / 2 - camera.x * zoom, viewport.height / 2 - camera.y * zoom);
  ctx.scale(zoom, zoom);
  fn({
    left: camera.x - viewport.width / (2 * zoom),
    right: camera.x + viewport.width / (2 * zoom),
    top: camera.y - viewport.height / (2 * zoom),
    bottom: camera.y + viewport.height / (2 * zoom),
  });
  ctx.restore();
}

function drawDotsPattern(ctx: CanvasRenderingContext2D, theme: BackgroundTheme, camera: Camera, viewport: Viewport): void {
  const size = theme.pattern.size ?? 90;
  if (size * camera.zoom < 14) return;
  withWorldTransform(ctx, camera, viewport, ({ left, right, top, bottom }) => {
    ctx.fillStyle = theme.patternStyle;
    const r = 1.4 / camera.zoom; // ≈1.4 screen px regardless of zoom
    ctx.beginPath();
    for (let ix = Math.floor(left / size); ix <= Math.floor(right / size); ix++) {
      for (let iy = Math.floor(top / size); iy <= Math.floor(bottom / size); iy++) {
        const cx = ix * size;
        const cy = iy * size;
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  });
}

function drawHexPattern(ctx: CanvasRenderingContext2D, theme: BackgroundTheme, camera: Camera, viewport: Viewport): void {
  const R = (theme.pattern.size ?? 120) / 2; // hexagon circumradius (world px)
  const wStep = R * Math.sqrt(3); // flat-top column spacing
  const hStep = R * 1.5;
  if (wStep * camera.zoom < 12) return;
  const dp = dpr();
  withWorldTransform(ctx, camera, viewport, ({ left, right, top, bottom }) => {
    const row0 = Math.floor(top / hStep);
    const row1 = Math.floor(bottom / hStep);
    const colSpan = Math.floor((right - left) / wStep) + 2;
    if ((row1 - row0 + 1) * colSpan > 1600) return; // perf cap when zoomed far out
    ctx.strokeStyle = theme.patternStyle;
    ctx.lineWidth = 1 / dp / camera.zoom; // 1 physical pixel
    ctx.beginPath();
    for (let row = row0; row <= row1; row++) {
      const cy = row * hStep;
      const offset = row & 1 ? wStep / 2 : 0;
      const col0 = Math.floor((left - offset) / wStep);
      const col1 = Math.floor((right - offset) / wStep);
      for (let col = col0; col <= col1; col++) {
        const cx = col * wStep + offset;
        for (let v = 0; v < 6; v++) {
          const a = (Math.PI / 3) * v;
          const vx = cx + R * Math.cos(a);
          const vy = cy + R * Math.sin(a);
          if (v === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      }
    }
    ctx.stroke();
  });
}

function drawDunesPattern(ctx: CanvasRenderingContext2D, theme: BackgroundTheme, camera: Camera, viewport: Viewport): void {
  const size = theme.pattern.size ?? 150;
  if (size * camera.zoom < 26) return;
  const dp = dpr();
  withWorldTransform(ctx, camera, viewport, ({ left, right, top, bottom }) => {
    ctx.strokeStyle = theme.patternStyle;
    ctx.lineWidth = 2 / dp / camera.zoom;
    const lambda = size * 1.9;
    const amp = size * 0.22;
    const stepX = size / 6;
    ctx.beginPath();
    for (let row = Math.floor(top / size); row <= Math.floor(bottom / size); row++) {
      const baseY = row * size;
      const startX = Math.floor(left / stepX) * stepX;
      for (let x = startX; x <= right + stepX; x += stepX) {
        // Deterministic per-row phase → static bands locked to the world.
        const y = baseY + Math.sin(x / lambda + row * 1.7) * amp;
        if (x === startX) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  });
}

/** Deterministic 0..1 hash for star jitter (no RNG state, stable per cell). */
function hash2(ix: number, iy: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function drawStarsPattern(ctx: CanvasRenderingContext2D, theme: BackgroundTheme, camera: Camera, viewport: Viewport): void {
  const cw = viewport.width;
  const ch = viewport.height;
  const zoom = camera.zoom;
  const baseSize = theme.pattern.size ?? 170;
  const passes = [
    { size: baseSize, rgb: theme.pattern.rgb, alpha: theme.pattern.opacity, rBase: 0.9 },
    {
      size: baseSize * 2.1,
      rgb: theme.pattern.glowRgb ?? theme.pattern.rgb,
      alpha: theme.pattern.glowOpacity ?? theme.pattern.opacity * 0.7,
      rBase: 0.6,
    },
  ];
  const left = camera.x - cw / (2 * zoom);
  const right = camera.x + cw / (2 * zoom);
  const top = camera.y - ch / (2 * zoom);
  const bottom = camera.y + ch / (2 * zoom);
  for (const pass of passes) {
    const cols = Math.ceil((right - left) / pass.size) + 1;
    const rows = Math.ceil((bottom - top) / pass.size) + 1;
    if (cols * rows > 600) continue; // perf cap when zoomed far out
    ctx.fillStyle = `rgba(${pass.rgb},${pass.alpha})`;
    ctx.beginPath();
    for (let ix = Math.floor(left / pass.size); ix <= Math.floor(right / pass.size); ix++) {
      for (let iy = Math.floor(top / pass.size); iy <= Math.floor(bottom / pass.size); iy++) {
        const wx = (ix + hash2(ix, iy)) * pass.size;
        const wy = (iy + hash2(iy * 7 + 13, ix * 5 + 3)) * pass.size;
        const sx = cw / 2 + (wx - camera.x) * zoom;
        const sy = ch / 2 + (wy - camera.y) * zoom;
        if (sx < -2 || sx > cw + 2 || sy < -2 || sy > ch + 2) continue;
        const r = pass.rBase + hash2(ix + 31, iy + 17) * 0.9;
        ctx.moveTo(sx + r, sy);
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}

export function drawBackgroundPattern(
  ctx: CanvasRenderingContext2D,
  theme: BackgroundTheme,
  camera: Camera,
  viewport: Viewport,
): void {
  const p = theme.pattern;
  switch (p.type) {
    case 'grid':
      drawLinesPattern(ctx, camera, viewport, p.size ?? ARENA_GRID_SIZE, theme.patternStyle, false, theme.patternGlowStyle);
      break;
    case 'pinstripe':
      drawLinesPattern(ctx, camera, viewport, p.size ?? ARENA_GRID_SIZE, theme.patternStyle, true);
      break;
    case 'dunes':
      drawDunesPattern(ctx, theme, camera, viewport);
      break;
    case 'dots':
      drawDotsPattern(ctx, theme, camera, viewport);
      break;
    case 'hex':
      drawHexPattern(ctx, theme, camera, viewport);
      break;
    case 'stars':
      drawStarsPattern(ctx, theme, camera, viewport);
      break;
    case 'none':
      break;
  }
}

// ─── Static sample (shop swatches — SAME painters as gameplay) ─────────────
// Draws base + pattern with a fixed fake camera. Used by the Backgrounds
// panel so what you see on the card is exactly what the arena renders.

export function drawBackgroundSample(
  ctx: CanvasRenderingContext2D,
  theme: BackgroundTheme,
  w: number,
  h: number,
): void {
  const zoom = 0.4;
  drawBackgroundBase(ctx, theme, w, h);
  const camera: Camera = { x: 0, y: 0, zoom };
  const viewport: Viewport = { left: 0, top: 0, right: w, bottom: h, width: w, height: h };
  drawBackgroundPattern(ctx, theme, camera, viewport);
}
