import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { HALL_OF_FAME_TIERS } from '@/lib/game-config';

// GET /api/hof/my-entries
// Returns the authenticated player's HOF entries, plus next-milestone hint.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const player = await db.player.findUnique({
    where: { id: session.playerId },
    select: { id: true, bankedChips: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const entries = await db.hallOfFameEntry.findMany({
    where: { playerId: player.id },
    orderBy: { inductedAt: 'desc' },
  });

  // Determine next milestone to aim for
  let nextMilestone: { name: string; badge: string; chips: number; chipsNeeded: number } | null = null;
  for (const tier of HALL_OF_FAME_TIERS) {
    if (player.bankedChips < tier.chips) {
      nextMilestone = {
        name: tier.name,
        badge: tier.badge,
        chips: tier.chips,
        chipsNeeded: tier.chips - player.bankedChips,
      };
      break;
    }
  }

  // Group by type
  const milestoneEntries = entries.filter((e) => e.inductionType === 'milestone');
  const championshipEntries = entries.filter((e) => e.inductionType === 'championship');

  return NextResponse.json({
    totalEntries: entries.length,
    milestoneEntries: milestoneEntries.map(formatEntry),
    championshipEntries: championshipEntries.map(formatEntry),
    nextMilestone,
    currentChips: player.bankedChips,
  });
}

function formatEntry(e: {
  id: string;
  inductionType: string;
  milestoneTierId: string | null;
  championshipYear: number | null;
  championshipRank: number | null;
  hofBadge: string | null;
  title: string | null;
  chipsAtInduction: number;
  inductedAt: Date;
}) {
  return {
    id: e.id,
    inductionType: e.inductionType,
    milestoneTierId: e.milestoneTierId,
    championshipYear: e.championshipYear,
    championshipRank: e.championshipRank,
    hofBadge: e.hofBadge,
    title: e.title,
    chipsAtInduction: e.chipsAtInduction,
    inductedAt: e.inductedAt.toISOString(),
  };
}
