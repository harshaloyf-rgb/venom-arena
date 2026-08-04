// ============================================================================
// Venom Arena — Skin System Types
// Types for skin resolution. Renderer reads these to draw snakes.
// Compatible with existing cosmetics system (cosmetics-types.ts, localStorage).
// ============================================================================

import type { BodyStyle, SegmentShape, TaperStyle } from './types';

// ── Custom Skin State (localStorage) ─────────────────────────────────────────

/** A single custom segment with individual shape/color/scale/glow */
export interface CustomSegment {
  color: string;
  sizeScale: number;
  shape: SegmentShape;
  glow: boolean;
}

/** Persisted in localStorage['venom_custom_skin_state'] */
export interface CustomSkinState {
  useCustomSkin: boolean;
  currentSkin: string;
  customSkinSegments: CustomSegment[];
}

// ── Resolved Skin (what the renderer actually uses) ─────────────────────────

/** Shape resolution rules per body style */
export const BODY_STYLE_SHAPES: Record<BodyStyle, SegmentShape[]> = {
  smooth: ['circle'],
  dragon: ['circle', 'spike'],
  armored: ['circle', 'square'],
  crystal: ['circle', 'diamond'],
  obsidian: ['spike'],
  basilisk: ['diamond'],
};

/** Color sequence for a skin preset */
export interface SkinColorSequence {
  colors: string[];
  pattern: 'alternating' | 'gradient' | 'striped';
}

/** A fully resolved skin ready for rendering */
export interface ResolvedSkin {
  /** Per-segment resolved data (index 0 = head) */
  segments: ResolvedSegment[];
  /** Whether any segment has glow enabled */
  hasGlow: boolean;
  /** The pattern name for animation */
  pattern: string;
}

/** One resolved segment */
export interface ResolvedSegment {
  color: string;
  shape: SegmentShape;
  glow: boolean;
  sizeScale: number;
}

// ── 18-Color Palette (Genetic Lab) ──────────────────────────────────────────

export const GENETIC_PALETTE = [
  { name: 'Red Alert', hex: '#FF3B3B' },
  { name: 'Solar Orange', hex: '#FF8C00' },
  { name: 'Midas Gold', hex: '#FFD700' },
  { name: 'Lime Venom', hex: '#AAFF00' },
  { name: 'Acid Green', hex: '#66FF66' },
  { name: 'Emerald', hex: '#2ECC71' },
  { name: 'Teal Void', hex: '#1ABC9C' },
  { name: 'Cyber Cyan', hex: '#00E5FF' },
  { name: 'Sky Blue', hex: '#3498DB' },
  { name: 'Sapphire', hex: '#2980B9' },
  { name: 'Royal Indigo', hex: '#6C5CE7' },
  { name: 'Shadow Purple', hex: '#8E44AD' },
  { name: 'Orchid Pink', hex: '#E91E8C' },
  { name: 'Crimson', hex: '#C0392B' },
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Slate Gray', hex: '#7F8C8D' },
  { name: 'Deep Carbon', hex: '#2C3E50' },
  { name: 'Pitch Black', hex: '#000000' },
] as const;

// ── Taper Functions ──────────────────────────────────────────────────────────

export type TaperFn = (segmentIndex: number, totalSegments: number, baseRadius: number) => number;

/**
 * Returns the taper function for a given taper style.
 * Each function returns a sizeScale (0–1+) for the given segment index.
 */
export function getTaperFunction(style: TaperStyle): TaperFn {
  switch (style) {
    case 'natural':
      return (i, total) => {
        if (i === 0) return 1.0; // head
        const t = i / total;
        return 1.0 - Math.pow(t, 0.6); // smooth taper
      };
    case 'uniform':
      return () => 1.0;
    case 'wave':
      return (i, total) => {
        if (i === 0) return 1.0;
        const t = i / total;
        const base = 1.0 - Math.pow(t, 0.6);
        const wave = Math.sin(t * Math.PI * 4) * 0.15;
        return Math.max(0.3, base + wave);
      };
    case 'heavy':
      return (i, total) => {
        if (i === 0) return 1.3; // oversized head
        if (i <= 3) return 1.2 - (i * 0.05);
        const t = (i - 3) / (total - 3);
        return Math.max(0.3, 1.05 - Math.pow(t, 0.5));
      };
  }
}

// ── Shape Resolution ────────────────────────────────────────────────────────

/**
 * Resolve the actual SegmentShape for a given segment index and body style.
 * Alternating styles cycle through their shape arrays.
 */
export function resolveSegmentShape(
  segmentIndex: number,
  bodyStyle: BodyStyle,
): SegmentShape {
  const shapes = BODY_STYLE_SHAPES[bodyStyle];
  if (shapes.length === 1) return shapes[0];
  return shapes[segmentIndex % shapes.length];
}

// ── Hex Helpers ─────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

export function lerpColor(hex1: string, hex2: string, t: number): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t,
  );
}

export function brighten(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(
    c.r + (255 - c.r) * amount,
    c.g + (255 - c.g) * amount,
    c.b + (255 - c.b) * amount,
  );
}

export function darken(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(c.r * (1 - amount), c.g * (1 - amount), c.b * (1 - amount));
}

export function neonGlow(hex: string, intensity: number): string {
  return brighten(hex, 0.5 + intensity * 0.3);
}
