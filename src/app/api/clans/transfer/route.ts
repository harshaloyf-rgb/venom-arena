import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/transfer  body: { targetTag: string }  (Leader only)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetTag = String(body.targetTag || '').trim();

  if (!targetTag) {
    return NextResponse.json({ error: 'Missing target player tag.' }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me || !me.clanTag) throw new Error('NOT_IN_CLAN');
      if (me.clanRank !== 'Leader') throw new Error('NOT_LEADER');

      const target = await tx.player.findUnique({ where: { userTag: targetTag } });
      if (!target) throw new Error('TARGET_NOT_FOUND');
      if (target.clanTag !== me.clanTag) throw new Error('NOT_SAME_CLAN');
      if (target.clanRank !== 'Co-Leader') throw new Error('NOT_COLEADER');

      // Swap ranks: Leader → Co-Leader, target Co-Leader → Leader
      await tx.player.update({ where: { id: me.id }, data: { clanRank: 'Co-Leader' } });
      await tx.player.update({ where: { id: target.id }, data: { clanRank: 'Leader' } });

      // Log activity
      await tx.clanActivity.create({
        data: {
          clanTag: me.clanTag,
          type: 'promote',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `transferred leadership to ${target.name} [${target.userTag}]`,
        },
      });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      NOT_IN_CLAN: { error: 'Not in a clan.', status: 400 },
      NOT_LEADER: { error: 'Only the Leader can transfer leadership.', status: 403 },
      TARGET_NOT_FOUND: { error: 'Player not found.', status: 404 },
      NOT_SAME_CLAN: { error: 'Target is not in your clan.', status: 400 },
      NOT_COLEADER: { error: 'Target must be a Co-Leader.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/transfer] error', e);
    return NextResponse.json({ error: 'Failed to transfer leadership.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
