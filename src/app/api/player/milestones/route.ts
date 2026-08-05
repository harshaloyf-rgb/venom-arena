import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/player/milestones
 * Returns the authenticated player's chip-tier milestones.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const milestones = await db.playerMilestone.findMany({
      where: { playerId: session.playerId },
      orderBy: { chipsAtMilestone: 'desc' },
    });

    return NextResponse.json({ milestones });
  } catch (e) {
    console.error('[player/milestones] error', e);
    return NextResponse.json({ error: 'Failed to load milestones.' }, { status: 500 });
  }
}
