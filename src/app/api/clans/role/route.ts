import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/role  body: { targetTag, action: 'promote' | 'demote' }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetTag = String(body.targetTag || '').trim();
  const action = String(body.action || '').trim();

  if (!targetTag || !['promote', 'demote'].includes(action)) {
    return NextResponse.json({ error: 'Invalid targetTag or action.' }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (!me.clanTag) throw new Error('NO_CLAN');
      if (me.clanRank !== 'Leader') throw new Error('NOT_LEADER');

      const target = await tx.player.findUnique({ where: { userTag: targetTag } });
      if (!target) throw new Error('TARGET_NOT_FOUND');
      if (target.userTag === me.userTag) throw new Error('SELF_ACTION');
      if (target.clanTag !== me.clanTag) throw new Error('NOT_SAME_CLAN');

      if (action === 'promote') {
        if (target.clanRank !== 'Viper') throw new Error('NOT_VIPER');

        const coLeaderCount = await tx.player.count({
          where: { clanTag: me.clanTag, clanRank: 'Co-Leader' },
        });
        if (coLeaderCount >= 2) throw new Error('MAX_CO_LEADERS');

        await tx.player.update({
          where: { id: target.id },
          data: { clanRank: 'Co-Leader' },
        });

        await tx.clanActivity.create({
          data: {
            clanTag: me.clanTag,
            type: 'promote',
            actorTag: me.userTag,
            actorName: me.name,
            detail: `promoted ${target.name} to Co-Leader`,
          },
        });
      } else {
        if (target.clanRank !== 'Co-Leader') throw new Error('NOT_CO_LEADER');

        await tx.player.update({
          where: { id: target.id },
          data: { clanRank: 'Viper' },
        });

        await tx.clanActivity.create({
          data: {
            clanTag: me.clanTag,
            type: 'demote',
            actorTag: me.userTag,
            actorName: me.name,
            detail: `demoted ${target.name} to Viper`,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      NO_CLAN: { error: 'You are not in a clan.', status: 403 },
      NOT_LEADER: { error: 'Only the Leader can promote or demote members.', status: 403 },
      TARGET_NOT_FOUND: { error: 'Target player not found.', status: 404 },
      SELF_ACTION: { error: 'You cannot promote or demote yourself.', status: 400 },
      NOT_SAME_CLAN: { error: 'Target is not in your clan.', status: 403 },
      NOT_VIPER: { error: 'Only Vipers can be promoted to Co-Leader.', status: 400 },
      NOT_CO_LEADER: { error: 'Only Co-Leaders can be demoted to Viper.', status: 400 },
      MAX_CO_LEADERS: { error: 'Maximum of 2 Co-Leaders reached.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/role] error', e);
    return NextResponse.json({ error: 'Role change failed.' }, { status: 500 });
  }
}
