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
// Buy-in: 10c → 1,000,000,000c (1 billion). Every tier has exactly 30 bots.
// Difficulty groups: Beginner (1-6) · Medium (7-12) · High Stakes (13-18) ·
//                     Extreme (19-24) · Legendary (25-30)

export const ARENA_TIERS: ArenaTier[] = [
  // ── BEGINNER (Tiers 1–6): 10c to 300c ──
  { id: 'tier-1',  name: 'Scrap Alley',      buyIn: 10,          description: 'The starting proving grounds. Low stakes, soft competition, perfect for learning the ropes.',            difficulty: 'Beginner',    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', accentColor: '#10b981', borderAccent: '#059669', botsCount: 30, rewardMultiplier: 1.0 },
  { id: 'tier-2',  name: 'Rust Market',       buyIn: 20,          description: 'A scrappy underground market arena. Slightly tougher bots patrol the dimly lit corridors.',               difficulty: 'Beginner',    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', accentColor: '#34d399', borderAccent: '#10b981', botsCount: 30, rewardMultiplier: 1.1 },
  { id: 'tier-3',  name: 'Copper Lane',        buyIn: 40,          description: 'Warm copper-lit corridors. Bots here move a bit faster — stay sharp.',                                difficulty: 'Beginner',    color: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300', accentColor: '#4ade80', borderAccent: '#22c55e', botsCount: 30, rewardMultiplier: 1.2 },
  { id: 'tier-4',  name: 'Neon Grid',          buyIn: 75,          description: 'A glowing synthwave arena where speed is key. Pulsing neon borders and quick bots.',                  difficulty: 'Beginner',    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',     accentColor: '#06b6d4', borderAccent: '#0891b2', botsCount: 30, rewardMultiplier: 1.5 },
  { id: 'tier-5',  name: 'Iron District',     buyIn: 150,         description: 'Industrial zone with moderate competition and steady food flow. Iron walls glow faintly.',            difficulty: 'Beginner',    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',     accentColor: '#22d3ee', borderAccent: '#06b6d4', botsCount: 30, rewardMultiplier: 1.8 },
  { id: 'tier-6',  name: 'Bronze Arena',       buyIn: 300,         description: 'The final beginner tier. Solid competition — prove yourself here before advancing to medium.',         difficulty: 'Beginner',    color: 'bg-teal-500/10 border-teal-500/30 text-teal-400',     accentColor: '#14b8a6', borderAccent: '#0d9488', botsCount: 30, rewardMultiplier: 2.0 },

  // ── MEDIUM (Tiers 7–12): 500c to 15,000c ──
  { id: 'tier-7',  name: 'Silver Strip',      buyIn: 500,         description: 'A polished medium-stakes corridor with balanced competition and reliable food spawns.',                 difficulty: 'Medium',      color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',   accentColor: '#f59e0b', borderAccent: '#d97706', botsCount: 30, rewardMultiplier: 2.5 },
  { id: 'tier-8',  name: 'Jade Corridor',     buyIn: 1_000,       description: 'Lush and dangerous. Mid-tier hunters roam freely through the jade-colored passages.',                   difficulty: 'Medium',      color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',   accentColor: '#fbbf24', borderAccent: '#f59e0b', botsCount: 30, rewardMultiplier: 3.0 },
  { id: 'tier-9',  name: 'Amber Crossing',    buyIn: 2_000,       description: 'A golden intersection where fortunes shift quickly. Watch for coordinated bot ambushes.',                 difficulty: 'Medium',      color: 'bg-amber-400/10 border-amber-400/30 text-amber-300',   accentColor: '#fcd34d', borderAccent: '#fbbf24', botsCount: 30, rewardMultiplier: 3.5 },
  { id: 'tier-10', name: 'Gold Quarter',      buyIn: 4_000,       description: 'Affluent territory with premium food density. Expect coordinated bot packs defending star chips.',        difficulty: 'Medium',      color: 'bg-orange-500/10 border-orange-500/30 text-orange-400', accentColor: '#f97316', borderAccent: '#ea580c', botsCount: 30, rewardMultiplier: 4.5 },
  { id: 'tier-11', name: 'Ruby Den',           buyIn: 7_500,       description: 'Deep red arena with aggressive predators and scarce food. Only the cunning survive here.',             difficulty: 'Medium',      color: 'bg-orange-500/10 border-orange-500/30 text-orange-400', accentColor: '#fb923c', borderAccent: '#f97316', botsCount: 30, rewardMultiplier: 5.5 },
  { id: 'tier-12', name: 'Sapphire Hall',     buyIn: 15_000,      description: 'Elegant but deadly. The gateway to high-stakes play — blue crystalline walls refract light.',             difficulty: 'Medium',      color: 'bg-rose-500/10 border-rose-500/30 text-rose-400',     accentColor: '#f43f5e', borderAccent: '#e11d48', botsCount: 30, rewardMultiplier: 7.0 },

  // ── HIGH STAKES (Tiers 13–18): 30,000c to 750,000c ──
  { id: 'tier-13', name: 'Viper Pit',          buyIn: 30_000,      description: 'The viper syndicate\'s den. Elite bot AI with predictive dodging starts here.',                         difficulty: 'High Stakes', color: 'bg-rose-500/10 border-rose-500/30 text-rose-400',     accentColor: '#fb7185', borderAccent: '#f43f5e', botsCount: 30, rewardMultiplier: 8.0 },
  { id: 'tier-14', name: 'Championship Hub',   buyIn: 50_000,      description: 'Championship qualifier grounds. Extraction commission is heavily contested by skilled bots.',              difficulty: 'High Stakes', color: 'bg-pink-500/10 border-pink-500/30 text-pink-400',     accentColor: '#ec4899', borderAccent: '#db2777', botsCount: 30, rewardMultiplier: 10.0 },
  { id: 'tier-15', name: 'Emerald Court',     buyIn: 100_000,     description: 'A hundred-thousand buy-in. Only serious operators enter this prestigious emerald arena.',               difficulty: 'High Stakes', color: 'bg-pink-500/10 border-pink-500/30 text-pink-400',     accentColor: '#f472b6', borderAccent: '#ec4899', botsCount: 30, rewardMultiplier: 12.0 },
  { id: 'tier-16', name: 'Diamond Nexus',      buyIn: 200_000,     description: 'Brilliant and ruthless. High-value star drops attract fierce competition from all sides.',               difficulty: 'High Stakes', color: 'bg-violet-500/10 border-violet-500/30 text-violet-400', accentColor: '#8b5cf6', borderAccent: '#7c3aed', botsCount: 30, rewardMultiplier: 15.0 },
  { id: 'tier-17', name: 'Apex Vault',         buyIn: 350_000,     description: 'Three hundred fifty thousand to enter. The apex of mid-tier competition — only veterans tread here.',      difficulty: 'High Stakes', color: 'bg-violet-500/10 border-violet-500/30 text-violet-400', accentColor: '#a78bfa', borderAccent: '#8b5cf6', botsCount: 30, rewardMultiplier: 18.0 },
  { id: 'tier-18', name: 'Obsidian Core',      buyIn: 750_000,     description: 'Dark and unforgiving obsidian arena. One wrong move costs hundreds of thousands — precision is key.',    difficulty: 'High Stakes', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400', accentColor: '#a855f7', borderAccent: '#9333ea', botsCount: 30, rewardMultiplier: 22.0 },

  // ── EXTREME (Tiers 19–24): 1,500,000c to 40,000,000c ──
  { id: 'tier-19', name: 'Crimson Abyss',      buyIn: 1_500_000,   description: 'A bottomless crimson arena where only the strongest survive. Bots are relentless hunters.',             difficulty: 'Extreme',     color: 'bg-purple-500/10 border-purple-500/30 text-purple-400', accentColor: '#c084fc', borderAccent: '#a855f7', botsCount: 30, rewardMultiplier: 28.0 },
  { id: 'tier-20', name: 'Shadow Realm',       buyIn: 3_000_000,   description: 'Shrouded in darkness. Predators hunt by prediction — stay mobile or become prey.',                    difficulty: 'Extreme',     color: 'bg-red-500/10 border-red-500/30 text-red-400',       accentColor: '#ef4444', borderAccent: '#dc2626', botsCount: 30, rewardMultiplier: 32.0 },
  { id: 'tier-21', name: 'Void Station',       buyIn: 5_000_000,   description: 'An orbital arena floating in the void. Zero room for error at a five-million buy-in.',                  difficulty: 'Extreme',     color: 'bg-red-500/10 border-red-500/30 text-red-400',       accentColor: '#f87171', borderAccent: '#ef4444', botsCount: 30, rewardMultiplier: 38.0 },
  { id: 'tier-22', name: 'Phantom Reach',      buyIn: 10_000_000,  description: 'Ghost-like operators compete for massive chip pools. Bots use advanced flanking tactics.',             difficulty: 'Extreme',     color: 'bg-red-600/10 border-red-600/30 text-red-500',       accentColor: '#dc2626', borderAccent: '#b91c1c', botsCount: 30, rewardMultiplier: 45.0 },
  { id: 'tier-23', name: 'Inferno Gate',       buyIn: 20_000_000,  description: 'Twenty million at stake. The heat is unbearable — bots charge aggressively on sight.',                 difficulty: 'Extreme',     color: 'bg-rose-600/10 border-rose-600/30 text-rose-500',     accentColor: '#e11d48', borderAccent: '#be123c', botsCount: 30, rewardMultiplier: 52.0 },
  { id: 'tier-24', name: 'Tartarus Pit',       buyIn: 40_000_000,  description: 'The deepest pit before legendary territory. Forty million to enter — only the elite survive.',         difficulty: 'Extreme',     color: 'bg-rose-600/10 border-rose-600/30 text-rose-500',     accentColor: '#f43f5e', borderAccent: '#e11d48', botsCount: 30, rewardMultiplier: 60.0 },

  // ── LEGENDARY (Tiers 25–30): 75,000,000c to 1,000,000,000c ──
  { id: 'tier-25', name: 'Venom Grand',         buyIn: 75_000_000,          description: 'The grand Venom arena. Only the wealthiest operators dare challenge at this level.',                 difficulty: 'Legendary',   color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',   accentColor: '#f59e0b', borderAccent: '#d97706', botsCount: 30, rewardMultiplier: 70.0 },
  { id: 'tier-26', name: 'Omega Station',       buyIn: 150_000_000,         description: 'A hundred fifty million to enter. The stakes defy comprehension — every second is worth thousands.',    difficulty: 'Legendary',   color: 'bg-orange-500/10 border-orange-500/30 text-orange-400', accentColor: '#f97316', borderAccent: '#ea580c', botsCount: 30, rewardMultiplier: 80.0 },
  { id: 'tier-27', name: 'Singularity Core',    buyIn: 300_000_000,         description: 'A gravitational singularity arena. Three hundred million at stake — nothing escapes its pull.',         difficulty: 'Legendary',   color: 'bg-red-500/10 border-red-500/30 text-red-400',       accentColor: '#ef4444', borderAccent: '#dc2626', botsCount: 30, rewardMultiplier: 90.0 },
  { id: 'tier-28', name: 'Eternity Vault',      buyIn: 500_000_000,         description: 'Time stands still in this vault. Five hundred million at play — patience or aggression?',             difficulty: 'Legendary',   color: 'bg-rose-600/10 border-rose-600/30 text-rose-500',   accentColor: '#e11d48', borderAccent: '#be123c', botsCount: 30, rewardMultiplier: 100.0 },
  { id: 'tier-29', name: 'Abyssal Throne',      buyIn: 750_000_000,         description: 'The throne of the abyss. Seven hundred fifty million to challenge the king of the arena.',          difficulty: 'Legendary',   color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400', accentColor: '#eab308', borderAccent: '#ca8a04', botsCount: 30, rewardMultiplier: 120.0 },
  { id: 'tier-30', name: 'The Singularity',     buyIn: 1_000_000_000,       description: 'The ultimate arena. One billion chips. Mythical territory where fortunes are made and destroyed in an instant.', difficulty: 'Legendary', color: 'bg-yellow-400/10 border-yellow-400/30 text-yellow-300', accentColor: '#facc15', borderAccent: '#eab308', botsCount: 30, rewardMultiplier: 150.0 },
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
export type CosmeticType = 'skin' | 'trail' | 'death' | 'flag' | 'banner';
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
  { id: 'skin-default', name: 'Toxic Slime', cost: 0, type: 'skin', color: '#22c55e', secondaryColor: '#15803d', description: 'The standard issue bio-luminescent skin.', emoji: '🐍' },
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
  // ----- Trails (3) -----
  { id: 'trail-none', name: 'Basic Sparks', cost: 0, type: 'trail', color: '#ffffff', description: 'A simple trail of glowing friction particles.', emoji: '✨' },
  { id: 'trail-plasma', name: 'Plasma Arc', cost: 80, type: 'trail', color: '#ec4899', description: 'Charged electromagnetic pink plasma particles.', emoji: '⚡' },
  { id: 'trail-comet', name: 'Stardust Drift', cost: 300, type: 'trail', color: '#3b82f6', description: 'Cosmic tail particles that simulate a falling comet.', emoji: '☄️' },
  // ----- Death Bursts (2) -----
  { id: 'death-default', name: 'Toxic Splash', cost: 0, type: 'death', color: '#22c55e', description: 'The standard chemical burst upon disintegration.', emoji: '💥' },
  { id: 'death-nova', name: 'Hypernova Burst', cost: 180, type: 'death', color: '#f97316', description: 'A dazzling flash resembling a collapsing star.', emoji: '🌌' },
  // ----- Flags (6) -----
  { id: 'flag-syndicate', name: 'Syndicate Skull', cost: 50, type: 'flag', color: '#ef4444', description: 'The pirate skull insignia of the Viper Syndicate.', emoji: '🏴‍☠️' },
  { id: 'flag-pride', name: 'Rainbow Pride', cost: 80, type: 'flag', color: '#ec4899', description: 'Express pride with a rainbow flag on your tail.', emoji: '🏳️‍🌈' },
  { id: 'flag-stars', name: 'Star Spangled', cost: 100, type: 'flag', color: '#3b82f6', description: 'The patriotic stripes and stars flag.', emoji: '🇺🇸' },
  { id: 'flag-union', name: 'Union Jack', cost: 100, type: 'flag', color: '#ef4444', description: 'The royal cross of the Union Jack.', emoji: '🇬🇧' },
  { id: 'flag-tricolor', name: 'Tricolor Saffron', cost: 100, type: 'flag', color: '#f97316', description: 'The elegant tricolor flag with the Ashoka Chakra.', emoji: '🇮🇳' },
  { id: 'flag-vip', name: 'VIP Gold', cost: 300, type: 'flag', color: '#fbbf24', description: 'The golden flag of elite high stakes participants.', emoji: '🚩' },
  // ----- Banners (3) -----
  { id: 'banner-neon', name: 'Synthwave Sunset', cost: 150, type: 'banner', color: 'from-pink-500 via-purple-600 to-indigo-700', description: 'A gorgeous retro-synthwave neon skyline backdrop.', emoji: '🌅' },
  { id: 'banner-obsidian', name: 'Obsidian Matrix', cost: 200, type: 'banner', color: 'from-slate-900 via-emerald-950 to-slate-950 border-emerald-500/40', description: 'Dark, sleek green terminal hex lines for elite coders.', emoji: '🌌' },
  { id: 'banner-championship', name: 'Grand Champion', cost: 500, type: 'banner', color: 'from-amber-400 via-yellow-600 to-amber-900 border-amber-400', description: 'Prestige golden frame reserved for championship qualified.', emoji: '🏆' },
];

export function getCosmeticById(id: string): Skin | undefined {
  return ALL_COSMETICS.find((c) => c.id === id);
}

// ----------------------------------------------------------------------------
// World / physics constants
// ----------------------------------------------------------------------------
export const WORLD_SIZE = 8000;
export const WORLD_RADIUS = 4000; // center of 8000x8000 world (used for offline infinite offset)
export const INITIAL_BODY_LENGTH = 20; // Base body value at spawn (score starts at 20)
export const INITIAL_SPAWN_SCORE = 20; // Starting score — all food collected adds to this
export const SEGMENT_SPACING = 6;
export const BASE_SPEED = 4.5; // normal snake speed (reduced for better control)
export const BOOST_SPEED = 8.0; // boost speed (reduced for better control)
export const EXTRACT_GLIDE_SPEED = 3.2; // speed while extracting
export const EXTRACT_DURATION_MS = 3000; // 3-second extraction
export const EXTRACT_COMMISSION = 0.35; // 35% commission when >=4 real players
export const RESPAWN_INVULN_MS = 4000; // spawn protection
export const MAX_BODY_LENGTH = 200; // cap raised for longer games
export const BOOST_MIN_LENGTH = 8; // need >8 segments to boost
export const BOOST_DROP_INTERVAL = 40; // drop 1 tail segment every 40 frames
export const TICK_RATE_HZ = 30;
export const TICK_MS = 1000 / TICK_RATE_HZ;
export const BROADCAST_RATE_HZ = 20;
export const BROADCAST_MS = 1000 / BROADCAST_RATE_HZ;
export const MAX_SNAPSHOTS_PER_SECOND = 20;

// Turn rate
export const TURN_BASE = 0.35; // increased for much tighter control
export const TURN_MIN = 0.08;
export const TURN_SCORE_FACTOR = 0.0003; // further reduced impact of score on turn rate

// Size formula
export const SIZE_BASE = 8;
export const SIZE_SCORE_FACTOR = 0.4;

// Snake collision hit factor
export const COLLISION_HIT_FACTOR = 0.75;

// Head-on collision hit factor (slightly tighter for head-head)
export const HEAD_ON_HIT_FACTOR = 0.8;

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

export const FOOD_COUNT_TARGET = 1200; // total food orbs per arena
export const REGULAR_FOOD_GROW = 1; // legacy alias (food value IS the grow amount)

// Star collectibles — always exactly 10 dropped on player death
export const STAR_DROP_COUNT = 10; // ALWAYS exactly 10 stars
export const STAR_CHIP_GROW = 3; // score bonus when collecting a star (in addition to chip value)

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

export const CHIP_PACKS: ChipPack[] = [
  { id: 'pack-10', name: 'Starter Pack', chips: 1000, priceINR: 10, priceUSD: '$0.12', bonus: 'Base Rate', desc: '1,000 Chips at 100 Chips/₹1.', emoji: '🪙' },
  { id: 'pack-50', name: 'Scout Bundle', chips: 5100, priceINR: 50, priceUSD: '$0.60', bonus: '+2% Bonus', desc: '5,100 Chips with early stakes bonus.', emoji: '💰' },
  { id: 'pack-100', name: 'Contender Sack', chips: 10500, priceINR: 100, priceUSD: '$1.20', bonus: '+5% Bonus', desc: '10,500 Chips for medium arena buy-ins.', emoji: '🎒' },
  { id: 'pack-250', name: 'Gladiator Chest', chips: 27500, priceINR: 250, priceUSD: '$3.00', bonus: '+10% Bonus', desc: '27,500 Chips for serious competitors.', emoji: '🧰', },
  { id: 'pack-500', name: 'High Roller Vault', chips: 57500, priceINR: 500, priceUSD: '$6.00', bonus: '+15% Bonus', desc: '57,500 Chips for VIP Syndicate arenas.', emoji: '💎' },
  { id: 'pack-1000', name: 'Championship Crate', chips: 120000, priceINR: 1000, priceUSD: '$12.00', bonus: '+20% Bonus', desc: '1,20,000 Chips for Apex Vault entry.', emoji: '🏆' },
  { id: 'pack-2500', name: 'Syndicate Treasury', chips: 325000, priceINR: 2500, priceUSD: '$30.00', bonus: '+30% Bonus', desc: '3,25,000 Chips for grand tournament runs.', emoji: '🏦' },
  { id: 'pack-5000', name: 'National Titan Coffer', chips: 700000, priceINR: 5000, priceUSD: '$60.00', bonus: '+40% Bonus', desc: '7,00,000 Chips for country leaderboard pushes.', emoji: ' titan' },
  { id: 'pack-10000', name: 'World Champion Trove', chips: 1500000, priceINR: 10000, priceUSD: '$120.00', bonus: '+50% Bonus', desc: '15,00,000 Chips for global elite domination.', emoji: '🌍' },
  { id: 'pack-15000', name: 'MAX ANNUAL CAP PACK', chips: 2500000, priceINR: 15000, priceUSD: '$175.00', bonus: '+66.67% BONUS (INSTANT LOCK)', desc: '25,00,000 Chips! Reaches ₹15,000 annual spending cap and locks store for 365 days.', emoji: '👑' },
];

// Promo codes
export const PROMO_CODES: Record<string, number> = {
  VENOM: 500,
  CHAMPION: 1000,
};

// ----------------------------------------------------------------------------
// Levels / XP — original: xpNeeded = level * 200
// ----------------------------------------------------------------------------
export function xpForLevel(level: number): number {
  return level * 200;
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

// Hall of Fame live commentary seed entries
export const INITIAL_COMMENTARY = [
  { id: 'c1', ts: '13:41:02 UTC', text: '🎙️ ESPORTS DESK: Hari from India (#IND-001) locked in a massive extraction in Tier-05 High Stakes Arena!' },
  { id: 'c2', ts: '13:40:48 UTC', text: '💥 ARENA BLAST: Apex_Viper eliminated Scavenger_Bot and harvested 12 Star Chips on boundary!' },
  { id: 'c3', ts: '13:39:15 UTC', text: '👑 MILESTONE NOTICE: User K-Snake_Master reached 2,500,000 banked chips & secured Platinum Sovereign Tier!' },
];

export const COMMENTARY_NAMES = ['Hari', 'Apex_Viper', 'Shadow_Ninja', 'Elysium_God', 'Ronin_JP', 'Brazil_King'];

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

export interface ChampionshipContender {
  rank: number;
  name: string;
  userTag: string;
  gamesPlayed: number;
  walletChips: number;
  clanTag: string;
  country: string;
  region: string;
  projectedPrize: string;
}

export const INITIAL_CONTENDERS: ChampionshipContender[] = [
  { rank: 1, name: 'Hari', userTag: '#IND-001', gamesPlayed: 4820, walletChips: 10_000_000, clanTag: 'APEX', country: 'IN', region: 'APAC', projectedPrize: '5,00,000 Chips + 👑 2026 WORLD CHAMPION' },
  { rank: 2, name: 'ApexViper_IND', userTag: '#IND-002', gamesPlayed: 6210, walletChips: 9_400_000, clanTag: 'APEX', country: 'IN', region: 'APAC', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 3, name: 'VenomKing_US', userTag: '#USA-882', gamesPlayed: 5890, walletChips: 8_800_000, clanTag: 'APEX', country: 'US', region: 'NA', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 4, name: 'K-Snake_Master', userTag: '#KOR-114', gamesPlayed: 4120, walletChips: 8_200_000, clanTag: 'NINJA', country: 'KR', region: 'APAC', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 5, name: 'ShadowSlinker_JP', userTag: '#JPN-309', gamesPlayed: 3940, walletChips: 7_600_000, clanTag: 'NINJA', country: 'JP', region: 'APAC', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 6, name: 'KaiserSlayer_DE', userTag: '#GER-901', gamesPlayed: 5100, walletChips: 6_900_000, clanTag: 'WAR', country: 'DE', region: 'EU', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 7, name: 'SambaVenom_BR', userTag: '#BRA-502', gamesPlayed: 4890, walletChips: 6_400_000, clanTag: 'BRZ', country: 'BR', region: 'LATAM', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 8, name: 'BritStriker_UK', userTag: '#UK-402', gamesPlayed: 3820, walletChips: 5_800_000, clanTag: 'ROYAL', country: 'GB', region: 'EU', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 9, name: 'CobraMaster_IN', userTag: '#IND-8821', gamesPlayed: 2950, walletChips: 5_200_000, clanTag: 'PHNX', country: 'IN', region: 'APAC', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 10, name: 'Dragon_Slayer_US', userTag: '#USA-104', gamesPlayed: 4100, walletChips: 4_900_000, clanTag: 'APEX', country: 'US', region: 'NA', projectedPrize: '2,500,000 Chips + 🥈 ARENA OVERLORD' },
  { rank: 11, name: 'Delhi_King', userTag: '#IND-003', gamesPlayed: 2100, walletChips: 4_500_000, clanTag: 'PHNX', country: 'IN', region: 'APAC', projectedPrize: '1,000,000 Chips + 🥉 ELITE MASTER' },
  { rank: 12, name: 'Cyber_Wolf_US', userTag: '#USA-102', gamesPlayed: 3200, walletChips: 4_100_000, clanTag: 'CYBER', country: 'US', region: 'NA', projectedPrize: '1,000,000 Chips + 🥉 ELITE MASTER' },
  { rank: 15, name: 'Ronin_Slayer_JP', userTag: '#JPN-881', gamesPlayed: 1800, walletChips: 3_800_000, clanTag: 'NINJA', country: 'JP', region: 'APAC', projectedPrize: '1,000,000 Chips + 🥉 ELITE MASTER' },
  { rank: 52, name: 'Challenger_Viper', userTag: '#IND-902', gamesPlayed: 850, walletChips: 1_200_000, clanTag: 'VPR', country: 'IN', region: 'APAC', projectedPrize: '250,000 Chips + 🛡️ CONTENDER' },
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

export const SOCIAL_COUNTRY_FILTER = [
  { code: 'ALL', name: 'All Countries', flag: '🌐' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
];

// Public clans (SocialPanel.tsx — distinct from ClanSystem.tsx)
export interface PublicClan {
  id: string;
  name: string;
  tag: string;
  emblem: string;
  level: number;
  bankedChips: number;
  description: string;
  members: { name: string; role: string; level: number; chips: number }[];
}

export const PUBLIC_CLANS: PublicClan[] = [
  {
    id: 'c-1',
    name: 'Apex Predators',
    tag: 'APEX',
    emblem: '🦅',
    level: 8,
    bankedChips: 15_000,
    description: 'Elite hunters only. Extract with 100+ chips or get kicked.',
    members: [
      { name: 'VenomKing', role: 'Leader', level: 55, chips: 5000 },
      { name: 'ApexViper', role: 'Co-Leader', level: 42, chips: 3500 },
      { name: 'StrikeFast', role: 'Viper', level: 22, chips: 1200 },
    ],
  },
  {
    id: 'c-2',
    name: 'Slinky Syndicate',
    tag: 'SLYK',
    emblem: '🐍',
    level: 5,
    bankedChips: 4_500,
    description: "Casual chip collectors. Let's grow together!",
    members: [
      { name: 'CozyCobra', role: 'Leader', level: 31, chips: 2000 },
      { name: 'ShadowSlinker', role: 'Viper', level: 18, chips: 800 },
      { name: 'GoldHoarder', role: 'Viper', level: 15, chips: 500 },
    ],
  },
];

export const PRESET_EMBLEMS = ['🐍', '🦅', '🎯', '💀', '💎', '🔥', '👑', '⚡', '🏆', '☣️'];

export const BOT_REPLIES = [
  'Nice run in the High-Stakes Arena today! 🏆',
  'That was an insane cut-off! Easy food. 💥',
  "Don't forget to deposit chips, we need that Level 10 Clan Buff! 💎",
  'Who is up for some Venom Arena lobbies? 🐍',
  'Just extracted with 250 chips, feeling like a god! 😎',
  'Slinky style, baby! 😂',
  'Be careful of VenomKing, he was hunting everyone in Tier 3!',
];

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
// ClipShowcase — 3 mock clips
// ----------------------------------------------------------------------------
export interface ShowcaseClip {
  id: string;
  title: string;
  creator: string;
  tag: string;
  country: string;
  platform: 'YouTube' | 'Twitch';
  url: string;
  extractedChips: number;
  upvotes: number;
  dateStr: string;
  tags: string[];
}

export const SAMPLE_CLIPS: ShowcaseClip[] = [
  {
    id: 'clip-1',
    title: '1,00,00,000 CHIPS EXTRACTION CLUTCH IN TIER-05 ARENA! 🔥',
    creator: 'Hari',
    tag: '#IND-001',
    country: 'IN',
    platform: 'YouTube',
    url: 'https://youtube.com/watch?v=demo_hari_crore',
    extractedChips: 10_000_000,
    upvotes: 4210,
    dateStr: '23 Jan 2027',
    tags: ['Crore Milestone', 'Tier-05', 'High Stakes'],
  },
  {
    id: 'clip-2',
    title: 'SOLO 1V3 VIPER TRAP ON EXTRACTION ZONE BOUNDARY 🐍',
    creator: 'Apex_Viper',
    tag: '#USA-882',
    country: 'US',
    platform: 'Twitch',
    url: 'https://twitch.tv/videos/demo_apex_clutch',
    extractedChips: 2_500_000,
    upvotes: 1890,
    dateStr: '25 Jan 2027',
    tags: ['1v3 Clutch', 'Platinum Tier'],
  },
  {
    id: 'clip-3',
    title: 'NINJA SNAKE DNA SKIN SHOWCASE & SPEED EXTRACTION ⚡',
    creator: 'Shadow_Ninja',
    tag: '#JPN-309',
    country: 'JP',
    platform: 'YouTube',
    url: 'https://youtube.com/watch?v=demo_ninja_speed',
    extractedChips: 5_000_000,
    upvotes: 1240,
    dateStr: '22 Jan 2027',
    tags: ['Skin Showcase', 'Speed Run'],
  },
];

// ----------------------------------------------------------------------------
// Player inspector — hardcoded allies, stats, match history, loadout
// ----------------------------------------------------------------------------
export const INSPECTOR_ALLIES_REGIONAL = [
  { name: 'Hari', userTag: '#IND-001', country: 'IN', role: 'Leader' },
  { name: 'Rookie_Striker', userTag: '#IND-104', country: 'IN', role: 'Member' },
];

export const INSPECTOR_ALLIES_GLOBAL = [
  { name: 'Apex_Viper', userTag: '#USA-882', country: 'US', role: 'Officer' },
  { name: 'K-Snake', userTag: '#KOR-114', country: 'KR', role: 'Ally' },
];

export const INSPECTOR_BADGES = [
  { icon: '👑', title: '1 Crore Immortal', desc: 'Extracted over 10M Chips' },
  { icon: '⚡', title: 'Apex Vanguard', desc: 'Top 1% Arena Leaderboard' },
];

export const INSPECTOR_LOADOUT = [
  { label: 'Snake DNA Skin:', value: '👑 Cyber Serpent God' },
  { label: 'Tail Trail FX:', value: '⚡ Hyper Plasma Arc' },
  { label: 'Kill Sound Effect:', value: '🔊 Cyber Siren Roar' },
  { label: 'Victory Emote:', value: '👑 Royal Throne Taunt' },
];

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
