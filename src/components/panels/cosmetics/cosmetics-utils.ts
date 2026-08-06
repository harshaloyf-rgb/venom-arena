import type {
  BodyStyle,
  CustomSegment,
  CustomSkinState,
  SegShape,
  TaperStyle,
} from './cosmetics-types';
import { CUSTOM_SKIN_KEY } from './cosmetics-types';

// ---------------------------------------------------------------------------
// Shared shape-style resolution — eliminates 3x duplication across
// generateCustomSegments, SkinsCanvasPreview, and TryOnPreview.
// ---------------------------------------------------------------------------
export function resolveShapeStyle(
  shapeStyle: string,
  index: number,
): SegShape {
  if (shapeStyle === 'dragon')
    return index === 0 ? 'circle' : index % 2 === 1 ? 'spike' : 'circle';
  if (shapeStyle === 'armored')
    return index === 0 ? 'circle' : index % 2 === 1 ? 'square' : 'circle';
  if (shapeStyle === 'crystal')
    return index === 0 ? 'circle' : index % 2 === 1 ? 'diamond' : 'circle';
  if (shapeStyle === 'obsidian') return 'spike';
  if (shapeStyle === 'basilisk') return 'diamond';
  return 'circle'; // smooth or default
}

// ---------------------------------------------------------------------------
// generateCustomSegments — exact replica of original helper.
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
      sizeScale = i === 0 ? 1.3 : 1.0;
    } else if (taperStyle === 'natural') {
      sizeScale = i === 0 ? 1.35 : Math.max(0.65, 1.25 - (i / totalNodes) * 0.55);
    } else if (taperStyle === 'wave') {
      sizeScale = i === 0 ? 1.3 : 1.0 + Math.sin(i * 0.95) * 0.22;
    } else if (taperStyle === 'heavy') {
      sizeScale = i === 0 ? 1.6 : Math.max(0.55, 1.35 - (i / totalNodes) * 0.8);
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
// localStorage custom-skin persistence — read by GameCanvas client-side.
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

/**
 * SSR-safe variant — returns `null` during server rendering so lazy useState
 * initializers don't crash on `localStorage is not defined`.
 */
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
// Color helpers (shared across all renderers)
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
// computeTaperRadius — returns the size multiplier for a segment at a given
// index based on the taper style.  `totalSegments` is the total number of
// body segments (not counting the head).  Head (index 0) is handled specially.
// ---------------------------------------------------------------------------
export function computeTaperRadius(
  index: number,
  totalSegments: number,
  taperStyle: TaperStyle,
): number {
  if (index === 0) {
    // Head is always larger
    switch (taperStyle) {
      case 'uniform': return 1.3;
      case 'natural': return 1.35;
      case 'wave':    return 1.3;
      case 'heavy':   return 1.6;
    }
  }
  const t = index / totalSegments; // 0→1 from head to tail
  switch (taperStyle) {
    case 'uniform': return 1.0;
    case 'natural': return Math.max(0.65, 1.25 - t * 0.55);
    case 'wave':    return 1.0 + Math.sin(index * 0.95) * 0.22;
    case 'heavy':   return Math.max(0.55, 1.35 - t * 0.8);
  }
}

// ---------------------------------------------------------------------------
// drawSegmentShape — draws a single snake body segment with the given shape,
// 3D radial gradient, optional glow, and rotation to face the movement angle.
//
// Parameters:
//   ctx         — Canvas 2D context
//   x, y        — center of the segment
//   radius      — base radius (already includes taper scaling)
//   angle       — direction the snake is moving (radians)
//   shape       — 'circle' | 'spike' | 'square' | 'diamond'
//   color       — hex color of the segment
//   glowEnabled — whether to add a bioluminescent glow
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

  // Bioluminescent glow — soft colored shadow
  if (glowEnabled) {
    ctx.shadowBlur = r * 1.8;
    ctx.shadowColor = color;
  }

  // 3D radial gradient (highlight top-left, darken edges)
  const grad = ctx.createRadialGradient(
    x - r * 0.3, y - r * 0.3, r * 0.1,
    x, y, r,
  );
  grad.addColorStop(0, lightenHex(color, 0.3));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, darkenHex(color, 0.3));
  ctx.fillStyle = grad;

  ctx.beginPath();

  switch (shape) {
    case 'circle': {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    }
    case 'spike': {
      // Star/spike shape pointing forward (in the direction of `angle`)
      const perpAngle = angle + Math.PI / 2;
      const backAngle = angle + Math.PI;
      // 4-point spike: forward tip, two side points, back point
      ctx.moveTo(
        x + Math.cos(angle) * r * 1.35,
        y + Math.sin(angle) * r * 1.35,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle) * r * 0.95,
        y + Math.sin(perpAngle) * r * 0.95,
      );
      ctx.lineTo(
        x + Math.cos(backAngle) * r * 0.4,
        y + Math.sin(backAngle) * r * 0.4,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle + Math.PI) * r * 0.95,
        y + Math.sin(perpAngle + Math.PI) * r * 0.95,
      );
      ctx.closePath();
      break;
    }
    case 'square': {
      // Rotated square aligned with movement direction
      const perpAngle = angle + Math.PI / 2;
      const halfDiag = r * 1.1;
      ctx.moveTo(
        x + Math.cos(angle) * halfDiag,
        y + Math.sin(angle) * halfDiag,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle) * halfDiag * 0.72,
        y + Math.sin(perpAngle) * halfDiag * 0.72,
      );
      ctx.lineTo(
        x + Math.cos(angle + Math.PI) * halfDiag,
        y + Math.sin(angle + Math.PI) * halfDiag,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle + Math.PI) * halfDiag * 0.72,
        y + Math.sin(perpAngle + Math.PI) * halfDiag * 0.72,
      );
      ctx.closePath();
      break;
    }
    case 'diamond': {
      // Diamond / rhombus aligned with movement direction
      const perpAngle = angle + Math.PI / 2;
      const fwd = r * 1.2;
      const side = r * 0.75;
      ctx.moveTo(
        x + Math.cos(angle) * fwd,
        y + Math.sin(angle) * fwd,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle) * side,
        y + Math.sin(perpAngle) * side,
      );
      ctx.lineTo(
        x + Math.cos(angle + Math.PI) * fwd * 0.7,
        y + Math.sin(angle + Math.PI) * fwd * 0.7,
      );
      ctx.lineTo(
        x + Math.cos(perpAngle + Math.PI) * side,
        y + Math.sin(perpAngle + Math.PI) * side,
      );
      ctx.closePath();
      break;
    }
  }

  ctx.fill();
  ctx.restore();
}
