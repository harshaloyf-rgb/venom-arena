import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { DAILY_REWARDS } from '@/lib/game-config';

// POST /api/player/daily  — claim today's daily reward (idempotent per day)
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');

      // Re-check inside the transaction to prevent double-claim
      if (player.lastDailyClaim === today) {
        throw new Error('ALREADY_CLAIMED');
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

      // Update player + record claim atomically inside the same tx
      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          bankedChips: { increment: reward },
          totalEarned: { increment: reward },
          dailyStreak: newStreak,
          lastDailyClaim: today,
        },
      });
      await tx.dailyClaim.create({
        data: {
          playerId: player.id,
          day: today,
          reward,
          streak: newStreak,
        },
      });

      return { updated, reward, newStreak };
    });

    return NextResponse.json({ player: toProfile(result.updated), reward: result.reward, streak: result.newStreak });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'PLAYER_NOT_FOUND') {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }
    if (msg === 'ALREADY_CLAIMED') {
      return NextResponse.json({ error: 'Already claimed today. Come back tomorrow!' }, { status: 400 });
    }
    console.error('[daily] error', e);
    return NextResponse.json({ error: 'Claim failed.' }, { status: 500 });
  }
}
