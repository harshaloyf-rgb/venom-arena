/**
 * Venom Arena — canvas render helpers (pure functions, no React).
 *
 * Rendering pipeline:
 *  1. drawGrid — breathing circular arena background + subtle grid + boundary
 *  2. drawFood — three distinct orb sizes (small/medium/large) + star collectibles
 *  3. drawSnake / drawSnakeWithLayering — polyline body + head + eyes + labels
 *     with optional opacity layering for size-proximity interactions
 *  4. drawChipLabel — Indian-numbered chip display above real-player heads
 *  5. drawParticles — death/eat particle bursts
 *  6. drawMinimap — corner radar minimap
 *  7. drawFullMap — full-screen arena overlay
 *  8. drawMapBoundary — dynamic-radius neon-rose boundary with breathing
 *
 * All skin-pattern rendering (rainbow / neon / metallic / camo) preserved.
 */

import type { FoodSnapshot, SnakeSnapshot } from '@/lib/types';
import {
  MAP_BASE_RADIUS,
  MAP_BREATH_AMPLITUDE,
  MAP_BREATH_CYCLE_MS,
  type Skin,
  WORLD_SIZE,
} from '@/lib/game-config';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Per-frame render context. Built fresh each frame by the game loop. */
export interface FrameRenderCtx {
  ctx: CanvasRenderingContext2D;
  /** Canvas CSS-pixel width (already DPR-adjusted in the backing store). */
  w: number;
  /** Canvas CSS-pixel height. */
  h: number;
  /** World-space x at the centre of the viewport. */
  camX: number;
  /** World-space y at the centre of the viewport. */
  camY: number;
  /** Camera zoom factor. */
  zoom: number;
  /** World bounds (square). */
  worldSize: number;
  /** Low-quality mode disables glow, simplifies food, fewer particles. */
  lowQuality: boolean;
  /** The local player's snake id (for head-glow + label emphasis). */
  myId: string;
  /** High-resolution timestamp (ms) for animations. */
  now: number;
  /** Cached metallic gradients, keyed by `${color}:${sizeBucket}`. */
  metallicCache: Map<string, CanvasGradient>;
  /** The player's equipped skin cosmetic (for player-only rendering tweaks). */
  playerSkin: Skin | undefined;
  /** Pixel ratio (for sizing glow radii in device pixels). */
  dpr: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface VisibleRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// ---------------------------------------------------------------------------
// Pure utility helpers
// ---------------------------------------------------------------------------

/** Returns the world-space rectangle visible in the viewport, plus margin. */
export function computeVisibleRect(rc: FrameRenderCtx, marginPx = 100): VisibleRect {
  const halfW = rc.w / 2 / rc.zoom;
  const halfH = rc.h / 2 / rc.zoom;
  const m = marginPx / rc.zoom;
  return {
    left: rc.camX - halfW - m,
    right: rc.camX + halfW + m,
    top: rc.camY - halfH - m,
    bottom: rc.camY + halfH + m,
  };
}

/** Quick AABB-vs-rect test. */
function rectContainsPoint(rect: VisibleRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Returns true if any point in the list is inside the visible rect. */
function snakeIsVisible(pts: { x: number; y: number }[], rect: VisibleRect): boolean {
  if (pts.length === 0) return false;
  if (rectContainsPoint(rect, pts[0].x, pts[0].y)) return true;
  const last = pts[pts.length - 1];
  if (rectContainsPoint(rect, last.x, last.y)) return true;
  const stride = pts.length > 60 ? 4 : 2;
  for (let i = 0; i < pts.length; i += stride) {
    if (rectContainsPoint(rect, pts[i].x, pts[i].y)) return true;
  }
  return false;
}

/**
 * Cache a metallic radial gradient. Bucketed by 2-pixel radius so we don't
 * cache a gradient for every floating-point size value.
 */
function getMetallicGradient(
  rc: FrameRenderCtx,
  radius: number,
  color: string,
  secondary: string | undefined,
): CanvasGradient | string {
  const bucket = Math.max(4, Math.round(radius));
  const key = `${color}:${secondary ?? ''}:${bucket}`;
  const cached = rc.metallicCache.get(key);
  if (cached) return cached;
  const { ctx } = rc;
  const g = ctx.createRadialGradient(-bucket * 0.35, -bucket * 0.35, bucket * 0.1, 0, 0, bucket);
  g.addColorStop(0, '#f8fafc');
  g.addColorStop(0.35, secondary || color);
  g.addColorStop(1, color);
  rc.metallicCache.set(key, g);
  return g;
}

/**
 * Breathing arena radius at a given time. Matches the server's
 * `getMapRadius(elapsedMs)` formula exactly:
 *   baseRadius + sin(cycleProgress * 2π) * amplitude
 */
export function getArenaRadius(now: number): number {
  const cycleTime = (now % MAP_BREATH_CYCLE_MS) / MAP_BREATH_CYCLE_MS;
  const sinVal = Math.sin(cycleTime * Math.PI * 2);
  return MAP_BASE_RADIUS + sinVal * MAP_BREATH_AMPLITUDE;
}

// ---------------------------------------------------------------------------
// Indian number formatting for chip display
// ---------------------------------------------------------------------------

/**
 * Formats a chip count using Indian numbering system.
 *  - Under 1000: plain number (e.g. "500")
 *  - 1K to 99K: "1.5K", "25K"
 *  - 1L (1,00,000) to 99L: "1L", "50L"
 *  - 1Cr (1,00,00,000)+: "1.2Cr", "15Cr"
 */
export function formatChipDisplay(chips: number): string {
  if (chips < 1000) return String(chips);
  if (chips < 100_000) {
    // K range: 1K to 99.9K
    const k = chips / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  if (chips < 10_000_000) {
    // L (lakh) range: 1L to 99.9L
    const l = chips / 100_000;
    return l % 1 === 0 ? `${l}L` : `${l.toFixed(1).replace(/\.0$/, '')}L`;
  }
  // Cr (crore) range
  const cr = chips / 10_000_000;
  return cr % 1 === 0 ? `${cr}Cr` : `${cr.toFixed(1).replace(/\.0$/, '')}Cr`;
}

// ---------------------------------------------------------------------------
// Grid + world bounds
// ---------------------------------------------------------------------------

/**
 * Draws the breathing circular arena: background fill (deep slate `#020617`)
 * clipped to the circle, a subtle grid (`#1e293b`, gridSize 60) inside the
 * circle, and the neon-rose boundary (`#f43f5e`, lineWidth 10, shadowBlur 16).
 *
 * The radius breathes using the same sinusoidal formula as the server.
 */
export function drawGrid(rc: FrameRenderCtx): void {
  const { ctx, worldSize, camX, camY, zoom, w, h } = rc;
  const cx = worldSize / 2;
  const cy = worldSize / 2;
  const radius = getArenaRadius(rc.now);

  // --- Background fill (entire arena disc) ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#020617';
  ctx.fill();
  ctx.clip();

  // --- Grid lines (subtle slate-800, gridSize 60) ---
  const grid = 60;
  const vis = computeVisibleRect(rc);
  const startX = Math.max(0, Math.floor(vis.left / grid) * grid);
  const endX = Math.min(worldSize, Math.ceil(vis.right / grid) * grid);
  const startY = Math.max(0, Math.floor(vis.top / grid) * grid);
  const endY = Math.min(worldSize, Math.ceil(vis.bottom / grid) * grid);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += grid) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = startY; y <= endY; y += grid) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();
  ctx.restore(); // remove clip

  // --- Outer boundary (neon rose, breathing) ---
  ctx.save();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#f43f5e';
  if (!rc.lowQuality) {
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 16;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Silence unused-param lint for camX/camY/w/h.
  void camX;
  void camY;
  void w;
  void h;
}

// ---------------------------------------------------------------------------
// Dynamic map boundary (for online games with dynamic radius)
// ---------------------------------------------------------------------------

/**
 * Draws a circular map boundary with neon-rose glow and a subtle breathing
 * pulse. Used for online arenas where `mapRadius` comes from the GameSnapshot
 * rather than the fixed breathing formula.
 */
export function drawMapBoundary(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  tick: number,
): void {
  // Subtle breathing pulse: ±3px oscillation over a 4-second cycle
  const breathe = Math.sin(tick * 0.0015) * 3;
  const r = Math.max(100, radius + breathe);

  ctx.save();
  // Outer glow
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#f43f5e';
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner subtle glow ring
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, r - 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Food orb rendering — three distinct sizes
// ---------------------------------------------------------------------------

/** Orb type configuration for the three visual tiers. */
interface OrbConfig {
  radius: number;
  color: string;
  glowColor: string;
  shadowBlur: number;
  label: 'small' | 'medium' | 'large';
}

const ORB_CONFIGS: Record<number, OrbConfig> = {
  1: { radius: 3, color: '#34d399', glowColor: '#10b981', shadowBlur: 6, label: 'small' },
  3: { radius: 5, color: '#38bdf8', glowColor: '#0ea5e9', shadowBlur: 10, label: 'medium' },
  5: { radius: 8, color: '#f472b6', glowColor: '#ec4899', shadowBlur: 16, label: 'large' },
};

/** Default config used when orbSize doesn't match known values. */
const DEFAULT_ORB: OrbConfig = ORB_CONFIGS[1];

/**
 * Draws a single food orb with glow effects. The orbSize determines which
 * visual tier to use. Falls back to small orb for unknown sizes.
 */
export function drawFoodOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orbSize: number,
  value: number,
  color: string,
  glowColor: string,
  now: number,
  lowQuality: boolean,
): void {
  // Select config based on value; use provided color/glowColor if different
  const config = ORB_CONFIGS[value] ?? DEFAULT_ORB;
  const useColor = color || config.color;
  const useGlow = glowColor || config.glowColor;
  const r = Math.max(2, orbSize > 0 ? orbSize : config.radius);

  ctx.save();

  // Large orbs get a subtle pulse animation
  let animR = r;
  if (value === 5 && !lowQuality) {
    const pulse = Math.sin(now * 0.004) * 1.5;
    animR = r + pulse;
  }

  // Glow effect (skip in low quality)
  if (!lowQuality) {
    ctx.shadowColor = useGlow;
    ctx.shadowBlur = config.shadowBlur;
  }

  // Radial gradient for a lit-from-within look
  const grad = ctx.createRadialGradient(x, y, 0, x, y, animR);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, useColor);
  grad.addColorStop(1, useGlow);

  ctx.beginPath();
  ctx.arc(x, y, animR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Star collectible rendering — 5-pointed star shape
// ---------------------------------------------------------------------------

/**
 * Draws a proper 5-pointed star path. Generic helper used by drawStarCollectible.
 *
 * @param ctx     Canvas context
 * @param cx      Center X
 * @param cy      Center Y
 * @param outerR  Outer radius (tip of star)
 * @param innerR  Inner radius (valley between points)
 * @param points  Number of points (always 5 for stars)
 * @param rotation Rotation in radians (for spin animation)
 */
export function drawStarShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
  rotation: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2 + rotation;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Draws a 5-pointed star collectible with golden glow, subtle rotation,
 * and pulsing glow effect. Stars are the rare high-value pickups.
 */
export function drawStarCollectible(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tick: number,
  lowQuality: boolean,
): void {
  const outerR = Math.max(4, size);
  const innerR = Math.max(2, size * 0.4);

  // Rotation: slow spin based on tick
  const rotation = tick * 0.002;

  // Pulsing glow: size oscillates ±1.5px over ~1.5s
  const pulse = lowQuality ? 0 : Math.sin(tick * 0.004) * 1.5;
  const animOuter = outerR + pulse;
  const animInner = innerR + pulse * 0.4;

  ctx.save();

  // Glow
  if (!lowQuality) {
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12 + Math.sin(tick * 0.003) * 4;
  }

  // Star shape
  drawStarShape(ctx, x, y, animOuter, animInner, 5, rotation);

  // Golden radial gradient fill
  const grad = ctx.createRadialGradient(x, y, 0, x, y, animOuter);
  grad.addColorStop(0, '#fef3c7'); // bright center
  grad.addColorStop(0.4, '#fbbf24');
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Extraction ring — white-to-green circle near an extracting snake's head
// ---------------------------------------------------------------------------

/**
 * Draws the extraction progress ring around a snake's head.
 * Visible to ALL players as a warning that someone is banking chips.
 */
export function drawExtractionRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  snakeSize: number,
  progress: number, // 0..1
  zoom: number,
): void {
  if (progress <= 0 || progress > 1) return;

  const ringRadius = Math.max(8, snakeSize + 10 / zoom);
  const lineWidth = Math.max(2, 3 / zoom);

  ctx.save();

  // Background ring (track)
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Progress arc (white → green gradient)
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + progress * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, startAngle, endAngle);

  // Color: white at start → emerald green at end
  const r = Math.round(255 - progress * 227); // 255 → 28
  const g = Math.round(255 - progress * 55);  // 255 → 200
  const b = Math.round(255 - progress * 215); // 255 → 40
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
  ctx.lineWidth = lineWidth + 1 / zoom;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Glow
  if (!lowQualityCheck(ctx)) {
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
    ctx.shadowBlur = 8 / zoom;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, startAngle, endAngle);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/** Cheap low-quality check — if canvas context has a hint. */
function lowQualityCheck(_ctx: CanvasRenderingContext2D): boolean {
  return false; // We don't pass lowQuality here; caller can gate
}

// ---------------------------------------------------------------------------
// Food (main entry point — batches regular orbs, draws stars individually)
// ---------------------------------------------------------------------------

/**
 * Draws all food in two passes:
 *  1. Regular food orbs — batched by orbSize tier into Path2D groups.
 *     Each tier (small/medium/large) has its own glow gradient.
 *  2. Star collectibles — drawn individually as 5-pointed gold stars with
 *     rotation + pulsing glow.
 */
export function drawFood(rc: FrameRenderCtx, foods: FoodSnapshot[]): void {
  const { ctx, lowQuality } = rc;
  const vis = computeVisibleRect(rc);

  // --- Regular food orbs: batch by value tier ---
  const smallOrbs: FoodSnapshot[] = [];
  const mediumOrbs: FoodSnapshot[] = [];
  const largeOrbs: FoodSnapshot[] = [];
  const starChips: FoodSnapshot[] = [];

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (f.x < vis.left || f.x > vis.right || f.y < vis.top || f.y > vis.bottom) {
      continue; // culled
    }
    if (f.isStarChip) {
      starChips.push(f);
      continue;
    }
    // Route to orb tier by value
    if (f.value >= 5) largeOrbs.push(f);
    else if (f.value >= 3) mediumOrbs.push(f);
    else smallOrbs.push(f);
  }

  // Draw each orb tier
  const drawOrbBatch = (orbs: FoodSnapshot[]) => {
    for (let i = 0; i < orbs.length; i++) {
      const f = orbs[i];
      drawFoodOrb(ctx, f.x, f.y, f.orbSize ? f.size : f.size, f.value, f.color, f.glowColor ?? '', rc.now, lowQuality);
    }
  };

  drawOrbBatch(smallOrbs);
  drawOrbBatch(mediumOrbs);
  drawOrbBatch(largeOrbs);

  // --- Star collectibles: 5-pointed gold stars with rotation + glow + value label ---
  if (starChips.length > 0) {
    ctx.save();
    for (let i = 0; i < starChips.length; i++) {
      const f = starChips[i];
      drawStarCollectible(ctx, f.x, f.y, Math.max(6, f.size + 4), rc.now, lowQuality);
      // Draw chip value label inside the star
      if (f.value > 0) {
        const starRadius = Math.max(4, f.size + 4);
        const labelSize = Math.max(7, Math.min(11, starRadius * 0.55));
        ctx.font = `bold ${labelSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#7c2d12'; // dark brown, readable inside golden star
        const label = f.value >= 1000 ? `${Math.round(f.value / 1000)}k` : `${Math.round(f.value)}`;
        ctx.fillText(label, f.x, f.y + 0.5);
      }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Snake rendering
// ---------------------------------------------------------------------------

/**
 * Draws a single snake. The body is rendered as ONE thick stroked polyline
 * (with an outline underlay). The head is drawn separately with eyes and
 * (for the player's own snake, high-quality only) a glow halo.
 *
 * Player skin patterns (rainbow / neon / metallic / camo) are applied when
 * `rc.playerSkin.pattern` is set and the snake is the local player.
 *
 * @param opacity  Optional global alpha override (0..1). Default = 1.
 */
export function drawSnake(rc: FrameRenderCtx, snake: SnakeSnapshot, opacity?: number): void {
  const pts = snake.points;
  if (!pts || pts.length === 0) return;

  const vis = computeVisibleRect(rc);
  if (!snakeIsVisible(pts, vis)) return;

  const { ctx, zoom, lowQuality } = rc;
  const isMe = snake.id === rc.myId;
  const baseAlpha = opacity ?? 1;

  // Downsample long snakes
  const stride = pts.length > 60 ? 2 : 1;

  // Body width in world units
  const radius = Math.max(2, snake.visualRadius ?? snake.size);
  const width = radius * 2;

  ctx.save();
  ctx.globalAlpha = baseAlpha;

  // --- Outline (underlay) ---
  if (snake.secondaryColor) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width + 4 / zoom;
    ctx.strokeStyle = snake.secondaryColor;
    ctx.globalAlpha = baseAlpha * 0.55;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = stride; i < pts.length; i += stride) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // --- Body ---
  ctx.save();
  ctx.globalAlpha = baseAlpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;

  const pattern = isMe ? rc.playerSkin?.pattern : undefined;
  if (pattern === 'metallic' && snake.secondaryColor) {
    const g = getMetallicGradient(rc, radius, snake.color, snake.secondaryColor);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = stride; i < pts.length; i += stride) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  } else if (pattern === 'rainbow' && !lowQuality) {
    const chunkSize = Math.max(4, Math.floor(pts.length / 12));
    ctx.lineWidth = width;
    for (let i = 0; i < pts.length - 1; i += chunkSize) {
      const hue = (rc.now * 0.05 + i * 14) % 360;
      ctx.strokeStyle = `hsl(${hue}, 90%, 55%)`;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      const end = Math.min(pts.length - 1, i + chunkSize + 1);
      for (let j = i + stride; j <= end; j += stride) {
        ctx.lineTo(pts[j].x, pts[j].y);
      }
      ctx.stroke();
    }
  } else if (pattern === 'neon' && !lowQuality) {
    const chunkSize = Math.max(4, Math.floor(pts.length / 10));
    ctx.lineWidth = width;
    let chunkIndex = 0;
    for (let i = 0; i < pts.length - 1; i += chunkSize) {
      const ratio = (Math.sin(rc.now * 0.009 - chunkIndex * 0.28) + 1) / 2;
      ctx.strokeStyle = ratio > 0.5 ? '#06b6d4' : '#a855f7';
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      const end = Math.min(pts.length - 1, i + chunkSize + 1);
      for (let j = i + stride; j <= end; j += stride) {
        ctx.lineTo(pts[j].x, pts[j].y);
      }
      ctx.stroke();
      chunkIndex += 1;
    }
  } else if (pattern === 'camo') {
    const camoColors = ['#15803d', '#854d0e', '#78350f', '#166534'];
    const chunkSize = Math.max(4, Math.floor(pts.length / 12));
    let chunkIndex = 0;
    for (let i = 0; i < pts.length - 1; i += chunkSize) {
      ctx.strokeStyle = camoColors[chunkIndex % camoColors.length];
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      const end = Math.min(pts.length - 1, i + chunkSize + 1);
      for (let j = i + stride; j <= end; j += stride) {
        ctx.lineTo(pts[j].x, pts[j].y);
      }
      ctx.stroke();
      chunkIndex += 1;
    }
  } else {
    // Default: solid snake.color
    ctx.strokeStyle = snake.color;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = stride; i < pts.length; i += stride) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // --- Head ---
  const head = pts[0];
  ctx.save();
  ctx.globalAlpha = baseAlpha;
  if (isMe && !lowQuality) {
    ctx.shadowColor = snake.color;
    ctx.shadowBlur = 14;
  }
  ctx.beginPath();
  ctx.arc(head.x, head.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = snake.color;
  ctx.fill();
  if (isMe && !lowQuality) ctx.shadowBlur = 0;

  // Eyes
  const eyeOffset = radius * 0.45;
  const eyeR = Math.max(1.5, radius * 0.32);
  const pupilR = Math.max(0.8, radius * 0.18);
  const angle = snake.angle;
  const perp = angle + Math.PI / 2;
  const ex1 = head.x + Math.cos(angle) * eyeOffset * 0.4 + Math.cos(perp) * eyeOffset;
  const ey1 = head.y + Math.sin(angle) * eyeOffset * 0.4 + Math.sin(perp) * eyeOffset;
  const ex2 = head.x + Math.cos(angle) * eyeOffset * 0.4 - Math.cos(perp) * eyeOffset;
  const ey2 = head.y + Math.sin(angle) * eyeOffset * 0.4 - Math.sin(perp) * eyeOffset;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2);
  ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(ex1 + Math.cos(angle) * pupilR, ey1 + Math.sin(angle) * pupilR, pupilR, 0, Math.PI * 2);
  ctx.arc(ex2 + Math.cos(angle) * pupilR, ey2 + Math.sin(angle) * pupilR, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // Spawn-protection ring
  if (snake.spawnProtected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(head.x, head.y, radius + 4 / zoom, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // --- Name label ---
  if (snake.name) {
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    ctx.font = `${Math.max(10, 12 / zoom)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelY = head.y - radius - 6 / zoom;
    // Bots get a distinct muted orange label with [BOT] tag; players get normal label
    if (snake.isBot) {
      ctx.fillStyle = 'rgba(251, 146, 60, 0.75)'; // orange-400 muted
      const botLabel = `[BOT] ${snake.name}`;
      ctx.fillText(botLabel, head.x, labelY);
    } else {
      ctx.fillStyle = isMe ? '#22c55e' : 'rgba(226, 232, 240, 0.85)';
      ctx.fillText(snake.name, head.x, labelY);
    }
    if (snake.userTag) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = `${Math.max(8, 9 / zoom)}px monospace`;
      ctx.fillText(snake.userTag, head.x, labelY - 12 / zoom);
    }
    ctx.restore();
  }

  // --- Chat bubble ---
  if (snake.chatMessage) {
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    drawChatBubble(rc, head.x, head.y - radius - 24 / zoom, snake.chatMessage);
    ctx.restore();
  }

  ctx.restore(); // outer globalAlpha save
}

// ---------------------------------------------------------------------------
// Snake opacity layering system
// ---------------------------------------------------------------------------

/** Proximity threshold for opacity fade (world-space pixels). */
const LAYERING_PROXIMITY = 30;

/**
 * Draws a snake with opacity layering: when a smaller snake passes close to a
 * larger snake, the larger snake fades to 75% opacity. This creates visual
 * depth when snakes overlap spatially.
 *
 * Logic:
 *  1. For each OTHER snake, check if its head is within ~30px of this snake's head
 *  2. If a smaller snake (by size) is nearby, this snake fades to 0.75 opacity
 *  3. Otherwise, render at full opacity
 */
export function drawSnakeWithLayering(
  rc: FrameRenderCtx,
  snake: SnakeSnapshot,
  allSnakes: SnakeSnapshot[],
): void {
  const pts = snake.points;
  if (!pts || pts.length === 0) return;

  const myHead = pts[0];
  let shouldFade = false;

  for (let i = 0; i < allSnakes.length; i++) {
    const other = allSnakes[i];
    if (other.id === snake.id) continue;
    const otherPts = other.points;
    if (!otherPts || otherPts.length === 0) continue;

    const otherHead = otherPts[0];
    const dist = Math.hypot(otherHead.x - myHead.x, otherHead.y - myHead.y);

    const snakeR = snake.visualRadius ?? snake.size;
    const otherR = other.visualRadius ?? other.size;
    if (dist < LAYERING_PROXIMITY && snakeR > otherR) {
      // A smaller snake is close by — fade this (larger) snake
      shouldFade = true;
      break;
    }
  }

  drawSnake(rc, snake, shouldFade ? 0.75 : 1);
}

// ---------------------------------------------------------------------------
// Chip label above snake head
// ---------------------------------------------------------------------------

/**
 * Draws a chip count label above the snake's head. Uses Indian numbering
 * (K, L, Cr). Only meaningful for real players (bots have 0 carriedChips).
 *
 * Rendered as a semi-transparent pill with white text, positioned centered
 * above the head.
 */
export function drawChipLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  chips: number,
  snakeSize: number,
  zoom: number,
): void {
  if (chips <= 0) return; // bots have 0 chips, skip them

  const label = formatChipDisplay(chips);
  const fontSize = Math.max(9, 10 / zoom);
  const offset = snakeSize + 12 / zoom;

  ctx.save();
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(label);
  const padX = 5 / zoom;
  const padY = 2 / zoom;
  const tw = metrics.width + padX * 2;
  const th = fontSize + padY * 2;
  const rx = x - tw / 2;
  const ry = y - offset - th;
  const rr = 4 / zoom;

  // Background pill
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.moveTo(rx + rr, ry);
  ctx.lineTo(rx + tw - rr, ry);
  ctx.arcTo(rx + tw, ry, rx + tw, ry + rr, rr);
  ctx.lineTo(rx + tw, ry + th - rr);
  ctx.arcTo(rx + tw, ry + th, rx + tw - rr, ry + th, rr);
  ctx.lineTo(rx + rr, ry + th);
  ctx.arcTo(rx, ry + th, rx, ry + th - rr, rr);
  ctx.lineTo(rx, ry + rr);
  ctx.arcTo(rx, ry, rx + rr, ry, rr);
  ctx.closePath();
  ctx.fill();

  // Gold accent border
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, ry + th / 2);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------

/** Draws a small chat bubble above a snake head. */
function drawChatBubble(
  rc: FrameRenderCtx,
  x: number,
  y: number,
  msg: string,
): void {
  const { ctx, zoom } = rc;
  const text = msg.length > 80 ? msg.slice(0, 78) + '…' : msg;
  ctx.save();
  ctx.font = `${Math.max(10, 11 / zoom)}px monospace`;
  const metrics = ctx.measureText(text);
  const padX = 6 / zoom;
  const padY = 3 / zoom;
  const tw = metrics.width + padX * 2;
  const th = 14 / zoom + padY * 2;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
  ctx.lineWidth = 1.5 / zoom;
  const rx = x - tw / 2;
  const ry = y - th;
  const rr = 4 / zoom;
  ctx.beginPath();
  ctx.moveTo(rx + rr, ry);
  ctx.lineTo(rx + tw - rr, ry);
  ctx.arcTo(rx + tw, ry, rx + tw, ry + rr, rr);
  ctx.lineTo(rx + tw, ry + th - rr);
  ctx.arcTo(rx + tw, ry + th, rx + tw - rr, ry + th, rr);
  ctx.lineTo(rx + rr, ry + th);
  ctx.arcTo(rx, ry + th, rx, ry + th - rr, rr);
  ctx.lineTo(rx, ry + rr);
  ctx.arcTo(rx, ry, rx + rr, ry, rr);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - th / 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

/** Draws the particle array (caller caps at MAX_PARTICLES = 200). */
export function drawParticles(rc: FrameRenderCtx, particles: Particle[]): void {
  if (particles.length === 0) return;
  const { ctx, zoom } = rc;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.life <= 0) continue;
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Minimap (drawn in screen-space, no camera transform)
// ---------------------------------------------------------------------------

export interface MinimapArgs {
  ctx: CanvasRenderingContext2D;
  /** Top-left of minimap in CSS pixels. */
  x: number;
  y: number;
  /** Minimap size (square). */
  size: number;
  worldSize: number;
  /** Current breathing arena radius (world units). */
  arenaRadius: number;
  snakes: SnakeSnapshot[];
  myId: string;
  /**
   * World-space radius around the player the radar should cover. Snakes
   * outside this range are NOT rendered on the small corner minimap.
   * Defaults to WORLD_SIZE/2 (legacy full-radar behaviour) when omitted.
   */
  range?: number;
}

/**
 * Draws the circular radar minimap. Player is rendered as an indigo dot at
 * the centre (the radar is centered on the player's head). The arena
 * boundary is a dashed rose circle. Bots render as rose dots, other real
 * players as emerald dots — matches AUDIT-A radar visual language.
 */
export function drawMinimap(args: MinimapArgs): void {
  const { ctx, x, y, size, worldSize, arenaRadius, snakes, myId } = args;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  const radarRange = args.range ?? WORLD_SIZE / 2;
  const scale = r / radarRange;

  ctx.save();
  // Background circle (radar disc)
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Clip to minimap circle.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Concentric rings.
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.10)';
  ctx.lineWidth = 1;
  for (const inset of [2, 5, 8]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - inset, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshairs.
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, y + size);
  ctx.moveTo(x, cy);
  ctx.lineTo(x + size, cy);
  ctx.stroke();

  // Arena boundary (dashed rose) — centered on world center.
  const mySnake = snakes.find((s) => s.id === myId);
  const myHead = mySnake?.points?.[0];
  const px = myHead ? myHead.x : worldSize / 2;
  const py = myHead ? myHead.y : worldSize / 2;
  const worldCenterOffsetX = (worldSize / 2 - px) * scale;
  const worldCenterOffsetY = (worldSize / 2 - py) * scale;
  const arenaR = arenaRadius * scale;
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx + worldCenterOffsetX, cy + worldCenterOffsetY, arenaR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Snakes (player centered → drawn at centre; others offset).
  for (let i = 0; i < snakes.length; i++) {
    const s = snakes[i];
    if (!s.points || s.points.length === 0) continue;
    const head = s.points[0];
    const dx = (head.x - px) * scale;
    const dy = (head.y - py) * scale;
    const dist = Math.hypot(dx, dy);
    if (dist > r) continue;
    const mx = cx + dx;
    const my = cy + dy;
    ctx.beginPath();
    if (s.id === myId) {
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#818cf8'; // indigo-400
    } else if (s.isBot) {
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e'; // rose-500
    } else {
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399'; // emerald-400
    }
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Full Map overlay — drawn in screen-space, no camera transform.
// Press `M` to toggle. Shows the ENTIRE arena with all snakes as dots.
// ---------------------------------------------------------------------------

export interface FullMapArgs {
  ctx: CanvasRenderingContext2D;
  /** Canvas CSS-pixel width. */
  w: number;
  /** Canvas CSS-pixel height. */
  h: number;
  worldSize: number;
  /** Current breathing arena radius (world units). */
  arenaRadius: number;
  snakes: SnakeSnapshot[];
  myId: string;
}

/**
 * Draws a full-screen overlay of the entire arena. The arena circle is
 * centered on screen and scaled to fit the smaller of (w, h) with padding.
 * All snakes are rendered as dots — player = indigo (larger), bots = rose,
 * other real humans = emerald. A "Press M to close" hint is drawn at the
 * bottom. The player's own dot pulses with a ring.
 */
export function drawFullMap(args: FullMapArgs): void {
  const { ctx, w, h, worldSize, arenaRadius, snakes, myId } = args;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // --- Background fill (dim slate) ---
  ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
  ctx.fillRect(0, 0, w, h);

  // --- Layout: arena centred on screen ---
  const cx = w / 2;
  const cy = h / 2;
  const margin = 80;
  const fitDim = Math.min(w, h) - margin * 2;
  const arenaDiameter = arenaRadius * 2;
  const scale = fitDim / arenaDiameter;
  const screenR = arenaRadius * scale;

  const wcx = worldSize / 2;
  const wcy = worldSize / 2;
  const toScreenX = (wx: number) => cx + (wx - wcx) * scale;
  const toScreenY = (wy: number) => cy + (wy - wcy) * scale;

  // --- Concentric range rings (faint) ---
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.10)';
  ctx.lineWidth = 1;
  for (const frac of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.arc(cx, cy, screenR * frac, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Crosshairs.
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - screenR);
  ctx.lineTo(cx, cy + screenR);
  ctx.moveTo(cx - screenR, cy);
  ctx.lineTo(cx + screenR, cy);
  ctx.stroke();

  // --- Arena boundary (dashed rose) ---
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, screenR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- Snakes ---
  for (let i = 0; i < snakes.length; i++) {
    const s = snakes[i];
    if (!s.points || s.points.length === 0) continue;
    const head = s.points[0];
    const sx = toScreenX(head.x);
    const sy = toScreenY(head.y);
    ctx.beginPath();
    if (s.id === myId) {
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#818cf8';
      ctx.fill();
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.isBot) {
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
    } else {
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399';
      ctx.fill();
    }
  }

  // --- Title + close hint ---
  ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('ARENA OVERVIEW — ALL SNAKES', cx, 16);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.font = '11px monospace';
  ctx.fillText('Press M to close', cx, h - 24);

  // Legend (top-left).
  ctx.textAlign = 'left';
  ctx.font = '11px monospace';
  const legendX = 20;
  let legendY = 20;
  const drawLegend = (color: string, label: string, dotR: number) => {
    ctx.beginPath();
    ctx.arc(legendX + 6, legendY + 6, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.fillText(label, legendX + 18, legendY);
    legendY += 18;
  };
  drawLegend('#818cf8', 'You', 5);
  drawLegend('#34d399', 'Real Players', 3);
  drawLegend('#f43f5e', 'Bots', 2.5);

  ctx.restore();
}
