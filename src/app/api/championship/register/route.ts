import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

const CURRENT_YEAR = 2026;
const MAX_GAMES = 10000;

// POST /api/championship/register — Register for the current year's championship
export async function POST() {
  try {
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
  } catch (e) {
    // NEVER let a DB error escape as an HTML 500 — the client parses JSON and
    // showed "Network error during registration" for what is usually a schema
    // drift on the deployed server (missing ChampionshipRegistration table).
    console.error('[championship/register] error', e);
    return NextResponse.json(
      { error: 'Registration service error. If this persists, the server database needs the latest migration (npx prisma db push).' },
      { status: 500 },
    );
  }
}

// GET /api/championship/register — Check registration status
export async function GET() {
  try {
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
  } catch (e) {
    console.error('[championship/register:GET] error', e);
    return NextResponse.json(
      { error: 'Could not check registration status (database error).' },
      { status: 500 },
    );
  }
}
