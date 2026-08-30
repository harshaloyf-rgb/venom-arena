// ============================================================================
// Venom Arena — Skin Resolver
// Reads skinId / custom skin state and produces a ResolvedSkin for the renderer.
// ============================================================================

import type { BodyStyle, SkinPattern, SnakeIdentity } from './types';
import type { CustomSkinState, ResolvedSegment, ResolvedSkin } from './skin-types';
import { brighten, darken, neonGlow, resolveSegmentShape } from './skin-types';
import { getTaperFunction } from './skin-types';

// ── Read Custom Skin from localStorage (client only) ─────────────────────────

const CUSTOM_SKIN_KEY = 'venom_custom_skin_state';

export function readCustomSkinState(): CustomSkinState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomSkinState;
  } catch {
    return null;
  }
}

// ── Pattern Color Generators ──────────────────────────────────────────────────

function patternColor(
  pattern: SkinPattern,
  primaryColor: string,
  secondaryColor: string,
  segmentIndex: number,
  totalSegments: number,
  time: number,
): string {
  const t = segmentIndex / Math.max(1, totalSegments);

  switch (pattern) {
    case 'solid':
      return primaryColor;

    case 'rainbow': {
      const hue = ((segmentIndex * 25) + time * 60) % 360;
      return `hsl(${hue}, 85%, 55%)`;
    }

    case 'neon':
      return neonGlow(primaryColor, 0.8);

    case 'glow':
      return segmentIndex % 2 === 0
        ? brighten(primaryColor, 0.4)
        : primaryColor;

    case 'metallic':
      return segmentIndex % 3 === 0
        ? brighten(primaryColor, 0.6)
        : segmentIndex % 3 === 1
          ? primaryColor
          : darken(primaryColor, 0.2);

    case 'pulse': {
      const wave = Math.sin(t * Math.PI * 4 + time * 3) * 0.3 + 0.7;
      const r = parseInt(primaryColor.slice(1, 3), 16);
      const g = parseInt(primaryColor.slice(3, 5), 16);
      const b = parseInt(primaryColor.slice(5, 7), 16);
      const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * wave)));
      return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
    }

    case 'zebra':
      return segmentIndex % 2 === 0 ? primaryColor : secondaryColor;

    case 'camo': {
      const base = hexToRgb(primaryColor);
      const noise = Math.sin(segmentIndex * 3.7 + time) * 30;
      const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v + noise)));
      return `#${clamp(base.r).toString(16).padStart(2, '0')}${clamp(base.g).toString(16).padStart(2, '0')}${clamp(base.b).toString(16).padStart(2, '0')}`;
    }

    case 'cyber': {
      const isAccent = segmentIndex % 4 === 0;
      return isAccent ? '#00E5FF' : primaryColor;
    }

    default:
      return primaryColor;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ── Main Resolver ────────────────────────────────────────────────────────────

/**
 * Resolve a snake's skin into renderable segments.
 * Called every frame for each visible snake.
 */
export function resolveSkin(
  identity: SnakeIdentity,
  totalSegments: number,
  time: number,
): ResolvedSkin {
  const customState = identity.isPlayer ? readCustomSkinState() : null;

  // Check if player is using a custom lab skin
  if (customState?.useCustomSkin && identity.isPlayer) {
    return resolveCustomSkin(customState, totalSegments);
  }

  // Otherwise use preset/pattern-based skin
  return resolvePatternSkin(identity, totalSegments, time);
}

/**
 * Resolve a custom lab skin (from Genetic Pattern Lab).
 */
function resolveCustomSkin(
  customState: CustomSkinState,
  totalSegments: number,
): ResolvedSkin {
  const customSegs = customState.customSkinSegments;
  const segments: ResolvedSegment[] = [];
  let hasGlow = false;

  for (let i = 0; i < totalSegments; i++) {
    // Cycle through custom segments if there are fewer than totalSegments
    const src = customSegs[i % customSegs.length];
    const hasGlowSeg = src.glow;
    if (hasGlowSeg) hasGlow = true;

    segments.push({
      color: src.color,
      shape: src.shape,
      glow: hasGlowSeg,
      sizeScale: src.sizeScale,
    });
  }

  return { segments, hasGlow, pattern: 'custom' };
}

/**
 * Resolve a pattern-based skin (presets, premium, season pass).
 */
function resolvePatternSkin(
  identity: SnakeIdentity,
  totalSegments: number,
  time: number,
): ResolvedSkin {
  const { skinPattern, bodyStyle, primaryColor, secondaryColor } = identity;
  const taperFn = getTaperFunction(identity.taperStyle);
  const segments: ResolvedSegment[] = [];
  let hasGlow = false;

  for (let i = 0; i < totalSegments; i++) {
    const color = patternColor(
      skinPattern,
      primaryColor,
      secondaryColor,
      i,
      totalSegments,
      time,
    );
    const shape = resolveSegmentShape(i, bodyStyle);
    const isGlow = (skinPattern === 'neon' || skinPattern === 'glow') && i % 2 === 0;
    if (isGlow) hasGlow = true;

    segments.push({
      color,
      shape,
      glow: isGlow,
      sizeScale: taperFn(i, totalSegments, 1),
    });
  }

  return { segments, hasGlow, pattern: skinPattern };
}

// ── Resolve for Snapshot (server data, no localStorage) ─────────────────────

/**
 * Server-side / snapshot-based skin resolution.
 * For non-player snakes, we can't access localStorage.
 */
export function resolveSkinFromSnapshot(
  skinId: string,
  skinPattern: SkinPattern,
  bodyStyle: BodyStyle,
  taperStyle: BodyStyle extends string ? string : never,
  primaryColor: string,
  secondaryColor: string,
  totalSegments: number,
  time: number,
): ResolvedSkin {
  return resolvePatternSkin(
    {
      id: '',
      name: '',
      tag: '',
      isBot: false,
      skinId,
      skinPattern,
      bodyStyle,
      taperStyle: taperStyle as BodyStyle extends string ? any : never,
      hat: 'none',
      shape: 'circle',
      primaryColor,
      secondaryColor,
      trailId: '',
      deathBurstId: '',
      isPlayer: false,
    },
    totalSegments,
    time,
  );
}
