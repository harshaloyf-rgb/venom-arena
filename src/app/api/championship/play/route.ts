import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

const CURRENT_YEAR = 2026;
const MAX_GAMES = 10000;

// POST /api/championship/play — Increment championship games played
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const player = await db.player.findUnique({
    where: { userTag: session.userTag },
    select: { id: true, banned: true },
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  }
  if (player.banned) {
    return NextResponse.json({ error: 'Banned players cannot play.' }, { status: 403 });
  }

  const reg = await db.championshipRegistration.findUnique({
    where: { playerId_year: { playerId: player.id, year: CURRENT_YEAR } },
  });

  if (!reg || !reg.isActive) {
    return NextResponse.json({ error: 'Not registered for the championship.' }, { status: 400 });
  }

  if (reg.gamesPlayed >= MAX_GAMES) {
    return NextResponse.json({ error: 'Match cap reached for this year.' }, { status: 400 });
  }

  const updated = await db.championshipRegistration.update({
    where: { id: reg.id },
    data: { gamesPlayed: { increment: 1 } },
  });

  const remaining = MAX_GAMES - updated.gamesPlayed;
  return NextResponse.json({
    gamesPlayed: updated.gamesPlayed,
    remaining,
    maxGames: MAX_GAMES,
  });
}
