import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/disband  (Leader only)
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me || !me.clanTag) throw new Error('NOT_IN_CLAN');
      if (me.clanRank !== 'Leader') throw new Error('NOT_LEADER');

      const clanTag = me.clanTag;

      // Verify clan exists
      const clan = await tx.clan.findUnique({ where: { tag: clanTag } });
      if (!clan) throw new Error('CLAN_NOT_FOUND');

      // Delete all ClanActivity for the clan
      await tx.clanActivity.deleteMany({ where: { clanTag } });

      // Delete all ClanChallenge for the clan
      await tx.clanChallenge.deleteMany({ where: { clanTag } });

      // Delete all ClanMessages for the clan
      await tx.clanMessage.deleteMany({ where: { clanTag } });

      // Remove all players from the clan
      await tx.player.updateMany({ where: { clanTag }, data: { clanTag: null, clanRank: null } });

      // Delete the clan itself
      await tx.clan.delete({ where: { tag: clanTag } });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      NOT_IN_CLAN: { error: 'Not in a clan.', status: 400 },
      NOT_LEADER: { error: 'Only the Leader can disband the clan.', status: 403 },
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/disband] error', e);
    return NextResponse.json({ error: 'Failed to disband clan.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
