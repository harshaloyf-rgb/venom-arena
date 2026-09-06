import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/hof/inductees?type=milestone|championship&year=2026&milestoneTier=t-1lakh&badge=crown&search=Hari&limit=50
export async function GET(req: Request) {
  try {
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

  // Search on player name, tag, or clan tag (SQLite LIKE is ASCII case-insensitive)
  if (playerTag) {
    where.player = { userTag: playerTag };
  } else if (search) {
    where.player = {
      OR: [
        { name: { contains: search } },
        { userTag: { contains: search } },
        { clanTag: { contains: search } },
      ],
    };
  }

  // Ordering matches how each wing presents rows:
  // - Milestones Wing: induction order (earliest first) — "#1 is the first to
  //   achieve that tier", matching the on-page claim and the First! pill.
  // - Champions Wing: latest year first, then by stored championship rank so
  //   each year reads #1, #2, #3… instead of arbitrary induction timestamps.
  const orderBy: Array<Record<string, string>> =
    type === 'milestone'
      ? [{ inductedAt: 'asc' }, { id: 'asc' }]
      : type === 'championship'
        ? [{ championshipYear: 'desc' }, { championshipRank: 'asc' }, { inductedAt: 'asc' }]
        : [{ inductedAt: 'desc' }];

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
      orderBy,
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
  } catch (e) {
    console.error('[hof/inductees] error', e);
    return NextResponse.json(
      { error: 'Could not load Hall of Fame (database error). If this persists, the server needs the latest schema migration (npx prisma db push).' },
      { status: 500 },
    );
  }
}
