import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { utcMonday } from '@/lib/date-utils';

// POST /api/clans/join  body: { tag }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();

  let clanMaxMembers = 0;
  try {
    await db.$transaction(async (tx) => {
      const clan = await tx.clan.findUnique({ where: { tag }, include: { _count: { select: { members: true } } } });
      if (!clan) throw new Error('CLAN_NOT_FOUND');
      clanMaxMembers = clan.maxMembers;
      if (clan._count.members >= clan.maxMembers) throw new Error('CLAN_FULL');

      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (me.clanTag) throw new Error('ALREADY_IN_CLAN');

      await tx.player.update({ where: { id: me.id }, data: { clanTag: tag, clanRank: 'Viper', clanDeposited: 0 } });

      // Joining any clan makes all pending invites to this player moot
      await tx.clanInvite.updateMany({
        where: { inviteeId: me.id, status: 'pending' },
        data: { status: 'declined', respondedAt: new Date() },
      });

      // Log activity
      await tx.clanActivity.create({
        data: {
          clanTag: tag,
          type: 'join',
          actorTag: me.userTag,
          actorName: me.name,
          detail: 'joined the syndicate',
        },
      });

      // Update recruitment challenge progress for current week
      const weekStart = utcMonday();

      await tx.clanChallenge.updateMany({
        where: { clanTag: tag, type: 'recruitment_drive', weekStart, claimed: false },
        data: { progress: { increment: 1 } },
      });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
      CLAN_FULL: { error: `Clan is full (max ${clanMaxMembers}).`, status: 400 },
      PLAYER_NOT_FOUND: { error: 'Not found', status: 404 },
      ALREADY_IN_CLAN: { error: 'Leave your current clan first.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/join] error', e);
    return NextResponse.json({ error: 'Failed to join clan.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
