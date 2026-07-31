import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { milestoneTierForChips } from '@/lib/game-config';

// GET /api/leaderboard/my-rank
// Returns the authenticated player's rank summary
export async function GET() {
  const session = await getSession();
  if (!session?.userTag) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const player = await db.player.findUnique({
    where: { userTag: session.userTag },
    select: { userTag: true, country: true, bankedChips: true, level: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Run all 4 count queries in parallel
  const [globalRank, nationalRank, totalGlobal, totalNational] = await Promise.all([
    // Global rank: count players with MORE bankedChips + 1
    db.player.count({
      where: { banned: false, bankedChips: { gt: player.bankedChips } },
    }).then((c) => c + 1),
    // National rank: count in same country with more chips + 1
    db.player.count({
      where: { banned: false, country: player.country, bankedChips: { gt: player.bankedChips } },
    }).then((c) => c + 1),
    // Total players for context
    db.player.count({ where: { banned: false } }),
    db.player.count({
      where: { banned: false, country: player.country },
    }),
  ]);

  const tier = milestoneTierForChips(player.bankedChips);

  return NextResponse.json({
    globalRank,
    nationalRank,
    country: player.country,
    bankedChips: player.bankedChips,
    level: player.level,
    tier: tier.badge,
    tierName: tier.name,
    totalGlobal,
    totalNational,
  });
}
