import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { findPlayerByTag } from '@/lib/player-lookup';

const MAX_PENDING_INVITES = 30;

// POST /api/clans/invite  body: { userTag }  — any clan member invites a player to their clan
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const userTag = String(body.userTag || '').trim(); // player tags are lowercase (VM-xxxxxx); lookup is case-insensitive
  if (!userTag) return NextResponse.json({ error: 'Enter a player VM tag.' }, { status: 400 });

  // Resolve invitee by tag (case-insensitive fallback) BEFORE the transaction —
  // the tx client can't use the shared helper.
  const invitee = await findPlayerByTag(userTag);
  if (!invitee) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  try {
    const result = await db.$transaction(async (tx) => {
      const me = await tx.player.findUnique({ where: { id: session.playerId } });
      if (!me) throw new Error('PLAYER_NOT_FOUND');
      if (!me.clanTag) throw new Error('NOT_IN_CLAN');
      const clanTag = me.clanTag;

      const clan = await tx.clan.findUnique({
        where: { tag: clanTag },
        include: { _count: { select: { members: true } } },
      });
      if (!clan) throw new Error('CLAN_NOT_FOUND');
      if (clan._count.members >= clan.maxMembers) throw new Error('CLAN_FULL');

      if (invitee.id === me.id) throw new Error('ALREADY_MEMBER');
      if (invitee.clanTag) throw new Error('TARGET_IN_CLAN');

      // One pending invite per clan per player
      const existing = await tx.clanInvite.findFirst({
        where: { clanTag, inviteeId: invitee.id, status: 'pending' },
      });
      if (existing) throw new Error('ALREADY_INVITED');

      // Bound pending invites per clan so invites can't pile up unbounded
      const pendingCount = await tx.clanInvite.count({ where: { clanTag, status: 'pending' } });
      if (pendingCount >= MAX_PENDING_INVITES) throw new Error('TOO_MANY_PENDING');

      await tx.clanInvite.create({
        data: {
          clanTag,
          inviteeId: invitee.id,
          invitedByTag: me.userTag,
          invitedByName: me.name,
        },
      });

      // Activity feed entry so members can see recruitment happening
      await tx.clanActivity.create({
        data: {
          clanTag,
          type: 'invite',
          actorTag: me.userTag,
          actorName: me.name,
          detail: `invited ${invitee.name} to join`,
        },
      });

      return { inviteeName: invitee.name, clanTag };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorMap: Record<string, { error: string; status: number }> = {
      PLAYER_NOT_FOUND: { error: 'Not found.', status: 404 },
      NOT_IN_CLAN: { error: 'Join a syndicate first.', status: 400 },
      CLAN_NOT_FOUND: { error: 'Clan not found.', status: 404 },
      CLAN_FULL: { error: 'Syndicate is full — no space to invite.', status: 400 },
      ALREADY_MEMBER: { error: 'That player is already in your syndicate.', status: 400 },
      TARGET_IN_CLAN: { error: 'That player is already in a syndicate.', status: 400 },
      ALREADY_INVITED: { error: 'Invite already pending for this player.', status: 409 },
      TOO_MANY_PENDING: { error: `Too many pending invites (max ${MAX_PENDING_INVITES}). Wait for players to respond.`, status: 429 },
    };
    if (msg in errorMap) {
      const { error, status } = errorMap[msg];
      return NextResponse.json({ error }, { status });
    }
    console.error('[clans/invite] error', e);
    return NextResponse.json({ error: 'Failed to send invite.' }, { status: 500 });
  }
}
