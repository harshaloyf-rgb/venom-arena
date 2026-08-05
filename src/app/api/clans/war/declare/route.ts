import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/war/declare  body: { tag, targetTag, wager }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();
  const targetTag = String(body.targetTag || '').toUpperCase().trim();
  const wager = Math.floor(Number(body.wager) || 0);

  if (!tag || !targetTag || wager < 1000) {
    return NextResponse.json({ error: 'Invalid tag or wager (min 1000).' }, { status: 400 });
  }
  if (tag === targetTag) {
    return NextResponse.json({ error: 'Cannot declare war on your own clan.' }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (me.clanTag !== tag) throw new Error('NOT_MEMBER');
      if (me.clanRank !== 'Leader') throw new Error('NOT_LEADER');

      const myClan = await tx.clan.findUnique({ where: { tag } });
      if (!myClan) throw new Error('CLAN_NOT_FOUND');

      const targetClan = await tx.clan.findUnique({ where: { tag: targetTag } });
      if (!targetClan) throw new Error('TARGET_NOT_FOUND');

      // Check declarer doesn't already have an active war
      const myActiveWar = await tx.clanWar.findFirst({
        where: {
          OR: [
            { declarerTag: tag, status: 'active' },
            { targetTag: tag, status: 'active' },
          ],
        },
      });
      if (myActiveWar) throw new Error('ALREADY_AT_WAR');

      // Check target doesn't already have an active war
      const targetActiveWar = await tx.clanWar.findFirst({
        where: {
          OR: [
            { declarerTag: targetTag, status: 'active' },
            { targetTag: targetTag, status: 'active' },
          ],
        },
      });
      if (targetActiveWar) throw new Error('TARGET_ALREADY_AT_WAR');

      // Check both clans have enough banked chips
      if (myClan.bankedChips < wager) throw new Error('INSUFFICIENT_TREASURY');
      if (targetClan.bankedChips < wager) throw new Error('TARGET_INSUFFICIENT_TREASURY');

      // Check war shield (purchase within last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const shield = await tx.clanPurchase.findFirst({
        where: {
          clanTag: targetTag,
          itemId: 'war_shield',
          createdAt: { gt: sevenDaysAgo },
        },
      });
      if (shield) throw new Error('TARGET_SHIELDED');

      // Deduct wager from both clans (held in escrow)
      await tx.clan.update({
        where: { tag },
        data: { bankedChips: { decrement: wager } },
      });
      await tx.clan.update({
        where: { tag: targetTag },
        data: { bankedChips: { decrement: wager } },
      });

      // Create war record
      const war = await tx.clanWar.create({
        data: {
          declarerTag: tag,
          targetTag,
          wager,
        },
      });

      // Log activity on both clans
      await tx.clanActivity.create({
        data: {
          clanTag: tag,
          type: 'war_declare',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `declared war on ${targetClan.name} [${targetTag}] — ${wager.toLocaleString()}c wagered by each clan`,
        },
      });
      await tx.clanActivity.create({
        data: {
          clanTag: targetTag,
          type: 'war_declare',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `${myClan.name} [${tag}] declared war — ${wager.toLocaleString()}c wagered by each clan`,
        },
      });

      return { warId: war.id, totalPot: wager * 2 };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      NOT_MEMBER: { error: 'You are not a member of this clan.', status: 403 },
      NOT_LEADER: { error: 'Only the clan Leader can declare war.', status: 403 },
      CLAN_NOT_FOUND: { error: 'Your clan was not found.', status: 404 },
      TARGET_NOT_FOUND: { error: 'Target clan does not exist.', status: 404 },
      ALREADY_AT_WAR: { error: 'Your clan already has an active war.', status: 409 },
      TARGET_ALREADY_AT_WAR: { error: 'Target clan already has an active war.', status: 409 },
      INSUFFICIENT_TREASURY: { error: 'Your clan treasury does not have enough chips.', status: 400 },
      TARGET_INSUFFICIENT_TREASURY: { error: 'Target clan treasury does not have enough chips.', status: 400 },
      TARGET_SHIELDED: { error: 'TARGET_SHIELDED', status: 403 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/war/declare] error', e);
    return NextResponse.json({ error: 'War declaration failed.' }, { status: 500 });
  }
}
