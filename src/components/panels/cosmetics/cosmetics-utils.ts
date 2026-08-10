import type {
  BodyStyle,
  CustomSegment,
  CustomSkinState,
  SegShape,
  SlitherPreset,
  TaperStyle,
} from './cosmetics-types';
import { CUSTOM_SKIN_KEY, SLITHER_PRESETS } from './cosmetics-types';
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

/** Build a flat lookup: skinId → SlitherPreset for fast preset resolution */
const presetLookupMap = new Map<string, SlitherPreset>();
for (const p of SLITHER_PRESETS) {
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
// drawSegmentShape
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

  ctx.save();

  // Bioluminescent glow
  if (glowEnabled) {
    ctx.shadowBlur = r * 1.8;
    ctx.shadowColor = color;
  }

  // 3D radial gradient
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
      // Dramatic 4-point spike — much longer forward tip
      ctx.moveTo(
        x + Math.cos(angle) * r * 1.6,
        y + Math.sin(angle) * r * 1.6,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle) * r * 1.0,
        y + Math.sin(perpAngle) * r * 1.0,
      );
      ctx.lineTo(
        x + Math.cos(backAngle) * r * 0.3,
        y + Math.sin(backAngle) * r * 0.3,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle + Math.PI) * r * 1.0,
        y + Math.sin(perpAngle + Math.PI) * r * 1.0,
      );
      ctx.closePath();
      break;
    }
    case 'square': {
      // Wider rotated rectangle aligned with movement
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
      // Elongated diamond — more dramatic than before
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
      // 5-pointed star rotated to face movement direction
      starPath(ctx, x, y, r * 1.3, r * 0.55, angle);
      break;
    }
    case 'hexagon': {
      // Distinctly hexagonal — wider than circle
      hexPath(ctx, x, y, r * 1.3, angle);
      break;
    }
    case 'triangle': {
      // Forward-pointing triangle (arrowhead)
      ctx.moveTo(
        x + Math.cos(angle) * r * 1.5,
        y + Math.sin(angle) * r * 1.5,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle) * r * 0.9,
        y + Math.sin(perpAngle) * r * 0.9,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle + Math.PI) * r * 0.9,
        y + Math.sin(perpAngle + Math.PI) * r * 0.9,
      );
      ctx.closePath();
      break;
    }
    case 'ring': {
      // Phantom — semi-transparent ghostly circles
      ctx.globalAlpha = 0.35;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      // Bright outline to maintain shape visibility
      ctx.strokeStyle = color;
      ctx.lineWidth = r * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
  }

  ctx.fill();
  ctx.restore();
}
