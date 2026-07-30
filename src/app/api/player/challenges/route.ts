import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { utcLastMonday, utcToday, utcYesterday, utcMonday } from '@/lib/date-utils';



/** Pick N random items from an array (no duplicates) */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** Pick N random items ensuring no duplicate categories */
function pickDiverse<T extends { category: string }>(arr: T[], n: number): T[] {
  // Group by category
  const byCategory = new Map<string, T[]>();
  for (const item of arr) {
    const list = byCategory.get(item.category) || [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  // Shuffle categories
  const categories = [...byCategory.keys()].sort(() => Math.random() - 0.5);
  const picked: T[] = [];
  const usedCategories = new Set<string>();

  // First pass: pick one from each unique category
  for (const cat of categories) {
    if (picked.length >= n) break;
    const items = byCategory.get(cat)!;
    const item = items[Math.floor(Math.random() * items.length)];
    picked.push(item);
    usedCategories.add(cat);
  }

  // Second pass: fill remaining slots (still avoiding duplicates in the pick)
  if (picked.length < n) {
    const remaining = arr.filter(
      (item) => !picked.includes(item),
    );
    const extra = pickRandom(remaining, n - picked.length);
    picked.push(...extra);
  }

  return picked.slice(0, n);
}

/** Exclude templates that share a title with the exclude list */
function excludeByTitle<T extends { title: string }>(pool: T[], excludeTitles: Set<string>): T[] {
  return pool.filter((t) => !excludeTitles.has(t.title));
}

// ---------------------------------------------------------------------------
// Level tier helper
// ---------------------------------------------------------------------------

type LevelTier = 'novice' | 'operative' | 'veteran' | 'elite';

function getLevelTier(level: number): LevelTier {
  if (level <= 5) return 'novice';
  if (level <= 15) return 'operative';
  if (level <= 30) return 'veteran';
  return 'elite';
}

/** Level-based reward multiplier */
function levelRewardMultiplier(level: number): number {
  if (level <= 5) return 1.0;
  if (level <= 15) return 1.5;
  if (level <= 30) return 2.5;
  return 4.0;
}

// ---------------------------------------------------------------------------
// Challenge pool definitions — 4 tiers × 5 categories × multiple per category
// ---------------------------------------------------------------------------

interface ChallengeTemplate {
  category: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  tier: LevelTier;
}

// ── DAILY POOLS ──────────────────────────────────────────────────────────

const DAILY_NOVICE: ChallengeTemplate[] = [
  // Kill targets
  { category: 'kill', title: 'Novice Hunter', description: 'Eliminate 2 rival snakes in the arena.', target: 2, reward: 15, tier: 'novice' },
  { category: 'kill', title: 'First Blood', description: 'Eliminate 3 rival snakes in the arena.', target: 3, reward: 20, tier: 'novice' },
  { category: 'kill', title: 'Young Fang', description: 'Eliminate 5 rival snakes in the arena.', target: 5, reward: 30, tier: 'novice' },
  // Extract targets
  { category: 'extract', title: 'Safe Exit', description: 'Extract with at least 30 chips in a single match.', target: 30, reward: 20, tier: 'novice' },
  { category: 'extract', title: 'Pocket Cash', description: 'Extract with at least 50 chips in a single match.', target: 50, reward: 25, tier: 'novice' },
  { category: 'extract', title: 'Clean Getaway', description: 'Extract with at least 75 chips in a single match.', target: 75, reward: 35, tier: 'novice' },
  // Star collect targets
  { category: 'star_collect', title: 'Star Spark', description: 'Collect 3 star-chips dropped by fallen opponents.', target: 3, reward: 20, tier: 'novice' },
  { category: 'star_collect', title: 'Star Gazer', description: 'Collect 5 star-chips dropped by fallen opponents.', target: 5, reward: 30, tier: 'novice' },
  { category: 'star_collect', title: 'Star Dust', description: 'Collect 8 star-chips dropped by fallen opponents.', target: 8, reward: 35, tier: 'novice' },
  // Score (body length) targets
  { category: 'score', title: 'Tiny Rattler', description: 'Reach a body length of 30 in a single match.', target: 30, reward: 15, tier: 'novice' },
  { category: 'score', title: 'Growing Serpent', description: 'Reach a body length of 50 in a single match.', target: 50, reward: 25, tier: 'novice' },
  { category: 'score', title: 'Medium Coil', description: 'Reach a body length of 75 in a single match.', target: 75, reward: 35, tier: 'novice' },
  // Arena entry
  { category: 'arena_entry', title: 'Arena Explorer', description: 'Enter any arena 1 time.', target: 1, reward: 20, tier: 'novice' },
  { category: 'arena_entry', title: 'Warm Up', description: 'Enter any arena 2 times.', target: 2, reward: 30, tier: 'novice' },
  // Survival
  { category: 'survive', title: 'Snake Survival', description: 'Survive for 60 seconds in any arena.', target: 60, reward: 25, tier: 'novice' },
  { category: 'survive', title: 'Last Serpent', description: 'Survive for 90 seconds in any arena.', target: 90, reward: 35, tier: 'novice' },
];

const DAILY_OPERATIVE: ChallengeTemplate[] = [
  // Kill targets
  { category: 'kill', title: 'Snake Slayer', description: 'Eliminate 5 rival snakes in the arena.', target: 5, reward: 35, tier: 'operative' },
  { category: 'kill', title: 'Venom Strike', description: 'Eliminate 8 rival snakes in the arena.', target: 8, reward: 45, tier: 'operative' },
  { category: 'kill', title: 'Double Digit', description: 'Eliminate 10 rival snakes in the arena.', target: 10, reward: 55, tier: 'operative' },
  { category: 'kill', title: 'Aggressive Hunter', description: 'Eliminate 12 rival snakes in the arena.', target: 12, reward: 65, tier: 'operative' },
  // Extract targets
  { category: 'extract', title: 'Quick Cash Out', description: 'Extract with at least 100 chips in a single match.', target: 100, reward: 40, tier: 'operative' },
  { category: 'extract', title: 'High Roller Exit', description: 'Extract with at least 200 chips in a single match.', target: 200, reward: 55, tier: 'operative' },
  { category: 'extract', title: 'Solid Extraction', description: 'Extract with at least 300 chips in a single match.', target: 300, reward: 70, tier: 'operative' },
  // Star collect targets
  { category: 'star_collect', title: 'Star Collector', description: 'Collect 10 star-chips dropped by fallen opponents.', target: 10, reward: 40, tier: 'operative' },
  { category: 'star_collect', title: 'Star Hunter', description: 'Collect 15 star-chips dropped by fallen opponents.', target: 15, reward: 50, tier: 'operative' },
  { category: 'star_collect', title: 'Star Feast', description: 'Collect 20 star-chips dropped by fallen opponents.', target: 20, reward: 60, tier: 'operative' },
  // Score (body length) targets
  { category: 'score', title: 'Long Snake', description: 'Reach a body length of 100 in a single match.', target: 100, reward: 40, tier: 'operative' },
  { category: 'score', title: 'Impressive Coil', description: 'Reach a body length of 150 in a single match.', target: 150, reward: 55, tier: 'operative' },
  // Arena entry
  { category: 'arena_entry', title: 'Arena Regular', description: 'Enter any arena 2 times.', target: 2, reward: 35, tier: 'operative' },
  { category: 'arena_entry', title: 'Arena Addict', description: 'Enter any arena 3 times.', target: 3, reward: 45, tier: 'operative' },
  // Survival
  { category: 'survive', title: 'Iron scales', description: 'Survive for 90 seconds in any arena.', target: 90, reward: 45, tier: 'operative' },
  { category: 'survive', title: 'Endurance Run', description: 'Survive for 120 seconds in any arena.', target: 120, reward: 60, tier: 'operative' },
  // Streak
  { category: 'extract_streak', title: 'Clean Escape', description: 'Extract successfully 2 times today.', target: 2, reward: 60, tier: 'operative' },
  { category: 'extract_streak', title: 'Hat Trick', description: 'Extract successfully 3 times today.', target: 3, reward: 80, tier: 'operative' },
];

const DAILY_VETERAN: ChallengeTemplate[] = [
  // Kill targets
  { category: 'kill', title: 'Apex Predator', description: 'Eliminate 12 rival snakes in the arena.', target: 12, reward: 70, tier: 'veteran' },
  { category: 'kill', title: 'Arena Butcher', description: 'Eliminate 15 rival snakes in the arena.', target: 15, reward: 85, tier: 'veteran' },
  { category: 'kill', title: 'Venom Reaper', description: 'Eliminate 20 rival snakes in the arena.', target: 20, reward: 100, tier: 'veteran' },
  { category: 'kill', title: 'Death Incarnate', description: 'Eliminate 25 rival snakes in the arena.', target: 25, reward: 120, tier: 'veteran' },
  // Extract targets
  { category: 'extract', title: 'Mega Extraction', description: 'Extract with at least 500 chips in a single match.', target: 500, reward: 90, tier: 'veteran' },
  { category: 'extract', title: 'Grand Withdrawal', description: 'Extract with at least 750 chips in a single match.', target: 750, reward: 120, tier: 'veteran' },
  { category: 'extract', title: 'Fortune Escape', description: 'Extract with at least 1 000 chips in a single match.', target: 1000, reward: 150, tier: 'veteran' },
  // Star collect targets
  { category: 'star_collect', title: 'Star Hoarder', description: 'Collect 25 star-chips dropped by fallen opponents.', target: 25, reward: 70, tier: 'veteran' },
  { category: 'star_collect', title: 'Star Monopoly', description: 'Collect 35 star-chips dropped by fallen opponents.', target: 35, reward: 90, tier: 'veteran' },
  // Score (body length) targets
  { category: 'score', title: 'Titan Length', description: 'Reach a body length of 200 in a single match.', target: 200, reward: 75, tier: 'veteran' },
  { category: 'score', title: 'Behemoth Coil', description: 'Reach a body length of 300 in a single match.', target: 300, reward: 100, tier: 'veteran' },
  // Arena entry
  { category: 'arena_entry', title: 'Arena Grinder', description: 'Enter any arena 4 times.', target: 4, reward: 50, tier: 'veteran' },
  { category: 'arena_entry', title: 'Arena Machine', description: 'Enter any arena 5 times.', target: 5, reward: 60, tier: 'veteran' },
  // Survival
  { category: 'survive', title: 'Titan\'s Endurance', description: 'Survive for 150 seconds in any arena.', target: 150, reward: 80, tier: 'veteran' },
  { category: 'survive', title: 'Unbreakable Coil', description: 'Survive for 200 seconds in any arena.', target: 200, reward: 110, tier: 'veteran' },
  // Streak
  { category: 'extract_streak', title: 'Veteran Escape', description: 'Extract successfully 3 times today.', target: 3, reward: 100, tier: 'veteran' },
  { category: 'extract_streak', title: 'Untouchable', description: 'Extract successfully 4 times without a single death.', target: 4, reward: 140, tier: 'veteran' },
];

const DAILY_ELITE: ChallengeTemplate[] = [
  // Kill targets
  { category: 'kill', title: 'Massacre Protocol', description: 'Eliminate 20 rival snakes in the arena.', target: 20, reward: 100, tier: 'elite' },
  { category: 'kill', title: 'Genocide Mode', description: 'Eliminate 30 rival snakes in the arena.', target: 30, reward: 150, tier: 'elite' },
  { category: 'kill', title: 'Extinction Event', description: 'Eliminate 40 rival snakes in the arena.', target: 40, reward: 200, tier: 'elite' },
  { category: 'kill', title: 'God of Venom', description: 'Eliminate 50 rival snakes in the arena.', target: 50, reward: 250, tier: 'elite' },
  // Extract targets
  { category: 'extract', title: 'Elite Withdrawal', description: 'Extract with at least 2 000 chips in a single match.', target: 2000, reward: 150, tier: 'elite' },
  { category: 'extract', title: 'Phantom Bank', description: 'Extract with at least 5 000 chips in a single match.', target: 5000, reward: 250, tier: 'elite' },
  { category: 'extract', title: 'Legendary Haul', description: 'Extract with at least 10 000 chips in a single match.', target: 10000, reward: 400, tier: 'elite' },
  // Star collect targets
  { category: 'star_collect', title: 'Star Conqueror', description: 'Collect 40 star-chips dropped by fallen opponents.', target: 40, reward: 110, tier: 'elite' },
  { category: 'star_collect', title: 'Star Emperor', description: 'Collect 60 star-chips dropped by fallen opponents.', target: 60, reward: 150, tier: 'elite' },
  // Score (body length) targets
  { category: 'score', title: 'World Serpent', description: 'Reach a body length of 400 in a single match.', target: 400, reward: 140, tier: 'elite' },
  { category: 'score', title: 'Mythical Coil', description: 'Reach a body length of 500 in a single match.', target: 500, reward: 200, tier: 'elite' },
  // Arena entry
  { category: 'arena_entry', title: 'Arena Warlord', description: 'Enter any arena 6 times.', target: 6, reward: 70, tier: 'elite' },
  { category: 'arena_entry', title: 'Arena Zealot', description: 'Enter any arena 8 times.', target: 8, reward: 100, tier: 'elite' },
  // Survival
  { category: 'survive', title: 'Immortal Coil', description: 'Survive for 240 seconds in any arena.', target: 240, reward: 150, tier: 'elite' },
  { category: 'survive', title: 'Timeless Venom', description: 'Survive for 300 seconds in any arena.', target: 300, reward: 200, tier: 'elite' },
  // Streak
  { category: 'extract_streak', title: 'Elite Phantom', description: 'Extract successfully 5 times today.', target: 5, reward: 200, tier: 'elite' },
  { category: 'extract_streak', title: 'Untouchable Legend', description: 'Extract successfully 6 times without a single death.', target: 6, reward: 300, tier: 'elite' },
];

/** Map tier → daily pool */
const DAILY_POOLS: Record<LevelTier, ChallengeTemplate[]> = {
  novice: DAILY_NOVICE,
  operative: DAILY_OPERATIVE,
  veteran: DAILY_VETERAN,
  elite: DAILY_ELITE,
};

// ── WEEKLY POOLS ──────────────────────────────────────────────────────────

const WEEKLY_NOVICE: ChallengeTemplate[] = [
  { category: 'kill', title: 'Weekly Scrapper', description: 'Eliminate 8 rival snakes this week.', target: 8, reward: 60, tier: 'novice' },
  { category: 'kill', title: 'Weekly Apprentice', description: 'Eliminate 12 rival snakes this week.', target: 12, reward: 80, tier: 'novice' },
  { category: 'extract', title: 'Weekly Starter', description: 'Extract with at least 150 chips in a single match.', target: 150, reward: 70, tier: 'novice' },
  { category: 'extract', title: 'Weekly Earner', description: 'Extract with at least 250 chips in a single match.', target: 250, reward: 100, tier: 'novice' },
  { category: 'star_collect', title: 'Weekly Sparkle', description: 'Collect 20 star-chips this week.', target: 20, reward: 65, tier: 'novice' },
  { category: 'star_collect', title: 'Weekly Gatherer', description: 'Collect 30 star-chips this week.', target: 30, reward: 85, tier: 'novice' },
  { category: 'score', title: 'Weekly Hatchling', description: 'Reach a body length of 100 in a single match.', target: 100, reward: 60, tier: 'novice' },
  { category: 'arena_entry', title: 'Weekly Scout', description: 'Enter any arena 4 times this week.', target: 4, reward: 55, tier: 'novice' },
  { category: 'survive', title: 'Weekly Survivor', description: 'Survive for 120 seconds total this week.', target: 120, reward: 70, tier: 'novice' },
  { category: 'extract_streak', title: 'Weekly Outrun', description: 'Extract successfully 3 times this week.', target: 3, reward: 75, tier: 'novice' },
];

const WEEKLY_OPERATIVE: ChallengeTemplate[] = [
  { category: 'kill', title: 'Weekly Butcher', description: 'Eliminate 20 rival snakes this week.', target: 20, reward: 120, tier: 'operative' },
  { category: 'kill', title: 'Weekly Annihilator', description: 'Eliminate 30 rival snakes this week.', target: 30, reward: 160, tier: 'operative' },
  { category: 'extract', title: 'Big Bank Weekly', description: 'Extract with at least 500 chips in a single match.', target: 500, reward: 140, tier: 'operative' },
  { category: 'extract', title: 'Mega Bank Weekly', description: 'Extract with at least 750 chips in a single match.', target: 750, reward: 180, tier: 'operative' },
  { category: 'star_collect', title: 'Star Magnate', description: 'Collect 50 star-chips this week.', target: 50, reward: 130, tier: 'operative' },
  { category: 'star_collect', title: 'Star Tycoon', description: 'Collect 75 star-chips this week.', target: 75, reward: 170, tier: 'operative' },
  { category: 'score', title: 'Weekly Titan', description: 'Reach a body length of 200 in a single match.', target: 200, reward: 120, tier: 'operative' },
  { category: 'arena_entry', title: 'Arena Warrior', description: 'Enter any arena 6 times this week.', target: 6, reward: 100, tier: 'operative' },
  { category: 'survive', title: 'Weekly Fortress', description: 'Survive for 180 seconds total this week.', target: 180, reward: 130, tier: 'operative' },
  { category: 'extract_streak', title: 'Weekly Phantom', description: 'Extract successfully 5 times this week.', target: 5, reward: 150, tier: 'operative' },
];

const WEEKLY_VETERAN: ChallengeTemplate[] = [
  { category: 'kill', title: 'Weekly Executioner', description: 'Eliminate 40 rival snakes this week.', target: 40, reward: 220, tier: 'veteran' },
  { category: 'kill', title: 'Weekly Warlord', description: 'Eliminate 60 rival snakes this week.', target: 60, reward: 300, tier: 'veteran' },
  { category: 'extract', title: 'Veteran Fortune', description: 'Extract with at least 1 500 chips in a single match.', target: 1500, reward: 250, tier: 'veteran' },
  { category: 'extract', title: 'Veteran Jackpot', description: 'Extract with at least 3 000 chips in a single match.', target: 3000, reward: 350, tier: 'veteran' },
  { category: 'star_collect', title: 'Star Baron', description: 'Collect 100 star-chips this week.', target: 100, reward: 240, tier: 'veteran' },
  { category: 'star_collect', title: 'Star Overlord', description: 'Collect 150 star-chips this week.', target: 150, reward: 300, tier: 'veteran' },
  { category: 'score', title: 'Weekly Behemoth', description: 'Reach a body length of 350 in a single match.', target: 350, reward: 220, tier: 'veteran' },
  { category: 'arena_entry', title: 'Arena Veteran', description: 'Enter any arena 10 times this week.', target: 10, reward: 180, tier: 'veteran' },
  { category: 'survive', title: 'Weekly Colossus', description: 'Survive for 300 seconds total this week.', target: 300, reward: 250, tier: 'veteran' },
  { category: 'extract_streak', title: 'Weekly Specter', description: 'Extract successfully 8 times this week.', target: 8, reward: 280, tier: 'veteran' },
];

const WEEKLY_ELITE: ChallengeTemplate[] = [
  { category: 'kill', title: 'Weekly Extinction', description: 'Eliminate 80 rival snakes this week.', target: 80, reward: 400, tier: 'elite' },
  { category: 'kill', title: 'Weekly Apocalypse', description: 'Eliminate 120 rival snakes this week.', target: 120, reward: 550, tier: 'elite' },
  { category: 'extract', title: 'Elite Fortune', description: 'Extract with at least 5 000 chips in a single match.', target: 5000, reward: 400, tier: 'elite' },
  { category: 'extract', title: 'Elite Jackpot', description: 'Extract with at least 10 000 chips in a single match.', target: 10000, reward: 600, tier: 'elite' },
  { category: 'star_collect', title: 'Star Emperor Weekly', description: 'Collect 200 star-chips this week.', target: 200, reward: 400, tier: 'elite' },
  { category: 'star_collect', title: 'Star God Weekly', description: 'Collect 300 star-chips this week.', target: 300, reward: 550, tier: 'elite' },
  { category: 'score', title: 'Weekly Mythic', description: 'Reach a body length of 600 in a single match.', target: 600, reward: 380, tier: 'elite' },
  { category: 'arena_entry', title: 'Arena Zealot Weekly', description: 'Enter any arena 15 times this week.', target: 15, reward: 300, tier: 'elite' },
  { category: 'survive', title: 'Weekly Immortal', description: 'Survive for 600 seconds total this week.', target: 600, reward: 450, tier: 'elite' },
  { category: 'extract_streak', title: 'Weekly Ghost King', description: 'Extract successfully 12 times this week.', target: 12, reward: 500, tier: 'elite' },
];

/** Map tier → weekly pool */
const WEEKLY_POOLS: Record<LevelTier, ChallengeTemplate[]> = {
  novice: WEEKLY_NOVICE,
  operative: WEEKLY_OPERATIVE,
  veteran: WEEKLY_VETERAN,
  elite: WEEKLY_ELITE,
};

// ---------------------------------------------------------------------------
// Streak bonus calculation
// ---------------------------------------------------------------------------

/** Count consecutive days where ALL daily challenges were claimed */
async function calculateStreak(playerId: string): Promise<{ streak: number; multiplier: number }> {
  const today = utcToday();

  // Compute the date 30 days ago as YYYY-MM-DD
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 29);
  const thirtyDaysAgo = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  // Fetch ALL daily challenges for the last 30 days in a single query
  const recentChallenges = await db.challenge.findMany({
    where: {
      playerId,
      type: 'daily',
      periodStart: { gte: thirtyDaysAgo },
    },
    select: { periodStart: true, claimed: true },
  });

  // Group by date
  const byDate = new Map<string, boolean[]>();
  for (const c of recentChallenges) {
    const list = byDate.get(c.periodStart) ?? [];
    list.push(c.claimed);
    byDate.set(c.periodStart, list);
  }

  // Walk backwards from today checking consecutive claimed days
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today + 'T00:00:00Z');
    checkDate.setUTCDate(checkDate.getUTCDate() - i);
    const key = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, '0')}-${String(checkDate.getUTCDate()).padStart(2, '0')}`;

    const dayClaims = byDate.get(key);
    if (!dayClaims || dayClaims.length === 0) {
      // No challenges for this day
      if (i === 0) continue; // today may not have challenges yet
      break; // gap found — streak ends
    }

    const allClaimed = dayClaims.every(Boolean);
    if (allClaimed) {
      streak++;
    } else if (i === 0) {
      // Today's challenges exist but not all claimed — don't break, just don't count today
      continue;
    } else {
      break; // unclaimed challenges on a past day — streak broken
    }
  }

  // Calculate multiplier
  let multiplier = 1.0;
  if (streak >= 14) multiplier = 3.0;
  else if (streak >= 7) multiplier = 2.0;
  else if (streak >= 3) multiplier = 1.5;

  return { streak, multiplier };
}

// ---------------------------------------------------------------------------
// GET handler — fetch (and auto-generate) challenges
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const playerId = session.playerId;
  const today = utcToday();
  const monday = utcMonday();

  // Get player level for tier-based pool selection
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  }

  const tier = getLevelTier(player.level);
  const rewardMult = levelRewardMultiplier(player.level);

  // ── Anti-repeat: fetch yesterday's dailies and last week's weeklies ──
  const yesterday = utcYesterday();
  const lastMonday = utcLastMonday();

  const [yesterdayDailies, lastWeekWeeklies] = await Promise.all([
    db.challenge.findMany({
      where: { playerId, type: 'daily', periodStart: yesterday },
      select: { title: true },
    }),
    db.challenge.findMany({
      where: { playerId, type: 'weekly', periodStart: lastMonday },
      select: { title: true },
    }),
  ]);

  const excludeDailyTitles = new Set(yesterdayDailies.map((c) => c.title));
  const excludeWeeklyTitles = new Set(lastWeekWeeklies.map((c) => c.title));

  // Check existing daily challenges for today
  const existingDaily = await db.challenge.findMany({
    where: { playerId, type: 'daily', periodStart: today },
  });

  // Check existing weekly challenges for this week
  const existingWeekly = await db.challenge.findMany({
    where: { playerId, type: 'weekly', periodStart: monday },
  });

  // ── Generate daily challenges if needed ──
  if (existingDaily.length === 0) {
    let pool = DAILY_POOLS[tier];
    // Exclude yesterday's titles (anti-repeat)
    pool = excludeByTitle(pool, excludeDailyTitles);
    // Fallback: if pool is too small after exclusions, use full pool
    if (pool.length < 3) pool = DAILY_POOLS[tier];
    // Pick 3 diverse challenges (different categories guaranteed)
    const templates = pickDiverse(pool, 3);

    await db.challenge.createMany({
      data: templates.map((t) => ({
        playerId,
        type: 'daily',
        category: t.category,
        title: t.title,
        description: t.description,
        target: t.target,
        reward: Math.floor(t.reward * rewardMult),
        periodStart: today,
      })),
    });
  }

  // ── Generate weekly challenges if needed ──
  if (existingWeekly.length === 0) {
    let pool = WEEKLY_POOLS[tier];
    // Exclude last week's titles (anti-repeat)
    pool = excludeByTitle(pool, excludeWeeklyTitles);
    // Fallback: if pool is too small after exclusions, use full pool
    if (pool.length < 2) pool = WEEKLY_POOLS[tier];
    // Pick 2 diverse challenges (different categories guaranteed)
    const templates = pickDiverse(pool, 2);

    await db.challenge.createMany({
      data: templates.map((t) => ({
        playerId,
        type: 'weekly',
        category: t.category,
        title: t.title,
        description: t.description,
        target: t.target,
        reward: Math.floor(t.reward * rewardMult),
        periodStart: monday,
      })),
    });
  }

  // Fetch all active challenges (today's daily + this week's weekly)
  const challenges = await db.challenge.findMany({
    where: {
      playerId,
      OR: [
        { type: 'daily', periodStart: today },
        { type: 'weekly', periodStart: monday },
      ],
    },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  });

  // Calculate streak info
  const streakInfo = await calculateStreak(playerId);

  return NextResponse.json({
    challenges,
    streak: streakInfo.streak,
    streakMultiplier: streakInfo.multiplier,
    tier,
  });
}

// ---------------------------------------------------------------------------
// POST handler — claim a completed challenge (with streak bonus)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const challengeId = String(body.challengeId || '').trim();

  if (!challengeId) {
    return NextResponse.json({ error: 'Missing challengeId.' }, { status: 400 });
  }

  const playerId = session.playerId;

  // Find the challenge and verify ownership
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge || challenge.playerId !== playerId) {
    return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });
  }

  if (!challenge.completed) {
    return NextResponse.json({ error: 'Challenge not yet completed.' }, { status: 400 });
  }

  if (challenge.claimed) {
    return NextResponse.json({ error: 'Already claimed.' }, { status: 400 });
  }

  // Calculate streak bonus
  const { multiplier } = await calculateStreak(playerId);
  const baseReward = challenge.reward;
  const bonusReward = Math.floor(baseReward * (multiplier - 1)); // bonus = base × (mult - 1)
  const totalReward = baseReward + bonusReward;

  // Credit reward chips and mark as claimed (atomic transaction)
  await db.$transaction([
    db.player.update({
      where: { id: playerId },
      data: {
        bankedChips: { increment: totalReward },
        totalEarned: { increment: totalReward },
      },
    }),
    db.challenge.update({
      where: { id: challengeId },
      data: { claimed: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    reward: totalReward,
    baseReward,
    bonusReward,
    streakMultiplier: multiplier,
  });
}
