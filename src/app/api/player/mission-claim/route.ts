import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { getAllowedRewards, getISOWeek } from '@/lib/missions';

// POST /api/player/mission-claim — claim a challenge reward (credits chips)
// body: { missionId: string }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { missionId } = body as { missionId?: string };

  const today = new Date().toISOString().slice(0, 10);
  const week = getISOWeek(new Date());
  const isDaily = missionId?.startsWith('daily-');
  const periodStart = isDaily ? today : week;

  // Validate against rotation reward whitelist
  const allowedRewards = getAllowedRewards(today, week);
  if (!missionId || !(missionId in allowedRewards)) {
    return NextResponse.json({ error: 'Invalid mission.' }, { status: 400 });
  }

  const reward = allowedRewards[missionId];

  // Check MissionProgress record
  const progress = await db.missionProgress.findUnique({
    where: {
      playerId_missionId_periodStart: {
        playerId: session.playerId,
        missionId,
        periodStart,
      },
    },
  });

  if (!progress || !progress.completed) {
    return NextResponse.json({ error: 'Mission not yet completed.' }, { status: 400 });
  }

  if (progress.claimedAt) {
    return NextResponse.json({ error: 'Already claimed this mission.' }, { status: 400 });
  }

  // Credit chips + mark claimed (atomic)
  const [updated] = await db.$transaction([
    db.player.update({
      where: { id: session.playerId },
      data: {
        bankedChips: { increment: reward },
        totalEarned: { increment: reward },
      },
    }),
    db.missionProgress.update({
      where: { id: progress.id },
      data: { claimedAt: new Date().toISOString() },
    }),
    // Also record in Purchase for backward compat + audit trail
    db.purchase.create({
      data: {
        playerId: session.playerId,
        itemId: `mission-${today}-${missionId}`,
        itemType: 'mission_reward',
        amountChips: reward,
      },
    }),
  ]);

  return NextResponse.json({ player: toProfile(updated), granted: reward, missionId });
}
