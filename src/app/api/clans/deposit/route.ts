import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/deposit  body: { tag, amount }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();
  const amount = Math.floor(Number(body.amount) || 0);

  if (!tag || amount <= 0) {
    return NextResponse.json({ error: 'Invalid tag or amount.' }, { status: 400 });
  }
  if (amount > 1_000_000) {
    return NextResponse.json({ error: 'Max deposit is 1,000,000 chips per transaction.' }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (me.clanTag !== tag) throw new Error('NOT_MEMBER');
      if (me.bankedChips < amount) throw new Error('INSUFFICIENT');

      const clan = await tx.clan.findUnique({ where: { tag } });
      if (!clan) throw new Error('CLAN_NOT_FOUND');

      // Atomic: deduct from player, add to clan treasury
      await tx.player.update({
        where: { id: me.id },
        data: { bankedChips: { decrement: amount }, totalLost: { increment: amount } },
      });
      await tx.clan.update({
        where: { tag },
        data: { bankedChips: { increment: amount } },
      });

      const updated = await tx.clan.findUnique({ where: { tag }, select: { bankedChips: true } });
      return updated?.bankedChips || 0;
    });

    return NextResponse.json({ ok: true, newTreasury: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      NOT_MEMBER: { error: 'You are not a member of this clan.', status: 403 },
      INSUFFICIENT: { error: 'Insufficient chips.', status: 400 },
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/deposit] error', e);
    return NextResponse.json({ error: 'Deposit failed.' }, { status: 500 });
  }
}
