import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/kick  body: { targetTag }
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
      if (!['Leader', 'Co-Leader'].includes(me.clanRank || '')) throw new Error('NOT_LEADER');

      const target = await tx.player.findUnique({ where: { userTag: targetTag } });
      if (!target) throw new Error('TARGET_NOT_FOUND');
      if (target.clanTag !== me.clanTag) throw new Error('NOT_SAME_CLAN');
      if (target.id === me.id) throw new Error('CANNOT_KICK_SELF');
      if (target.clanRank === 'Leader') throw new Error('CANNOT_KICK_LEADER');
      if (me.clanRank === 'Co-Leader' && target.clanRank === 'Co-Leader') throw new Error('CANNOT_KICK_COLEADER');

      await tx.player.update({ where: { id: target.id }, data: { clanTag: null, clanRank: null, clanDeposited: 0 } });

      await tx.clanActivity.create({
        data: {
          clanTag: me.clanTag,
          type: 'leave',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `kicked ${target.name} from the syndicate`,
        },
      });

      const remaining = await tx.player.count({ where: { clanTag: me.clanTag } });
      if (remaining === 0) {
        await tx.clan.delete({ where: { tag: me.clanTag } });
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      NOT_IN_CLAN: { error: 'Not in a clan.', status: 400 },
      NOT_LEADER: { error: 'Only Leader or Co-Leader can kick members.', status: 403 },
      TARGET_NOT_FOUND: { error: 'Player not found.', status: 404 },
      NOT_SAME_CLAN: { error: 'Target is not in your clan.', status: 400 },
      CANNOT_KICK_SELF: { error: 'You cannot kick yourself.', status: 400 },
      CANNOT_KICK_LEADER: { error: 'Cannot kick the Leader.', status: 400 },
      CANNOT_KICK_COLEADER: { error: 'Co-Leader cannot kick other Co-Leaders.', status: 403 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/kick] error', e);
    return NextResponse.json({ error: 'Failed to kick member.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
