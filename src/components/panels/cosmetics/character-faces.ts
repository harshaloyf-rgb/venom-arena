// ============================================================================
// Character Faces — PREMIUM exclusive snake heads (2026-09-03 design batch)
// ============================================================================
// Code-drawn canvas vector faces for premium-shop-only skins. These are
// ORIGINAL cartoon designs (generic animals / archetypes) — deliberately NOT
// based on any copyrighted character, so the store is IP-safe.
//
// Design contract (mirrors the game renderer):
//  - drawCharacterFace() is called AFTER the head circle is filled, in SCREEN
//    space. It translates to (hx, hy), rotates to `facing`, then draws in a
//    LOCAL space where the head is a circle of radius `r` centered at the
//    origin and the snake faces +x (right).
//  - All features stay INSIDE the head circle so the exact same face renders
//    identically in all three consumers: the atlas-baked head sprite
//    (lib/snake/atlas.ts renderHeadSprite), the game fallback renderer
//    (render-snake-atlas.tsx), and GameSnakePreview.
//  - A character face REPLACES the default responsive eyes (each face draws
//    its own eyes). Hat/ear cosmetics still overlay on top by the callers.
//
// Pricing/rarity for the skins that use these faces lives in game-config.ts
// (Skin.headStyle links a Skin entry to a face id here).
// ============================================================================

import { ALL_COSMETICS } from '@/lib/game-config';

type FaceCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type FaceDrawFn = (ctx: FaceCtx, r: number, time: number) => void;

// ─── Small helpers ──────────────────────────────────────────────────────────

/** Clip subsequent drawing to the head circle (for bands / wraps). */
function withHeadClip(ctx: FaceCtx, r: number, fn: () => void): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  fn();
  ctx.restore();
}

function fillCircle(ctx: FaceCtx, x: number, y: number, r: number, color: string, alpha = 1): void {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (alpha !== 1) ctx.globalAlpha = 1;
}

function fillEllipse(
  ctx: FaceCtx, x: number, y: number, rx: number, ry: number,
  color: string, rotation = 0, alpha = 1,
): void {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fill();
  if (alpha !== 1) ctx.globalAlpha = 1;
}

function strokePath(
  ctx: FaceCtx, color: string, width: number,
  build: () => void, alpha = 1,
): void {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  build();
  ctx.stroke();
  if (alpha !== 1) ctx.globalAlpha = 1;
}

function fillTriangle(
  ctx: FaceCtx, ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, color: string, alpha = 1,
): void {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// ─── The 12 faces ───────────────────────────────────────────────────────────

/** Panda Brawler — white head, black eye patches, button nose. */
const pandaFace: FaceDrawFn = (ctx, r) => {
  // Eye patches (classic rotated ovals)
  fillEllipse(ctx, r * 0.30, -r * 0.42, r * 0.26, r * 0.20, '#111827', -0.5);
  fillEllipse(ctx, r * 0.30, r * 0.42, r * 0.26, r * 0.20, '#111827', 0.5);
  // Eyes inside patches
  fillCircle(ctx, r * 0.36, -r * 0.42, r * 0.10, '#ffffff');
  fillCircle(ctx, r * 0.36, r * 0.42, r * 0.10, '#ffffff');
  fillCircle(ctx, r * 0.40, -r * 0.42, r * 0.05, '#111827');
  fillCircle(ctx, r * 0.40, r * 0.42, r * 0.05, '#111827');
  // Button nose + smile
  fillEllipse(ctx, r * 0.80, 0, r * 0.09, r * 0.07, '#111827');
  strokePath(ctx, '#111827', r * 0.045, () => {
    ctx.moveTo(r * 0.68, r * 0.10);
    ctx.quadraticCurveTo(r * 0.80, r * 0.24, r * 0.92, r * 0.10);
  });
};

/** Turbo Tiger — orange head, forehead stripes, white muzzle, whiskers. */
const tigerFace: FaceDrawFn = (ctx, r) => {
  // Forehead stripes
  withHeadClip(ctx, r, () => {
    ctx.fillStyle = '#111827';
    for (let i = 0; i < 3; i++) {
      const y = -r * (0.52 + i * 0.16);
      ctx.fillRect(r * 0.05, y, r * 0.38, r * 0.075);
    }
    // Cheek stripes (both sides, toward the back)
    ctx.fillRect(-r * 0.55, -r * 0.72, r * 0.30, r * 0.07);
    ctx.fillRect(-r * 0.60, r * 0.60, r * 0.30, r * 0.07);
  });
  // Eyes
  fillCircle(ctx, r * 0.34, -r * 0.26, r * 0.13, '#ffffff');
  fillCircle(ctx, r * 0.34, r * 0.26, r * 0.13, '#ffffff');
  fillCircle(ctx, r * 0.38, -r * 0.26, r * 0.075, '#b45309');
  fillCircle(ctx, r * 0.38, r * 0.26, r * 0.075, '#b45309');
  fillCircle(ctx, r * 0.38, -r * 0.26, r * 0.035, '#111827');
  fillCircle(ctx, r * 0.38, r * 0.26, r * 0.035, '#111827');
  // Muzzle + nose
  fillEllipse(ctx, r * 0.62, 0, r * 0.30, r * 0.22, '#fef3c7');
  fillTriangle(ctx, r * 0.80, -r * 0.07, r * 0.80, r * 0.07, r * 0.93, 0, '#f87171');
  // Whiskers
  strokePath(ctx, 'rgba(255,255,255,0.85)', r * 0.035, () => {
    ctx.moveTo(r * 0.60, -r * 0.18); ctx.lineTo(r * 0.18, -r * 0.38);
    ctx.moveTo(r * 0.60, r * 0.18); ctx.lineTo(r * 0.18, r * 0.38);
  });
};

/** Abyss Shark — steel head, pale jaw, jagged grin, gill slits. */
const sharkFace: FaceDrawFn = (ctx, r) => {
  // Pale under-jaw
  withHeadClip(ctx, r, () => {
    fillEllipse(ctx, r * 0.45, r * 0.45, r * 0.62, r * 0.34, '#dbe4ee');
    // Gills
    strokePath(ctx, 'rgba(15,23,42,0.45)', r * 0.05, () => {
      for (let i = 0; i < 3; i++) {
        const x = -r * (0.15 + i * 0.22);
        ctx.moveTo(x, -r * 0.30);
        ctx.quadraticCurveTo(x - r * 0.10, 0, x, r * 0.30);
      }
    });
  });
  // Bead eyes
  fillCircle(ctx, r * 0.45, -r * 0.30, r * 0.10, '#0f172a');
  fillCircle(ctx, r * 0.48, -r * 0.33, r * 0.03, '#ffffff');
  // Jagged grin
  strokePath(ctx, '#0f172a', r * 0.05, () => {
    ctx.moveTo(r * 0.92, r * 0.10);
    for (let i = 0; i < 4; i++) {
      const x1 = r * (0.92 - (i + 0.5) * 0.16);
      const x2 = r * (0.92 - (i + 1) * 0.16);
      ctx.lineTo(x1, r * (0.10 + (i % 2 === 0 ? 0.10 : -0.02)));
      ctx.lineTo(x2, r * 0.10);
    }
  });
};

/** Circuit Bot — gunmetal head, glowing visor, LED eyes, mouth grille. */
const robotFace: FaceDrawFn = (ctx, r, time) => {
  // Rivets along the back rim
  fillCircle(ctx, -r * 0.70, -r * 0.35, r * 0.045, '#94a3b8');
  fillCircle(ctx, -r * 0.85, 0, r * 0.045, '#94a3b8');
  fillCircle(ctx, -r * 0.70, r * 0.35, r * 0.045, '#94a3b8');
  // Visor band (clipped to head)
  withHeadClip(ctx, r, () => {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(r * 0.02, -r * 0.34, r * 1.0, r * 0.42);
  });
  // Pulsing LED eyes
  const pulse = 0.7 + 0.3 * Math.sin(time * 0.006);
  fillCircle(ctx, r * 0.42, -r * 0.13, r * 0.115, '#22d3ee', pulse);
  fillCircle(ctx, r * 0.72, -r * 0.13, r * 0.115, '#22d3ee', pulse * 0.85);
  fillCircle(ctx, r * 0.42, -r * 0.13, r * 0.05, '#a5f3fc', pulse);
  fillCircle(ctx, r * 0.72, -r * 0.13, r * 0.05, '#a5f3fc', pulse * 0.85);
  // Mouth grille
  strokePath(ctx, '#22d3ee', r * 0.05, () => {
    for (let i = 0; i < 3; i++) {
      const x = r * (0.50 + i * 0.14);
      ctx.moveTo(x, r * 0.42);
      ctx.lineTo(x, r * 0.62);
    }
  });
};

/** Nebula Grey — green head, big black almond eyes, tiny nostrils. */
const alienFace: FaceDrawFn = (ctx, r) => {
  // Large almond eyes
  fillEllipse(ctx, r * 0.40, -r * 0.28, r * 0.27, r * 0.13, '#090d16', -0.45);
  fillEllipse(ctx, r * 0.40, r * 0.28, r * 0.27, r * 0.13, '#090d16', 0.45);
  // Glints
  fillCircle(ctx, r * 0.48, -r * 0.30, r * 0.035, '#e2e8f0', 0.9);
  fillCircle(ctx, r * 0.48, r * 0.26, r * 0.035, '#e2e8f0', 0.9);
  // Nostrils
  fillCircle(ctx, r * 0.82, -r * 0.05, r * 0.028, 'rgba(9,13,22,0.75)');
  fillCircle(ctx, r * 0.82, r * 0.05, r * 0.028, 'rgba(9,13,22,0.75)');
  // Chin crease
  strokePath(ctx, 'rgba(9,13,22,0.35)', r * 0.04, () => {
    ctx.moveTo(r * 0.62, r * 0.30);
    ctx.quadraticCurveTo(r * 0.74, r * 0.38, r * 0.86, r * 0.30);
  });
};

/** Sly Fox — orange head, white muzzle, sly half-lid eyes, dark nose. */
const foxFace: FaceDrawFn = (ctx, r) => {
  // Muzzle
  fillEllipse(ctx, r * 0.58, r * 0.10, r * 0.34, r * 0.24, '#fff7ed');
  // Sly eyes (lidded almonds)
  fillEllipse(ctx, r * 0.36, -r * 0.26, r * 0.15, r * 0.065, '#1f2937', -0.30);
  fillEllipse(ctx, r * 0.36, r * 0.26, r * 0.15, r * 0.065, '#1f2937', 0.30);
  // Dark tear marks
  strokePath(ctx, 'rgba(31,41,55,0.5)', r * 0.045, () => {
    ctx.moveTo(r * 0.24, -r * 0.30); ctx.lineTo(r * 0.10, -r * 0.52);
    ctx.moveTo(r * 0.24, r * 0.30); ctx.lineTo(r * 0.10, r * 0.52);
  });
  // Nose + smirk
  fillTriangle(ctx, r * 0.82, -r * 0.06, r * 0.82, r * 0.06, r * 0.95, 0, '#1f2937');
  strokePath(ctx, '#1f2937', r * 0.045, () => {
    ctx.moveTo(r * 0.70, r * 0.20);
    ctx.quadraticCurveTo(r * 0.82, r * 0.30, r * 0.94, r * 0.18);
  });
};

/** Lucky Frog — green head, top-mounted eye bulbs, wide smile, blush. */
const frogFace: FaceDrawFn = (ctx, r) => {
  // Eye bulbs (big, top-forward)
  fillCircle(ctx, r * 0.42, -r * 0.46, r * 0.22, '#ffffff');
  fillCircle(ctx, r * 0.42, r * 0.46, r * 0.22, '#ffffff');
  fillCircle(ctx, r * 0.48, -r * 0.46, r * 0.11, '#111827');
  fillCircle(ctx, r * 0.48, r * 0.46, r * 0.11, '#111827');
  fillCircle(ctx, r * 0.51, -r * 0.50, r * 0.035, '#ffffff');
  fillCircle(ctx, r * 0.51, r * 0.42, r * 0.035, '#ffffff');
  // Wide smile
  strokePath(ctx, 'rgba(6,78,59,0.85)', r * 0.06, () => {
    ctx.moveTo(r * 0.90, r * 0.05);
    ctx.quadraticCurveTo(r * 0.55, r * 0.52, r * 0.16, r * 0.22);
  });
  // Nostrils
  fillCircle(ctx, r * 0.86, -r * 0.10, r * 0.028, 'rgba(6,78,59,0.8)');
  fillCircle(ctx, r * 0.86, r * 0.10, r * 0.028, 'rgba(6,78,59,0.8)');
  // Blush
  fillCircle(ctx, r * 0.30, -r * 0.16, r * 0.08, '#fda4af', 0.45);
  fillCircle(ctx, r * 0.30, r * 0.16, r * 0.08, '#fda4af', 0.45);
};

/** Boo Wraith — pale head, hollow oval eyes, ghost "ooo" mouth. */
const ghostFace: FaceDrawFn = (ctx, r) => {
  // Brow shading
  fillEllipse(ctx, r * 0.42, -r * 0.34, r * 0.20, r * 0.08, 'rgba(15,23,42,0.18)', -0.2);
  fillEllipse(ctx, r * 0.42, r * 0.34, r * 0.20, r * 0.08, 'rgba(15,23,42,0.18)', 0.2);
  // Hollow eyes
  fillEllipse(ctx, r * 0.45, -r * 0.20, r * 0.13, r * 0.19, '#0f172a');
  fillEllipse(ctx, r * 0.45, r * 0.20, r * 0.13, r * 0.19, '#0f172a');
  // "Ooo" mouth
  fillEllipse(ctx, r * 0.76, r * 0.22, r * 0.10, r * 0.15, '#0f172a');
  // Faint wispy cheek streaks
  strokePath(ctx, 'rgba(148,163,184,0.4)', r * 0.04, () => {
    ctx.moveTo(-r * 0.10, -r * 0.55); ctx.lineTo(-r * 0.28, -r * 0.72);
    ctx.moveTo(-r * 0.10, r * 0.55); ctx.lineTo(-r * 0.28, r * 0.72);
  });
};

/** Inferno Imp — red head, curved horns hugging the rim, yellow eyes, fangs. */
const devilFace: FaceDrawFn = (ctx, r) => {
  // Horns (inside the head circle — hugging the top rim)
  fillTriangle(ctx, r * 0.10, -r * 0.62, r * 0.34, -r * 0.80, r * 0.22, -r * 0.34, '#7f1d1d');
  fillTriangle(ctx, r * 0.10, r * 0.62, r * 0.34, r * 0.80, r * 0.22, r * 0.34, '#7f1d1d');
  // Slanted angry eyes
  fillEllipse(ctx, r * 0.40, -r * 0.22, r * 0.15, r * 0.08, '#facc15', -0.35);
  fillEllipse(ctx, r * 0.40, r * 0.22, r * 0.15, r * 0.08, '#facc15', 0.35);
  fillCircle(ctx, r * 0.44, -r * 0.22, r * 0.035, '#111827');
  fillCircle(ctx, r * 0.44, r * 0.22, r * 0.035, '#111827');
  // Grin with fangs
  strokePath(ctx, '#450a0a', r * 0.05, () => {
    ctx.moveTo(r * 0.52, r * 0.34);
    ctx.quadraticCurveTo(r * 0.72, r * 0.52, r * 0.92, r * 0.28);
  });
  fillTriangle(ctx, r * 0.66, r * 0.44, r * 0.74, r * 0.46, r * 0.70, r * 0.34, '#ffffff');
  fillTriangle(ctx, r * 0.80, r * 0.40, r * 0.88, r * 0.38, r * 0.85, r * 0.30, '#ffffff');
};

/** Seraph Glow — pale head, serene closed eyes, gold halo ring. */
const angelFace: FaceDrawFn = (ctx, r) => {
  // Halo (thin gold ring tangent to the top-inside rim)
  strokePath(ctx, '#fbbf24', r * 0.07, () => {
    ctx.ellipse(r * 0.18, -r * 0.62, r * 0.34, r * 0.16, -0.2, 0, Math.PI * 2);
  });
  // Serene closed eyes (downward arcs)
  strokePath(ctx, 'rgba(120,53,15,0.85)', r * 0.05, () => {
    ctx.moveTo(r * 0.28, -r * 0.26);
    ctx.quadraticCurveTo(r * 0.40, -r * 0.16, r * 0.52, -r * 0.26);
    ctx.moveTo(r * 0.28, r * 0.26);
    ctx.quadraticCurveTo(r * 0.40, r * 0.16, r * 0.52, r * 0.26);
  });
  // Gentle smile + blush
  strokePath(ctx, 'rgba(120,53,15,0.85)', r * 0.05, () => {
    ctx.moveTo(r * 0.70, r * 0.16);
    ctx.quadraticCurveTo(r * 0.82, r * 0.26, r * 0.94, r * 0.16);
  });
  fillCircle(ctx, r * 0.32, -r * 0.42, r * 0.07, '#fda4af', 0.4);
  fillCircle(ctx, r * 0.32, r * 0.42, r * 0.07, '#fda4af', 0.4);
};

/** Shadow Shinobi — dark head, crimson headband with knot + tails, eye slits. */
const ninjaFace: FaceDrawFn = (ctx, r) => {
  // Headband (clipped wrap) + knot + short tails pointing back
  withHeadClip(ctx, r, () => {
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-r * 1.1, -r * 0.52, r * 2.2, r * 0.34);
  });
  fillCircle(ctx, -r * 0.78, -r * 0.35, r * 0.09, '#991b1b');
  fillTriangle(ctx, -r * 0.84, -r * 0.32, -r * 0.56, -r * 0.28, -r * 0.74, -r * 0.06, '#991b1b');
  fillTriangle(ctx, -r * 0.86, -r * 0.38, -r * 0.58, -r * 0.40, -r * 0.72, -r * 0.62, '#7f1d1d');
  // Eye slits (narrow, focused)
  fillEllipse(ctx, r * 0.38, -r * 0.10, r * 0.16, r * 0.075, '#f1f5f9', -0.08);
  fillEllipse(ctx, r * 0.38, r * 0.22, r * 0.16, r * 0.075, '#f1f5f9', 0.08);
  fillCircle(ctx, r * 0.43, -r * 0.10, r * 0.042, '#0f172a');
  fillCircle(ctx, r * 0.43, r * 0.22, r * 0.042, '#0f172a');
  // Covered lower face shade
  fillEllipse(ctx, r * 0.55, r * 0.52, r * 0.42, r * 0.22, 'rgba(2,6,23,0.35)');
};

/** Reef Raider — tan head, navy polka bandana, eyepatch, gold earring. */
const pirateFace: FaceDrawFn = (ctx, r) => {
  // Bandana (clipped wrap) + polka dots + knot
  withHeadClip(ctx, r, () => {
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(-r * 1.1, -r * 0.62, r * 2.2, r * 0.42);
  });
  fillCircle(ctx, r * 0.05, -r * 0.42, r * 0.05, '#e2e8f0');
  fillCircle(ctx, r * 0.38, -r * 0.48, r * 0.05, '#e2e8f0');
  fillCircle(ctx, -r * 0.30, -r * 0.44, r * 0.05, '#e2e8f0');
  fillCircle(ctx, -r * 0.80, -r * 0.40, r * 0.10, '#16304f');
  // Eyepatch strap (diagonal) + patch over the upper eye
  strokePath(ctx, '#0f172a', r * 0.05, () => {
    ctx.moveTo(r * 0.62, -r * 0.42);
    ctx.lineTo(-r * 0.70, -r * 0.62);
    ctx.moveTo(r * 0.62, -r * 0.42);
    ctx.quadraticCurveTo(r * 0.30, -r * 0.10, r * 0.12, r * 0.10);
  });
  fillCircle(ctx, r * 0.40, -r * 0.22, r * 0.155, '#0f172a');
  // Visible eye
  fillCircle(ctx, r * 0.40, r * 0.26, r * 0.12, '#ffffff');
  fillCircle(ctx, r * 0.44, r * 0.26, r * 0.06, '#111827');
  // Smirk + gold earring
  strokePath(ctx, '#0f172a', r * 0.05, () => {
    ctx.moveTo(r * 0.62, r * 0.42);
    ctx.quadraticCurveTo(r * 0.76, r * 0.50, r * 0.90, r * 0.38);
  });
  strokePath(ctx, '#fbbf24', r * 0.045, () => {
    ctx.arc(r * 0.12, r * 0.66, r * 0.08, 0, Math.PI * 1.4);
  });
};

// ─── Registry & lookups ─────────────────────────────────────────────────────

export const CHARACTER_FACES: Map<string, FaceDrawFn> = new Map([
  ['panda', pandaFace],
  ['tiger', tigerFace],
  ['shark', sharkFace],
  ['robot', robotFace],
  ['alien', alienFace],
  ['fox', foxFace],
  ['frog', frogFace],
  ['ghost', ghostFace],
  ['devil', devilFace],
  ['angel', angelFace],
  ['ninja', ninjaFace],
  ['pirate', pirateFace],
]);

/** skinId → face id, built once from the premium catalog (Skin.headStyle). */
const _skinFaceMap = new Map<string, string>();
for (const item of ALL_COSMETICS) {
  if (item.type === 'skin' && item.headStyle) {
    _skinFaceMap.set(item.id, item.headStyle);
  }
}

/** Resolve the character face for a skin id (null when it has none). */
export function getCharacterFaceForSkin(skinId: string): string | null {
  return _skinFaceMap.get(skinId) ?? null;
}

/**
 * Draw a character face onto an already-filled head circle.
 * (hx, hy) = head center in current canvas space; `facing` = head rotation
 * (radians, +x = forward); r = head radius; time (ms) drives the robot LED
 * pulse. All other faces are static, matching the atlas-baked sprite.
 */
export function drawCharacterFace(
  ctx: FaceCtx,
  hx: number, hy: number, r: number,
  facing: number, faceId: string, time = 0,
): void {
  const face = CHARACTER_FACES.get(faceId);
  if (!face) return;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(facing);
  face(ctx, r, time);
  ctx.restore();
}
