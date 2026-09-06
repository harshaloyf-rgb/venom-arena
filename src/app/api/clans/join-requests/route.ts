import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/clans/join-requests
//   incoming — pending requests TO my clan (Leader/Co-Leader only, else empty)
//   outgoing — MY pending join requests (only while clanless)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const me = await db.player.findUnique({
    where: { id: session.playerId },
    select: { id: true, clanTag: true, clanRank: true, userTag: true },
  });
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const canManage = me.clanRank === 'Leader' || me.clanRank === 'Co-Leader';

  // Incoming requests only matter if you lead a clan.
  const incoming = canManage && me.clanTag
    ? await db.clanJoinRequest.findMany({
        where: { clanTag: me.clanTag, status: 'pending' },
        orderBy: { createdAt: 'asc' },
        include: { player: { select: { userTag: true, name: true, country: true, level: true, bankedChips: true } } },
      })
    : [];

  // Outgoing requests only matter while clanless — joining any clan
  // (invite accept / request accept / founding) auto-declines them.
  const outgoing = !me.clanTag
    ? await db.clanJoinRequest.findMany({
        where: { playerId: me.id, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        include: { clan: { select: { tag: true, name: true } } },
      })
    : [];

  return NextResponse.json({
    incoming: incoming.map((r) => ({
      id: r.id,
      clanTag: r.clanTag,
      userTag: r.player.userTag,
      name: r.player.name,
      country: r.player.country,
      level: r.player.level,
      bankedChips: r.player.bankedChips,
      createdAt: r.createdAt.toISOString(),
    })),
    outgoing: outgoing.map((r) => ({
      id: r.id,
      clanTag: r.clanTag,
      clanName: r.clan.name,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// DELETE /api/clans/join-requests  body: { requestId } — cancel my own pending request
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const requestId = String(body.requestId || '').trim();
  if (!requestId) return NextResponse.json({ error: 'Missing request.' }, { status: 400 });

  const request = await db.clanJoinRequest.findUnique({ where: { id: requestId } });
  if (!request || request.playerId !== session.playerId) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  }
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'This request was already handled.' }, { status: 400 });
  }

  await db.clanJoinRequest.update({
    where: { id: request.id },
    data: { status: 'declined', respondedAt: new Date(), respondedBy: 'self-cancel' },
  });

  return NextResponse.json({ ok: true });
}
