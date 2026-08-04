// ============================================================================
// Venom Arena — Texture Atlas Manager
// Pre-renders skin sprites to offscreen canvases for fast drawImage() calls.
// Supports rarity tiers: common, rare, epic (animated), legendary (particles).
// ============================================================================

import type {
  SkinRarity,
  AtlasRegion,
  BodyStyle,
  HatType,
  ParticleEmitterConfig,
} from '@/lib/snake/types';
import { RARITY_CONFIG } from '@/lib/snake/types';

// ── Per-skin atlas data ───────────────────────────────────────────────────

interface SkinAtlasData {
  canvas: HTMLCanvasElement;
  head: AtlasRegion;
  bodyTile: AtlasRegion;
  tailCap: AtlasRegion;
  rarity: SkinRarity;
  primaryColor: string;
  secondaryColor: string;
  bodyStyle: BodyStyle;
  hat: HatType;
  animType?: 'pulse' | 'flow' | 'glow' | 'lava' | 'cyberpulse';
  headParticle?: ParticleEmitterConfig;
  tailParticle?: ParticleEmitterConfig;
}

// ── Color helpers (self-contained for offscreen rendering) ────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

function brighten(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(
    c.r + (255 - c.r) * amount,
    c.g + (255 - c.g) * amount,
    c.b + (255 - c.b) * amount,
  );
}

function darken(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(c.r * (1 - amount), c.g * (1 - amount), c.b * (1 - amount));
}

function lerpColor(hex1: string, hex2: string, t: number): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t,
  );
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color)));
  };
  return rgbToHex(f(0), f(8), f(4));
}

// ── Epic animation helpers ────────────────────────────────────────────────

function applyEpicBodyColor(
  color: string,
  animType: string,
  segIndex: number,
  time: number,
  secondaryColor: string,
): string {
  switch (animType) {
    case 'pulse': {
      const wave = Math.sin(time * 4 + segIndex * 0.3) * 0.3 + 0.7;
      const c = hexToRgb(color);
      return rgbToHex(c.r * wave, c.g * wave, c.b * wave);
    }
    case 'flow': {
      const hue = ((segIndex * 25) + time * 80) % 360;
      return hslToHex(hue, 80, 50);
    }
    case 'glow': {
      const intensity = Math.sin(time * 3 + segIndex * 0.5) * 0.5 + 0.5;
      return lerpColor(color, brighten(color, 0.6), intensity);
    }
    case 'lava': {
      const t = Math.sin(time * 2 + segIndex * 0.4) * 0.5 + 0.5;
      return lerpColor('#FF4500', '#FFD700', t);
    }
    case 'cyberpulse': {
      const pulse = Math.sin(time * 6 + segIndex * 0.8) * 0.5 + 0.5;
      return lerpColor(color, '#00E5FF', pulse * 0.7);
    }
    default:
      return color;
  }
}

// ── 3D sphere gradient (re-creates gradient.ts logic for offscreen canvas) ─

function create3DFill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  baseColor: string,
): void {
  const r = Math.max(1, radius);
  const lightOffset = 0.35;
  const hx = cx - r * lightOffset;
  const hy = cy - r * lightOffset;

  const gradient = ctx.createRadialGradient(hx, hy, r * 0.05, cx, cy, r);
  gradient.addColorStop(0, brighten(baseColor, 70 / 255));
  gradient.addColorStop(0.5, baseColor);
  gradient.addColorStop(1, darken(baseColor, 55 / 255));

  ctx.fillStyle = gradient;
}

// ── Shape drawing for atlas sprites ───────────────────────────────────────

type ShapeType = 'circle' | 'square' | 'diamond' | 'spike';

function drawShapeToAtlas(
  ctx: CanvasRenderingContext2D,
  shape: ShapeType,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  color: string,
): void {
  const r = Math.max(1, radius);
  ctx.save();

  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      create3DFill(ctx, cx, cy, r, color);
      ctx.fill();
      break;

    case 'square':
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const half = r * 0.9;
      ctx.beginPath();
      ctx.rect(-half, -half, half * 2, half * 2);
      create3DFill(ctx, 0, 0, r, color);
      ctx.fill();
      break;

    case 'diamond':
      ctx.translate(cx, cy);
      ctx.rotate(angle + Math.PI / 4);
      const dHalf = r * 0.8;
      ctx.beginPath();
      ctx.rect(-dHalf, -dHalf, dHalf * 2, dHalf * 2);
      create3DFill(ctx, 0, 0, r, color);
      ctx.fill();
      break;

    case 'spike': {
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const points = 5;
      const outerR = r;
      const innerR = r * 0.45;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? outerR : innerR;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      create3DFill(ctx, 0, 0, r, color);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

// ── Resolve shape for body style ──────────────────────────────────────────

const BODY_STYLE_SHAPES: Record<BodyStyle, ShapeType[]> = {
  smooth: ['circle'],
  dragon: ['circle', 'spike'],
  armored: ['circle', 'square'],
  crystal: ['circle', 'diamond'],
  obsidian: ['spike'],
  basilisk: ['diamond'],
};

function resolveShape(segIndex: number, bodyStyle: BodyStyle): ShapeType {
  const shapes = BODY_STYLE_SHAPES[bodyStyle];
  if (shapes.length === 1) return shapes[0];
  return shapes[segIndex % shapes.length];
}

// ── Epic animation type mapping ───────────────────────────────────────────

const RARITY_ANIM_MAP: Record<string, 'pulse' | 'flow' | 'glow' | 'lava' | 'cyberpulse'> = {
  pulse: 'pulse',
  neon: 'glow',
  glow: 'glow',
  rainbow: 'flow',
  cyber: 'cyberpulse',
  camo: 'lava',
  metallic: 'pulse',
};

// ── SkinAtlasManager ──────────────────────────────────────────────────────

export class SkinAtlasManager {
  private atlases: Map<string, HTMLCanvasElement> = new Map();
  private regions: Map<string, SkinAtlasData> = new Map();
  private animTime: number = 0;

  /** Head sprite size in pixels */
  readonly headSize: number;
  /** Body tile size in pixels */
  readonly tileSize: number;
  /** Tail cap size in pixels */
  readonly tailSize: number;

  constructor(
    headSize: number = 48,
    tileSize: number = 32,
    tailSize: number = 32,
  ) {
    this.headSize = headSize;
    this.tileSize = tileSize;
    this.tailSize = tailSize;
  }

  /**
   * Initialize atlas for a skin. Renders head tile, body tile, tail cap
   * to a single offscreen canvas.
   */
  initSkin(
    skinId: string,
    primaryColor: string,
    secondaryColor: string,
    rarity: SkinRarity,
    bodyStyle: BodyStyle,
    hat: HatType,
  ): void {
    // Layout: head (headSize) | body (tileSize) | tail (tailSize)
    const canvasW = this.headSize + this.tileSize + this.tailSize;
    const canvasH = Math.max(this.headSize, this.tileSize, this.tailSize);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const headCx = this.headSize / 2;
    const headCy = canvasH / 2;
    const headR = this.headSize / 2 - 2;

    const bodyCx = this.headSize + this.tileSize / 2;
    const bodyCy = canvasH / 2;
    const bodyR = this.tileSize / 2 - 2;

    const tailCx = this.headSize + this.tileSize + this.tailSize / 2;
    const tailCy = canvasH / 2;
    const tailR = this.tailSize / 2 - 2;

    // Clear to transparent
    ctx.clearRect(0, 0, canvasW, canvasH);

    // ── Draw head sprite ─────────────────────────────────────────────
    const headShape = bodyStyle === 'smooth' ? 'circle' : resolveShape(0, bodyStyle);
    drawShapeToAtlas(ctx, headShape, headCx, headCy, headR, 0, primaryColor);

    // ── Draw body tile (circle for maximum tiling compatibility) ──────
    drawShapeToAtlas(ctx, 'circle', bodyCx, bodyCy, bodyR, 0, primaryColor);

    // ── Draw tail cap ────────────────────────────────────────────────
    const tailColor = secondaryColor !== primaryColor
      ? lerpColor(primaryColor, secondaryColor, 0.5)
      : darken(primaryColor, 0.15);
    drawShapeToAtlas(ctx, 'circle', tailCx, tailCy, tailR, 0, tailColor);

    // ── Rarity-specific decorations ──────────────────────────────────
    if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
      // Add a subtle rim highlight for rare+
      const rimAlpha = rarity === 'legendary' ? 0.5 : rarity === 'epic' ? 0.35 : 0.2;
      const rimColor = RARITY_CONFIG[rarity].color;
      ctx.save();
      ctx.globalAlpha = rimAlpha;
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 2;

      // Head rim
      ctx.beginPath();
      ctx.arc(headCx, headCy, headR + 1, 0, Math.PI * 2);
      ctx.stroke();

      // Body rim
      ctx.beginPath();
      ctx.arc(bodyCx, bodyCy, bodyR + 1, 0, Math.PI * 2);
      ctx.stroke();

      // Tail rim
      ctx.beginPath();
      ctx.arc(tailCx, tailCy, tailR + 1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // ── Determine epic animation type ────────────────────────────────
    let animType: SkinAtlasData['animType'] = undefined;
    if (rarity === 'epic' || rarity === 'legendary') {
      animType = 'pulse'; // default; can be overridden by skin data
    }

    this.atlases.set(skinId, canvas);
    this.regions.set(skinId, {
      canvas,
      head: { x: 0, y: 0, w: this.headSize, h: canvasH },
      bodyTile: { x: this.headSize, y: 0, w: this.tileSize, h: canvasH },
      tailCap: { x: this.headSize + this.tileSize, y: 0, w: this.tailSize, h: canvasH },
      rarity,
      primaryColor,
      secondaryColor,
      bodyStyle,
      hat,
      animType,
    });
  }

  /** Check if a skin has been initialized */
  hasSkin(skinId: string): boolean {
    return this.regions.has(skinId);
  }

  /** Get the atlas canvas for a skin */
  getAtlas(skinId: string): HTMLCanvasElement | null {
    return this.atlases.get(skinId) ?? null;
  }

  /** Get region data for a skin */
  getRegions(skinId: string): SkinAtlasData | null {
    return this.regions.get(skinId) ?? null;
  }

  /** Get particle emitter config for legendary skin head */
  getHeadParticleConfig(skinId: string): ParticleEmitterConfig | undefined {
    return this.regions.get(skinId)?.headParticle;
  }

  /** Get particle emitter config for legendary skin tail */
  getTailParticleConfig(skinId: string): ParticleEmitterConfig | undefined {
    return this.regions.get(skinId)?.tailParticle;
  }

  /** Update animation time (call once per frame) */
  updateTime(time: number): void {
    this.animTime = time;
  }

  /**
   * Draw a head segment from the atlas.
   * Handles rotation, scaling, epic animations, and rarity glow.
   */
  drawHead(
    ctx: CanvasRenderingContext2D,
    skinId: string,
    x: number,
    y: number,
    radius: number,
    angle: number,
    _isPlayer: boolean,
    rarity: SkinRarity,
    time: number,
  ): void {
    const data = this.regions.get(skinId);
    if (!data) return;

    const { canvas, head } = data;
    const drawR = Math.max(1, radius);

    ctx.save();

    // Legendary glow underlay
    if (rarity === 'legendary') {
      ctx.shadowColor = RARITY_CONFIG.legendary.color;
      ctx.shadowBlur = 15 + Math.sin(time * 4) * 5;
      ctx.globalAlpha = RARITY_CONFIG.legendary.glowIntensity;
      ctx.beginPath();
      ctx.arc(x, y, drawR, 0, Math.PI * 2);
      ctx.fillStyle = data.primaryColor;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Epic head glow
    if (rarity === 'epic') {
      ctx.shadowColor = RARITY_CONFIG.epic.color;
      ctx.shadowBlur = 8 + Math.sin(time * 3) * 4;
    }

    // Rare subtle glow
    if (rarity === 'rare') {
      ctx.shadowColor = RARITY_CONFIG.rare.color;
      ctx.shadowBlur = 6;
    }

    // Draw rotated sprite
    ctx.translate(x, y);
    ctx.rotate(angle);
    const scale = (drawR * 2) / head.w;
    ctx.scale(scale, scale);
    ctx.drawImage(
      canvas,
      head.x, head.y, head.w, head.h,
      -head.w / 2, -head.h / 2, head.w, head.h,
    );

    ctx.restore();
  }

  /**
   * Draw a body segment from the atlas.
   * Applies epic animations (color shifts, pulsing) and rarity glow.
   */
  drawBody(
    ctx: CanvasRenderingContext2D,
    skinId: string,
    x: number,
    y: number,
    radius: number,
    angle: number,
    color: string,
    rarity: SkinRarity,
    segIndex: number,
    time: number,
  ): void {
    const data = this.regions.get(skinId);
    if (!data) return;

    const { canvas, bodyTile, animType, primaryColor, secondaryColor } = data;
    const drawR = Math.max(1, radius);

    ctx.save();

    // Epic animation: modify color or apply time-based effects
    if ((rarity === 'epic' || rarity === 'legendary') && animType) {
      const animColor = applyEpicBodyColor(
        primaryColor,
        animType,
        segIndex,
        time,
        secondaryColor,
      );

      // For animated colors, draw a colored circle with 3D shading
      // then overlay the atlas sprite with composite blending
      const shape = resolveShape(segIndex, data.bodyStyle);

      // Draw the animated color as base
      drawShapeToAtlas(ctx, shape, x, y, drawR, angle, animColor);

      // Overlay atlas texture for 3D shading detail
      if (animType !== 'flow') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.4;
      } else {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.3;
      }
    }

    // Legendary body glow
    if (rarity === 'legendary') {
      if (ctx.globalCompositeOperation === 'source-over') {
        ctx.shadowColor = RARITY_CONFIG.legendary.color;
        ctx.shadowBlur = 10 + Math.sin(time * 4 + segIndex * 0.5) * 4;
      }
    }

    // Draw the body tile sprite (unless already drawn for epic)
    const isEpicAnimated = (rarity === 'epic' || rarity === 'legendary') && animType;
    if (!isEpicAnimated) {
      ctx.translate(x, y);
      ctx.rotate(angle);
      const scale = (drawR * 2) / bodyTile.w;
      ctx.scale(scale, scale);
      ctx.drawImage(
        canvas,
        bodyTile.x, bodyTile.y, bodyTile.w, bodyTile.h,
        -bodyTile.w / 2, -bodyTile.h / 2, bodyTile.w, bodyTile.h,
      );
    } else {
      // Still draw atlas for 3D shading overlay
      ctx.translate(x, y);
      ctx.rotate(angle);
      const scale = (drawR * 2) / bodyTile.w;
      ctx.scale(scale, scale);
      ctx.drawImage(
        canvas,
        bodyTile.x, bodyTile.y, bodyTile.w, bodyTile.h,
        -bodyTile.w / 2, -bodyTile.h / 2, bodyTile.w, bodyTile.h,
      );
    }

    ctx.restore();
  }

  /**
   * Draw a tail cap from the atlas.
   */
  drawTail(
    ctx: CanvasRenderingContext2D,
    skinId: string,
    x: number,
    y: number,
    radius: number,
    angle: number,
    _color: string,
    rarity: SkinRarity,
  ): void {
    const data = this.regions.get(skinId);
    if (!data) return;

    const { canvas, tailCap } = data;
    const drawR = Math.max(1, radius);

    ctx.save();

    // Legendary glow
    if (rarity === 'legendary') {
      ctx.shadowColor = RARITY_CONFIG.legendary.color;
      ctx.shadowBlur = 12 + Math.sin(this.animTime * 4) * 5;
    }

    // Epic glow
    if (rarity === 'epic') {
      ctx.shadowColor = RARITY_CONFIG.epic.color;
      ctx.shadowBlur = 6;
    }

    ctx.translate(x, y);
    ctx.rotate(angle);
    const scale = (drawR * 2) / tailCap.w;
    ctx.scale(scale, scale);
    ctx.drawImage(
      canvas,
      tailCap.x, tailCap.y, tailCap.w, tailCap.h,
      -tailCap.w / 2, -tailCap.h / 2, tailCap.w, tailCap.h,
    );

    ctx.restore();
  }

  /**
   * Draw a legendary glow underlay for all segments (call before segment loop).
   */
  drawGlowUnderlay(
    ctx: CanvasRenderingContext2D,
    skinId: string,
    segments: Array<{ x: number; y: number; visualRadius: number }>,
    camera: { x: number; y: number; zoom: number },
    canvasW: number,
    canvasH: number,
    time: number,
  ): void {
    const data = this.regions.get(skinId);
    if (!data || data.rarity !== 'legendary') return;

    ctx.save();
    ctx.shadowColor = RARITY_CONFIG.legendary.color;
    ctx.shadowBlur = 20 + Math.sin(time * 3) * 8;
    ctx.globalAlpha = 0.3 + Math.sin(time * 2) * 0.1;

    for (const seg of segments) {
      const sx = (seg.x - camera.x) * camera.zoom + canvasW / 2;
      const sy = (seg.y - camera.y) * camera.zoom + canvasH / 2;
      const sr = seg.visualRadius * camera.zoom;
      if (sr < 0.5) continue;

      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = data.primaryColor;
      ctx.fill();
    }

    ctx.restore();
  }

  /** Get the epic animation type for a skin */
  getAnimType(skinId: string): string | undefined {
    return this.regions.get(skinId)?.animType;
  }

  /** Get rarity for a skin */
  getRarity(skinId: string): SkinRarity | null {
    return this.regions.get(skinId)?.rarity ?? null;
  }

  /** Clear all atlases (call on skin change) */
  clear(): void {
    this.atlases.clear();
    this.regions.clear();
  }

  /** Remove a single skin atlas */
  removeSkin(skinId: string): void {
    this.atlases.delete(skinId);
    this.regions.delete(skinId);
  }

  /** Get the number of cached skins */
  get size(): number {
    return this.regions.size;
  }
}
