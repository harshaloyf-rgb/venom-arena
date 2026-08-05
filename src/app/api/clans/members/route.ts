import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

const RANK_ORDER: Record<string, number> = {
  Leader: 0,
  'Co-Leader': 1,
  Viper: 2,
};

// GET /api/clans/members?tag=APEX
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tag = String(req.nextUrl.searchParams.get('tag') || '').toUpperCase().trim();
  if (!tag) {
    return NextResponse.json({ error: 'Missing clan tag.' }, { status: 400 });
  }

  try {
    // Verify the requesting player belongs to this clan
    const me = await db.player.findUnique({
      where: { id: session.playerId },
      select: { clanTag: true },
    });
    if (!me || me.clanTag !== tag) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const players = await db.player.findMany({
      where: { clanTag: tag },
      select: {
        userTag: true,
        name: true,
        country: true,
        level: true,
        bankedChips: true,
        clanRank: true,
        avatar: true,
        lastSeenAt: true,
      },
    });

    // Sort by rank (Leader → Co-Leader → Viper), then bankedChips desc
    const members = players.sort((a, b) => {
      const rankA = RANK_ORDER[a.clanRank ?? 'Viper'] ?? 2;
      const rankB = RANK_ORDER[b.clanRank ?? 'Viper'] ?? 2;
      if (rankA !== rankB) return rankA - rankB;
      return (b.bankedChips ?? 0) - (a.bankedChips ?? 0);
    });

    return NextResponse.json({ members });
  } catch (e) {
    console.error('[clans/members] error', e);
    return NextResponse.json({ error: 'Failed to fetch members.' }, { status: 500 });
  }
}
