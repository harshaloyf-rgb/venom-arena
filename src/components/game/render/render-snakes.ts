/**
 * Venom Arena — snake body + head + face + hat + label + arrow rendering.
 *
 * Rebuilt with the user's game approach:
 *  - 3D radial gradient per segment (configurable highlight offset/brightness/shadow)
 *  - 7 shape types with per-segment alternation (circle/box/triangle + 4 mixes)
 *  - Face: specular highlight, eyes with smooth pupil tracking, nose, smile
 *  - Direction arrow with smooth lerp (player only)
 *  - Head ground shadow
 *  - Boost glow
 *  - Performance tiers (close/medium/far)
 *  - Kept: skin patterns, opacity layering, chat bubbles, name labels
 */

import type { FrameRenderCtx } from './types';
import type { SkinPattern } from '@/lib/game-config';
import type { SnakeSnapshot } from '@/lib/types';
import { computeVisibleRect, snakeIsVisible } from './render-grid';
import {
  GradientCache,
  drawHat,
  drawSnakeFace,
  drawDirectionArrow,
  hexToRgb,
  lightenHex,
  darkenHex,
  pickSegmentShape,
  shortestAngleDelta,
  make3DGrad,
  type HatType,
  type SnakeShape,
} from './render-snake-visuals';

// ---------------------------------------------------------------------------
// Module-level gradient cache
// ---------------------------------------------------------------------------

const _gradCache = new GradientCache();

// ---------------------------------------------------------------------------
// Performance tier thresholds (world-space pixels from camera to head)
// ---------------------------------------------------------------------------

const CLOSE_DIST = 1200;  // wider than before — show details further
const FAR_DIST = 2500;

// ---------------------------------------------------------------------------
// Per-snake mutable state (arrow lerp, pupil smooth)
// ---------------------------------------------------------------------------

interface SnakeRenderState {
  arrowDist: number;
  pupilX: number;
  pupilY: number;
}

const _snakeState = new Map<string, SnakeRenderState>();

function getSnakeState(id: string): SnakeRenderState {
  let s = _snakeState.get(id);
  if (!s) {
    s = { arrowDist: 0, pupilX: 0, pupilY: 0 };
    _snakeState.set(id, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSegmentColor(
  snake: SnakeSnapshot,
  pattern: SkinPattern | undefined,
  segIndex: number,
  now: number,
  lowQuality: boolean,
): string {
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
    case 'metallic':
    return snake.color;
    case 'glow':
    return snake.color;
    case 'pulse': {
      const pulse = (Math.sin(now * 0.006 + segIndex * 0.25) + 1) / 2;
      return lightenHex(snake.color, Math.round(pulse * 50));
    }
    case 'zebra': {
      const stripe = Math.floor(segIndex / 4) % 2 === 0;
      return stripe ? snake.color : (snake.secondaryColor || snake.color);
    }
    case 'cyber': {
      const cyb = Math.floor(segIndex / 3) % 2 === 0;
      return cyb ? snake.color : darkenHex(snake.color, 60);
    }
    default:
      return snake.color;
  }
}

/** Draws a segment shape at (px, py) in world space. */
function fillSegmentShape(
  ctx: CanvasRenderingContext2D,
  shape: 'circle' | 'box' | 'triangle',
  px: number, py: number, r: number, segAngle?: number,
): void {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(px, py, Math.max(1, r), 0, Math.PI * 2);
      break;
    case 'box': {
      const half = Math.max(1, r * 1.05);
      if (segAngle !== undefined) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(segAngle);
        ctx.rect(-half, -half, half * 2, half * 2);
        ctx.restore();
      } else {
        ctx.rect(px - half, py - half, half * 2, half * 2);
      }
      break;
    }
    case 'triangle': {
      const s = Math.max(1, r * 1.25);
      if (segAngle !== undefined) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(segAngle);
        ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, -s * 0.85); ctx.lineTo(-s * 0.7, s * 0.85);
        ctx.closePath();
        ctx.restore();
      } else {
        ctx.moveTo(px + s, py);
        ctx.lineTo(px - s * 0.7, py - s * 0.85);
        ctx.lineTo(px - s * 0.7, py + s * 0.85);
        ctx.closePath();
      }
      break;
    }
  }
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------

function drawChatBubble(rc: FrameRenderCtx, x: number, y: number, msg: string): void {
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
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - th / 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main snake rendering
// ---------------------------------------------------------------------------

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

  // Performance tier
  const head = pts[0];
  const headDist = Math.hypot(head.x - rc.camX, head.y - rc.camY);
  const isClose = headDist < CLOSE_DIST;
  const isFar = headDist > FAR_DIST;

  // Skin pattern
  const pattern: SkinPattern | undefined = isMe ? rc.playerSkin?.pattern : undefined;

  // Shape
  const snakeShape: SnakeShape = isMe && rc.playerShape ? rc.playerShape : 'circle';

  // Striped
  const isStriped = !pattern && !!snake.secondaryColor;

  // Get mutable render state for this snake
  const state = getSnakeState(snake.id);

  // Downsample stride
  const stride = pts.length > 120 ? 2 : 1;

  ctx.save();
  ctx.globalAlpha = baseAlpha;

  // === BODY SEGMENTS (tail to head so head is on top) ===
  for (let i = pts.length - 1; i >= 1; i -= stride) {
    const p = pts[i];
    if (!isFinite(p.x) || !isFinite(p.y)) continue;
    const margin = bodyR + 10;
    if (p.x < vis.left - margin || p.x > vis.right + margin ||
        p.y < vis.top - margin || p.y > vis.bottom + margin) continue;

    let segColor: string;
    if (isStriped) {
      segColor = Math.floor(i / 4) % 2 === 0
        ? snake.color
        : (snake.secondaryColor ?? snake.color);
    } else {
      segColor = getSegmentColor(snake, pattern, i, now, lowQuality);
    }

    const shape = pickSegmentShape(snakeShape, i);

    // Secondary color outline
    if (snake.secondaryColor && !isFar) {
      ctx.save();
      ctx.globalAlpha = baseAlpha * 0.55;
      ctx.fillStyle = snake.secondaryColor;
      const outlineR = bodyR + 2 / zoom;
      fillSegmentShape(ctx, shape, p.x, p.y, outlineR, snake.angle);
      ctx.restore();
    }

    // Segment fill
    ctx.save();
    ctx.globalAlpha = baseAlpha;

    if (isFar) {
      ctx.fillStyle = segColor;
      fillSegmentShape(ctx, shape, p.x, p.y, bodyR, snake.angle);
    } else if (pattern === 'metallic' && snake.secondaryColor && isMe) {
      const mGrad = getMetallicGradient(rc, bodyR, snake.color, snake.secondaryColor);
      ctx.fillStyle = mGrad;
      fillSegmentShape(ctx, shape, p.x, p.y, bodyR, snake.angle);
    } else if (pattern === 'glow' && !lowQuality && isMe) {
      ctx.shadowColor = snake.color;
      ctx.shadowBlur = bodyR * 0.8;
      ctx.fillStyle = segColor;
      fillSegmentShape(ctx, shape, p.x, p.y, bodyR, snake.angle);
      ctx.shadowBlur = 0;
    } else {
      const grad = _gradCache.get(ctx, p.x, p.y, bodyR, segColor);
      ctx.fillStyle = grad;
      fillSegmentShape(ctx, shape, p.x, p.y, bodyR, snake.angle);
    }
    ctx.restore();
  }

  // === HEAD ===
  if (!isFinite(head.x) || !isFinite(head.y)) { ctx.restore(); return; }

  const headColor = lightenHex(snake.color, 20);

  // Ground shadow (user's approach — drop shadow under head)
  if (!isFar && !lowQuality) {
    ctx.save();
    ctx.globalAlpha = baseAlpha * 0.25;
    ctx.fillStyle = '#000000';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = headR * 0.4;
    ctx.shadowOffsetX = headR * 0.08;
    ctx.shadowOffsetY = headR * 0.12;
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(1, headR * 0.9), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Boost glow
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

  // Head secondary outline
  if (snake.secondaryColor && !isFar) {
    ctx.save();
    ctx.globalAlpha = baseAlpha * 0.55;
    ctx.fillStyle = snake.secondaryColor;
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(1, headR + 2 / zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Head fill with 3D gradient
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
  ctx.restore();

  // === FACE DETAILS ===
  // Player eyes ALWAYS render — they're cheap and essential.
  // Other snakes only render face when close + not low quality.
  const shouldDrawFace = isMe || (!isFar && isClose && !lowQuality);
  if (shouldDrawFace) {
    // Smooth pupil tracking (user's game approach)
    let pupilX = 0;
    let pupilY = 0;

    if (isMe && rc.pointerAngle != null) {
      // Turn direction relative to heading
      const relLook = shortestAngleDelta(snake.angle, rc.pointerAngle);
      const shiftMag = Math.min(1, Math.abs(relLook) / 0.8);
      const pma = bodyR * 0.23;
      const sfX = Math.cos(snake.angle);
      const sfY = Math.sin(snake.angle);
      const slX = -Math.sin(snake.angle);
      const slY = Math.cos(snake.angle);
      const tFwd = Math.cos(relLook) * pma * shiftMag;
      const tLat = Math.sin(relLook) * pma * shiftMag;
      const tpx = sfX * tFwd + slX * tLat;
      const tpy = sfY * tFwd + slY * tLat;
      // Smooth ramp
      const pSpd = pma * 0.18;
      if (state.pupilX < tpx) state.pupilX = Math.min(state.pupilX + pSpd, tpx);
      else state.pupilX = Math.max(state.pupilX - pSpd, tpx);
      if (state.pupilY < tpy) state.pupilY = Math.min(state.pupilY + pSpd, tpy);
      else state.pupilY = Math.max(state.pupilY - pSpd, tpy);
      pupilX = state.pupilX;
      pupilY = state.pupilY;
    }

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

  // === DIRECTION ARROW (player only) ===
  if (isMe && !isFar) {
    const targetAngle = rc.pointerAngle ?? snake.angle;
    drawDirectionArrow(
      ctx,
      head.x, head.y,
      snake.angle,
      targetAngle,
      bodyR,
      snake.isBoosting,
      zoom,
      state,
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
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const labelY = head.y - headR - 6 / zoom;
    if (snake.isBot) {
      ctx.fillStyle = 'rgba(251, 146, 60, 0.75)';
      ctx.fillText(`[BOT] ${snake.name}`, head.x, labelY);
    } else {
      ctx.fillStyle = isMe ? '#22c55e' : 'rgba(226, 232, 240, 0.85)';
      ctx.fillText(snake.name, head.x, labelY);
    }
    if (snake.userTag) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = `${Math.max(8, 9 / zoom)}px monospace`;
      ctx.fillText(snake.userTag, head.x, labelY - 12 / zoom);
    }
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

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Metallic gradient helper
// ---------------------------------------------------------------------------

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
// Snake opacity layering
// ---------------------------------------------------------------------------

const LAYERING_PROXIMITY = 30;

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
      shouldFade = true;
      break;
    }
  }
  drawSnake(rc, snake, shouldFade ? 0.75 : 1);
}
