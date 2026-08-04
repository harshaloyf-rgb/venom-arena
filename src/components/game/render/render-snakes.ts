/**
 * Venom Arena — snake body + head + eyes + label rendering.
 */

import type { FrameRenderCtx } from './types';
import type { SnakeSnapshot } from '@/lib/types';
import { computeVisibleRect, rectContainsPoint, snakeIsVisible } from './render-grid';

// ---------------------------------------------------------------------------
// Metallic gradient helper (used only by drawSnake)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Snake rendering
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
