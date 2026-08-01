import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { SPIN_PRIZES, SPIN_FREE_PER_DAY, SPIN_COST, levelRewardMultiplier, SEASONAL_BONUS_DAYS } from '@/lib/game-config';
import { utcToday } from '@/lib/date-utils';

function pickPrize() {
  // Build cumulative weight array
  const totalWeight = SPIN_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const prize of SPIN_PRIZES) {
    rand -= prize.weight;
    if (rand <= 0) return prize;
  }
  // Fallback to last prize
  return SPIN_PRIZES[SPIN_PRIZES.length - 1];
}

// GET /api/player/spin — check spin availability
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const today = utcToday();
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const todayEnd = new Date(today + 'T23:59:59.999Z');

    const todaySpins = await db.luckySpin.count({
      where: {
        playerId: session.playerId,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const freeSpinsToday = Math.max(0, SPIN_FREE_PER_DAY - todaySpins);

    return NextResponse.json({
      freeSpinsToday,
      spinsToday: todaySpins,
      cost: SPIN_COST,
    });
  } catch (e) {
    console.error('[spin] GET error', e);
    return NextResponse.json({ error: 'Failed to check spin status.' }, { status: 500 });
  }
}

// POST /api/player/spin — spin the wheel
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    let body: { useFree?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // no body — default to paid
    }

    const useFree = body.useFree === true;

    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');

      // Count today's spins
      const today = utcToday();
      const todayStart = new Date(today + 'T00:00:00.000Z');
      const todayEnd = new Date(today + 'T23:59:59.999Z');
      const todaySpins = await tx.luckySpin.count({
        where: {
          playerId: player.id,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      });

      const freeRemaining = Math.max(0, SPIN_FREE_PER_DAY - todaySpins);

      if (useFree) {
        if (freeRemaining <= 0) {
          throw new Error('NO_FREE_SPINS');
        }
      } else {
        if (player.bankedChips < SPIN_COST) {
          throw new Error('INSUFFICIENT_CHIPS');
        }
        // Deduct cost
        await tx.player.update({
          where: { id: player.id },
          data: { bankedChips: { decrement: SPIN_COST } },
        });
      }

      // Weighted random prize selection
      const prize = pickPrize();
      const baseReward = Math.floor(Math.random() * (prize.max - prize.min + 1)) + prize.min;

      // Level multiplier
      const lvlMult = levelRewardMultiplier(player.level);

      // Seasonal bonus
      const seasonal = SEASONAL_BONUS_DAYS[today] ?? null;
      const seasonalMult = seasonal ? seasonal.multiplier : 1;

      // Final reward
      const reward = Math.floor(baseReward * lvlMult * seasonalMult);

      // Add chips + record spin
      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          bankedChips: { increment: reward },
          totalEarned: { increment: reward },
        },
      });

      await tx.luckySpin.create({
        data: {
          playerId: player.id,
          reward,
          prizeTier: prize.tier,
        },
      });

      return { updated, reward, prize };
    });

    return NextResponse.json({
      player: toProfile(result.updated),
      reward: result.reward,
      prizeTier: result.prize.tier,
      prizeLabel: result.prize.label,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'PLAYER_NOT_FOUND') {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }
    if (msg === 'NO_FREE_SPINS') {
      return NextResponse.json({ error: 'No free spins remaining today.' }, { status: 400 });
    }
    if (msg === 'INSUFFICIENT_CHIPS') {
      return NextResponse.json({ error: `Not enough chips. Need ${SPIN_COST}c.` }, { status: 400 });
    }
    console.error('[spin] POST error', e);
    return NextResponse.json({ error: 'Spin failed.' }, { status: 500 });
  }
}
