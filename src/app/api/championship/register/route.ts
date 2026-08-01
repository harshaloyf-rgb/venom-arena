import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

const CURRENT_YEAR = 2026;
const MAX_GAMES = 10000;

// POST /api/championship/register — Register for the current year's championship
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const player = await db.player.findUnique({
    where: { userTag: session.userTag },
    select: { id: true, name: true, userTag: true, banned: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  }
  if (player.banned) {
    return NextResponse.json({ error: 'Banned players cannot register.' }, { status: 403 });
  }

  // Upsert: if already registered for this year, return existing
  const reg = await db.championshipRegistration.upsert({
    where: {
      playerId_year: { playerId: player.id, year: CURRENT_YEAR },
    },
    create: {
      playerId: player.id,
      year: CURRENT_YEAR,
      gamesPlayed: 0,
      isActive: true,
    },
    update: {},
  });

  return NextResponse.json({
    registered: true,
    year: CURRENT_YEAR,
    maxGames: MAX_GAMES,
    gamesPlayed: reg.gamesPlayed,
    registeredAt: reg.registeredAt.toISOString(),
  });
}

// GET /api/championship/register — Check registration status
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const player = await db.player.findUnique({
    where: { userTag: session.userTag },
    select: { id: true },
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  }

  const reg = await db.championshipRegistration.findUnique({
    where: {
      playerId_year: { playerId: player.id, year: CURRENT_YEAR },
    },
  });

  return NextResponse.json({
    registered: !!reg,
    year: CURRENT_YEAR,
    maxGames: MAX_GAMES,
    gamesPlayed: reg?.gamesPlayed ?? 0,
    isActive: reg?.isActive ?? false,
    registeredAt: reg?.registeredAt?.toISOString() ?? null,
  });
}
