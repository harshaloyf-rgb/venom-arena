import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { ELITE_PASS_COST } from '@/lib/game-config';

// POST /api/season-pass/unlock-elite
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!player) throw new Error('PLAYER_NOT_FOUND');
      if (player.hasElitePass) throw new Error('ALREADY_ELITE');
      if (player.bankedChips < ELITE_PASS_COST) throw new Error('NOT_ENOUGH_CHIPS');

      const updated = await tx.player.update({
        where: { id: player.id },
        data: {
          bankedChips: { decrement: ELITE_PASS_COST },
          hasElitePass: true,
        },
      });

      // Record purchase
      await tx.purchase.create({
        data: {
          playerId: player.id,
          itemId: 'elite-pass-genesis',
          itemType: 'skin',
          amountChips: -ELITE_PASS_COST,
        },
      });

      return updated;
    });

    return NextResponse.json({ player: toProfile(result) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Player not found.', status: 404 },
      ALREADY_ELITE: { error: 'You already have the Elite Pass.', status: 400 },
      NOT_ENOUGH_CHIPS: { error: `You need ${ELITE_PASS_COST.toLocaleString('en-IN')} banked chips.`, status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[season-pass/unlock-elite] error', e);
    return NextResponse.json({ error: 'Failed to unlock Elite Pass.' }, { status: 500 });
  }
}
