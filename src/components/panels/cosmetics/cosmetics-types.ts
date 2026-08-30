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

export interface SlitherPreset {
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
export const SLITHER_PRESETS: SlitherPreset[] = [
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
export type ShopView = 'presets' | 'editor' | 'cosmetics';
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
