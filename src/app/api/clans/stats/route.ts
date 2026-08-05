import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/clans/stats?tag=APEX
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tag = String(req.nextUrl.searchParams.get('tag') || '').toUpperCase().trim();
  if (!tag) return NextResponse.json({ error: 'Missing tag.' }, { status: 400 });

  const me = await db.player.findUnique({ where: { id: session.playerId }, select: { clanTag: true } });
  if (!me || me.clanTag !== tag) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const agg = await db.player.aggregate({
    where: { clanTag: tag },
    _sum: {
      bankedChips: true,
      level: true,
      lifetimeKills: true,
      lifetimeDeaths: true,
      lifetimeExtracts: true,
      bestStreak: true,
      totalEarned: true,
    },
    _count: true,
    _max: { level: true, bankedChips: true, bestStreak: true },
    _min: { level: true },
  });

  const totalMembers = agg._count || 0;
  const s = agg._sum;
  const mx = agg._max;

  // Online count: lastSeenAt within last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineCount = await db.player.count({
    where: { clanTag: tag, lastSeenAt: { gte: fiveMinAgo } },
  });

  return NextResponse.json({
    totalMembers,
    onlineCount,
    totalChips: s.bankedChips || 0,
    avgLevel: totalMembers > 0 ? Math.round((s.level || 0) / totalMembers) : 0,
    totalKills: s.lifetimeKills || 0,
    totalDeaths: s.lifetimeDeaths || 0,
    totalExtracts: s.lifetimeExtracts || 0,
    totalEarned: s.totalEarned || 0,
    highestLevel: mx.level || 0,
    richestChips: mx.bankedChips || 0,
    bestStreak: mx.bestStreak || 0,
    kdRatio: s.lifetimeDeaths && s.lifetimeDeaths > 0
      ? ((s.lifetimeKills || 0) / s.lifetimeDeaths).toFixed(2)
      : '0.00',
  });
}
