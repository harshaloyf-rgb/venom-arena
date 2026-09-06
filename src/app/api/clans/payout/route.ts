import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { findPlayerByTag } from '@/lib/player-lookup';

// POST /api/clans/payout  body: { tag, targetUserTag, amount }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim(); // clan tags are stored uppercase
  const targetUserTag = String(body.targetUserTag || '').trim(); // player tags are lowercase (VM-xxxxxx)
  const amount = Math.floor(Number(body.amount) || 0);

  if (!tag || !targetUserTag || amount <= 0) {
    return NextResponse.json({ error: 'Invalid tag, target, or amount.' }, { status: 400 });
  }

  // Resolve the target player by tag (case-insensitive fallback) BEFORE the
  // transaction — the tx client can't use the shared helper.
  const resolvedTarget = await findPlayerByTag(targetUserTag);
  if (!resolvedTarget) {
    return NextResponse.json({ error: 'Target player not found.' }, { status: 404 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (me.clanTag !== tag) throw new Error('NOT_MEMBER');
      if (me.clanRank !== 'Leader' && me.clanRank !== 'Co-Leader') throw new Error('NOT_LEADER');

      const clan = await tx.clan.findUnique({ where: { tag } });
      if (!clan) throw new Error('CLAN_NOT_FOUND');
      if (clan.bankedChips < amount) throw new Error('INSUFFICIENT_TREASURY');

      // Find target player — must be a member of the same clan
      const target = await tx.player.findUnique({ where: { id: resolvedTarget.id } });
      if (!target) throw new Error('TARGET_NOT_FOUND');
      if (target.clanTag !== tag) throw new Error('TARGET_NOT_MEMBER');
      if (target.id === me.id) throw new Error('SELF_PAYOUT');

      // Atomic: deduct from clan treasury, give to target (gift from clan)
      await tx.clan.update({
        where: { tag },
        data: { bankedChips: { decrement: amount } },
      });
      await tx.player.update({
        where: { id: target.id },
        data: {
          bankedChips: { increment: amount },
          totalEarned: { increment: amount },
        },
      });

      // Log activity
      await tx.clanActivity.create({
        data: {
          clanTag: tag,
          type: 'payout',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `distributed ${amount.toLocaleString()}c to ${target.name}`,
        },
      });

      const updatedClan = await tx.clan.findUnique({ where: { tag }, select: { bankedChips: true } });
      return { newTreasury: updatedClan?.bankedChips || 0 };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      NOT_MEMBER: { error: 'You are not a member of this clan.', status: 403 },
      NOT_LEADER: { error: 'Only Leader or Co-Leader can distribute chips.', status: 403 },
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
      INSUFFICIENT_TREASURY: { error: 'Clan treasury does not have enough chips.', status: 400 },
      TARGET_NOT_FOUND: { error: 'Target player not found.', status: 404 },
      TARGET_NOT_MEMBER: { error: 'Target is not a member of this clan.', status: 400 },
      SELF_PAYOUT: { error: 'You cannot distribute chips to yourself.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/payout] error', e);
    return NextResponse.json({ error: 'Payout failed.' }, { status: 500 });
  }
}
