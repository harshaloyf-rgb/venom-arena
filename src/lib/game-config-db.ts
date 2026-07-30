import { db } from '@/lib/db'

interface GameConfigEntry {
  key: string
  value: string   // JSON-encoded
  label: string
  category: string
  order: number
  type: string
}

/** Ordered list of every default game-config entry, grouped by category. */
export const DEFAULT_GAME_CONFIG: GameConfigEntry[] = [
  // ── snake_physics ──────────────────────────────────────────────
  {
    key: 'snake.collisionRadius',
    value: JSON.stringify(6),
    label: 'Collision radius (px)',
    category: 'snake_physics',
    order: 0,
    type: 'number',
  },
  {
    key: 'snake.visualRadius',
    value: JSON.stringify(8),
    label: 'Visual radius (px)',
    category: 'snake_physics',
    order: 1,
    type: 'number',
  },
  {
    key: 'snake.segmentSpacing',
    value: JSON.stringify(16),
    label: 'Segment spacing (px)',
    category: 'snake_physics',
    order: 2,
    type: 'number',
  },
  {
    key: 'snake.baseSpeed',
    value: JSON.stringify(4.5),
    label: 'Base move speed',
    category: 'snake_physics',
    order: 3,
    type: 'number',
  },
  {
    key: 'snake.boostSpeed',
    value: JSON.stringify(8.0),
    label: 'Boost speed',
    category: 'snake_physics',
    order: 4,
    type: 'number',
  },
  {
    key: 'snake.turnBase',
    value: JSON.stringify(0.35),
    label: 'Base turn rate (rad/tick)',
    category: 'snake_physics',
    order: 5,
    type: 'number',
  },
  {
    key: 'snake.turnMin',
    value: JSON.stringify(0.08),
    label: 'Min turn rate (rad/tick)',
    category: 'snake_physics',
    order: 6,
    type: 'number',
  },
  {
    key: 'snake.turnScoreFactor',
    value: JSON.stringify(0.0003),
    label: 'Turn rate score penalty',
    category: 'snake_physics',
    order: 7,
    type: 'number',
  },
  {
    key: 'snake.initialBodyLength',
    value: JSON.stringify(20),
    label: 'Initial body segments at spawn',
    category: 'snake_physics',
    order: 8,
    type: 'number',
  },
  {
    key: 'snake.initialSpawnScore',
    value: JSON.stringify(20),
    label: 'Starting score',
    category: 'snake_physics',
    order: 9,
    type: 'number',
  },

  // ── snake_growth ───────────────────────────────────────────────
  {
    key: 'growth.maxSegments',
    value: JSON.stringify(200),
    label: 'Max body segments (hard cap)',
    category: 'snake_growth',
    order: 0,
    type: 'number',
  },
  {
    key: 'growth.lengthLogFactor',
    value: JSON.stringify(20),
    label: 'Length growth: log factor',
    category: 'snake_growth',
    order: 1,
    type: 'number',
  },
  {
    key: 'growth.maxExtraRadius',
    value: JSON.stringify(3),
    label: 'Max extra thickness (px) beyond base',
    category: 'snake_growth',
    order: 2,
    type: 'number',
  },
  {
    key: 'growth.thicknessLogFactor',
    value: JSON.stringify(0.5),
    label: 'Thickness growth: log factor',
    category: 'snake_growth',
    order: 3,
    type: 'number',
  },

  // ── boost_system ───────────────────────────────────────────────
  {
    key: 'boost.minLength',
    value: JSON.stringify(8),
    label: 'Min segments to boost',
    category: 'boost_system',
    order: 0,
    type: 'number',
  },
  {
    key: 'boost.dropInterval',
    value: JSON.stringify(10),
    label: 'Frames between tail drops during boost',
    category: 'boost_system',
    order: 1,
    type: 'number',
  },

  // ── collision ──────────────────────────────────────────────────
  {
    key: 'collision.hitFactor',
    value: JSON.stringify(0.75),
    label: 'Body collision hit factor',
    category: 'collision',
    order: 0,
    type: 'number',
  },
  {
    key: 'collision.headOnHitFactor',
    value: JSON.stringify(0.8),
    label: 'Head-on collision hit factor',
    category: 'collision',
    order: 1,
    type: 'number',
  },
  {
    key: 'collision.neckAngleThreshold',
    value: JSON.stringify(60),
    label: 'Neck protection angle threshold (degrees)',
    category: 'collision',
    order: 2,
    type: 'number',
  },
  {
    key: 'collision.neckSegmentCount',
    value: JSON.stringify(5),
    label: 'Neck protection segment count',
    category: 'collision',
    order: 3,
    type: 'number',
  },

  // ── food_system ────────────────────────────────────────────────
  {
    key: 'food.smallValue',
    value: JSON.stringify(1),
    label: 'Small food value',
    category: 'food_system',
    order: 0,
    type: 'number',
  },
  {
    key: 'food.smallRadius',
    value: JSON.stringify(3),
    label: 'Small food radius',
    category: 'food_system',
    order: 1,
    type: 'number',
  },
  {
    key: 'food.smallWeight',
    value: JSON.stringify(0.93),
    label: 'Small food spawn weight',
    category: 'food_system',
    order: 2,
    type: 'number',
  },
  {
    key: 'food.mediumValue',
    value: JSON.stringify(3),
    label: 'Medium food value',
    category: 'food_system',
    order: 3,
    type: 'number',
  },
  {
    key: 'food.mediumRadius',
    value: JSON.stringify(5),
    label: 'Medium food radius',
    category: 'food_system',
    order: 4,
    type: 'number',
  },
  {
    key: 'food.mediumWeight',
    value: JSON.stringify(0.04),
    label: 'Medium food spawn weight',
    category: 'food_system',
    order: 5,
    type: 'number',
  },
  {
    key: 'food.largeValue',
    value: JSON.stringify(5),
    label: 'Large food value',
    category: 'food_system',
    order: 6,
    type: 'number',
  },
  {
    key: 'food.largeRadius',
    value: JSON.stringify(8),
    label: 'Large food radius',
    category: 'food_system',
    order: 7,
    type: 'number',
  },
  {
    key: 'food.largeWeight',
    value: JSON.stringify(0.03),
    label: 'Large food spawn weight',
    category: 'food_system',
    order: 8,
    type: 'number',
  },
  {
    key: 'food.countTarget',
    value: JSON.stringify(1200),
    label: 'Target food count per arena',
    category: 'food_system',
    order: 9,
    type: 'number',
  },
  {
    key: 'food.starDropCount',
    value: JSON.stringify(10),
    label: 'Star chips dropped on player death',
    category: 'food_system',
    order: 10,
    type: 'number',
  },

  // ── extraction ─────────────────────────────────────────────────
  {
    key: 'extraction.durationMs',
    value: JSON.stringify(3000),
    label: 'Extraction duration (ms)',
    category: 'extraction',
    order: 0,
    type: 'number',
  },
  {
    key: 'extraction.glideSpeed',
    value: JSON.stringify(3.2),
    label: 'Speed while extracting',
    category: 'extraction',
    order: 1,
    type: 'number',
  },

  // ── spawning ───────────────────────────────────────────────────
  {
    key: 'spawning.safeDistance',
    value: JSON.stringify(500),
    label: 'Min distance from other snakes',
    category: 'spawning',
    order: 0,
    type: 'number',
  },
  {
    key: 'spawning.safeBoundaryMargin',
    value: JSON.stringify(500),
    label: 'Min distance inside boundary',
    category: 'spawning',
    order: 1,
    type: 'number',
  },
  {
    key: 'spawning.safeAttempts',
    value: JSON.stringify(30),
    label: 'Max spawn attempts',
    category: 'spawning',
    order: 2,
    type: 'number',
  },
  {
    key: 'spawning.protectionMs',
    value: JSON.stringify(4000),
    label: 'Spawn protection duration (ms)',
    category: 'spawning',
    order: 3,
    type: 'number',
  },

  // ── map_settings ───────────────────────────────────────────────
  {
    key: 'map.minRadius',
    value: JSON.stringify(3000),
    label: 'Min map radius (1 player)',
    category: 'map_settings',
    order: 0,
    type: 'number',
  },
  {
    key: 'map.maxRadius',
    value: JSON.stringify(16000),
    label: 'Max map radius (1000 players)',
    category: 'map_settings',
    order: 1,
    type: 'number',
  },
  {
    key: 'map.breathAmplitude',
    value: JSON.stringify(40),
    label: 'Breathing amplitude (px)',
    category: 'map_settings',
    order: 2,
    type: 'number',
  },
  {
    key: 'map.breathCycleMs',
    value: JSON.stringify(10000),
    label: 'Breathing cycle duration (ms)',
    category: 'map_settings',
    order: 3,
    type: 'number',
  },

  // ── bot_settings ───────────────────────────────────────────────
  {
    key: 'bot.selfDestructThreshold',
    value: JSON.stringify(100),
    label: 'Bot self-destruct score (online)',
    category: 'bot_settings',
    order: 0,
    type: 'number',
  },
  {
    key: 'bot.evadeRadius',
    value: JSON.stringify(300),
    label: 'Bot evade radius',
    category: 'bot_settings',
    order: 1,
    type: 'number',
  },
  {
    key: 'bot.foodScanRadius',
    value: JSON.stringify(300),
    label: 'Bot food scan radius',
    category: 'bot_settings',
    order: 2,
    type: 'number',
  },

  // ── economy ────────────────────────────────────────────────────
  {
    key: 'economy.commissionThreshold',
    value: JSON.stringify(4),
    label: 'Min real players for commission',
    category: 'economy',
    order: 0,
    type: 'number',
  },
  {
    key: 'economy.commissionRate',
    value: JSON.stringify(0.35),
    label: 'Commission rate (0-1)',
    category: 'economy',
    order: 1,
    type: 'number',
  },
  {
    key: 'economy.guestStarterChips',
    value: JSON.stringify(150),
    label: 'Guest starter chips',
    category: 'economy',
    order: 2,
    type: 'number',
  },
]

/**
 * Upsert every default config entry into the GameConfig table.
 * Safe to call repeatedly — existing rows are left untouched.
 */
export async function seedGameConfig() {
  for (const entry of DEFAULT_GAME_CONFIG) {
    await db.gameConfig.upsert({
      where: { key: entry.key },
      update: {},
      create: {
        key: entry.key,
        value: entry.value,
        label: entry.label,
        category: entry.category,
        order: entry.order,
        type: entry.type,
      },
    })
  }
}

/**
 * Load ALL configs from DB and return as a flat Record<string, any>.
 * Each stored JSON string is parsed back to its native type.
 */
export async function getGameConfig(): Promise<Record<string, any>> {
  const rows = await db.gameConfig.findMany({ orderBy: { order: 'asc' } })
  const result: Record<string, any> = {}
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value)
    } catch {
      result[row.key] = row.value
    }
  }
  return result
}

/**
 * Get a single config value by key. Returns `undefined` if the key
 * does not exist in the database.
 */
export async function getGameConfigValue(key: string): Promise<any> {
  const row = await db.gameConfig.findUnique({ where: { key } })
  if (!row) return undefined
  try {
    return JSON.parse(row.value)
  } catch {
    return row.value
  }
}
