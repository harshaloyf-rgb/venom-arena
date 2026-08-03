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
