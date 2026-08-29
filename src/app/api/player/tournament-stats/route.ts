import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/player/tournament-stats
// Returns real data for the Annual Tournament Guardrails section
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const pid = session.playerId;
    const currentYear = new Date().getFullYear();

    // 1. Matches played this year — count from real MatchHistory (online matches only)
    const currentYearStart = new Date(currentYear, 0, 1).toISOString();
    const nextYearStart = new Date(currentYear + 1, 0, 1).toISOString();
    const gamesPlayed = await db.matchHistory.count({
      where: {
        playerId: pid,
        isOnline: true,
        createdAt: { gte: new Date(currentYearStart), lt: new Date(nextYearStart) },
      },
    });
    const MAX_MATCHES = 10_000;
    const MATCHES_REMAINING = MAX_MATCHES - gamesPlayed;

    // 2. Annual buy cap (25 lakh = 2,500,000)
    // Sum of all Purchase amounts for this player this year
    const purchases = await db.purchase.findMany({
      where: {
        playerId: pid,
        createdAt: { gte: new Date(currentYearStart) },
      },
      select: { amountChips: true },
    });
    const totalBought = purchases.reduce((sum, p) => sum + p.amountChips, 0);
    const ANNUAL_BUY_CAP = 2_500_000;
    const buyCapRemaining = Math.max(0, ANNUAL_BUY_CAP - totalBought);

    // 3. Daily ad cap — count video rewards today (UTC)
    const todayUtc = new Date().toISOString().slice(0, 10);
    const adsToday = await db.videoReward.count({
      where: {
        playerId: pid,
        createdAt: {
          gte: new Date(`${todayUtc}T00:00:00.000Z`),
          lt: new Date(`${todayUtc}T23:59:59.999Z`),
        },
      },
    });
    const MAX_DAILY_ADS = 12;
    const adsRemaining = Math.max(0, MAX_DAILY_ADS - adsToday);

    return NextResponse.json({
      matchesPlayed: gamesPlayed,
      matchesMax: MAX_MATCHES,
      matchesRemaining: MATCHES_REMAINING,
      totalBought,
      annualBuyCap: ANNUAL_BUY_CAP,
      buyCapRemaining,
      adsToday,
      adsMax: MAX_DAILY_ADS,
      adsRemaining,
      year: currentYear,
    });
  } catch (e) {
    console.error('[tournament-stats] GET error', e);
    // Return zeros as fallback so the UI still works
    return NextResponse.json({
      matchesPlayed: 0,
      matchesMax: 10000,
      matchesRemaining: 10000,
      totalBought: 0,
      annualBuyCap: 2500000,
      buyCapRemaining: 2500000,
      adsToday: 0,
      adsMax: 12,
      adsRemaining: 12,
      year: new Date().getFullYear(),
    });
  }
}
