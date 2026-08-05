/**
 * GET /api/championship/archives
 *
 * Returns past championship data (completed years).
 * Also seeds demo archive entries if none exist.
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Seed demo archives on first call if table is empty
async function ensureDemoArchives() {
  const count = await db.championshipArchive.count();
  if (count > 0) return;

  await db.championshipArchive.createMany({
    data: [
      {
        year: 2024,
        title: '2024 Annual Venom World Championship',
        status: 'completed',
        winnerTag: 'VENOM-0012',
        winnerName: 'CobraKing_AU',
        winnerCountry: 'AU',
        winnerClanTag: 'APEX',
        winnerChips: 8_200_000,
        totalParticipants: 1247,
        topClanTag: 'APEX',
        topClanName: 'Apex Predators',
        payoutsProcessed: true,
        finalizedAt: new Date('2025-01-01T00:15:00Z'),
      },
      {
        year: 2025,
        title: '2025 Annual Venom World Championship',
        status: 'completed',
        winnerTag: 'IND-5501',
        winnerName: 'Hari',
        winnerCountry: 'IN',
        winnerClanTag: 'APEX',
        winnerChips: 12_400_000,
        totalParticipants: 3482,
        topClanTag: 'APEX',
        topClanName: 'Apex Predators',
        payoutsProcessed: true,
        finalizedAt: new Date('2026-01-01T00:12:00Z'),
      },
    ],
  });
}

export async function GET() {
  await ensureDemoArchives();

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
