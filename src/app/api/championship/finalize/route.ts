import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CHAMPIONSHIP_PRIZE_TIERS } from '@/lib/game-config';

// POST /api/championship/finalize
// Admin-only: Finalizes a championship year — locks standings, creates HOF entries
// for top 100, and archives the championship.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin only
  const admin = await db.player.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { year?: number };
  const year = body.year ?? new Date().getFullYear() - 1; // Default to last year

  // Validate year isn't the current active year
  const currentYear = new Date().getFullYear();
  if (year >= currentYear) {
    return NextResponse.json({ error: `Cannot finalize year ${year} — it is not yet complete. Only past years can be finalized.` }, { status: 400 });
  }

  // Check if already finalized
  const existingArchive = await db.championshipArchive.findUnique({
    where: { year },
  });
  if (existingArchive?.payoutsProcessed) {
    return NextResponse.json({ error: `Year ${year} is already finalized.` }, { status: 409 });
  }

  // Fetch all registrations for the year, sorted by bankedChips desc
  const registrations = await db.championshipRegistration.findMany({
    where: { year },
    include: {
      player: {
        select: {
          id: true, userTag: true, name: true, country: true,
          clanTag: true, level: true, bankedChips: true,
        },
      },
    },
    orderBy: { player: { bankedChips: 'desc' } },
  });

  if (registrations.length === 0) {
    return NextResponse.json({ error: `No registrations found for year ${year}.` }, { status: 404 });
  }

  // Determine HOF badge from rank
  function badgeForRank(rank: number): string {
    if (rank === 1) return 'crown';
    if (rank <= 10) return 'silver';
    if (rank <= 50) return 'bronze';
    return 'contender';
  }

  // Determine title from rank
  function titleForRank(rank: number, yr: number): string {
    if (rank === 1) return `👑 ${yr} WORLD VENOM CHAMPION`;
    if (rank <= 10) return `🥈 ${yr} VENOM ARENA OVERLORD`;
    if (rank <= 50) return `🥉 ${yr} ARENA ELITE MASTER`;
    return `🛡️ ${yr} CHAMPIONSHIP CONTENDER`;
  }

  // Create HOF entries for top 100
  const top100 = registrations.slice(0, 100);
  let hofCreated = 0;

  for (let i = 0; i < top100.length; i++) {
    const reg = top100[i];
    const rank = i + 1;
    try {
      await db.hallOfFameEntry.upsert({
        where: {
          playerId_inductionType_milestoneTierId_championshipYear: {
            playerId: reg.playerId,
            inductionType: 'championship',
            milestoneTierId: null,
            championshipYear: year,
          },
        },
        create: {
          playerId: reg.playerId,
          inductionType: 'championship',
          championshipYear: year,
          championshipRank: rank,
          hofBadge: badgeForRank(rank),
          title: titleForRank(rank, year),
          chipsAtInduction: reg.player.bankedChips,
        },
        update: {
          championshipRank: rank,
          hofBadge: badgeForRank(rank),
          title: titleForRank(rank, year),
          chipsAtInduction: reg.player.bankedChips,
        },
      });
      hofCreated++;
    } catch {
      // Best-effort — continue with next
    }
  }

  // Find the winner for the archive
  const winner = top100[0]?.player;

  // Find top clan (most top-100 members)
  const clanCounts: Record<string, number> = {};
  for (const reg of top100) {
    const tag = reg.player.clanTag;
    if (tag) {
      clanCounts[tag] = (clanCounts[tag] || 0) + 1;
    }
  }
  const topClanEntry = Object.entries(clanCounts).sort((a, b) => b[1] - a[1])[0];
  const topClanTag = topClanEntry?.[0] ?? null;

  // Upsert ChampionshipArchive
  await db.championshipArchive.upsert({
    where: { year },
    create: {
      year,
      title: `${year} Annual Venom World Championship`,
      status: 'completed',
      winnerTag: winner?.userTag ?? null,
      winnerName: winner?.name ?? null,
      winnerCountry: winner?.country ?? null,
      winnerClanTag: winner?.clanTag ?? null,
      winnerChips: winner?.bankedChips ?? null,
      totalParticipants: registrations.length,
      topClanTag,
      payoutsProcessed: true,
      finalizedAt: new Date(),
    },
    update: {
      status: 'completed',
      winnerTag: winner?.userTag ?? undefined,
      winnerName: winner?.name ?? undefined,
      winnerCountry: winner?.country ?? undefined,
      winnerClanTag: winner?.clanTag ?? undefined,
      winnerChips: winner?.bankedChips ?? undefined,
      totalParticipants: registrations.length,
      topClanTag,
      payoutsProcessed: true,
      finalizedAt: new Date(),
    },
  });

  // Deactivate all registrations for that year
  await db.championshipRegistration.updateMany({
    where: { year },
    data: { isActive: false },
  });

  return NextResponse.json({
    success: true,
    year,
    totalRegistrations: registrations.length,
    top100Inducted: hofCreated,
    winner: winner ? {
      name: winner.name,
      userTag: winner.userTag,
      country: winner.country,
      chips: winner.bankedChips,
    } : null,
    topClan: topClanTag ? { tag: topClanTag, members: topClanEntry?.[1] } : null,
  });
}
