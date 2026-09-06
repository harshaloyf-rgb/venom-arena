import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { utcMonday } from '@/lib/date-utils';
import { ensureWeeklyChallenges } from '@/lib/clan-weekly';

// POST /api/clans/invites/respond  body: { inviteId, action: 'accept' | 'decline' }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const inviteId = String(body.inviteId || '').trim();
  const action = String(body.action || '').trim().toLowerCase();
  if (!inviteId || (action !== 'accept' && action !== 'decline')) {
    return NextResponse.json({ error: 'Invalid invite or action.' }, { status: 400 });
  }

  let clanName = '';
  let clanTagJoined = '';

  try {
    await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');

      const invite = await tx.clanInvite.findUnique({ where: { id: inviteId } });
      if (!invite || invite.inviteeId !== me.id) throw new Error('INVITE_NOT_FOUND');
      if (invite.status !== 'pending') throw new Error('NOT_PENDING');

      const clan = await tx.clan.findUnique({
        where: { tag: invite.clanTag },
        include: { _count: { select: { members: true } } },
      });
      if (!clan) throw new Error('CLAN_NOT_FOUND');

      if (action === 'decline') {
        await tx.clanInvite.update({
          where: { id: invite.id },
          data: { status: 'declined', respondedAt: new Date() },
        });
        return;
      }

      // ── accept ──
      if (me.clanTag) {
        // Stale invite — you already joined another clan. Self-heal by declining.
        await tx.clanInvite.update({
          where: { id: invite.id },
          data: { status: 'declined', respondedAt: new Date() },
        });
        throw new Error('ALREADY_IN_CLAN');
      }
      if (clan._count.members >= clan.maxMembers) throw new Error('CLAN_FULL');

      await tx.player.update({
        where: { id: me.id },
        data: { clanTag: clan.tag, clanRank: 'Viper', clanDeposited: 0 },
      });
      await tx.clanInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', respondedAt: new Date() },
      });
      // You joined a clan — every other pending invite AND join request is now moot
      await tx.clanInvite.updateMany({
        where: { inviteeId: me.id, status: 'pending', id: { not: invite.id } },
        data: { status: 'declined', respondedAt: new Date() },
      });
      await tx.clanJoinRequest.updateMany({
        where: { playerId: me.id, status: 'pending' },
        data: { status: 'declined', respondedAt: new Date() },
      });

      await tx.clanActivity.create({
        data: {
          clanTag: clan.tag,
          type: 'join',
          actorTag: me.userTag,
          actorName: me.name,
          detail: 'joined the syndicate',
        },
      });

      // Joining counts toward the Recruitment Drive challenge (same as open join)
      const weekStart = utcMonday();
      // T50 (BUG 2): ensure the weekly rows exist so pre-GET joins count.
      await ensureWeeklyChallenges(tx, clan.tag, weekStart);
      await tx.clanChallenge.updateMany({
        where: { clanTag: clan.tag, type: 'recruitment_drive', weekStart, claimed: false },
        data: { progress: { increment: 1 } },
      });

      clanName = clan.name;
      clanTagJoined = clan.tag;
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      INVITE_NOT_FOUND: { error: 'Invite not found.', status: 404 },
      NOT_PENDING: { error: 'This invite was already handled.', status: 400 },
      CLAN_NOT_FOUND: { error: 'That syndicate no longer exists.', status: 404 },
      ALREADY_IN_CLAN: { error: 'You are already in a syndicate.', status: 400 },
      CLAN_FULL: { error: 'That syndicate is now full.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/invites/respond] error', e);
    return NextResponse.json({ error: 'Failed to respond to invite.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, clanTag: clanTagJoined, clanName });
}
