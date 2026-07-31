import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { utcToday, utcMonday } from '@/lib/date-utils';

// This endpoint now requires INTERNAL_SECRET to prevent client-side exploitation.
// Challenge progress should only be reported by the game server via /api/match/result.
// Keeping the endpoint for backward compatibility but gating it with INTERNAL_SECRET.

// ---------------------------------------------------------------------------
// Valid challenge categories
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = ['kill', 'extract', 'extract_streak', 'star_collect', 'score', 'arena_entry', 'survive'] as const;
type ChallengeCategory = (typeof VALID_CATEGORIES)[number];

function isValidCategory(v: string): v is ChallengeCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(v);
}

// Max amount per request to prevent exploitation
const MAX_AMOUNT_PER_CATEGORY: Record<ChallengeCategory, number> = {
  kill: 10,
  extract: 1,
  extract_streak: 1,
  star_collect: 10,
  score: 1000,
  arena_entry: 1,
  survive: 1,
};

// POST /api/player/challenges/progress
// Called by the game canvas during gameplay to track real-time challenge progress.
// Uses session auth (user JWT).
//
// body: {
//   category: 'kill' | 'extract' | 'extract_streak' | 'star_collect' | 'score' | 'arena_entry' | 'survive',
//   amount?: number  (defaults to 1)
// }
export async function POST(req: NextRequest) {
  // Require INTERNAL_SECRET to prevent client-side exploitation
  const internalSecret = req.headers.get('x-internal-secret');
  const expected = process.env.INTERNAL_SECRET;
  if (!expected) throw new Error('INTERNAL_SECRET env var is required');
  if (internalSecret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Also require a valid session to identify the player
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const category = String(body.category || '').trim();

  if (!category || !isValidCategory(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 },
    );
  }

  const maxAmount = MAX_AMOUNT_PER_CATEGORY[category];
  const amount = Math.max(1, Math.min(maxAmount, Math.floor(Number(body.amount) || 1)));

  const playerId = session.playerId;
  const today = utcToday();
  const monday = utcMonday();

  // Find all active (incomplete) challenges matching the category
  const activeChallenges = await db.challenge.findMany({
    where: {
      playerId,
      category,
      completed: false,
      OR: [
        { type: 'daily', periodStart: today },
        { type: 'weekly', periodStart: monday },
      ],
    },
  });

  if (activeChallenges.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No active challenges for this category.' });
  }

  // Increment progress and auto-complete where applicable
  const updatedIds: string[] = [];
  const completedIds: string[] = [];

  await db.$transaction(
    activeChallenges.map((challenge) => {
      const newCurrent = challenge.current + amount;
      const shouldComplete = newCurrent >= challenge.target;

      if (shouldComplete) {
        completedIds.push(challenge.id);
      }
      updatedIds.push(challenge.id);

      return db.challenge.update({
        where: { id: challenge.id },
        data: {
          current: newCurrent,
          ...(shouldComplete ? { completed: true } : {}),
        },
      });
    }),
  );

  return NextResponse.json({
    updated: updatedIds.length,
    completed: completedIds.length,
    category,
  });
}
