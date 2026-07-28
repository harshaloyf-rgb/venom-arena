import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { LeaderboardEntry } from '@/lib/types';

// GET /api/leaderboard?type=chips|level&limit=50
export async function GET(req: NextRequest) {
  const session = await getSession();
  const url = new URL(req.url);
  const type = url.searchParams.get('type') === 'level' ? 'level' : 'bankedChips';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const players = await db.player.findMany({
    where: { banned: false },
    orderBy: { [type]: 'desc' },
    take: limit,
    select: {
      userTag: true,
      name: true,
      country: true,
      bankedChips: true,
      level: true,
    },
  });

  const entries: LeaderboardEntry[] = players.map((p, i) => ({
    userTag: p.userTag,
    name: p.name,
    country: p.country,
    bankedChips: p.bankedChips,
    level: p.level,
    rank: i + 1,
    isPlayer: session?.userTag === p.userTag,
  }));

  return NextResponse.json({ entries });
}
