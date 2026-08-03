/**
 * Venom Arena — shared snake visual helper functions.
 *
 * This module contains all reusable canvas-drawing utilities for upgrading
 * snake rendering: 3D shading gradients, hat cosmetics, face details,
 * cached offscreen clip canvases, food color palettes, segment shape
 * selection, and a gradient cache to avoid creating objects every frame.
 *
 * Imported by render-snakes.ts — no React, no 'use client' needed.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. HEX → RGB
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Converts a hex color string (e.g. "#22c55e" or "#fff") into an
 * `[r, g, b]` tuple with values 0–255.
 *
 * Returns `[0, 0, 0]` for unparseable input so callers never need a guard.
 */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, '');
  // Expand shorthand (#fff → #ffffff)
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. 3D GRADIENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a radial gradient that gives a circle a 3D sphere / block look.
 * The light source is positioned at the **top-left** so the highlight
 * naturally falls there and the shadow deepens toward the bottom-right.
 *
 * @param ctx              Canvas 2D context (used to create the gradient).
 * @param cx               Center X in canvas space.
 * @param cy               Center Y in canvas space.
 * @param r                Radius of the sphere.
 * @param color            Base colour in hex (e.g. "#22c55e").
 * @param highlightOffset  How far (as fraction of r) the highlight center is
 *                         shifted top-left from the true center. Default 0.35.
 * @param highlightBright  How much (0-255) to brighten the highlight peak.
 *                         Default 70.
 * @param shadowDark       How much (0-255) to darken the shadow edge.
 *                         Default 55.
 *
 * All numeric params are guarded against NaN / Infinity.
 */
export function make3DGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  highlightOffset: number = 0.35,
  highlightBright: number = 70,
  shadowDark: number = 55,
): CanvasGradient {
  // Guard against degenerate params
  const safeR = Math.max(0.1, r || 0.1);
  const safeHO = Number.isFinite(highlightOffset) ? highlightOffset : 0.35;
  const safeHB = Number.isFinite(highlightBright) ? highlightBright : 70;
  const safeSD = Number.isFinite(shadowDark) ? shadowDark : 55;

  const [cr, cg, cb] = hexToRgb(color);

  // Highlight center (top-left)
  const hx = cx - safeR * safeHO;
  const hy = cy - safeR * safeHO;

  const grad = ctx.createRadialGradient(hx, hy, safeR * 0.05, cx, cy, safeR);

  // Bright peak
  const hr = Math.min(255, cr + safeHB);
  const hg = Math.min(255, cg + safeHB);
  const hb = Math.min(255, cb + safeHB);
  grad.addColorStop(0, `rgb(${hr},${hg},${hb})`);

  // Mid-tone (slightly brighter than base)
  const mr = Math.min(255, cr + Math.round(safeHB * 0.3));
  const mg = Math.min(255, cg + Math.round(safeHB * 0.3));
  const mb = Math.min(255, cb + Math.round(safeHB * 0.3));
  grad.addColorStop(0.45, `rgb(${mr},${mg},${mb})`);

  // Base color
  grad.addColorStop(0.7, color);

  // Shadow edge
  const sr = Math.max(0, cr - safeSD);
  const sg = Math.max(0, cg - safeSD);
  const sb = Math.max(0, cb - safeSD);
  grad.addColorStop(1, `rgb(${sr},${sg},${sb})`);

  return grad;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. HAT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/** All available hat cosmetic types. */
export type HatType =
  | 'none'
  | 'tophat'
  | 'crown'
  | 'cap'
  | 'santa'
  | 'party'
  | 'horns';

/** Canonical list of hat types (excluding 'none'). */
export const HAT_TYPES: HatType[] = [
  'tophat',
  'crown',
  'cap',
  'santa',
  'party',
  'horns',
];

/** Human-readable labels for each hat type. */
export const HAT_LABELS: Record<HatType, string> = {
  none: 'No Hat',
  tophat: 'Top Hat',
  crown: 'Crown',
  cap: 'Baseball Cap',
  santa: 'Santa Hat',
  party: 'Party Hat',
  horns: 'Devil Horns',
};

/**
 * Draws a hat on the snake's head.
 *
 * @param ctx    Canvas 2D context (already translated so head center is origin).
 * @param hx     Head center X.
 * @param hy     Head center Y.
 * @param angle  Facing angle (radians, 0 = right, PI/2 = down).
 * @param headR  Head radius in world units.
 * @param hat    Which hat to draw.
 * @param alpha  Global opacity multiplier (default 1).
 */
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

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(hx, hy);
  ctx.rotate(angle);

  switch (hat) {
    case 'tophat':
      drawTophat(ctx, headR);
      break;
    case 'crown':
      drawCrown(ctx, headR);
      break;
    case 'cap':
      drawCap(ctx, headR);
      break;
    case 'santa':
      drawSantaHat(ctx, headR);
      break;
    case 'party':
      drawPartyHat(ctx, headR);
      break;
    case 'horns':
      drawHorns(ctx, headR);
      break;
  }

  ctx.restore();
}

// ─── Individual hat renderers (all drawn in local space: origin = head center,
//     +x = forward, +y = left) ──────────────────────────────────────────────

/**
 * Top Hat — dark brim + tall cylinder with a red band and white shine streak.
 */
function drawTophat(ctx: CanvasRenderingContext2D, headR: number): void {
  const brimW = headR * 1.3;  // half-width of brim
  const brimH = headR * 0.12; // brim thickness
  const cylW = headR * 0.65;  // half-width of cylinder
  const cylH = headR * 1.2;   // cylinder height (goes upward = -y)

  // Brim
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.ellipse(0, -headR * 0.65, brimW, brimH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cylinder body
  ctx.fillStyle = '#16213e';
  ctx.fillRect(-cylW, -headR * 0.65 - cylH, cylW * 2, cylH);

  // Cylinder top ellipse
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.ellipse(0, -headR * 0.65 - cylH, cylW, brimH * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Red band
  const bandY = -headR * 0.65 - cylH * 0.25;
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-cylW - 0.5, bandY, cylW * 2 + 1, cylH * 0.12);

  // White shine stripe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(-cylW * 0.35, -headR * 0.65 - cylH * 0.95, cylW * 0.25, cylH * 0.7);
}

/**
 * Crown — golden crown with 5 triangular points, a red center gem,
 * blue side gems, and a golden base band.
 */
function drawCrown(ctx: CanvasRenderingContext2D, headR: number): void {
  const crownW = headR * 1.15; // half-width
  const crownH = headR * 0.75; // total height
  const baseY = -headR * 0.55;
  const points = 5;

  // Crown outline path
  ctx.fillStyle = '#fbbf24'; // amber-400 gold
  ctx.beginPath();
  ctx.moveTo(-crownW, baseY);

  for (let i = 0; i < points; i++) {
    const frac = i / points;
    const x1 = -crownW + frac * crownW * 2;                    // valley
    const x2 = -crownW + (frac + 0.5 / points) * crownW * 2;   // peak
    const valleyY = baseY;
    const peakY = baseY - crownH;

    ctx.lineTo(x1, valleyY);
    ctx.lineTo(x2, peakY);
  }

  ctx.lineTo(crownW, baseY);
  ctx.closePath();
  ctx.fill();

  // Darker outline
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Base band
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-crownW, baseY - headR * 0.12, crownW * 2, headR * 0.12);

  // Red center gem
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, baseY - crownH * 0.35, headR * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // Blue side gems
  ctx.fillStyle = '#3b82f6';
  const gemOffset = crownW * 0.55;
  ctx.beginPath();
  ctx.arc(-gemOffset, baseY - crownH * 0.25, headR * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(gemOffset, baseY - crownH * 0.25, headR * 0.065, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Baseball Cap — dark dome with blue brim and a red button on top.
 */
function drawCap(ctx: CanvasRenderingContext2D, headR: number): void {
  const capW = headR * 1.05;
  const capH = headR * 0.55;
  const baseY = -headR * 0.5;

  // Dome
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.ellipse(0, baseY, capW, capH, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Brim (extends forward = +x direction)
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.ellipse(capW * 0.25, baseY, capW * 0.9, headR * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Red button on top
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, baseY - capH, headR * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Santa Hat — red curved cone hat with white fur trim at the base
 * and a white pom-pom at the tip.
 */
function drawSantaHat(ctx: CanvasRenderingContext2D, headR: number): void {
  const baseY = -headR * 0.45;
  const tipX = headR * 0.7;   // tip curves to the side
  const tipY = -headR * 1.8;

  // Red cone body (curved triangle)
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(-headR * 0.85, baseY);
  ctx.quadraticCurveTo(headR * 0.1, baseY - headR * 1.1, tipX, tipY);
  ctx.lineTo(headR * 0.85, baseY);
  ctx.closePath();
  ctx.fill();

  // White fur trim at base
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(0, baseY, headR * 0.95, headR * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // White pom-pom at tip
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(tipX, tipY, headR * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Party Hat — multi-coloured cone segments with a gold ball on top
 * and a white band around the base.
 */
function drawPartyHat(ctx: CanvasRenderingContext2D, headR: number): void {
  const baseY = -headR * 0.4;
  const coneH = headR * 1.5;
  const segments = 6;
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

  // Cone body — draw as filled segments from center to base
  const topX = 0;
  const topY = baseY - coneH;

  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI;
    const a2 = ((i + 1) / segments) * Math.PI;

    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(topX + Math.cos(a1) * headR * 0.85, baseY + Math.sin(a1) * headR * 0.12);
    ctx.lineTo(topX + Math.cos(a2) * headR * 0.85, baseY + Math.sin(a2) * headR * 0.12);
    ctx.closePath();
    ctx.fill();
  }

  // White band at base
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(0, baseY, headR * 0.85, headR * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Gold ball at tip
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(topX, topY, headR * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

/**
 * Devil Horns — two orange curved horns rising from the head with
 * dark outlines for definition.
 */
function drawHorns(ctx: CanvasRenderingContext2D, headR: number): void {
  const baseY = -headR * 0.5;
  const hornLen = headR * 1.0;
  const spread = headR * 0.6;

  // Draw two symmetric horns
  for (const side of [-1, 1]) {
    const bx = side * spread;
    const tipX = side * (spread + headR * 0.3);
    const tipY = baseY - hornLen;

    // Horn fill
    ctx.fillStyle = '#ea580c'; // orange-600
    ctx.beginPath();
    ctx.moveTo(bx - side * headR * 0.15, baseY);
    ctx.quadraticCurveTo(
      bx + side * headR * 0.1,
      baseY - hornLen * 0.6,
      tipX,
      tipY,
    );
    ctx.quadraticCurveTo(
      bx + side * headR * 0.3,
      baseY - hornLen * 0.4,
      bx + side * headR * 0.25,
      baseY,
    );
    ctx.closePath();
    ctx.fill();

    // Dark outline
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. FACE DRAWING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draws a complete snake face: specular highlight, two eyes with pupils,
 * two nostril dots, and a subtle smile arc.
 *
 * The face is drawn in world space relative to the head center.  The caller
 * is expected to `ctx.save()` / `ctx.restore()` around the call if they need
 * to clip or adjust global alpha.
 *
 * @param ctx        Canvas 2D context.
 * @param hx         Head center X.
 * @param hy         Head center Y.
 * @param angle      Facing angle (radians, 0 = right).
 * @param bodyR      Body radius (used as reference for proportions).
 * @param headR      Head radius (may differ from bodyR if the head is larger).
 * @param isBoosting Whether the snake is currently boosting (pupils widen).
 * @param pupilX     Extra pupil X offset (for look-at-target, may be NaN).
 * @param pupilY     Extra pupil Y offset (same).
 * @param isPlayer   Whether this is the local player's snake.
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
  isPlayer: boolean,
): void {
  // Face coordinate system
  const fwdX = Math.cos(angle);
  const fwdY = Math.sin(angle);
  const lftX = Math.cos(angle + Math.PI / 2);
  const lftY = Math.sin(angle + Math.PI / 2);

  // ── Specular highlight ──
  // Small white dot at -15% forward, -30% left of head center
  const specX = hx + fwdX * (-headR * 0.15) + lftX * (-headR * 0.30);
  const specY = hy + fwdY * (-headR * 0.15) + lftY * (-headR * 0.30);
  const specR = headR * 0.14;
  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(specX, specY, Math.max(0.5, specR), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Eyes ──
  const eyeR = Math.max(1, bodyR * 0.46);     // eye white radius
  const pupilR = eyeR * 0.50;                  // pupil radius

  // Eye center positions: 42% forward from center, 28% lateral
  const eyeFwd = headR * 0.42;
  const eyeLat = headR * 0.28;

  const leX = hx + fwdX * eyeFwd + lftX * eyeLat;
  const leY = hy + fwdY * eyeFwd + lftY * eyeLat;
  const reX = hx + fwdX * eyeFwd - lftX * eyeLat;
  const reY = hy + fwdY * eyeFwd - lftY * eyeLat;

  // Pupil offset: look forward + smooth external offset
  const pupilFwd = isBoosting ? pupilR * 0.1 : pupilR * 0.35;
  const safePX = Number.isFinite(pupilX) ? pupilX : 0;
  const safePY = Number.isFinite(pupilY) ? pupilY : 0;

  // Draw eye whites
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(leX, leY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(reX, reY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Draw pupils (black)
  ctx.fillStyle = '#0a0a0a';
  const lpX = leX + fwdX * pupilFwd + safePX;
  const lpY = leY + fwdY * pupilFwd + safePY;
  const rpX = reX + fwdX * pupilFwd + safePX;
  const rpY = reY + fwdY * pupilFwd + safePY;
  ctx.beginPath();
  ctx.arc(lpX, lpY, pupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rpX, rpY, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // Player gets a tiny green ring around pupils (accent)
  if (isPlayer) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = Math.max(0.5, eyeR * 0.08);
    ctx.beginPath();
    ctx.arc(lpX, lpY, pupilR + 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rpX, rpY, pupilR + 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Nose dots ──
  // Two small dots at 28% forward from center, 9% lateral
  const noseR = Math.max(0.4, bodyR * 0.07);
  const noseFwd = headR * 0.28;
  const noseLat = headR * 0.09;

  ctx.save();
  ctx.globalAlpha = 0.50;
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(
    hx + fwdX * noseFwd + lftX * noseLat,
    hy + fwdY * noseFwd + lftY * noseLat,
    noseR,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.arc(
    hx + fwdX * noseFwd - lftX * noseLat,
    hy + fwdY * noseFwd - lftY * noseLat,
    noseR,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  // ── Mouth (smile arc) ──
  // Arc at 50% forward from center, 22% of bodyR width
  const mouthFwd = headR * 0.50;
  const mouthW = Math.max(1, bodyR * 0.22);
  const mouthX = hx + fwdX * mouthFwd;
  const mouthY = hy + fwdY * mouthFwd;

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = Math.max(0.6, bodyR * 0.04);
  ctx.lineCap = 'round';

  // The arc is drawn perpendicular to the forward direction
  ctx.translate(mouthX, mouthY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, mouthW, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CACHED OFFSCREEN CANVAS (clip / overlap effects)
// ═══════════════════════════════════════════════════════════════════════════

/** Internal singleton for the cached offscreen canvas. */
let _clipCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let _clipW = 0;
let _clipH = 0;

/**
 * Returns a reusable offscreen canvas of the requested dimensions.
 * Creates the canvas once and re-uses it; only re-allocates if the
 * requested size exceeds the current dimensions (to avoid garbage).
 *
 * This is useful for bite-mask / overlap-clipping operations where
 * we need to draw a snake segment off-screen and composite it.
 */
export function getClipCanvas(W: number, H: number): OffscreenCanvas | HTMLCanvasElement {
  if (!_clipCanvas || W > _clipW || H > _clipH) {
    // OffscreenCanvas is available in modern browsers; fall back to
    // a regular canvas element if not.
    if (typeof OffscreenCanvas !== 'undefined') {
      _clipCanvas = new OffscreenCanvas(W, H);
    } else {
      _clipCanvas = document.createElement('canvas');
      _clipCanvas.width = W;
      _clipCanvas.height = H;
    }
    _clipW = W;
    _clipH = H;
  }
  return _clipCanvas;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. FOOD COLOR PALETTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Colour palettes for food orbs, keyed by tier value.
 * Each entry provides the main colour, glow colour, and an optional
 * highlight for the inner shimmer gradient.
 *
 * These are exported so that the food renderer (or future skin tints)
 * can reference consistent colour definitions.
 */
export const FOOD_PALETTES: Record<
  number,
  { color: string; glow: string; highlight: string }
> = {
  1: { color: '#34d399', glow: '#10b981', highlight: '#a7f3d0' },   // emerald
  2: { color: '#38bdf8', glow: '#0ea5e9', highlight: '#bae6fd' },   // sky
  3: { color: '#38bdf8', glow: '#0ea5e9', highlight: '#bae6fd' },   // sky (medium)
  4: { color: '#c084fc', glow: '#a855f7', highlight: '#e9d5ff' },   // purple
  5: { color: '#f472b6', glow: '#ec4899', highlight: '#fbcfe8' },   // pink (large)
  6: { color: '#fbbf24', glow: '#f59e0b', highlight: '#fef3c7' },   // amber (star)
  7: { color: '#fb923c', glow: '#f97316', highlight: '#fed7aa' },   // orange
  8: { color: '#f87171', glow: '#ef4444', highlight: '#fecaca' },   // red
  9: { color: '#22d3ee', glow: '#06b6d4', highlight: '#cffafe' },   // cyan
  10: { color: '#a3e635', glow: '#84cc16', highlight: '#ecfccb' },  // lime
};

/** Default palette used when a value isn't in the map. */
export const FOOD_PALETTE_DEFAULT = FOOD_PALETTES[1];

// ═══════════════════════════════════════════════════════════════════════════
// 7. SEGMENT SHAPE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Snake body segment shapes.
 *   - `circle` / `box` / `triangle` — uniform shape for all segments.
 *   - `mix_ct` — alternating circle and triangle.
 *   - `mix_cb` — alternating circle and box.
 *   - `mix_bt` — alternating box and triangle.
 *   - `mix_all` — cycling circle → box → triangle.
 */
export type SnakeShape =
  | 'circle'
  | 'box'
  | 'triangle'
  | 'mix_ct'
  | 'mix_cb'
  | 'mix_bt'
  | 'mix_all';

/** Canonical list of all shape variants. */
export const SNAKE_SHAPES: SnakeShape[] = [
  'circle',
  'box',
  'triangle',
  'mix_ct',
  'mix_cb',
  'mix_bt',
  'mix_all',
];

/**
 * Returns the concrete segment shape for a given body segment index,
 * based on the snake's configured `SnakeShape`.
 *
 * @param shape  The snake's overall shape setting.
 * @param index  Zero-based body segment index (0 = head, usually drawn
 *               separately so index 1+ is the typical range).
 */
export function pickSegmentShape(
  shape: SnakeShape,
  index: number,
): 'circle' | 'box' | 'triangle' {
  switch (shape) {
    case 'circle':
      return 'circle';
    case 'box':
      return 'box';
    case 'triangle':
      return 'triangle';
    case 'mix_ct':
      return index % 2 === 0 ? 'circle' : 'triangle';
    case 'mix_cb':
      return index % 2 === 0 ? 'circle' : 'box';
    case 'mix_bt':
      return index % 2 === 0 ? 'box' : 'triangle';
    case 'mix_all':
      return (['circle', 'box', 'triangle'] as const)[index % 3];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. GRADIENT CACHE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-context gradient cache.
 *
 * Avoids allocating a new `CanvasGradient` every frame for the same
 * colour + size combination.  Keys are strings of the form
 * `"${color}:${sizeBucket}"` where the size is rounded to 2-px buckets.
 *
 * Usage:
 * ```ts
 * const cache = new GradientCache();
 * const grad = cache.get(ctx, cx, cy, radius, color);
 * ```
 */
export class GradientCache {
  private readonly _map = new Map<string, CanvasGradient>();

  /**
   * Retrieve (or create & cache) a 3D-style radial gradient for the given
   * colour and radius.
   *
   * @param ctx     The canvas 2D context used to create gradients.
   * @param cx      Center X of the gradient.
   * @param cy      Center Y of the gradient.
   * @param r       Radius of the gradient.
   * @param color   Hex colour string.
   * @returns A cached `CanvasGradient` instance.
   */
  get(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ): CanvasGradient {
    // Always create fresh — CanvasGradient has baked-in absolute
    // coordinates, so caching by color+size alone would place the
    // highlight at the wrong position for different segments.
    const safeR = Math.max(0.1, isFinite(r) ? r : 10);
    const safeCx = isFinite(cx) ? cx : 0;
    const safeCy = isFinite(cy) ? cy : 0;
    const bucket = Math.max(2, Math.round(safeR));

    const grad = ctx.createRadialGradient(
      safeCx - bucket * 0.35,
      safeCy - bucket * 0.35,
      bucket * 0.05,
      safeCx,
      safeCy,
      bucket,
    );
    const [cr, cg, cb] = hexToRgb(color);

    // Highlight
    grad.addColorStop(0, `rgb(${Math.min(255, cr + 70)},${Math.min(255, cg + 70)},${Math.min(255, cb + 70)})`);
    // Mid-tone
    grad.addColorStop(0.45, `rgb(${Math.min(255, cr + 20)},${Math.min(255, cg + 20)},${Math.min(255, cb + 20)})`);
    // Base
    grad.addColorStop(0.7, color);
    // Shadow
    grad.addColorStop(1, `rgb(${Math.max(0, cr - 55)},${Math.max(0, cg - 55)},${Math.max(0, cb - 55)})`);

    return grad;
  }

  /**
   * Evict entries whose key does NOT start with the given colour prefix,
   * effectively clearing gradients for snakes that have left the viewport.
   *
   * Call once per frame after rendering, passing the set of currently-
   * visible colours.
   */
  prune(activeColors: Iterable<string>): void {
    const keep = new Set<string>();
    for (const c of activeColors) {
      for (const key of this._map.keys()) {
        if (key.startsWith(`${c}:`)) keep.add(key);
      }
    }
    for (const key of this._map.keys()) {
      if (!keep.has(key)) this._map.delete(key);
    }
  }

  /** Drop all cached entries (e.g. on skin change). */
  clear(): void {
    this._map.clear();
  }

  /** Current cache size (diagnostics). */
  get size(): number {
    return this._map.size;
  }
}
