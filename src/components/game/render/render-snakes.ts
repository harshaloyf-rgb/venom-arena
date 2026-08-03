/**
 * Venom Arena — snake body + head + face + hat + label rendering.
 *
 * Each body segment is drawn as an individual 3D-shaded circle/shape
 * instead of a thick stroked polyline.
 */

import type { FrameRenderCtx } from './types';
import type { SkinPattern } from '@/lib/game-config';
import type { SnakeSnapshot } from '@/lib/types';
import { computeVisibleRect, snakeIsVisible } from './render-grid';
import {
  GradientCache,
  drawHat,
  drawSnakeFace,
  hexToRgb,
  pickSegmentShape,
} from './render-snake-visuals';
import type { HatType, SnakeShape } from './render-snake-visuals';

// ---------------------------------------------------------------------------
// Module-level gradient cache
// ---------------------------------------------------------------------------

const _gradCache = new GradientCache();

// ---------------------------------------------------------------------------
// Performance tier thresholds (world-space pixels from camera to head)
// ---------------------------------------------------------------------------

const CLOSE_DIST = 800;
const FAR_DIST = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the shortest angular delta from `from` to `to` (radians, -PI..PI). */
function shortestAngleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Lighten a hex colour by an amount 0–255. */
function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
}

/** Darken a hex colour by an amount 0–255. */
function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`;
}

/**
 * Returns the colour for a given body segment index based on the skin pattern.
 * Returns `undefined` when the pattern requires special handling (metallic, glow).
 */
function getSegmentColor(
  snake: SnakeSnapshot,
  pattern: SkinPattern | undefined,
  segIndex: number,
  now: number,
  lowQuality: boolean,
): string {
  // No pattern → use base color (caller handles stripe via secondaryColor)
  if (!pattern) return snake.color;

  switch (pattern) {
    case 'rainbow': {
      if (lowQuality) return snake.color;
      const hue = (now * 0.05 + segIndex * 14) % 360;
      return `hsl(${hue}, 90%, 55%)`;
    }
    case 'neon': {
      if (lowQuality) return snake.color;
      const ratio = (Math.sin(now * 0.009 - segIndex * 0.28) + 1) / 2;
      return ratio > 0.5 ? '#06b6d4' : '#a855f7';
    }
    case 'camo': {
      const camoColors = ['#15803d', '#854d0e', '#78350f', '#166534'];
      return camoColors[Math.floor(segIndex / 4) % camoColors.length];
    }
    case 'metallic': {
      // Metallic uses a special gradient — return base color as fallback;
      // the caller uses a separate gradient path for metallic.
      return snake.color;
    }
    case 'glow': {
      // Glow: base colour but the caller adds a glow shadow
      return snake.color;
    }
    case 'pulse': {
      // Pulse: brightness oscillates per segment
      const pulse = (Math.sin(now * 0.006 + segIndex * 0.25) + 1) / 2;
      const bright = Math.round(pulse * 50);
      return lightenHex(snake.color, bright);
    }
    case 'zebra': {
      // Zebra: strict alternating stripes
      const stripe = Math.floor(segIndex / 4) % 2 === 0;
      return stripe ? snake.color : (snake.secondaryColor || snake.color);
    }
    case 'cyber': {
      // Cyber: alternating primary + dark variant
      const cyb = Math.floor(segIndex / 3) % 2 === 0;
      return cyb ? snake.color : darkenHex(snake.color, 60);
    }
    default:
      return snake.color;
  }
}

/**
 * Draws a single segment shape (circle, box, or triangle) at (px, py).
 */
function fillSegmentShape(
  ctx: CanvasRenderingContext2D,
  shape: 'circle' | 'box' | 'triangle',
  px: number,
  py: number,
  r: number,
): void {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(px, py, Math.max(1, r), 0, Math.PI * 2);
      break;
    case 'box': {
      const s = Math.max(1, r * 1.6);
      ctx.rect(px - s / 2, py - s / 2, s, s);
      break;
    }
    case 'triangle': {
      const s = Math.max(1, r * 1.3);
      ctx.moveTo(px, py - s);
      ctx.lineTo(px - s * 0.866, py + s * 0.5);
      ctx.lineTo(px + s * 0.866, py + s * 0.5);
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Chat bubble (preserved as-is)
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
// Snake rendering (segment-based 3D)
// ---------------------------------------------------------------------------

/**
 * Draws a single snake using individual 3D-shaded segments.
 *
 * Performance tiers:
 *   - Close (head within 800px of camera): Full 3D + face + hat
 *   - Medium (800–2000px): 3D segments, no face details
 *   - Far (2000px+): Flat color circles, no 3D gradient
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
  const now = rc.now;

  // Body radius in world units
  const bodyR = Math.max(2, snake.visualRadius ?? snake.size);
  const headR = bodyR * 1.05;

  // Determine performance tier based on head distance to camera
  const head = pts[0];
  const headDist = Math.hypot(head.x - rc.camX, head.y - rc.camY);
  const isClose = headDist < CLOSE_DIST;
  const isFar = headDist > FAR_DIST;

  // Skin pattern (only for the player's own snake)
  const pattern: SkinPattern | undefined = isMe ? rc.playerSkin?.pattern : undefined;

  // Player shape (for custom body shapes)
  const snakeShape: SnakeShape = isMe && rc.playerShape ? rc.playerShape : 'circle';

  // Striped mode: if the snake has a secondaryColor but NO skin pattern,
  // alternate between primary and secondary every 4 segments
  const isStriped = !pattern && !!snake.secondaryColor;

  // Downsample stride for very long snakes (skip points for perf)
  const stride = pts.length > 120 ? 2 : 1;

  ctx.save();
  ctx.globalAlpha = baseAlpha;

  // === BODY SEGMENTS (draw from tail to head so head is on top) ===
  for (let i = pts.length - 1; i >= 1; i -= stride) {
    const p = pts[i];
    if (!isFinite(p.x) || !isFinite(p.y)) continue;

    // Per-segment culling
    const margin = bodyR + 10;
    if (p.x < vis.left - margin || p.x > vis.right + margin ||
        p.y < vis.top - margin || p.y > vis.bottom + margin) continue;

    // Determine segment colour
    let segColor: string;
    if (isStriped) {
      segColor = Math.floor(i / 4) % 2 === 0
        ? snake.color
        : (snake.secondaryColor ?? snake.color);
    } else {
      segColor = getSegmentColor(snake, pattern, i, now, lowQuality);
    }

    // Determine segment shape
    const shape = pickSegmentShape(snakeShape, i);

    // --- Secondary color outline (draw slightly larger first) ---
    if (snake.secondaryColor && !isFar) {
      ctx.save();
      ctx.globalAlpha = baseAlpha * 0.55;
      ctx.fillStyle = snake.secondaryColor;
      const outlineR = bodyR + 2 / zoom;
      fillSegmentShape(ctx, shape, p.x, p.y, outlineR);
      ctx.restore();
    }

    // --- Segment fill ---
    ctx.save();
    ctx.globalAlpha = baseAlpha;

    if (isFar) {
      // Far tier: flat color, no gradient
      ctx.fillStyle = segColor;
      fillSegmentShape(ctx, shape, p.x, p.y, bodyR);
    } else if (pattern === 'metallic' && snake.secondaryColor && isMe) {
      // Metallic pattern: use the metallic gradient cache
      const mGrad = getMetallicGradient(rc, bodyR, snake.color, snake.secondaryColor);
      ctx.fillStyle = mGrad;
      fillSegmentShape(ctx, shape, p.x, p.y, bodyR);
    } else if (pattern === 'glow' && !lowQuality && isMe) {
      // Glow pattern: 3D fill + outer glow shadow
      ctx.shadowColor = snake.color;
      ctx.shadowBlur = bodyR * 0.8;
      ctx.fillStyle = segColor;
      fillSegmentShape(ctx, shape, p.x, p.y, bodyR);
      ctx.shadowBlur = 0;
    } else {
      // Standard 3D gradient fill
      const grad = _gradCache.get(ctx, p.x, p.y, bodyR, segColor);
      ctx.fillStyle = grad;
      fillSegmentShape(ctx, shape, p.x, p.y, bodyR);
    }

    ctx.restore();
  }

  // === HEAD ===
  if (!isFinite(head.x) || !isFinite(head.y)) {
    ctx.restore();
    return;
  }

  // Head colour (slightly lighter than body)
  const headColor = lightenHex(snake.color, 20);

  // Ground shadow
  if (!isFar && !lowQuality) {
    ctx.save();
    ctx.globalAlpha = baseAlpha * 0.25;
    ctx.fillStyle = '#000000';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = headR * 0.4;
    ctx.shadowOffsetY = headR * 0.15;
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(1, headR * 0.9), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Boost glow (semi-transparent color circle when boosting)
  if (snake.isBoosting && !lowQuality) {
    ctx.save();
    ctx.globalAlpha = baseAlpha * 0.3;
    ctx.fillStyle = snake.color;
    ctx.shadowColor = snake.color;
    ctx.shadowBlur = headR * 1.2;
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(1, headR * 1.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Head secondary color outline
  if (snake.secondaryColor && !isFar) {
    ctx.save();
    ctx.globalAlpha = baseAlpha * 0.55;
    ctx.fillStyle = snake.secondaryColor;
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(1, headR + 2 / zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Head fill
  ctx.save();
  ctx.globalAlpha = baseAlpha;
  if (isMe && !lowQuality) {
    ctx.shadowColor = snake.color;
    ctx.shadowBlur = 14;
  }

  if (isFar) {
    ctx.fillStyle = headColor;
  } else {
    const hGrad = _gradCache.get(ctx, head.x, head.y, headR, headColor);
    ctx.fillStyle = hGrad;
  }

  ctx.beginPath();
  ctx.arc(head.x, head.y, Math.max(1, headR), 0, Math.PI * 2);
  ctx.fill();

  if (isMe && !lowQuality) ctx.shadowBlur = 0;

  // Specular highlight on head
  if (!isFar && !lowQuality) {
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(
      head.x - headR * 0.15,
      head.y - headR * 0.30,
      Math.max(0.5, headR * 0.14),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // head fill

  // === FACE DETAILS (player + close snakes only) ===
  if (!isFar && (isClose || isMe) && !lowQuality) {
    // Pupil tracking
    let pupilX = 0;
    let pupilY = 0;

    if (isMe && rc.pointerAngle != null) {
      // Player: pupils track the mouse/pointer direction
      const delta = shortestAngleDelta(snake.angle, rc.pointerAngle);
      const trackDist = bodyR * 0.18;
      pupilX = Math.cos(snake.angle + delta) * trackDist;
      pupilY = Math.sin(snake.angle + delta) * trackDist;
    }
    // For bots: pupils look forward (pupilX/pupilY = 0,0)

    drawSnakeFace(
      ctx,
      head.x, head.y,
      snake.angle,
      bodyR, headR,
      snake.isBoosting,
      pupilX, pupilY,
      isMe,
    );
  }

  // === HAT (player only, if equipped) ===
  if (isMe && rc.playerHat && rc.playerHat !== 'none' && !isFar) {
    drawHat(ctx, head.x, head.y, snake.angle, headR, rc.playerHat, baseAlpha);
  }

  // === SPAWN PROTECTION RING ===
  if (snake.spawnProtected) {
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(1, headR + 4 / zoom), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // === NAME LABEL ===
  if (snake.name) {
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    ctx.font = `${Math.max(10, 12 / zoom)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelY = head.y - headR - 6 / zoom;

    if (snake.isBot) {
      ctx.fillStyle = 'rgba(251, 146, 60, 0.75)';
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

    // Country flag emoji above the name
    if (snake.country) {
      ctx.font = `${Math.max(10, 12 / zoom)}px sans-serif`;
      ctx.fillText(snake.country, head.x, labelY - 12 / zoom - (snake.userTag ? 12 / zoom : 0));
    }

    ctx.restore();
  }

  // === CHAT BUBBLE ===
  if (snake.chatMessage) {
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    drawChatBubble(rc, head.x, head.y - headR - 24 / zoom, snake.chatMessage);
    ctx.restore();
  }

  ctx.restore(); // outer globalAlpha save
}

// ---------------------------------------------------------------------------
// Metallic gradient helper (used only by drawSnake for metallic pattern)
// ---------------------------------------------------------------------------

/**
 * Cache a metallic radial gradient. Bucketed by 2-pixel radius.
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
