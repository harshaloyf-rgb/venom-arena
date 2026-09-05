// ============================================================================
// Skin Registry — SHARED — used by both offline and online modes.
// ============================================================================

import type { SkinAsset, SkinRarity } from './types';
import { ALL_COSMETICS, PASS_FREE_COSMETICS, PASS_ELITE_COSMETICS } from '@/lib/game-config';
import type { Skin } from '@/lib/game-config';
import { SKIN_PRESETS, CUSTOM_SKIN_KEY, LEGACY_SKIN_ALIAS, resolveLegacySkinId } from '@/components/panels/cosmetics/cosmetics-types';
import type { CustomSkinState } from '@/components/panels/cosmetics/cosmetics-types';
import { lightenHex } from '../../components/panels/cosmetics/cosmetics-utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  // FIX (hotfix-1.5): secondaryColor is optional on Skin — fall back to the
  // body color instead of leaking `undefined` into a required string field.
  const headColor = item.secondaryColor ?? bodyColor;
  const accentColor = lightenHex(bodyColor, 0.4);
  const pattern = mapCosmeticPattern(item.pattern);
  // Character-face skins are EPIC-CLEAN by product decision (2026-09-05):
  // epic badge, no legendary particle emitter, no glow/pulse animation.
  const animation = item.headStyle ? 'none' as const : mapCosmeticAnimation(item.pattern, item.cost);
  // Explicit Skin.rarity overrides the cost-derived default (cost>1000 used to
  // auto-legendary every premium skin and arm the particle emitter).
  const rarity = item.rarity ?? rarityFromCost(item.cost);

  cosmeticSkinMap.set(item.id, {
    id: item.id,
    name: item.name,
    rarity,
    bodyColor,
    headColor,
    accentColor,
    pattern,
    animation,
    // Premium character-face skins (Skin.headStyle → face id)
    headStyle: item.headStyle,
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

// ─── Build registry from SKIN_PRESETS ────────────────────────────────────

/** Map from preset ID → SkinAsset */
const presetSkinMap = new Map<string, SkinAsset>();

for (const preset of SKIN_PRESETS) {
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

// Legacy manufactured-skin ids ('skin-fish', 'skin-lion', 'skin-motorbike',
// 'skin-coin') resolve to their free preset twins so accounts that still wear
// one keep rendering it after the 2026-09-05 premium-shop relocation.
for (const [legacyId, targetId] of Object.entries(LEGACY_SKIN_ALIAS)) {
  const target = presetSkinMap.get(targetId);
  if (target && !presetSkinMap.has(legacyId)) {
    presetSkinMap.set(legacyId, { ...target, id: legacyId });
  }
}

// ─── Built-in DEFAULT_SKINS from atlas.ts (already have SkinAsset format) ───

const _defaultSkinMap = new Map<string, SkinAsset>();

/** Register the built-in default skins (called once from GameCanvas) */
export function registerDefaultSkins(skins: SkinAsset[]): void {
  for (const s of skins) {
    if (!_defaultSkinMap.has(s.id)) _defaultSkinMap.set(s.id, s);
  }
}

// ─── Custom DB Skin cache ──────────────────────────────────────────────────
// Custom skins from the inventory (saved via Genetic Lab) are stored in the DB
// and loaded into this map at runtime. The segments are stored in localStorage
// when equipped, so the game renderer can access them.

const customSkinSegmentsCache = new Map<string, { colors: string[]; segments: any[] }>();

/**
 * Register a custom skin's segment data for the renderer.
 * Called when a custom skin is equipped — stores segments in localStorage
 * and caches the colors for getSegmentColor().
 */
export function registerCustomSkinData(skinId: string, colors: string[], segments: any[]): void {
  customSkinSegmentsCache.set(skinId, { colors, segments });
}

/** Get cached custom skin segments for full rendering */
export function getCustomSkinSegments(skinId: string): any[] | null {
  return customSkinSegmentsCache.get(skinId)?.segments ?? null;
}

/** Check if a skin ID is a custom DB skin (starts with 'custom-' but not 'custom-lab-skin') */
export function isCustomDBSkin(skinId: string): boolean {
  return skinId.startsWith('custom-') && skinId !== 'custom-lab-skin';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get a SkinAsset for any skin ID.
 * Checks: cosmetic skins → presets → custom lab → custom DB skins → default.
 */
export function getSkinAsset(skinId: string): SkinAsset {
  // 1. Check premium/cosmetic skins
  const cosmetic = cosmeticSkinMap.get(skinId);
  if (cosmetic) return cosmetic;

  // 2. Check free presets
  const preset = presetSkinMap.get(skinId);
  if (preset) return preset;

  // 3. Check DEFAULT_SKINS from atlas
  const defaultSkin = _defaultSkinMap.get(skinId);
  if (defaultSkin) return defaultSkin;

  // 4. Custom lab skin from localStorage
  if (skinId === 'custom-lab-skin') {
    return getCustomLabSkin();
  }

  // 5. Custom DB skin (starts with 'custom-' and has cached data)
  if (isCustomDBSkin(skinId)) {
    const cached = customSkinSegmentsCache.get(skinId);
    if (cached?.segments?.length) {
      return buildSkinAssetFromSegments(skinId, cached.segments);
    }
  }

  // 6. Ultimate fallback
  const viper = _defaultSkinMap.get('skin-viper-green');
  if (viper) return { ...viper, id: skinId };
  return {
    id: skinId,
    name: 'Unknown Skin',
    rarity: 'common',
    bodyColor: '#22c55e',
    headColor: '#16a34a',
    accentColor: '#4ade80',
    pattern: 'gradient',
    animation: 'none',
  };
}

/**
 * Read the player's currently active skin as a SkinAsset.
 * Priority: custom skin from localStorage > server's currentSkin.
 */
export function getPlayerSkinAsset(serverSkinId: string): SkinAsset {
  if (typeof window === 'undefined') {
    return getSkinAsset(serverSkinId);
  }

  try {
    const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
    if (raw) {
      const state: CustomSkinState = JSON.parse(raw);
      if (state.useCustomSkin) {
        const matchesServer = serverSkinId === state.currentSkin;
        if (matchesServer) {
          // Custom lab skin
          if (state.currentSkin === 'custom-lab-skin') {
            return getCustomLabSkinFromState(state);
          }
          // Preset
          const preset = presetSkinMap.get(state.currentSkin);
          if (preset) return preset;
          // Custom DB skin — segments stored in localStorage via equip
          if (isCustomDBSkin(state.currentSkin) && state.customSkinSegments?.length) {
            // Register in cache so the renderer can use them
            registerCustomSkinData(
              state.currentSkin,
              state.customSkinSegments.map(s => s.color),
              state.customSkinSegments,
            );
            return buildSkinAssetFromSegments(state.currentSkin, state.customSkinSegments);
          }
        }
      }
    }
  } catch {
    // localStorage not available or corrupt
  }

  return getSkinAsset(serverSkinId);
}

// ─── Custom Lab Skin ─────────────────────────────────────────────────────────

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
    return buildSkinAssetFromSegments('custom-lab-skin', segs);
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

/** Build a SkinAsset from custom segment data */
function buildSkinAssetFromSegments(skinId: string, segs: any[]): SkinAsset {
  const bodyColor = segs[0].color;
  const headColor = segs[0].color;
  const accentColor = segs.length > 1 ? segs[1].color : lightenHex(bodyColor, 0.3);

  const shapes = new Set(segs.map((s: any) => s.shape));
  let pattern: SkinAsset['pattern'] = 'solid';
  if (shapes.has('spike')) pattern = 'spotted';
  else if (shapes.has('diamond')) pattern = 'gradient';
  else if (shapes.has('square')) pattern = 'striped';
  else if (segs.some((s: any) => s.color !== bodyColor)) pattern = 'striped';

  const hasGlow = segs.some((s: any) => s.glow);

  return {
    id: skinId,
    name: 'Custom Skin',
    rarity: 'rare',
    bodyColor,
    headColor,
    accentColor,
    pattern,
    animation: hasGlow ? 'glow' : 'none',
  };
}

// ─── Multi-color pattern support ─────────────────────────────────────────────

/**
 * Get the body color for a specific segment index of a multi-color skin.
 */
export function getSegmentColor(skinId: string, segmentIndex: number): string | null {
  // Check presets (legacy manufactured ids alias onto their preset twin)
  const preset = SKIN_PRESETS.find((p) => p.id === resolveLegacySkinId(skinId));
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

  // Check custom DB skins
  if (isCustomDBSkin(skinId)) {
    // First check localStorage (most up to date when equipped)
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(CUSTOM_SKIN_KEY);
        if (raw) {
          const state: CustomSkinState = JSON.parse(raw);
          if (state.useCustomSkin && state.currentSkin === skinId && state.customSkinSegments?.length) {
            return state.customSkinSegments[segmentIndex % state.customSkinSegments.length].color;
          }
        }
      } catch { /* fall through */ }
    }
    // Then check runtime cache
    const cached = customSkinSegmentsCache.get(skinId);
    if (cached?.colors?.length) {
      return cached.colors[segmentIndex % cached.colors.length];
    }
  }

  return null;
}

/** Register additional skins at runtime */
export function registerSkinAsset(asset: SkinAsset): void {
  if (!cosmeticSkinMap.has(asset.id) && !presetSkinMap.has(asset.id)) {
    cosmeticSkinMap.set(asset.id, asset);
  }
}

/** List of all alternating-color skin IDs (need special per-segment rendering) */
export function isMultiColorSkin(skinId: string): boolean {
  const preset = SKIN_PRESETS.find((p) => p.id === resolveLegacySkinId(skinId));
  if (preset && preset.colors.length > 1) return true;
  if (skinId === 'custom-lab-skin') return true;
  if (isCustomDBSkin(skinId)) return true;
  return false;
}
