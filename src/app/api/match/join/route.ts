import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getArenaById } from '@/lib/game-config';

// POST /api/match/join
// Internal endpoint called by the Socket.IO server when a player joins an arena.
// Atomically deducts buyIn. Returns the player's snapshot for spawning.
//
// body: { userTag: string, arenaId: string }
// returns: { ok: boolean, player: {...} | null, reason?: string }
export async function POST(req: NextRequest) {
  const internalSecret = req.headers.get('x-internal-secret');
  const expected = process.env.INTERNAL_SECRET || 'venom-arena-internal-dev';
  if (internalSecret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userTag = String(body.userTag || '');
  const arenaId = String(body.arenaId || '');
  const arena = getArenaById(arenaId);
  if (!arena) return NextResponse.json({ ok: false, reason: 'invalid_arena' }, { status: 400 });

  // Use a transaction to atomically check balance + deduct buyIn
  let result;
  try {
    result = await db.$transaction(async (tx) => {
    const p = await tx.player.findUnique({ where: { userTag } });
    if (!p) return { ok: false as const, reason: 'player_not_found' };
    if (p.banned) return { ok: false as const, reason: 'banned' };
    if (p.bankedChips < arena.buyIn) return { ok: false as const, reason: 'insufficient_chips' };

    let unlocked: string[] = [];
    try { unlocked = JSON.parse(p.unlockedSkins || '[]') as string[]; } catch {}

    const updated = await tx.player.update({
      where: { id: p.id },
      data: {
        bankedChips: { decrement: arena.buyIn },
        totalLost: { increment: arena.buyIn },
        lastSeenAt: new Date(),
      },
    });

    return {
      ok: true as const,
      player: {
        userTag: p.userTag,
        name: p.name,
        country: p.country,
        level: p.level,
        currentSkin: p.currentSkin,
        currentTrail: p.currentTrail,
        currentDeath: p.currentDeath,
        currentFlag: p.currentFlag,
        bankedChipsAfterBuyIn: updated.bankedChips,
        unlockedSkins: unlocked,
        clanTag: p.clanTag,
        clanRank: p.clanRank,
      },
    };
    });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: 'database_error' }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
