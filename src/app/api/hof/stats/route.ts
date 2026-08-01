import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/hof/stats
// Returns aggregate HOF statistics for the public display.
export async function GET() {
  const [totalInductees, byType, milestoneFirsts, milestoneCounts, championshipYears] = await Promise.all([
    // Total unique players inducted
    db.hallOfFameEntry.groupBy({
      by: ['playerId'],
      _count: true,
    }),
    // Count by induction type
    db.hallOfFameEntry.groupBy({
      by: ['inductionType'],
      _count: true,
    }),
    // First inductee per milestone tier (earliest inductedAt)
    db.hallOfFameEntry.findMany({
      where: { inductionType: 'milestone' },
      include: { player: { select: { userTag: true, name: true, country: true } } },
      orderBy: { inductedAt: 'asc' },
    }),
    // Count per milestone tier
    db.hallOfFameEntry.groupBy({
      by: ['milestoneTierId'],
      where: { inductionType: 'milestone', milestoneTierId: { not: null } },
      _count: true,
    }),
    // Distinct championship years that have entries
    db.hallOfFameEntry.groupBy({
      by: ['championshipYear'],
      where: { inductionType: 'championship', championshipYear: { not: null } },
      _count: true,
    }),
  ]);

  // Build milestone first-achievers map
  const firstAchieverMap: Record<string, { playerName: string; userTag: string; country: string; inductedAt: string } | null> = {};
  for (const entry of milestoneFirsts) {
    const tierId = entry.milestoneTierId;
    if (tierId && !firstAchieverMap[tierId]) {
      firstAchieverMap[tierId] = {
        playerName: entry.player.name,
        userTag: entry.player.userTag,
        country: entry.player.country,
        inductedAt: entry.inductedAt.toISOString(),
      };
    }
  }

  // Build milestone count map: { 't-1lakh': 42, 't-5lakh': 12, ... }
  const milestoneCountMap: Record<string, number> = {};
  for (const g of milestoneCounts) {
    if (g.milestoneTierId) {
      milestoneCountMap[g.milestoneTierId] = g._count;
    }
  }

  return NextResponse.json({
    totalInductedPlayers: totalInductees.length,
    totalEntries: totalInductees.reduce((sum, g) => sum + g._count, 0),
    byType: Object.fromEntries(byType.map((g) => [g.inductionType, g._count])),
    milestoneFirstAchievers: firstAchieverMap,
    milestoneCounts: milestoneCountMap,
    championshipYears: championshipYears.map((g) => ({
      year: g.championshipYear,
      inducteeCount: g._count,
    })),
  });
}
