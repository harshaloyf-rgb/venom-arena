import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/admin/clans?search=xxx&limit=20
// Admin-only. Returns all clans sorted by totalDeposited desc.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  let limit = parseInt(searchParams.get('limit') || '20', 10);
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 50) limit = 50;

  const whereClause: Record<string, unknown> = {};
  if (search) {
    whereClause.OR = [
      { name: { contains: search } },
      { tag: { contains: search.toUpperCase() } },
    ];
  }

  const [clans, total] = await Promise.all([
    db.clan.findMany({
      where: whereClause,
      select: {
        tag: true,
        name: true,
        emblem: true,
        description: true,
        level: true,
        xp: true,
        totalDeposited: true,
        bankedChips: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { totalDeposited: 'desc' },
      take: limit,
    }),
    db.clan.count({ where: whereClause }),
  ]);

  const clansWithCount = clans.map((clan) => ({
    tag: clan.tag,
    name: clan.name,
    emblem: clan.emblem,
    description: clan.description,
    level: clan.level,
    xp: clan.xp,
    totalDeposited: clan.totalDeposited,
    bankedChips: clan.bankedChips,
    memberCount: clan._count.members,
    createdAt: clan.createdAt,
  }));

  return NextResponse.json({ clans: clansWithCount, total });
}
