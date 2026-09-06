import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { utcMonday } from '@/lib/date-utils';
import { ensureWeeklyChallenges } from '@/lib/clan-weekly';

// POST /api/clans/join-requests/respond  body: { requestId, action: 'accept' | 'decline' }
// Leader/Co-Leader accepts or declines a player's request to join their clan.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const requestId = String(body.requestId || '').trim();
  const action = String(body.action || '').trim().toLowerCase();
  if (!requestId || (action !== 'accept' && action !== 'decline')) {
    return NextResponse.json({ error: 'Invalid request or action.' }, { status: 400 });
  }

  let requesterName = '';
  let clanTagHandled = '';
  let clanNameHandled = '';

  try {
    await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');

      const request = await tx.clanJoinRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new Error('REQUEST_NOT_FOUND');
      if (request.status !== 'pending') throw new Error('NOT_PENDING');

      const clan = await tx.clan.findUnique({
        where: { tag: request.clanTag },
        include: { _count: { select: { members: true } } },
      });
      if (!clan) throw new Error('CLAN_NOT_FOUND');

      // Only the Leader or Co-Leader of THAT clan can respond
      if (me.clanTag !== clan.tag || (me.clanRank !== 'Leader' && me.clanRank !== 'Co-Leader')) {
        throw new Error('NOT_LEADER');
      }

      const requester = await tx.player.findUnique({ where: { id: request.playerId } });
      if (!requester) throw new Error('PLAYER_NOT_FOUND');

      if (action === 'decline') {
        await tx.clanJoinRequest.update({
          where: { id: request.id },
          data: { status: 'declined', respondedAt: new Date(), respondedBy: me.userTag },
        });
        requesterName = requester.name;
        clanTagHandled = clan.tag;
        clanNameHandled = clan.name;
        return;
      }

      // ── accept ──
      if (requester.clanTag) {
        // Stale request — they already joined another clan. Self-heal by declining.
        await tx.clanJoinRequest.update({
          where: { id: request.id },
          data: { status: 'declined', respondedAt: new Date(), respondedBy: me.userTag },
        });
        throw new Error('ALREADY_IN_CLAN');
      }
      if (clan._count.members >= clan.maxMembers) throw new Error('CLAN_FULL');

      await tx.player.update({
        where: { id: requester.id },
        data: { clanTag: clan.tag, clanRank: 'Viper', clanDeposited: 0 },
      });
      await tx.clanJoinRequest.update({
        where: { id: request.id },
        data: { status: 'accepted', respondedAt: new Date(), respondedBy: me.userTag },
      });
      // They joined a clan — every other pending request/invite is now moot
      await tx.clanJoinRequest.updateMany({
        where: { playerId: requester.id, status: 'pending', id: { not: request.id } },
        data: { status: 'declined', respondedAt: new Date() },
      });
      await tx.clanInvite.updateMany({
        where: { inviteeId: requester.id, status: 'pending' },
        data: { status: 'declined', respondedAt: new Date() },
      });

      await tx.clanActivity.create({
        data: {
          clanTag: clan.tag,
          type: 'join',
          actorTag: requester.userTag,
          actorName: requester.name,
          detail: `joined the syndicate (approved by ${me.name})`,
        },
      });

      // Approving counts toward the Recruitment Drive challenge (same as other join paths)
      const weekStart = utcMonday();
      // T50 (BUG 2): ensure the weekly rows exist so pre-GET joins count.
      await ensureWeeklyChallenges(tx, clan.tag, weekStart);
      await tx.clanChallenge.updateMany({
        where: { clanTag: clan.tag, type: 'recruitment_drive', weekStart, claimed: false },
        data: { progress: { increment: 1 } },
      });

      requesterName = requester.name;
      clanTagHandled = clan.tag;
      clanNameHandled = clan.name;
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      REQUEST_NOT_FOUND: { error: 'Join request not found.', status: 404 },
      NOT_PENDING: { error: 'This request was already handled.', status: 400 },
      CLAN_NOT_FOUND: { error: 'That syndicate no longer exists.', status: 404 },
      NOT_LEADER: { error: 'Only the Leader or Co-Leader can respond to join requests.', status: 403 },
      ALREADY_IN_CLAN: { error: 'That player already joined another syndicate.', status: 400 },
      CLAN_FULL: { error: 'Your syndicate is now full.', status: 400 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/join-requests/respond] error', e);
    return NextResponse.json({ error: 'Failed to respond to join request.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, clanTag: clanTagHandled, clanName: clanNameHandled, requesterName });
}
