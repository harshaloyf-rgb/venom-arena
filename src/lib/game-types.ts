// ---- Venom Arena — Shared Game Types ----

export interface Point {
  x: number;
  y: number;
}

export interface Snake {
  id: string;
  name: string;
  userTag?: string;
  points: Point[];
  angle: number;
  targetAngle: number;
  size: number;
  color: string;
  isPlayer: boolean;
  isBot: boolean;
  isDead: boolean;
  score: number;
  kills: number;
  carriedChips: number;
  isBoosting: boolean;
  isExtracting: boolean;
  extractionProgress: number;
  spawnProtected: boolean;
  // Bot AI fields
  botTarget?: Point | null;
  botState?: 'wander' | 'chase' | 'flee' | 'harvest';
  deathTime?: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
  value: number;
  isStarChip: boolean;
  color: string;
  glowColor?: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameConfig {
  worldSize: number;
  foodCount: number;
  starChipCount: number;
  botCount: number;
  snakeSpeed: number;
  boostSpeed: number;
  turnSpeed: number;
  initialScore: number;
  segmentSpacing: number;
  collisionRadius: number;
  foodRadius: number;
  starRadius: number;
  extractionTime: number;
  spawnProtectionTime: number;
  deathFoodDropRate: number; // 0..1 fraction of score converted to food
  deathStarDropCount: number;
  botReactionTime: number;
}

// Server -> Client snapshot
export interface GameSnapshot {
  tick: number;
  snakes: Snake[];
  foods: Food[];
  worldSize: number;
  killFeed: KillFeedEntry[];
}

export interface KillFeedEntry {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  tick: number;
}

// Client -> Server input
export interface PlayerInput {
  targetAngle: number;
  boosting: boolean;
  extracting: boolean;
}

// Snake color palette
export const SNAKE_COLORS = [
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
];

export const BOT_NAMES = [
  'Viper', 'Cobra', 'Mamba', 'Asp', 'Python',
  'Rattler', 'Taipan', 'Krait', 'Adder', 'Boa',
  'Sidewinder', 'Copperhead', 'Kingsnake', 'Coral', 'Cottonmouth',
  'Diamondback', 'Bushmaster', 'Ferdelance', 'BlackMamba', 'Basilisk',
];
