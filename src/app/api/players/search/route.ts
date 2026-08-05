import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/players/search?query=...&country=...&limit=...&offset=...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const query = searchParams.get('query')?.trim() || '';
  const countryParam = searchParams.get('country')?.trim() || '';
  const limitRaw = searchParams.get('limit');
  const offsetRaw = searchParams.get('offset');

  const limit = Math.min(50, Math.max(1, Number(limitRaw) || 20));
  const offset = Math.max(0, Number(offsetRaw) || 0);

  // Build where clause
  const conditions: any[] = [{ id: { not: session.playerId } }];

  // Exclude blocked players
  const blockedIds = await db.friendship.findMany({
    where: {
      OR: [
        { initiatorId: session.playerId, status: 'blocked' },
        { recipientId: session.playerId, status: 'blocked' },
      ],
    },
    select: {
      initiatorId: true,
      recipientId: true,
    },
  });
  const blockedPlayerIds = new Set(
    blockedIds.flatMap((b) =>
      b.initiatorId === session.playerId ? [b.recipientId] : [b.initiatorId],
    ),
  );
  if (blockedPlayerIds.size > 0) {
    conditions.push({ id: { notIn: Array.from(blockedPlayerIds) } });
  }

  if (query) {
    conditions.push({
      OR: [
        { userTag: { contains: query } },
        { name: { contains: query } },
      ],
    });
  }

  if (countryParam && countryParam !== 'ALL') {
    conditions.push({ country: countryParam });
  }

  const where = { AND: conditions };

  const orderBy = query
    ? { bankedChips: 'desc' as const }
    : { lastSeenAt: 'desc' as const };

  try {
  // Fetch existing friendships to annotate search results
  const friendships = await db.friendship.findMany({
    where: {
      OR: [
        { initiatorId: session.playerId },
        { recipientId: session.playerId },
      ],
      status: { in: ['accepted', 'pending'] },
    },
    select: {
      initiatorId: true,
      recipientId: true,
      status: true,
    },
  });

  // Build a map: playerId -> relation
  const pid = session.playerId;
  const relationMap = new Map<string, string>();
  for (const f of friendships) {
    const otherId = f.initiatorId === pid ? f.recipientId : f.initiatorId;
    if (f.status === 'accepted') {
      relationMap.set(otherId, 'friend');
    } else if (f.initiatorId === pid) {
      relationMap.set(otherId, 'pending_sent');
    } else {
      relationMap.set(otherId, 'pending_received');
    }
  }

  const [players, total] = await Promise.all([
    db.player.findMany({
      where,
      select: {
        id: true,
        userTag: true,
        name: true,
        country: true,
        level: true,
        bankedChips: true,
        clanTag: true,
        lastSeenAt: true,
        avatar: true,
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    db.player.count({ where }),
  ]);

  const results = players.map((p) => ({
    userTag: p.userTag,
    name: p.name,
    country: p.country,
    level: p.level,
    bankedChips: p.bankedChips,
    clanTag: p.clanTag,
    lastSeenAt: p.lastSeenAt,
    avatar: p.avatar,
    online: Date.now() - new Date(p.lastSeenAt).getTime() < 5 * 60 * 1000,
    relation: (relationMap.get(p.id) as string) || 'none',
  }));

  return NextResponse.json({ players: results, total });
  } catch (e) {
    console.error('[players/search] error', e);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}
