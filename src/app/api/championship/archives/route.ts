/**
 * GET /api/championship/archives
 *
 * Returns past championship data (completed years).
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const archives = await db.championshipArchive.findMany({
    orderBy: { year: 'desc' },
  });

  return NextResponse.json({
    archives: archives.map(a => ({
      year: a.year,
      title: a.title,
      status: a.status,
      winnerTag: a.winnerTag,
      winnerName: a.winnerName,
      winnerCountry: a.winnerCountry,
      winnerClanTag: a.winnerClanTag,
      winnerChips: a.winnerChips,
      totalParticipants: a.totalParticipants,
      topClanTag: a.topClanTag,
      topClanName: a.topClanName,
      payoutsProcessed: a.payoutsProcessed,
      finalizedAt: a.finalizedAt?.toISOString() ?? null,
    })),
    currentYear: 2026,
  });
}
