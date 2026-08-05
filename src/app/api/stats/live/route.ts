import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/stats/live — engagement stats for the highlights feed
// No auth required — this is public marketing data
export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [todayMatches, totalPlayers, topClip] = await Promise.all([
      // Today's match stats
      db.matchHistory.aggregate({
        where: { createdAt: { gte: todayStart } },
        _count: true,
        _sum: { chipsEarned: true, kills: true },
      }),
      // Total registered players
      db.player.count(),
      // Today's top match-card clip (for "Can you beat this?")
      db.clip.findFirst({
        where: {
          cardType: 'match-card',
          createdAt: { gte: todayStart },
        },
        orderBy: [{ chipsExtracted: 'desc' }, { kills: 'desc' }],
        include: {
          player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } },
        },
      }),
    ]);

    // Count extractions today
    const extractionsToday = await db.matchHistory.count({
      where: { createdAt: { gte: todayStart }, status: 'EXTRACTED' },
    });

    return NextResponse.json({
      today: {
        totalMatches: todayMatches._count || 0,
        extractions: extractionsToday,
        chipsEarned: todayMatches._sum.chipsEarned || 0,
        kills: todayMatches._sum.kills || 0,
      },
      totalPlayers,
      topTodayClip: topClip
        ? {
            id: topClip.id,
            title: topClip.title,
            chipsExtracted: topClip.chipsExtracted,
            kills: topClip.kills,
            arenaName: topClip.arenaName,
            player: topClip.player,
          }
        : null,
    });
  } catch (e) {
    console.error('[stats/live] error', e);
    return NextResponse.json({
      today: { totalMatches: 0, extractions: 0, chipsEarned: 0, kills: 0 },
      totalPlayers: 0,
      topTodayClip: null,
    });
  }
}
