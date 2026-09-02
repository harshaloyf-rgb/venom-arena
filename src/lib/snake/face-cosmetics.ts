// ============================================================================
// Face Cosmetics System — SHARED — used by both offline and online modes.
// ============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export type CosmeticSlot = 'eyes' | 'mouth' | 'ears' | 'wings' | 'nose' | 'hat' | 'goggles';

export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface FaceCosmetic {
  id: string;
  name: string;
  slot: CosmeticSlot;
  cost: number;
  rarity: CosmeticRarity;
  emoji: string;
  description: string;
  /** Draw the cosmetic on the snake head */
  draw: (ctx: CanvasRenderingContext2D, params: CosmeticDrawParams) => void;
}

export interface CosmeticDrawParams {
  hx: number;       // Head center X (screen space)
  hy: number;       // Head center Y (screen space)
  hr: number;       // Head radius
  angle: number;     // Snake facing angle
  time: number;     // Current timestamp (for animations)
  boosting: boolean; // Whether snake is boosting
  mouseScreenX?: number; // Raw mouse X for eye tracking
  mouseScreenY?: number; // Raw mouse Y for eye tracking
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbaStr(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Helper: perpendicular direction ─────────────────────────────────────────

function perp(angle: number): [number, number] {
  return [-Math.sin(angle), Math.cos(angle)];
}

function forward(angle: number): [number, number] {
  return [Math.cos(angle), Math.sin(angle)];
}

// ─── COSMETIC DEFINITIONS ────────────────────────────────────────────────────

export const FACE_COSMETICS: FaceCosmetic[] = [
  // ═══════════════════════════════════════════════════════════════════
  // EYES (8)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'eye-angry', name: 'Furious Glare', slot: 'eyes', cost: 0,
    rarity: 'common', emoji: '😠',
    description: 'Angry slanted brows that intimidate opponents.',
    draw: drawAngryEyes,
  },
  {
    id: 'eye-cute', name: 'Cute Kawaii', slot: 'eyes', cost: 0,
    rarity: 'common', emoji: '🥺',
    description: 'Big sparkly anime-style eyes with star highlights.',
    draw: drawCuteEyes,
  },
  {
    id: 'eye-cyclops', name: 'Cyclops Beam', slot: 'eyes', cost: 0,
    rarity: 'rare', emoji: '👁️‍🗨️',
    description: 'A single massive eye in the center with a pulsing iris.',
    draw: drawCyclopsEye,
  },
  {
    id: 'eye-laser', name: 'Laser Sights', slot: 'eyes', cost: 0,
    rarity: 'rare', emoji: '🔴',
    description: 'Red laser-dot eyes that glow when boosting.',
    draw: drawLaserEyes,
  },
  {
    id: 'eye-dragon', name: 'Dragon Slit', slot: 'eyes', cost: 0,
    rarity: 'rare', emoji: '🐉',
    description: 'Reptilian vertical slit pupils — ancient predator gaze.',
    draw: drawDragonEyes,
  },
  {
    id: 'eye-neon', name: 'Neon Circuits', slot: 'eyes', cost: 0,
    rarity: 'epic', emoji: '⚡',
    description: 'Glowing cybernetic circuit-board eyes with data streams.',
    draw: drawNeonEyes,
  },
  {
    id: 'eye-cosmic', name: 'Cosmic Void', slot: 'eyes', cost: 0,
    rarity: 'legendary', emoji: '🌌',
    description: 'Eyes containing swirling galaxies and nebulae.',
    draw: drawCosmicEyes,
  },

  // ═══════════════════════════════════════════════════════════════════
  // MOUTH (6)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'mouth-none', name: 'No Mouth', slot: 'mouth', cost: 0,
    rarity: 'common', emoji: '😶',
    description: 'Clean look — no mouth detail.',
    draw: () => {},
  },
  {
    id: 'mouth-fangs', name: 'Venom Fangs', slot: 'mouth', cost: 0,
    rarity: 'common', emoji: '🐍',
    description: 'Two sharp venomous fangs dripping with toxic goo.',
    draw: drawFangs,
  },
  {
    id: 'mouth-smile', name: 'Cheshire Grin', slot: 'mouth', cost: 0,
    rarity: 'common', emoji: '😺',
    description: 'A wide mischievous grin across the face.',
    draw: drawSmile,
  },
  {
    id: 'mouth-tongue', name: 'Flickering Tongue', slot: 'mouth', cost: 0,
    rarity: 'common', emoji: '👅',
    description: 'A forked snake tongue that flicks in and out.',
    draw: drawTongue,
  },
  {
    id: 'mouth-jaw', name: 'Saber Jaw', slot: 'mouth', cost: 0,
    rarity: 'epic', emoji: '🦷',
    description: 'Massive saber-tooth jaw with glowing edges.',
    draw: drawSaberJaw,
  },
  {
    id: 'mouth-void', name: 'Void Maw', slot: 'mouth', cost: 0,
    rarity: 'legendary', emoji: '🕳️',
    description: 'A dark portal mouth that warps space around it.',
    draw: drawVoidMaw,
  },

  // ═══════════════════════════════════════════════════════════════════
  // EARS (6)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'ear-none', name: 'No Ears', slot: 'ears', cost: 0,
    rarity: 'common', emoji: '🚫',
    description: 'Clean streamlined head.',
    draw: () => {},
  },
  {
    id: 'ear-bunny', name: 'Bunny Ears', slot: 'ears', cost: 0,
    rarity: 'common', emoji: '🐰',
    description: 'Soft fluffy bunny ears that bounce while moving.',
    draw: drawBunnyEars,
  },
  {
    id: 'ear-cat', name: 'Cat Ears', slot: 'ears', cost: 0,
    rarity: 'common', emoji: '🐱',
    description: 'Pointed feline ears with pink inner detail.',
    draw: drawCatEars,
  },
  {
    id: 'ear-demon', name: 'Demon Horns', slot: 'ears', cost: 0,
    rarity: 'rare', emoji: '😈',
    description: 'Curved demonic horns that glow with hellfire.',
    draw: drawDemonHorns,
  },
  {
    id: 'ear-crown', name: 'Golden Crown', slot: 'ears', cost: 0,
    rarity: 'epic', emoji: '👑',
    description: 'A jeweled golden crown that shines with authority.',
    draw: drawCrown,
  },
  {
    id: 'ear-halo', name: 'Celestial Halo', slot: 'ears', cost: 0,
    rarity: 'legendary', emoji: '😇',
    description: 'A floating golden halo that orbits above the head.',
    draw: drawHalo,
  },

  // ═══════════════════════════════════════════════════════════════════
  // WINGS (6)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'wing-none', name: 'No Wings', slot: 'wings', cost: 0,
    rarity: 'common', emoji: '🚫',
    description: 'No wings equipped.',
    draw: () => {},
  },
  {
    id: 'wing-angel', name: 'Angel Wings', slot: 'wings', cost: 0,
    rarity: 'rare', emoji: '👼',
    description: 'Pure white feathery angel wings that flutter.',
    draw: drawAngelWings,
  },
  {
    id: 'wing-demon', name: 'Bat Wings', slot: 'wings', cost: 0,
    rarity: 'rare', emoji: '🦇',
    description: 'Dark leathery bat wings with glowing veins.',
    draw: drawBatWings,
  },
  {
    id: 'wing-dragon', name: 'Dragon Wings', slot: 'wings', cost: 0,
    rarity: 'epic', emoji: '🐲',
    description: 'Massive scaled dragon wings with membrane detail.',
    draw: drawDragonWings,
  },
  {
    id: 'wing-cyber', name: 'Jet Boosters', slot: 'wings', cost: 0,
    rarity: 'epic', emoji: '🚀',
    description: 'Futuristic jet boosters that ignite when boosting.',
    draw: drawJetBoosters,
  },
  {
    id: 'wing-phoenix', name: 'Phoenix Wings', slot: 'wings', cost: 0,
    rarity: 'legendary', emoji: '🔥',
    description: 'Blazing phoenix wings made of living fire.',
    draw: drawPhoenixWings,
  },

  // ═══════════════════════════════════════════════════════════════════
  // NOSE (5)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'nose-none', name: 'No Nose', slot: 'nose', cost: 0,
    rarity: 'common', emoji: '🚫',
    description: 'Standard snake snout.',
    draw: () => {},
  },
  {
    id: 'nose-pig', name: 'Pig Snout', slot: 'nose', cost: 0,
    rarity: 'common', emoji: '🐷',
    description: 'A cute pink pig snout on the front of the head.',
    draw: drawPigSnout,
  },
  {
    id: 'nose-clown', name: 'Clown Nose', slot: 'nose', cost: 0,
    rarity: 'common', emoji: '🤡',
    description: 'A big round red clown nose.',
    draw: drawClownNose,
  },
  {
    id: 'nose-gem', name: 'Ruby Gem', slot: 'nose', cost: 0,
    rarity: 'rare', emoji: '💎',
    description: 'A faceted ruby gemstone embedded in the forehead.',
    draw: drawGemNose,
  },
  {
    id: 'nose-third-eye', name: 'Third Eye', slot: 'nose', cost: 0,
    rarity: 'legendary', emoji: '🔮',
    description: 'A mystical third eye that sees all.',
    draw: drawThirdEye,
  },

  // ═══════════════════════════════════════════════════════════════════
  // HATS (8)
  // ═══════════════════════════════════════════════════════════════════
  { id: 'hat-none', name: 'No Hat', slot: 'hat', cost: 0, rarity: 'common', emoji: '❌', description: 'Remove hat.', draw: () => {} },
  { id: 'hat-crown', name: 'Golden Crown', slot: 'hat', cost: 0, rarity: 'legendary', emoji: '👑', description: 'A regal golden crown.', draw: drawHatCrown },
  { id: 'hat-top-hat', name: 'Top Hat', slot: 'hat', cost: 0, rarity: 'epic', emoji: '🎩', description: 'A classic black top hat.', draw: drawTopHat },
  { id: 'hat-cap', name: 'Baseball Cap', slot: 'hat', cost: 0, rarity: 'common', emoji: '🧢', description: 'A sporty baseball cap.', draw: drawCap },
  { id: 'hat-wizard', name: 'Wizard Hat', slot: 'hat', cost: 0, rarity: 'epic', emoji: '🧙', description: 'A pointy wizard hat with stars.', draw: drawWizardHat },
  { id: 'hat-party', name: 'Party Hat', slot: 'hat', cost: 0, rarity: 'common', emoji: '🎉', description: 'A colorful party cone hat.', draw: drawPartyHat },
  { id: 'hat-helmet', name: 'Viking Helmet', slot: 'hat', cost: 0, rarity: 'rare', emoji: '⚔️', description: 'A horned viking helmet.', draw: drawVikingHelmet },
  { id: 'hat-santa', name: 'Santa Hat', slot: 'hat', cost: 0, rarity: 'rare', emoji: '🎅', description: 'A festive Santa Claus hat.', draw: drawSantaHat },

  // ═══════════════════════════════════════════════════════════════════
  // GOGGLES (5)
  // ═══════════════════════════════════════════════════════════════════
  { id: 'goggles-none', name: 'No Goggles', slot: 'goggles', cost: 0, rarity: 'common', emoji: '❌', description: 'Remove goggles.', draw: () => {} },
  { id: 'goggles-round', name: 'Pilot Goggles', slot: 'goggles', cost: 0, rarity: 'common', emoji: '🥽', description: 'Round brass pilot goggles.', draw: drawPilotGoggles },
  { id: 'goggles-cyber', name: 'Cyber Visor', slot: 'goggles', cost: 0, rarity: 'rare', emoji: '👓', description: 'A futuristic HUD visor.', draw: drawCyberVisor },
  { id: 'goggles-shades', name: 'Cool Shades', slot: 'goggles', cost: 0, rarity: 'common', emoji: '😎', description: 'Dark sunglasses.', draw: drawCoolShades },
  { id: 'goggles-monocle', name: 'Monocle', slot: 'goggles', cost: 0, rarity: 'epic', emoji: '🧐', description: 'A sophisticated monocle.', draw: drawMonocle },

];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export function getCosmeticById(id: string): FaceCosmetic | undefined {
  return FACE_COSMETICS.find(c => c.id === id);
}

export function getCosmeticsBySlot(slot: CosmeticSlot): FaceCosmetic[] {
  return FACE_COSMETICS.filter(c => c.slot === slot);
}

// ─── Slot label map ──────────────────────────────────────────────────────────

export const SLOT_INFO: Record<CosmeticSlot, { label: string; emoji: string; desc: string }> = {
  eyes:    { label: 'Eyes',     emoji: '👁️', desc: 'Customize your snake\'s eyes' },
  mouth:   { label: 'Mouth',    emoji: '👄', desc: 'Add fangs, smiles, or tongues' },
  ears:    { label: 'Headgear', emoji: '👑', desc: 'Ears, horns, crowns & halos' },
  wings:   { label: 'Wings',    emoji: '🪽', desc: 'Wings and boosters for your snake' },
  nose:    { label: 'Nose',     emoji: '👃', desc: 'Nose accessories and gems' },
  hat:     { label: 'Hats',     emoji: '🎩', desc: 'Hats, crowns, helmets & headwear' },
  goggles: { label: 'Goggles',  emoji: '🥽', desc: 'Goggles, sunglasses & eyewear' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRAWING FUNCTIONS — All coordinates proportional to `hr` (head radius)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── EYES ─────────────────────────────────────────────────────────────────────

function drawClassicEyes(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const eyeOffset = hr * 0.45;
  const eyeR = hr * 0.25;
  const pupilR = eyeR * 0.55;
  const fwd = hr * 0.3;

  for (const side of [-1, 1]) {
    const ex = hx + fx * fwd + px * eyeOffset * side;
    const ey = hy + fy * fwd + py * eyeOffset * side;

    // 3D eye white
    const grad = ctx.createRadialGradient(ex - eyeR * 0.2, ey - eyeR * 0.2, eyeR * 0.1, ex, ey, eyeR);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cccccc');
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = Math.max(1, hr * 0.04);
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Pupil
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(ex + fx * pupilR * 0.2, ey + fy * pupilR * 0.2, pupilR, 0, Math.PI * 2); ctx.fill();

    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(ex - pupilR * 0.3, ey - pupilR * 0.3, pupilR * 0.35, 0, Math.PI * 2); ctx.fill();
  }
}

function drawAngryEyes(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const eyeOffset = hr * 0.42;
  const eyeR = hr * 0.24;
  const pupilR = eyeR * 0.5;
  const fwd = hr * 0.3;

  for (const side of [-1, 1]) {
    const ex = hx + fx * fwd + px * eyeOffset * side;
    const ey = hy + fy * fwd + py * eyeOffset * side;

    // Eye white
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();

    // Red pupil
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(ex + fx * pupilR * 0.15, ey + fy * pupilR * 0.15, pupilR, 0, Math.PI * 2); ctx.fill();

    // Angry brow line
    ctx.strokeStyle = '#111';
    ctx.lineWidth = Math.max(2, hr * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const browInner_x = ex - fx * eyeR * 0.3 + px * side * eyeR * 0.8;
    const browInner_y = ey - fy * eyeR * 0.3 + py * side * eyeR * 0.8;
    const browOuter_x = ex + fx * eyeR * 1.2 + px * side * eyeR * 0.3;
    const browOuter_y = ey + fy * eyeR * 1.2 + py * side * eyeR * 0.3;
    ctx.moveTo(browOuter_x, browOuter_y);
    ctx.lineTo(browInner_x, browInner_y);
    ctx.stroke();
  }
}

function drawCuteEyes(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const eyeOffset = hr * 0.42;
  const eyeR = hr * 0.32;
  const pupilR = eyeR * 0.55;
  const fwd = hr * 0.25;

  for (const side of [-1, 1]) {
    const ex = hx + fx * fwd + px * eyeOffset * side;
    const ey = hy + fy * fwd + py * eyeOffset * side;

    // Big eye with gradient
    const grad = ctx.createRadialGradient(ex - eyeR * 0.2, ey - eyeR * 0.3, eyeR * 0.1, ex, ey, eyeR);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.7, '#e0e7ff');
    grad.addColorStop(1, '#a5b4fc');
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(99,102,241,0.4)';
    ctx.lineWidth = Math.max(1, hr * 0.03);
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Large colored iris
    const irisR = pupilR * 1.4;
    const irisGrad = ctx.createRadialGradient(ex, ey, pupilR * 0.3, ex, ey, irisR);
    irisGrad.addColorStop(0, '#6366f1');
    irisGrad.addColorStop(1, '#4338ca');
    ctx.fillStyle = irisGrad;
    ctx.beginPath(); ctx.arc(ex + fx * pupilR * 0.1, ey + fy * pupilR * 0.1, irisR, 0, Math.PI * 2); ctx.fill();

    // Black pupil
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(ex + fx * pupilR * 0.15, ey + fy * pupilR * 0.15, pupilR, 0, Math.PI * 2); ctx.fill();

    // Two star sparkles
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(ex - pupilR * 0.5, ey - pupilR * 0.5, pupilR * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + pupilR * 0.3, ey + pupilR * 0.2, pupilR * 0.2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCyclopsEye(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const ex = hx + fx * hr * 0.35;
  const ey = hy + fy * hr * 0.35;
  const eyeR = hr * 0.38;
  const pupilR = eyeR * 0.45;

  // Outer ring
  ctx.strokeStyle = 'rgba(168,85,247,0.6)';
  ctx.lineWidth = Math.max(2, hr * 0.06);
  ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.stroke();

  // Eye white
  const grad = ctx.createRadialGradient(ex, ey - eyeR * 0.2, eyeR * 0.1, ex, ey, eyeR);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(1, '#ddd6fe');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();

  // Pulsing iris
  const pulse = 1 + 0.15 * Math.sin(time * 0.004);
  const irisR = pupilR * 1.6 * pulse;
  const irisGrad = ctx.createRadialGradient(ex, ey, pupilR * 0.3, ex, ey, irisR);
  irisGrad.addColorStop(0, '#7c3aed');
  irisGrad.addColorStop(0.7, '#6d28d9');
  irisGrad.addColorStop(1, '#4c1d95');
  ctx.fillStyle = irisGrad;
  ctx.beginPath(); ctx.arc(ex, ey, irisR, 0, Math.PI * 2); ctx.fill();

  // Pupil
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(ex, ey, pupilR, 0, Math.PI * 2); ctx.fill();

  // Glow
  ctx.save();
  ctx.globalAlpha = 0.15 + 0.1 * Math.sin(time * 0.003);
  const glowGrad = ctx.createRadialGradient(ex, ey, eyeR, ex, ey, eyeR * 2);
  glowGrad.addColorStop(0, 'rgba(168,85,247,0.4)');
  glowGrad.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath(); ctx.arc(ex, ey, eyeR * 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLaserEyes(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, boosting, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const eyeOffset = hr * 0.45;
  const eyeR = hr * 0.18;
  const fwd = hr * 0.3;

  for (const side of [-1, 1]) {
    const ex = hx + fx * fwd + px * eyeOffset * side;
    const ey = hy + fy * fwd + py * eyeOffset * side;

    // Dark socket
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(ex, ey, eyeR * 1.2, 0, Math.PI * 2); ctx.fill();

    // Red glow
    const intensity = boosting ? 0.9 : 0.4 + 0.2 * Math.sin(time * 0.005);
    ctx.save();
    ctx.globalAlpha = intensity;
    const glowGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR * 1.5);
    glowGrad.addColorStop(0, '#ff0000');
    glowGrad.addColorStop(0.5, 'rgba(255,0,0,0.3)');
    glowGrad.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(ex, ey, eyeR * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Laser dot
    ctx.fillStyle = '#ff0000';
    ctx.beginPath(); ctx.arc(ex, ey, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();

    // Laser beam when boosting
    if (boosting) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,0,0,0.6)';
      ctx.lineWidth = Math.max(1, hr * 0.03);
      ctx.setLineDash([hr * 0.1, hr * 0.1]);
      ctx.lineDashOffset = -time * 0.05;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + fx * hr * 4, ey + fy * hr * 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

function drawDragonEyes(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const eyeOffset = hr * 0.42;
  const eyeR = hr * 0.28;
  const fwd = hr * 0.3;

  for (const side of [-1, 1]) {
    const ex = hx + fx * fwd + px * eyeOffset * side;
    const ey = hy + fy * fwd + py * eyeOffset * side;

    // Amber eye gradient
    const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR);
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(0.6, '#f59e0b');
    grad.addColorStop(1, '#92400e');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();

    // Vertical slit pupil
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeR * 0.1, eyeR * 0.7, angle, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = Math.max(1, hr * 0.04);
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawNeonEyes(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const eyeOffset = hr * 0.45;
  const eyeR = hr * 0.22;
  const fwd = hr * 0.3;

  for (const side of [-1, 1]) {
    const ex = hx + fx * fwd + px * eyeOffset * side;
    const ey = hy + fy * fwd + py * eyeOffset * side;

    // Cyan glow
    ctx.save();
    ctx.globalAlpha = 0.4;
    const glowGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR * 2);
    glowGrad.addColorStop(0, '#06b6d4');
    glowGrad.addColorStop(1, 'rgba(6,182,212,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(ex, ey, eyeR * 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Circuit outline
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = Math.max(1, hr * 0.04);
    // Square shape
    ctx.strokeRect(ex - eyeR, ey - eyeR, eyeR * 2, eyeR * 2);

    // Inner data
    ctx.fillStyle = '#06b6d4';
    const dataY = ey - eyeR * 0.5;
    for (let i = 0; i < 3; i++) {
      const w = eyeR * (0.6 + 0.3 * Math.sin(time * 0.003 + i * 2));
      ctx.fillRect(ex - w, dataY + i * eyeR * 0.4, w * 2, eyeR * 0.15);
    }
  }
}

function drawCosmicEyes(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const eyeOffset = hr * 0.42;
  const eyeR = hr * 0.3;
  const fwd = hr * 0.28;

  for (const side of [-1, 1]) {
    const ex = hx + fx * fwd + px * eyeOffset * side;
    const ey = hy + fy * fwd + py * eyeOffset * side;

    // Deep space background
    const spaceGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR);
    spaceGrad.addColorStop(0, '#0f0a2e');
    spaceGrad.addColorStop(0.5, '#1e1b4b');
    spaceGrad.addColorStop(1, '#312e81');
    ctx.fillStyle = spaceGrad;
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();

    // Swirling stars
    ctx.save();
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 8; i++) {
      const sa = time * 0.001 + i * 0.8 + side;
      const sr = eyeR * (0.2 + (i % 3) * 0.25);
      const sx = ex + Math.cos(sa) * sr;
      const sy = ey + Math.sin(sa) * sr * 0.6;
      const starR = eyeR * 0.04 * (1 + (i % 2) * 0.5);
      ctx.beginPath(); ctx.arc(sx, sy, starR, 0, Math.PI * 2); ctx.fill();
    }
    // Nebula colors
    ctx.globalAlpha = 0.3;
    const nebGrad = ctx.createRadialGradient(
      ex + Math.cos(time * 0.002) * eyeR * 0.3,
      ey + Math.sin(time * 0.002) * eyeR * 0.3, 0,
      ex, ey, eyeR,
    );
    nebGrad.addColorStop(0, '#ec4899');
    nebGrad.addColorStop(0.5, '#8b5cf6');
    nebGrad.addColorStop(1, 'rgba(59,130,246,0)');
    ctx.fillStyle = nebGrad;
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ─── MOUTH ────────────────────────────────────────────────────────────────────

function drawFangs(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const fangLen = hr * 0.4;
  const fangW = hr * 0.1;
  const mouthX = hx + fx * hr * 0.7;
  const mouthY = hy + fy * hr * 0.7;

  for (const side of [-1, 1]) {
    const baseX = mouthX + px * hr * 0.2 * side;
    const baseY = mouthY + py * hr * 0.2 * side;
    const tipX = baseX + fx * fangLen;
    const tipY = baseY + fy * fangLen;

    // Fang
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(baseX - px * fangW * side, baseY - py * fangW * side);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseX + px * fangW * side, baseY + py * fangW * side);
    ctx.closePath(); ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = Math.max(0.5, hr * 0.02);
    ctx.stroke();

    // Drip
    const dripPhase = (time * 0.002 + side * Math.PI) % (Math.PI * 2);
    const dripLen = Math.sin(dripPhase) * fangLen * 0.6;
    if (dripLen > 0) {
      ctx.fillStyle = 'rgba(34,197,94,0.6)';
      ctx.beginPath();
      ctx.ellipse(tipX + fx * dripLen * 0.5, tipY + fy * dripLen * 0.5, fangW * 0.4, dripLen * 0.5, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSmile(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const smileW = hr * 0.6;
  const smileX = hx + fx * hr * 0.6;
  const smileY = hy + fy * hr * 0.6;

  ctx.strokeStyle = '#111';
  ctx.lineWidth = Math.max(1.5, hr * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(smileX, smileY, smileW, angle - 0.8, angle + 0.8);
  ctx.stroke();
}

function drawTongue(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const tongueLen = hr * (0.6 + 0.3 * Math.sin(time * 0.008));
  const baseX = hx + fx * hr * 0.7;
  const baseY = hy + fy * hr * 0.7;
  const [px, py] = perp(angle);
  const forkSpread = hr * 0.15;

  // Main tongue
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = Math.max(1.5, hr * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX + fx * tongueLen, baseY + fy * tongueLen);
  ctx.stroke();

  // Fork
  const tipX = baseX + fx * tongueLen;
  const tipY = baseY + fy * tongueLen;
  ctx.lineWidth = Math.max(1, hr * 0.04);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + fx * forkSpread + px * forkSpread, tipY + fy * forkSpread + py * forkSpread);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + fx * forkSpread - px * forkSpread, tipY + fy * forkSpread - py * forkSpread);
  ctx.stroke();
}

function drawSaberJaw(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const jawW = hr * 0.7;
  const fangLen = hr * 0.8;
  const jawX = hx + fx * hr * 0.5;
  const jawY = hy + fy * hr * 0.5;

  // Jaw line
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = Math.max(1, hr * 0.03);
  ctx.beginPath();
  ctx.moveTo(jawX - px * jawW, jawY - py * jawW);
  ctx.lineTo(jawX + px * jawW, jawY + py * jawW);
  ctx.stroke();

  // Two massive fangs
  for (const side of [-1, 1]) {
    const bx = jawX + px * jawW * 0.6 * side;
    const by = jawY + py * jawW * 0.6 * side;

    // Fang shape
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(bx - px * hr * 0.06 * side, by - py * hr * 0.06 * side);
    ctx.lineTo(bx + fx * fangLen, by + fy * fangLen);
    ctx.lineTo(bx + px * hr * 0.06 * side, by + py * hr * 0.06 * side);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(245,158,11,0.6)';
    ctx.lineWidth = Math.max(0.5, hr * 0.02);
    ctx.stroke();

    // Glow
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.1 * Math.sin(time * 0.004);
    const glowGrad = ctx.createRadialGradient(bx, by, 0, bx, by, fangLen * 0.6);
    glowGrad.addColorStop(0, 'rgba(245,158,11,0.5)');
    glowGrad.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(bx, by, fangLen * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawVoidMaw(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const mouthX = hx + fx * hr * 0.65;
  const mouthY = hy + fy * hr * 0.65;
  const mawR = hr * 0.35;

  // Swirling void
  ctx.save();
  const voidGrad = ctx.createRadialGradient(mouthX, mouthY, 0, mouthX, mouthY, mawR);
  voidGrad.addColorStop(0, '#000');
  voidGrad.addColorStop(0.7, '#1e1b4b');
  voidGrad.addColorStop(1, 'rgba(99,102,241,0.3)');
  ctx.fillStyle = voidGrad;
  ctx.beginPath(); ctx.arc(mouthX, mouthY, mawR, 0, Math.PI * 2); ctx.fill();

  // Spiral
  ctx.strokeStyle = 'rgba(168,85,247,0.5)';
  ctx.lineWidth = Math.max(1, hr * 0.03);
  ctx.beginPath();
  for (let t = 0; t < 100; t++) {
    const theta = t * 0.15 + time * 0.003;
    const r = t * mawR * 0.01;
    if (r > mawR) break;
    const sx = mouthX + Math.cos(theta) * r;
    const sy = mouthY + Math.sin(theta) * r;
    if (t === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.restore();
}

// ─── EARS / HEADGEAR ──────────────────────────────────────────────────────────

function drawBunnyEars(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const earLen = hr * 1.0;
  const earW = hr * 0.28;
  const baseX = hx - fx * hr * 0.2;
  const baseY = hy - fy * hr * 0.2;
  const bounce = Math.sin(time * 0.006) * hr * 0.05;

  for (const side of [-1, 1]) {
    const bx = baseX + px * hr * 0.25 * side;
    const by = baseY + py * hr * 0.25 * side;

    // Outer ear (pink)
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.ellipse(bx - fx * earLen * 0.5 + px * side * earW * 0.3 + bounce * side, by - fy * earLen * 0.5 + py * side * earW * 0.3, earW, earLen * 0.5, angle + side * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244,63,94,0.4)';
    ctx.lineWidth = Math.max(0.5, hr * 0.02);
    ctx.stroke();

    // Inner ear (lighter pink)
    ctx.fillStyle = '#fecdd3';
    ctx.beginPath();
    ctx.ellipse(bx - fx * earLen * 0.45 + px * side * earW * 0.3 + bounce * side, by - fy * earLen * 0.45 + py * side * earW * 0.3, earW * 0.5, earLen * 0.35, angle + side * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCatEars(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const earH = hr * 0.55;
  const earW = hr * 0.35;
  const baseX = hx - fx * hr * 0.15;
  const baseY = hy - fy * hr * 0.15;

  for (const side of [-1, 1]) {
    const cx = baseX + px * hr * 0.3 * side;
    const cy = baseY + py * hr * 0.3 * side;

    // Outer ear
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(cx + px * earW * side, cy + py * earW * side);
    ctx.lineTo(cx - fx * earH + px * earW * 0.1 * side, cy - fy * earH + py * earW * 0.1 * side);
    ctx.lineTo(cx - fx * earH * 0.2 - px * earW * 0.3 * side, cy - fy * earH * 0.2 - py * earW * 0.3 * side);
    ctx.closePath(); ctx.fill();

    // Inner pink
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.moveTo(cx + px * earW * 0.6 * side, cy + py * earW * 0.6 * side);
    ctx.lineTo(cx - fx * earH * 0.7 + px * earW * 0.05 * side, cy - fy * earH * 0.7 + py * earW * 0.05 * side);
    ctx.lineTo(cx - fx * earH * 0.3 - px * earW * 0.15 * side, cy - fy * earH * 0.3 - py * earW * 0.15 * side);
    ctx.closePath(); ctx.fill();
  }
}

function drawDemonHorns(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const hornLen = hr * 0.9;
  const baseX = hx - fx * hr * 0.1;
  const baseY = hy - fy * hr * 0.1;

  for (const side of [-1, 1]) {
    const bx = baseX + px * hr * 0.3 * side;
    const by = baseY + py * hr * 0.3 * side;
    const tipX = bx - fx * hornLen + px * side * hr * 0.3;
    const tipY = by - fy * hornLen + py * side * hr * 0.3;
    const ctrlX = bx - fx * hornLen * 0.6 + px * side * hr * 0.05;
    const ctrlY = by - fy * hornLen * 0.6 + py * side * hr * 0.05;

    // Horn
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = Math.max(3, hr * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    ctx.stroke();

    // Glow at tip
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.2 * Math.sin(time * 0.005);
    const glowGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, hr * 0.3);
    glowGrad.addColorStop(0, '#ef4444');
    glowGrad.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(tipX, tipY, hr * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawCrown(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const crownW = hr * 0.7;
  const crownH = hr * 0.45;
  const cx = hx - fx * hr * 0.6;
  const cy = hy - fy * hr * 0.6;
  const sparkle = 0.8 + 0.2 * Math.sin(time * 0.004);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Crown base
  const grad = ctx.createLinearGradient(0, -crownH, 0, 0);
  grad.addColorStop(0, `rgba(251,191,36,${sparkle})`);
  grad.addColorStop(1, 'rgba(180,83,9,0.9)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-crownW, 0);
  ctx.lineTo(-crownW, -crownH * 0.4);
  ctx.lineTo(-crownW * 0.5, -crownH * 0.7);
  ctx.lineTo(0, -crownH);
  ctx.lineTo(crownW * 0.5, -crownH * 0.7);
  ctx.lineTo(crownW, -crownH * 0.4);
  ctx.lineTo(crownW, 0);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = 'rgba(120,53,15,0.6)';
  ctx.lineWidth = Math.max(1, hr * 0.03);
  ctx.stroke();

  // Gems — typed as tuples so gx/gy stay numbers and col stays string
  const gems: [number, number, string][] = [[-crownW * 0.5, -crownH * 0.5, '#ef4444'], [0, -crownH * 0.8, '#3b82f6'], [crownW * 0.5, -crownH * 0.5, '#22c55e']];
  for (const [gx, gy, col] of gems) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(gx, gy, hr * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function drawHalo(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const haloR = hr * 0.65;
  const floatY = Math.sin(time * 0.003) * hr * 0.08;
  const [fx, fy] = forward(angle);
  const cx = hx - fx * hr * 0.7;
  const cy = hy - fy * hr * 0.7 + floatY;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Glow
  ctx.globalAlpha = 0.3;
  const glowGrad = ctx.createRadialGradient(0, 0, haloR * 0.6, 0, 0, haloR * 1.5);
  glowGrad.addColorStop(0, 'rgba(251,191,36,0.5)');
  glowGrad.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath(); ctx.arc(0, 0, haloR * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Ring
  const ringGrad = ctx.createLinearGradient(-haloR, -hr * 0.08, haloR, hr * 0.08);
  ringGrad.addColorStop(0, '#fbbf24');
  ringGrad.addColorStop(0.5, '#fef3c7');
  ringGrad.addColorStop(1, '#f59e0b');
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = Math.max(2, hr * 0.07);
  ctx.beginPath();
  ctx.ellipse(0, 0, haloR, haloR * 0.25, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ─── WINGS ─────────────────────────────────────────────────────────────────────

function drawAngelWings(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const wingSpan = hr * 1.5;
  const flapAngle = Math.sin(time * 0.005) * 0.3;

  for (const side of [-1, 1]) {
    const baseX = hx - fx * hr * 0.3 + px * hr * 0.1 * side;
    const baseY = hy - fy * hr * 0.3 + py * hr * 0.1 * side;
    const tipX = baseX + px * wingSpan * side - fx * hr * 0.3;
    const tipY = baseY + py * wingSpan * side - fy * hr * 0.3;
    const midX = baseX + px * wingSpan * 0.5 * side - fx * hr * (0.8 + flapAngle);
    const midY = baseY + py * wingSpan * 0.5 * side - fy * hr * (0.8 + flapAngle);

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = 'rgba(203,213,225,0.6)';
    ctx.lineWidth = Math.max(0.5, hr * 0.02);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(baseX + px * wingSpan * 0.3 * side - fx * hr * 0.5, baseY + py * wingSpan * 0.3 * side - fy * hr * 0.5, baseX, baseY);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function drawBatWings(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const wingSpan = hr * 1.6;
  const flapAngle = Math.sin(time * 0.006) * 0.2;

  for (const side of [-1, 1]) {
    const baseX = hx - fx * hr * 0.2;
    const baseY = hy - fy * hr * 0.2;

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = 'rgba(139,92,246,0.5)';
    ctx.lineWidth = Math.max(0.5, hr * 0.02);
    ctx.beginPath();
    // Main wing shape
    ctx.moveTo(baseX, baseY);
    const tipX = baseX + px * wingSpan * side;
    const tipY = baseY + py * wingSpan * side - fy * hr * (0.4 + flapAngle);
    ctx.lineTo(tipX, tipY);
    // Scalloped edge
    const scallops = 3;
    for (let i = scallops; i >= 0; i--) {
      const t = i / scallops;
      const sx = baseX + px * wingSpan * t * side - fx * hr * 0.3;
      const sy = baseY + py * wingSpan * t * side - fy * hr * 0.3;
      ctx.lineTo(sx - fx * hr * 0.2, sy - fy * hr * 0.2);
      if (i > 0) {
        const nx = baseX + px * wingSpan * ((i - 0.5) / scallops) * side - fx * hr * 0.3;
        const ny = baseY + py * wingSpan * ((i - 0.5) / scallops) * side - fy * hr * 0.3;
        ctx.lineTo(nx, ny);
      }
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Vein lines
    ctx.strokeStyle = 'rgba(139,92,246,0.3)';
    ctx.lineWidth = Math.max(0.5, hr * 0.015);
    for (let v = 1; v <= 3; v++) {
      const t = v * 0.25;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + px * wingSpan * t * side - fx * hr * (0.3 + flapAngle * t), baseY + py * wingSpan * t * side - fy * hr * (0.3 + flapAngle * t));
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDragonWings(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const wingSpan = hr * 1.8;
  const flapAngle = Math.sin(time * 0.004) * 0.25;

  for (const side of [-1, 1]) {
    const baseX = hx - fx * hr * 0.2;
    const baseY = hy - fy * hr * 0.2;

    ctx.save();
    ctx.globalAlpha = 0.65;
    const wingGrad = ctx.createLinearGradient(baseX, baseY, baseX + px * wingSpan * side, baseY + py * wingSpan * side);
    wingGrad.addColorStop(0, '#78350f');
    wingGrad.addColorStop(0.5, '#b45309');
    wingGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = wingGrad;
    ctx.strokeStyle = 'rgba(180,83,9,0.6)';
    ctx.lineWidth = Math.max(0.5, hr * 0.02);

    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    const tipX = baseX + px * wingSpan * side - fx * hr * (0.5 + flapAngle);
    const tipY = baseY + py * wingSpan * side - fy * hr * (0.5 + flapAngle);
    ctx.lineTo(tipX, tipY);
    // Finger bones
    for (let b = 2; b >= 0; b--) {
      const t = (b + 1) / 4;
      const bx = baseX + px * wingSpan * t * side - fx * hr * (0.4 + flapAngle * t);
      const by = baseY + py * wingSpan * t * side - fy * hr * (0.4 + flapAngle * t);
      ctx.lineTo(bx - fx * hr * 0.25, by - fy * hr * 0.25);
      ctx.lineTo(bx - fx * hr * 0.1, by - fy * hr * 0.1);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function drawJetBoosters(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, boosting, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);

  for (const side of [-1, 1]) {
    const bx = hx - fx * hr * 0.4 + px * hr * 0.5 * side;
    const by = hy - fy * hr * 0.4 + py * hr * 0.5 * side;

    // Booster body
    ctx.fillStyle = '#374151';
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = Math.max(0.5, hr * 0.03);
    ctx.beginPath();
    ctx.ellipse(bx, by, hr * 0.18, hr * 0.25, angle + side * 0.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Flame when boosting
    if (boosting) {
      const flameLen = hr * (0.5 + 0.3 * Math.sin(time * 0.02));
      const flameGrad = ctx.createLinearGradient(bx, by, bx - fx * flameLen, by - fy * flameLen);
      flameGrad.addColorStop(0, '#fbbf24');
      flameGrad.addColorStop(0.3, '#f97316');
      flameGrad.addColorStop(0.7, '#ef4444');
      flameGrad.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.ellipse(bx - fx * flameLen * 0.5, by - fy * flameLen * 0.5, hr * 0.12, flameLen * 0.5, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPhoenixWings(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const [px, py] = perp(angle);
  const wingSpan = hr * 1.7;
  const flapAngle = Math.sin(time * 0.006) * 0.2;

  for (const side of [-1, 1]) {
    const baseX = hx - fx * hr * 0.2;
    const baseY = hy - fy * hr * 0.2;

    ctx.save();
    ctx.globalAlpha = 0.7;

    // Fire wing shape
    const tipX = baseX + px * wingSpan * side - fx * hr * (0.4 + flapAngle);
    const tipY = baseY + py * wingSpan * side - fy * hr * (0.4 + flapAngle);

    // Outer fire
    const fireGrad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    fireGrad.addColorStop(0, '#fbbf24');
    fireGrad.addColorStop(0.4, '#f97316');
    fireGrad.addColorStop(0.7, '#ef4444');
    fireGrad.addColorStop(1, 'rgba(239,68,68,0.3)');
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(
      baseX + px * wingSpan * 0.6 * side - fx * hr * (0.7 + flapAngle),
      baseY + py * wingSpan * 0.6 * side - fy * hr * (0.7 + flapAngle),
      tipX, tipY
    );
    ctx.quadraticCurveTo(
      baseX + px * wingSpan * 0.3 * side - fx * hr * 0.3,
      baseY + py * wingSpan * 0.3 * side - fy * hr * 0.3,
      baseX, baseY
    );
    ctx.fill();

    // Inner bright core
    ctx.globalAlpha = 0.5;
    const coreGrad = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, wingSpan * 0.6);
    coreGrad.addColorStop(0, '#fef3c7');
    coreGrad.addColorStop(0.5, '#fbbf24');
    coreGrad.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(baseX + px * wingSpan * 0.3 * side, baseY + py * wingSpan * 0.3 * side, wingSpan * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ─── NOSE ─────────────────────────────────────────────────────────────────────

function drawPigSnout(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  const [fx, fy] = forward(angle);
  const nx = hx + fx * hr * 0.8;
  const ny = hy + fy * hr * 0.8;
  const snoutR = hr * 0.22;

  // Snout oval
  const grad = ctx.createRadialGradient(nx, ny, snoutR * 0.2, nx, ny, snoutR);
  grad.addColorStop(0, '#fda4af');
  grad.addColorStop(1, '#e11d48');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(nx, ny, snoutR, snoutR * 0.7, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,18,60,0.5)';
  ctx.lineWidth = Math.max(0.5, hr * 0.02);
  ctx.stroke();

  // Nostrils
  for (const side of [-1, 1]) {
    const [px, py] = perp(angle);
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.ellipse(nx + px * snoutR * 0.3 * side, ny + py * snoutR * 0.3 * side, snoutR * 0.12, snoutR * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClownNose(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  const [fx, fy] = forward(angle);
  const nx = hx + fx * hr * 0.85;
  const ny = hy + fy * hr * 0.85;
  const noseR = hr * 0.2;

  // 3D sphere effect
  const grad = ctx.createRadialGradient(nx - noseR * 0.3, ny - noseR * 0.3, noseR * 0.1, nx, ny, noseR);
  grad.addColorStop(0, '#fca5a5');
  grad.addColorStop(0.7, '#ef4444');
  grad.addColorStop(1, '#991b1b');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(nx, ny, noseR, 0, Math.PI * 2); ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.arc(nx - noseR * 0.3, ny - noseR * 0.3, noseR * 0.3, 0, Math.PI * 2); ctx.fill();
}

function drawGemNose(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const nx = hx + fx * hr * 0.75;
  const ny = hy + fy * hr * 0.75;
  const gemR = hr * 0.18;
  const sparkle = 0.7 + 0.3 * Math.sin(time * 0.005);

  // Diamond shape
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(angle);

  ctx.fillStyle = `rgba(220,38,38,${sparkle})`;
  ctx.beginPath();
  ctx.moveTo(0, -gemR);
  ctx.lineTo(gemR * 0.7, 0);
  ctx.lineTo(0, gemR);
  ctx.lineTo(-gemR * 0.7, 0);
  ctx.closePath(); ctx.fill();

  // Facets
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = Math.max(0.5, hr * 0.015);
  ctx.beginPath();
  ctx.moveTo(0, -gemR); ctx.lineTo(0, gemR);
  ctx.moveTo(-gemR * 0.7, 0); ctx.lineTo(gemR * 0.7, 0);
  ctx.stroke();

  // Sparkle
  ctx.globalAlpha = sparkle;
  const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, gemR * 2);
  glowGrad.addColorStop(0, 'rgba(220,38,38,0.4)');
  glowGrad.addColorStop(1, 'rgba(220,38,38,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath(); ctx.arc(0, 0, gemR * 2, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawThirdEye(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  const [fx, fy] = forward(angle);
  const ex = hx + fx * hr * 0.55;
  const ey = hy + fy * hr * 0.55;
  const eyeR = hr * 0.22;

  // Glow
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 0.003);
  const outerGlow = ctx.createRadialGradient(ex, ey, eyeR, ex, ey, eyeR * 3);
  outerGlow.addColorStop(0, 'rgba(168,85,247,0.6)');
  outerGlow.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath(); ctx.arc(ex, ey, eyeR * 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Eye
  const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR);
  grad.addColorStop(0, '#c084fc');
  grad.addColorStop(0.5, '#8b5cf6');
  grad.addColorStop(1, '#4c1d95');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();

  // Pupil
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(ex, ey, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();

  // Inner ring
  ctx.strokeStyle = 'rgba(192,132,252,0.6)';
  ctx.lineWidth = Math.max(0.5, hr * 0.02);
  ctx.beginPath(); ctx.arc(ex, ey, eyeR * 0.7, 0, Math.PI * 2); ctx.stroke();
}

// ─── HAT DRAW FUNCTIONS ────────────────────────────────────────────────────

function drawHatCrown(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const w = hr * 1.2, h = hr * 0.7, baseY = -hr * 0.85;
  // Crown base
   ctx.fillStyle = '#FFD700';
  ctx.beginPath();
   ctx.moveTo(-w / 2, baseY); ctx.lineTo(-w / 2, baseY - h * 0.3);
   ctx.lineTo(-w / 3, baseY - h * 0.7); ctx.lineTo(-w / 6, baseY - h * 0.35);
   ctx.lineTo(0, baseY - h); ctx.lineTo(w / 6, baseY - h * 0.35);
   ctx.lineTo(w / 3, baseY - h * 0.7); ctx.lineTo(w / 2, baseY - h * 0.3);
  ctx.lineTo(w / 2, baseY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#B8860B'; ctx.lineWidth = Math.max(1, hr * 0.04); ctx.stroke();
  // Gems
  ctx.fillStyle = '#DC143C';
  for (const x of [-w / 4, 0, w / 4]) {
    ctx.beginPath(); ctx.arc(x, baseY - h * 0.35, hr * 0.08, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawTopHat(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const w = hr * 1.1, h = hr * 1.0;
  // Brim
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(0, -hr * 0.8, w * 0.8, hr * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  // Top
  ctx.fillRect(-w / 2, -hr * 0.8 - h, w, h);
  // Band
  ctx.fillStyle = '#8B0000';
  ctx.fillRect(-w / 2, -hr * 0.8 - h * 0.25, w, h * 0.15);
  ctx.restore();
}

function drawCap(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const w = hr * 1.2;
  // Cap dome
  ctx.fillStyle = '#2563EB';
  ctx.beginPath(); ctx.arc(0, -hr * 0.7, w * 0.55, Math.PI, 0); ctx.fill();
  // Brim
  ctx.fillStyle = '#1E40AF';
  ctx.fillRect(-w * 0.7, -hr * 0.72, w * 1.4, hr * 0.12);
  // Button
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(0, -hr * 0.7 - w * 0.52, hr * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawWizardHat(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const h = hr * 1.4, w = hr * 1.0;
  // Cone
  const grad = ctx.createLinearGradient(0, -hr * 0.8 - h, 0, -hr * 0.8);
  grad.addColorStop(0, '#4C1D95'); grad.addColorStop(1, '#7C3AED');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -hr * 0.8); ctx.lineTo(0, -hr * 0.8 - h); ctx.lineTo(w / 2, -hr * 0.8);
  ctx.closePath(); ctx.fill();
  // Brim
  ctx.fillStyle = '#4C1D95';
  ctx.beginPath(); ctx.ellipse(0, -hr * 0.8, w * 0.75, hr * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  // Stars
  ctx.fillStyle = '#FBBF24';
  for (let i = 0; i < 3; i++) {
    const sx = (i - 1) * hr * 0.25;
    const sy = -hr * 0.8 - h * 0.4 - i * hr * 0.2;
    const twinkle = 0.5 + 0.5 * Math.sin((time || 0) * 0.003 + i * 2);
    ctx.globalAlpha = twinkle;
    ctx.beginPath(); ctx.arc(sx, sy, hr * 0.06, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPartyHat(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const h = hr * 1.2, w = hr * 0.8;
  // Striped cone
  const colors = ['#EF4444', '#FBBF24', '#22C55E', '#3B82F6', '#A855F7'];
  const stripeH = h / colors.length;
  for (let i = 0; i < colors.length; i++) {
    const topY = -hr * 0.8 - h + i * stripeH;
    const topW = w * ((h - (i * stripeH)) / h) * 0.5;
    const botW = w * ((h - ((i + 1) * stripeH)) / h) * 0.5;
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(-topW, topY); ctx.lineTo(topW, topY);
    ctx.lineTo(botW, topY + stripeH); ctx.lineTo(-botW, topY + stripeH);
    ctx.closePath(); ctx.fill();
  }
  // Pom pom
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(0, -hr * 0.8 - h, hr * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawVikingHelmet(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const w = hr * 1.1, h = hr * 0.6;
  // Dome
  ctx.fillStyle = '#9CA3AF';
  ctx.beginPath(); ctx.arc(0, -hr * 0.8, w * 0.55, Math.PI, 0); ctx.fill();
  ctx.fillRect(-w * 0.55, -hr * 0.8, w * 1.1, h * 0.3);
  // Nose guard
  ctx.strokeStyle = '#6B7280'; ctx.lineWidth = Math.max(1, hr * 0.05);
  ctx.beginPath(); ctx.moveTo(0, -hr * 0.8 - w * 0.2); ctx.lineTo(0, -hr * 0.5); ctx.stroke();
  // Horns
  ctx.fillStyle = '#FDE68A';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * w * 0.5, -hr * 0.7);
    ctx.quadraticCurveTo(side * w * 0.8, -hr * 0.5, side * w * 0.6, -hr * 0.3);
    ctx.quadraticCurveTo(side * w * 0.45, -hr * 0.5, side * w * 0.5, -hr * 0.7);
    ctx.fill();
  }
  ctx.restore();
}

function drawSantaHat(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const w = hr * 1.0, h = hr * 1.0;
  // Red body
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -hr * 0.75);
  ctx.quadraticCurveTo(-w * 0.1, -hr * 0.75 - h * 0.7, w * 0.2 + Math.sin((time || 0) * 0.002) * hr * 0.1, -hr * 0.75 - h);
  ctx.lineTo(w * 0.5, -hr * 0.75);
  ctx.closePath(); ctx.fill();
  // White trim
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(0, -hr * 0.75, w * 0.6, hr * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  // Pom pom
  ctx.beginPath(); ctx.arc(w * 0.2 + Math.sin((time || 0) * 0.002) * hr * 0.1, -hr * 0.75 - h, hr * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ─── GOGGLE DRAW FUNCTIONS ───────────────────────────────────────────────

function drawPilotGoggles(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const [fx] = forward(angle); const [px] = perp(angle);
  const r = hr * 0.22;
  for (const side of [-1, 1]) {
    const ex = hr * 0.3 + px * hr * 0.3 * side;
    const ey = -hr * 0.15;
    // Brass rim
    ctx.fillStyle = '#B8860B';
    ctx.beginPath(); ctx.arc(ex, ey, r * 1.3, 0, Math.PI * 2); ctx.fill();
    // Lens
    ctx.fillStyle = 'rgba(100, 180, 255, 0.5)';
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(ex - r * 0.3, ey - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  // Bridge
  ctx.strokeStyle = '#B8860B'; ctx.lineWidth = Math.max(1, hr * 0.04);
  ctx.beginPath(); ctx.moveTo(-hr * 0.08, -hr * 0.15); ctx.lineTo(hr * 0.08, -hr * 0.15); ctx.stroke();
  ctx.restore();
}

function drawCyberVisor(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle, time } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const w = hr * 0.9, h = hr * 0.25;
  // Visor body
  ctx.fillStyle = 'rgba(0, 255, 200, 0.2)';
  ctx.strokeStyle = '#00FFC8'; ctx.lineWidth = Math.max(1, hr * 0.05);
  ctx.beginPath(); ctx.roundRect(-w / 2, -hr * 0.35, w, h, hr * 0.08); ctx.fill(); ctx.stroke();
  // Scan line
  const scanX = -w / 2 + ((time || 0) * 0.05 % w);
  ctx.strokeStyle = 'rgba(0, 255, 200, 0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(scanX, -hr * 0.35); ctx.lineTo(scanX, -hr * 0.35 + h); ctx.stroke();
  ctx.restore();
}

function drawCoolShades(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const w = hr * 0.38, h = hr * 0.22, gap = hr * 0.1;
  for (const side of [-1, 1]) {
    const lx = side * (w / 2 + gap / 2);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.roundRect(lx - w / 2, -hr * 0.3, w, h, hr * 0.05); ctx.fill();
    // Lens glare
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(lx - w / 2 + w * 0.1, -hr * 0.3 + h * 0.15, w * 0.3, h * 0.3, 1); ctx.fill();
  }
  // Bridge
  ctx.strokeStyle = '#333'; ctx.lineWidth = Math.max(1, hr * 0.04);
  ctx.beginPath(); ctx.moveTo(-gap / 2, -hr * 0.22); ctx.lineTo(gap / 2, -hr * 0.22); ctx.stroke();
  ctx.restore();
}

function drawMonocle(ctx: CanvasRenderingContext2D, p: CosmeticDrawParams) {
  const { hx, hy, hr, angle } = p;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(angle);
  const r = hr * 0.25;
  const mx = hr * 0.25;
  // Lens
  ctx.strokeStyle = '#B8860B'; ctx.lineWidth = Math.max(1, hr * 0.05);
  ctx.fillStyle = 'rgba(200, 230, 255, 0.2)';
  ctx.beginPath(); ctx.arc(mx, -hr * 0.15, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Chain
  ctx.strokeStyle = '#B8860B'; ctx.lineWidth = Math.max(0.5, hr * 0.02);
  ctx.beginPath(); ctx.moveTo(mx, -hr * 0.15 + r); ctx.lineTo(mx + hr * 0.1, hr * 0.5); ctx.stroke();
  ctx.restore();
}

// ─── EQUIPPED COSMETICS STATE ─────────────────────────────────────────────────

const EQUIPPED_KEY = 'venom_equipped_cosmetics';

export interface EquippedCosmetics {
  eyes: string;   // cosmetic id or 'default'
  mouth: string;
  ears: string;
  wings: string;
  nose: string;
  hat: string;
  goggles: string;
}

const DEFAULT_EQUIPPED: EquippedCosmetics = {
  eyes: 'none',
  mouth: 'mouth-none',
  ears: 'ear-none',
  wings: 'wing-none',
  nose: 'nose-none',
  hat: 'hat-none',
  goggles: 'goggles-none',
};

export function readEquippedCosmetics(): EquippedCosmetics {
  if (typeof window === 'undefined') return DEFAULT_EQUIPPED;
  try {
    const raw = localStorage.getItem(EQUIPPED_KEY);
    if (raw) return { ...DEFAULT_EQUIPPED, ...JSON.parse(raw) };
  } catch { /* fall through */ }
  return DEFAULT_EQUIPPED;
}

export function writeEquippedCosmetics(state: EquippedCosmetics): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EQUIPPED_KEY, JSON.stringify(state));
}

/** Render all equipped cosmetics on the snake head */
export function renderEquippedCosmetics(
  ctx: CanvasRenderingContext2D,
  params: CosmeticDrawParams,
): void {
  const equipped = readEquippedCosmetics();
  const slots: CosmeticSlot[] = ['wings', 'ears', 'hat', 'goggles', 'mouth', 'nose', 'eyes']; // back-to-front
  for (const slot of slots) {
    const id = equipped[slot];
    if (!id || id === 'none') continue;
    const cosmetic = getCosmeticById(id);
    if (cosmetic) cosmetic.draw(ctx, params);
  }
}
