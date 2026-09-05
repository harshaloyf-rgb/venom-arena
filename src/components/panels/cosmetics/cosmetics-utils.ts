import type {
  BodyStyle,
  CustomSegment,
  CustomSkinState,
  SegShape,
  SkinPreset,
  TaperStyle,
} from './cosmetics-types';
import { CUSTOM_SKIN_KEY, SKIN_PRESETS } from './cosmetics-types';
import { ALL_COSMETICS, PASS_FREE_COSMETICS, PASS_ELITE_COSMETICS } from '@/lib/game-config';
import type { SkinPattern } from '@/lib/game-config';

// ---------------------------------------------------------------------------
// Shared shape-style resolution — maps BodyStyle → per-segment SegShape.
// ---------------------------------------------------------------------------
export function resolveShapeStyle(
  shapeStyle: string,
  index: number,
): SegShape {
  if (shapeStyle === 'dragon')
    return index % 2 === 1 ? 'spike' : 'circle';
  if (shapeStyle === 'armored')
    return index % 2 === 1 ? 'square' : 'circle';
  if (shapeStyle === 'crystal')
    return index % 2 === 1 ? 'diamond' : 'circle';
  if (shapeStyle === 'obsidian') return 'spike';
  if (shapeStyle === 'basilisk') return 'diamond';
  if (shapeStyle === 'stellar')
    return index % 2 === 1 ? 'star' : 'circle';
  if (shapeStyle === 'fortress') return 'hexagon';
  if (shapeStyle === 'stingray') return 'triangle';
  if (shapeStyle === 'phantom') return 'ring';
  return 'circle'; // smooth or default
}

// ---------------------------------------------------------------------------
// generateCustomSegments
// ---------------------------------------------------------------------------
export function generateCustomSegments(
  colors: string[],
  shapeStyle: BodyStyle,
  taperStyle: TaperStyle,
  glowEnabled: boolean,
): CustomSegment[] {
  if (colors.length === 0) return [];
  const result: CustomSegment[] = [];
  const totalNodes = 16;

  for (let i = 0; i < totalNodes; i++) {
    const color = colors[i % colors.length];
    const shape = resolveShapeStyle(shapeStyle, i);

    let sizeScale = 1.0;
    if (taperStyle === 'uniform') {
      sizeScale = 1.0;
    } else if (taperStyle === 'natural') {
      sizeScale = Math.max(0.65, 1.25 - (i / totalNodes) * 0.55);
    } else if (taperStyle === 'wave') {
      sizeScale = 1.0 + Math.sin(i * 0.95) * 0.22;
    } else if (taperStyle === 'heavy') {
      sizeScale = Math.max(0.55, 1.35 - (i / totalNodes) * 0.8);
    }

    result.push({
      color,
      shape,
      glow: glowEnabled,
      sizeScale: Number(sizeScale.toFixed(2)),
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// localStorage custom-skin persistence
// ---------------------------------------------------------------------------
export function readCustomSkinState(): CustomSkinState | null {
  try {
    const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomSkinState;
  } catch {
    return null;
  }
}

export function readCustomSkinStateSafe(): CustomSkinState | null {
  if (typeof window === 'undefined') return null;
  return readCustomSkinState();
}

export function writeCustomSkinState(state: CustomSkinState) {
  try {
    localStorage.setItem(CUSTOM_SKIN_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

export function lightenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const nr = Math.round(r + (255 - r) * factor);
  const ng = Math.round(g + (255 - g) * factor);
  const nb = Math.round(b + (255 - b) * factor);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const nr = Math.round(r * (1 - factor));
  const ng = Math.round(g * (1 - factor));
  const nb = Math.round(b * (1 - factor));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// computeTaperRadius
// ---------------------------------------------------------------------------
export function computeTaperRadius(
  index: number,
  totalSegments: number,
  taperStyle: TaperStyle,
): number {
  const t = index / totalSegments;
  switch (taperStyle) {
    case 'uniform': return 1.0;
    case 'natural': return Math.max(0.65, 1.25 - t * 0.55);
    case 'wave':    return 1.0 + Math.sin(index * 0.95) * 0.22;
    case 'heavy':   return Math.max(0.55, 1.35 - t * 0.8);
  }
}

// ---------------------------------------------------------------------------
// Helper: draw a 5-pointed star path centered at (x,y) with outer radius `or`
// and inner radius `ir`, rotated by `angle`.
// ---------------------------------------------------------------------------
function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  or: number, ir: number,
  angle: number,
) {
  const points = 5;
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? or : ir;
    const a = angle + i * step - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Helper: draw a regular hexagon path centered at (cx,cy) with radius `r`,
// flat-top orientation rotated by `angle`.
// ---------------------------------------------------------------------------
function hexPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  r: number,
  angle: number,
) {
  for (let i = 0; i < 6; i++) {
    const a = angle + (Math.PI / 3) * i;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// getSkinVisualProps — shared pattern → visual props mapping
// ---------------------------------------------------------------------------

/** Visual props derived from a skin's pattern field */
export interface SkinVisualProps {
  colors: string[];
  bodyStyle: BodyStyle;
  taperStyle: TaperStyle;
  glow: boolean;
}

/** Build a flat lookup: skinId → SkinPattern */
const skinPatternMap = new Map<string, SkinPattern>();
for (const item of ALL_COSMETICS) {
  if (item.type === 'skin' && item.pattern) skinPatternMap.set(item.id, item.pattern);
}
for (const item of PASS_FREE_COSMETICS) {
  if (item.type === 'skin' && item.pattern) skinPatternMap.set(item.id, item.pattern);
}
for (const item of PASS_ELITE_COSMETICS) {
  if (item.type === 'skin' && item.pattern) skinPatternMap.set(item.id, item.pattern);
}

/** Build a flat lookup: skinId → { color, secondaryColor } */
const skinColorMap = new Map<string, { color: string; secondaryColor?: string }>();
for (const item of ALL_COSMETICS) {
  if (item.type === 'skin') skinColorMap.set(item.id, { color: item.color, secondaryColor: item.secondaryColor });
}
for (const item of PASS_FREE_COSMETICS) {
  if (item.type === 'skin') skinColorMap.set(item.id, { color: item.color, secondaryColor: item.secondaryColor });
}
for (const item of PASS_ELITE_COSMETICS) {
  if (item.type === 'skin') skinColorMap.set(item.id, { color: item.color, secondaryColor: item.secondaryColor });
}

/**
 * Map a SkinPattern to visual rendering props (bodyStyle, taperStyle, glow, colors).
 * This is the SINGLE SOURCE OF TRUTH used by SkinCard, GameSnakePreview, and
 * the game renderer to ensure consistent visuals everywhere.
 */
export function mapPatternToVisuals(pattern: SkinPattern): Omit<SkinVisualProps, 'colors'> {
  switch (pattern) {
    case 'neon':
      return { bodyStyle: 'crystal', taperStyle: 'natural', glow: true };
    case 'glow':
      return { bodyStyle: 'smooth', taperStyle: 'natural', glow: true };
    case 'metallic':
      return { bodyStyle: 'fortress', taperStyle: 'uniform', glow: false };
    case 'pulse':
      return { bodyStyle: 'stellar', taperStyle: 'wave', glow: true };
    case 'rainbow':
      return { bodyStyle: 'crystal', taperStyle: 'wave', glow: true };
    case 'camo':
      return { bodyStyle: 'stingray', taperStyle: 'natural', glow: false };
    case 'cyber':
      return { bodyStyle: 'fortress', taperStyle: 'wave', glow: true };
    case 'zebra':
      return { bodyStyle: 'armored', taperStyle: 'uniform', glow: false };
    default:
      return { bodyStyle: 'smooth', taperStyle: 'natural', glow: false };
  }
}

/**
 * Get the full visual props for a skin by its ID.
 * Returns null for skins without a pattern (they use simple solid rendering).
 * For skins with a pattern, returns colors[] + bodyStyle + taperStyle + glow
 * so the caller can render in "lab mode" with proper shapes/effects.
 */
export function getSkinVisualProps(skinId: string): SkinVisualProps | null {
  const pattern = skinPatternMap.get(skinId);
  if (!pattern) return null; // No pattern → simple solid skin

  const colors_data = skinColorMap.get(skinId);
  const colors = [colors_data?.color ?? '#22c55e'];
  if (colors_data?.secondaryColor) colors.push(colors_data.secondaryColor);

  const { bodyStyle, taperStyle, glow } = mapPatternToVisuals(pattern);
  return { colors, bodyStyle, taperStyle, glow };
}

/** Build a flat lookup: skinId → SkinPreset for fast preset resolution */
const presetLookupMap = new Map<string, SkinPreset>();
for (const p of SKIN_PRESETS) {
  presetLookupMap.set(p.id, p);
}

/**
 * Get visual props for a preset skin by its ID (e.g. 'preset-fish', 'preset-lion').
 * Returns null if the skinId is not a known preset.
 * Used by the fallback renderer to draw bots with their preset shapes/taper/glow/colors.
 */
export function getPresetVisualProps(skinId: string): SkinVisualProps | null {
  const preset = presetLookupMap.get(skinId);
  if (!preset) return null;
  return {
    colors: preset.colors,
    bodyStyle: preset.shape,
    taperStyle: preset.taper,
    glow: preset.glow,
  };
}

// ---------------------------------------------------------------------------
// PERF: Pre-rendered glow sprite cache
// ---------------------------------------------------------------------------
// Replaces ctx.shadowBlur (0.3-1.0ms per fill) with drawImage from a cached
// OffscreenCanvas (~0.001ms per drawImage). Eliminates the #1 rendering
// bottleneck that caused 200-660ms/frame when many glowing bots are nearby.

let _spriteDpr = 1;
export function setSpriteDpr(dpr: number): void { _spriteDpr = dpr; }

const _glowSpriteCache = new Map<string, OffscreenCanvas | HTMLCanvasElement>();
const _GLOW_CACHE_MAX = 256;

function colorAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getGlowSprite(color: string, r: number): OffscreenCanvas | HTMLCanvasElement {
  const rr = Math.round(r);
  const key = `${color}|${rr}`;
  let cached = _glowSpriteCache.get(key);
  if (cached) return cached;

  const dpr = _spriteDpr;
  const blurR = r * 1.8;
  const totalR = r + blurR;
  const diameter = Math.ceil(totalR * 2 * dpr) + 4;
  const oc = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(diameter, diameter)
    : document.createElement('canvas');
  if (!(oc instanceof OffscreenCanvas)) {
    (oc as HTMLCanvasElement).width = diameter;
    (oc as HTMLCanvasElement).height = diameter;
  }
  // TS: the union canvas type makes getContext return the broad RenderingContext
  // union (includes ImageBitmapRenderingContext) — narrow to the 2D contexts.
  const cx = oc.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  const center = diameter / (2 * dpr);
  cx.scale(dpr, dpr);

  // Layer 1: Soft radial glow (replaces shadowBlur)
  const glowGrad = cx.createRadialGradient(center, center, r * 0.8, center, center, totalR);
  glowGrad.addColorStop(0, colorAlpha(color, 0.45));
  glowGrad.addColorStop(0.5, colorAlpha(color, 0.15));
  glowGrad.addColorStop(1, colorAlpha(color, 0));
  cx.fillStyle = glowGrad;
  cx.beginPath();
  cx.arc(center, center, totalR, 0, Math.PI * 2);
  cx.fill();

  // Layer 2: 3D gradient circle (same visual as the original radialGradient)
  const grad = cx.createRadialGradient(
    center - r * 0.3, center - r * 0.3, r * 0.1,
    center, center, r * 1.1,
  );
  grad.addColorStop(0, lightenHex(color, 0.3));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, darkenHex(color, 0.3));
  cx.fillStyle = grad;
  cx.beginPath();
  cx.arc(center, center, r, 0, Math.PI * 2);
  cx.fill();

  // Evict old entries if cache is full
  if (_glowSpriteCache.size >= _GLOW_CACHE_MAX) {
    const firstKey = _glowSpriteCache.keys().next().value;
    if (firstKey !== undefined) _glowSpriteCache.delete(firstKey);
  }
  _glowSpriteCache.set(key, oc);
  return oc;
}

// ---------------------------------------------------------------------------
// drawSegmentShape — uses pre-rendered glow sprites instead of shadowBlur
// ---------------------------------------------------------------------------

export function drawSegmentShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  shape: SegShape,
  color: string,
  glowEnabled: boolean,
): void {
  const r = Math.max(radius, 1);

  // ── Ring: special semi-transparent shape ──
  if (shape === 'ring') {
    if (glowEnabled) {
      const sprite = getGlowSprite(color, r);
      const totalR = r + r * 1.8;
      ctx.globalAlpha = 0.4;
      ctx.drawImage(sprite, x - totalR, y - totalR, totalR * 2, totalR * 2);
      ctx.globalAlpha = 1.0;
    }
    const grad = ctx.createRadialGradient(
      x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.1,
    );
    grad.addColorStop(0, lightenHex(color, 0.3));
    grad.addColorStop(0.6, color);
    grad.addColorStop(1, darkenHex(color, 0.3));
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  // ── PERF: Circle + glow → single drawImage from pre-rendered sprite ──
  // This is the hot path: ~660 calls/frame for 30 visible glowing bots.
  // Each drawImage is ~0.001ms vs ~0.5ms with shadowBlur = 500× faster.
  if (glowEnabled && shape === 'circle') {
    const sprite = getGlowSprite(color, r);
    const totalR = r + r * 1.8;
    ctx.drawImage(sprite, x - totalR, y - totalR, totalR * 2, totalR * 2);
    return;
  }

  // ── Non-circle glow: draw glow sprite behind, then shape with gradient on top ──
  if (glowEnabled) {
    const sprite = getGlowSprite(color, r);
    const totalR = r + r * 1.8;
    ctx.drawImage(sprite, x - totalR, y - totalR, totalR * 2, totalR * 2);
  }

  // ── 3D radial gradient (fast without shadowBlur) ──
  const grad = ctx.createRadialGradient(
    x - r * 0.3, y - r * 0.3, r * 0.1,
    x, y, r * 1.1,
  );
  grad.addColorStop(0, lightenHex(color, 0.3));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, darkenHex(color, 0.3));
  ctx.fillStyle = grad;

  ctx.beginPath();

  const perpAngle = angle + Math.PI / 2;
  const backAngle = angle + Math.PI;

  switch (shape) {
    case 'circle': {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    }
    case 'spike': {
      ctx.moveTo(x + Math.cos(angle) * r * 1.6, y + Math.sin(angle) * r * 1.6);
      ctx.lineTo(x + Math.cos(perpAngle) * r * 1.0, y + Math.sin(perpAngle) * r * 1.0);
      ctx.lineTo(x + Math.cos(backAngle) * r * 0.3, y + Math.sin(backAngle) * r * 0.3);
      ctx.lineTo(x + Math.cos(perpAngle + Math.PI) * r * 1.0, y + Math.sin(perpAngle + Math.PI) * r * 1.0);
      ctx.closePath();
      break;
    }
    case 'square': {
      const fwd = r * 1.15;
      const side = r * 0.85;
      ctx.moveTo(x + Math.cos(angle) * fwd, y + Math.sin(angle) * fwd);
      ctx.lineTo(x + Math.cos(perpAngle) * side, y + Math.sin(perpAngle) * side);
      ctx.lineTo(x + Math.cos(backAngle) * fwd * 0.85, y + Math.sin(backAngle) * fwd * 0.85);
      ctx.lineTo(x + Math.cos(perpAngle + Math.PI) * side, y + Math.sin(perpAngle + Math.PI) * side);
      ctx.closePath();
      break;
    }
    case 'diamond': {
      const fwd = r * 1.4;
      const side = r * 0.8;
      ctx.moveTo(x + Math.cos(angle) * fwd, y + Math.sin(angle) * fwd);
      ctx.lineTo(x + Math.cos(perpAngle) * side, y + Math.sin(perpAngle) * side);
      ctx.lineTo(x + Math.cos(backAngle) * fwd * 0.6, y + Math.sin(backAngle) * fwd * 0.6);
      ctx.lineTo(x + Math.cos(perpAngle + Math.PI) * side, y + Math.sin(perpAngle + Math.PI) * side);
      ctx.closePath();
      break;
    }
    case 'star': {
      starPath(ctx, x, y, r * 1.3, r * 0.55, angle);
      break;
    }
    case 'hexagon': {
      hexPath(ctx, x, y, r * 1.3, angle);
      break;
    }
    case 'triangle': {
      ctx.moveTo(x + Math.cos(angle) * r * 1.5, y + Math.sin(angle) * r * 1.5);
      ctx.lineTo(x + Math.cos(perpAngle) * r * 0.9, y + Math.sin(perpAngle) * r * 0.9);
      ctx.lineTo(x + Math.cos(perpAngle + Math.PI) * r * 0.9, y + Math.sin(perpAngle + Math.PI) * r * 0.9);
      ctx.closePath();
      break;
    }
  }

  ctx.fill();
}
