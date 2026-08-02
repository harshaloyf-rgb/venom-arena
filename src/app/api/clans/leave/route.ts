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

      // Log activity before removing
      await tx.clanActivity.create({
        data: {
          clanTag,
          type: 'leave',
          actorTag: me.userTag,
          actorName: me.name,
          detail: 'left the syndicate',
        },
      });

      // Remove player from clan (forfeit deposited chips)
      await tx.player.update({ where: { id: me.id }, data: { clanTag: null, clanRank: null, clanDeposited: 0 } });

      // Check remaining members and handle cleanup
      const remaining = await tx.player.count({ where: { clanTag } });
      if (remaining === 0) {
        await tx.clan.delete({ where: { tag: clanTag } });
      } else if (wasLeader) {
        // Promote oldest Co-Leader first, then oldest member
        const coLeader = await tx.player.findFirst({
          where: { clanTag, clanRank: 'Co-Leader' },
          orderBy: { createdAt: 'asc' },
        });
        const promotee = coLeader || await tx.player.findFirst({
          where: { clanTag },
          orderBy: { createdAt: 'asc' },
        });
        if (promotee) {
          await tx.player.update({ where: { id: promotee.id }, data: { clanRank: 'Leader' } });
          await tx.clanActivity.create({
            data: {
              clanTag,
              type: 'promote',
              actorTag: 'SYSTEM',
              actorName: 'System',
              detail: `promoted ${promotee.name} to Leader`,
            },
          });
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
