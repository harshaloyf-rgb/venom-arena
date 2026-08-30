// ============================================================================
// SHARED GAME CONFIG — single source of truth for both Next.js API routes,
// the Socket.IO game server mini-service, and the React client.
// ============================================================================

export interface ArenaTier {
  id: string;
  name: string;
  buyIn: number;
  description: string;
  difficulty: 'Beginner' | 'Medium' | 'High Stakes' | 'Extreme' | 'Legendary';
  color: string; // tailwind classes for badges/cards
  accentColor: string; // hex
  borderAccent: string; // hex
  botsCount: number;
  rewardMultiplier: number;
  isPractice?: boolean;
}

// ── 30 ONLINE COMPETITIVE TIERS ──────────────────────────────────────────
// Buy-in: 10c → 1,000,000,000c (1 billion). Every tier has exactly 999 bots.
// Difficulty groups: Beginner (1-6) · Medium (7-12) · High Stakes (13-18) ·
//                     Extreme (19-24) · Legendary (25-30)

export const ARENA_TIERS: ArenaTier[] = [
  // ── BEGINNER (Tiers 1–6): 10c to 300c ──
  { id: 'tier-1',  name: 'Scrap Alley',      buyIn: 10,          description: 'The starting proving grounds. Low stakes, soft competition, perfect for learning the ropes.',            difficulty: 'Beginner',    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', accentColor: '#10b981', borderAccent: '#059669', botsCount: 999, rewardMultiplier: 1.0 },
  { id: 'tier-2',  name: 'Rust Market',       buyIn: 20,          description: 'A scrappy underground market arena. Slightly tougher bots patrol the dimly lit corridors.',               difficulty: 'Beginner',    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', accentColor: '#34d399', borderAccent: '#10b981', botsCount: 999, rewardMultiplier: 1.1 },
  { id: 'tier-3',  name: 'Copper Lane',        buyIn: 40,          description: 'Warm copper-lit corridors. Bots here move a bit faster — stay sharp.',                                difficulty: 'Beginner',    color: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300', accentColor: '#4ade80', borderAccent: '#22c55e', botsCount: 999, rewardMultiplier: 1.2 },
  { id: 'tier-4',  name: 'Neon Grid',          buyIn: 75,          description: 'A glowing synthwave arena where speed is key. Pulsing neon borders and quick bots.',                  difficulty: 'Beginner',    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',     accentColor: '#06b6d4', borderAccent: '#0891b2', botsCount: 999, rewardMultiplier: 1.5 },
  { id: 'tier-5',  name: 'Iron District',     buyIn: 150,         description: 'Industrial zone with moderate competition and steady food flow. Iron walls glow faintly.',            difficulty: 'Beginner',    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',     accentColor: '#22d3ee', borderAccent: '#06b6d4', botsCount: 999, rewardMultiplier: 1.8 },
  { id: 'tier-6',  name: 'Bronze Arena',       buyIn: 300,         description: 'The final beginner tier. Solid competition — prove yourself here before advancing to medium.',         difficulty: 'Beginner',    color: 'bg-teal-500/10 border-teal-500/30 text-teal-400',     accentColor: '#14b8a6', borderAccent: '#0d9488', botsCount: 999, rewardMultiplier: 2.0 },

  // ── MEDIUM (Tiers 7–12): 500c to 15,000c ──
  { id: 'tier-7',  name: 'Silver Strip',      buyIn: 500,         description: 'A polished medium-stakes corridor with balanced competition and reliable food spawns.',                 difficulty: 'Medium',      color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',   accentColor: '#f59e0b', borderAccent: '#d97706', botsCount: 999, rewardMultiplier: 2.5 },
  { id: 'tier-8',  name: 'Jade Corridor',     buyIn: 1_000,       description: 'Lush and dangerous. Mid-tier hunters roam freely through the jade-colored passages.',                   difficulty: 'Medium',      color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',   accentColor: '#fbbf24', borderAccent: '#f59e0b', botsCount: 999, rewardMultiplier: 3.0 },
  { id: 'tier-9',  name: 'Amber Crossing',    buyIn: 2_000,       description: 'A golden intersection where fortunes shift quickly. Watch for coordinated bot ambushes.',                 difficulty: 'Medium',      color: 'bg-amber-400/10 border-amber-400/30 text-amber-300',   accentColor: '#fcd34d', borderAccent: '#fbbf24', botsCount: 999, rewardMultiplier: 3.5 },
  { id: 'tier-10', name: 'Gold Quarter',      buyIn: 4_000,       description: 'Affluent territory with premium food density. Expect coordinated bot packs defending star chips.',        difficulty: 'Medium',      color: 'bg-orange-500/10 border-orange-500/30 text-orange-400', accentColor: '#f97316', borderAccent: '#ea580c', botsCount: 999, rewardMultiplier: 4.5 },
  { id: 'tier-11', name: 'Ruby Den',           buyIn: 7_500,       description: 'Deep red arena with aggressive predators and scarce food. Only the cunning survive here.',             difficulty: 'Medium',      color: 'bg-orange-500/10 border-orange-500/30 text-orange-400', accentColor: '#fb923c', borderAccent: '#f97316', botsCount: 999, rewardMultiplier: 5.5 },
  { id: 'tier-12', name: 'Sapphire Hall',     buyIn: 15_000,      description: 'Elegant but deadly. The gateway to high-stakes play — blue crystalline walls refract light.',             difficulty: 'Medium',      color: 'bg-rose-500/10 border-rose-500/30 text-rose-400',     accentColor: '#f43f5e', borderAccent: '#e11d48', botsCount: 999, rewardMultiplier: 7.0 },

  // ── HIGH STAKES (Tiers 13–18): 30,000c to 750,000c ──
  { id: 'tier-13', name: 'Viper Pit',          buyIn: 30_000,      description: 'The viper syndicate\'s den. Elite bot AI with predictive dodging starts here.',                         difficulty: 'High Stakes', color: 'bg-rose-500/10 border-rose-500/30 text-rose-400',     accentColor: '#fb7185', borderAccent: '#f43f5e', botsCount: 999, rewardMultiplier: 8.0 },
  { id: 'tier-14', name: 'Championship Hub',   buyIn: 50_000,      description: 'Championship qualifier grounds. Extraction commission is heavily contested by skilled bots.',              difficulty: 'High Stakes', color: 'bg-pink-500/10 border-pink-500/30 text-pink-400',     accentColor: '#ec4899', borderAccent: '#db2777', botsCount: 999, rewardMultiplier: 10.0 },
  { id: 'tier-15', name: 'Emerald Court',     buyIn: 100_000,     description: 'A hundred-thousand buy-in. Only serious operators enter this prestigious emerald arena.',               difficulty: 'High Stakes', color: 'bg-pink-500/10 border-pink-500/30 text-pink-400',     accentColor: '#f472b6', borderAccent: '#ec4899', botsCount: 999, rewardMultiplier: 12.0 },
  { id: 'tier-16', name: 'Diamond Nexus',      buyIn: 200_000,     description: 'Brilliant and ruthless. High-value star drops attract fierce competition from all sides.',               difficulty: 'High Stakes', color: 'bg-violet-500/10 border-violet-500/30 text-violet-400', accentColor: '#8b5cf6', borderAccent: '#7c3aed', botsCount: 999, rewardMultiplier: 15.0 },
  { id: 'tier-17', name: 'Apex Vault',         buyIn: 350_000,     description: 'Three hundred fifty thousand to enter. The apex of mid-tier competition — only veterans tread here.',      difficulty: 'High Stakes', color: 'bg-violet-500/10 border-violet-500/30 text-violet-400', accentColor: '#a78bfa', borderAccent: '#8b5cf6', botsCount: 999, rewardMultiplier: 18.0 },
  { id: 'tier-18', name: 'Obsidian Core',      buyIn: 750_000,     description: 'Dark and unforgiving obsidian arena. One wrong move costs hundreds of thousands — precision is key.',    difficulty: 'High Stakes', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400', accentColor: '#a855f7', borderAccent: '#9333ea', botsCount: 999, rewardMultiplier: 22.0 },

  // ── EXTREME (Tiers 19–24): 1,500,000c to 40,000,000c ──
  { id: 'tier-19', name: 'Crimson Abyss',      buyIn: 1_500_000,   description: 'A bottomless crimson arena where only the strongest survive. Bots are relentless hunters.',             difficulty: 'Extreme',     color: 'bg-purple-500/10 border-purple-500/30 text-purple-400', accentColor: '#c084fc', borderAccent: '#a855f7', botsCount: 999, rewardMultiplier: 28.0 },
  { id: 'tier-20', name: 'Shadow Realm',       buyIn: 3_000_000,   description: 'Shrouded in darkness. Predators hunt by prediction — stay mobile or become prey.',                    difficulty: 'Extreme',     color: 'bg-red-500/10 border-red-500/30 text-red-400',       accentColor: '#ef4444', borderAccent: '#dc2626', botsCount: 999, rewardMultiplier: 32.0 },
  { id: 'tier-21', name: 'Void Station',       buyIn: 5_000_000,   description: 'An orbital arena floating in the void. Zero room for error at a five-million buy-in.',                  difficulty: 'Extreme',     color: 'bg-red-500/10 border-red-500/30 text-red-400',       accentColor: '#f87171', borderAccent: '#ef4444', botsCount: 999, rewardMultiplier: 38.0 },
  { id: 'tier-22', name: 'Phantom Reach',      buyIn: 10_000_000,  description: 'Ghost-like operators compete for massive chip pools. Bots use advanced flanking tactics.',             difficulty: 'Extreme',     color: 'bg-red-600/10 border-red-600/30 text-red-500',       accentColor: '#dc2626', borderAccent: '#b91c1c', botsCount: 999, rewardMultiplier: 45.0 },
  { id: 'tier-23', name: 'Inferno Gate',       buyIn: 20_000_000,  description: 'Twenty million at stake. The heat is unbearable — bots charge aggressively on sight.',                 difficulty: 'Extreme',     color: 'bg-rose-600/10 border-rose-600/30 text-rose-500',     accentColor: '#e11d48', borderAccent: '#be123c', botsCount: 999, rewardMultiplier: 52.0 },
  { id: 'tier-24', name: 'Tartarus Pit',       buyIn: 40_000_000,  description: 'The deepest pit before legendary territory. Forty million to enter — only the elite survive.',         difficulty: 'Extreme',     color: 'bg-rose-600/10 border-rose-600/30 text-rose-500',     accentColor: '#f43f5e', borderAccent: '#e11d48', botsCount: 999, rewardMultiplier: 60.0 },

  // ── LEGENDARY (Tiers 25–30): 75,000,000c to 1,000,000,000c ──
  { id: 'tier-25', name: 'Venom Grand',         buyIn: 75_000_000,          description: 'The grand Venom arena. Only the wealthiest operators dare challenge at this level.',                 difficulty: 'Legendary',   color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',   accentColor: '#f59e0b', borderAccent: '#d97706', botsCount: 999, rewardMultiplier: 70.0 },
  { id: 'tier-26', name: 'Omega Station',       buyIn: 150_000_000,         description: 'A hundred fifty million to enter. The stakes defy comprehension — every second is worth thousands.',    difficulty: 'Legendary',   color: 'bg-orange-500/10 border-orange-500/30 text-orange-400', accentColor: '#f97316', borderAccent: '#ea580c', botsCount: 999, rewardMultiplier: 80.0 },
  { id: 'tier-27', name: 'Singularity Core',    buyIn: 300_000_000,         description: 'A gravitational singularity arena. Three hundred million at stake — nothing escapes its pull.',         difficulty: 'Legendary',   color: 'bg-red-500/10 border-red-500/30 text-red-400',       accentColor: '#ef4444', borderAccent: '#dc2626', botsCount: 999, rewardMultiplier: 90.0 },
  { id: 'tier-28', name: 'Eternity Vault',      buyIn: 500_000_000,         description: 'Time stands still in this vault. Five hundred million at play — patience or aggression?',             difficulty: 'Legendary',   color: 'bg-rose-600/10 border-rose-600/30 text-rose-500',   accentColor: '#e11d48', borderAccent: '#be123c', botsCount: 999, rewardMultiplier: 100.0 },
  { id: 'tier-29', name: 'Abyssal Throne',      buyIn: 750_000_000,         description: 'The throne of the abyss. Seven hundred fifty million to challenge the king of the arena.',          difficulty: 'Legendary',   color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400', accentColor: '#eab308', borderAccent: '#ca8a04', botsCount: 999, rewardMultiplier: 120.0 },
  { id: 'tier-30', name: 'The Singularity',     buyIn: 1_000_000_000,       description: 'The ultimate arena. One billion chips. Mythical territory where fortunes are made and destroyed in an instant.', difficulty: 'Legendary', color: 'bg-yellow-400/10 border-yellow-400/30 text-yellow-300', accentColor: '#facc15', borderAccent: '#eab308', botsCount: 999, rewardMultiplier: 150.0 },
];

// ── 3 PRACTICE TIERS (all FREE, 0 XP, 1000 bots each) ──

export const PRACTICE_TIERS: ArenaTier[] = [
  {
    id: 'practice-easy',
    name: 'Easy Practice Arena',
    buyIn: 0,
    description: 'A relaxed learning zone. Slow speeds, simple AI behavior, and forgiving competition.',
    difficulty: 'Beginner',
    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    accentColor: '#10b981',
    borderAccent: '#059669',
    botsCount: 1000,
    rewardMultiplier: 0.0,
    isPractice: true,
  },
  {
    id: 'practice-medium',
    name: 'Medium Practice Arena',
    buyIn: 0,
    description: 'Standard speed and balanced bot behavior. Moderate competition for warming up.',
    difficulty: 'Medium',
    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    accentColor: '#06b6d4',
    borderAccent: '#0891b2',
    botsCount: 1000,
    rewardMultiplier: 0.0,
    isPractice: true,
  },
  {
    id: 'practice-hard',
    name: 'Hard Practice Arena',
    buyIn: 0,
    description: 'Aggressive bot hunters. Dynamic speed, tight maneuvers, and heavy competition.',
    difficulty: 'High Stakes',
    color: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    accentColor: '#f43f5e',
    borderAccent: '#e11d48',
    botsCount: 1000,
    rewardMultiplier: 0.0,
    isPractice: true,
  },
];

export const ALL_ARENAS: ArenaTier[] = [...ARENA_TIERS, ...PRACTICE_TIERS];

export function getArenaById(id: string): ArenaTier | undefined {
  return ALL_ARENAS.find((a) => a.id === id);
}

// ----------------------------------------------------------------------------
// Cosmetics
// ----------------------------------------------------------------------------
export type CosmeticType = 'skin';
export type SkinPattern =
  | 'rainbow'
  | 'neon'
  | 'glow'
  | 'metallic'
  | 'pulse'
  | 'zebra'
  | 'camo'
  | 'cyber';

export interface Skin {
  id: string;
  name: string;
  cost: number;
  type: CosmeticType;
  color: string;
  secondaryColor?: string;
  description: string;
  emoji?: string;
  pattern?: SkinPattern;
}

export const ALL_COSMETICS: Skin[] = [
  // ----- Skins (13) -----
  { id: 'skin-default', name: 'Toxic Slime', cost: 0, type: 'skin', color: '#22c55e', secondaryColor: '#22c55e', pattern: 'gradient', description: 'The standard issue bio-luminescent skin.', emoji: '🐍' },
  { id: 'skin-venom', name: 'Venom Stryker', cost: 40, type: 'skin', color: '#a855f7', secondaryColor: '#6b21a8', description: 'A striking royal purple skin designed to intimidate.', emoji: '👾' },
  { id: 'skin-cyber', name: 'Cyber Grid', cost: 100, type: 'skin', color: '#06b6d4', secondaryColor: '#0891b2', description: 'Futuristic grid design that flows like computer data.', emoji: '🤖' },
  { id: 'skin-fish', name: 'The Fish Snake', cost: 200, type: 'skin', color: '#06b6d4', secondaryColor: '#3b82f6', description: 'Aquatic scales with hydrodynamic dorsal fins and bubble bioluminescence.', emoji: '🐟', pattern: 'neon' },
  { id: 'skin-rainbow', name: 'Chameleon Aurora', cost: 350, type: 'skin', color: '#ec4899', secondaryColor: '#3b82f6', description: 'A high-fidelity skin that transitions smoothly through a full color spectrum.', emoji: '🌈', pattern: 'rainbow' },
  { id: 'skin-lion', name: 'The Lion Snake', cost: 350, type: 'skin', color: '#f59e0b', secondaryColor: '#b45309', description: 'Golden apex mane headpiece with furious amber predator scales.', emoji: '🦁', pattern: 'camo' },
  { id: 'skin-neonglow', name: 'Cyber Glow Pulsar', cost: 500, type: 'skin', color: '#06b6d4', secondaryColor: '#a855f7', description: 'Radiates intense neon cyberpunk particles and a glowing high-contrast energy aura.', emoji: '⚡', pattern: 'neon' },
  { id: 'skin-motorbike', name: 'The Motorbike Snake', cost: 500, type: 'skin', color: '#3b82f6', secondaryColor: '#090d16', description: 'Chrome exhaust head, asphalt dark body segments, and burnout smoke trail.', emoji: '🏍️', pattern: 'metallic' },
  { id: 'skin-metallic', name: 'Ironclad Titanium', cost: 750, type: 'skin', color: '#64748b', secondaryColor: '#475569', description: 'Sleek metallic armor plating that reflects light with heavy specularity.', emoji: '⚙️', pattern: 'metallic' },
  { id: 'skin-coin', name: 'The Coin Snake', cost: 750, type: 'skin', color: '#fbbf24', secondaryColor: '#d97706', description: 'Gold dollar medallion crown with stacked casino chip coin segments.', emoji: '🪙', pattern: 'rainbow' },
  { id: 'skin-camo', name: 'Bio-Desert Camo', cost: 900, type: 'skin', color: '#10b981', secondaryColor: '#d97706', description: 'Tactical jungle and sand digital scales to blend into toxic terrains.', emoji: '🛡️', pattern: 'camo' },
  { id: 'skin-gold', name: 'Midas Touch', cost: 1200, type: 'skin', color: '#fbbf24', secondaryColor: '#b45309', description: 'A skin layered in solid gold to boast extreme wealth.', emoji: '👑' },
  { id: 'skin-crimson', name: 'Crimson Fury', cost: 1800, type: 'skin', color: '#ef4444', secondaryColor: '#991b1b', description: 'For players who leave a trail of blood in their wake.', emoji: '🔥' },
];

export function getCosmeticById(id: string): Skin | undefined {
  return (
    ALL_COSMETICS.find((c) => c.id === id) ??
    PASS_FREE_COSMETICS.find((c) => c.id === id) ??
    PASS_ELITE_COSMETICS.find((c) => c.id === id)
  );
}

// ----------------------------------------------------------------------------
// World / physics constants
// ----------------------------------------------------------------------------
export const WORLD_SIZE = 8000;
export const WORLD_RADIUS = 4000; // center of 8000x8000 world (used for offline infinite offset)
// NOTE: Physics constants (speed, turn rate, collision, boost, etc.) are now in
// src/lib/snake/config.ts as DEFAULT_SNAKE_CONFIG. The values below are only
// the ones still referenced by non-engine code.

export const INITIAL_SPAWN_SCORE = 20; // Starting score — all food collected adds to this
export const TICK_RATE_HZ = 30;
export const TICK_MS = 1000 / TICK_RATE_HZ;
export const BROADCAST_RATE_HZ = 20;
export const BROADCAST_MS = 1000 / BROADCAST_RATE_HZ;
export const MAX_SNAPSHOTS_PER_SECOND = 20;

// ----------------------------------------------------------------------------
// Food Orb System — Three size variants
// ----------------------------------------------------------------------------
export type FoodOrbSize = 'small' | 'medium' | 'large';

export interface FoodOrbConfig {
  size: FoodOrbSize;
  value: number;  // points added to score
   radius: number; // visual radius in px
  color: string;
  glowColor: string;
}

export const FOOD_ORB_SMALL: FoodOrbConfig = {
  size: 'small',
  value: 1,
  radius: 3,
  color: '#34d399',
  glowColor: '#10b981',
};

export const FOOD_ORB_MEDIUM: FoodOrbConfig = {
  size: 'medium',
  value: 3,
  radius: 5,
  color: '#38bdf8',
  glowColor: '#0ea5e9',
};

export const FOOD_ORB_LARGE: FoodOrbConfig = {
  size: 'large',
  value: 5,
  radius: 8,
  color: '#f472b6',
  glowColor: '#ec4899',
};

export const ALL_FOOD_ORBS: FoodOrbConfig[] = [FOOD_ORB_SMALL, FOOD_ORB_MEDIUM, FOOD_ORB_LARGE];

// Food spawn distribution weights: 93% small, 4% medium, 3% large
export const FOOD_ORB_WEIGHTS: number[] = [0.93, 0.04, 0.03];

export const FOOD_DENSITY_TARGET = 800; // food count near player (density-based)
export const FOOD_VISIBLE_RADIUS = 5000; // radius around player for density check
export const FOOD_DESPAWN_RADIUS = 7000; // despawn food beyond this
export const REGULAR_FOOD_GROW = 1; // legacy alias (food value IS the grow amount)

// Star collectibles — always exactly 10 dropped on player death
export const STAR_DROP_COUNT = 10; // ALWAYS exactly 10 stars

// ----------------------------------------------------------------------------
// Dynamic Map Scaling (Online Mode)
// ----------------------------------------------------------------------------
export const MAP_MIN_RADIUS = 3000;  // radius when 1 player (doubled for comfort)
export const MAP_MAX_RADIUS = 16000;  // radius when 1000 players (DOUBLED for 1000-player density)
export const MAP_BREATH_AMPLITUDE = 40;  // breathing oscillation
export const MAP_BREATH_CYCLE_MS = 10000;
export const MAX_ARENA_PLAYERS = 1000;

/** Compute dynamic map radius based on real player count. */
export function getDynamicMapRadius(realPlayerCount: number, elapsedMs?: number): number {
  const minP = 1;
  const maxP = MAX_ARENA_PLAYERS;
  const count = Math.max(minP, Math.min(maxP, realPlayerCount));
  // sqrt scaling: 1 player -> 1500, ~31 players -> ~3000, 1000 players -> 5000
  const baseRadius = MAP_MIN_RADIUS + (MAP_MAX_RADIUS - MAP_MIN_RADIUS) * Math.sqrt((count - 1) / (maxP - 1));
  // Add breathing
  if (elapsedMs !== undefined) {
    const cycle = (elapsedMs % MAP_BREATH_CYCLE_MS) / MAP_BREATH_CYCLE_MS;
    return baseRadius + Math.sin(cycle * Math.PI * 2) * MAP_BREATH_AMPLITUDE;
  }
  return baseRadius;
}

// Legacy alias for backward compat
export const MAP_BASE_RADIUS = 3800;

// ----------------------------------------------------------------------------
// Bot Constants
// ----------------------------------------------------------------------------
export const BOT_SELF_DESTRUCT_THRESHOLD = 100; // score at which bots self-destruct (online only)
export const BOT_EVADE_RADIUS = 300; // distance at which bots start evading human players
export const BOT_FOOD_SCAN_RADIUS = 300; // how far bots scan for food

// Neck protection: first N segments behind the head are immune to head-to-body collision.
// Prevents "close call" deaths where a head barely touches the neck area.
export const NECK_PROTECTION_SEGS = 5;

// Safe spawn: minimum distance from any existing snake when spawning
export const SAFE_SPAWN_MIN_DIST = 500;
export const SAFE_SPAWN_ATTEMPTS = 30; // max attempts to find safe spawn point

// ----------------------------------------------------------------------------
// Daily rewards (7-day cycle, repeats) — original: [10,20,50,100,250,500,1000]
// ----------------------------------------------------------------------------
export const DAILY_REWARDS = [10, 20, 50, 100, 250, 500, 1000];

// ----------------------------------------------------------------------------
// Chip store packs — original: 10 packs, 100 chips = ₹1, yearly cap 25 Lakh
// ----------------------------------------------------------------------------
export interface ChipPack {
  id: string;
  name: string;
  chips: number;
  priceINR: number;
  priceUSD: string;
  bonus: string;
  desc: string;
  emoji: string;
}

export const MAX_YEARLY_BUY_CHIPS = 2500000; // 25 Lakh
export const MAX_DAILY_ADS = 12;
export const AD_REWARD_CHIPS = 100;

// Hourly micro-claims
export const HOURLY_REWARD_MIN = 10;
export const HOURLY_REWARD_MAX = 150;
export const HOURLY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Streak milestones
export const STREAK_MILESTONES: Record<number, { reward: number; title: string; emoji: string }> = {
  30:  { reward: 5_000, title: 'Iron Veteran', emoji: '🛡️' },
  60:  { reward: 15_000, title: 'Steel Sentinel', emoji: '⚔️' },
 90:  { reward: 50_000, title: 'Diamond Immortal', emoji: '👑' },
};

// Streak freeze
export const STREAK_FREEZE_COST = 500; // chips to buy one freeze
export const STREAK_FREEZE_MAX = 3; // max freezes a player can hold

// Lucky spin wheel
export const SPIN_PRIZES = [
  { min: 5, max: 20, weight: 50, tier: 'common' as const, label: '5–20c', color: 'from-slate-600 to-slate-700' },
  { min: 20, max: 50, weight: 25, tier: 'common' as const, label: '20–50c', color: 'from-emerald-700 to-emerald-800' },
  { min: 50, max: 100, weight: 12, tier: 'rare' as const, label: '50–100c', color: 'from-sky-600 to-sky-700' },
  { min: 100, max: 250, weight: 7, tier: 'rare' as const, label: '100–250c', color: 'from-violet-600 to-violet-700' },
  { min: 250, max: 500, weight: 3, tier: 'epic' as const, label: '250–500c', color: 'from-amber-500 to-amber-600' },
  { min: 500, max: 1000, weight: 2, tier: 'epic' as const, label: '500–1,000c', color: 'from-rose-500 to-rose-600' },
  { min: 1000, max: 2500, weight: 0.8, tier: 'legendary' as const, label: '1,000–2,500c', color: 'from-yellow-400 to-amber-500' },
  { min: 5000, max: 5000, weight: 0.2, tier: 'legendary' as const, label: '5,000c JACKPOT', color: 'from-yellow-300 to-yellow-400' },
];
export const SPIN_FREE_PER_DAY = 1; // free daily spin
export const SPIN_COST = 200; // chips for extra spins

// Referral
export const REFERRAL_REWARD = 2_500; // chips both players get when referred player completes 5 matches
export const REFERRAL_MATCH_THRESHOLD = 5; // matches the referred player must play

// Email verification
export const REGISTERED_STARTER_CHIPS = 150; // chips given on registration (before email verification)
export const EMAIL_VERIFY_BONUS = 850; // bonus chips after email verification (total = 1000)
export const REGISTERED_TOTAL_CHIPS = REGISTERED_STARTER_CHIPS + EMAIL_VERIFY_BONUS; // 1000

// Seasonal bonus days (UTC date strings → multiplier)
// In production, this would come from admin/game-config DB. Hardcoded for now.
export const SEASONAL_BONUS_DAYS: Record<string, { multiplier: number; label: string }> = {
  '2026-01-01': { multiplier: 2, label: '🎆 New Year Double Rewards!' },
  '2026-01-26': { multiplier: 2, label: '🇮🇳 Republic Day 2× Bonus!' },
  '2026-02-14': { multiplier: 1.5, label: '💝 Valentine\'s 1.5× Love Bonus!' },
  '2026-08-15': { multiplier: 2, label: '🇮🇳 Independence Day 2× Bonus!' },
  '2026-10-02': { multiplier: 2, label: '🇮🇳 Gandhi Jayanti 2× Bonus!' },
  '2026-12-25': { multiplier: 2, label: '🎄 Christmas 2× Rewards!' },
};

// Level-based reward multiplier (same tiers as challenges)
export function levelRewardMultiplier(level: number): number {
  if (level <= 5) return 1.0;
  if (level <= 15) return 1.5;
  if (level <= 30) return 2.5;
  return 4.0;
}

export const CHIP_PACKS: ChipPack[] = [
  { id: 'pack-10', name: 'Starter Pack', chips: 1000, priceINR: 10, priceUSD: '$0.12', bonus: 'Base Rate', desc: '1,000 Chips at 100 Chips/₹1.', emoji: '🪙' },
  { id: 'pack-50', name: 'Scout Bundle', chips: 5100, priceINR: 50, priceUSD: '$0.60', bonus: '+2% Bonus', desc: '5,100 Chips with early stakes bonus.', emoji: '💰' },
  { id: 'pack-100', name: 'Contender Sack', chips: 10500, priceINR: 100, priceUSD: '$1.20', bonus: '+5% Bonus', desc: '10,500 Chips for medium arena buy-ins.', emoji: '🎒' },
  { id: 'pack-250', name: 'Gladiator Chest', chips: 27500, priceINR: 250, priceUSD: '$3.00', bonus: '+10% Bonus', desc: '27,500 Chips for serious competitors.', emoji: '🧰', },
  { id: 'pack-500', name: 'High Roller Vault', chips: 57500, priceINR: 500, priceUSD: '$6.00', bonus: '+15% Bonus', desc: '57,500 Chips for VIP Syndicate arenas.', emoji: '💎' },
  { id: 'pack-1000', name: 'Championship Crate', chips: 120000, priceINR: 1000, priceUSD: '$12.00', bonus: '+20% Bonus', desc: '1,20,000 Chips for Apex Vault entry.', emoji: '🏆' },
  { id: 'pack-2500', name: 'Syndicate Treasury', chips: 325000, priceINR: 2500, priceUSD: '$30.00', bonus: '+30% Bonus', desc: '3,25,000 Chips for grand tournament runs.', emoji: '🏦' },
  { id: 'pack-5000', name: 'National Titan Coffer', chips: 700000, priceINR: 5000, priceUSD: '$60.00', bonus: '+40% Bonus', desc: '7,00,000 Chips for country leaderboard pushes.', emoji: '🏛️' },
  { id: 'pack-10000', name: 'World Champion Trove', chips: 1500000, priceINR: 10000, priceUSD: '$120.00', bonus: '+50% Bonus', desc: '15,00,000 Chips for global elite domination.', emoji: '🌍' },
  { id: 'pack-15000', name: 'MAX ANNUAL CAP PACK', chips: 2500000, priceINR: 15000, priceUSD: '$175.00', bonus: '+66.67% BONUS (INSTANT LOCK)', desc: '25,00,000 Chips! Reaches ₹15,000 annual spending cap and locks store for 365 days.', emoji: '👑' },
];

// Promo codes
export const PROMO_CODES: Record<string, number> = {
  VENOM: 500,
  CHAMPION: 1000,
};

// ----------------------------------------------------------------------------
// Levels / XP — xpForLevel and levelFromXp are inverse functions.
// Level 1 requires 0 XP. Level N requires (N-1)*200 XP.
// ----------------------------------------------------------------------------
export function xpForLevel(level: number): number {
  return (level - 1) * 200;
}
export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 200) + 1);
}

// ----------------------------------------------------------------------------
// Bot names & skins (server-only use, but defined here to avoid duplication)
// ----------------------------------------------------------------------------
export const BOT_NAMES = [
  'ViperStrike', 'NeonFang', 'CyberCobra', 'ToxicPython', 'ShadowAdder',
  'ChronoKrait', 'QuantumMamba', 'AeroBoa', 'SavageSerpent', 'GlitchViper',
  'ApexPredator', 'GhostScale', 'MatrixAsp', 'Synthetix', 'StaticFang',
  'VectorVenom', 'OmegaSlink', 'BetaByte', 'RattleTech', 'HoloHydra',
];
export const BOT_SKINS = [
  { color: '#22c55e', secondaryColor: '#15803d' },
  { color: '#a855f7', secondaryColor: '#6b21a8' },
  { color: '#06b6d4', secondaryColor: '#0891b2' },
  { color: '#ec4899', secondaryColor: '#8b5cf6' },
  { color: '#f59e0b', secondaryColor: '#b45309' },
  { color: '#ef4444', secondaryColor: '#991b1b' },
];

// ----------------------------------------------------------------------------
// Countries (197) — full ISO-3166-1 list
export const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'AG', name: 'Antigua and Barbuda', flag: '🇦🇬' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BZ', name: 'Belize', flag: '🇧🇿' },
  { code: 'BJ', name: 'Benin', flag: '🇧🇯' },
  { code: 'BT', name: 'Bhutan', flag: '🇧🇹' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'BN', name: 'Brunei', flag: '🇧🇳' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CF', name: 'Central African Republic', flag: '🇨🇫' },
  { code: 'TD', name: 'Chad', flag: '🇹🇩' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬' },
  { code: 'CD', name: 'DR Congo', flag: '🇨🇩' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
  { code: 'CY', name: 'Cyprus', flag: '🇨🇾' },
  { code: 'CZ', name: 'Czechia', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯' },
  { code: 'DM', name: 'Dominica', flag: '🇩🇲' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶' },
  { code: 'ER', name: 'Eritrea', flag: '🇪🇷' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
  { code: 'GM', name: 'Gambia', flag: '🇬🇲' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'GD', name: 'Grenada', flag: '🇬🇩' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'GN', name: 'Guinea', flag: '🇬🇳' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮' },
  { code: 'XK', name: 'Kosovo', flag: '🇽🇰' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬' },
  { code: 'LA', name: 'Laos', flag: '🇱🇦' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸' },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'MV', name: 'Maldives', flag: '🇲🇻' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹' },
  { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'FM', name: 'Micronesia', flag: '🇫🇲' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KP', name: 'North Korea', flag: '🇰🇵' },
  { code: 'MK', name: 'North Macedonia', flag: '🇲🇰' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'PW', name: 'Palau', flag: '🇵🇼' },
  { code: 'PS', name: 'Palestine', flag: '🇵🇸' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳' },
  { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸' },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲' },
  { code: 'ST', name: 'Sao Tome and Principe', flag: '🇸🇹' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
  { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴' },
  { code: 'TT', name: 'Trinidad and Tobago', flag: '🇹🇹' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺' },
  { code: 'VA', name: 'Vatican City', flag: '🇻🇦' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' },
];

export function countryFlag(code: string): string {
  const c = COUNTRIES.find((x) => x.code === code);
  return c?.flag || '🏳️';
}
export function countryName(code: string): string {
  const c = COUNTRIES.find((x) => x.code === code);
  return c?.name || code;
}

// ----------------------------------------------------------------------------
// Milestone tiers (7) — used by Leaderboards + Hall of Fame
// ----------------------------------------------------------------------------
export interface MilestoneTier {
  id: string;
  name: string;
  minChips: number;
  badge: string;
  color: string; // hex accent
}

export const MILESTONE_TIERS: MilestoneTier[] = [
  { id: 'all', name: 'All Milestone Tiers', minChips: 0, badge: '⭐ All Tiers', color: '#94a3b8' },
  { id: 'omega', name: 'Omega Legend (1 Crore / 10M+)', minChips: 10_000_000, badge: '👑 Omega', color: '#fbbf24' },
  { id: 'diamond', name: 'Diamond Warlord (50 Lakhs / 5M+)', minChips: 5_000_000, badge: '🔮 Diamond', color: '#06b6d4' },
  { id: 'platinum', name: 'Platinum Sovereign (25 Lakhs / 2.5M+)', minChips: 2_500_000, badge: '💎 Platinum', color: '#22d3ee' },
  { id: 'gold', name: 'Gold Apex Vanguard (10 Lakhs / 1M+)', minChips: 1_000_000, badge: '🥇 Gold', color: '#f59e0b' },
  { id: 'silver', name: 'Silver Commander (5 Lakhs / 500K+)', minChips: 500_000, badge: '🥈 Silver', color: '#cbd5e1' },
  { id: 'bronze', name: 'Bronze Elite (1 Lakh / 100K+)', minChips: 100_000, badge: '🥉 Bronze', color: '#b45309' },
  { id: 'rookie', name: 'Rookie (0 - 99K)', minChips: 0, badge: '🛡️ Rookie', color: '#64748b' },
];

export function milestoneTierForChips(chips: number): { name: string; badge: string; color: string } {
  for (const t of MILESTONE_TIERS) {
    if (t.id !== 'all' && chips >= t.minChips) {
      return { name: t.name, badge: t.badge, color: t.color };
    }
  }
  return { name: 'Rookie (0 - 99K)', badge: '🛡️ Rookie', color: '#64748b' };
}

// ----------------------------------------------------------------------------
// Mock leaderboard seed (used by Leaderboards when API is sparse)
// ----------------------------------------------------------------------------
export const MOCK_LEADERBOARD = [
  { name: 'ViperX', bankedChips: 285_400, level: 42, country: 'US', rank: 1, userTag: 'US-2854' },
  { name: 'KobraCommander', bankedChips: 198_250, level: 38, country: 'KR', rank: 2, userTag: 'KR-1982' },
  { name: 'SlinkySlayer', bankedChips: 142_010, level: 31, country: 'BR', rank: 3, userTag: 'BR-1420' },
  { name: 'VenomousRex', bankedChips: 95_450, level: 27, country: 'DE', rank: 4, userTag: 'DE-9545' },
  { name: 'Basilisk_99', bankedChips: 74_200, level: 24, country: 'CA', rank: 5, userTag: 'CA-7420' },
  { name: 'PythonicPro', bankedChips: 51_900, level: 21, country: 'JP', rank: 6, userTag: 'JP-5190' },
  { name: 'SidewinderAlpha', bankedChips: 38_700, level: 18, country: 'GB', rank: 7, userTag: 'GB-3870' },
  { name: 'Naga_Queen', bankedChips: 24_650, level: 15, country: 'IN', rank: 8, userTag: 'IN-2465' },
  { name: 'Anacondaaa', bankedChips: 19_500, level: 12, country: 'AU', rank: 9, userTag: 'AU-1950' },
  { name: 'Copperhead', bankedChips: 12_400, level: 10, country: 'FR', rank: 10, userTag: 'FR-1240' },
];

// ----------------------------------------------------------------------------
// Hall of Fame — 6 milestone tiers with first achievers
// ----------------------------------------------------------------------------
export interface HallOfFameTier {
  id: string;
  name: string;
  chips: number;
  badge: string;
  firstAchiever: { name: string; userTag: string; country: string; dateStr: string };
  totalAchieversCount: number;
}

export const HALL_OF_FAME_TIERS: HallOfFameTier[] = [
  {
    id: 't-1lakh',
    name: '1 LAKH CHIPS MILESTONE',
    chips: 100_000,
    badge: '🥉 Bronze Elite',
    firstAchiever: { name: 'Rookie_Striker', userTag: '#IND-104', country: 'IN', dateStr: '02 Jan 2026, 09:15 AM UTC' },
    totalAchieversCount: 14_209,
  },
  {
    id: 't-5lakh',
    name: '5 LAKH CHIPS MILESTONE',
    chips: 500_000,
    badge: '🥈 Silver Commander',
    firstAchiever: { name: 'Viper_Zero', userTag: '#USA-402', country: 'US', dateStr: '07 Jan 2026, 02:40 PM UTC' },
    totalAchieversCount: 4_810,
  },
  {
    id: 't-10lakh',
    name: '10 LAKH CHIPS (1 MILLION) MILESTONE',
    chips: 1_000_000,
    badge: '🥇 Gold Apex Vanguard',
    firstAchiever: { name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', dateStr: '11 Jan 2026, 06:30 AM SGT' },
    totalAchieversCount: 1_290,
  },
  {
    id: 't-25lakh',
    name: '25 LAKH CHIPS MILESTONE',
    chips: 2_500_000,
    badge: '💎 Platinum Sovereign',
    firstAchiever: { name: 'Apex_Viper', userTag: '#USA-882', country: 'US', dateStr: '16 Jan 2026, 11:10 PM UTC' },
    totalAchieversCount: 312,
  },
  {
    id: 't-50lakh',
    name: '50 LAKH CHIPS MILESTONE',
    chips: 5_000_000,
    badge: '🔮 Diamond Warlord',
    firstAchiever: { name: 'Shadow_Ninja', userTag: '#JPN-309', country: 'JP', dateStr: '19 Jan 2026, 08:22 PM JST' },
    totalAchieversCount: 64,
  },
  {
    id: 't-1crore',
    name: '1 CRORE CHIPS (10,000,000) LEGENDARY MILESTONE',
    chips: 10_000_000,
    badge: '👑 OMEGA IMMORTAL GOD',
    firstAchiever: { name: 'Hari', userTag: '#IND-001', country: 'IN', dateStr: '23 Jan 2026, 05:00 PM WST' },
    totalAchieversCount: 3,
  },
];

// ----------------------------------------------------------------------------
// Championships — prize tiers + 13 mock contenders
// ----------------------------------------------------------------------------
export interface ChampionshipPrize {
  category: string;
  title: string;
  badge: string;
  chipsReward: number;
  crownTitle: string;
  itemReward: string;
  hallOfFameInduction: boolean;
}

export const CHAMPIONSHIP_PRIZE_TIERS: ChampionshipPrize[] = [
  {
    category: 'RANK_1',
    title: '👑 RANK 1: GRAND CHAMPION',
    badge: '🥇 1st Place (World / Region / Country)',
    chipsReward: 5_000_000,
    crownTitle: '👑 2026 WORLD VENOM CHAMPION',
    itemReward: 'Mythic Golden Dragon Skin & World Crown',
    hallOfFameInduction: true,
  },
  {
    category: 'RANK_2_10',
    title: '🥈 RANKS 2–10: TOP 10 LEGENDS',
    badge: '🥈 Top 10 Legends',
    chipsReward: 2_500_000,
    crownTitle: '🥈 VENOM ARENA OVERLORD',
    itemReward: 'Platinum Armor Skin & Crown Effect',
    hallOfFameInduction: true,
  },
  {
    category: 'RANK_11_50',
    title: '🥉 RANKS 11–50: ELITE MASTERS',
    badge: '🥉 Ranks 11–50 Masters',
    chipsReward: 1_000_000,
    crownTitle: '🥉 ARENA ELITE MASTER',
    itemReward: 'Diamond Trail Effect & Master Crest',
    hallOfFameInduction: true,
  },
  {
    category: 'RANK_51_100',
    title: '🛡️ RANKS 51–100: CHAMPIONSHIP CONTENDERS',
    badge: '🛡️ Ranks 51–100 Contenders',
    chipsReward: 250_000,
    crownTitle: '🛡️ CHAMPIONSHIP CONTENDER',
    itemReward: '2,500 Season Pass XP & Contender Badge',
    hallOfFameInduction: true,
  },
];

// ----------------------------------------------------------------------------
// Social panel — friends, rivals, global players, public clans
// ----------------------------------------------------------------------------
export interface MockFriend {
  id: string;
  name: string;
  userTag: string;
  status: 'online' | 'idle' | 'in-match' | 'offline';
  currentArenaId?: string;
  currentArenaName?: string;
  level: number;
  skinColor: string;
  giftSent: boolean;
  giftReceived: boolean;
}

export const INITIAL_FRIENDS: MockFriend[] = [
  { id: 'f-1', name: 'ApexViper', userTag: 'APEX-1029', status: 'online', currentArenaId: 'tier-1', currentArenaName: 'Training Pit', level: 42, skinColor: '#10b981', giftSent: false, giftReceived: true },
  { id: 'f-2', name: 'ShadowSlinker', userTag: 'SLNK-9281', status: 'in-match', currentArenaId: 'tier-2', currentArenaName: 'High Stakes Lounge', level: 18, skinColor: '#a855f7', giftSent: false, giftReceived: false },
  { id: 'f-3', name: 'CoinGobbler', userTag: 'COIN-5432', status: 'offline', level: 29, skinColor: '#eab308', giftSent: true, giftReceived: false },
  { id: 'f-4', name: 'VenomKing', userTag: 'VNOM-0001', status: 'idle', level: 55, skinColor: '#ef4444', giftSent: false, giftReceived: false },
];

export interface MockRival {
  id: string;
  name: string;
  userTag: string;
  status: 'online' | 'idle' | 'in-match' | 'offline';
  currentArenaName: string;
  level: number;
  timesKilledByYou: number;
  timesKilledYou: number;
  lastEncounterDate: string;
}

export const INITIAL_RIVALS: MockRival[] = [
  { id: 'r-1', name: 'VenomKing', userTag: 'VNOM-0001', status: 'in-match', currentArenaName: 'Venom Pit (5,000 Buy-In)', level: 55, timesKilledByYou: 2, timesKilledYou: 5, lastEncounterDate: 'Today, 2:15 PM' },
  { id: 'r-2', name: 'ShadowSlinker', userTag: 'SLNK-9281', status: 'online', currentArenaName: 'High Stakes Lounge (1,000 Buy-In)', level: 38, timesKilledByYou: 4, timesKilledYou: 1, lastEncounterDate: 'Yesterday, 8:40 PM' },
  { id: 'r-3', name: 'ApexViper', userTag: 'APEX-1029', status: 'in-match', currentArenaName: 'Extreme Arena (25,000 Buy-In)', level: 42, timesKilledByYou: 1, timesKilledYou: 3, lastEncounterDate: '2 days ago' },
];

export interface GlobalPlayer {
  name: string;
  userTag: string;
  country: string;
  level: number;
  chips: number;
  skinColor: string;
  status: 'online' | 'idle' | 'in-match' | 'offline';
  connected?: boolean;
}

export const GLOBAL_COMMUNITY_PLAYERS: GlobalPlayer[] = [
  { name: 'CobraMaster_IN', userTag: 'IND-8821', country: 'IN', level: 48, chips: 4_500_000, skinColor: '#10b981', status: 'online' },
  { name: 'Viper_Syndicate', userTag: 'IND-1049', country: 'IN', level: 52, chips: 12_500_000, skinColor: '#eab308', status: 'in-match' },
  { name: 'Mamba_Strike', userTag: 'USA-4012', country: 'US', level: 39, chips: 2_100_000, skinColor: '#ef4444', status: 'online' },
  { name: 'Tokyo_Slinker', userTag: 'JPN-9012', country: 'JP', level: 44, chips: 3_800_000, skinColor: '#a855f7', status: 'idle' },
  { name: 'Seoul_Apex', userTag: 'KOR-2290', country: 'KR', level: 50, chips: 8_900_000, skinColor: '#3b82f6', status: 'online' },
  { name: 'London_Viper', userTag: 'GBR-5012', country: 'GB', level: 35, chips: 1_800_000, skinColor: '#f43f5e', status: 'in-match' },
  { name: 'Dragon_Cobra', userTag: 'IND-2201', country: 'IN', level: 41, chips: 2_900_000, skinColor: '#06b6d4', status: 'online' },
  { name: 'Phoenix_Venom', userTag: 'BRA-7712', country: 'BR', level: 33, chips: 950_000, skinColor: '#84cc16', status: 'offline' },
  { name: 'Berlin_Predator', userTag: 'DEU-3321', country: 'DE', level: 46, chips: 5_400_000, skinColor: '#ec4899', status: 'online' },
  { name: 'Sydney_Strike', userTag: 'AUS-6612', country: 'AU', level: 37, chips: 1_400_000, skinColor: '#6366f1', status: 'idle' },
  { name: 'Zenith_Slither', userTag: 'CAN-8840', country: 'CA', level: 28, chips: 620_000, skinColor: '#14b8a6', status: 'online' },
  { name: 'Paris_Serpent', userTag: 'FRA-1190', country: 'FR', level: 38, chips: 1_950_000, skinColor: '#8b5cf6', status: 'offline' },
];

export const PRESET_EMBLEMS = ['🐍', '🦅', '🎯', '💀', '💎', '🔥', '👑', '⚡', '🏆', '☣️'];

// ----------------------------------------------------------------------------
// ClanSystem.tsx — 3 sample clans
// ----------------------------------------------------------------------------
export interface SampleClanMember {
  name: string;
  userTag: string;
  role: 'Leader' | 'Officer' | 'Member';
  chips: number;
  level: number;
  country: string;
  joinedDate: string;
}

export interface SampleClanAnnouncement {
  author: string;
  text: string;
  dateStr: string;
}

export interface SampleClan {
  id: string;
  name: string;
  tag: string;
  motto: string;
  level: number;
  logoEmoji: string;
  treasuryChips: number;
  members: SampleClanMember[];
  maxMembers: number;
  leaderName: string;
  leaderTag: string;
  minLevelReq: number;
  clanRank: number;
  announcements: SampleClanAnnouncement[];
}

export const SAMPLE_CLANS: SampleClan[] = [
  {
    id: 'clan-1',
    name: 'Viper Apex Syndicate',
    tag: 'APEX',
    motto: 'Dominate the boundary, extract all chips.',
    level: 12,
    logoEmoji: '🐍',
    treasuryChips: 14_500_000,
    maxMembers: 30,
    leaderName: 'Hari',
    leaderTag: '#IND-001',
    minLevelReq: 1,
    clanRank: 1,
    members: [
      { name: 'Hari', userTag: '#IND-001', role: 'Leader', chips: 10_000_000, level: 50, country: 'IN', joinedDate: '01 Jan 2027' },
      { name: 'Apex_Viper', userTag: '#USA-882', role: 'Officer', chips: 9_400_000, level: 49, country: 'US', joinedDate: '03 Jan 2027' },
      { name: 'K-Snake_Master', userTag: '#KOR-114', role: 'Officer', chips: 8_900_000, level: 49, country: 'KR', joinedDate: '05 Jan 2027' },
      { name: 'Rookie_Striker', userTag: '#IND-104', role: 'Member', chips: 1_200_000, level: 32, country: 'IN', joinedDate: '12 Jan 2027' },
    ],
    announcements: [
      { author: 'Hari (Leader)', text: '🔥 Self-Sponsored Clan Arena War starts Saturday! Treasury pool funds 1,00,000c prize pool.', dateStr: '2 hours ago' },
      { author: 'Apex_Viper (Officer)', text: 'Treasury Bank replenished by members for custom clan tournaments!', dateStr: '1 day ago' },
    ],
  },
  {
    id: 'clan-2',
    name: 'Cyber Ninja Shadow Squad',
    tag: 'NINJA',
    motto: 'Silent extraction, maximum venom.',
    level: 9,
    logoEmoji: '🥷',
    treasuryChips: 8_200_000,
    maxMembers: 25,
    leaderName: 'Shadow_Ninja',
    leaderTag: '#JPN-309',
    minLevelReq: 15,
    clanRank: 2,
    members: [
      { name: 'Shadow_Ninja', userTag: '#JPN-309', role: 'Leader', chips: 5_000_000, level: 48, country: 'JP', joinedDate: '02 Jan 2027' },
    ],
    announcements: [
      { author: 'Shadow_Ninja', text: 'Recruiting active players for High Stakes Tier 5 extractions!', dateStr: '3 days ago' },
    ],
  },
  {
    id: 'clan-3',
    name: 'Phoenix Elite Extraction Corps',
    tag: 'PHNX',
    motto: 'From the ashes, we reclaim the arena.',
    level: 6,
    logoEmoji: '🔥',
    treasuryChips: 3_400_000,
    maxMembers: 20,
    leaderName: 'Viper_Zero',
    leaderTag: '#USA-402',
    minLevelReq: 10,
    clanRank: 3,
    members: [],
    announcements: [],
  },
];

// ----------------------------------------------------------------------------
// Season Pass — 20 free + 20 elite rewards
// ----------------------------------------------------------------------------
export interface SeasonReward {
  title: string;
  category: string;
  icon: string;
  skinName?: string;
}

export const COSMETIC_FREE_REWARDS: SeasonReward[] = [
  { title: 'Neon Viper Badge', category: 'Badge', icon: '🏷️' },
  { title: 'Cyber Pulse Trail FX', category: 'Tail FX', icon: '⚡' },
  { title: 'Green Venom Frame', category: 'Avatar Border', icon: '🖼️' },
  { title: 'Serpent Whispers SFX', category: 'Kill Sound', icon: '🔊' },
  { title: 'Genesis Pioneer Title', category: 'Title', icon: '🎖️' },
  { title: 'Bio-Hazard Emote Spray', category: 'Spray', icon: '🎨' },
  { title: 'Emerald Tail Glow', category: 'Tail FX', icon: '✨' },
  { title: 'Cobra Strike Taunt', category: 'Emote', icon: '🐍' },
  { title: 'Cyber Samurai Border', category: 'Avatar Border', icon: '⚔️' },
  { title: 'Toxic Acid DNA Skin', category: 'DNA Skin', icon: '🧪' },
  { title: 'Quantum Grid Avatar', category: 'Profile Icon', icon: '🌐' },
  { title: 'Apex Vanguard Emblem', category: 'Badge', icon: '🛡️' },
  { title: 'Neon Matrix Audio FX', category: 'Kill Sound', icon: '🎵' },
  { title: 'Plasma Arc Tail Trail', category: 'Tail FX', icon: '⚡' },
  { title: 'Cyber Warlord Title', category: 'Title', icon: '👑' },
  { title: 'Solar Flare Emote', category: 'Emote', icon: '☀️' },
  { title: 'Titanium Viper Skin', category: 'DNA Skin', icon: '🦾' },
  { title: 'Cyber Void Frame', category: 'Avatar Border', icon: '🌌' },
  { title: 'Genesis Immortal Badge', category: 'Badge', icon: '🏆' },
  { title: 'Genesis Master DNA Skin', category: 'DNA Skin', icon: '🐉' },
];

export const COSMETIC_ELITE_REWARDS: SeasonReward[] = [
  { title: 'Cyber Serpent God Skin', category: 'DNA Skin', icon: '👑', skinName: 'Cyber Serpent God' },
  { title: 'Hyper Plasma Arc FX', category: 'Tail FX', icon: '⚡' },
  { title: 'Cyber Siren Roar SFX', category: 'Kill Sound', icon: '🔊' },
  { title: 'Royal Throne Taunt', category: 'Emote', icon: '🛋️' },
  { title: '1 Crore Immortal Badge', category: 'Badge', icon: '🎖️' },
  { title: 'Modular Venom DNA Skin', category: 'DNA Skin', icon: '🐍', skinName: 'Modular Venom DNA' },
  { title: 'Holo-Shield Tail Aura', category: 'Tail FX', icon: '🛡️' },
  { title: 'Golden Viper Frame', category: 'Avatar Border', icon: '🖼️' },
  { title: 'Galactic Overlord Title', category: 'Title', icon: '🌌' },
  { title: 'Dark Matter DNA Skin', category: 'DNA Skin', icon: '🌑', skinName: 'Dark Matter DNA' },
  { title: 'Celestial Fire Trail', category: 'Tail FX', icon: '🔥' },
  { title: 'Apex Predator Emblem', category: 'Badge', icon: '🦅' },
  { title: 'Cyber Phantom Skin', category: 'DNA Skin', icon: '👻', skinName: 'Cyber Phantom' },
  { title: 'Supernova Explosion SFX', category: 'Kill Sound', icon: '💥' },
  { title: "Emperor's Crown Frame", category: 'Avatar Border', icon: '👑' },
  { title: 'Diamond Viper DNA Skin', category: 'DNA Skin', icon: '💎', skinName: 'Diamond Viper' },
  { title: 'Hyper-Drive Trail FX', category: 'Tail FX', icon: '⚡' },
  { title: 'Genesis Sovereign Title', category: 'Title', icon: '📜' },
  { title: 'Infinite Horizon Frame', category: 'Avatar Border', icon: '🎆' },
  { title: 'Serpent God Ascended', category: 'DNA Skin', icon: '🌟', skinName: 'Serpent God Ascended' },
];

export const ELITE_PASS_COST = 100_000;

// ----------------------------------------------------------------------------
// Season Pass — XP-gated progression with mixed cosmetic + chip rewards
// ----------------------------------------------------------------------------

/** Maximum pass XP earnable per day (prevents binge completion) */
export const PASS_DAILY_XP_CAP = 1_500;

/** Fraction of match XP that converts to pass XP */
export const PASS_XP_MULTIPLIER = 0.5;

/** Cumulative pass XP required to unlock each tier (1-indexed, tier 1 = 0 = auto-unlocked) */
export const PASS_TIER_XP: number[] = [
  0,      // Tier 1:  auto-unlocked
  500,    // Tier 2
  1_200,  // Tier 3
  2_000,  // Tier 4
  3_000,  // Tier 5
  4_200,  // Tier 6
  5_500,  // Tier 7
  7_000,  // Tier 8
  8_800,  // Tier 9
  10_800, // Tier 10
  13_200, // Tier 11
  15_800, // Tier 12
  18_800, // Tier 13
  22_200, // Tier 14
  26_000, // Tier 15
  30_500, // Tier 16
  35_500, // Tier 17
  41_000, // Tier 18
  47_500, // Tier 19
  55_000, // Tier 20
];

/** Chip rewards for the Free track (0 = cosmetic-only tier). 1-indexed. */
export const PASS_FREE_CHIP_REWARDS: number[] = [
  0,     // T1
  0,     // T2
  200,   // T3
  0,     // T4
  0,     // T5
  400,   // T6
  0,     // T7
  0,     // T8
  0,     // T9
  800,   // T10
  0,     // T11
  1_000, // T12
  0,     // T13
  0,     // T14
  2_000, // T15
  0,     // T16
  0,     // T17
  3_000, // T18
  0,     // T19
  3_000, // T20
];

/** Chip rewards for the Elite track (0 = cosmetic-only tier). 1-indexed. */
export const PASS_ELITE_CHIP_REWARDS: number[] = [
  0,      // T1
  0,      // T2
  500,    // T3
  0,      // T4
  0,      // T5
  1_000,  // T6
  0,      // T7
  0,      // T8
  0,      // T9
  2_000,  // T10
  0,      // T11
  3_000,  // T12
  0,      // T13
  0,      // T14
  5_000,  // T15
  0,      // T16
  0,      // T17
  7_000,  // T18
  0,      // T19
  10_000, // T20
];

export const PASS_SEASON_NAME = 'Genesis';

/** Real equippable cosmetics for the Free track (20 tiers). */
export const PASS_FREE_COSMETICS: Skin[] = [
  // Tiers 1-5 — Skins
  { id: 'pass-f1-ember-worm',  name: 'Ember Worm',           cost: 0, type: 'skin',  color: '#ef4444', secondaryColor: '#991b1b', description: 'A smouldering vermilion skin radiating heat.', emoji: '🔥' },
  { id: 'pass-f2-frost-viper', name: 'Frost Viper',           cost: 0, type: 'skin',  color: '#67e8f9', secondaryColor: '#0e7490', description: 'Icy blue scales that shimmer like frozen venom.', emoji: '❄️', pattern: 'neon' },
  { id: 'pass-f3-moss-python', name: 'Moss Python',           cost: 0, type: 'skin',  color: '#22c55e', secondaryColor: '#14532d', description: 'Deep jungle camouflage with organic texture.', emoji: '🌿', pattern: 'camo' },
  { id: 'pass-f4-solar-coil',  name: 'Solar Coil',            cost: 0, type: 'skin',  color: '#fbbf24', secondaryColor: '#92400e', description: 'Sun-baked golden coils with radiant glow.', emoji: '☀️', pattern: 'glow' },
  { id: 'pass-f5-shadow-mamba', name: 'Shadow Mamba',         cost: 0, type: 'skin',  color: '#1e293b', secondaryColor: '#0f172a', description: 'Near-invisible dark matter scales.', emoji: '🌑', pattern: 'metallic' },
  // Tiers 6-10
  { id: 'pass-f6-ember-fury',  name: 'Ember Fury',            cost: 0, type: 'skin',  color: '#a855f7', secondaryColor: '#7c2d12', description: 'Blazing purple-to-amber inferno scales.', emoji: '💧', pattern: 'rainbow' },
  { id: 'pass-f7-blaze-viper', name: 'Blaze Viper',           cost: 0, type: 'skin',  color: '#f97316', secondaryColor: '#dc2626', description: 'Fiery orange and crimson dual-tone armor.', emoji: '🔥', pattern: 'pulse' },
  { id: 'pass-f8-phantom-wraith', name: 'Phantom Wraith',     cost: 0, type: 'skin',  color: '#6366f1', secondaryColor: '#1e293b', description: 'Ethereal indigo ghost scales with dark core.', emoji: '💀', pattern: 'glow' },
  { id: 'pass-f9-neon-fang',   name: 'Neon Fang',             cost: 0, type: 'skin',  color: '#06b6d4', secondaryColor: '#ec4899', description: 'Bifurcated neon cyber-stripe pattern.', emoji: '⚡', pattern: 'neon' },
  { id: 'pass-f10-jade-scales', name: 'Jade Scales',           cost: 0, type: 'skin',  color: '#10b981', secondaryColor: '#064e3b', description: 'Polished jade armor plating.', emoji: '💎', pattern: 'metallic' },
  // Tiers 11-15
  { id: 'pass-f11-clan-crest', name: 'Clan Crest',            cost: 0, type: 'skin',  color: '#f59e0b', secondaryColor: '#b45309', description: 'A golden crest pattern for true syndicate loyalists.', emoji: '🚩', pattern: 'metallic' },
  { id: 'pass-f12-inferno',    name: 'Inferno',               cost: 0, type: 'skin',  color: '#dc2626', secondaryColor: '#fbbf24', description: 'Raging fire gradient from tail to head.', emoji: '🌋', pattern: 'rainbow' },
  { id: 'pass-f13-stardust',   name: 'Stardust Scales',       cost: 0, type: 'skin',  color: '#eab308', secondaryColor: '#7c3aed', description: 'Twinkling gold and violet cosmic scales.', emoji: '✨', pattern: 'rainbow' },
  { id: 'pass-f14-void-reaper', name: 'Void Reaper',          cost: 0, type: 'skin',  color: '#0f172a', secondaryColor: '#334155', description: 'A black hole collapse effect in dark obsidian.', emoji: '🕳️', pattern: 'metallic' },
  { id: 'pass-f15-chrome-king', name: 'Chrome King',          cost: 0, type: 'skin',  color: '#94a3b8', secondaryColor: '#fbbf24', description: 'Silver-chrome body with gold crown accents.', emoji: '👑', pattern: 'metallic' },
  // Tiers 16-20
  { id: 'pass-f16-plasma-skin', name: 'Plasma Surge',          cost: 0, type: 'skin',  color: '#ec4899', secondaryColor: '#06b6d4', description: 'Electrified pink plasma flowing across segments.', emoji: '⚡', pattern: 'neon' },
  { id: 'pass-f17-pulse-skin',  name: 'Pulse Raptor',         cost: 0, type: 'skin',  color: '#8b5cf6', secondaryColor: '#06b6d4', description: 'Pulsing violet-to-cyan heartbeat pattern.', emoji: '💜', pattern: 'pulse' },
  { id: 'pass-f18-war-skin',    name: 'War Machine',            cost: 0, type: 'skin',  color: '#ef4444', secondaryColor: '#1e293b', description: 'A crimson battle-scarred armor for warriors.', emoji: '🏴', pattern: 'camo' },
  { id: 'pass-f19-rainbow-viper', name: 'Rainbow Viper',     cost: 0, type: 'skin',  color: '#ec4899', secondaryColor: '#3b82f6', description: 'Full spectrum flowing colour shift.', emoji: '🌈', pattern: 'rainbow' },
  { id: 'pass-f20-omega-skin', name: 'Omega Frame',            cost: 0, type: 'skin',  color: '#fbbf24', secondaryColor: '#059669', description: 'A legendary tri-colour skin for Genesis completion.', emoji: '🏆', pattern: 'cyber' },
];

/** Real equippable cosmetics for the Elite track (20 tiers). Elite pass exclusive. */
export const PASS_ELITE_COSMETICS: Skin[] = [
  // Tiers 1-5 — Premium Skins
  { id: 'pass-e1-cyber-serpent', name: 'Cyber Serpent God',  cost: 0, type: 'skin',  color: '#a855f7', secondaryColor: '#fbbf24', description: 'Royal purple with gold cyber-circuit overlay.', emoji: '👑', pattern: 'cyber' },
  { id: 'pass-e2-phantom-wraith', name: 'Phantom Wraith',    cost: 0, type: 'skin',  color: '#1e293b', secondaryColor: '#6366f1', description: 'Ghostly translucent dark scales with indigo glow.', emoji: '👻', pattern: 'glow' },
  { id: 'pass-e3-magma-titan',  name: 'Magma Titan',          cost: 0, type: 'skin',  color: '#f97316', secondaryColor: '#dc2626', description: 'Volcanic lava flow between obsidian plates.', emoji: '🌋', pattern: 'pulse' },
  { id: 'pass-e4-arctic-king',  name: 'Arctic King',          cost: 0, type: 'skin',  color: '#e0f2fe', secondaryColor: '#0ea5e9', description: 'Frost king crown with icy crystalline body.', emoji: '🧊', pattern: 'neon' },
  { id: 'pass-e5-biohazard',    name: 'Biohazard Prime',      cost: 0, type: 'skin',  color: '#22c55e', secondaryColor: '#fbbf24', description: 'Radioactive green with hazard stripe accents.', emoji: '☢️', pattern: 'camo' },
  // Tiers 6-10
  { id: 'pass-e6-hypernova', name: 'Hypernova',              cost: 0, type: 'skin',  color: '#fbbf24', secondaryColor: '#f97316', description: 'Supernova-grade golden radiance scales.', emoji: '🌟', pattern: 'glow' },
  { id: 'pass-e7-dark-matter', name: 'Dark Matter',           cost: 0, type: 'skin',  color: '#0f172a', secondaryColor: '#334155', description: 'Absorbs light around it. Pure void energy.', emoji: '🕳️', pattern: 'metallic' },
  { id: 'pass-e8-apocalypse', name: 'Apocalypse',             cost: 0, type: 'skin',  color: '#ef4444', secondaryColor: '#fbbf24', description: 'Cataclysmic red explosion pattern with shockwave ring.', emoji: '💥', pattern: 'pulse' },
  { id: 'pass-e9-hologram-skin', name: 'Hologram Serpent',    cost: 0, type: 'skin',  color: '#06b6d4', secondaryColor: '#a855f7', description: 'Scanning-line holographic projection effect.', emoji: '🤖', pattern: 'cyber' },
  { id: 'pass-e10-royal-cobra', name: 'Royal Cobra',          cost: 0, type: 'skin',  color: '#fbbf24', secondaryColor: '#b45309', description: 'Solid gold cobra hood with jewelled eyes.', emoji: '🐍', pattern: 'metallic' },
  // Tiers 11-15
  { id: 'pass-e11-elite-standard', name: 'Elite Standard',    cost: 0, type: 'skin',  color: '#fbbf24', secondaryColor: '#f59e0b', description: 'A prestigious gold-embroidered elite skin.', emoji: '⚜️', pattern: 'metallic' },
  { id: 'pass-e12-dragon-scale', name: 'Dragon Scale',        cost: 0, type: 'skin',  color: '#dc2626', secondaryColor: '#1e293b', description: 'Ancient dragon armour with metallic sheen.', emoji: '🐉', pattern: 'metallic' },
  { id: 'pass-e13-galaxy', name: 'Galaxy Drift',             cost: 0, type: 'skin',  color: '#8b5cf6', secondaryColor: '#ec4899', description: 'Swirling galactic dust and nebula pattern.', emoji: '🌌', pattern: 'rainbow' },
  { id: 'pass-e14-soul-shatter', name: 'Soul Shatter',        cost: 0, type: 'skin',  color: '#a855f7', secondaryColor: '#1e293b', description: 'Purple soul fragment dispersal effect.', emoji: '🔮', pattern: 'glow' },
  { id: 'pass-e15-titanium-lord', name: 'Titanium Lord',      cost: 0, type: 'skin',  color: '#64748b', secondaryColor: '#fbbf24', description: 'Titanium exoskeleton with gold joint highlights.', emoji: '⚙️', pattern: 'metallic' },
  // Tiers 16-20 — Legendary Tier
  { id: 'pass-e16-aurora', name: 'Aurora Borealis',          cost: 0, type: 'skin',  color: '#10b981', secondaryColor: '#06b6d4', description: 'Northern lights ribbon across every segment.', emoji: '🌌', pattern: 'rainbow' },
  { id: 'pass-e17-neon-cyber',  name: 'Neon Cyber Overlord',  cost: 0, type: 'skin',  color: '#06b6d4', secondaryColor: '#ec4899', description: 'Full cyber-grid neon with pulsing data lines.', emoji: '📡', pattern: 'cyber' },
  { id: 'pass-e18-throne-skin', name: 'Throne Room',          cost: 0, type: 'skin',  color: '#fbbf24', secondaryColor: '#dc2626', description: 'Opulent golden throne room regal pattern.', emoji: '👑', pattern: 'metallic' },
  { id: 'pass-e19-prismatic',   name: 'Prismatic Void',       cost: 0, type: 'skin',  color: '#ec4899', secondaryColor: '#06b6d4', description: 'Prismatic light refraction across every segment.', emoji: '🌈', pattern: 'rainbow' },
  { id: 'pass-e20-genesis-crown', name: 'Genesis Crown',       cost: 0, type: 'skin',  color: '#fbbf24', secondaryColor: '#92400e', description: 'The ultimate Genesis Season completion skin.', emoji: '👑', pattern: 'cyber' },
];

// ----------------------------------------------------------------------------
// Player inspector — shared InspectedPlayer interface
// ----------------------------------------------------------------------------
export interface InspectedPlayer {
  name: string;
  userTag: string;
  country: string;
  flag: string;
  bankedChips: number;
  level: number;
  achievedAt?: string;
  globalRank?: number;
  countryRank?: number;
  regionalRank?: number;
  clanTag?: string;
  clanName?: string;
  // Career stats (optional — populated when available)
  lifetimeKills?: number;
  lifetimeDeaths?: number;
  lifetimeExtracts?: number;
  bestStreak?: number;
  biggestExtract?: number;
  totalEarned?: number;
  totalLost?: number;
  // Equipped cosmetics (optional — populated when available)
  currentSkin?: string;
  currentTrail?: string;
  currentDeath?: string;
  currentFlag?: string | null;
  currentBanner?: string | null;
}
