'use client';

/**
 * BUILD-11 — `CosmeticsShop` panel.
 *
 * Faithful replica of `/upload/extracted/src/components/CosmeticsShop.tsx`
 * (1810 lines). Adapted to the BUILD-2 server-authoritative stack:
 *
 *  - Premium ALL_COSMETICS items use `POST /api/player/cosmetic` with
 *    `{ action: 'buy' | 'equip', skinId }` and `useAuth().refresh()` after.
 *  - 20 free SLITHER_PRESETS and the Genetic Pattern Lab custom skin are
 *    persisted to `localStorage['venom_custom_skin_state']` (the server
 *    has no concept of custom-skin segments; the GameCanvas reads this
 *    key client-side to render the live wiggle preview).
 *
 * All textual strings — the H2 title, the subtitle, the two view-mode tabs,
 * the 7 category filters, the 20 preset descriptions, every "Active/Locked/
 * Equipped/Equip X/Unlock (N Chips)" button label, the 4-step Pattern Lab,
 * the TryOnPreview overlay caption "LAB HOLO-PREVIEW (STEER TO TEST)" and
 * every toast message — are preserved verbatim from the original audit
 * (AUDIT-C section A).
 *
 * The LIVE moving skin preview (`<SkinsCanvasPreview>` — 180×80 canvas, 10
 * segments, 60fps `requestAnimationFrame` loop using the exact
 * `Math.sin(time - i * 0.42) * 9` wiggle formula) and the interactive
 * `<TryOnPreview>` (450×180 canvas, 26 segments, mouse-steerable with
 * auto-patrol fallback) are both reproduced character-for-character from
 * the original so the "real-time wiggling skin" feeling is identical.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Flame,
  Lock,
  Paintbrush,
  Palette,
  Plus,
  ShoppingBag,
  Sliders,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ALL_COSMETICS, type Skin } from '@/lib/game-config';
import {
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';

interface CosmeticsShopProps {
  onToast?: ToastFn;
}

// ---------------------------------------------------------------------------
// Palette (18 swatches) — exact from AUDIT-C A.1
// ---------------------------------------------------------------------------
const PALETTE_COLORS = [
  { name: 'Red Alert', hex: '#ef4444' },
  { name: 'Solar Orange', hex: '#f97316' },
  { name: 'Midas Gold', hex: '#f59e0b' },
  { name: 'Lime Venom', hex: '#84cc16' },
  { name: 'Acid Green', hex: '#22c55e' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Teal Void', hex: '#0d9488' },
  { name: 'Cyber Cyan', hex: '#06b6d4' },
  { name: 'Sky Blue', hex: '#0ea5e9' },
  { name: 'Sapphire', hex: '#3b82f6' },
  { name: 'Royal Indigo', hex: '#6366f1' },
  { name: 'Shadow Purple', hex: '#a855f7' },
  { name: 'Orchid Pink', hex: '#ec4899' },
  { name: 'Crimson', hex: '#dc2626' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Slate Gray', hex: '#64748b' },
  { name: 'Deep Carbon', hex: '#1e293b' },
  { name: 'Pitch Black', hex: '#090d16' },
];

// ---------------------------------------------------------------------------
// Custom skin segment shape — matches original `CustomSegment` interface.
// ---------------------------------------------------------------------------
type SegShape = 'circle' | 'square' | 'diamond' | 'spike';
interface CustomSegment {
  color: string;
  sizeScale: number;
  shape: SegShape;
  glow: boolean;
}

type BodyStyle =
  | 'smooth'
  | 'dragon'
  | 'armored'
  | 'crystal'
  | 'obsidian'
  | 'basilisk';
type TaperStyle = 'natural' | 'uniform' | 'wave' | 'heavy';

interface SlitherPreset {
  id: string;
  name: string;
  colors: string[];
  shape: BodyStyle;
  taper: TaperStyle;
  glow: boolean;
  emoji: string;
  category: 'Classic' | 'Cyber' | 'Flags';
  description: string;
}

// ---------------------------------------------------------------------------
// SLITHER_PRESETS (20 free presets) — exact from AUDIT-C C.3
// ---------------------------------------------------------------------------
const SLITHER_PRESETS: SlitherPreset[] = [
  {
    id: 'preset-fish',
    name: 'The Fish Snake',
    colors: ['#06b6d4', '#3b82f6', '#0ea5e9', '#0284c7'],
    shape: 'crystal',
    taper: 'wave',
    glow: true,
    emoji: '🐟',
    category: 'Cyber',
    description: 'Aquatic scales with hydrodynamic dorsal fins and bubble bioluminescence.',
  },
  {
    id: 'preset-lion',
    name: 'The Lion Snake',
    colors: ['#f59e0b', '#b45309', '#f97316', '#78350f'],
    shape: 'dragon',
    taper: 'heavy',
    glow: true,
    emoji: '🦁',
    category: 'Classic',
    description: 'Golden apex mane headpiece with furious amber predator scales.',
  },
  {
    id: 'preset-motorbike',
    name: 'The Motorbike Snake',
    colors: ['#3b82f6', '#090d16', '#64748b', '#090d16'],
    shape: 'armored',
    taper: 'heavy',
    glow: true,
    emoji: '🏍️',
    category: 'Cyber',
    description: 'Chrome exhaust head, asphalt dark body segments, and burnout smoke trail.',
  },
  {
    id: 'preset-coin',
    name: 'The Coin Snake',
    colors: ['#fbbf24', '#d97706', '#f59e0b', '#b45309'],
    shape: 'obsidian',
    taper: 'natural',
    glow: true,
    emoji: '🪙',
    category: 'Classic',
    description: 'Gold dollar medallion crown with stacked casino chip coin segments.',
  },
  {
    id: 'preset-bumblebee',
    name: 'Bumblebee stripe',
    colors: ['#f59e0b', '#090d16', '#f59e0b', '#090d16'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🐝',
    category: 'Classic',
    description: 'Classic yellow and black stripes reminiscent of a honey bee.',
  },
  {
    id: 'preset-patriot',
    name: 'Patriot Streamer',
    colors: ['#ef4444', '#ffffff', '#3b82f6', '#ffffff'],
    shape: 'smooth',
    taper: 'natural',
    glow: true,
    emoji: '🇺🇸',
    category: 'Flags',
    description: 'Brave red, white, and blue colors streaming in perfect unison.',
  },
  {
    id: 'preset-watermelon',
    name: 'Watermelon Slicer',
    colors: ['#22c55e', '#22c55e', '#ec4899', '#ec4899'],
    shape: 'smooth',
    taper: 'wave',
    glow: false,
    emoji: '🍉',
    category: 'Classic',
    description: 'Sweet pink flesh bordered by alternating deep forest green scales.',
  },
  {
    id: 'preset-tiger',
    name: 'Tiger Shifter',
    colors: ['#f97316', '#090d16', '#f97316', '#090d16'],
    shape: 'dragon',
    taper: 'natural',
    glow: false,
    emoji: '🐯',
    category: 'Classic',
    description: 'Dangerous orange and obsidian bands armed with body-tapering spikes.',
  },
  {
    id: 'preset-mint',
    name: 'Mint Candy',
    colors: ['#10b981', '#ffffff', '#10b981', '#ffffff'],
    shape: 'smooth',
    taper: 'uniform',
    glow: true,
    emoji: '🍬',
    category: 'Classic',
    description: 'Sweet spearmint and white swirl nodes radiating clean aura.',
  },
  {
    id: 'preset-rainbow-unicorn',
    name: 'Rainbow Unicorn',
    colors: ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#6366f1', '#a855f7'],
    shape: 'crystal',
    taper: 'wave',
    glow: true,
    emoji: '🦄',
    category: 'Classic',
    description: 'Full visible spectrum of pulsing diamond-crystal nodes.',
  },
  {
    id: 'preset-germany',
    name: 'Germany Banner',
    colors: ['#090d16', '#ef4444', '#f59e0b'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🇩🇪',
    category: 'Flags',
    description: 'Bold black, red, and golden stripes representing national pride.',
  },
  {
    id: 'preset-brazil',
    name: 'Brazil Samba',
    colors: ['#22c55e', '#f59e0b', '#3b82f6', '#22c55e'],
    shape: 'crystal',
    taper: 'natural',
    glow: true,
    emoji: '🇧🇷',
    category: 'Flags',
    description: 'Vibrant green and gold diamond nodes reflecting carnival energy.',
  },
  {
    id: 'preset-france',
    name: 'France Tricolore',
    colors: ['#3b82f6', '#ffffff', '#ef4444'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🇫🇷',
    category: 'Flags',
    description: 'Symmetric blue, white, and red bands of the French Republic.',
  },
  {
    id: 'preset-pride',
    name: 'Pride Rainbow',
    colors: ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'],
    shape: 'smooth',
    taper: 'uniform',
    glow: true,
    emoji: '🏳️‍🌈',
    category: 'Flags',
    description: 'Classic rainbow flags celebrating diversity and inclusion.',
  },
  {
    id: 'preset-solar',
    name: 'Solar Flare',
    colors: ['#f59e0b', '#f97316', '#ef4444', '#f97316'],
    shape: 'dragon',
    taper: 'heavy',
    glow: true,
    emoji: '🔥',
    category: 'Cyber',
    description: 'Armor scales colored in blazing gold, solar orange, and furnace red.',
  },
  {
    id: 'preset-cosmic',
    name: 'Cosmic Nebula',
    colors: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6'],
    shape: 'smooth',
    taper: 'wave',
    glow: true,
    emoji: '🌌',
    category: 'Cyber',
    description: 'Deep cosmic space colors with pulsing neon aurora bioluminescence.',
  },
  {
    id: 'preset-lava',
    name: 'Lava Dreadnought',
    colors: ['#ef4444', '#1e293b', '#ef4444', '#090d16'],
    shape: 'obsidian',
    taper: 'heavy',
    glow: true,
    emoji: '🌋',
    category: 'Cyber',
    description: 'Armored obsidian spikes interspaced with blistering crimson core nodes.',
  },
  {
    id: 'preset-tron',
    name: 'Tron Grid',
    colors: ['#06b6d4', '#090d16', '#06b6d4', '#090d16'],
    shape: 'armored',
    taper: 'uniform',
    glow: true,
    emoji: '💻',
    category: 'Cyber',
    description: 'Futuristic cyan lines on dark background representing grid patterns.',
  },
  {
    id: 'preset-mech',
    name: 'Gundam Mech',
    colors: ['#64748b', '#3b82f6', '#ffffff', '#f59e0b'],
    shape: 'dragon',
    taper: 'heavy',
    glow: true,
    emoji: '🤖',
    category: 'Cyber',
    description: 'Tactical ironclad grey plates accented with heavy yellow and blue rocket spikes.',
  },
  {
    id: 'preset-gold-dragon',
    name: 'Golden Dragon',
    colors: ['#f59e0b', '#dc2626', '#f59e0b', '#dc2626'],
    shape: 'dragon',
    taper: 'heavy',
    glow: true,
    emoji: '🐉',
    category: 'Classic',
    description: 'Shining royal gold armored spike scales fit for mythical emperors.',
  },
];

// ---------------------------------------------------------------------------
// generateCustomSegments — exact replica of original helper.
// ---------------------------------------------------------------------------
function generateCustomSegments(
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

    let shape: SegShape = 'circle';
    if (shapeStyle === 'smooth') {
      shape = 'circle';
    } else if (shapeStyle === 'dragon') {
      shape = i === 0 ? 'circle' : i % 2 === 1 ? 'spike' : 'circle';
    } else if (shapeStyle === 'armored') {
      shape = i === 0 ? 'circle' : i % 2 === 1 ? 'square' : 'circle';
    } else if (shapeStyle === 'crystal') {
      shape = i === 0 ? 'circle' : i % 2 === 1 ? 'diamond' : 'circle';
    } else if (shapeStyle === 'obsidian') {
      shape = 'spike';
    } else if (shapeStyle === 'basilisk') {
      shape = 'diamond';
    }

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
interface CustomSkinState {
  useCustomSkin: boolean;
  currentSkin: string; // preset id or 'custom-lab-skin'
  customSkinSegments: CustomSegment[];
}

const CUSTOM_SKIN_KEY = 'venom_custom_skin_state';

function readCustomSkinState(): CustomSkinState | null {
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
function readCustomSkinStateSafe(): CustomSkinState | null {
  if (typeof window === 'undefined') return null;
  return readCustomSkinState();
}

function writeCustomSkinState(state: CustomSkinState) {
  try {
    localStorage.setItem(CUSTOM_SKIN_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

// ---------------------------------------------------------------------------
// 1. REUSABLE REAL-TIME 60FPS SLITHERING SKIN PREVIEW
// ---------------------------------------------------------------------------
interface SkinsCanvasPreviewProps {
  colors: string[];
  pattern?: string;
  shapeStyle?: BodyStyle;
  glow?: boolean;
}

function SkinsCanvasPreview({
  colors,
  pattern,
  shapeStyle = 'smooth',
  glow = false,
}: SkinsCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let time = Math.random() * 100;

    const numSegments = 10;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < numSegments; i++) points.push({ x: 0, y: 0 });

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.07;

      // Grid background
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 15; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let i = 0; i < numSegments; i++) {
        const x = canvas.width - 24 - (i * (canvas.width - 48)) / (numSegments - 1);
        const wiggleVal = Math.sin(time - i * 0.42) * 9;
        const y = canvas.height / 2 + wiggleVal;
        points[i] = { x, y };
      }

      // Draw trailing segment shadows & nodes from tail to head
      for (let i = points.length - 1; i >= 1; i--) {
        const pt = points[i];
        const nextPt = points[i - 1] || pt;
        const segAngle = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x);

        let fillColor = colors[i % colors.length] || '#ffffff';
        let segmentGlow = glow;

        if (pattern === 'rainbow') {
          const hue = (Date.now() * 0.06 + i * 36) % 360;
          fillColor = `hsl(${hue}, 85%, 55%)`;
          segmentGlow = true;
        } else if (pattern === 'neon') {
          fillColor = i % 2 === 0 ? '#06b6d4' : '#a855f7';
          segmentGlow = true;
        } else if (pattern === 'metallic') {
          fillColor = i % 2 === 0 ? '#cbd5e1' : '#475569';
        } else if (pattern === 'camo') {
          fillColor = i % 2 === 0 ? '#15803d' : '#854d0e';
        }

        const sizeRatio = 1 - (i / points.length) * 0.42;
        const r = 6 * sizeRatio;

        ctx.save();
        if (segmentGlow) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = fillColor;
        }
        ctx.fillStyle = fillColor;

        let segmentShape: SegShape = 'circle';
        if (shapeStyle === 'dragon') {
          segmentShape = i % 2 === 1 ? 'spike' : 'circle';
        } else if (shapeStyle === 'armored') {
          segmentShape = i % 2 === 1 ? 'square' : 'circle';
        } else if (shapeStyle === 'crystal') {
          segmentShape = i % 2 === 1 ? 'diamond' : 'circle';
        } else if (shapeStyle === 'obsidian') {
          segmentShape = 'spike';
        } else if (shapeStyle === 'basilisk') {
          segmentShape = 'diamond';
        }

        ctx.beginPath();
        if (segmentShape === 'circle') {
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (segmentShape === 'square') {
          ctx.fillRect(pt.x - r, pt.y - r, r * 2, r * 2);
        } else if (segmentShape === 'diamond') {
          ctx.moveTo(pt.x, pt.y - r);
          ctx.lineTo(pt.x + r, pt.y);
          ctx.lineTo(pt.x, pt.y + r);
          ctx.lineTo(pt.x - r, pt.y);
          ctx.closePath();
          ctx.fill();
        } else if (segmentShape === 'spike') {
          const perpAngle = segAngle + Math.PI / 2;
          ctx.moveTo(
            pt.x + Math.cos(segAngle) * r * 1.3,
            pt.y + Math.sin(segAngle) * r * 1.3,
          );
          ctx.lineTo(
            pt.x + Math.cos(perpAngle) * r * 0.8,
            pt.y + Math.sin(perpAngle) * r * 0.8,
          );
          ctx.lineTo(
            pt.x - Math.cos(segAngle) * r * 0.3,
            pt.y - Math.sin(segAngle) * r * 0.3,
          );
          ctx.lineTo(
            pt.x - Math.cos(perpAngle) * r * 0.8,
            pt.y - Math.sin(perpAngle) * r * 0.8,
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Head
      const head = points[0];
      const prevPt = points[1] || head;
      const headAngle = Math.atan2(head.y - prevPt.y, head.x - prevPt.x);

      let headColor = colors[0] || '#ffffff';
      if (pattern === 'rainbow') {
        const hue = (Date.now() * 0.06) % 360;
        headColor = `hsl(${hue}, 85%, 55%)`;
      } else if (pattern === 'neon') {
        headColor = '#06b6d4';
      }

      ctx.save();
      ctx.fillStyle = headColor;
      if (glow) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = headColor;
      }
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Eyes
      const eyeL_Angle = headAngle + 0.52;
      const eyeR_Angle = headAngle - 0.52;
      const eyeL_Pos = {
        x: head.x + Math.cos(eyeL_Angle) * 3.8,
        y: head.y + Math.sin(eyeL_Angle) * 3.8,
      };
      const eyeR_Pos = {
        x: head.x + Math.cos(eyeR_Angle) * 3.8,
        y: head.y + Math.sin(eyeR_Angle) * 3.8,
      };

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeL_Pos.x, eyeL_Pos.y, 2, 0, Math.PI * 2);
      ctx.arc(eyeR_Pos.x, eyeR_Pos.y, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(
        eyeL_Pos.x + Math.cos(headAngle) * 0.6,
        eyeL_Pos.y + Math.sin(headAngle) * 0.6,
        1,
        0,
        Math.PI * 2,
      );
      ctx.arc(
        eyeR_Pos.x + Math.cos(headAngle) * 0.6,
        eyeR_Pos.y + Math.sin(headAngle) * 0.6,
        1,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [colors, pattern, shapeStyle, glow]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 p-1 group">
      <canvas
        ref={canvasRef}
        width={180}
        height={80}
        className="block max-w-full h-[80px] w-full"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. INTERACTIVE TRY-ON PLAYGROUND (steer with mouse)
// ---------------------------------------------------------------------------
interface TryOnPreviewProps {
  colors: string[];
  shapeStyle: BodyStyle;
  taperStyle: TaperStyle;
  glow: boolean;
}

function TryOnPreview({
  colors,
  shapeStyle,
  taperStyle,
  glow,
}: TryOnPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePos = useRef({ x: 220, y: 100 });
  const isHovered = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let time = 0;

    const numPoints = 26;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < numPoints; i++) points.push({ x: 220, y: 100 });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const handleMouseEnter = () => {
      isHovered.current = true;
    };
    const handleMouseLeave = () => {
      isHovered.current = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let headX = 220;
    let headY = 100;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.045;

      let targetX = canvas.width / 2 + Math.cos(time * 0.9) * 120;
      let targetY = canvas.height / 2 + Math.sin(time * 1.6) * 45;

      if (isHovered.current) {
        targetX = mousePos.current.x;
        targetY = mousePos.current.y;
      }

      const dx = targetX - headX;
      const dy = targetY - headY;
      const dist = Math.hypot(dx, dy);

      if (dist > 3) {
        const speed = isHovered.current ? 4.8 : 3.4;
        const angle = Math.atan2(dy, dx);
        headX += Math.cos(angle) * speed;
        headY += Math.sin(angle) * speed;
      }

      points.unshift({ x: headX, y: headY });
      if (points.length > numPoints) points.pop();

      // Grid scanlines
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Mouse radar ring
      if (isHovered.current) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.beginPath();
        ctx.arc(mousePos.current.x, mousePos.current.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Body segments
      for (let i = points.length - 1; i >= 1; i--) {
        const pt = points[i];
        const prevPt = points[i - 1] || pt;
        const segAngle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x);
        const perpAngle = segAngle + Math.PI / 2;

        const sizeRatio = 1 - (i / points.length) * 0.45;
        const color = colors[i % colors.length] || '#ffffff';

        let shape: SegShape = 'circle';
        if (shapeStyle === 'smooth') {
          shape = 'circle';
        } else if (shapeStyle === 'dragon') {
          shape = i % 2 === 1 ? 'spike' : 'circle';
        } else if (shapeStyle === 'armored') {
          shape = i % 2 === 1 ? 'square' : 'circle';
        } else if (shapeStyle === 'crystal') {
          shape = i % 2 === 1 ? 'diamond' : 'circle';
        } else if (shapeStyle === 'obsidian') {
          shape = 'spike';
        } else if (shapeStyle === 'basilisk') {
          shape = 'diamond';
        }

        let sizeScale = 1.0;
        if (taperStyle === 'uniform') {
          sizeScale = 1.0;
        } else if (taperStyle === 'natural') {
          sizeScale = Math.max(0.65, 1.25 - (i / points.length) * 0.55);
        } else if (taperStyle === 'wave') {
          sizeScale = 1.0 + Math.sin(i * 0.95) * 0.22;
        } else if (taperStyle === 'heavy') {
          sizeScale = Math.max(0.55, 1.35 - (i / points.length) * 0.8);
        }

        const r = 10 * sizeRatio * sizeScale;

        ctx.save();
        if (glow) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = color;
        }
        ctx.fillStyle = color;

        ctx.beginPath();
        if (shape === 'circle') {
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (shape === 'square') {
          ctx.fillRect(pt.x - r, pt.y - r, r * 2, r * 2);
        } else if (shape === 'diamond') {
          ctx.moveTo(pt.x, pt.y - r);
          ctx.lineTo(pt.x + r, pt.y);
          ctx.lineTo(pt.x, pt.y + r);
          ctx.lineTo(pt.x - r, pt.y);
          ctx.closePath();
          ctx.fill();
        } else if (shape === 'spike') {
          const spikeAngle = segAngle + Math.PI;
          ctx.moveTo(
            pt.x + Math.cos(segAngle) * r * 1.35,
            pt.y + Math.sin(segAngle) * r * 1.35,
          );
          ctx.lineTo(
            pt.x + Math.cos(perpAngle) * r * 0.95,
            pt.y + Math.sin(perpAngle) * r * 0.95,
          );
          ctx.lineTo(
            pt.x + Math.cos(spikeAngle) * r * 0.4,
            pt.y + Math.sin(spikeAngle) * r * 0.4,
          );
          ctx.lineTo(
            pt.x + Math.cos(perpAngle - Math.PI) * r * 0.95,
            pt.y + Math.sin(perpAngle - Math.PI) * r * 0.95,
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Head
      const head = points[0];
      const headColor = colors[0] || '#ffffff';
      ctx.save();
      if (glow) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = headColor;
      }
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Forked tongue
      if (Math.sin(Date.now() * 0.012) > 0.45) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const nextPt = points[1] || head;
        const headAngle = Math.atan2(head.y - nextPt.y, head.x - nextPt.x);
        const startX = head.x + Math.cos(headAngle) * 12;
        const startY = head.y + Math.sin(headAngle) * 12;
        const endX = startX + Math.cos(headAngle) * 8;
        const endY = startY + Math.sin(headAngle) * 8;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(
          endX + Math.cos(headAngle + 0.45) * 5,
          endY + Math.sin(headAngle + 0.45) * 5,
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX + Math.cos(headAngle - 0.45) * 5,
          endY + Math.sin(headAngle - 0.45) * 5,
        );
        ctx.stroke();
        ctx.restore();
      }

      // Eyes
      const nextPt = points[1] || head;
      const headAngle = Math.atan2(head.y - nextPt.y, head.x - nextPt.x);
      const eyeL = {
        x: head.x + Math.cos(headAngle + 0.45) * 6,
        y: head.y + Math.sin(headAngle + 0.45) * 6,
      };
      const eyeR = {
        x: head.x + Math.cos(headAngle - 0.45) * 6,
        y: head.y + Math.sin(headAngle - 0.45) * 6,
      };

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeL.x, eyeL.y, 2.8, 0, Math.PI * 2);
      ctx.arc(eyeR.x, eyeR.y, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(
        eyeL.x + Math.cos(headAngle) * 0.8,
        eyeL.y + Math.sin(headAngle) * 0.8,
        1.4,
        0,
        Math.PI * 2,
      );
      ctx.arc(
        eyeR.x + Math.cos(headAngle) * 0.8,
        eyeR.y + Math.sin(headAngle) * 0.8,
        1.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [colors, shapeStyle, taperStyle, glow]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-slate-950 p-1 shadow-2xl">
      <div className="absolute top-2 left-3 flex items-center gap-1.5 z-10 bg-slate-900/90 px-2 py-0.5 rounded border border-indigo-500/20 pointer-events-none select-none">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="text-[9px] text-indigo-300 font-mono font-bold uppercase tracking-wider">
          LAB HOLO-PREVIEW (STEER TO TEST)
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={450}
        height={180}
        className="block max-w-full h-[180px] w-full bg-slate-950/90 rounded-xl cursor-crosshair border border-slate-900 shadow-inner"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type ShopView = 'presets' | 'editor';
type CategoryFilter =
  | 'all'
  | 'presets'
  | 'premium'
  | 'trails'
  | 'deaths'
  | 'flags'
  | 'banners';

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: '🌈 All Items' },
  { id: 'presets', label: '🐍 Ready Presets (Free!)' },
  { id: 'premium', label: '✨ Premium Shop' },
  { id: 'trails', label: '💫 Laser Trails' },
  { id: 'deaths', label: '💥 Death Novas' },
  { id: 'flags', label: '🇺🇸 Flags' },
  { id: 'banners', label: '🏆 Profile Banners' },
];

const BODY_STYLE_OPTIONS: { id: BodyStyle; label: string; desc: string }[] = [
  { id: 'smooth', label: 'Smooth Circles', desc: 'Standard sleek nodes' },
  { id: 'dragon', label: 'Dragon Scales', desc: 'Alternating jagged spikes' },
  { id: 'armored', label: 'Armored Plates', desc: 'Futuristic squad blocks' },
  { id: 'crystal', label: 'Crystal Shards', desc: 'Alternating shiny gems' },
  { id: 'obsidian', label: 'Spiky Obsidian', desc: 'Full high-threat spikes' },
  { id: 'basilisk', label: 'Basilisk Diamonds', desc: 'Pointy royal nodes' },
];

const TAPER_OPTIONS: { id: TaperStyle; label: string }[] = [
  { id: 'natural', label: 'Natural Taper' },
  { id: 'uniform', label: 'Uniform Width' },
  { id: 'wave', label: 'Sinuous Wave' },
  { id: 'heavy', label: 'Heavy Head' },
];

export function CosmeticsShop({ onToast }: CosmeticsShopProps) {
  const { player, loading, refresh } = useAuth();
  const [shopView, setShopView] = useState<ShopView>('presets');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  // DNA Lab custom states — initialized lazily from localStorage on the
  // client so that the Lab tab reflects whatever the player last deployed.
  // (The lab tab is hidden by default, so any hydration delta between
  // SSR-default and client-stored values is invisible until interaction.)
  const [customState, setCustomState] = useState<CustomSkinState | null>(
    () => readCustomSkinStateSafe(),
  );
  const [colorSequence, setColorSequence] = useState<string[]>(() => {
    const stored = readCustomSkinStateSafe();
    if (stored?.customSkinSegments?.length) {
      return stored.customSkinSegments.map((s) => s.color);
    }
    return ['#06b6d4', '#a855f7', '#06b6d4', '#a855f7'];
  });
  const [bodyStyle, setBodyStyle] = useState<BodyStyle>(() => {
    const stored = readCustomSkinStateSafe();
    const segs = stored?.customSkinSegments;
    if (segs && segs.length > 0) {
      if (segs.every((s) => s.shape === 'circle')) return 'smooth';
      if (segs.every((s) => s.shape === 'spike')) return 'obsidian';
      if (segs.every((s) => s.shape === 'diamond')) return 'basilisk';
      if (segs.some((s) => s.shape === 'spike')) return 'dragon';
      if (segs.some((s) => s.shape === 'square')) return 'armored';
      if (segs.some((s) => s.shape === 'diamond')) return 'crystal';
    }
    return 'smooth';
  });
  const [taperStyle, setTaperStyle] = useState<TaperStyle>('natural');
  const [glowEnabled, setGlowEnabled] = useState<boolean>(() => {
    const stored = readCustomSkinStateSafe();
    if (stored?.customSkinSegments?.length) {
      return stored.customSkinSegments.some((s) => s.glow);
    }
    return true;
  });

  if (loading) return <PanelSkeleton count={6} height="h-44" />;
  if (!player) return <NotSignedIn />;

  // Bind to a const so TypeScript keeps the non-null narrowing inside the
  // closures below.
  const p = player;

  // -- helpers --------------------------------------------------------------
  // A manufactured skin is "active" only if no custom-skin (preset or DNA-lab)
  // is currently overriding the server's `currentSkin` field.
  const isSkinActive = (item: Skin) =>
    !customState?.useCustomSkin && p.currentSkin === item.id;

  const isPresetActive = (preset: SlitherPreset) =>
    customState?.useCustomSkin === true &&
    customState.currentSkin === preset.id;

  const isTrailActive = (item: Skin) => p.currentTrail === item.id;
  const isDeathActive = (item: Skin) => p.currentDeath === item.id;
  const isFlagActive = (item: Skin) => p.currentFlag === item.id;
  const isBannerActive = (item: Skin) => p.currentBanner === item.id;

  async function postCosmetic(action: 'buy' | 'equip', skinId: string) {
    try {
      const res = await fetch('/api/player/cosmetic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, skinId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify(data?.error || 'Action failed.', 'error', onToast);
        return false;
      }
      await refresh();
      return true;
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
      return false;
    }
  }

  // -- action handlers ------------------------------------------------------
  async function handleEquipManufacturedSkin(item: Skin) {
    const owned = p.unlockedSkins.includes(item.id);
    if (owned) {
      if (await postCosmetic('equip', item.id)) {
        // Clear custom-skin flag when equipping a manufactured skin
        if (customState?.useCustomSkin) {
          const next: CustomSkinState = {
            ...customState,
            useCustomSkin: false,
          };
          writeCustomSkinState(next);
          setCustomState(next);
        }
        notify(`Equipped Body Skin: ${item.name}`, 'success', onToast);
      }
    } else {
      if (p.bankedChips < item.cost) {
        notify(
          `You need ${item.cost} chips to unlock ${item.name}! Play matches to earn chips.`,
          'error',
          onToast,
        );
        return;
      }
      if (await postCosmetic('buy', item.id)) {
        if (customState?.useCustomSkin) {
          const next: CustomSkinState = {
            ...customState,
            useCustomSkin: false,
          };
          writeCustomSkinState(next);
          setCustomState(next);
        }
        notify(
          `Unlocked & Equipped ${item.name}! -${item.cost} CHIPS`,
          'success',
          onToast,
        );
      }
    }
  }

  function handleEquipSlitherPreset(preset: SlitherPreset) {
    const segments = generateCustomSegments(
      preset.colors,
      preset.shape,
      preset.taper,
      preset.glow,
    );
    const next: CustomSkinState = {
      useCustomSkin: true,
      currentSkin: preset.id,
      customSkinSegments: segments,
    };
    writeCustomSkinState(next);
    setCustomState(next);
    notify(
      `Injected DNA: ${preset.name}! Equipped in Battle Arena.`,
      'success',
      onToast,
    );
  }

  async function handleEquipTrail(item: Skin) {
    const owned = p.unlockedSkins.includes(item.id);
    if (owned) {
      if (await postCosmetic('equip', item.id)) {
        notify(`Equipped Trail Effect: ${item.name}`, 'success', onToast);
      }
    } else {
      if (p.bankedChips < item.cost) {
        notify(
          `You need ${item.cost} chips to unlock this trail!`,
          'error',
          onToast,
        );
        return;
      }
      if (await postCosmetic('buy', item.id)) {
        notify(
          `Unlocked & Equipped Trail: ${item.name}! -${item.cost} CHIPS`,
          'success',
          onToast,
        );
      }
    }
  }

  async function handleEquipDeathEffect(item: Skin) {
    const owned = p.unlockedSkins.includes(item.id);
    if (owned) {
      if (await postCosmetic('equip', item.id)) {
        notify(`Equipped Death Effect: ${item.name}`, 'success', onToast);
      }
    } else {
      if (p.bankedChips < item.cost) {
        notify(
          `You need ${item.cost} chips to unlock this death effect!`,
          'error',
          onToast,
        );
        return;
      }
      if (await postCosmetic('buy', item.id)) {
        notify(
          `Unlocked & Equipped Death Nova: ${item.name}! -${item.cost} CHIPS`,
          'success',
          onToast,
        );
      }
    }
  }

  async function handleEquipFlag(item: Skin) {
    const owned = p.unlockedSkins.includes(item.id);
    if (owned) {
      if (await postCosmetic('equip', item.id)) {
        notify(`Equipped Flag: ${item.name}`, 'success', onToast);
      }
    } else {
      if (p.bankedChips < item.cost) {
        notify(
          `You need ${item.cost} chips to unlock this flag!`,
          'error',
          onToast,
        );
        return;
      }
      if (await postCosmetic('buy', item.id)) {
        notify(
          `Unlocked & Equipped Flag: ${item.emoji} ${item.name}! -${item.cost} CHIPS`,
          'success',
          onToast,
        );
      }
    }
  }

  async function handleEquipBanner(item: Skin) {
    const owned = p.unlockedSkins.includes(item.id);
    if (owned) {
      if (await postCosmetic('equip', item.id)) {
        notify(`Equipped Profile Banner: ${item.name}`, 'success', onToast);
      }
    } else {
      if (p.bankedChips < item.cost) {
        notify(
          `You need ${item.cost} chips to unlock this profile banner!`,
          'error',
          onToast,
        );
        return;
      }
      if (await postCosmetic('buy', item.id)) {
        notify(
          `Unlocked & Equipped Profile Banner: ${item.name}! -${item.cost} CHIPS`,
          'success',
          onToast,
        );
      }
    }
  }

  // -- genetic lab handlers -------------------------------------------------
  function handleAppendColor(hex: string) {
    if (colorSequence.length >= 24) {
      notify('Maximum 24 segments in stripe pattern!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, hex]);
  }

  function handleRemoveColorAt(index: number) {
    if (colorSequence.length <= 1) {
      notify('Stripe sequence must have at least 1 color node!', 'error', onToast);
      return;
    }
    setColorSequence(colorSequence.filter((_, idx) => idx !== index));
  }

  function handleClearSequence() {
    setColorSequence(['#ffffff']);
    notify('Sequence reset.', 'info', onToast);
  }

  function handleDoublePattern() {
    if (colorSequence.length >= 12) {
      notify('Sequence too long to double!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, ...colorSequence]);
  }

  function handleMirrorPattern() {
    if (colorSequence.length >= 12) {
      notify('Sequence too long to mirror!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, ...[...colorSequence].reverse()]);
  }

  function handleRandomizePattern() {
    const categories: BodyStyle[] = [
      'smooth',
      'dragon',
      'armored',
      'crystal',
      'obsidian',
      'basilisk',
    ];
    const tapers: TaperStyle[] = ['natural', 'uniform', 'wave', 'heavy'];
    const colorsList = PALETTE_COLORS.map((c) => c.hex);

    const count = Math.floor(Math.random() * 3) + 2;
    const sequence: string[] = [];
    for (let i = 0; i < count; i++) {
      sequence.push(colorsList[Math.floor(Math.random() * colorsList.length)]);
    }

    setColorSequence(sequence);
    setBodyStyle(categories[Math.floor(Math.random() * categories.length)]);
    setTaperStyle(tapers[Math.floor(Math.random() * tapers.length)]);
    setGlowEnabled(Math.random() > 0.4);
    notify('Mutated new genetic chain!', 'success', onToast);
  }

  function handleDeployCustomSkin() {
    if (colorSequence.length === 0) {
      notify('Choose at least 1 color node before deploying!', 'error', onToast);
      return;
    }

    const segments = generateCustomSegments(
      colorSequence,
      bodyStyle,
      taperStyle,
      glowEnabled,
    );
    const next: CustomSkinState = {
      useCustomSkin: true,
      currentSkin: 'custom-lab-skin',
      customSkinSegments: segments,
    };
    writeCustomSkinState(next);
    setCustomState(next);
    notify(
      '🧪 Genetic Custom Segment deployed! Equipped in Battle Arena.',
      'success',
      onToast,
    );
  }

  // -- derived lists --------------------------------------------------------
  const manufacturedSkins = ALL_COSMETICS.filter((c) => c.type === 'skin');
  const trailCosmetics = ALL_COSMETICS.filter((c) => c.type === 'trail');
  const deathCosmetics = ALL_COSMETICS.filter((c) => c.type === 'death');
  const flagCosmetics = ALL_COSMETICS.filter((c) => c.type === 'flag');
  const bannerCosmetics = ALL_COSMETICS.filter((c) => c.type === 'banner');

  const showPresetsTab =
    activeCategory === 'all' || activeCategory === 'presets';
  const showPremiumTab =
    activeCategory === 'all' || activeCategory === 'premium';
  const showTrailsTab =
    activeCategory === 'all' || activeCategory === 'trails';
  const showDeathsTab =
    activeCategory === 'all' || activeCategory === 'deaths';
  const showFlagsTab = activeCategory === 'all' || activeCategory === 'flags';
  const showBannersTab =
    activeCategory === 'all' || activeCategory === 'banners';

  const isCustomLabDeployed =
    customState?.useCustomSkin === true &&
    customState.currentSkin === 'custom-lab-skin';

  return (
    <div
      id="cosmetics-shop"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
    >
      {/* Decor */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-400" /> Identity Workshop
            &amp; Skin Gallery
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Browse and equip real-time wiggling skins, luminous laser trails, or
            customize your own custom repeating venom snake DNA blueprint!
          </p>
        </div>

        {/* View-mode tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 w-fit shrink-0">
          <button
            type="button"
            onClick={() => setShopView('presets')}
            className={`px-4 py-2 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer ${
              shopView === 'presets'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎨 Skin &amp; Effect Gallery
          </button>
          <button
            type="button"
            onClick={() => setShopView('editor')}
            className={`px-4 py-2 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              shopView === 'editor'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🧬 Genetic Pattern Lab
          </button>
        </div>
      </div>

      {/* BODY */}
      {shopView === 'presets' ? (
        <div className="animate-fade-in">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                  activeCategory === tab.id
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-md font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Gallery grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* A. FREE SLITHER PRESETS */}
            {showPresetsTab &&
              SLITHER_PRESETS.map((preset) => {
                const active = isPresetActive(preset);
                return (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    active={active}
                    onClick={() => handleEquipSlitherPreset(preset)}
                  />
                );
              })}

            {/* B. PREMIUM MANUFACTURED SKINS */}
            {showPremiumTab &&
              manufacturedSkins.map((item) => {
                const unlocked = p.unlockedSkins.includes(item.id);
                const active = isSkinActive(item);
                const canAfford = p.bankedChips >= item.cost;
                return (
                  <SkinCard
                    key={item.id}
                    item={item}
                    unlocked={unlocked}
                    active={active}
                    canAfford={canAfford}
                    accent="emerald"
                    onClick={() => void handleEquipManufacturedSkin(item)}
                    equipLabel="Equip Skin"
                  />
                );
              })}

            {/* C. LASER TRAILS */}
            {showTrailsTab &&
              trailCosmetics.map((item) => (
                <TrailCard
                  key={item.id}
                  item={item}
                  unlocked={p.unlockedSkins.includes(item.id)}
                  active={isTrailActive(item)}
                  canAfford={p.bankedChips >= item.cost}
                  onClick={() => void handleEquipTrail(item)}
                />
              ))}

            {/* D. DEATH BURSTS */}
            {showDeathsTab &&
              deathCosmetics.map((item) => (
                <DeathCard
                  key={item.id}
                  item={item}
                  unlocked={p.unlockedSkins.includes(item.id)}
                  active={isDeathActive(item)}
                  canAfford={p.bankedChips >= item.cost}
                  onClick={() => void handleEquipDeathEffect(item)}
                />
              ))}

            {/* E. FLAGS */}
            {showFlagsTab &&
              flagCosmetics.map((item) => (
                <FlagCard
                  key={item.id}
                  item={item}
                  unlocked={p.unlockedSkins.includes(item.id)}
                  active={isFlagActive(item)}
                  canAfford={p.bankedChips >= item.cost}
                  onClick={() => void handleEquipFlag(item)}
                />
              ))}

            {/* F. BANNERS */}
            {showBannersTab &&
              bannerCosmetics.map((item) => (
                <BannerCard
                  key={item.id}
                  item={item}
                  unlocked={p.unlockedSkins.includes(item.id)}
                  active={isBannerActive(item)}
                  canAfford={p.bankedChips >= item.cost}
                  onClick={() => void handleEquipBanner(item)}
                />
              ))}
          </div>
        </div>
      ) : (
        /* GENETIC PATTERN LAB */
        <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN — TryOn preview + Projector card */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <TryOnPreview
              colors={colorSequence.length > 0 ? colorSequence : ['#ffffff']}
              shapeStyle={bodyStyle}
              taperStyle={taperStyle}
              glow={glowEnabled}
            />

            {/* Projector Details Card */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-inner">
              <span className="text-[9px] text-indigo-400 font-mono tracking-widest block uppercase font-extrabold mb-1">
                GENETIC PROFILE STATS
              </span>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-purple-400" /> Pattern DNA Engine
              </h3>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Your stripe nodes loop continuously as your snake grows in the
                arena. You can tweak color order, skin geometries, tapering
                physics, and aurora bioluminescence before deploying!
              </p>

              <div className="grid grid-cols-2 gap-2.5 mt-3 text-[10.5px] font-mono">
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500">NODES:</span>{' '}
                  <span className="text-purple-400 font-black">
                    {colorSequence.length} nodes
                  </span>
                </div>
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500">GLOW:</span>{' '}
                  <span
                    className={
                      glowEnabled
                        ? 'text-emerald-400 font-black'
                        : 'text-slate-500'
                    }
                  >
                    {glowEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeployCustomSkin}
                className={`w-full mt-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  isCustomLabDeployed
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950'
                    : 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500 hover:shadow-purple-500/20'
                }`}
              >
                {isCustomLabDeployed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-100 animate-bounce" />{' '}
                    DNA DEPLOYED &amp; EQUIPPED (ACTIVE)
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 text-purple-100" /> DEPLOY TO
                    BATTLE-ARENA
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN — 4-step editor */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* STEP 1 — Stripe sequence */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
              <div>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                  STEP 1
                </span>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Paintbrush className="w-4 h-4 text-indigo-400" /> Construct
                  Stripe Sequence
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Click any palette color below to append it to the tail
                  sequence.{' '}
                  <span className="text-indigo-400 font-semibold">
                    Click any crown node inside the wiggling strip to erase it.
                  </span>
                </p>
              </div>

              {/* Palette */}
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                {PALETTE_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => handleAppendColor(col.hex)}
                    title={`Add ${col.name}`}
                    className="aspect-square rounded-full border border-slate-800 hover:border-white hover:scale-110 active:scale-95 transition-all shadow cursor-pointer flex items-center justify-center group relative"
                    style={{ backgroundColor: col.hex }}
                  >
                    <Plus
                      className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition ${
                        col.hex === '#ffffff' || col.hex === '#f59e0b'
                          ? 'text-slate-950'
                          : 'text-white'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Active strip */}
              <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-xl flex items-center gap-1.5 overflow-x-auto min-h-[64px] max-w-full relative shadow-inner va-scroll">
                {colorSequence.map((col, idx) => (
                  <button
                    key={`${idx}-${col}`}
                    type="button"
                    onClick={() => handleRemoveColorAt(idx)}
                    title="Click to erase node"
                    className="w-8 h-8 rounded-full border border-slate-950/45 shrink-0 flex items-center justify-center relative cursor-pointer hover:border-red-500 hover:scale-105 active:scale-95 group transition"
                    style={{
                      backgroundColor: col,
                      boxShadow: `0 0 6px ${col}44`,
                    }}
                  >
                    <span
                      className={`${
                        col === '#ffffff' || col === '#f59e0b'
                          ? 'text-slate-950 font-black'
                          : 'text-white font-bold'
                      } text-[10px]`}
                    >
                      {idx === 0 ? '👑' : idx}
                    </span>
                    <span className="absolute inset-0 bg-red-600/90 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </span>
                  </button>
                ))}
              </div>

              {/* Helpers */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleDoublePattern}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" /> Double
                  Sequence Length
                </button>
                <button
                  type="button"
                  onClick={handleMirrorPattern}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />{' '}
                  Mirror Symmetrically
                </button>
                <button
                  type="button"
                  onClick={handleRandomizePattern}
                  className="px-3 py-1.5 bg-purple-950/20 hover:bg-purple-950/30 border border-purple-800/20 hover:border-purple-500/30 text-purple-300 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer ml-auto"
                >
                  🎲 Mutate DNA
                </button>
                <button
                  type="button"
                  onClick={handleClearSequence}
                  className="px-3 py-1.5 bg-rose-950/10 hover:bg-rose-950/25 border border-rose-800/20 hover:border-rose-500/30 text-rose-400 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* STEP 2 — Geometry */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col gap-3">
              <div>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                  STEP 2
                </span>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-400" /> Choose Segment
                  Geometry
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BODY_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setBodyStyle(style.id)}
                    className={`p-3 rounded-xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between ${
                      bodyStyle === style.id
                        ? 'bg-indigo-600/10 border-indigo-500 shadow shadow-indigo-950'
                        : 'bg-slate-900 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <span className="text-xs font-bold text-white block capitalize">
                      {style.label}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-snug">
                      {style.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* STEPS 3 & 4 — Taper + Glow */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Taper */}
              <div className="flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                    STEP 3
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Body Taper Physics
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                    Configure snake tail scaling density styles.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {TAPER_OPTIONS.map((tap) => (
                    <button
                      key={tap.id}
                      type="button"
                      onClick={() => setTaperStyle(tap.id)}
                      className={`py-2 px-2.5 rounded-lg border text-xs font-semibold font-sans text-center transition cursor-pointer ${
                        taperStyle === tap.id
                          ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tap.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Glow */}
              <div className="flex flex-col justify-between gap-3 border-t md:border-t-0 md:border-l border-slate-900 pt-4 md:pt-0 md:pl-6">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                    STEP 4
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Bioluminescent Aura
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                    Toggle active radioactive body node shading glow in battle
                    arenas.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-left">
                    <span className="text-xs font-bold text-white block">
                      Neon Glow
                    </span>
                    <span className="text-[10px] text-slate-400 block leading-tight">
                      Emit high-vis plasma light
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGlowEnabled(!glowEnabled)}
                    aria-pressed={glowEnabled}
                    aria-label="Toggle neon glow"
                    className={`w-11 h-6 rounded-full transition-all relative flex items-center p-1 cursor-pointer ${
                      glowEnabled ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 bg-white rounded-full shadow transition-all ${
                        glowEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card sub-components
// ---------------------------------------------------------------------------
function ActiveBadge({ accent }: { accent: 'indigo' | 'emerald' }) {
  const accentClass =
    accent === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
  return (
    <span
      className={`absolute top-2.5 right-2.5 ${accentClass} border text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 leading-none`}
    >
      <Check className="w-2.5 h-2.5" /> Active
    </span>
  );
}

function LockedBadge() {
  return (
    <span className="absolute top-2.5 right-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 leading-none">
      <Lock className="w-2.5 h-2.5 text-amber-400" /> Locked
    </span>
  );
}

function PresetCard({
  preset,
  active,
  onClick,
}: {
  preset: SlitherPreset;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active && <ActiveBadge accent="indigo" />}

      <div>
        <div className="mb-4">
          <SkinsCanvasPreview
            colors={preset.colors}
            shapeStyle={preset.shape}
            glow={preset.glow}
          />
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-base">{preset.emoji}</span>
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {preset.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {preset.description}
        </p>
      </div>

      <button
        type="button"
        tabIndex={-1}
        className={`w-full py-2 rounded-xl text-center text-xs font-bold transition-all uppercase pointer-events-none ${
          active
            ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20'
            : 'bg-slate-900 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white'
        }`}
      >
        {active ? 'Equipped' : 'Equip Preset'}
      </button>
    </div>
  );
}

function SkinCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
  equipLabel,
  accent,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
  equipLabel: string;
  accent: 'indigo' | 'emerald';
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? accent === 'emerald'
            ? 'border-emerald-500 shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-500/25 translate-y-[-2px]'
            : 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? (
        <ActiveBadge accent={accent} />
      ) : (
        !unlocked && <LockedBadge />
      )}

      <div>
        <div className="mb-4">
          <SkinsCanvasPreview
            colors={[item.color, item.secondaryColor || item.color]}
            pattern={item.pattern}
            shapeStyle="smooth"
            glow={
              item.pattern === 'glow' ||
              item.pattern === 'neon' ||
              item.pattern === 'rainbow'
            }
          />
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-base">{item.emoji}</span>
          <h3
            className={`text-sm font-bold text-white tracking-tight group-hover:text-${accent}-400 transition-colors`}
          >
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      {active ? (
        <button
          type="button"
          tabIndex={-1}
          className={`w-full py-2 rounded-xl text-center text-xs font-bold pointer-events-none uppercase ${
            accent === 'emerald'
              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
              : 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20'
          }`}
        >
          Equipped
        </button>
      ) : unlocked ? (
        <button
          type="button"
          tabIndex={-1}
          className={`w-full py-2 rounded-xl text-center text-xs font-bold pointer-events-none uppercase bg-slate-900 text-slate-300 group-hover:bg-${accent}-600 group-hover:text-white`}
        >
          {equipLabel}
        </button>
      ) : (
        <button
          type="button"
          tabIndex={-1}
          className={`w-full py-2 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 pointer-events-none ${
            canAfford
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-slate-950 font-black'
              : 'bg-slate-900/40 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Sparkles className="w-3 h-3 animate-pulse" /> Unlock ({item.cost}{' '}
          Chips)
        </button>
      )}
    </div>
  );
}

function TrailCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? <ActiveBadge accent="indigo" /> : !unlocked && <LockedBadge />}

      <div>
        <div className="h-[80px] bg-slate-900/45 rounded-xl border border-slate-800/40 flex items-center justify-center gap-1.5 mb-4 relative overflow-hidden">
          {[0, 1, 2, 3].map((val) => (
            <div
              key={val}
              className="w-2 h-2 rounded-full animate-ping shadow"
              style={{
                backgroundColor: item.color,
                animationDelay: `${val * 160}ms`,
                boxShadow: `0 0 10px ${item.color}, 0 0 20px ${item.color}`,
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-base">{item.emoji}</span>
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      <UnlockFooter
        active={active}
        unlocked={unlocked}
        canAfford={canAfford}
        cost={item.cost}
        equipLabel="Equip Trail"
      />
    </div>
  );
}

function DeathCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? <ActiveBadge accent="indigo" /> : !unlocked && <LockedBadge />}

      <div>
        <div className="h-[80px] bg-slate-900/45 rounded-xl border border-slate-800/40 flex items-center justify-center relative mb-4 overflow-hidden">
          <div className="w-5 h-5 rounded-full absolute bg-indigo-500/20 animate-ping" />
          <Flame
            className="w-6 h-6 transition-transform duration-300 group-hover:scale-125 z-10"
            style={{
              color: item.color,
              filter: `drop-shadow(0 0 10px ${item.color})`,
            }}
          />
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-base">{item.emoji}</span>
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      <UnlockFooter
        active={active}
        unlocked={unlocked}
        canAfford={canAfford}
        cost={item.cost}
        equipLabel="Equip Nova"
      />
    </div>
  );
}

function FlagCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? <ActiveBadge accent="indigo" /> : !unlocked && <LockedBadge />}

      <div>
        <div className="h-[80px] bg-slate-900/45 rounded-xl border border-slate-800/40 flex items-center justify-center relative mb-4 overflow-hidden">
          <span className="text-4xl transition-transform duration-300 group-hover:scale-125 z-10 select-none animate-bounce">
            {item.emoji}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      <UnlockFooter
        active={active}
        unlocked={unlocked}
        canAfford={canAfford}
        cost={item.cost}
        equipLabel="Equip Flag"
      />
    </div>
  );
}

function BannerCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? <ActiveBadge accent="indigo" /> : !unlocked && <LockedBadge />}

      <div>
        <div className="h-[80px] rounded-xl border border-slate-800/40 flex items-center justify-center relative mb-4 overflow-hidden bg-slate-900 p-2">
          <div
            className={`w-full h-8 rounded-lg bg-gradient-to-r ${item.color} flex items-center px-3 border shadow-inner`}
          >
            <div className="w-4 h-4 rounded-full bg-white/20 mr-2" />
            <div className="h-3 w-16 bg-white/20 rounded" />
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-base">{item.emoji}</span>
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      <UnlockFooter
        active={active}
        unlocked={unlocked}
        canAfford={canAfford}
        cost={item.cost}
        equipLabel="Equip Banner"
      />
    </div>
  );
}

function UnlockFooter({
  active,
  unlocked,
  canAfford,
  cost,
  equipLabel,
}: {
  active: boolean;
  unlocked: boolean;
  canAfford: boolean;
  cost: number;
  equipLabel: string;
}) {
  if (active) {
    return (
      <button
        type="button"
        tabIndex={-1}
        className="w-full py-2 rounded-xl text-center text-xs font-bold bg-indigo-950/40 text-indigo-400 border border-indigo-500/20 pointer-events-none uppercase"
      >
        Equipped
      </button>
    );
  }
  if (unlocked) {
    return (
      <button
        type="button"
        tabIndex={-1}
        className="w-full py-2 rounded-xl text-center text-xs font-bold bg-slate-900 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white pointer-events-none uppercase"
      >
        {equipLabel}
      </button>
    );
  }
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`w-full py-2 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 pointer-events-none ${
        canAfford
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-slate-950 font-black'
          : 'bg-slate-900/40 text-slate-500 cursor-not-allowed'
      }`}
    >
      <Sparkles className="w-3 h-3 animate-pulse" /> Unlock ({cost} Chips)
    </button>
  );
}

export default CosmeticsShop;
