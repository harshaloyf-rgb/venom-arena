import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { STREAK_FREEZE_COST, STREAK_FREEZE_MAX } from '@/lib/game-config';

// POST /api/player/streak/freeze — buy a streak freeze
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');

      if (player.streakFreezes >= STREAK_FREEZE_MAX) {
        throw new Error('FREEZE_MAX');
      }

      if (player.bankedChips < STREAK_FREEZE_COST) {
        throw new Error('INSUFFICIENT_CHIPS');
      }

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          bankedChips: { decrement: STREAK_FREEZE_COST },
          streakFreezes: { increment: 1 },
        },
      });

      return updated;
    });

    return NextResponse.json({
      player: toProfile(result),
      freezesRemaining: result.streakFreezes,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'PLAYER_NOT_FOUND') {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }
    if (msg === 'FREEZE_MAX') {
      return NextResponse.json({ error: `Already at max streak freezes (${STREAK_FREEZE_MAX}).` }, { status: 400 });
    }
    if (msg === 'INSUFFICIENT_CHIPS') {
      return NextResponse.json({ error: `Not enough chips. Need ${STREAK_FREEZE_COST}c.` }, { status: 400 });
    }
    console.error('[streak/freeze] POST error', e);
    return NextResponse.json({ error: 'Failed to buy streak freeze.' }, { status: 500 });
  }
}
