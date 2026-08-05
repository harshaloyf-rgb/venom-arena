import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { STREAK_MILESTONES } from '@/lib/game-config';

type UnifiedEntry = {
  id: string;
  type: 'daily' | 'hourly' | 'spin' | 'streak_milestone' | 'promo' | 'video';
  reward: number;
  detail: string;
  createdAt: Date;
};

// GET /api/player/claims/history?limit=50&offset=0
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

    const pid = session.playerId;

    // Query all 6 tables in parallel: counts for total, records for entries (SQLite doesn't support UNION easily)
    // Over-fetch `limit + offset` per table so JS merge-sort + pagination yields correct page
    const fetchTake = limit + offset;
    const [daily, hourly, spins, milestones, promos, videos, dailyCount, hourlyCount, spinsCount, milestonesCount, promosCount, videosCount] =
      await Promise.all([
        db.dailyClaim.findMany({
          where: { playerId: pid },
          orderBy: { createdAt: 'desc' },
          take: fetchTake,
        }),
        db.hourlyClaim.findMany({
          where: { playerId: pid },
          orderBy: { createdAt: 'desc' },
          take: fetchTake,
        }),
        db.luckySpin.findMany({
          where: { playerId: pid },
          orderBy: { createdAt: 'desc' },
          take: fetchTake,
        }),
        db.streakMilestoneClaim.findMany({
          where: { playerId: pid },
          orderBy: { createdAt: 'desc' },
          take: fetchTake,
        }),
        db.promoReward.findMany({
          where: { playerId: pid },
          orderBy: { createdAt: 'desc' },
          take: fetchTake,
        }),
        db.videoReward.findMany({
          where: { playerId: pid },
          orderBy: { createdAt: 'desc' },
          take: fetchTake,
        }),
        db.dailyClaim.count({ where: { playerId: pid } }),
        db.hourlyClaim.count({ where: { playerId: pid } }),
        db.luckySpin.count({ where: { playerId: pid } }),
        db.streakMilestoneClaim.count({ where: { playerId: pid } }),
        db.promoReward.count({ where: { playerId: pid } }),
        db.videoReward.count({ where: { playerId: pid } }),
      ]);

    // Map each to unified shape
    const all: UnifiedEntry[] = [
      ...daily.map((r) => ({
        id: r.id,
        type: 'daily' as const,
        reward: r.reward,
        detail: `Day ${r.streak} streak reward`,
        createdAt: r.createdAt,
      })),
      ...hourly.map((r) => ({
        id: r.id,
        type: 'hourly' as const,
        reward: r.reward,
        detail: 'Hourly micro-claim',
        createdAt: r.createdAt,
      })),
      ...spins.map((r) => ({
        id: r.id,
        type: 'spin' as const,
        reward: r.reward,
        detail: `Lucky Spin — ${r.prizeTier}`,
        createdAt: r.createdAt,
      })),
      ...milestones.map((r) => {
        const def = STREAK_MILESTONES[r.milestone];
        return {
          id: r.id,
          type: 'streak_milestone' as const,
          reward: r.reward,
          detail: `${r.milestone}-day streak milestone (${def?.title ?? 'Unknown'})`,
          createdAt: r.createdAt,
        };
      }),
      ...promos.map((r) => ({
        id: r.id,
        type: 'promo' as const,
        reward: r.reward,
        detail: `Promo code: ${r.code}`,
        createdAt: r.createdAt,
      })),
      ...videos.map((r) => ({
        id: r.id,
        type: 'video' as const,
        reward: r.reward,
        detail: 'Video ad reward',
        createdAt: r.createdAt,
      })),
    ];

    // Sort by createdAt DESC
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = dailyCount + hourlyCount + spinsCount + milestonesCount + promosCount + videosCount;
    const entries = all
      .slice(offset, offset + limit)
      .map((e) => ({
        id: e.id,
        type: e.type,
        reward: e.reward,
        detail: e.detail,
        createdAt: e.createdAt.toISOString(),
      }));

    return NextResponse.json({ entries, total });
  } catch (e) {
    console.error('[claims/history] GET error', e);
    return NextResponse.json({ error: 'Failed to load claim history.' }, { status: 500 });
  }
}
