// ============================================================================
// Venom Arena — In-Game HUD Renderer
// Full HUD: stats, FPS/ping, emote buttons, boost/extract/exit, extraction bar.
// ============================================================================

import type { HUDState, EmoteType } from '@/lib/snake/types';
import { EMOTE_DISPLAY } from '@/lib/snake/types';
import type { ArenaLeader } from './types';

// ── Main HUD Entry Point ─────────────────────────────────────────────────

/**
 * Render all HUD elements on the canvas.
 */
export function renderHUD(
  ctx: CanvasRenderingContext2D,
  hud: HUDState,
  canvasW: number,
  canvasH: number,
  leaders: ArenaLeader[] = [],
): void {
  ctx.save();

  renderStatsPanel(ctx, hud, canvasW, canvasH);
  renderPerfPanel(ctx, hud, canvasW, canvasH);
  renderExtractionBar(ctx, hud, canvasW, canvasH);
  renderEmoteButtons(ctx, canvasW, canvasH);
  renderActionButtons(ctx, canvasW, canvasH);
  if (leaders.length > 0) {
    renderLeaderboard(ctx, leaders, canvasW, canvasH);
  }

  ctx.restore();
}

// ── Top-Left: Stats Panel ─────────────────────────────────────────────────

function renderStatsPanel(
  ctx: CanvasRenderingContext2D,
  hud: HUDState,
  canvasW: number,
  _canvasH: number,
): void {
  const x = 14;
  let y = 14;
  const lineHeight = 20;
  const smallFont = 12;
  const labelFont = 11;

  // Background panel
  const panelW = 155;
  const panelH = 110;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  roundRect(ctx, x - 6, y - 6, panelW, panelH, 8);
  ctx.fill();

  // Carried Chips (emerald)
  ctx.font = `${labelFont}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Carried Chips', x, y);
  ctx.font = `bold ${smallFont + 2}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#2ECC71';
  ctx.fillText(String(hud.carriedChips), x + 90, y);
  y += lineHeight;

  // Stars Earned (amber)
  ctx.font = `${labelFont}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Stars Earned', x, y);
  ctx.font = `bold ${smallFont + 2}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#F59E0B';
  ctx.fillText(String(hud.starsEarned), x + 90, y);
  y += lineHeight;

  // Score (amber)
  ctx.font = `${labelFont}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Score', x, y);
  ctx.font = `bold ${smallFont + 2}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#F59E0B';
  ctx.fillText(String(hud.score), x + 90, y);
  y += lineHeight;

  // Kills (red)
  ctx.font = `${labelFont}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Kills', x, y);
  ctx.font = `bold ${smallFont + 2}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#EF4444';
  ctx.fillText(String(hud.kills), x + 90, y);
  y += lineHeight;

  // Rank (white)
  ctx.font = `${labelFont}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Rank', x, y);
  ctx.font = `bold ${smallFont + 2}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`#${hud.rank}`, x + 90, y);
}

// ── Top-Right: FPS/Ping + Commission + Leaders ───────────────────────────

function renderPerfPanel(
  ctx: CanvasRenderingContext2D,
  hud: HUDState,
  canvasW: number,
  _canvasH: number,
): void {
  const right = canvasW - 14;
  let y = 14;
  const lineHeight = 18;

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  // FPS (color coded)
  const fpsColor = hud.fps >= 50 ? '#2ECC71' : hud.fps >= 30 ? '#F59E0B' : '#EF4444';
  ctx.font = `bold 12px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = fpsColor;
  ctx.fillText(`${Math.round(hud.fps)} FPS`, right, y);
  y += lineHeight;

  // Ping (color coded)
  const pingColor = hud.ping < 80 ? '#2ECC71' : hud.ping < 200 ? '#F59E0B' : '#EF4444';
  ctx.fillStyle = pingColor;
  ctx.fillText(`${Math.round(hud.ping)}ms`, right, y);
  y += lineHeight;

  // Commission
  if (hud.commissionRate > 0) {
    ctx.font = `11px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`Fee: ${(hud.commissionRate * 100).toFixed(0)}%`, right, y);
    y += lineHeight;
  }
}

// ── Top-Right Below: Arena Leaderboard (mini) ────────────────────────────

function renderLeaderboard(
  ctx: CanvasRenderingContext2D,
  leaders: ArenaLeader[],
  canvasW: number,
  _canvasH: number,
): void {
  const maxShow = 5;
  const showing = leaders.slice(0, maxShow);
  if (showing.length === 0) return;

  const right = canvasW - 14;
  const panelW = 150;
  const panelH = showing.length * 18 + 12;
  let y = 80;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, right - panelW, y - 6, panelW, panelH, 6);
  ctx.fill();

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = `11px 'Segoe UI', system-ui, sans-serif`;

  for (let i = 0; i < showing.length; i++) {
 const leader = showing[i];
    ctx.fillStyle = leader.isPlayer ? '#00FF88' : 'rgba(255,255,255,0.7)';
    ctx.fillText(
      `${i + 1}. ${leader.name} — ${leader.score}`,
      right - 6,
      y + i * 18,
    );
  }
}

// ── Top-Center: Extraction Progress Bar ──────────────────────────────────

function renderExtractionBar(
  ctx: CanvasRenderingContext2D,
  hud: HUDState,
  canvasW: number,
  _canvasH: number,
): void {
  // Only show if there's carried chips (extraction possible)
  if (hud.carriedChips <= 0) return;

  const barW = 200;
  const barH = 10;
  const x = (canvasW - barW) / 2;
  const y = 12;

  ctx.save();

  // Background track
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  roundRect(ctx, x, y, barW, barH, 5);
  ctx.fill();

  // Progress fill (amber gradient)
  const fillW = barW * 0.0; // extraction progress is handled by the game state, placeholder
  if (fillW > 0) {
    const grad = ctx.createLinearGradient(x, y, x + fillW, y);
    grad.addColorStop(0, '#F59E0B');
    grad.addColorStop(1, '#FBBF24');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, fillW, barH, 5);
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, barW, barH, 5);
  ctx.stroke();

  // Label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `bold 10px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('EXTRACTION', canvasW / 2, y + barH + 3);

  ctx.restore();
}

// ── Bottom-Left: 5 Quick Chat Emote Buttons ──────────────────────────────

function renderEmoteButtons(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
): void {
  const emotes: EmoteType[] = ['gg', 'target', 'flee', 'ripped', 'extracting'];
  const btnW = 52;
  const btnH = 36;
  const gap = 6;
  const startX = 14;
  const startY = canvasH - 14 - btnH;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < emotes.length; i++) {
    const emote = EMOTE_DISPLAY[emotes[i]];
    const bx = startX + i * (btnW + gap);
    const by = startY;

    // Button background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    roundRect(ctx, bx, by, btnW, btnH, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, btnW, btnH, 6);
    ctx.stroke();

    // Icon
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(emote.icon, bx + btnW / 2, by + btnH / 2 - 1);

    // Key hint
    ctx.font = `8px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(String(i + 1), bx + btnW / 2, by + btnH - 6);
  }

  ctx.restore();
}

// ── Bottom-Right: BOOST, EXTRACT, EXIT ───────────────────────────────────

function renderActionButtons(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
): void {
  const padding = 14;
  const btnW = 64;
  const btnH = 34;
  const gap = 8;
  const startX = canvasW - padding - btnW;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // EXIT button (bottom-most, red pill)
  const exitY = canvasH - padding - btnH;
  ctx.fillStyle = 'rgba(220, 38, 38, 0.65)';
  roundRect(ctx, startX, exitY, btnW, btnH, 8);
  ctx.fill();
  ctx.font = `bold 11px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('EXIT', startX + btnW / 2, exitY + btnH / 2);

  // EXTRACT button (above exit, amber pill)
  const extractY = exitY - btnH - gap;
  ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
  roundRect(ctx, startX, extractY, btnW, btnH, 8);
  ctx.fill();
  ctx.font = `bold 10px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('EXTRACT', startX + btnW / 2, extractY + btnH / 2);

  // BOOST button (above extract, green pill)
  const boostY = extractY - btnH - gap;
  ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
  roundRect(ctx, startX, boostY, btnW, btnH, 8);
  ctx.fill();
  ctx.font = `bold 11px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('BOOST', startX + btnW / 2, boostY + btnH / 2);

  ctx.restore();
}

// ── Helper: Rounded Rectangle Path ────────────────────────────────────────

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
