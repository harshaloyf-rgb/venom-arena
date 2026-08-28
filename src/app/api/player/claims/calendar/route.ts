import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/player/claims/calendar
// Returns array of date strings (YYYY-MM-DD) the player claimed in the last 90 days
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const claims = await db.dailyClaim.findMany({
      where: {
        playerId: session.playerId,
        createdAt: { gte: ninetyDaysAgo },
      },
      select: { day: true },
    });

    const claimedDates = claims.map((c) => c.day);

    return NextResponse.json({ claimedDates });
  } catch (e) {
    console.error('[claims/calendar] GET error', e);
    return NextResponse.json({ error: 'Failed to load calendar data.' }, { status: 500 });
  }
}
