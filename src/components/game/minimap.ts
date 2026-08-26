// ============================================================================
// Minimap Renderer — draws a circular minimap overlay on the game canvas.
// Shows: arena boundary, all snakes, player (highlighted + direction), danger.
// ============================================================================

import type { GameState, Snake, Viewport, Camera } from '@/lib/snake';

// ─── Config ───────────────────────────────────────────────────────────────────

const MINIMAP_SIZE = 160;          // px diameter
const MINIMAP_PADDING = 16;        // px from screen edge
const BG_ALPHA = 0.55;
const GRID_DIVISIONS = 8;          // grid lines across the map
const DANGER_RANGE_SQ = 2000 * 2000; // snakes bigger than player within this range

// ─── Pre-allocated arrays (avoid GC per frame) ────────────────────────────────

const _snakeBuf: { x: number; y: number; color: string; r: number; isPlayer: boolean; isDanger: boolean; angle: number }[] = [];

// ─── Public API ───────────────────────────────────────────────────────────────

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  screenW: number,
  screenH: number,
): void {
  const player = state.player;
  const ac = state.arenaConfig;
  const mapRadius = ac.mapHalf;

  // ── Position: bottom-right ──
  const cx = screenW - MINIMAP_PADDING - MINIMAP_SIZE / 2;
  const cy = screenH - MINIMAP_PADDING - MINIMAP_SIZE / 2;
  const r = MINIMAP_SIZE / 2;
  const scale = r / mapRadius; // map units → minimap px

  ctx.save();

  // ── Clip to circle ──
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // ── Background ──
  ctx.fillStyle = `rgba(0, 0, 0, ${BG_ALPHA})`;
  ctx.fillRect(cx - r, cy - r, MINIMAP_SIZE, MINIMAP_SIZE);

  // ── Grid lines ──
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 0.5;
  const gridStep = (mapRadius * 2) / GRID_DIVISIONS;
  for (let i = 1; i < GRID_DIVISIONS; i++) {
    const offset = -mapRadius + i * gridStep;
    // Vertical
    const vx = cx + offset * scale;
    ctx.beginPath();
    ctx.moveTo(vx, cy - r);
    ctx.lineTo(vx, cy + r);
    ctx.stroke();
    // Horizontal
    const hy = cy + offset * scale;
    ctx.beginPath();
    ctx.moveTo(cx - r, hy);
    ctx.lineTo(cx + r, hy);
    ctx.stroke();
  }

  // ── Arena boundary circle ──
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // ── Collect snake positions ──
  const playerScore = player?.alive ? player.score : -1;
  const playerX = player?.path.headX ?? 0;
  const playerY = player?.path.headY ?? 0;

  let bufIdx = 0;
  for (const [, s] of state.snakes) {
    if (!s.alive) continue;
    const dx = s.path.headX - playerX;
    const dy = s.path.headY - playerY;
    const isDanger = s.score > playerScore && (dx * dx + dy * dy) < DANGER_RANGE_SQ;

    // Reuse or allocate
    if (bufIdx < _snakeBuf.length) {
      const b = _snakeBuf[bufIdx];
      b.x = s.path.headX;
      b.y = s.path.headY;
      b.color = s.color;
      b.isPlayer = s.isPlayer;
      b.isDanger = isDanger;
      b.angle = s.angle;
      b.r = s.isPlayer ? 4 : 1.8;
    } else {
      _snakeBuf.push({
        x: s.path.headX, y: s.path.headY, color: s.color,
        isPlayer: s.isPlayer, isDanger: isDanger,
        angle: s.angle, r: s.isPlayer ? 4 : 1.8,
      });
    }
    bufIdx++;
  }

  // ── Draw all snakes (non-player first, player on top) ──
  for (let i = 0; i < bufIdx; i++) {
    const b = _snakeBuf[i];
    const sx = cx + b.x * scale;
    const sy = cy + b.y * scale;

    // Skip if outside minimap circle (with margin)
    const ddx = sx - cx;
    const ddy = sy - cy;
    if (ddx * ddx + ddy * ddy > (r + 4) * (r + 4)) continue;

    if (b.isPlayer) continue; // draw player last

    // Danger glow
    if (b.isDanger) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Snake dot
    ctx.fillStyle = b.isDanger ? '#ef4444' : b.color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(sx, sy, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Draw player on top ──
  if (player && player.alive) {
    const px = cx + playerX * scale;
    const py = cy + playerY * scale;

    // Player glow
    ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();

    // Player dot
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator — arrow line + arrowhead
    const dirLen = 12;
    const tipX = px + Math.cos(player.angle) * dirLen;
    const tipY = py + Math.sin(player.angle) * dirLen;
    // Line from player dot to tip
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // Arrowhead triangle
    const wingAngle = 2.6; // radians from direction (≈149°)
    const wingLen = 5;
    ctx.fillStyle = 'rgba(74, 222, 128, 0.85)';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX + Math.cos(player.angle + wingAngle) * wingLen,
      tipY + Math.sin(player.angle + wingAngle) * wingLen,
    );
    ctx.lineTo(
      tipX + Math.cos(player.angle - wingAngle) * wingLen,
      tipY + Math.sin(player.angle - wingAngle) * wingLen,
    );
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // ── Border ring (outside clip) ──
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}
