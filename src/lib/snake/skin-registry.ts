// ============================================================================
// Skin Registry — SHARED — used by both offline and online modes.
// ============================================================================

import type { SkinAsset, SkinRarity } from './types';
import { ALL_COSMETICS, PASS_FREE_COSMETICS, PASS_ELITE_COSMETICS } from '@/lib/game-config';
import type { Skin } from '@/lib/game-config';
import { SLITHER_PRESETS, CUSTOM_SKIN_KEY } from '@/components/panels/cosmetics/cosmetics-types';
import type { CustomSkinState } from '@/components/panels/cosmetics/cosmetics-types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Lighten a hex color by factor (0–1) */
function lightenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const nr = Math.round(r + (255 - r) * factor);
  const ng = Math.round(g + (255 - g) * factor);
  const nb = Math.round(b + (255 - b) * factor);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/** Darken a hex color by factor (0–1) */
function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const nr = Math.round(r * (1 - factor));
  const ng = Math.round(g * (1 - factor));
  const nb = Math.round(b * (1 - factor));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/** Parse hex to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Determine rarity based on cost */
function rarityFromCost(cost: number): SkinRarity {
  if (cost === 0) return 'common';
  if (cost <= 200) return 'common';
  if (cost <= 500) return 'rare';
  if (cost <= 1000) return 'epic';
  return 'legendary';
}

// ─── Build registry from ALL_COSMETICS ───────────────────────────────────────

/** Map from cosmetic skin ID → SkinAsset */
const cosmeticSkinMap = new Map<string, SkinAsset>();

function registerCosmeticSkin(item: Skin): void {
  const bodyColor = item.color;
  const headColor = item.secondaryColor;
  const accentColor = lightenHex(bodyColor, 0.4);
  const pattern = mapCosmeticPattern(item.pattern);
  const animation = mapCosmeticAnimation(item.pattern, item.cost);
  const rarity = rarityFromCost(item.cost);

  cosmeticSkinMap.set(item.id, {
    id: item.id,
    name: item.name,
    rarity,
    bodyColor,
    headColor,
    accentColor,
    pattern,
    animation,
  });
}

function mapCosmeticPattern(pattern?: string): SkinAsset['pattern'] {
  switch (pattern) {
    case 'neon': return 'spotted';
    case 'rainbow': return 'gradient';
    case 'camo': return 'spotted';
    case 'metallic': return 'solid';
    default: return 'solid';
  }
}

function mapCosmeticAnimation(pattern?: string, cost?: number): SkinAsset['animation'] {
  if (cost !== undefined && cost >= 1200) return 'glow';
  switch (pattern) {
    case 'neon': return 'pulse';
    case 'rainbow': return 'flow';
    default: return 'none';
  }
}

// Register all premium skins
for (const item of ALL_COSMETICS) {
  if (item.type === 'skin') registerCosmeticSkin(item);
}

// Register season pass skins
for (const item of PASS_FREE_COSMETICS) {
  if (item.type === 'skin') registerCosmeticSkin(item);
}
for (const item of PASS_ELITE_COSMETICS) {
  if (item.type === 'skin') registerCosmeticSkin(item);
}

// ─── Build registry from SLITHER_PRESETS ────────────────────────────────────

/** Map from preset ID → SkinAsset */
const presetSkinMap = new Map<string, SkinAsset>();

for (const preset of SLITHER_PRESETS) {
  const colors = preset.colors;
  const bodyColor = colors[0];
  const headColor = colors[0]; // head same as first body color
  const accentColor = colors.length > 1 ? colors[1] : lightenHex(bodyColor, 0.3);

  // Determine pattern based on shape and color count
  let pattern: SkinAsset['pattern'] = 'solid';
  if (colors.length >= 3) {
    // Multi-color → striped (alternating)
    pattern = 'striped';
  } else if (preset.shape === 'dragon' || preset.shape === 'obsidian') {
    pattern = 'spotted';
  } else if (preset.shape === 'crystal') {
    pattern = 'gradient';
  }

  presetSkinMap.set(preset.id, {
    id: preset.id,
    name: preset.name,
    rarity: 'common',
    bodyColor,
    headColor,
    accentColor,
    pattern,
    animation: preset.glow ? 'glow' : 'none',
  });
}

// ─── Built-in DEFAULT_SKINS from atlas.ts (already have SkinAsset format) ───
// These are imported from atlas.ts by the game, registered here for completeness.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get a SkinAsset for any skin ID.
 * Checks: cosmetic skins → presets → custom lab → returns default.
 */
export function getSkinAsset(skinId: string): SkinAsset {
  // 1. Check premium/cosmetic skins
  const cosmetic = cosmeticSkinMap.get(skinId);
  if (cosmetic) return cosmetic;

  // 2. Check free presets
  const preset = presetSkinMap.get(skinId);
  if (preset) return preset;

  // 3. Check DEFAULT_SKINS from atlas (those are already SkinAsset format)
  // We'll add them dynamically below

  // 4. Fallback: create a solid skin from the ID's hash if it's a custom skin
  if (skinId === 'custom-lab-skin') {
    return getCustomLabSkin();
  }

  // 5. Ultimate fallback
  return {
    id: skinId,
    name: 'Unknown Skin',
    rarity: 'common',
    bodyColor: '#22c55e',
    headColor: '#16a34a',
    accentColor: '#86efac',
    pattern: 'solid',
    animation: 'none',
  };
}

/**
 * Read the player's currently active skin as a SkinAsset.
 * Priority: custom lab/preset from localStorage > server's currentSkin.
 *
 * @param serverSkinId - The skin ID stored on the server (player.currentSkin)
 */
export function getPlayerSkinAsset(serverSkinId: string): SkinAsset {
  // Only runs client-side (called from React components)
  if (typeof window === 'undefined') {
    return getSkinAsset(serverSkinId);
  }

  // Check localStorage for custom skin override
  try {
    const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
    if (raw) {
      const state: CustomSkinState = JSON.parse(raw);
      if (state.useCustomSkin) {
        // Player has activated a custom skin (preset or DNA lab)
        if (state.currentSkin === 'custom-lab-skin') {
          return getCustomLabSkinFromState(state);
        }
        // It's a preset
        const preset = presetSkinMap.get(state.currentSkin);
        if (preset) return preset;
      }
    }
  } catch {
    // localStorage not available or corrupt — fall through
  }

  // Use server-side skin
  return getSkinAsset(serverSkinId);
}

/**
 * Get the default SkinAsset (Viper Green) for when no skin is selected.
 */
export function getDefaultSkinAsset(): SkinAsset {
  return getSkinAsset('skin-default');
}

/** Get the skinId that should be passed to the game engine */
export function getPlayerSkinId(serverSkinId: string): string {
  if (typeof window === 'undefined') return serverSkinId;

  try {
    const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
    if (raw) {
      const state: CustomSkinState = JSON.parse(raw);
      if (state.useCustomSkin) {
        return state.currentSkin; // preset id or 'custom-lab-skin'
      }
    }
  } catch { /* fall through */ }

  return serverSkinId;
}

// ─── Custom Lab Skin ─────────────────────────────────────────────────────────

/** Build a SkinAsset from the DNA Lab's custom segments in localStorage */
function getCustomLabSkin(): SkinAsset {
  try {
    const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
    if (raw) {
      const state: CustomSkinState = JSON.parse(raw);
      return getCustomLabSkinFromState(state);
    }
  } catch { /* fall through */ }

  return {
    id: 'custom-lab-skin',
    name: 'Custom Lab Skin',
    rarity: 'rare',
    bodyColor: '#06b6d4',
    headColor: '#a855f7',
    accentColor: '#22d3ee',
    pattern: 'gradient',
    animation: 'glow',
  };
}

function getCustomLabSkinFromState(state: CustomSkinState): SkinAsset {
  const segs = state.customSkinSegments;
  if (segs && segs.length > 0) {
    const bodyColor = segs[0].color;
    const headColor = segs[0].color;
    const accentColor = segs.length > 1 ? segs[1].color : lightenHex(bodyColor, 0.3);

    // Detect pattern from segment shapes
    const shapes = new Set(segs.map((s) => s.shape));
    let pattern: SkinAsset['pattern'] = 'solid';
    if (shapes.has('spike')) pattern = 'spotted';
    else if (shapes.has('diamond')) pattern = 'gradient';
    else if (shapes.has('square')) pattern = 'striped';

    // Detect glow
    const hasGlow = segs.some((s) => s.glow);

    return {
      id: 'custom-lab-skin',
      name: 'Custom Lab Skin',
      rarity: 'rare',
      bodyColor,
      headColor,
      accentColor,
      pattern,
      animation: hasGlow ? 'glow' : 'none',
    };
  }

  return {
    id: 'custom-lab-skin',
    name: 'Custom Lab Skin',
    rarity: 'rare',
    bodyColor: '#06b6d4',
    headColor: '#a855f7',
    accentColor: '#22d3ee',
    pattern: 'gradient',
    animation: 'glow',
  };
}

// ─── Multi-color pattern support ─────────────────────────────────────────────
// For presets and custom skins with multiple colors, we generate alternating
// body segment colors. The renderer uses the body region index, so we can
// create multiple atlas entries.

/**
 * Get the body color for a specific segment index of a multi-color skin.
 * Falls back to the skin's base bodyColor for single-color skins.
 */
export function getSegmentColor(skinId: string, segmentIndex: number): string | null {
  // Check presets (they have colors arrays)
  const preset = SLITHER_PRESETS.find((p) => p.id === skinId);
  if (preset) {
    return preset.colors[segmentIndex % preset.colors.length];
  }

  // Check custom lab
  if (skinId === 'custom-lab-skin' && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
      if (raw) {
        const state: CustomSkinState = JSON.parse(raw);
        const segs = state.customSkinSegments;
        if (segs && segs.length > 0) {
          return segs[segmentIndex % segs.length].color;
        }
      }
    } catch { /* fall through */ }
  }

  return null; // Use atlas default
}

/**
 * Get all registered skin IDs (for the shop to iterate).
 */
export function getAllSkinIds(): string[] {
  const ids = new Set<string>();
  for (const key of cosmeticSkinMap.keys()) ids.add(key);
  for (const key of presetSkinMap.keys()) ids.add(key);
  return [...ids];
}

/**
 * Register additional skins at runtime (e.g., DEFAULT_SKINS from atlas.ts).
 * This allows the game to register its built-in skins into the registry.
 */
export function registerSkinAsset(asset: SkinAsset): void {
  if (!cosmeticSkinMap.has(asset.id) && !presetSkinMap.has(asset.id)) {
    cosmeticSkinMap.set(asset.id, asset);
  }
}

/** List of all alternating-color skin IDs (need special per-segment rendering) */
export function isMultiColorSkin(skinId: string): boolean {
  const preset = SLITHER_PRESETS.find((p) => p.id === skinId);
  if (preset && preset.colors.length > 1) return true;
  if (skinId === 'custom-lab-skin') return true;
  return false;
}

/** Get the full colors array for a multi-color skin */
export function getSkinColors(skinId: string): string[] {
  const preset = SLITHER_PRESETS.find((p) => p.id === skinId);
  if (preset) return preset.colors;

  if (skinId === 'custom-lab-skin' && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
      if (raw) {
        const state: CustomSkinState = JSON.parse(raw);
        if (state.customSkinSegments?.length) {
          return state.customSkinSegments.map((s) => s.color);
        }
      }
    } catch { /* fall through */ }
  }

  return [];
}
