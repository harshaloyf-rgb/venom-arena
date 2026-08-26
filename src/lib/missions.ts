/**
 * Venom Arena — Mission Pool & Rotation System.
 *
 * Defines ALL possible missions across daily and weekly pools.
 * Rotation picks N missions per period using a deterministic date hash.
 */

// ── Mission definition (pool template) ──

export interface MissionTemplate {
  id: string;           // unique within its pool (e.g. "d-first-blood")
  title: string;
  description: string;
  reward: number;       // chips
  target: number;       // required count to complete
  category: 'daily' | 'weekly';
  difficulty: 'easy' | 'medium' | 'hard';
  tracker: MissionTracker; // which stat to track from match result
}

export type MissionTracker =
  | 'kills'         // total kills in period
  | 'extractions'   // total successful extractions in period
  | 'score_ge'      // single-match score >= target
  | 'banked_ge'     // single-match banked chips >= target (extract only)
  | 'chips_banked'; // total chips banked in period (sum of all extracts)

// ── DAILY POOL (6 missions — pick 3 each day) ──

const DAILY_POOL: MissionTemplate[] = [
  {
    id: 'd-first-blood',
    title: 'First Blood',
    description: 'Eliminate at least 1 rival snake in any arena match.',
    reward: 20,
    target: 1,
    category: 'daily',
    difficulty: 'easy',
    tracker: 'kills',
  },
  {
    id: 'd-clean-extract',
    title: 'Clean Extraction',
    description: 'Successfully extract from any online or practice arena.',
    reward: 30,
    target: 1,
    category: 'daily',
    difficulty: 'medium',
    tracker: 'extractions',
  },
  {
    id: 'd-century-snake',
    title: 'Century Snake',
    description: 'Reach a body score of 100 or higher in a single match.',
    reward: 50,
    target: 100,
    category: 'daily',
    difficulty: 'hard',
    tracker: 'score_ge',
  },
  {
    id: 'd-hunter',
    title: 'Arena Hunter',
    description: 'Eliminate 3 or more rival snakes across your matches today.',
    reward: 35,
    target: 3,
    category: 'daily',
    difficulty: 'medium',
    tracker: 'kills',
  },
  {
    id: 'd-safe-exit',
    title: 'Safe Exit',
    description: 'Extract with at least 50 chips banked from a single arena.',
    reward: 25,
    target: 50,
    category: 'daily',
    difficulty: 'easy',
    tracker: 'banked_ge',
  },
  {
    id: 'd-chip-run',
    title: 'Chip Runner',
    description: 'Bank a combined total of 200 or more chips across all extractions today.',
    reward: 45,
    target: 200,
    category: 'daily',
    difficulty: 'hard',
    tracker: 'chips_banked',
  },
];

// ── WEEKLY POOL (5 missions — pick 2 each week) ──

const WEEKLY_POOL: MissionTemplate[] = [
  {
    id: 'w-double-extract',
    title: 'Double Extraction',
    description: 'Successfully extract from arenas 2 times this week.',
    reward: 40,
    target: 2,
    category: 'weekly',
    difficulty: 'medium',
    tracker: 'extractions',
  },
  {
    id: 'w-high-stakes',
    title: 'High Stakes Winner',
    description: 'Extract with 150 or more chips banked in a single match.',
    reward: 75,
    target: 150,
    category: 'weekly',
    difficulty: 'hard',
    tracker: 'banked_ge',
  },
  {
    id: 'w-serial-killer',
    title: 'Serial Eliminator',
    description: 'Accumulate 10 kills across all matches this week.',
    reward: 60,
    target: 10,
    category: 'weekly',
    difficulty: 'hard',
    tracker: 'kills',
  },
  {
    id: 'w-wealth-builder',
    title: 'Wealth Builder',
    description: 'Bank a combined total of 500 or more chips across all extractions this week.',
    reward: 50,
    target: 500,
    category: 'weekly',
    difficulty: 'medium',
    tracker: 'chips_banked',
  },
  {
    id: 'w-persistent',
    title: 'Persistent Operator',
    description: 'Successfully extract from arenas 5 times this week.',
    reward: 55,
    target: 5,
    category: 'weekly',
    difficulty: 'medium',
    tracker: 'extractions',
  },
];

// ── Rotation helpers ──

const DAILY_COUNT = 3;   // how many daily missions to pick each day
const WEEKLY_COUNT = 2;  // how many weekly missions to pick each week

/**
 * Simple deterministic hash from a string → number in [0, 1).
 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

/**
 * Pick N items from a pool using a deterministic date-based hash.
 * Shuffles via Fisher-Yates with date-seeded randomness so the same
 * date always yields the same selection.
 */
function pickFromPool(pool: MissionTemplate[], count: number, seed: string): MissionTemplate[] {
  const shuffled = [...pool];
  // Seeded Fisher-Yates
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(hashStr(`${seed}-${i}`) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// ── Public API ──

/**
 * Get today's daily mission IDs in slot order (daily-1, daily-2, daily-3).
 */
export function getTodaysDailyMissions(dateStr?: string): MissionTemplate[] {
  const today = dateStr || new Date().toISOString().slice(0, 10);
  const picked = pickFromPool(DAILY_POOL, DAILY_COUNT, `daily-${today}`);
  // Re-id to slot names so client can reference daily-1, daily-2, etc.
  return picked.map((m, i) => ({ ...m, id: `daily-${i + 1}` }));
}

/**
 * Get this week's weekly mission IDs in slot order (weekly-1, weekly-2).
 */
export function getThisWeeksWeeklyMissions(weekStr?: string): MissionTemplate[] {
  const week = weekStr || getISOWeek(new Date());
  const picked = pickFromPool(WEEKLY_POOL, WEEKLY_COUNT, `weekly-${week}`);
  return picked.map((m, i) => ({ ...m, id: `weekly-${i + 1}` }));
}

/** ISO week string like "2026-W03" */
export function getISOWeek(d: Date): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = (date.getDay() + 6) % 7; // Mon=0
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
  );
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Allowed rewards whitelist (for server-side claim validation).
 */
export function getAllowedRewards(
  dailyDateStr?: string,
  weeklyWeekStr?: string,
): Record<string, number> {
  const rewards: Record<string, number> = {};
  for (const m of getTodaysDailyMissions(dailyDateStr)) {
    rewards[m.id] = m.reward;
  }
  for (const m of getThisWeeksWeeklyMissions(weeklyWeekStr)) {
    rewards[m.id] = m.reward;
  }
  return rewards;
}

/** Get the tracker type for a given mission ID (for match-result tracking) */
export function getTrackerForMission(
  missionId: string,
  dailyDateStr?: string,
  weeklyWeekStr?: string,
): MissionTracker | null {
  const dailyDate = dailyDateStr || new Date().toISOString().slice(0, 10);
  const weeklyWeek = weeklyWeekStr || getISOWeek(new Date());

  for (const m of getTodaysDailyMissions(dailyDate)) {
    if (m.id === missionId) return m.tracker;
  }
  for (const m of getThisWeeksWeeklyMissions(weeklyWeek)) {
    if (m.id === missionId) return m.tracker;
  }
  return null;
}
