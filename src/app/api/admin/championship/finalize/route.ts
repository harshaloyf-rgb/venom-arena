import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-helpers';
import { logAdminAction } from '@/lib/audit';
import { CHAMPIONSHIP_PRIZE_TIERS } from '@/lib/game-config';

// POST /api/admin/championship/finalize   body: { year?: number }
//
// Year-end championship finalization — the one-shot payout tool. Runs the Jan 1
// close for a completed championship year:
//   1. Loads that year's ACTIVE registrations (banned players excluded — same
//      policy as the standings API and lobby leaderboard).
//   2. Ranks by bankedChips desc -> level desc -> join date asc (identical to
//      the live standings API).
//   3. Pays the top-100 chip prizes atomically (5M / 2.5M / 1M / 250K).
//   4. Inducts the top 100 into the Hall of Fame (inductionType='championship',
//      badges crown/silver/bronze/contender — same resolution as
//      POST /api/hof/induct, so manual and automated inductions match).
//   5. Writes/updates the ChampionshipArchive row (winner, top clan,
//      participants, payoutsProcessed=true, finalizedAt).
//
// SAFETY:
//   - Admin-only (requireAdmin) + audit-logged ('championship_finalize').
//   - Idempotent money path: if the archive row already says
//     payoutsProcessed=true the route refuses (409) — prizes can never be
//     paid twice for the same year.
//   - Default year = last completed calendar year; finalizing the CURRENT
//     calendar year requires { force: true } (e.g. testing).
//   - Run this BEFORE the Jan 1 wallet reset (wallet reset zeroes bankedChips,
//     which is the source of truth for final standings).

function prizeForRank(rank: number) {
  if (rank === 1) return CHAMPIONSHIP_PRIZE_TIERS[0];
  if (rank <= 10) return CHAMPIONSHIP_PRIZE_TIERS[1];
  if (rank <= 50) return CHAMPIONSHIP_PRIZE_TIERS[2];
  if (rank <= 100) return CHAMPIONSHIP_PRIZE_TIERS[3];
  return null;
}

function hofBadgeForRank(rank: number): string {
  if (rank === 1) return 'crown';
  if (rank <= 10) return 'silver';
  if (rank <= 50) return 'bronze';
  return 'contender';
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as { year?: number; force?: boolean };
  const currentCalYear = new Date().getUTCFullYear();
  const year = Number(body.year) || currentCalYear - 1;

  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year.' }, { status: 400 });
  }
  if (year >= currentCalYear && !body.force) {
    return NextResponse.json(
      { error: `Year ${year} has not finished yet (current calendar year: ${currentCalYear}). Pass { force: true } to override for testing.` },
      { status: 400 },
    );
  }

  // Idempotency gate — refuse if this year was already finalized & paid.
  const existingArchive = await db.championshipArchive.findUnique({ where: { year } });
  if (existingArchive?.payoutsProcessed) {
    return NextResponse.json(
      { error: `Championship ${year} was already finalized and payouts processed (finalized at ${existingArchive.finalizedAt?.toISOString() ?? 'n/a'}). Payouts cannot run twice.`, alreadyFinalized: true },
      { status: 409 },
    );
  }

  // ── Load + rank the year's eligible registrations ────────────────────────
  const regs = await db.championshipRegistration.findMany({
    where: { year, isActive: true },
    include: { player: { select: {
      id: true, userTag: true, name: true, country: true, bankedChips: true,
      level: true, clanTag: true, createdAt: true, banned: true,
    }}},
  });
  const eligible = regs.filter((r) => !r.player.banned);
  if (eligible.length === 0) {
    return NextResponse.json({ error: `No active (non-banned) registrations for year ${year} — nothing to finalize.` }, { status: 400 });
  }

  const sorted = [...eligible]
    .map((r) => ({
      playerId: r.player.id,
      userTag: r.player.userTag,
      name: r.player.name,
      country: r.player.country,
      bankedChips: r.player.bankedChips,
      level: r.player.level,
      clanTag: r.player.clanTag || '',
      createdAt: r.player.createdAt.getTime(),
    }))
    .sort((a, b) => {
      if (b.bankedChips !== a.bankedChips) return b.bankedChips - a.bankedChips;
      if (b.level !== a.level) return b.level - a.level;
      return a.createdAt - b.createdAt;
    });

  const winners = sorted.slice(0, 100)
    .map((c, i) => ({ ...c, rank: i + 1, prize: prizeForRank(i + 1) }))
    .filter((c) => c.prize !== null);

  const winner = sorted[0];

  // Top clan = most members inside the top 100 (tie -> first encountered),
  // matching the archive field's documented meaning.
  const clanCount = new Map<string, { count: number; chips: number }>();
  for (const c of sorted.slice(0, 100)) {
    if (!c.clanTag) continue;
    const e = clanCount.get(c.clanTag) ?? { count: 0, chips: 0 };
    e.count += 1;
    e.chips += c.bankedChips;
    clanCount.set(c.clanTag, e);
  }
  let topClan: { tag: string; count: number } | null = null;
  for (const [tag, e] of clanCount) {
    if (!topClan || e.count > topClan.count) topClan = { tag, count: e.count };
  }
  let topClanName: string | null = null;
  if (topClan) {
    const clan = await db.clan.findUnique({ where: { tag: topClan.tag }, select: { name: true } });
    topClanName = clan?.name ?? topClan.tag;
  }

  // ── Single transaction: payouts + inductions + archive ───────────────────
  // Kept deliberately SHORT (batched statements, not per-winner queries) —
  // SQLite interactive transactions hold the write lock, so long-running
  // transactions stall under concurrent reader traffic.
  try {
    const result = await db.$transaction(async (tx) => {
      // 1) Prize payouts — one updateMany per distinct reward tier
      const byReward = new Map<number, string[]>();
      for (const w of winners) {
        const ids = byReward.get(w.prize!.chipsReward) ?? [];
        ids.push(w.playerId);
        byReward.set(w.prize!.chipsReward, ids);
      }
      let paid = 0;
      for (const [reward, ids] of byReward) {
        const res = await tx.player.updateMany({
          where: { id: { in: ids } },
          data: { bankedChips: { increment: reward }, totalEarned: { increment: reward } },
        });
        paid += res.count;
      }

      // 2) HOF inductions — same badge/title resolution as /api/hof/induct so
      //    manual and automated entries are indistinguishable.
      const hofRows = winners.map((w) => ({
        playerId: w.playerId,
        inductionType: 'championship' as const,
        championshipYear: year,
        championshipRank: w.rank,
        hofBadge: hofBadgeForRank(w.rank),
        title: w.prize!.title.replace(/2026/g, String(year)),
        chipsAtInduction: w.bankedChips,
      }));
      // skipDuplicates is unsupported on SQLite — replace any pre-existing
      // (e.g. manually inducted) championship entries for this year with the
      // canonical finalization records.
      await tx.hallOfFameEntry.deleteMany({
        where: { inductionType: 'championship', championshipYear: year },
      });
      await tx.hallOfFameEntry.createMany({ data: hofRows });
      const inducted = hofRows.length;

      // 3) Archive row — payoutsProcessed=true is the idempotency gate
      const archive = await tx.championshipArchive.upsert({
        where: { year },
        create: {
          year,
          title: `${year} Annual Venom World Championship`,
          status: 'completed',
          winnerTag: winner.userTag,
          winnerName: winner.name,
          winnerCountry: winner.country,
          winnerClanTag: winner.clanTag || null,
          winnerChips: winner.bankedChips,
          totalParticipants: sorted.length,
          topClanTag: topClan?.tag ?? null,
          topClanName: topClanName,
          payoutsProcessed: true,
          finalizedAt: new Date(),
        },
        update: {
          status: 'completed',
          winnerTag: winner.userTag,
          winnerName: winner.name,
          winnerCountry: winner.country,
          winnerClanTag: winner.clanTag || null,
          winnerChips: winner.bankedChips,
          totalParticipants: sorted.length,
          topClanTag: topClan?.tag ?? null,
          topClanName: topClanName,
          payoutsProcessed: true,
          finalizedAt: new Date(),
        },
      });

      return { paid, inducted, archive };
    }, { maxWait: 10_000, timeout: 60_000 });

    await logAdminAction(session, 'championship_finalize', 'championship', String(year), {
      totalParticipants: sorted.length,
      winnersPaid: result.paid,
      inducted: result.inducted,
      winner: winner.userTag,
      topClan: topClan?.tag ?? null,
    });

    return NextResponse.json({
      ok: true,
      year,
      totalParticipants: sorted.length,
      winnersPaid: result.paid,
      inducted: result.inducted,
      winner: { tag: winner.userTag, name: winner.name, chips: winner.bankedChips },
      topClan: topClan ? { tag: topClan.tag, members: topClan.count } : null,
      archiveId: result.archive.id,
    });
  } catch (e) {
    console.error('[admin/championship/finalize] error', e);
    return NextResponse.json(
      { error: 'Finalization failed inside the transaction — nothing was paid. Check server logs and retry.' },
      { status: 500 },
    );
  }
}
