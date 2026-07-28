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
  await db.player.update({ where: { id: me.id }, data: { clanTag: null, clanRank: null } });

  // If was leader and no other members, delete the clan
  const remaining = await db.player.count({ where: { clanTag } });
  if (remaining === 0) {
    await db.clan.delete({ where: { tag: clanTag } }).catch(() => {});
  } else if (me.clanRank === 'Leader') {
    // promote the oldest member to Leader
    const oldest = await db.player.findFirst({
      where: { clanTag },
      orderBy: { createdAt: 'asc' },
    });
    if (oldest) {
      await db.player.update({ where: { id: oldest.id }, data: { clanRank: 'Leader' } });
    }
  }
  return NextResponse.json({ ok: true });
}
