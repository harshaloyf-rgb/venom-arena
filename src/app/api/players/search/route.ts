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
  const [players, total] = await Promise.all([
    db.player.findMany({
      where,
      select: {
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
  }));

  return NextResponse.json({ players: results, total });
  } catch (e) {
    console.error('[players/search] error', e);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}
