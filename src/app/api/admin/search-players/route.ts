import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/admin/search-players?q=<query>&banned=true&limit=20
// Admin-only. Searches players by name or userTag (case-insensitive contains).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const bannedParam = searchParams.get('banned');
  let limit = parseInt(searchParams.get('limit') || '20', 10);
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 50) limit = 50;

  const whereClause: Record<string, unknown> = {};

  if (q) {
    whereClause.OR = [
      { name: { contains: q } },
      { userTag: { contains: q.toUpperCase() } },
    ];
  }

  if (bannedParam === 'true') {
    whereClause.banned = true;
  } else if (bannedParam === 'false') {
    whereClause.banned = false;
  }

  const [players, total] = await Promise.all([
    db.player.findMany({
      where: whereClause,
      select: {
        id: true,
        userTag: true,
        name: true,
        country: true,
        avatar: true,
        role: true,
        banned: true,
        bankedChips: true,
        level: true,
        clanTag: true,
        clanRank: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
      take: limit,
    }),
    db.player.count({ where: whereClause }),
  ]);

  return NextResponse.json({ players, total });
}
