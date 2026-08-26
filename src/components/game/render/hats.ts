// ============================================================================
// Venom Arena — Hat Drawing Functions
// 6 hat types drawn on canvas, positioned above the head.
// ============================================================================

import type { HatType } from '@/lib/snake/types';

/**
 * Dispatch to the correct hat drawing function.
 */
export function drawHat(
  ctx: CanvasRenderingContext2D,
  hat: HatType,
  x: number,
  y: number,
  headRadius: number,
  angle: number,
): void {
  switch (hat) {
    case 'tophat':
      drawTophat(ctx, x, y, headRadius, angle);
      break;
    case 'crown':
      drawCrown(ctx, x, y, headRadius, angle);
      break;
    case 'cap':
      drawCap(ctx, x, y, headRadius, angle);
      break;
    case 'santa':
      drawSanta(ctx, x, y, headRadius, angle);
      break;
    case 'party':
      drawParty(ctx, x, y, headRadius, angle);
      break;
    case 'horns':
      drawHorns(ctx, x, y, headRadius, angle);
      break;
    case 'none':
    default:
      break;
  }
}

/** Top hat — classic black cylinder */
export function drawTophat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headRadius: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  // Offset hat above head, accounting for angle
  const offX = Math.cos(angle - Math.PI / 2) * headRadius * 0.3;
  const offY = Math.sin(angle - Math.PI / 2) * headRadius * 0.3;
  ctx.translate(offX, offY);

  const w = headRadius * 1.2;
  const brimH = headRadius * 0.15;
  const crownW = w * 0.7;
  const crownH = headRadius * 1.0;
  const topY = -headRadius - crownH;

  // Brim
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.ellipse(0, -headRadius * 0.8, w, brimH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crown
  ctx.fillStyle = '#0f0f23';
  ctx.fillRect(-crownW / 2, topY, crownW, crownH);

  // Top
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.ellipse(0, topY, crownW / 2, brimH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Band
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-crownW / 2, -headRadius * 0.9, crownW, headRadius * 0.15);

  ctx.restore();
}

/** Crown — golden royal crown with points */
export function drawCrown(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headRadius: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  const offX = Math.cos(angle - Math.PI / 2) * headRadius * 0.3;
  const offY = Math.sin(angle - Math.PI / 2) * headRadius * 0.3;
  ctx.translate(offX, offY);

  const w = headRadius * 1.1;
  const h = headRadius * 0.8;
  const baseY = -headRadius * 0.85;

  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(-w / 2, baseY);
  ctx.lineTo(-w / 2, baseY - h * 0.5);
  ctx.lineTo(-w / 4, baseY - h * 0.3);
  ctx.lineTo(0, baseY - h);
  ctx.lineTo(w / 4, baseY - h * 0.3);
  ctx.lineTo(w / 2, baseY - h * 0.5);
  ctx.lineTo(w / 2, baseY);
  ctx.closePath();
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Jewels
  ctx.fillStyle = '#FF3B3B';
  ctx.beginPath();
  ctx.arc(0, baseY - h * 0.3, headRadius * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3498DB';
  ctx.beginPath();
  ctx.arc(-w / 3, baseY - h * 0.2, headRadius * 0.07, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2ECC71';
  ctx.beginPath();
  ctx.arc(w / 3, baseY - h * 0.2, headRadius * 0.07, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Baseball cap */
export function drawCap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headRadius: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  const offX = Math.cos(angle - Math.PI / 2) * headRadius * 0.2;
  const offY = Math.sin(angle - Math.PI / 2) * headRadius * 0.2;
  ctx.translate(offX, offY);

  const w = headRadius * 1.2;
  const h = headRadius * 0.55;
  const baseY = -headRadius * 0.75;

  // Cap dome
  ctx.fillStyle = '#E74C3C';
  ctx.beginPath();
  ctx.ellipse(0, baseY, w / 2, h, 0, Math.PI, 0);
  ctx.fill();

  // Brim (pointing in movement direction)
  const brimLen = headRadius * 0.9;
  ctx.fillStyle = '#C0392B';
  ctx.beginPath();
  const brimAngle = angle - Math.PI / 2;
  ctx.moveTo(-w / 3, baseY);
  ctx.lineTo(
    -w / 3 + Math.cos(brimAngle) * brimLen,
    baseY + Math.sin(brimAngle) * brimLen,
  );
  ctx.lineTo(
    w / 3 + Math.cos(brimAngle) * brimLen * 0.8,
    baseY + Math.sin(brimAngle) * brimLen * 0.8,
  );
  ctx.lineTo(w / 3, baseY);
  ctx.closePath();
  ctx.fill();

  // Button on top
  ctx.fillStyle = '#C0392B';
  ctx.beginPath();
  ctx.arc(0, baseY - h, headRadius * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Santa hat — red with white trim and pompom */
export function drawSanta(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headRadius: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  const offX = Math.cos(angle - Math.PI / 2) * headRadius * 0.2;
  const offY = Math.sin(angle - Math.PI / 2) * headRadius * 0.2;
  ctx.translate(offX, offY);

  const w = headRadius * 1.3;
  const h = headRadius * 1.1;
  const baseY = -headRadius * 0.75;

  // White trim (band at base)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(0, baseY, w / 2, headRadius * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Red body
  ctx.fillStyle = '#CC0000';
  ctx.beginPath();
  ctx.moveTo(-w / 2, baseY);
  ctx.quadraticCurveTo(-w / 4, baseY - h, w * 0.2, baseY - h * 0.85);
  ctx.quadraticCurveTo(w / 2, baseY - h * 0.6, w / 2, baseY);
  ctx.closePath();
  ctx.fill();

  // Pompom at tip
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(w * 0.2, baseY - h * 0.85, headRadius * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Party hat — colorful cone with stripes */
export function drawParty(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headRadius: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  const offX = Math.cos(angle - Math.PI / 2) * headRadius * 0.2;
  const offY = Math.sin(angle - Math.PI / 2) * headRadius * 0.2;
  ctx.translate(offX, offY);

  const w = headRadius * 1.0;
  const h = headRadius * 1.3;
  const baseY = -headRadius * 0.75;
  const tipX = w * 0.15;
  const tipY = baseY - h;

  // Main cone
  ctx.fillStyle = '#9B59B6';
  ctx.beginPath();
  ctx.moveTo(-w / 2, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(w / 2, baseY);
  ctx.closePath();
  ctx.fill();

  // Stripes
  ctx.fillStyle = '#F1C40F';
  const stripes = 4;
  for (let i = 1; i < stripes; i++) {
    const t = i / stripes;
    const stripeY = baseY - h * t;
    const halfW = (w / 2) * (1 - t);
    const stripeH = h / stripes * 0.35;
    ctx.beginPath();
    ctx.rect(-halfW + tipX * t, stripeY, halfW * 2, stripeH);
    ctx.fill();
  }

  // Pompom
  ctx.fillStyle = '#E74C3C';
  ctx.beginPath();
  ctx.arc(tipX, tipY, headRadius * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Elastic band
  ctx.strokeStyle = '#E74C3C';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, baseY + headRadius * 0.1, w / 2 + 2, headRadius * 0.08, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/** Devil horns — two curved horns */
export function drawHorns(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headRadius: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  const offX = Math.cos(angle - Math.PI / 2) * headRadius * 0.15;
  const offY = Math.sin(angle - Math.PI / 2) * headRadius * 0.15;
  ctx.translate(offX, offY);

  const hornLen = headRadius * 0.9;
  const hornW = headRadius * 0.25;
  const baseY = -headRadius * 0.7;
  const spread = headRadius * 0.45;

  // Left horn
  ctx.fillStyle = '#2C3E50';
  ctx.beginPath();
  ctx.moveTo(-spread - hornW / 2, baseY);
  ctx.quadraticCurveTo(
    -spread - hornLen * 0.3,
    baseY - hornLen,
    -spread - hornLen * 0.1,
    baseY - hornLen,
  );
  ctx.quadraticCurveTo(
    -spread + hornLen * 0.1,
    baseY - hornLen * 0.7,
    -spread + hornW / 2,
    baseY,
  );
  ctx.closePath();
  ctx.fill();

  // Right horn
  ctx.beginPath();
  ctx.moveTo(spread - hornW / 2, baseY);
  ctx.quadraticCurveTo(
    spread + hornLen * 0.3,
    baseY - hornLen,
    spread + hornLen * 0.1,
    baseY - hornLen,
  );
  ctx.quadraticCurveTo(
    spread - hornLen * 0.1,
    baseY - hornLen * 0.7,
    spread + hornW / 2,
    baseY,
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
