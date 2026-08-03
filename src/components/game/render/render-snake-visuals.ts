/**
 * Venom Arena — snake visual helper functions.
 *
 * Rebuilt with the user's game approach:
 *  - Configurable 3D gradient (HIGHLIGHT_OFFSET, HIGHLIGHT_BRIGHT, SHADOW_DARK)
 *  - 6 hat types (tophat, crown, cap, santa, party, horns)
 *  - Face with specular, eyes, pupils (smooth tracking), nose dots, smile mouth
 *  - Direction arrow with smooth lerp
 *  - 7 body shape types with per-segment alternation
 *  - Gradient cache for performance
 *
 * Imported by render-snakes.ts — no React, no 'use client' needed.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type HatType = 'none' | 'tophat' | 'crown' | 'cap' | 'santa' | 'party' | 'horns';

export type SnakeShape =
  | 'circle'
  | 'box'
  | 'triangle'
  | 'mix_ct'
  | 'mix_cb'
  | 'mix_bt'
  | 'mix_all';

export const ALL_HAT_TYPES: HatType[] = [
  'none', 'tophat', 'crown', 'cap', 'santa', 'party', 'horns',
];

export const HAT_LABELS: Record<HatType, string> = {
  none: 'No Hat',
  tophat: 'Top Hat',
  crown: 'Crown',
  cap: 'Baseball Cap',
  santa: 'Santa Hat',
  party: 'Party Hat',
  horns: 'Devil Horns',
};

export const ALL_SNAKE_SHAPES: SnakeShape[] = [
  'circle', 'box', 'triangle', 'mix_ct', 'mix_cb', 'mix_bt', 'mix_all',
];

export const SHAPE_LABELS: Record<SnakeShape, string> = {
  circle: 'Circle',
  box: 'Box',
  triangle: 'Triangle',
  mix_ct: 'Circle + Triangle',
  mix_cb: 'Circle + Box',
  mix_bt: 'Box + Triangle',
  mix_all: 'All Mixed',
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. 3D GRADIENT CONFIG (from user's game)
// ═══════════════════════════════════════════════════════════════════════════

const HIGHLIGHT_OFFSET = 0.35;
const HIGHLIGHT_BRIGHT = 70;
const SHADOW_DARK = 55;

// ═══════════════════════════════════════════════════════════════════════════
// 3. HEX → RGB
// ═══════════════════════════════════════════════════════════════════════════

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
}

function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`;
}

export { lightenHex, darkenHex };

// ═══════════════════════════════════════════════════════════════════════════
// 4. 3D RADIAL GRADIENT (from user's game — configurable)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a radial gradient for 3D sphere/block look.
 * Light from top-left, highlight at offset center, shadow at edge.
 * All params guarded against NaN.
 */
export function make3DGrad(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
): CanvasGradient {
  if (!isFinite(cx)) cx = 0;
  if (!isFinite(cy)) cy = 0;
  const [cr, cg, cb] = hexToRgb(color);
  const safeR = Math.max(0.1, isFinite(r) ? r : 10);
  const offX = cx - safeR * HIGHLIGHT_OFFSET;
  const offY = cy - safeR * HIGHLIGHT_OFFSET;
  const grad = ctx.createRadialGradient(
    offX, offY, Math.max(0.001, safeR * 0.05),
    cx, cy, safeR,
  );
  grad.addColorStop(0, `rgb(${Math.min(255, cr + HIGHLIGHT_BRIGHT)},${Math.min(255, cg + HIGHLIGHT_BRIGHT)},${Math.min(255, cb + HIGHLIGHT_BRIGHT)})`);
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, `rgb(${Math.max(0, cr - SHADOW_DARK)},${Math.max(0, cg - SHADOW_DARK)},${Math.max(0, cb - SHADOW_DARK)})`);
  return grad;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. GRADIENT CACHE (avoids creating gradient objects every frame)
// ═══════════════════════════════════════════════════════════════════════════

export class GradientCache {
  private cache = new Map<string, CanvasGradient>();

  get(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ): CanvasGradient {
    const bucket = Math.max(4, Math.round(r * 2)) >> 1; // 2px buckets
    const key = `${bucket}:${color}`;
    let g = this.cache.get(key);
    if (!g) {
      g = make3DGrad(ctx, cx, cy, r, color);
      this.cache.set(key, g);
    }
    return g;
  }

  clear(): void {
    this.cache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. SHAPE PICKER (7 types — from user's game)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pick shape for a segment index based on the snake's shape setting.
 * Returns the primitive shape ('circle' | 'box' | 'triangle').
 */
export function pickSegmentShape(
  shape: SnakeShape,
  segIndex: number,
): 'circle' | 'box' | 'triangle' {
  switch (shape) {
    case 'circle':
      return 'circle';
    case 'box':
      return 'box';
    case 'triangle':
      return 'triangle';
    case 'mix_ct':
      return Math.floor(segIndex / 2) % 2 === 0 ? 'circle' : 'triangle';
    case 'mix_cb':
      return Math.floor(segIndex / 2) % 2 === 0 ? 'circle' : 'box';
    case 'mix_bt':
      return Math.floor(segIndex / 2) % 2 === 0 ? 'box' : 'triangle';
    case 'mix_all':
      return (['circle', 'box', 'triangle'] as const)[segIndex % 3];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. HAT RENDERING (6 types — user's game approach)
// ═══════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;

export function drawHat(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  angle: number,
  headR: number,
  hat: HatType,
  alpha: number = 1,
): void {
  if (hat === 'none') return;
  const r = headR;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  switch (hat) {
    case 'tophat':
      // Brim
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath(); ctx.ellipse(0, -r * 0.85, r * 1.3, r * 0.22, 0, 0, TAU); ctx.fill();
      // Cylinder
      ctx.fillStyle = '#16213e';
      ctx.fillRect(-r * 0.65, -r * 2.3, r * 1.3, r * 1.5);
      // Band
      ctx.fillStyle = '#e94560';
      ctx.fillRect(-r * 0.65, -r * 1.05, r * 1.3, r * 0.2);
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(-r * 0.5, -r * 2.2, r * 0.2, r * 1.2);
      break;

    case 'crown': {
      const cy = -r * 1.1;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, cy); ctx.lineTo(-r * 0.8, cy - r * 0.7);
      ctx.lineTo(-r * 0.4, cy - r * 0.35); ctx.lineTo(0, cy - r * 0.9);
      ctx.lineTo(r * 0.4, cy - r * 0.35); ctx.lineTo(r * 0.8, cy - r * 0.7);
      ctx.lineTo(r * 0.8, cy); ctx.closePath(); ctx.fill();
      // Gems
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.arc(0, cy - r * 0.15, r * 0.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3498db';
      ctx.beginPath(); ctx.arc(-r * 0.4, cy - r * 0.1, r * 0.07, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.4, cy - r * 0.1, r * 0.07, 0, TAU); ctx.fill();
      // Base
      ctx.fillStyle = '#daa520';
      ctx.fillRect(-r * 0.8, cy, r * 1.6, r * 0.2);
      break;
    }

    case 'cap':
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.95, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#34495e';
      ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 0.3, r * 0.9, r * 0.18, 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.arc(0, -r * 1.2, r * 0.1, 0, TAU); ctx.fill();
      break;

    case 'santa':
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.7);
      ctx.quadraticCurveTo(-r * 0.2, -r * 1.8, r * 0.8, -r * 2.0);
      ctx.lineTo(r * 0.5, -r * 1.5);
      ctx.quadraticCurveTo(-r * 0.1, -r * 1.2, -r * 0.5, -r * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-r * 1.0, -r * 0.85, r * 2.0, r * 0.22);
      ctx.beginPath(); ctx.arc(r * 0.8, -r * 2.0, r * 0.18, 0, TAU); ctx.fill();
      break;

    case 'party': {
      const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6'];
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        const a1 = -Math.PI + (i / segs) * Math.PI;
        const a2 = -Math.PI + ((i + 1) / segs) * Math.PI;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.moveTo(0, -r * 2.2);
        ctx.lineTo(Math.cos(a1) * r * 0.85, Math.sin(a1) * r * 0.85 - r * 0.1);
        ctx.lineTo(Math.cos(a2) * r * 0.85, Math.sin(a2) * r * 0.85 - r * 0.1);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(0, -r * 2.2, r * 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = r * 0.08;
      ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.85, r * 0.15, 0, 0, TAU); ctx.stroke();
      break;
    }

    case 'horns':
      ctx.fillStyle = '#e67e22'; ctx.strokeStyle = '#d35400'; ctx.lineWidth = r * 0.06;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.6, -r * 0.6);
        ctx.quadraticCurveTo(side * r * 1.2, -r * 1.8, side * r * 0.3, -r * 2.1);
        ctx.quadraticCurveTo(side * r * 0.5, -r * 1.2, side * r * 0.3, -r * 0.6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. FACE DRAWING (from user's game — eyes, pupils, nose, mouth, specular)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draws a complete snake face: specular, eyes with pupil tracking, nose, smile.
 *
 * Pupils smoothly track the snake's turn direction (like slither.io).
 * The face is drawn in world-space coordinates.
 */
export function drawSnakeFace(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  angle: number,
  bodyR: number,
  headR: number,
  isBoosting: boolean,
  pupilX: number,
  pupilY: number,
  _isPlayer: boolean,
): void {
  // Face coordinate system
  const fwdX = Math.cos(angle);
  const fwdY = Math.sin(angle);
  const lftX = -Math.sin(angle);
  const lftY = Math.cos(angle);

  // ── Specular highlight (face-relative — rotates with snake) ──
  const hlFwd = -headR * 0.15;
  const hlLat = -headR * 0.30;
  const hlX = hx + fwdX * hlFwd + lftX * hlLat;
  const hlY = hy + fwdY * hlFwd + lftY * hlLat;
  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(hlX, hlY, headR * 0.14, 0, TAU);
  ctx.fill();
  ctx.restore();

  // ── Eyes with pupil tracking ──
  const EYE_R = bodyR * 0.46;
  const PUPIL_R = EYE_R * 0.50;
  const EYE_FWD = headR * -0.05;
  const EYE_LAT = headR * 0.40;

  const safePX = Number.isFinite(pupilX) ? pupilX : 0;
  const safePY = Number.isFinite(pupilY) ? pupilY : 0;

  for (const side of [1, -1]) {
    const ex = hx + fwdX * EYE_FWD + lftX * EYE_LAT * side;
    const ey = hy + fwdY * EYE_FWD + lftY * EYE_LAT * side;
    // Eye white
    ctx.beginPath(); ctx.arc(ex, ey, EYE_R, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = Math.max(0.8, bodyR * 0.03);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.stroke();
    // Pupil — smooth offset
    ctx.beginPath();
    ctx.arc(ex + safePX, ey + safePY, PUPIL_R, 0, TAU);
    ctx.fillStyle = '#111'; ctx.fill();
  }

  // ── Nose: two small dots in front of eyes ──
  const NOSE_FWD = headR * 0.28;
  const NOSE_LAT = headR * 0.09;
  const NOSE_R = Math.max(1.5, bodyR * 0.07);
  const nCX = hx + fwdX * NOSE_FWD;
  const nCY = hy + fwdY * NOSE_FWD;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.arc(nCX + lftX * NOSE_LAT, nCY + lftY * NOSE_LAT, NOSE_R, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(nCX - lftX * NOSE_LAT, nCY - lftY * NOSE_LAT, NOSE_R, 0, TAU); ctx.fill();

  // ── Mouth: smile arc at the front tip ──
  const MOUTH_FWD = headR * 0.50;
  const MOUTH_W = Math.max(2, bodyR * 0.22);
  const mCX = hx + fwdX * MOUTH_FWD;
  const mCY = hy + fwdY * MOUTH_FWD;
  ctx.save();
  ctx.translate(mCX, mCY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, MOUTH_W, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(0.8, bodyR * 0.06);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. DIRECTION ARROW (from user's game — smooth lerp, extends on boost)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draws a direction arrow in front of the snake head.
 * Arrow distance smoothly lerps, extends when boosting.
 * Only drawn for the player's snake.
 *
 * @param arrowDistRef  Mutable ref for the smoothly-interpolated arrow distance
 */
export function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  angle: number,
  targetAngle: number,
  bodyR: number,
  isBoosting: boolean,
  zoom: number,
  arrowDistRef: { value: number },
): void {
  const targetDist = bodyR * 7 + (isBoosting ? 55 / zoom : 0);
  arrowDistRef.value += (targetDist - arrowDistRef.value) * 0.035;
  const arrowDist = arrowDistRef.value;

  const tipX = hx + Math.cos(targetAngle) * arrowDist;
  const tipY = hy + Math.sin(targetAngle) * arrowDist;
  const arrowSize = Math.max(8 / zoom, bodyR * 0.7);
  const perpX = Math.cos(targetAngle + Math.PI / 2);
  const perpY = Math.sin(targetAngle + Math.PI / 2);
  const backX = Math.cos(targetAngle + Math.PI);
  const backY = Math.sin(targetAngle + Math.PI);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX + backX * arrowSize + perpX * arrowSize * 0.85,
    tipY + backY * arrowSize + perpY * arrowSize * 0.85,
  );
  ctx.lineTo(
    tipX + backX * arrowSize - perpX * arrowSize * 0.85,
    tipY + backY * arrowSize - perpY * arrowSize * 0.85,
  );
  ctx.closePath();
  ctx.fillStyle = isBoosting ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)';
  ctx.fill();
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. HELPERS (exported for render-snakes.ts)
// ═══════════════════════════════════════════════════════════════════════════

/** Returns the shortest angular delta from `from` to `to` (radians, -PI..PI). */
export function shortestAngleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
