import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

const MAX_PENDING_REQUESTS = 30;

// POST /api/clans/join  body: { tag }
// Sends a JOIN REQUEST to the clan — the Leader/Co-Leader must accept it
// before you actually become a member. See /api/clans/join-requests/respond.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();

  try {
    const result = await db.$transaction(async (tx) => {
      const clan = await tx.clan.findUnique({ where: { tag }, include: { _count: { select: { members: true } } } });
      if (!clan) throw new Error('CLAN_NOT_FOUND');
      if (clan._count.members >= clan.maxMembers) throw new Error('CLAN_FULL');

      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (me.clanTag) throw new Error('ALREADY_IN_CLAN');

      // One pending request per clan per player
      const existing = await tx.clanJoinRequest.findFirst({
        where: { clanTag: tag, playerId: me.id, status: 'pending' },
      });
      if (existing) throw new Error('ALREADY_REQUESTED');

      // If this clan already invited you, accepting the invite is the move —
      // a join request would be redundant and confusing.
      const pendingInvite = await tx.clanInvite.findFirst({
        where: { clanTag: tag, inviteeId: me.id, status: 'pending' },
      });
      if (pendingInvite) throw new Error('INVITE_PENDING');

      // Bound pending requests per clan so they can't pile up unbounded
      const pendingCount = await tx.clanJoinRequest.count({ where: { clanTag: tag, status: 'pending' } });
      if (pendingCount >= MAX_PENDING_REQUESTS) throw new Error('TOO_MANY_PENDING');

      await tx.clanJoinRequest.create({
        data: { clanTag: tag, playerId: me.id },
      });

      // Activity feed entry so leaders/members can see the request came in
      await tx.clanActivity.create({
        data: {
          clanTag: tag,
          type: 'request',
          actorTag: me.userTag,
          actorName: me.name,
          detail: 'requested to join the syndicate',
        },
      });

      return { clanName: clan.name };
    });

    return NextResponse.json({ ok: true, clanName: result.clanName });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
      CLAN_FULL: { error: 'That syndicate is full — no space to request.', status: 400 },
      PLAYER_NOT_FOUND: { error: 'Not found', status: 404 },
      ALREADY_IN_CLAN: { error: 'Leave your current clan first.', status: 400 },
      ALREADY_REQUESTED: { error: 'You already have a pending request for this syndicate.', status: 409 },
      INVITE_PENDING: { error: 'This syndicate already invited you — check My Clan and accept the invite instead.', status: 409 },
      TOO_MANY_PENDING: { error: `This syndicate has too many pending requests (max ${MAX_PENDING_REQUESTS}). Try again later.`, status: 429 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/join] error', e);
    return NextResponse.json({ error: 'Failed to send join request.' }, { status: 500 });
  }
}
