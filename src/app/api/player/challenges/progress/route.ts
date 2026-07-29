import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function utcToday(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function utcMonday(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? 6 : day - 1; // shift so Monday=0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Valid challenge categories
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = ['kill', 'extract', 'star_collect', 'score', 'arena_entry'] as const;
type ChallengeCategory = (typeof VALID_CATEGORIES)[number];

function isValidCategory(v: string): v is ChallengeCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(v);
}

// POST /api/player/challenges/progress
// Called by the game canvas during gameplay to track real-time challenge progress.
// Uses session auth (user JWT).
//
// body: {
//   category: 'kill' | 'extract' | 'star_collect' | 'score' | 'arena_entry',
//   amount?: number  (defaults to 1)
// }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const category = String(body.category || '').trim();
  const amount = Math.max(1, Math.floor(Number(body.amount) || 1));

  if (!category || !isValidCategory(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 },
    );
  }

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
