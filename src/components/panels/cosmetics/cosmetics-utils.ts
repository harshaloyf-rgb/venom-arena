import type {
  BodyStyle,
  CustomSegment,
  CustomSkinState,
  SegShape,
  TaperStyle,
} from './cosmetics-types';
import { CUSTOM_SKIN_KEY } from './cosmetics-types';

// ---------------------------------------------------------------------------
// Shared shape-style resolution — maps BodyStyle → per-segment SegShape.
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
  if (shapeStyle === 'stellar')
    return index === 0 ? 'circle' : index % 2 === 1 ? 'star' : 'circle';
  if (shapeStyle === 'fortress') return 'hexagon';
  if (shapeStyle === 'stingray')
    return index === 0 ? 'circle' : 'triangle';
  if (shapeStyle === 'phantom') return index === 0 ? 'circle' : 'ring';
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
  if (index === 0) {
    switch (taperStyle) {
      case 'uniform': return 1.3;
      case 'natural': return 1.35;
      case 'wave':    return 1.3;
      case 'heavy':   return 1.6;
    }
  }
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
// drawSegmentShape — draws a single snake body segment with the given shape,
// 3D radial gradient, optional glow, and rotation to face the movement angle.
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
