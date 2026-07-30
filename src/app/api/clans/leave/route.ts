import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/leave
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me || !me.clanTag) throw new Error('NOT_IN_CLAN');

      const clanTag = me.clanTag;
      const wasLeader = me.clanRank === 'Leader';

      // Remove player from clan
      await tx.player.update({ where: { id: me.id }, data: { clanTag: null, clanRank: null } });

      // Check remaining members and handle cleanup
      const remaining = await tx.player.count({ where: { clanTag } });
      if (remaining === 0) {
        await tx.clan.delete({ where: { tag: clanTag } }).catch(() => {});
      } else if (wasLeader) {
        // Promote oldest member to Leader
        const oldest = await tx.player.findFirst({
          where: { clanTag },
          orderBy: { createdAt: 'asc' },
        });
        if (oldest) {
          await tx.player.update({ where: { id: oldest.id }, data: { clanRank: 'Leader' } });
        }
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'NOT_IN_CLAN') {
      return NextResponse.json({ error: 'Not in a clan.' }, { status: 400 });
    }
    console.error('[clans/leave] error', e);
    return NextResponse.json({ error: 'Failed to leave clan.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
