import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get today's date in UTC as YYYY-MM-DD */
function utcToday(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

/** Get the most recent Monday in UTC as YYYY-MM-DD */
function utcMonday(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? 6 : day - 1; // shift so Monday=0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

/** Pick N random items from an array (no duplicates) */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ---------------------------------------------------------------------------
// Challenge pool definitions
// ---------------------------------------------------------------------------

interface ChallengeTemplate {
  category: string;
  title: string;
  description: string;
  target: number;
  reward: number;
}

const DAILY_POOL: ChallengeTemplate[] = [
  // Kill targets
  { category: 'kill', title: 'Novice Hunter', description: 'Eliminate 3 rival snakes in the arena.', target: 3, reward: 20 },
  { category: 'kill', title: 'Snake Slayer', description: 'Eliminate 5 rival snakes in the arena.', target: 5, reward: 35 },
  { category: 'kill', title: 'Apex Predator', description: 'Eliminate 10 rival snakes in the arena.', target: 10, reward: 50 },
  // Extract targets
  { category: 'extract', title: 'Quick Cash Out', description: 'Extract with at least 50 chips in a single match.', target: 50, reward: 25 },
  { category: 'extract', title: 'High Roller Exit', description: 'Extract with at least 100 chips in a single match.', target: 100, reward: 40 },
  { category: 'extract', title: 'Mega Extraction', description: 'Extract with at least 200 chips in a single match.', target: 200, reward: 50 },
  // Star collect targets
  { category: 'star_collect', title: 'Star Gazer', description: 'Collect 5 star-chips dropped by fallen opponents.', target: 5, reward: 30 },
  { category: 'star_collect', title: 'Star Collector', description: 'Collect 10 star-chips dropped by fallen opponents.', target: 10, reward: 40 },
  { category: 'star_collect', title: 'Star Hoarder', description: 'Collect 20 star-chips dropped by fallen opponents.', target: 20, reward: 50 },
  // Score (body length) targets
  { category: 'score', title: 'Growing Serpent', description: 'Reach a body length of 50 in a single match.', target: 50, reward: 20 },
  { category: 'score', title: 'Long Snake', description: 'Reach a body length of 100 in a single match.', target: 100, reward: 30 },
  { category: 'score', title: 'Titan Length', description: 'Reach a body length of 150 in a single match.', target: 150, reward: 40 },
  // Arena entry
  { category: 'arena_entry', title: 'Arena Explorer', description: 'Enter any arena 1 time.', target: 1, reward: 30 },
  { category: 'arena_entry', title: 'Arena Regular', description: 'Enter any arena 2 times.', target: 2, reward: 35 },
  { category: 'arena_entry', title: 'Arena Addict', description: 'Enter any arena 3 times.', target: 3, reward: 40 },
];

const WEEKLY_POOL: ChallengeTemplate[] = [
  // Kill targets (harder)
  { category: 'kill', title: 'Weekly Butcher', description: 'Eliminate 15 rival snakes this week.', target: 15, reward: 100 },
  { category: 'kill', title: 'Weekly Annihilator', description: 'Eliminate 25 rival snakes this week.', target: 25, reward: 200 },
  // Extract targets (harder)
  { category: 'extract', title: 'Big Bank Weekly', description: 'Extract with at least 500 chips in a single match.', target: 500, reward: 150 },
  { category: 'extract', title: 'Mega Bank Weekly', description: 'Extract with at least 1 000 chips in a single match.', target: 1000, reward: 300 },
  // Star collect targets (harder)
  { category: 'star_collect', title: 'Star Magnate', description: 'Collect 50 star-chips this week.', target: 50, reward: 150 },
  { category: 'star_collect', title: 'Star Tycoon', description: 'Collect 100 star-chips this week.', target: 100, reward: 250 },
  // Score (body length) targets (harder)
  { category: 'score', title: 'Weekly Titan', description: 'Reach a body length of 200 in a single match.', target: 200, reward: 120 },
  { category: 'score', title: 'Weekly Colossus', description: 'Reach a body length of 300 in a single match.', target: 300, reward: 180 },
  // Arena entry (harder)
  { category: 'arena_entry', title: 'Arena Warrior', description: 'Enter any arena 5 times this week.', target: 5, reward: 100 },
  { category: 'arena_entry', title: 'Arena Veteran', description: 'Enter any arena 10 times this week.', target: 10, reward: 150 },
];

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

  // Check existing daily challenges for today
  const existingDaily = await db.challenge.findMany({
    where: { playerId, type: 'daily', periodStart: today },
  });

  // Check existing weekly challenges for this week
  const existingWeekly = await db.challenge.findMany({
    where: { playerId, type: 'weekly', periodStart: monday },
  });

  // Generate daily challenges if needed (pick 3 unique from pool)
  if (existingDaily.length === 0) {
    const templates = pickRandom(DAILY_POOL, 3);
    await db.challenge.createMany({
      data: templates.map((t) => ({
        playerId,
        type: 'daily',
        category: t.category,
        title: t.title,
        description: t.description,
        target: t.target,
        reward: t.reward,
        periodStart: today,
      })),
    });
  }

  // Generate weekly challenges if needed (pick 2 unique from pool)
  if (existingWeekly.length === 0) {
    const templates = pickRandom(WEEKLY_POOL, 2);
    await db.challenge.createMany({
      data: templates.map((t) => ({
        playerId,
        type: 'weekly',
        category: t.category,
        title: t.title,
        description: t.description,
        target: t.target,
        reward: t.reward,
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

  return NextResponse.json({ challenges });
}

// ---------------------------------------------------------------------------
// POST handler — claim a completed challenge
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

  // Credit reward chips and mark as claimed (atomic transaction)
  await db.$transaction([
    db.player.update({
      where: { id: playerId },
      data: {
        bankedChips: { increment: challenge.reward },
        totalEarned: { increment: challenge.reward },
      },
    }),
    db.challenge.update({
      where: { id: challengeId },
      data: { claimed: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    reward: challenge.reward,
    newBankedChips: undefined, // caller should refresh player data
  });
}
