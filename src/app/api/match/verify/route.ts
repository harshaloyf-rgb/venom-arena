import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { getCosmeticById } from '@/lib/game-config';

// POST /api/match/verify
// Internal endpoint called by the Socket.IO server on socket connection.
// Validates the user's JWT (passed from the client via socket auth) and returns
// the player's spawn-safe profile.
//
// body: { token: string }
// returns: { ok: boolean, player?: {...} }
export async function POST(req: NextRequest) {
  const internalSecret = req.headers.get('x-internal-secret');
  const expected = process.env.INTERNAL_SECRET || 'venom-arena-internal-dev';
  if (internalSecret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.token || '');
  const session = verifySession(token);
  if (!session) return NextResponse.json({ ok: false, reason: 'invalid_token' });

  const p = await db.player.findUnique({ where: { id: session.playerId } });
  if (!p) return NextResponse.json({ ok: false, reason: 'player_not_found' });
  if (p.banned) return NextResponse.json({ ok: false, reason: 'banned' });

  let unlocked: string[] = [];
  try { unlocked = JSON.parse(p.unlockedSkins || '[]') as string[]; } catch {}

  const skin = getCosmeticById(p.currentSkin);

  return NextResponse.json({
    ok: true,
    player: {
      id: p.id,
      userTag: p.userTag,
      name: p.name,
      country: p.country,
      level: p.level,
      bankedChips: p.bankedChips,
      currentSkin: p.currentSkin,
      currentTrail: p.currentTrail,
      currentDeath: p.currentDeath,
      currentFlag: p.currentFlag,
      color: skin?.color || '#22c55e',
      secondaryColor: skin?.secondaryColor,
      pattern: skin?.pattern,
      unlockedSkins: unlocked,
      clanTag: p.clanTag,
      clanRank: p.clanRank,
      role: p.role,
    },
  });
}
