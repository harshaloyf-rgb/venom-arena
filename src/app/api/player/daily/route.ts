import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { utcToday } from '@/lib/date-utils';
import { DAILY_REWARDS, levelRewardMultiplier, STREAK_MILESTONES, SEASONAL_BONUS_DAYS } from '@/lib/game-config';
import { playerActionLimit } from '@/lib/api-helpers';

// POST /api/player/daily  — claim today's daily reward (idempotent per day)
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Anti-hammer (X6): once/day reward, DB-guarded; limit is belt-and-braces
  const rl = playerActionLimit(session.playerId, 'daily', 3, 60_000);
  if (rl) return rl;

  const today = utcToday();

  try {
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');

      // Re-check inside the transaction to prevent double-claim
      if (player.lastDailyClaim === today) {
        throw new Error('ALREADY_CLAIMED');
      }

      // Determine streak: if last claim was yesterday, increment.
      // CRITICAL fix (was a placebo): a purchased Streak Freeze is now actually
      // CONSUMED — if exactly one day was missed (diffDays === 2) and the player
      // owns a freeze, the streak continues and one freeze is burned. Freezes
      // only protect a single missed day; longer gaps still reset the streak.
      let newStreak = 0;
      let freezeUsed = false;
      if (player.lastDailyClaim) {
        const last = new Date(player.lastDailyClaim + 'T00:00:00Z');
        const todayDate = new Date(today + 'T00:00:00Z');
        const diffDays = Math.round((todayDate.getTime() - last.getTime()) / 86400000);
        if (diffDays === 1) newStreak = player.dailyStreak + 1;
        else if (diffDays === 2 && player.streakFreezes > 0) {
          newStreak = player.dailyStreak + 1;
          freezeUsed = true;
        } else newStreak = 0; // missed a day (no freeze, or gap > 1 day)
      }

      // Base reward from 7-day cycle
      const cycleDay = newStreak % 7;
      const baseReward = DAILY_REWARDS[cycleDay];

      // Level-scaled multiplier
      const lvlMult = levelRewardMultiplier(player.level);

      // Seasonal bonus check
      const seasonal = SEASONAL_BONUS_DAYS[today] ?? null;
      const seasonalMult = seasonal ? seasonal.multiplier : 1;

      // Final reward = base × level × seasonal
      const reward = Math.floor(baseReward * lvlMult * seasonalMult);

      // Update player + record claim atomically inside the same tx
      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          bankedChips: { increment: reward },
          totalEarned: { increment: reward },
          dailyStreak: newStreak,
          lastDailyClaim: today,
          ...(freezeUsed ? { streakFreezes: { decrement: 1 } } : {}),
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

      // ── Streak milestone auto-check (30 / 60 / 90) ──
      let milestoneResult: { milestone: number; reward: number; title: string; emoji: string } | null = null;
      const milestoneDef = STREAK_MILESTONES[newStreak];
      if (milestoneDef) {
        const alreadyClaimed = await tx.streakMilestoneClaim.findUnique({
          where: { playerId_milestone: { playerId: player.id, milestone: newStreak } },
        });
        if (!alreadyClaimed) {
          // Award bonus chips and record the milestone claim
          const [milestonePlayer] = await Promise.all([
            tx.player.update({
              where: { id: player.id },
              data: {
                bankedChips: { increment: milestoneDef.reward },
                totalEarned: { increment: milestoneDef.reward },
              },
            }),
            tx.streakMilestoneClaim.create({
              data: {
                playerId: player.id,
                milestone: newStreak,
                reward: milestoneDef.reward,
              },
            }),
          ]);
          // Use the latest player data (with milestone bonus applied)
          return {
            updated: milestonePlayer,
            reward,
            baseReward,
            newStreak,
            freezeUsed,
            lvlMult,
            seasonal,
            milestoneResult: { milestone: newStreak, ...milestoneDef },
          };
        }
      }

      return {
        updated,
        reward,
        baseReward,
        newStreak,
        freezeUsed,
        lvlMult,
        seasonal,
        milestoneResult: null,
      };
    });

    return NextResponse.json({
      player: toProfile(result.updated),
      reward: result.reward,
      baseReward: result.baseReward,
      streak: result.newStreak,
      freezeUsed: result.freezeUsed,
      levelMultiplier: result.lvlMult,
      seasonalBonus: result.seasonal
        ? { multiplier: result.seasonal.multiplier, label: result.seasonal.label }
        : null,
      streakMilestone: result.milestoneResult,
    });
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
