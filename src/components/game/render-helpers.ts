/**
 * Venom Arena — canvas render helpers (pure functions, no React).
 *
 * BUILD-10 changes (game-canvas fix):
 *  - `extractZoneRadius` removed from `FrameRenderCtx` and `MinimapArgs`.
 *    Extraction is button-based (hold to extract anywhere).
 *  - `drawGrid` now renders the BREATHING circular arena boundary
 *    (`#f43f5e`, lineWidth 10, shadowBlur 16) instead of a rectangular grid +
 *    inner extract-zone circle. The arena radius breathes ±40 over a 10 s
 *    cycle (matches `MAP_BASE_RADIUS` / `MAP_BREATH_AMPLITUDE` /
 *    `MAP_BREATH_CYCLE_MS` from game-config). Background is `#020617` clipped
 *    to the arena circle. A subtle grid (`#1e293b`, gridSize 60) is drawn
 *    inside the circle.
 *  - `drawFood`: regular food = filled circle in its color; star chip =
 *    5-pointed GOLD star with `shadowColor #eab308`, `shadowBlur 6`.
 *  - `drawMinimap`: extract-zone circle removed; arena boundary drawn as a
 *    dashed rose circle. Player dot = indigo, bots = rose, other real
 *    players = emerald (matches AUDIT-A radar visual language).
 *  - All skin-pattern rendering (rainbow / neon / metallic / camo) preserved.
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
  // Cheap check: head + tail. If both off-screen on the SAME side we still
  // need to scan all points (snake might span the screen). For most cases
  // the head check suffices.
  if (pts.length === 0) return false;
  if (rectContainsPoint(rect, pts[0].x, pts[0].y)) return true;
  const last = pts[pts.length - 1];
  if (rectContainsPoint(rect, last.x, last.y)) return true;
  // Fallback: walk the downsampled polyline.
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
  // Gradient is built in device pixels — we always rebuild on resize because
  // the cache Map is reset by the resize handler.
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
// Grid + world bounds
// ---------------------------------------------------------------------------

/**
 * Draws the breathing circular arena: background fill (deep slate `#020617`)
 * clipped to the circle, a subtle grid (`#1e293b`, gridSize 60) inside the
 * circle, and the neon-rose boundary (`#f43f5e`, lineWidth 10, shadowBlur 16).
 */
export function drawGrid(rc: FrameRenderCtx): void {
  const { ctx, worldSize, camX, camY, zoom, w, h } = rc;
  const cx = worldSize / 2;
  const cy = worldSize / 2;
  const radius = getArenaRadius(rc.now);

  // --- Background fill (entire arena disc) ---
  ctx.save();
  // Clip to arena circle so nothing draws outside.
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#020617'; // Deep Slate (AUDIT-A line 2572)
  ctx.fill();
  ctx.clip();

  // --- Grid lines (subtle slate-800, gridSize 60) ---
  const grid = 60; // AUDIT-A line 2578
  const vis = computeVisibleRect(rc);
  const startX = Math.max(0, Math.floor(vis.left / grid) * grid);
  const endX = Math.min(worldSize, Math.ceil(vis.right / grid) * grid);
  const startY = Math.max(0, Math.floor(vis.top / grid) * grid);
  const endY = Math.min(worldSize, Math.ceil(vis.bottom / grid) * grid);

  ctx.strokeStyle = '#1e293b'; // AUDIT-A line 2576
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
  // AUDIT-A lines 2595-2603: strokeStyle #f43f5e, lineWidth 10, shadowBlur 16.
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

  // Silence unused-param lint for camX/camY/w/h (they are part of the public
  // type even if grid math doesn't need them directly).
  void camX;
  void camY;
  void w;
  void h;
}

// ---------------------------------------------------------------------------
// Food
// ---------------------------------------------------------------------------

/**
 * Draws all food in two passes:
 *  1. Regular food — batched by color into a single Path2D + fill per color
 *     (filled circle in its own color).
 *  2. Star chips — drawn individually as 5-pointed gold stars with a soft
 *     `shadowColor #eab308`, `shadowBlur 6` glow.
 */
export function drawFood(rc: FrameRenderCtx, foods: FoodSnapshot[]): void {
  const { ctx } = rc;
  const vis = computeVisibleRect(rc);

  // --- Regular food: batched by color ---
  // Group foods into a per-color Path2D. The browser keeps one path open
  // per color, then we issue a single fill() per color. This turns 800
  // individual fills into ~6 fills (one per palette color).
  const pathsByColor = new Map<string, Path2D>();
  const starChips: FoodSnapshot[] = [];

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (
      f.x < vis.left ||
      f.x > vis.right ||
      f.y < vis.top ||
      f.y > vis.bottom
    ) {
      continue; // culled
    }
    if (f.isStarChip) {
      starChips.push(f);
      continue;
    }
    let p = pathsByColor.get(f.color);
    if (!p) {
      p = new Path2D();
      pathsByColor.set(f.color, p);
    }
    p.moveTo(f.x + f.size, f.y);
    p.arc(f.x, f.y, f.size, 0, Math.PI * 2);
  }

  for (const [color, path] of pathsByColor) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }

  // --- Star chips: 5-pointed gold star with shadowBlur 6 ---
  if (starChips.length === 0) return;
  ctx.save();
  for (let i = 0; i < starChips.length; i++) {
    const f = starChips[i];
    const outer = Math.max(2, f.size + 1);
    const inner = Math.max(1, f.size / 2);
    drawStar(ctx, f.x, f.y, 5, outer, inner, f.color || '#fbbf24', rc.lowQuality);
  }
  ctx.restore();
}

/** Draws a 5-pointed star centered at (x,y) with `outer` outer radius and `inner` inner radius. */
function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  points: number,
  outer: number,
  inner: number,
  color: string,
  lowQuality: boolean,
): void {
  ctx.save();
  if (!lowQuality) {
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 6;
  }
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (!lowQuality) ctx.shadowBlur = 0;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Snakes
// ---------------------------------------------------------------------------

/**
 * Draws a single snake. The body is rendered as ONE thick stroked polyline
 * (with an outline underlay) — not N individual circles — which eliminates
 * per-segment gradient, per-segment shadowBlur, per-segment save/restore,
 * and per-frame object allocation.
 *
 * The head is drawn separately with eyes and (for the player's own snake,
 * high-quality only) a glow halo.
 *
 * Player skin patterns (rainbow / neon / metallic / camo) are applied when
 * `rc.playerSkin.pattern` is set and the snake is the local player.
 */
export function drawSnake(rc: FrameRenderCtx, snake: SnakeSnapshot): void {
  const pts = snake.points;
  if (!pts || pts.length === 0) return; // C13 guard

  const vis = computeVisibleRect(rc);
  if (!snakeIsVisible(pts, vis)) return; // P16 cull

  const { ctx, zoom, lowQuality } = rc;
  const isMe = snake.id === rc.myId;

  // Downsample long snakes (defensive — server already caps at ~120).
  const stride = pts.length > 60 ? 2 : 1;

  // Body width in world units. `size` is the radius; visual width = 2*size.
  const radius = Math.max(2, snake.size);
  const width = radius * 2;

  // --- Outline (underlay) ---
  if (snake.secondaryColor) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width + 4 / zoom;
    ctx.strokeStyle = snake.secondaryColor;
    ctx.globalAlpha = 0.55;
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
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;

  const pattern = isMe ? rc.playerSkin?.pattern : undefined;
  if (pattern === 'metallic' && snake.secondaryColor) {
    // Use cached gradient — keyed by size bucket so we don't re-build per
    // snake. Stroking still happens per-snake (correct transform).
    const g = getMetallicGradient(rc, radius, snake.color, snake.secondaryColor);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = stride; i < pts.length; i += stride) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  } else if (pattern === 'rainbow' && !lowQuality) {
    // Rainbow: stroke in hue-cycling chunks. Cheap — only a handful of
    // stroke() calls per snake.
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
    // Neon: alternate cyan / purple along the body (AUDIT-A line 2762-2765).
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
    // Camo: alternating earth-tone segments (AUDIT-A line 2768-2770).
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
    // Default: solid snake.color (alternating 2-color handled by outline).
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
  // Player-only glow halo, high-quality only (FIXES P1).
  if (isMe && !lowQuality) {
    ctx.shadowColor = snake.color;
    ctx.shadowBlur = 14;
  }
  ctx.beginPath();
  ctx.arc(head.x, head.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = snake.color;
  ctx.fill();
  if (isMe && !lowQuality) ctx.shadowBlur = 0;

  // Eyes — direction-based positioning.
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

  // Spawn-protection ring.
  if (snake.spawnProtected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(head.x, head.y, radius + 4 / zoom, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Extraction ring.
  if (snake.isExtracting) {
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.95)';
    ctx.lineWidth = 3 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.arc(head.x, head.y, radius + 8 / zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // RESET — fixes R11
  }
  ctx.restore();

  // --- Name label ---
  if (snake.name) {
    ctx.save();
    ctx.font = `${Math.max(10, 12 / zoom)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelY = head.y - radius - 6 / zoom;
    ctx.fillStyle = isMe ? '#22c55e' : 'rgba(226, 232, 240, 0.85)';
    ctx.fillText(snake.name, head.x, labelY);
    if (snake.userTag) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = `${Math.max(8, 9 / zoom)}px monospace`;
      ctx.fillText(snake.userTag, head.x, labelY - 12 / zoom);
    }
    ctx.restore();
  }

  // --- Chat bubble ---
  if (snake.chatMessage) {
    drawChatBubble(rc, head.x, head.y - radius - 24 / zoom, snake.chatMessage);
  }
}

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
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)'; // indigo (AUDIT-A line 3072)
  ctx.lineWidth = 1.5 / zoom;
  // Rounded rect (manual since older canvas may not have roundRect).
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
   * outside this range are NOT rendered on the small corner minimap
   * (BUILD-13: small minimap = "nearby snakes within ~1800px"). Defaults
   * to WORLD_SIZE/2 (legacy full-radar behaviour) when omitted.
   */
  range?: number;
}

/**
 * Draws the circular radar minimap. Player is rendered as an indigo dot at
 * the centre (the radar is centered on the player's head). The arena
 * boundary is a dashed rose circle. Bots render as rose dots, other real
 * players as emerald dots — matches AUDIT-A radar visual language.
 *
 * BUILD-13: `range` controls how far the radar sees. The small corner
 * minimap passes ~1800 so only nearby snakes are shown; the full-map
 * overlay passes WORLD_SIZE/2 (or simply uses drawFullMap).
 */
export function drawMinimap(args: MinimapArgs): void {
  const { ctx, x, y, size, worldSize, arenaRadius, snakes, myId } = args;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  // Radar range — default to WORLD_SIZE/2 (legacy). Small corner minimap
  // passes 1800 to show only nearby snakes (BUILD-13 spec).
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

  // Concentric rings (AUDIT-A lines 3520-3522).
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
  // World center relative to player's radar position.
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
    if (dist > r) continue; // off-radar
    const mx = cx + dx;
    const my = cy + dy;
    ctx.beginPath();
    if (s.id === myId) {
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#818cf8'; // indigo-400 (AUDIT-A line 3525)
    } else if (s.isBot) {
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e'; // rose-500 (AUDIT-A line 3577)
    } else {
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399'; // emerald-400 (AUDIT-A line 3577)
    }
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Full Map overlay (BUILD-13) — drawn in screen-space, no camera transform.
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
  // --- Background fill (dim slate) ---
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.94)'; // deep slate, near-opaque
  ctx.fillRect(0, 0, w, h);

  // --- Layout: arena centred on screen ---
  const cx = w / 2;
  const cy = h / 2;
  // Fit the arena diameter (2 * arenaRadius) plus a small margin into the
  // smaller of width / height. Margin = 80px so labels fit.
  const margin = 80;
  const fitDim = Math.min(w, h) - margin * 2;
  const arenaDiameter = arenaRadius * 2;
  const scale = fitDim / arenaDiameter;
  const screenR = arenaRadius * scale;

  // World-center → screen mapping. World center = (worldSize/2, worldSize/2).
  // All snake positions are in world coords; subtract world center, scale,
  // then add screen center.
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
      // Player: bigger indigo dot + pulsing ring.
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
      ctx.fillStyle = '#f43f5e'; // rose
      ctx.fill();
    } else {
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399'; // emerald — other humans
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
