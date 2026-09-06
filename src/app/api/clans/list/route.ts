import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/clans — list all clans with member counts
export async function GET() {
  const clans = await db.clan.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { bankedChips: 'desc' },
    take: 50,
  });
  return NextResponse.json({
    clans: clans.map((c) => ({
      tag: c.tag,
      name: c.name,
      emblem: c.emblem,
      description: c.description,
      level: c.level,
      xp: c.xp,
      totalDeposited: c.totalDeposited,
      bankedChips: c.bankedChips,
      maxMembers: c.maxMembers,
      memberCount: c._count.members,
    })),
  });
}
