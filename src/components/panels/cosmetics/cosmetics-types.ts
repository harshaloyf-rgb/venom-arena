// ---------------------------------------------------------------------------
// Palette (28 swatches) — maximally distinct colors across the spectrum
// ---------------------------------------------------------------------------
export const PALETTE_COLORS = [
  { name: 'Red Alert', hex: '#ef4444' },
  { name: 'Solar Orange', hex: '#f97316' },
  { name: 'Midas Gold', hex: '#f59e0b' },
  { name: 'Lemon Yellow', hex: '#facc15' },
  { name: 'Acid Green', hex: '#22c55e' },
  { name: 'Bright Turquoise', hex: '#14b8a6' },
  { name: 'Cyber Cyan', hex: '#06b6d4' },
  { name: 'Light Sky Blue', hex: '#38bdf8' },
  { name: 'Sapphire', hex: '#3b82f6' },
  { name: 'Royal Indigo', hex: '#6366f1' },
  { name: 'Lavender Violet', hex: '#a78bfa' },
  { name: 'Shadow Purple', hex: '#a855f7' },
  { name: 'Fuchsia', hex: '#e879f9' },
  { name: 'Orchid Pink', hex: '#ec4899' },
  { name: 'Rose', hex: '#fb7185' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Slate Gray', hex: '#64748b' },
  { name: 'Pitch Black', hex: '#090d16' },
  { name: 'Coral', hex: '#ff7f50' },
  { name: 'Bronze', hex: '#cd853f' },
  { name: 'Olive', hex: '#556b2f' },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'Deep Magenta', hex: '#ff1493' },
  { name: 'Midnight Blue', hex: '#191970' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Sea Green', hex: '#2e8b57' },
  { name: 'Hot Pink', hex: '#ff69b4' },
  { name: 'Copper', hex: '#b87333' },
];

// ---------------------------------------------------------------------------
// Custom skin segment shape — matches original `CustomSegment` interface.
// ---------------------------------------------------------------------------
export type SegShape = 'circle' | 'square' | 'diamond' | 'spike' | 'star' | 'hexagon' | 'triangle' | 'ring';
export interface CustomSegment {
  color: string;
  sizeScale: number;
  shape: SegShape;
  glow: boolean;
}

export type BodyStyle =
  | 'smooth'
  | 'dragon'
  | 'armored'
  | 'crystal'
  | 'obsidian'
  | 'basilisk'
  | 'stellar'
  | 'fortress'
  | 'stingray'
  | 'phantom';
export type TaperStyle = 'natural' | 'uniform' | 'wave' | 'heavy';

export interface SkinPreset {
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
// SKIN_PRESETS (20 free presets) — exact from AUDIT-C C.3
// ---------------------------------------------------------------------------
export const SKIN_PRESETS: SkinPreset[] = [
  {
    id: 'preset-fish',
    name: 'The Fish Snake',
    colors: ['#06b6d4', '#3b82f6', '#0ea5e9', '#0284c7'],
    shape: 'crystal',
    taper: 'wave',
    glow: true,
    emoji: '🐟',
    category: 'Cyber',
    description:
      'Aquatic scales with hydrodynamic dorsal fins and bubble bioluminescence.',
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
    description:
      'Golden apex mane headpiece with furious amber predator scales.',
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
    description:
      'Chrome exhaust head, asphalt dark body segments, and burnout smoke trail.',
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
    description:
      'Gold dollar medallion crown with stacked casino chip coin segments.',
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
    description:
      'Brave red, white, and blue colors streaming in perfect unison.',
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
    description:
      'Sweet pink flesh bordered by alternating deep forest green scales.',
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
    description:
      'Dangerous orange and obsidian bands armed with body-tapering spikes.',
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
    description:
      'Sweet spearmint and white swirl nodes radiating clean aura.',
  },
  {
    id: 'preset-rainbow-unicorn',
    name: 'Rainbow Unicorn',
    colors: [
      '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#6366f1',
      '#a855f7',
    ],
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
    description:
      'Bold black, red, and golden stripes representing national pride.',
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
    description:
      'Vibrant green and gold diamond nodes reflecting carnival energy.',
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
    description:
      'Armor scales colored in blazing gold, solar orange, and furnace red.',
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
    description:
      'Deep cosmic space colors with pulsing neon aurora bioluminescence.',
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
    description:
      'Armored obsidian spikes interspaced with blistering crimson core nodes.',
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
    description:
      'Futuristic cyan lines on dark background representing grid patterns.',
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
    description:
      'Tactical ironclad grey plates accented with heavy yellow and blue rocket spikes.',
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
    description:
      'Shining royal gold armored spike scales fit for mythical emperors.',
  },
  // ---------------------------------------------------------------------------
  // SKIN_PRESETS batch 2 (2026-09-05 catalog expansion, 20 free presets)
  // Showcases the underused body styles (stellar / fortress / stingray /
  // phantom / basilisk) + new flag presets (India first).
  // ---------------------------------------------------------------------------
  {
    id: 'preset-india',
    name: 'India Tricolor',
    colors: ['#ff9933', '#ffffff', '#138808', '#ffffff'],
    shape: 'smooth',
    taper: 'natural',
    glow: true,
    emoji: '🇮🇳',
    category: 'Flags',
    description:
      'Saffron, white, and India green bands with chakra-blue spirit.',
  },
  {
    id: 'preset-japan',
    name: 'Japan Sunrise',
    colors: ['#ffffff', '#ef4444', '#ffffff', '#ef4444'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🇯🇵',
    category: 'Flags',
    description: 'Rising-sun crimson bands over pure white scales.',
  },
  {
    id: 'preset-canada',
    name: 'Canada Maple',
    colors: ['#ef4444', '#ffffff', '#ef4444', '#ffffff'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🇨🇦',
    category: 'Flags',
    description: 'Maple-leaf red and white bars coast to coast.',
  },
  {
    id: 'preset-mexico',
    name: 'Mexico Verde',
    colors: ['#22c55e', '#ffffff', '#ef4444', '#22c55e'],
    shape: 'crystal',
    taper: 'natural',
    glow: true,
    emoji: '🇲🇽',
    category: 'Flags',
    description: 'Tricolor gems echoing the eagle standard.',
  },
  {
    id: 'preset-uk',
    name: 'Union Jack',
    colors: ['#3b82f6', '#ffffff', '#ef4444', '#3b82f6'],
    shape: 'armored',
    taper: 'uniform',
    glow: false,
    emoji: '🇬🇧',
    category: 'Flags',
    description: 'Crossed saltire plates in navy, white, and red.',
  },
  {
    id: 'preset-nigeria',
    name: 'Nigeria Eagles',
    colors: ['#22c55e', '#ffffff', '#22c55e', '#ffffff'],
    shape: 'smooth',
    taper: 'uniform',
    glow: false,
    emoji: '🇳🇬',
    category: 'Flags',
    description: 'Green-white-green bars flying super high.',
  },
  {
    id: 'preset-penguin',
    name: 'Penguin Tuxedo',
    colors: ['#090d16', '#ffffff', '#090d16', '#f59e0b'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🐧',
    category: 'Classic',
    description: 'Formal black tie with a golden beak accent.',
  },
  {
    id: 'preset-grape-jelly',
    name: 'Grape Jelly',
    colors: ['#7c3aed', '#a78bfa', '#5b21b6', '#c4b5fd'],
    shape: 'basilisk',
    taper: 'natural',
    glow: true,
    emoji: '🍇',
    category: 'Classic',
    description: 'Squishy royal-purple nodes in jammy alternation.',
  },
  {
    id: 'preset-bubblegum',
    name: 'Bubblegum Pop',
    colors: ['#f472b6', '#fbcfe8', '#ec4899', '#ffffff'],
    shape: 'stellar',
    taper: 'wave',
    glow: true,
    emoji: '🍭',
    category: 'Classic',
    description: 'Spinning pink starbursts with a sugar sheen.',
  },
  {
    id: 'preset-sand-viper',
    name: 'Sand Viper',
    colors: ['#d97706', '#fbbf24', '#b45309', '#fde68a'],
    shape: 'stingray',
    taper: 'natural',
    glow: false,
    emoji: '🏜️',
    category: 'Classic',
    description: 'Dune-colored blades that strike from ambush.',
  },
  {
    id: 'preset-emerald-queen',
    name: 'Emerald Queen',
    colors: ['#059669', '#fbbf24', '#047857', '#fbbf24'],
    shape: 'fortress',
    taper: 'uniform',
    glow: true,
    emoji: '👑',
    category: 'Classic',
    description: 'Hexagonal jade plating with golden regalia.',
  },
  {
    id: 'preset-ruby-fang',
    name: 'Ruby Fang',
    colors: ['#be123c', '#f43f5e', '#881337', '#fb7185'],
    shape: 'dragon',
    taper: 'heavy',
    glow: true,
    emoji: '💎',
    category: 'Classic',
    description: 'Deep-red gemstone scales with aggressive spikes.',
  },
  {
    id: 'preset-toxic-waste',
    name: 'Toxic Waste',
    colors: ['#84cc16', '#090d16', '#a3e635', '#365314'],
    shape: 'phantom',
    taper: 'wave',
    glow: true,
    emoji: '☢️',
    category: 'Classic',
    description: 'Semi-transparent slime rings leaking luminescence.',
  },
  {
    id: 'preset-arctic-fox',
    name: 'Arctic Fox',
    colors: ['#f8fafc', '#e0f2fe', '#ffffff', '#bae6fd'],
    shape: 'crystal',
    taper: 'uniform',
    glow: true,
    emoji: '🌨️',
    category: 'Classic',
    description: 'Snow-white crystals with a frostbite shimmer.',
  },
  {
    id: 'preset-void-circuit',
    name: 'Void Circuit',
    colors: ['#090d16', '#06b6d4', '#090d16', '#22d3ee'],
    shape: 'fortress',
    taper: 'uniform',
    glow: true,
    emoji: '🔲',
    category: 'Cyber',
    description: 'Null-black hex plates etched with cyan traces.',
  },
  {
    id: 'preset-laser-lime',
    name: 'Laser Lime',
    colors: ['#a3e635', '#06b6d4', '#84cc16', '#090d16'],
    shape: 'stingray',
    taper: 'uniform',
    glow: true,
    emoji: '⚡',
    category: 'Cyber',
    description: 'Cutting lime beams with cyber cutter tips.',
  },
  {
    id: 'preset-quantum-violet',
    name: 'Quantum Violet',
    colors: ['#7c3aed', '#c4b5fd', '#4c1d95', '#e9d5ff'],
    shape: 'stellar',
    taper: 'wave',
    glow: true,
    emoji: '🔮',
    category: 'Cyber',
    description: 'Superposed violet stars collapse when observed.',
  },
  {
    id: 'preset-mecha-mk2',
    name: 'Mecha Mk-II',
    colors: ['#64748b', '#ef4444', '#090d16', '#facc15'],
    shape: 'armored',
    taper: 'heavy',
    glow: true,
    emoji: '🦾',
    category: 'Cyber',
    description: 'Second-gen combat plating with alert markers.',
  },
  {
    id: 'preset-holo-ghost',
    name: 'Holo Ghost',
    colors: ['#67e8f9', '#a5f3fc', '#0891b2', '#ec4899'],
    shape: 'phantom',
    taper: 'wave',
    glow: true,
    emoji: '🌀',
    category: 'Cyber',
    description: 'Projection rings phasing between cyan and pink.',
  },
  {
    id: 'preset-nebula-storm',
    name: 'Nebula Storm',
    colors: ['#4338ca', '#ec4899', '#7c3aed', '#22d3ee'],
    shape: 'basilisk',
    taper: 'wave',
    glow: true,
    emoji: '🌠',
    category: 'Cyber',
    description: 'Stellar nursery diamonds in a solar wind.',
  },
];

// ---------------------------------------------------------------------------
// localStorage custom-skin persistence
// ---------------------------------------------------------------------------
export interface CustomSkinState {
  useCustomSkin: boolean;
  currentSkin: string; // preset id or 'custom-lab-skin'
  customSkinSegments: CustomSegment[];
}

export const CUSTOM_SKIN_KEY = 'venom_custom_skin_state';

// ---------------------------------------------------------------------------
// Shop UI types & constants
// ---------------------------------------------------------------------------
export type ShopView = 'inventory' | 'presets' | 'editor' | 'cosmetics';
export type CategoryFilter =
  | 'all'
  | 'presets'
  | 'premium'
  | 'cosmetics';

export const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: '🌈 All Items' },
  { id: 'presets', label: '🐍 Ready Presets (Free!)' },
  { id: 'premium', label: '✨ Premium Shop' },
  { id: 'cosmetics', label: '🎭 Face Cosmetics' },
];

export const BODY_STYLE_OPTIONS: {
  id: BodyStyle;
  label: string;
  desc: string;
}[] = [
  { id: 'smooth', label: 'Smooth Circles', desc: 'Standard sleek nodes' },
  { id: 'dragon', label: 'Dragon Scales', desc: 'Alternating jagged spikes' },
  {
    id: 'armored',
    label: 'Armored Plates',
    desc: 'Futuristic squad blocks',
  },
  {
    id: 'crystal',
    label: 'Crystal Shards',
    desc: 'Alternating shiny gems',
  },
  {
    id: 'obsidian',
    label: 'Spiky Obsidian',
    desc: 'Full high-threat spikes',
  },
  {
    id: 'basilisk',
    label: 'Basilisk Diamonds',
    desc: 'Pointy royal nodes',
  },
  {
    id: 'stellar',
    label: 'Stellar Stars',
    desc: 'Rotating 5-pointed stars',
  },
  {
    id: 'fortress',
    label: 'Fortress Hex',
    desc: 'Hexagonal armor plating',
  },
  {
    id: 'stingray',
    label: 'Stingray Blades',
    desc: 'Forward-pointing triangles',
  },
  {
    id: 'phantom',
    label: 'Phantom Ghost',
    desc: 'Semi-transparent specters',
  },
];

export const TAPER_OPTIONS: { id: TaperStyle; label: string }[] = [
  { id: 'natural', label: 'Natural Taper' },
  { id: 'uniform', label: 'Uniform Width' },
  { id: 'wave', label: 'Sinuous Wave' },
  { id: 'heavy', label: 'Heavy Head' },
];

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------
export interface CosmeticsShopProps {
  onToast?: import('@/components/panels/_panel-primitives').ToastFn;
}
