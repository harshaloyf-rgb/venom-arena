// ============================================================================
// Character Faces — PREMIUM exclusive FULL HEAD replacements (2026-09-05 v2)
// ============================================================================
// CONTRACT (v2 — full character head, NOT cosmetics on a snake head):
//  - drawCharacterFace() REPLACES the entire head. It fills the head circle
//    with the character's own base color (opaque), then draws the character's
//    features. Callers must NOT pre-fill the head or draw an accent ring when
//    a face exists.
//  - Local space after translate(hx,hy)+rotate(facing): head circle of radius
//    `r` centered at the origin, snake faces +x (right).
//  - Ears / horns / antennas / halos may extend OUTSIDE the head circle up to
//    CHARACTER_FACE_HEAD_SCALE (1.3 × r) from the center. The atlas bakes the
//    face at r/1.3 and the renderer draws that sprite 1.3× larger, so the
//    visible head circle stays exactly `r` and the decorations fit the sprite.
//  - The same function renders identically in all three consumers:
//      atlas-baked head sprite (lib/snake/atlas.ts renderHeadSprite),
//      game fallback renderer (render-snake-atlas.tsx),
//      GameSnakePreview (shop / lab previews).
//  - No equipped cosmetics are drawn over a character face, in game or in any
//    preview (product decision 2026-09-05).
//
// All designs are ORIGINAL (generic animals / archetypes) — deliberately not
// based on any copyrighted character, so the store is IP-safe.
// ============================================================================

import { ALL_COSMETICS } from '@/lib/game-config';

type FaceCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type FaceDrawFn = (ctx: FaceCtx, r: number, time: number) => void;

/** Max extent of ears/horns/etc. from head center, in head radii. */
export const CHARACTER_FACE_HEAD_SCALE = 1.3;

/** Sprite padding (px) kept clear around the baked face inside its region. */
export const CHARACTER_FACE_BAKE_PAD = 2;

/**
 * Radius at which a face must be baked into a sprite region so that the head
 * circle PLUS its 1.3× decorations fit the region. The renderer then draws
 * the sprite scaled up by (regionHalf / bakeRadius) — visible head size is
 * unchanged while ears/horns stay inside the sprite.
 */
export function characterFaceBakeRadius(spriteHalf: number): number {
  return (spriteHalf - CHARACTER_FACE_BAKE_PAD) / CHARACTER_FACE_HEAD_SCALE;
}

/** Inverse of characterFaceBakeRadius — the draw-time scale for that sprite. */
export function characterFaceDrawScale(spriteHalf: number): number {
  return spriteHalf / characterFaceBakeRadius(spriteHalf);
}

// ─── Small helpers ──────────────────────────────────────────────────────────

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

/** Fill the head circle itself — every face starts with this (full-head rule). */
function fillHead(ctx: FaceCtx, r: number, color: string): void {
  fillCircle(ctx, 0, 0, r, color);
}

// ─── The 12 full-head characters ────────────────────────────────────────────

/** Panda Brawler — white head, round black ears, eye patches, button nose. */
const pandaFace: FaceDrawFn = (ctx, r) => {
  // Ears (round, top-back, outside the circle)
  fillCircle(ctx, -r * 0.55, -r * 0.78, r * 0.34, '#111827');
  fillCircle(ctx, -r * 0.55, r * 0.78, r * 0.34, '#111827');
  fillCircle(ctx, -r * 0.55, -r * 0.78, r * 0.16, '#374151');
  fillCircle(ctx, -r * 0.55, r * 0.78, r * 0.16, '#374151');
  // Full white head
  fillHead(ctx, r, '#f8fafc');
  // Eye patches (classic rotated ovals)
  fillEllipse(ctx, r * 0.30, -r * 0.42, r * 0.27, r * 0.21, '#111827', -0.5);
  fillEllipse(ctx, r * 0.30, r * 0.42, r * 0.27, r * 0.21, '#111827', 0.5);
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

/** Turbo Tiger — orange head, round ears, forehead stripes, muzzle, whiskers. */
const tigerFace: FaceDrawFn = (ctx, r) => {
  // Ears (round, top-back)
  fillCircle(ctx, -r * 0.42, -r * 0.82, r * 0.30, '#f97316');
  fillCircle(ctx, -r * 0.42, r * 0.82, r * 0.30, '#f97316');
  fillCircle(ctx, -r * 0.42, -r * 0.82, r * 0.15, '#fbbf24');
  fillCircle(ctx, -r * 0.42, r * 0.82, r * 0.15, '#fbbf24');
  // Full orange head
  fillHead(ctx, r, '#f97316');
  // Forehead + cheek stripes (clipped to the head)
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#7c2d12';
  for (let i = 0; i < 3; i++) {
    const y = -r * (0.50 + i * 0.17);
    ctx.fillRect(r * 0.02, y, r * 0.34, r * 0.075);
  }
  ctx.fillRect(-r * 0.62, -r * 0.78, r * 0.30, r * 0.07);
  ctx.fillRect(-r * 0.66, r * 0.66, r * 0.30, r * 0.07);
  ctx.restore();
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

/** Lucky Frog — green head, eye bulbs ON TOP, wide smile, blush. */
const frogFace: FaceDrawFn = (ctx, r) => {
  // Eye bulbs sit on top of the head (outside the circle)
  fillCircle(ctx, r * 0.30, -r * 0.88, r * 0.30, '#16a34a');
  fillCircle(ctx, r * 0.30, r * 0.88, r * 0.30, '#16a34a');
  // Full green head
  fillHead(ctx, r, '#22c55e');
  // Bulb interiors (white + pupil) drawn AFTER the head so the neck is clean
  fillCircle(ctx, r * 0.30, -r * 0.88, r * 0.20, '#ffffff');
  fillCircle(ctx, r * 0.30, r * 0.88, r * 0.20, '#ffffff');
  fillCircle(ctx, r * 0.34, -r * 0.88, r * 0.10, '#111827');
  fillCircle(ctx, r * 0.34, r * 0.88, r * 0.10, '#111827');
  fillCircle(ctx, r * 0.37, -r * 0.92, r * 0.032, '#ffffff');
  fillCircle(ctx, r * 0.37, r * 0.84, r * 0.032, '#ffffff');
  // Wide smile
  strokePath(ctx, 'rgba(6,78,59,0.9)', r * 0.06, () => {
    ctx.moveTo(r * 0.92, r * 0.02);
    ctx.quadraticCurveTo(r * 0.55, r * 0.56, r * 0.10, r * 0.26);
  });
  // Nostrils
  fillCircle(ctx, r * 0.86, -r * 0.10, r * 0.030, 'rgba(6,78,59,0.85)');
  fillCircle(ctx, r * 0.86, r * 0.10, r * 0.030, 'rgba(6,78,59,0.85)');
  // Blush
  fillCircle(ctx, r * 0.42, -r * 0.30, r * 0.09, '#fda4af', 0.5);
  fillCircle(ctx, r * 0.42, r * 0.30, r * 0.09, '#fda4af', 0.5);
};

/** Abyss Shark — steel head, top fin, gill slits, jagged grin, bead eye. */
const sharkFace: FaceDrawFn = (ctx, r) => {
  // Dorsal fin (top, swept back)
  fillTriangle(ctx, -r * 0.10, -r * 0.85, -r * 0.62, -r * 1.28, -r * 0.55, -r * 0.62, '#1e293b');
  // Full steel head
  fillHead(ctx, r, '#94a3b8');
  // Pale under-jaw
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  fillEllipse(ctx, r * 0.45, r * 0.50, r * 0.62, r * 0.34, '#dbe4ee');
  // Gills
  strokePath(ctx, 'rgba(15,23,42,0.45)', r * 0.05, () => {
    for (let i = 0; i < 3; i++) {
      const x = -r * (0.15 + i * 0.22);
      ctx.moveTo(x, -r * 0.30);
      ctx.quadraticCurveTo(x - r * 0.10, 0, x, r * 0.30);
    }
  });
  ctx.restore();
  // Bead eye
  fillCircle(ctx, r * 0.45, -r * 0.30, r * 0.11, '#0f172a');
  fillCircle(ctx, r * 0.49, -r * 0.34, r * 0.032, '#ffffff');
  // Jagged grin
  strokePath(ctx, '#0f172a', r * 0.05, () => {
    ctx.moveTo(r * 0.94, r * 0.10);
    for (let i = 0; i < 4; i++) {
      const x1 = r * (0.94 - (i + 0.5) * 0.17);
      const x2 = r * (0.94 - (i + 1) * 0.17);
      ctx.lineTo(x1, r * (0.10 + (i % 2 === 0 ? 0.11 : -0.02)));
      ctx.lineTo(x2, r * 0.10);
    }
  });
};

/** Sly Fox — orange head, tall dark-tipped ears, white muzzle, sly eyes. */
const foxFace: FaceDrawFn = (ctx, r) => {
  // Tall triangular ears (outside the circle, dark tips)
  fillTriangle(ctx, -r * 0.30, -r * 0.72, -r * 0.10, -r * 1.30, -r * 0.88, -r * 0.92, '#ea580c');
  fillTriangle(ctx, -r * 0.30, r * 0.72, -r * 0.10, r * 1.30, -r * 0.88, r * 0.92, '#ea580c');
  fillTriangle(ctx, -r * 0.34, -r * 0.80, -r * 0.20, -r * 1.16, -r * 0.70, -r * 0.90, '#7c2d12');
  fillTriangle(ctx, -r * 0.34, r * 0.80, -r * 0.20, r * 1.16, -r * 0.70, r * 0.90, '#7c2d12');
  // Full orange head
  fillHead(ctx, r, '#fb923c');
  // White muzzle
  fillEllipse(ctx, r * 0.58, r * 0.08, r * 0.34, r * 0.24, '#fff7ed');
  // Sly eyes (lidded almonds)
  fillEllipse(ctx, r * 0.36, -r * 0.26, r * 0.15, r * 0.065, '#1f2937', -0.30);
  fillEllipse(ctx, r * 0.36, r * 0.26, r * 0.15, r * 0.065, '#1f2937', 0.30);
  // Dark tear marks
  strokePath(ctx, 'rgba(31,41,55,0.5)', r * 0.045, () => {
    ctx.moveTo(r * 0.24, -r * 0.30); ctx.lineTo(r * 0.10, -r * 0.52);
    ctx.moveTo(r * 0.24, r * 0.30); ctx.lineTo(r * 0.10, r * 0.52);
  });
  // Nose + smirk
  fillTriangle(ctx, r * 0.84, -r * 0.06, r * 0.84, r * 0.06, r * 0.96, 0, '#1f2937');
  strokePath(ctx, '#1f2937', r * 0.045, () => {
    ctx.moveTo(r * 0.70, r * 0.20);
    ctx.quadraticCurveTo(r * 0.82, r * 0.30, r * 0.94, r * 0.18);
  });
};

/** Circuit Bot — gunmetal head, antenna, visor, LED eyes, mouth grille. */
const robotFace: FaceDrawFn = (ctx, r, time) => {
  // Antenna (top, extends past the rim)
  strokePath(ctx, '#94a3b8', r * 0.06, () => {
    ctx.moveTo(-r * 0.10, -r * 0.92);
    ctx.lineTo(-r * 0.28, -r * 1.26);
  });
  fillCircle(ctx, -r * 0.30, -r * 1.28, r * 0.10, '#22d3ee');
  // Full gunmetal head
  fillHead(ctx, r, '#475569');
  // Rivets along the back rim
  fillCircle(ctx, -r * 0.70, -r * 0.35, r * 0.045, '#94a3b8');
  fillCircle(ctx, -r * 0.85, 0, r * 0.045, '#94a3b8');
  fillCircle(ctx, -r * 0.70, r * 0.35, r * 0.045, '#94a3b8');
  // Visor band (clipped to head)
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(r * 0.02, -r * 0.34, r * 1.0, r * 0.42);
  ctx.restore();
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

/** Nebula Grey — green head, antenna stalks with bulbs, almond eyes. */
const alienFace: FaceDrawFn = (ctx, r) => {
  // Antenna stalks (top, extend past the rim) with glowing bulbs
  strokePath(ctx, '#16a34a', r * 0.055, () => {
    ctx.moveTo(-r * 0.15, -r * 0.88);
    ctx.quadraticCurveTo(-r * 0.45, -r * 1.15, -r * 0.55, -r * 1.24);
    ctx.moveTo(-r * 0.15, r * 0.88);
    ctx.quadraticCurveTo(-r * 0.45, r * 1.15, -r * 0.55, r * 1.24);
  });
  fillCircle(ctx, -r * 0.58, -r * 1.26, r * 0.11, '#4ade80');
  fillCircle(ctx, -r * 0.58, r * 1.26, r * 0.11, '#4ade80');
  fillCircle(ctx, -r * 0.58, -r * 1.26, r * 0.05, '#d9f99d');
  fillCircle(ctx, -r * 0.58, r * 1.26, r * 0.05, '#d9f99d');
  // Full green head
  fillHead(ctx, r, '#4ade80');
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

/** Boo Wraith — pale sheet head with soft top bumps, hollow eyes, ooo mouth. */
const ghostFace: FaceDrawFn = (ctx, r) => {
  // Soft sheet bumps on the top rim (outside the circle, same pale color)
  fillCircle(ctx, -r * 0.55, -r * 0.62, r * 0.26, '#e2e8f0');
  fillCircle(ctx, -r * 0.10, -r * 0.86, r * 0.22, '#e2e8f0');
  fillCircle(ctx, -r * 0.55, r * 0.62, r * 0.26, '#e2e8f0');
  fillCircle(ctx, -r * 0.10, r * 0.86, r * 0.22, '#e2e8f0');
  // Full pale head
  fillHead(ctx, r, '#e2e8f0');
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

/** Inferno Imp — red head, curved horns, angry yellow eyes, fanged grin. */
const devilFace: FaceDrawFn = (ctx, r) => {
  // Curved horns (top-back, extend past the rim)
  fillTriangle(ctx, -r * 0.05, -r * 0.75, -r * 0.45, -r * 1.28, -r * 0.42, -r * 0.62, '#7f1d1d');
  fillTriangle(ctx, -r * 0.05, r * 0.75, -r * 0.45, r * 1.28, -r * 0.42, r * 0.62, '#7f1d1d');
  fillTriangle(ctx, -r * 0.12, -r * 0.72, -r * 0.38, -r * 1.10, -r * 0.36, -r * 0.62, '#b91c1c');
  fillTriangle(ctx, -r * 0.12, r * 0.72, -r * 0.38, r * 1.10, -r * 0.36, r * 0.62, '#b91c1c');
  // Full red head
  fillHead(ctx, r, '#dc2626');
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

/** Seraph Glow — cream head, floating gold halo above, serene closed eyes. */
const angelFace: FaceDrawFn = (ctx, r) => {
  // Full cream head
  fillHead(ctx, r, '#fefce8');
  // Halo floats ABOVE the head (tangent, outside the circle)
  strokePath(ctx, '#fbbf24', r * 0.075, () => {
    ctx.ellipse(-r * 0.30, -r * 1.14, r * 0.40, r * 0.13, -0.18, 0, Math.PI * 2);
  });
  strokePath(ctx, 'rgba(251,191,36,0.35)', r * 0.03, () => {
    ctx.ellipse(-r * 0.30, -r * 1.14, r * 0.48, r * 0.19, -0.18, 0, Math.PI * 2);
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

/** Shadow Shinobi — dark head, crimson headband with flowing tails, eye slits. */
const ninjaFace: FaceDrawFn = (ctx, r) => {
  // Headband tails flowing BEHIND the head (-x, extend past the rim)
  fillTriangle(ctx, -r * 0.82, -r * 0.34, -r * 1.30, -r * 0.58, -r * 0.92, -r * 0.10, '#991b1b');
  fillTriangle(ctx, -r * 0.84, r * 0.10, -r * 1.28, -r * 0.16, -r * 0.90, r * 0.38, '#7f1d1d');
  // Full dark head
  fillHead(ctx, r, '#1e293b');
  // Headband wrap (clipped) + knot
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(-r * 1.1, -r * 0.52, r * 2.2, r * 0.34);
  ctx.restore();
  fillCircle(ctx, -r * 0.78, -r * 0.35, r * 0.10, '#991b1b');
  // Eye slits (narrow, focused)
  fillEllipse(ctx, r * 0.38, -r * 0.10, r * 0.16, r * 0.075, '#f1f5f9', -0.08);
  fillEllipse(ctx, r * 0.38, r * 0.22, r * 0.16, r * 0.075, '#f1f5f9', 0.08);
  fillCircle(ctx, r * 0.43, -r * 0.10, r * 0.042, '#0f172a');
  fillCircle(ctx, r * 0.43, r * 0.22, r * 0.042, '#0f172a');
  // Covered lower face shade
  fillEllipse(ctx, r * 0.55, r * 0.55, r * 0.42, r * 0.20, 'rgba(2,6,23,0.35)');
};

/** Reef Raider — tan head, navy polka bandana with knot, eyepatch, earring. */
const pirateFace: FaceDrawFn = (ctx, r) => {
  // Bandana knot + tails (top-back, extend past the rim)
  fillTriangle(ctx, -r * 0.66, -r * 0.66, -r * 1.24, -r * 0.86, -r * 0.86, -r * 0.38, '#16304f');
  fillTriangle(ctx, -r * 0.70, -r * 0.30, -r * 1.22, -r * 0.36, -r * 0.88, -r * 0.62, '#1e3a5f');
  // Full tan head
  fillHead(ctx, r, '#d4a373');
  // Bandana wrap (clipped) + polka dots
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(-r * 1.1, -r * 0.72, r * 2.2, r * 0.46);
  ctx.fillStyle = '#e2e8f0';
  fillCircle(ctx, r * 0.10, -r * 0.50, r * 0.05, '#e2e8f0');
  fillCircle(ctx, r * 0.45, -r * 0.55, r * 0.05, '#e2e8f0');
  fillCircle(ctx, -r * 0.30, -r * 0.52, r * 0.05, '#e2e8f0');
  fillCircle(ctx, -r * 0.75, -r * 0.44, r * 0.05, '#e2e8f0');
  ctx.restore();
  fillCircle(ctx, -r * 0.80, -r * 0.48, r * 0.10, '#16304f');
  // Eyepatch strap (diagonal) + patch over the upper eye
  strokePath(ctx, '#0f172a', r * 0.05, () => {
    ctx.moveTo(r * 0.70, -r * 0.46);
    ctx.lineTo(-r * 0.60, -r * 0.66);
    ctx.moveTo(r * 0.70, -r * 0.46);
    ctx.quadraticCurveTo(r * 0.30, -r * 0.10, r * 0.12, r * 0.12);
  });
  fillCircle(ctx, r * 0.40, -r * 0.20, r * 0.155, '#0f172a');
  // Visible eye
  fillCircle(ctx, r * 0.40, r * 0.28, r * 0.12, '#ffffff');
  fillCircle(ctx, r * 0.44, r * 0.28, r * 0.06, '#111827');
  // Smirk + gold earring
  strokePath(ctx, '#0f172a', r * 0.05, () => {
    ctx.moveTo(r * 0.62, r * 0.46);
    ctx.quadraticCurveTo(r * 0.76, r * 0.54, r * 0.90, r * 0.42);
  });
  strokePath(ctx, '#fbbf24', r * 0.045, () => {
    ctx.arc(r * 0.10, r * 0.70, r * 0.08, 0, Math.PI * 1.4);
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
 * Draw a FULL character head (replaces the head circle entirely).
 * (hx, hy) = head center in current canvas space; `facing` = head rotation
 * (radians, +x = forward); r = head radius; time (ms) drives the robot LED
 * pulse. Callers must NOT pre-fill the head or draw cosmetics over it.
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
