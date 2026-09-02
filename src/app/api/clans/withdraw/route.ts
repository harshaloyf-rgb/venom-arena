import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { playerActionLimit } from '@/lib/api-helpers';

// POST /api/clans/withdraw  body: { tag, amount }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Anti-hammer (X6): treasury movement
  const rl = playerActionLimit(session.playerId, 'clan-withdraw', 30, 60_000);
  if (rl) return rl;

  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();
  const amount = Math.floor(Number(body.amount) || 0);

  if (!tag || amount <= 0) {
    return NextResponse.json({ error: 'Invalid tag or amount.' }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (me.clanTag !== tag) throw new Error('NOT_MEMBER');
      if (me.clanDeposited < amount) throw new Error('OVER_DEPOSITED');

      const clan = await tx.clan.findUnique({ where: { tag } });
      if (!clan) throw new Error('CLAN_NOT_FOUND');
      if (clan.bankedChips < amount) throw new Error('INSUFFICIENT_TREASURY');

      // Atomic: return chips to player, reduce treasury, reduce deposited tracker
      await tx.player.update({
        where: { id: me.id },
        data: {
          bankedChips: { increment: amount },
          clanDeposited: { decrement: amount },
        },
      });
      await tx.clan.update({
        where: { tag },
        data: { bankedChips: { decrement: amount } },
      });

      // Log activity
      await tx.clanActivity.create({
        data: {
          clanTag: tag,
          type: 'withdraw',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `withdrew ${amount.toLocaleString()}c from treasury`,
        },
      });

      const updatedClan = await tx.clan.findUnique({ where: { tag }, select: { bankedChips: true } });
      const updatedPlayer = await tx.player.findUnique({ where: { id: me.id }, select: { bankedChips: true, clanDeposited: true } });

      return {
        newTreasury: updatedClan?.bankedChips || 0,
        yourChips: updatedPlayer?.bankedChips || 0,
        depositedRemaining: updatedPlayer?.clanDeposited || 0,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      NOT_MEMBER: { error: 'You are not a member of this clan.', status: 403 },
      OVER_DEPOSITED: { error: 'Cannot withdraw more than you deposited.', status: 400 },
      INSUFFICIENT_TREASURY: { error: 'Clan treasury does not have enough chips.', status: 400 },
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/withdraw] error', e);
    return NextResponse.json({ error: 'Withdrawal failed.' }, { status: 500 });
  }
}
