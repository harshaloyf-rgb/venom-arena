import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toProfile } from '@/lib/player-helpers';
import { getArenaById, levelFromXp } from '@/lib/game-config';

// POST /api/match/result
// Called by the Socket.IO game server (mini-service) when a player extracts or dies.
// Authenticates via a shared internal secret (NOT the user JWT).
//
// body: {
//   userTag: string,
//   arenaId: string,
//   outcome: 'extract' | 'death',
//   carriedChips: number,
//   kills: number,
//   durationSeconds: number,
//   killerTag?: string  (when outcome === 'death')
// }
export async function POST(req: NextRequest) {
  const internalSecret = req.headers.get('x-internal-secret');
  const expected = process.env.INTERNAL_SECRET || 'venom-arena-internal-dev';
  if (internalSecret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userTag = String(body.userTag || '');
  const arenaId = String(body.arenaId || '');
  const outcome = body.outcome === 'extract' ? 'extract' : 'death';
  const carriedChips = Math.max(0, Math.floor(Number(body.carriedChips) || 0));
  const kills = Math.max(0, Math.floor(Number(body.kills) || 0));
  const durationSeconds = Math.max(0, Math.floor(Number(body.durationSeconds) || 0));
  const killerTag = body.killerTag ? String(body.killerTag) : undefined;

  const arena = getArenaById(arenaId);
  if (!arena) return NextResponse.json({ error: 'Unknown arena.' }, { status: 400 });

  const player = await db.player.findUnique({ where: { userTag } });
  if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  // ECONOMY RULES:
  //  * Extract: game server computes commission (dynamic: 0% if <=3 players, 35% if >=4).
  //    The `bankedAmount` field is the actual chips to credit (already post-commission).
  //    We use it directly instead of recomputing here.
  //  * Death: carriedChips lost. Still earn XP.
  //  * Practice (rewardMultiplier=0): 0 chips, 0 XP.
  const score = Math.max(0, Math.floor(Number(body.score) || 0));
  const bankedAmountFromBody = Math.max(0, Math.floor(Number(body.bankedAmount) || 0));
  const chipsEarned = outcome === 'extract' ? bankedAmountFromBody : 0;
  const chipsLost = outcome === 'death' ? carriedChips : 0;
  // XP formula: floor((score*5 + kills*50) * rewardMultiplier)
  const xpGained = Math.floor((score * 5 + kills * 50) * arena.rewardMultiplier);

  // Use a transaction so stats are atomic and never double-applied
  const updated = await db.$transaction(async (tx) => {
    const p = await tx.player.findUnique({ where: { id: player.id } });
    if (!p) throw new Error('player missing');

    const newXp = p.xp + xpGained;
    const newLevel = Math.max(p.level, levelFromXp(newXp));

    const data: Record<string, unknown> = {
      xp: newXp,
      level: newLevel,
      lifetimeKills: { increment: kills },
    };

    if (outcome === 'extract') {
      data.bankedChips = { increment: chipsEarned };
      data.totalEarned = { increment: chipsEarned };
      data.lifetimeExtracts = { increment: 1 };
      if (chipsEarned > p.biggestExtract) data.biggestExtract = chipsEarned;
    } else {
      // Death: chips carried are lost (already paid buyIn at join, no further deduction)
      data.totalLost = { increment: chipsLost };
      data.lifetimeDeaths = { increment: 1 };
    }

    if (kills > p.bestStreak) data.bestStreak = kills;

    return tx.player.update({ where: { id: player.id }, data: data as any });
  });

  return NextResponse.json({
    player: toProfile(updated),
    chipsEarned,
    chipsLost,
    commission: outcome === 'extract' ? Math.floor(carriedChips * commission) : 0,
    xpGained,
    newLevel: updated.level,
    newBankedChips: updated.bankedChips,
  });
}
