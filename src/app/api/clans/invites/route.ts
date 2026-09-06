import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/clans/invites — my pending syndicate invites (newest first)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const me = await db.player.findUnique({
    where: { id: session.playerId },
    select: { id: true, clanTag: true },
  });
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Invites only matter while clanless — once you're in a clan they are
  // auto-declined by join/accept/create, so nothing should be pending here.
  if (me.clanTag) return NextResponse.json({ invites: [], count: 0 });

  const invites = await db.clanInvite.findMany({
    where: { inviteeId: me.id, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    include: {
      clan: {
        include: { _count: { select: { members: true } } },
      },
    },
  });

  return NextResponse.json({
    count: invites.length,
    invites: invites.map((inv) => ({
      id: inv.id,
      clanTag: inv.clanTag,
      clanName: inv.clan.name,
      clanEmblem: inv.clan.emblem,
      clanDescription: inv.clan.description,
      clanLevel: inv.clan.level,
      memberCount: inv.clan._count.members,
      maxMembers: inv.clan.maxMembers,
      invitedByTag: inv.invitedByTag,
      invitedByName: inv.invitedByName,
      createdAt: inv.createdAt.toISOString(),
    })),
  });
}
