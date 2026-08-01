import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/hof/inductees?type=milestone|championship&year=2026&milestoneTier=t-1lakh&badge=crown&search=Hari&limit=50
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || '';       // milestone | championship
  const year = url.searchParams.get('year');               // championship year filter
  const milestoneTier = url.searchParams.get('milestoneTier'); // milestone tier ID
  const badge = url.searchParams.get('badge');             // badge filter
  const search = url.searchParams.get('search')?.trim().toLowerCase() || '';
  const playerTag = url.searchParams.get('playerTag')?.trim() || '';
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  // Build where clause
  const where: Record<string, unknown> = {};
  if (type) where.inductionType = type;
  if (year) where.championshipYear = parseInt(year, 10);
  if (milestoneTier) where.milestoneTierId = milestoneTier;
  if (badge) where.hofBadge = badge;

  // Search on player name or tag
  if (playerTag) {
    where.player = { userTag: playerTag };
  } else if (search) {
    where.player = { name: { contains: search } };
  }

  const [entries, total] = await Promise.all([
    db.hallOfFameEntry.findMany({
      where,
      include: {
        player: {
          select: {
            userTag: true, name: true, country: true, level: true, clanTag: true,
          },
        },
      },
      orderBy: { inductedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.hallOfFameEntry.count({ where }),
  ]);

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      playerId: e.playerId,
      playerTag: e.player.userTag,
      playerName: e.player.name,
      country: e.player.country,
      level: e.player.level,
      clanTag: e.player.clanTag,
      inductionType: e.inductionType,
      milestoneTierId: e.milestoneTierId,
      championshipYear: e.championshipYear,
      championshipRank: e.championshipRank,
      hofBadge: e.hofBadge,
      title: e.title,
      chipsAtInduction: e.chipsAtInduction,
      inductedAt: e.inductedAt.toISOString(),
    })),
    total,
    limit,
    offset,
  });
}
