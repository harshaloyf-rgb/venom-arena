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
  // ---------------------------------------------------------------------------
  // Former premium manufactured skins (24) — relocated to the FREE preset pool
  // 2026-09-05 per product decision: the premium shop stocks ONLY the 12
  // character-face skins; everything else is free Genetic Lab presets.
  // ---------------------------------------------------------------------------
  {
    id: 'preset-emerald-fang',
    name: 'Emerald Fang',
    colors: ['#10b981', '#065f46', '#10b981', '#065f46'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🟢',
    category: 'Classic',
    description: 'Polished green scales with a venomous edge.',
  },
  {
    id: 'preset-rose-quartz',
    name: 'Rose Quartz',
    colors: ['#fb7185', '#be123c', '#fb7185', '#be123c'],
    shape: 'smooth',
    taper: 'natural',
    glow: true,
    emoji: '🌸',
    category: 'Classic',
    description: 'Soft crystal pink that shimmers through the spectrum.',
  },
  {
    id: 'preset-sapphire-ice',
    name: 'Sapphire Ice',
    colors: ['#38bdf8', '#0369a1', '#38bdf8', '#0369a1'],
    shape: 'crystal',
    taper: 'natural',
    glow: true,
    emoji: '💎',
    category: 'Cyber',
    description: 'Frozen sapphire facets with a sub-zero glow.',
  },
  {
    id: 'preset-amber-royal',
    name: 'Amber Royal',
    colors: ['#f59e0b', '#78350f', '#f59e0b', '#78350f'],
    shape: 'armored',
    taper: 'uniform',
    glow: false,
    emoji: '🟠',
    category: 'Classic',
    description: 'Fossilized amber plating fit for a Pharaoh.',
  },
  {
    id: 'preset-violet-storm',
    name: 'Violet Storm',
    colors: ['#8b5cf6', '#4c1d95', '#8b5cf6', '#4c1d95'],
    shape: 'basilisk',
    taper: 'natural',
    glow: true,
    emoji: '🌩️',
    category: 'Cyber',
    description: 'Charged violet cells that pulse before the strike.',
  },
  {
    id: 'preset-crimson-ops',
    name: 'Crimson Ops',
    colors: ['#ef4444', '#450a0a', '#ef4444', '#450a0a'],
    shape: 'phantom',
    taper: 'natural',
    glow: false,
    emoji: '🎯',
    category: 'Classic',
    description: 'Tactical red-on-black digital scales for covert runs.',
  },
  {
    id: 'preset-deep-abyss',
    name: 'Deep Abyss',
    colors: ['#0f172a', '#334155', '#0f172a', '#334155'],
    shape: 'armored',
    taper: 'uniform',
    glow: false,
    emoji: '🌑',
    category: 'Classic',
    description: 'Pressure-proof plating from the midnight zone.',
  },
  {
    id: 'preset-toxic-bloom',
    name: 'Toxic Bloom',
    colors: ['#84cc16', '#365314', '#84cc16', '#365314'],
    shape: 'phantom',
    taper: 'natural',
    glow: false,
    emoji: '☣️',
    category: 'Classic',
    description: 'Bio-luminous flora that thrives on venom.',
  },
  {
    id: 'preset-solar-pegasus',
    name: 'Solar Pegasus',
    colors: ['#fbbf24', '#f97316', '#fbbf24', '#f97316'],
    shape: 'smooth',
    taper: 'natural',
    glow: true,
    emoji: '🐴',
    category: 'Classic',
    description: 'Winged-light spectrum flowing stallion-fast.',
  },
  {
    id: 'preset-midnight-racer',
    name: 'Midnight Racer',
    colors: ['#090d16', '#06b6d4', '#090d16', '#06b6d4'],
    shape: 'stellar',
    taper: 'natural',
    glow: true,
    emoji: '🏁',
    category: 'Cyber',
    description: 'Night-circuit livery with glowing data lines.',
  },
  {
    id: 'preset-coral-reef',
    name: 'Coral Reef',
    colors: ['#ff7f50', '#0ea5e9', '#ff7f50', '#0ea5e9'],
    shape: 'crystal',
    taper: 'natural',
    glow: true,
    emoji: '🪸',
    category: 'Cyber',
    description: 'Warm coral polyps over deep sea blue.',
  },
  {
    id: 'preset-onyx-plate',
    name: 'Onyx Plate',
    colors: ['#1e293b', '#94a3b8', '#1e293b', '#94a3b8'],
    shape: 'armored',
    taper: 'uniform',
    glow: false,
    emoji: '⚫',
    category: 'Classic',
    description: 'Black stone armor edged in brushed silver.',
  },
  {
    id: 'preset-gold-pharaoh',
    name: 'Golden Pharaoh',
    colors: ['#fbbf24', '#b45309', '#fbbf24', '#b45309'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🏺',
    category: 'Classic',
    description: 'Wrapped gold banding for a tomb-guarding monarch.',
  },
  {
    id: 'preset-plasma-burst',
    name: 'Plasma Burst',
    colors: ['#e879f9', '#06b6d4', '#e879f9', '#06b6d4'],
    shape: 'basilisk',
    taper: 'natural',
    glow: true,
    emoji: '💥',
    category: 'Cyber',
    description: 'Contained plasma surge on the verge of rupture.',
  },
  {
    id: 'preset-jade-emperor',
    name: 'Jade Emperor',
    colors: ['#059669', '#fbbf24', '#059669', '#fbbf24'],
    shape: 'armored',
    taper: 'uniform',
    glow: false,
    emoji: '🀄',
    category: 'Classic',
    description: 'Imperial jade with gilded ceremony trim.',
  },
  {
    id: 'preset-frost-wolf',
    name: 'Frost Wolf',
    colors: ['#e0f2fe', '#1e40af', '#e0f2fe', '#1e40af'],
    shape: 'phantom',
    taper: 'natural',
    glow: false,
    emoji: '🐺',
    category: 'Classic',
    description: 'Tundra camouflage for a pack hunter.',
  },
  {
    id: 'preset-magma-heart',
    name: 'Magma Heart',
    colors: ['#f97316', '#7f1d1d', '#f97316', '#7f1d1d'],
    shape: 'stellar',
    taper: 'natural',
    glow: true,
    emoji: '❤️‍🔥',
    category: 'Cyber',
    description: 'A molten core glowing through cracked crust.',
  },
  {
    id: 'preset-quantum-ghost',
    name: 'Quantum Ghost',
    colors: ['#a5f3fc', '#7c3aed', '#a5f3fc', '#7c3aed'],
    shape: 'stellar',
    taper: 'natural',
    glow: true,
    emoji: '🫧',
    category: 'Cyber',
    description: 'Exists in two arenas at once. Renders in one.',
  },
  {
    id: 'preset-dragon-ember',
    name: 'Dragon Ember',
    colors: ['#b91c1c', '#f59e0b', '#b91c1c', '#f59e0b'],
    shape: 'smooth',
    taper: 'natural',
    glow: true,
    emoji: '🐲',
    category: 'Classic',
    description: 'Last embers of a furnace-breathing bloodline.',
  },
  {
    id: 'preset-void-walker',
    name: 'Void Walker',
    colors: ['#090d16', '#6366f1', '#090d16', '#6366f1'],
    shape: 'stellar',
    taper: 'natural',
    glow: true,
    emoji: '🕳️',
    category: 'Cyber',
    description: 'Steps between worlds, trailing indigo starlight.',
  },
  {
    id: 'preset-candy-pop',
    name: 'Candy Pop',
    colors: ['#f472b6', '#22d3ee', '#f472b6', '#22d3ee'],
    shape: 'smooth',
    taper: 'natural',
    glow: true,
    emoji: '🍭',
    category: 'Classic',
    description: 'Sugar-rush spectrum with a fizzy finish.',
  },
  {
    id: 'preset-thunder-raja',
    name: 'Thunder Raja',
    colors: ['#facc15', '#7c3aed', '#facc15', '#7c3aed'],
    shape: 'basilisk',
    taper: 'natural',
    glow: true,
    emoji: '👑',
    category: 'Cyber',
    description: 'Storm-crowned king whose coils crackle.',
  },
  {
    id: 'preset-oblivion',
    name: 'Oblivion',
    colors: ['#111827', '#dc2626', '#111827', '#dc2626'],
    shape: 'stellar',
    taper: 'natural',
    glow: true,
    emoji: '♏',
    category: 'Cyber',
    description: 'The last thing a run-away snake never sees.',
  },
  {
    id: 'preset-world-serpent',
    name: 'World Serpent',
    colors: ['#14532d', '#fbbf24', '#14532d', '#fbbf24'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🌍',
    category: 'Classic',
    description: 'Mythic banded coils long enough to ring an arena.',
  },

  // ---------------------------------------------------------------------------
  // SKIN_PRESETS batch 3 (2026-09-05): the 13 manufactured premium originals
  // relocated to the FREE pool (user decision "yes relocate to free presets").
  // Original ids are KEPT (skin-venom, skin-gold, ...) so accounts that still
  // have them as currentSkin keep resolving in the skin registry with zero
  // migration. The 4 that already had preset twins (fish/lion/motorbike/coin)
  // are NOT duplicated here — see LEGACY_SKIN_ALIAS below.
  // ---------------------------------------------------------------------------
  {
    id: 'skin-default',
    name: 'Toxic Slime',
    colors: ['#22c55e', '#22c55e', '#22c55e', '#22c55e'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🐍',
    category: 'Classic',
    description: 'The standard issue bio-luminescent skin.',
  },
  {
    id: 'skin-venom',
    name: 'Venom Stryker',
    colors: ['#a855f7', '#6b21a8', '#a855f7', '#6b21a8'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '👾',
    category: 'Cyber',
    description: 'A striking royal purple skin designed to intimidate.',
  },
  {
    id: 'skin-cyber',
    name: 'Cyber Grid',
    colors: ['#06b6d4', '#0891b2', '#22d3ee', '#0891b2'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🤖',
    category: 'Cyber',
    description: 'Futuristic grid design that flows like computer data.',
  },
  {
    id: 'skin-rainbow',
    name: 'Chameleon Aurora',
    colors: ['#ec4899', '#3b82f6', '#22c55e', '#f59e0b'],
    shape: 'crystal',
    taper: 'wave',
    glow: true,
    emoji: '🌈',
    category: 'Classic',
    description: 'A high-fidelity skin that transitions smoothly through a full color spectrum.',
  },
  {
    id: 'skin-neonglow',
    name: 'Cyber Glow Pulsar',
    colors: ['#06b6d4', '#a855f7', '#22d3ee', '#a855f7'],
    shape: 'crystal',
    taper: 'natural',
    glow: true,
    emoji: '⚡',
    category: 'Cyber',
    description: 'Radiates intense neon cyberpunk particles and a glowing high-contrast energy aura.',
  },
  {
    id: 'skin-metallic',
    name: 'Ironclad Titanium',
    colors: ['#64748b', '#475569', '#94a3b8', '#475569'],
    shape: 'fortress',
    taper: 'uniform',
    glow: false,
    emoji: '⚙️',
    category: 'Cyber',
    description: 'Sleek metallic armor plating that reflects light with heavy specularity.',
  },
  {
    id: 'skin-camo',
    name: 'Bio-Desert Camo',
    colors: ['#10b981', '#d97706', '#10b981', '#d97706'],
    shape: 'stingray',
    taper: 'natural',
    glow: false,
    emoji: '🛡️',
    category: 'Classic',
    description: 'Tactical jungle and sand digital scales to blend into toxic terrains.',
  },
  {
    id: 'skin-gold',
    name: 'Midas Touch',
    colors: ['#fbbf24', '#b45309', '#fbbf24', '#b45309'],
    shape: 'smooth',
    taper: 'natural',
    glow: true,
    emoji: '👑',
    category: 'Classic',
    description: 'A skin layered in solid gold to boast extreme wealth.',
  },
  {
    id: 'skin-crimson',
    name: 'Crimson Fury',
    colors: ['#ef4444', '#991b1b', '#ef4444', '#991b1b'],
    shape: 'smooth',
    taper: 'natural',
    glow: false,
    emoji: '🔥',
    category: 'Classic',
    description: 'For players who leave a trail of blood in their wake.',
  },
];

// ---------------------------------------------------------------------------
// Legacy manufactured-skin ids (removed from the premium shop 2026-09-05)
// that map onto their existing free preset twins. Keeps previously-equipped
// ids ('skin-fish', ...) resolvable in the skin registry and inventory equip.
// ---------------------------------------------------------------------------
export const LEGACY_SKIN_ALIAS: Record<string, string> = {
  'skin-fish': 'preset-fish',
  'skin-lion': 'preset-lion',
  'skin-motorbike': 'preset-motorbike',
  'skin-coin': 'preset-coin',
};

export function resolveLegacySkinId(skinId: string): string {
  return LEGACY_SKIN_ALIAS[skinId] ?? skinId;
}

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
export type ShopView = 'inventory' | 'presets' | 'editor' | 'cosmetics' | 'backgrounds';
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
