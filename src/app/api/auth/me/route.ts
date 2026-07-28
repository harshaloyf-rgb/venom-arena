import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ player: null });
  }
  const player = await db.player.findUnique({ where: { id: session.playerId } });
  if (!player || player.banned) {
    return NextResponse.json({ player: null });
  }
  return NextResponse.json({ player: toProfile(player) });
}
