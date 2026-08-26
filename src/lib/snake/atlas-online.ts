// ============================================================================
// Texture Atlas Skin Renderer — ONLINE mode ONLY.
// Editing this file does NOT affect offline mode.
// ============================================================================

import type {
  SkinAsset,
  SkinAtlas,
  AtlasRegion,
  SkinRarity,
  ParticleEmitterConfig,
} from './types';
import {
  SPRITE_SIZE,
  BODY_SEGMENT_COUNT,
  HEAD_SPRITE_SIZE,
  TAIL_SPRITE_SIZE,
  PATTERN_UV_SCALE,
  ATLAS_PADDING,
  LEGENDARY_GLOW_SIZE,
} from './config';
import type { IPathBuffer } from './pool';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse hex to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Clamp a value between min and max */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Lerp between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Lighten a hex color by factor (0–1) */
function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = clamp(factor, 0, 1);
  const nr = Math.round(r + (255 - r) * f);
  const ng = Math.round(g + (255 - g) * f);
  const nb = Math.round(b + (255 - b) * f);
  return `rgb(${nr},${ng},${nb})`;
}

/** Darken a hex color by factor (0–1) */
function darken(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = clamp(factor, 0, 1);
  const nr = Math.round(r * (1 - f));
  const ng = Math.round(g * (1 - f));
  const nb = Math.round(b * (1 - f));
  return `rgb(${nr},${ng},${nb})`;
}

// ─── SkinAtlasManager ───────────────────────────────────────────────────────

export class SkinAtlasManager {
  private atlases: Map<string, SkinAtlas> = new Map();

  /** Retrieve a cached atlas, or undefined */
  getAtlas(skinId: string): SkinAtlas | undefined {
    return this.atlases.get(skinId);
  }

  /** Pre-render and cache a full atlas for a skin asset */
  buildAtlas(asset: SkinAsset): SkinAtlas {
    const existing = this.atlases.get(asset.id);
    if (existing) return existing;

    const accent = asset.accentColor ?? '#ffffff';

    // Atlas layout: [HEAD][pad][BODY×N][pad][TAIL]
    const totalWidth =
      HEAD_SPRITE_SIZE +
      ATLAS_PADDING +
      BODY_SEGMENT_COUNT * (SPRITE_SIZE + ATLAS_PADDING) -
      ATLAS_PADDING +
      ATLAS_PADDING +
      TAIL_SPRITE_SIZE;
    const totalHeight = Math.max(HEAD_SPRITE_SIZE, SPRITE_SIZE, TAIL_SPRITE_SIZE);

    const canvas = new OffscreenCanvas(totalWidth, totalHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get OffscreenCanvas 2d context');

    // ── Head region ──
    const headRegion: AtlasRegion = {
      x: 0,
      y: Math.round((totalHeight - HEAD_SPRITE_SIZE) / 2),
      width: HEAD_SPRITE_SIZE,
      height: HEAD_SPRITE_SIZE,
    };
    this.renderHeadSprite(ctx, headRegion, asset.headColor, accent);

    // ── Body regions ──
    const bodyRegions: AtlasRegion[] = [];
    const bodyStartX = HEAD_SPRITE_SIZE + ATLAS_PADDING;
    for (let i = 0; i < BODY_SEGMENT_COUNT; i++) {
      const region: AtlasRegion = {
        x: bodyStartX + i * (SPRITE_SIZE + ATLAS_PADDING),
        y: Math.round((totalHeight - SPRITE_SIZE) / 2),
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
      };
      bodyRegions.push(region);
      this.renderBodySprite(
        ctx,
        region,
        asset.bodyColor,
        asset.headColor,
        accent,
        asset.pattern ?? 'solid',
        i,
      );
    }

    // ── Tail region ──
    const tailStartX =
      bodyStartX + BODY_SEGMENT_COUNT * (SPRITE_SIZE + ATLAS_PADDING);
    const tailRegion: AtlasRegion = {
      x: tailStartX + ATLAS_PADDING,
      y: Math.round((totalHeight - TAIL_SPRITE_SIZE) / 2),
      width: TAIL_SPRITE_SIZE,
      height: TAIL_SPRITE_SIZE,
    };
    this.renderTailSprite(ctx, tailRegion, asset.bodyColor, accent);

    const atlas: SkinAtlas = {
      skinId: asset.id,
      canvas,
      rarity: asset.rarity,
      head: headRegion,
      body: bodyRegions,
      tail: tailRegion,
    };

    this.atlases.set(asset.id, atlas);
    return atlas;
  }

  // ── Head sprite ─────────────────────────────────────────────────────────

  private renderHeadSprite(
    ctx: OffscreenCanvasRenderingContext2D,
    region: AtlasRegion,
    color: string,
    accent: string,
  ): void {
    const cx = region.x + region.width / 2;
    const cy = region.y + region.height / 2;
    const r = region.width / 2 - 4;

    // Base circle with 3D gradient
    const grad = ctx.createRadialGradient(
      cx - r * 0.3, cy - r * 0.3, r * 0.1,
      cx, cy, r,
    );
    grad.addColorStop(0, lighten(color, 0.35));
    grad.addColorStop(0.6, color);
    grad.addColorStop(1, darken(color, 0.3));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Accent ring
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes
    const eyeOffset = r * 0.35;
    const eyeR = r * 0.2;
    const pupilR = eyeR * 0.55;
    const forwardOffset = r * 0.25;

    for (const side of [-1, 1]) {
      const ex = cx + forwardOffset;
      const ey = cy + eyeOffset * side;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(ex + pupilR * 0.3, ey, pupilR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Tail sprite ─────────────────────────────────────────────────────────

  private renderTailSprite(
    ctx: OffscreenCanvasRenderingContext2D,
    region: AtlasRegion,
    color: string,
    accent: string,
  ): void {
    const cx = region.x + region.width / 2;
    const cy = region.y + region.height / 2;
    const r = region.width / 2 - 4;

    // Tapered tail (ellipse)
    const grad = ctx.createRadialGradient(
      cx - r * 0.2, cy - r * 0.2, r * 0.05,
      cx, cy, r,
    );
    grad.addColorStop(0, lighten(color, 0.25));
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, darken(color, 0.3));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.7, r, 0, 0, Math.PI * 2);
    ctx.fill();

    // Accent tip
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy, r * 0.15, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Body sprite ─────────────────────────────────────────────────────────

  private renderBodySprite(
    ctx: OffscreenCanvasRenderingContext2D,
    region: AtlasRegion,
    bodyColor: string,
    headColor: string,
    accent: string,
    pattern: SkinAsset['pattern'],
    segmentIndex: number,
  ): void {
    const cx = region.x + region.width / 2;
    const cy = region.y + region.height / 2;
    const r = region.width / 2 - 2;

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Base fill depends on pattern
    const p = pattern ?? 'solid';
    switch (p) {
      case 'solid':
        ctx.fillStyle = bodyColor;
        ctx.fillRect(region.x, region.y, region.width, region.height);
        break;

      case 'striped': {
        ctx.fillStyle = bodyColor;
        ctx.fillRect(region.x, region.y, region.width, region.height);
        const stripeW = (r * 2) / 5;
        ctx.fillStyle = accent;
        for (let s = 0; s < 5; s += 2) {
          const sx = region.x + s * stripeW;
          ctx.fillRect(sx, region.y, stripeW, region.height);
        }
        break;
      }

      case 'spotted': {
        ctx.fillStyle = bodyColor;
        ctx.fillRect(region.x, region.y, region.width, region.height);
        const spotR = r * 0.18;
        const spots = [
          [cx - r * 0.4, cy - r * 0.3],
          [cx + r * 0.3, cy + r * 0.2],
          [cx - r * 0.1, cy + r * 0.45],
          [cx + r * 0.5, cy - r * 0.4],
          [cx - r * 0.5, cy + r * 0.1],
        ];
        ctx.fillStyle = accent;
        for (const [sx, sy] of spots) {
          ctx.beginPath();
          ctx.arc(sx, sy, spotR, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'gradient': {
        const grad = ctx.createLinearGradient(region.x, region.y, region.x + region.width, region.y + region.height);
        grad.addColorStop(0, bodyColor);
        grad.addColorStop(1, headColor);
        ctx.fillStyle = grad;
        ctx.fillRect(region.x, region.y, region.width, region.height);
        break;
      }

      case 'spiral': {
        ctx.fillStyle = bodyColor;
        ctx.fillRect(region.x, region.y, region.width, region.height);
        // Fibonacci golden ratio spiral overlay
        const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.399 rad
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        const spiralOffset = segmentIndex * 0.5;
        for (let t = 0; t < 300; t++) {
          const theta = t * 0.1 + spiralOffset;
          const spiralR = 2 + t * 0.08;
          if (spiralR > r) break;
          const sx = cx + Math.cos(theta) * spiralR;
          const sy = cy + Math.sin(theta) * spiralR;
          if (t === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        // Golden ratio dots
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 12; i++) {
          const a = i * goldenAngle + segmentIndex;
          const dr = Math.sqrt(i / 12) * r * 0.8;
          const dx = cx + Math.cos(a) * dr;
          const dy = cy + Math.sin(a) * dr;
          ctx.beginPath();
          ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'cyber': {
        ctx.fillStyle = darken(bodyColor, 0.6);
        ctx.fillRect(region.x, region.y, region.width, region.height);
        // Circuit board lines
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        const gridStep = 8 * PATTERN_UV_SCALE;
        for (let gx = region.x + gridStep; gx < region.x + region.width; gx += gridStep) {
          const jitter = ((segmentIndex * 3 + Math.floor(gx)) % 5) * 2;
          ctx.beginPath();
          ctx.moveTo(gx, cy - r * 0.6);
          ctx.lineTo(gx, cy - r * 0.1);
          ctx.lineTo(gx + jitter, cy);
          ctx.stroke();
        }
        for (let gy = region.y + gridStep; gy < region.y + region.height; gy += gridStep) {
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.3, gy);
          ctx.lineTo(cx + r * 0.5, gy);
          ctx.stroke();
        }
        // Nodes
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        const nodes = [
          [cx, cy - r * 0.5],
          [cx + r * 0.4, cy],
          [cx - r * 0.2, cy + r * 0.4],
        ];
        for (const [nx, ny] of nodes) {
          ctx.beginPath();
          ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'lava': {
        // Dark base
        ctx.fillStyle = darken(bodyColor, 0.5);
        ctx.fillRect(region.x, region.y, region.width, region.height);
        // Flowing lava blobs
        const lavaColors = [bodyColor, accent, '#ff4400', '#ffaa00'];
        ctx.globalAlpha = 0.6;
        for (let li = 0; li < 6; li++) {
          const seed = segmentIndex * 7 + li * 13;
          const bx = cx + Math.sin(seed) * r * 0.5;
          const by = cy + Math.cos(seed * 1.3) * r * 0.5;
          const br = r * (0.2 + (li % 3) * 0.1);
          const grad2 = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          grad2.addColorStop(0, lavaColors[li % lavaColors.length]);
          grad2.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad2;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'pulse': {
        // Concentric rings
        ctx.fillStyle = bodyColor;
        ctx.fillRect(region.x, region.y, region.width, region.height);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        const ringCount = 4;
        for (let ri = 1; ri <= ringCount; ri++) {
          const ringR = (r / (ringCount + 1)) * ri;
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }

      default:
        ctx.fillStyle = bodyColor;
        ctx.fillRect(region.x, region.y, region.width, region.height);
        break;
    }

    // 3D gradient overlay: lighter top-left, darker bottom-right
    const overlay = ctx.createLinearGradient(region.x, region.y, region.x + region.width, region.y + region.height);
    overlay.addColorStop(0, 'rgba(255,255,255,0.18)');
    overlay.addColorStop(0.45, 'rgba(255,255,255,0)');
    overlay.addColorStop(0.55, 'rgba(0,0,0,0)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = overlay;
    ctx.fillRect(region.x, region.y, region.width, region.height);

    ctx.restore();
  }

  // ── Epic animation effects (called per frame) ─────────────────────────

  /**
   * Apply an epic animation effect to canvas state before drawing a sprite.
   * Returns cleanup function or void.
   */
  applyEpicEffect(
    ctx: CanvasRenderingContext2D,
    animation: string,
    time: number,
    cx: number,
    cy: number,
    spriteSize: number,
    color: string,
  ): void {
    switch (animation) {
      case 'pulse': {
        const scale = 1 + 0.08 * Math.sin(time * 4);
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
        break;
      }
      case 'flow': {
        const [r, g, b] = hexToRgb(color);
        const shift = Math.sin(time * 2) * 0.5 + 0.5;
        const nr = Math.round(lerp(r, 255, shift * 0.3));
        const ng = Math.round(lerp(g, 255, shift * 0.15));
        const nb = Math.round(lerp(b, 255, shift * 0.3));
        ctx.filter = `hue-rotate(${shift * 30}deg) brightness(${1 + shift * 0.15})`;
        // Store for potential restore
        break;
      }
      case 'glow': {
        const intensity = 0.3 + 0.2 * Math.sin(time * 3);
        const glowR = spriteSize / 2 + LEGENDARY_GLOW_SIZE;
        const [r, g, b] = hexToRgb(color);
        ctx.save();
        ctx.globalAlpha = intensity;
        const glowGrad = ctx.createRadialGradient(cx, cy, spriteSize / 4, cx, cy, glowR);
        glowGrad.addColorStop(0, `rgba(${r},${g},${b},0.6)`);
        glowGrad.addColorStop(0.5, `rgba(${r},${g},${b},0.2)`);
        glowGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'lava': {
        const cycle = (Math.sin(time * 1.5) + 1) / 2; // 0–1
        const lr = Math.round(lerp(180, 255, cycle));
        const lg = Math.round(lerp(40, 120, cycle));
        const lb = Math.round(lerp(0, 20, cycle));
        ctx.shadowColor = `rgb(${lr},${lg},${lb})`;
        ctx.shadowBlur = 12 + cycle * 8;
        break;
      }
      case 'cyberpulse': {
        const flash = Math.sin(time * 8) > 0.7 ? 0.4 : 0;
        if (flash > 0) {
          ctx.save();
          ctx.globalAlpha = flash;
          ctx.fillStyle = '#00ccff';
          const s = spriteSize / 2 + LEGENDARY_GLOW_SIZE * 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, s, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
    }
  }

  /** Reset any per-frame canvas state set by applyEpicEffect */
  resetEpicEffect(ctx: CanvasRenderingContext2D): void {
    ctx.filter = 'none';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // ── Legendary particle emitter ──────────────────────────────────────────

  private lastEmitTime: number = 0;
  private emitAccumulator: number = 0;

  /**
   * Emit trailing particles behind a legendary snake.
   * Returns array of particle descriptors to render.
   */
  emitParticles(
    path: IPathBuffer,
    angle: number,
    time: number,
    config: ParticleEmitterConfig,
  ): Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; radius: number; color: string }> {
    const dt = time - this.lastEmitTime;
    this.lastEmitTime = time;
    if (dt <= 0 || path.length === 0) return [];

    this.emitAccumulator += dt * config.rate;
    const count = Math.floor(this.emitAccumulator);
    this.emitAccumulator -= count;
    if (count <= 0) return [];

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      life: number; maxLife: number; radius: number; color: string;
    }> = [];

    const headX = path.headX;
    const headY = path.headY;
    const backAngle = angle + Math.PI; // behind the snake

    for (let i = 0; i < count; i++) {
      const spreadAngle = backAngle + (Math.random() - 0.5) * config.spread;
      const speed = config.speed * (0.5 + Math.random() * 0.5);
      particles.push({
        x: headX + (Math.random() - 0.5) * 6,
        y: headY + (Math.random() - 0.5) * 6,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed + config.gravity,
        life: config.lifetime,
        maxLife: config.lifetime,
        radius: config.radius * (0.6 + Math.random() * 0.4),
        color: config.color,
      });
    }

    return particles;
  }

  /** Update and return alive particles from a live particle pool */
  updateParticles(
    liveParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; radius: number; color: string }>,
    dt: number,
  ): Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; radius: number; color: string }> {
    for (let i = liveParticles.length - 1; i >= 0; i--) {
      const p = liveParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        liveParticles.splice(i, 1);
      }
    }
    return liveParticles;
  }
}

// ─── Default particle emitter config per rarity ────────────────────────────

const LEGENDARY_EMITTER_CONFIG: ParticleEmitterConfig = {
  rate: 30,
  speed: 40,
  lifetime: 0.8,
  radius: 3,
  color: '#fbbf24',
  spread: Math.PI * 0.6,
  gravity: -30,
};

export { LEGENDARY_EMITTER_CONFIG };

// ─── 10 Default Skin Assets ─────────────────────────────────────────────────

export const DEFAULT_SKINS: SkinAsset[] = [
  {
    id: 'skin-viper-green',
    name: 'Viper Green',
    rarity: 'common',
    bodyColor: '#22c55e',
    headColor: '#16a34a',
    accentColor: '#86efac',
    pattern: 'solid',
    animation: 'none',
  },
  {
    id: 'skin-coral-red',
    name: 'Coral Red',
    rarity: 'common',
    bodyColor: '#ef4444',
    headColor: '#dc2626',
    accentColor: '#fca5a5',
    pattern: 'striped',
    animation: 'none',
  },
  {
    id: 'skin-ocean-blue',
    name: 'Ocean Blue',
    rarity: 'common',
    bodyColor: '#0ea5e9',
    headColor: '#0284c7',
    accentColor: '#7dd3fc',
    pattern: 'spotted',
    animation: 'none',
  },
  {
    id: 'skin-royal-purple',
    name: 'Royal Purple',
    rarity: 'rare',
    bodyColor: '#a855f7',
    headColor: '#9333ea',
    accentColor: '#d8b4fe',
    pattern: 'gradient',
    animation: 'none',
  },
  {
    id: 'skin-golden',
    name: 'Golden',
    rarity: 'rare',
    bodyColor: '#eab308',
    headColor: '#ca8a04',
    accentColor: '#fef08a',
    pattern: 'spiral',
    animation: 'none',
  },
  {
    id: 'skin-shadow',
    name: 'Shadow',
    rarity: 'rare',
    bodyColor: '#374151',
    headColor: '#1f2937',
    accentColor: '#9ca3af',
    pattern: 'striped',
    animation: 'none',
  },
  {
    id: 'skin-neon-pink',
    name: 'Neon Pink',
    rarity: 'epic',
    bodyColor: '#ec4899',
    headColor: '#db2777',
    accentColor: '#f9a8d4',
    pattern: 'pulse',
    animation: 'pulse',
  },
  {
    id: 'skin-arctic',
    name: 'Arctic',
    rarity: 'epic',
    bodyColor: '#67e8f9',
    headColor: '#22d3ee',
    accentColor: '#cffafe',
    pattern: 'gradient',
    animation: 'flow',
  },
  {
    id: 'skin-lava-core',
    name: 'Lava Core',
    rarity: 'epic',
    bodyColor: '#dc2626',
    headColor: '#f97316',
    accentColor: '#fbbf24',
    pattern: 'lava',
    animation: 'lava',
  },
  {
    id: 'skin-cyber-phantom',
    name: 'Cyber Phantom',
    rarity: 'legendary',
    bodyColor: '#06b6d4',
    headColor: '#8b5cf6',
    accentColor: '#22d3ee',
    pattern: 'cyber',
    animation: 'cyberpulse',
    hasParticles: true,
  },
];
