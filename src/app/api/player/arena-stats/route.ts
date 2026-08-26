import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/player/arena-stats?userTag=xxx
// Returns per-arena match statistics for the authenticated player (or a specific userTag for admins).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl;
  const requestedTag = url.searchParams.get('userTag');

  // Allow players to view their own stats, or admins to view any
  let playerId = session.playerId;
  if (requestedTag && requestedTag !== session.userTag) {
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const target = await db.player.findUnique({ where: { userTag: requestedTag } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    playerId = target.id;
  }

  const stats = await db.arenaStats.findMany({
    where: { playerId },
    orderBy: { arenaId: 'asc' },
  });

  // Serialize BigInt fields to strings for JSON
  const serialized = stats.map((s) => ({
    ...s,
    totalChipsBanked: s.totalChipsBanked.toString(),
    bestExtract: s.bestExtract.toString(),
  }));

  return NextResponse.json(serialized);
}
