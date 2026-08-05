import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { HOURLY_REWARD_MIN, HOURLY_REWARD_MAX, levelRewardMultiplier, SEASONAL_BONUS_DAYS } from '@/lib/game-config';
import { utcToday } from '@/lib/date-utils';

const ONE_HOUR_MS = 60 * 60 * 1000;

// GET /api/player/hourly — check if hourly claim is available
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

    const now = Date.now();
    const lastClaim = player.lastHourlyClaim?.getTime() ?? 0;
    const canClaim = !lastClaim || (now - lastClaim >= ONE_HOUR_MS);
    const timeLeftMs = canClaim ? 0 : Math.max(0, ONE_HOUR_MS - (now - lastClaim));

    return NextResponse.json({
      canClaim,
      timeLeftMs,
      nextReward: { min: HOURLY_REWARD_MIN, max: HOURLY_REWARD_MAX },
    });
  } catch (e) {
    console.error('[hourly] GET error', e);
    return NextResponse.json({ error: 'Failed to check hourly claim.' }, { status: 500 });
  }
}

// POST /api/player/hourly — claim hourly reward
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');

      // Check cooldown inside transaction
      const now = Date.now();
      const lastClaim = player.lastHourlyClaim?.getTime() ?? 0;
      if (lastClaim && (now - lastClaim < ONE_HOUR_MS)) {
        throw new Error('COOLDOWN_ACTIVE');
      }

      // Random base reward
      const baseReward = Math.floor(Math.random() * (HOURLY_REWARD_MAX - HOURLY_REWARD_MIN + 1)) + HOURLY_REWARD_MIN;

      // Level multiplier
      const lvlMult = levelRewardMultiplier(player.level);

      // Seasonal bonus
      const today = utcToday();
      const seasonal = SEASONAL_BONUS_DAYS[today] ?? null;
      const seasonalMult = seasonal ? seasonal.multiplier : 1;

      // Final reward
      const reward = Math.floor(baseReward * lvlMult * seasonalMult);

      // Update player + record claim atomically
      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          bankedChips: { increment: reward },
          totalEarned: { increment: reward },
          lastHourlyClaim: new Date(),
        },
      });

      await tx.hourlyClaim.create({
        data: {
          playerId: player.id,
          reward,
        },
      });

      return { updated, reward, lvlMult, seasonal };
    });

    return NextResponse.json({
      player: toProfile(result.updated),
      reward: result.reward,
      levelMultiplier: result.lvlMult,
      seasonalBonus: result.seasonal
        ? { multiplier: result.seasonal.multiplier, label: result.seasonal.label }
        : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'PLAYER_NOT_FOUND') {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }
    if (msg === 'COOLDOWN_ACTIVE') {
      return NextResponse.json({ error: 'Hourly claim on cooldown. Wait a bit!' }, { status: 400 });
    }
    console.error('[hourly] POST error', e);
    return NextResponse.json({ error: 'Hourly claim failed.' }, { status: 500 });
  }
}
