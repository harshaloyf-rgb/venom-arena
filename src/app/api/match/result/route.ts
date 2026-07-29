import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toProfile } from '@/lib/player-helpers';
import { getArenaById, levelFromXp } from '@/lib/game-config';

// ---------------------------------------------------------------------------
// Date helpers (duplicated from challenges/route.ts — needed for period lookup)
// ---------------------------------------------------------------------------

function utcToday(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function utcMonday(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? 6 : day - 1; // shift so Monday=0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Challenge progress updater (runs inside the caller's Prisma transaction)
// ---------------------------------------------------------------------------

async function updateChallengeProgress(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  playerId: string,
  params: {
    kills: number;
    outcome: 'extract' | 'death';
    carriedChips: number;
    score: number;
    starsCollected: number;
  },
) {
  const today = utcToday();
  const monday = utcMonday();

  const activeChallenges = await tx.challenge.findMany({
    where: {
      playerId,
      completed: false,
      OR: [
        { type: 'daily', periodStart: today },
        { type: 'weekly', periodStart: monday },
      ],
    },
  });

  for (const challenge of activeChallenges) {
    let newCurrent = challenge.current;

    switch (challenge.category) {
      case 'kill':
        // Increment by the number of kills this match
        newCurrent += params.kills;
        break;

      case 'extract':
        if (params.outcome === 'extract') {
          if (challenge.target <= 10) {
            // Count-based extraction challenge (e.g. "extract 3 times")
            newCurrent += 1;
          } else {
            // Amount-based extraction challenge (e.g. "extract with ≥50 chips")
            // Track the best single-run amount
            newCurrent = Math.max(newCurrent, params.carriedChips);
          }
        }
        break;

      case 'score':
        // Score milestones: if reached in this match, mark as completable
        if (params.score >= challenge.target) {
          newCurrent = challenge.target;
        }
        break;

      case 'arena_entry':
        // Player entered an arena
        newCurrent += 1;
        break;

      case 'star_collect':
        // Increment by stars collected this match
        newCurrent += params.starsCollected;
        break;
    }

    // Auto-complete when target is met
    const shouldComplete = newCurrent >= challenge.target;

    await tx.challenge.update({
      where: { id: challenge.id },
      data: {
        current: newCurrent,
        ...(shouldComplete ? { completed: true } : {}),
      },
    });
  }
}

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
//   score?: number,
//   bankedAmount?: number,
//   starsCollected?: number,
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
  const starsCollected = Math.max(0, Math.floor(Number(body.starsCollected) || 0));

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

  // Use a transaction so stats and challenge progress are atomic
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

    const updatedPlayer = await tx.player.update({ where: { id: player.id }, data: data as any });

    // --- Challenge progress tracking ---
    await updateChallengeProgress(tx, player.id, {
      kills,
      outcome,
      carriedChips,
      score,
      starsCollected,
    });

    return updatedPlayer;
  });

  return NextResponse.json({
    player: toProfile(updated),
    chipsEarned,
    chipsLost,
    // commission = what the server already deducted: carriedChips - bankedAmount
    commission: outcome === 'extract' ? (carriedChips - bankedAmountFromBody) : 0,
    xpGained,
    newLevel: updated.level,
    newBankedChips: updated.bankedChips,
  });
}