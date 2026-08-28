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

// GET /api/player/claims/history
// Always returns last 7 days of data for the player
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const pid = session.playerId;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dateFilter = { gte: sevenDaysAgo };

    const [daily, hourly, spins, milestones, promos, videos] =
      await Promise.all([
        db.dailyClaim.findMany({
          where: { playerId: pid, createdAt: dateFilter },
          orderBy: { createdAt: 'desc' },
        }),
        db.hourlyClaim.findMany({
          where: { playerId: pid, createdAt: dateFilter },
          orderBy: { createdAt: 'desc' },
        }),
        db.luckySpin.findMany({
          where: { playerId: pid, createdAt: dateFilter },
          orderBy: { createdAt: 'desc' },
        }),
        db.streakMilestoneClaim.findMany({
          where: { playerId: pid, createdAt: dateFilter },
          orderBy: { createdAt: 'desc' },
        }),
        db.promoReward.findMany({
          where: { playerId: pid, createdAt: dateFilter },
          orderBy: { createdAt: 'desc' },
        }),
        db.videoReward.findMany({
          where: { playerId: pid, createdAt: dateFilter },
          orderBy: { createdAt: 'desc' },
        }),
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
          detail: `${r.milestone}-day milestone (${def?.title ?? 'Unknown'})`,
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

    const entries = all.map((e) => ({
      id: e.id,
      type: e.type,
      reward: e.reward,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({ entries, total: entries.length });
  } catch (e) {
    console.error('[claims/history] GET error', e);
    return NextResponse.json({ error: 'Failed to load claim history.' }, { status: 500 });
  }
}
