import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { DAILY_REWARDS } from '@/lib/game-config';

// POST /api/player/daily  — claim today's daily reward (idempotent per day)
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const player = await db.player.findUnique({ where: { id: session.playerId } });
  if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Already claimed today?
  if (player.lastDailyClaim === today) {
    return NextResponse.json({ error: 'Already claimed today. Come back tomorrow!' }, { status: 400 });
  }

  // Determine streak: if last claim was yesterday, increment; else reset to day 0
  let newStreak = 0;
  if (player.lastDailyClaim) {
    const last = new Date(player.lastDailyClaim + 'T00:00:00Z');
    const todayDate = new Date(today + 'T00:00:00Z');
    const diffDays = Math.round((todayDate.getTime() - last.getTime()) / 86400000);
    if (diffDays === 1) newStreak = player.dailyStreak + 1;
    else newStreak = 0; // missed a day
  }
  // Cycle is 7 days
  const cycleDay = newStreak % 7;
  const reward = DAILY_REWARDS[cycleDay];

  // Atomic: update player + record claim
  const [updated] = await db.$transaction([
    db.player.update({
      where: { id: player.id },
      data: {
        bankedChips: { increment: reward },
        totalEarned: { increment: reward },
        dailyStreak: newStreak,
        lastDailyClaim: today,
      },
    }),
    db.dailyClaim.create({
      data: {
        playerId: player.id,
        day: today,
        reward,
        streak: newStreak,
      },
    }),
  ]);

  return NextResponse.json({ player: toProfile(updated), reward, streak: newStreak });
}
