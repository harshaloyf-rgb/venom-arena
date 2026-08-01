/**
 * GET /api/championship/my-status
 *
 * Returns the authenticated player's championship registration + projected summary.
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CHAMPIONSHIP_PRIZE_TIERS } from '@/lib/game-config';

const CURRENT_YEAR = 2026;
const MAX_GAMES = 10000;

function prizeForRank(rank: number) {
  if (rank === 1) return CHAMPIONSHIP_PRIZE_TIERS[0];
  if (rank <= 10) return CHAMPIONSHIP_PRIZE_TIERS[1];
  if (rank <= 50) return CHAMPIONSHIP_PRIZE_TIERS[2];
  if (rank <= 100) return CHAMPIONSHIP_PRIZE_TIERS[3];
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const player = await db.player.findUnique({
    where: { userTag: session.userTag },
    select: { id: true, name: true, userTag: true, bankedChips: true, country: true, clanTag: true, level: true, createdAt: true },
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  }

  const reg = await db.championshipRegistration.findUnique({
    where: { playerId_year: { playerId: player.id, year: CURRENT_YEAR } },
  });

  // Compute global rank among all registered players
  const rankRow = await db.championshipRegistration.findMany({
    where: { year: CURRENT_YEAR, isActive: true },
    include: { player: { select: { bankedChips: true, level: true, createdAt: true } } },
    orderBy: [
      { player: { bankedChips: 'desc' } },
      { player: { level: 'desc' } },
      { player: { createdAt: 'asc' } },
    ],
  });

  let rank = 0;
  for (let i = 0; i < rankRow.length; i++) {
    if (rankRow[i].playerId === player.id) { rank = i + 1; break; }
  }

  const prize = prizeForRank(rank);
  const remaining = reg ? MAX_GAMES - reg.gamesPlayed : MAX_GAMES;

  return NextResponse.json({
    registered: !!reg,
    isActive: reg?.isActive ?? false,
    gamesPlayed: reg?.gamesPlayed ?? 0,
    remaining,
    maxGames: MAX_GAMES,
    rank,
    bankedChips: player.bankedChips,
    prize: prize ? { chipsReward: prize.chipsReward, crownTitle: prize.crownTitle } : null,
    registeredAt: reg?.registeredAt?.toISOString() ?? null,
  });
}
