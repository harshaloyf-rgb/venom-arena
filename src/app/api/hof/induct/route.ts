import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { HALL_OF_FAME_TIERS, CHAMPIONSHIP_PRIZE_TIERS } from '@/lib/game-config';
import { verifyInternalSecret } from '@/lib/api-helpers';

// POST /api/hof/induct
// Internal + admin-only endpoint for creating HOF entries.
// Used by: milestone checker (INTERNAL_SECRET), championship finalization (admin),
// and future admin panel.
// REMOVED: Session-auth self-induction was a security vulnerability.
export async function POST(req: Request) {
  const session = await getSession();
  let isInternal = false;
  let isAdmin = false;

  if (session && session.role === 'admin') {
    isAdmin = true;
  } else if (verifyInternalSecret(req as any)) {
    isInternal = true;
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    userTag?: string;
    inductionType?: 'milestone' | 'championship';
    milestoneTierId?: string;
    championshipYear?: number;
    championshipRank?: number;
    hofBadge?: string;
    title?: string;
    chips?: number;
  };

  const { userTag, inductionType, milestoneTierId, championshipYear, championshipRank, hofBadge, title, chips } = body;

  if (!userTag || !inductionType) {
    return NextResponse.json({ error: 'Missing userTag or inductionType' }, { status: 400 });
  }

  const player = await db.player.findUnique({
    where: { userTag },
    select: { id: true, bankedChips: true },
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Validate inductionType-specific fields
  if (inductionType === 'milestone' && !milestoneTierId) {
    return NextResponse.json({ error: 'milestoneTierId required for milestone induction' }, { status: 400 });
  }
  if (inductionType === 'championship' && !championshipYear) {
    return NextResponse.json({ error: 'championshipYear required for championship induction' }, { status: 400 });
  }

  // Resolve hofBadge / title if not provided
  let resolvedBadge = hofBadge;
  let resolvedTitle = title;
  const chipsAtInduction = chips ?? player.bankedChips;

  if (inductionType === 'milestone') {
    const tier = HALL_OF_FAME_TIERS.find((t) => t.id === milestoneTierId);
    if (!tier) {
      return NextResponse.json({ error: 'Invalid milestoneTierId' }, { status: 400 });
    }
    resolvedBadge = resolvedBadge || tier.badge;
    resolvedTitle = resolvedTitle || tier.name;
  } else if (inductionType === 'championship') {
    // Auto-resolve badge from rank
    if (!resolvedBadge && championshipRank) {
      if (championshipRank === 1) resolvedBadge = 'crown';
      else if (championshipRank <= 10) resolvedBadge = 'silver';
      else if (championshipRank <= 50) resolvedBadge = 'bronze';
      else resolvedBadge = 'contender';
    }
    if (!resolvedTitle && championshipRank && championshipYear) {
      const prize = CHAMPIONSHIP_PRIZE_TIERS.find((t) => {
        if (t.category === 'RANK_1') return championshipRank === 1;
        if (t.category === 'RANK_2_10') return championshipRank >= 2 && championshipRank <= 10;
        if (t.category === 'RANK_11_50') return championshipRank >= 11 && championshipRank <= 50;
        if (t.category === 'RANK_51_100') return championshipRank >= 51 && championshipRank <= 100;
        return false;
      });
      if (prize) {
        resolvedTitle = prize.title.replace(/2026/, String(championshipYear));
      }
    }
  }

  // Upsert using findFirst + create/update because Prisma's upsert() rejects
  // null values in compound-unique where clauses (e.g., championshipYear: null
  // for milestone inductions).
  try {
    // Build the unique-key match filter
    const whereFilter: Record<string, unknown> = {
      playerId: player.id,
      inductionType,
    };
    if (inductionType === 'milestone') {
      whereFilter.milestoneTierId = milestoneTierId;
      whereFilter.championshipYear = null;
    } else {
      whereFilter.championshipYear = championshipYear!;
    }

    const existing = await db.hallOfFameEntry.findFirst({ where: whereFilter });

    let entry;
    if (existing) {
      entry = await db.hallOfFameEntry.update({
        where: { id: existing.id },
        data: {
          championshipRank: championshipRank ?? undefined,
          hofBadge: resolvedBadge,
          title: resolvedTitle,
          chipsAtInduction: Math.max(chipsAtInduction, 0),
        },
      });
    } else {
      entry = await db.hallOfFameEntry.create({
        data: {
          playerId: player.id,
          inductionType,
          milestoneTierId: milestoneTierId ?? null,
          championshipYear: championshipYear ?? null,
          championshipRank: championshipRank ?? null,
          hofBadge: resolvedBadge,
          title: resolvedTitle,
          chipsAtInduction,
        },
      });
    }

    return NextResponse.json({
      inducted: true,
      entryId: entry.id,
      inductionType,
      hofBadge: resolvedBadge,
      title: resolvedTitle,
    });
  } catch (error: unknown) {
    console.error('[hof/induct] error', error);
    return NextResponse.json({ error: 'Induction failed. Please try again.' }, { status: 500 });
  }
}
