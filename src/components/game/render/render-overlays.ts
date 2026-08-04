// ============================================================================
// Venom Arena — Overlay Renderers
// Kill feed, emote bubbles, name labels, and particle system.
// ============================================================================

import type {
  KillFeedEntry,
  Particle,
  CameraState,
  SnakeState,
  EmoteType,
} from '@/lib/snake/types';
import { EMOTE_DISPLAY } from '@/lib/snake/types';
import { worldToScreen } from './camera';

// ── Kill Feed ───────────────────────────────────────────────────────────

/**
 * Render kill feed in the top-right area.
 * Shows last 8 entries, fading out after 5 seconds.
 */
export function renderKillFeed(
  ctx: CanvasRenderingContext2D,
  entries: KillFeedEntry[],
  time: number,
): void {
  const FADE_DURATION = 5; // seconds before fully faded
  const MAX_ENTRIES = 8;

  // Filter and sort: only recent entries, newest first
  const visible = entries
    .filter(e => time - e.timestamp < FADE_DURATION)
    .slice(-MAX_ENTRIES)
    .reverse(); // newest at bottom

  if (visible.length === 0) return;

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  const fontSize = 13;
  ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;

  const x = ctx.canvas.width - 14;
  let y = 52;
  const lineH = fontSize + 5;

  for (const entry of visible) {
    const age = time - entry.timestamp;
    const alpha = Math.max(0, 1 - age / FADE_DURATION);

    ctx.globalAlpha = alpha * 0.85;

    // Background pill
    const killerText = entry.killerName
      ? `${entry.killerName}${entry.killerIsBot ? ' 🤖' : ''}`
      : '💀 Wall';
    const causeIcon = entry.cause === 'head_on' ? '⚡' : entry.cause === 'boundary' ? '🔴' : '💀';
    const victimText = `${entry.victimName}${entry.victimIsBot ? ' 🤖' : ''}`;
    const fullText = `${killerText} ${causeIcon} ${victimText}`;

    const metrics = ctx.measureText(fullText);
    const pw = metrics.width + 16;
    const ph = lineH + 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    roundRect(ctx, x - pw, y - 2, pw, ph, 4);
    ctx.fill();

    // Full kill feed line
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText(fullText, x - 8, y);

    y += lineH;
  }

  ctx.restore();
}

// ── Emote Bubble ────────────────────────────────────────────────────────

/**
 * Render an emote bubble above a snake's head.
 * Shows for ~4 seconds (controlled by emoteFramesLeft at 30fps = 120 frames).
 */
export function renderEmoteBubble(
  ctx: CanvasRenderingContext2D,
  snake: SnakeState,
  time: number,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): void {
  if (!snake.activeEmote || snake.emoteFramesLeft <= 0) return;

  const screen = worldToScreen(snake.head.x, snake.head.y, camera, canvasW, canvasH);

  // Skip if off screen
  if (screen.x < -50 || screen.x > canvasW + 50 || screen.y < -50 || screen.y > canvasH + 50) {
    return;
  }

  const emote = EMOTE_DISPLAY[snake.activeEmote as EmoteType];
  if (!emote) return;

  // Fade in/out based on remaining frames
  const maxFrames = 120;
 const fadeAlpha = snake.emoteFramesLeft > maxFrames - 15
    ? (maxFrames - snake.emoteFramesLeft) / 15
    : snake.emoteFramesLeft < 30
      ? snake.emoteFramesLeft / 30
      : 1;

  const bubbleY = screen.y - 40;
  const bubbleW = 44;
  const bubbleH = 32;

  ctx.save();
  ctx.globalAlpha = fadeAlpha * 0.9;

  // Bubble background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  roundRect(ctx, screen.x - bubbleW / 2, bubbleY - bubbleH / 2, bubbleW, bubbleH, 8);
  ctx.fill();

  // Bubble border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, screen.x - bubbleW / 2, bubbleY - bubbleH / 2, bubbleW, bubbleH, 8);
  ctx.stroke();

  // Emote icon
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(emote.icon, screen.x, bubbleY);

  ctx.restore();
}

// ── Name Label ──────────────────────────────────────────────────────────

/**
 * Render name + tag above a snake's head.
 */
export function renderNameLabel(
  ctx: CanvasRenderingContext2D,
  snake: SnakeState,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): void {
  const screen = worldToScreen(snake.head.x, snake.head.y, camera, canvasW, canvasH);

  // Skip if off screen
  if (screen.x < -100 || screen.x > canvasW + 100 || screen.y < -80 || screen.y > canvasH + 50) {
    return;
  }

  const name = snake.identity.name;
  const tag = snake.identity.tag;
  const labelY = screen.y - 28;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // Name text
  ctx.font = "bold 12px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = snake.identity.isPlayer ? '#00FF88' : '#FFFFFF';
  ctx.globalAlpha = 0.9;

  const fullLabel = tag ? `${name} [${tag}]` : name;
  ctx.fillText(fullLabel, screen.x, labelY);

  // Kills badge (if any kills)
  if (snake.kills > 0) {
    const killsText = `☠ ${snake.kills}`;
    const killsX = screen.x + ctx.measureText(fullLabel).width / 2 + 8;
    ctx.font = "bold 10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = '#FF6B6B';
    ctx.fillText(killsText, killsX, labelY);
  }

  ctx.restore();
}

// ── Particle System ─────────────────────────────────────────────────────

/**
 * Add a burst of particles at a position.
 */
export function addParticle(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number = 3,
  size: number = 3,
  life: number = 30,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const vel = speed * (0.5 + Math.random() * 0.5);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * vel,
      vy: Math.sin(angle) * vel,
      life,
      maxLife: life,
      color,
      size,
    });
  }
}

/**
 * Update all particles (move, decay, remove dead).
 */
export function updateParticles(particles: Particle[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life--;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

/**
 * Render all particles.
 */
export function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): void {
 ctx.save();

  for (const p of particles) {
    const screen = worldToScreen(p.x, p.y, camera, canvasW, canvasH);
    const alpha = p.life / p.maxLife;
    const screenSize = Math.max(0.5, p.size * camera.zoom * alpha);

    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 4;

    ctx.beginPath();
    ctx.arc(screen.x, screen.y, screenSize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ── Helper: Rounded Rectangle ────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
