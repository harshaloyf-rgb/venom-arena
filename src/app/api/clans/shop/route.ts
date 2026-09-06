import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// ─── Shop items (in-memory, not DB) ──────────────────────────────────────
const SHOP_ITEMS: Record<string, { name: string; cost: number; description: string; repeatable: boolean }> = {
  member_expansion: { name: 'Member Expansion', cost: 15000, description: '+5 max member slots (permanent)', repeatable: true },
  xp_windfall: { name: 'XP Windfall', cost: 8000, description: 'Instantly grants Level \u00d7 500 XP', repeatable: true },
  war_shield: { name: 'War Shield', cost: 5000, description: 'Prevents war declarations against your clan for 7 days', repeatable: false },
};

// POST /api/clans/shop  body: { tag, itemId }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();
  const itemId = String(body.itemId || '').trim();

  if (!tag || !itemId) {
    return NextResponse.json({ error: 'Missing tag or itemId.' }, { status: 400 });
  }

  const item = SHOP_ITEMS[itemId];
  if (!item) {
    return NextResponse.json({ error: 'Invalid item ID.' }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (me.clanTag !== tag) throw new Error('NOT_MEMBER');
      if (me.clanRank !== 'Leader') throw new Error('NOT_LEADER');

      const clan = await tx.clan.findUnique({ where: { tag } });
      if (!clan) throw new Error('CLAN_NOT_FOUND');
      if (clan.bankedChips < item.cost) throw new Error('INSUFFICIENT_TREASURY');

      // Non-repeatable check. War Shield is special: it protects for 7 days,
      // so it may be bought again once the previous shield has EXPIRED — only
      // an unexpired purchase blocks a re-buy. Truly one-time items block on
      // any existing purchase.
      if (!item.repeatable) {
        const shieldActive = itemId === 'war_shield';
        const existing = await tx.clanPurchase.findFirst({
          where: {
            clanTag: tag,
            itemId,
            ...(shieldActive
              ? { createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
              : {}),
          },
        });
        if (existing) throw new Error(shieldActive ? 'SHIELD_ACTIVE' : 'ALREADY_PURCHASED');
      }

      // Decrement treasury
      await tx.clan.update({
        where: { tag },
        data: { bankedChips: { decrement: item.cost } },
      });

      // Apply item effect
      let effect = '';

      if (itemId === 'member_expansion') {
        await tx.clan.update({
          where: { tag },
          data: { maxMembers: { increment: 5 } },
        });
        effect = `Clan max members increased by 5 (now ${clan.maxMembers + 5})`;
      } else if (itemId === 'xp_windfall') {
        const xpBonus = clan.level * 500;
        let updatedClan = await tx.clan.update({
          where: { tag },
          data: { xp: { increment: xpBonus } },
        });

        // Check level-up (same logic as challenges POST / deposit route)
        let { xp, level } = updatedClan;
        const xpNeeded = level * 1000;
        if (xp >= xpNeeded) {
          level += 1;
          xp = xp - xpNeeded;
          await tx.clan.update({
            where: { tag },
            data: { level, xp },
          });
          await tx.clanActivity.create({
            data: {
              clanTag: tag,
              type: 'level_up',
              actorTag: me.userTag,
              actorName: me.name,
              detail: `Clan leveled up to ${level}!`,
            },
          });
          effect = `+${xpBonus} XP granted; Clan leveled up to ${level}!`;
        } else {
          effect = `+${xpBonus} XP granted to clan`;
        }
      } else if (itemId === 'war_shield') {
        effect = 'War Shield activated for 7 days';
      }

      // Create purchase record
      await tx.clanPurchase.create({
        data: {
          clanTag: tag,
          itemId,
          cost: item.cost,
          purchasedBy: me.userTag,
        },
      });

      // Log activity
      await tx.clanActivity.create({
        data: {
          clanTag: tag,
          type: 'shop_purchase',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `purchased ${item.name} for ${item.cost.toLocaleString()}c`,
        },
      });

      // Fetch final treasury
      const final = await tx.clan.findUnique({ where: { tag }, select: { bankedChips: true } });
      return {
        newTreasury: final?.bankedChips ?? 0,
        effect,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      NOT_MEMBER: { error: 'You are not a member of this clan.', status: 403 },
      NOT_LEADER: { error: 'Only the Leader can purchase from the clan shop.', status: 403 },
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
      INSUFFICIENT_TREASURY: { error: 'Not enough chips in the clan treasury.', status: 400 },
      ALREADY_PURCHASED: { error: 'This item has already been purchased and is not repeatable.', status: 400 },
      SHIELD_ACTIVE: { error: 'Your War Shield is still active — it can be bought again 7 days after purchase.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/shop] error', e);
    return NextResponse.json({ error: 'Purchase failed.' }, { status: 500 });
  }
}
