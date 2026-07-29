import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/leave
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await db.player.findUnique({ where: { id: session.playerId } });
  if (!me || !me.clanTag) return NextResponse.json({ error: 'Not in a clan.' }, { status: 400 });

  const clanTag = me.clanTag;
  const wasLeader = me.clanRank === 'Leader';

  // Remove player from clan
  await db.player.update({ where: { id: me.id }, data: { clanTag: null, clanRank: null } });

  // If was leader, promote oldest member or delete empty clan — in a transaction
  if (wasLeader) {
    await db.$transaction(async (tx) => {
      const remaining = await tx.player.count({ where: { clanTag } });
      if (remaining === 0) {
        await tx.clan.delete({ where: { tag: clanTag } }).catch(() => {});
      } else {
        const oldest = await tx.player.findFirst({
          where: { clanTag },
          orderBy: { createdAt: 'asc' },
        });
        if (oldest) {
          await tx.player.update({ where: { id: oldest.id }, data: { clanRank: 'Leader' } });
        }
      }
    });
  } else {
    // Check if clan is now empty and delete if so
    const remaining = await db.player.count({ where: { clanTag } });
    if (remaining === 0) {
      await db.clan.delete({ where: { tag: clanTag } }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
