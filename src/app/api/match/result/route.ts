import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toProfile } from '@/lib/player-helpers';
import { getArenaById, levelFromXp, MILESTONE_TIERS, HALL_OF_FAME_TIERS } from '@/lib/game-config';
import { utcToday, utcMonday } from '@/lib/date-utils';

const TRACKABLE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'omega'] as const;

// Map PlayerMilestone tier IDs -> HallOfFameEntry milestoneTierId
const MILESTONE_TO_HOF_TIER: Record<string, string> = {
  bronze:   't-1lakh',
  silver:   't-5lakh',
  gold:     't-10lakh',
  platinum: 't-25lakh',
  diamond:  't-50lakh',
  omega:    't-1crore',
};

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
    durationSeconds: number;
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
          // Amount-based extraction challenge: track the best single-run amount
          newCurrent = Math.max(newCurrent, params.carriedChips);
        }
        break;

      case 'extract_streak':
        if (params.outcome === 'extract') {
          // Count-based extraction: increment for each successful extraction
          newCurrent += 1;
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

      case 'survive':
        // Track survival time: record the best single-match survival
        newCurrent = Math.max(newCurrent, params.durationSeconds);
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
  const expected = process.env.INTERNAL_SECRET;
  if (!expected) throw new Error('INTERNAL_SECRET env var is required');
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

  // Validate bankedAmount <= carriedChips on extract (H-09)
  if (outcome === 'extract' && bankedAmountFromBody > carriedChips) {
    return NextResponse.json({ error: 'bankedAmount cannot exceed carriedChips.' }, { status: 400 });
  }

  // Replay-attack protection: reject results older than 5 minutes (H-14)
  const matchTimestamp = Number(body.timestamp) || 0;
  if (matchTimestamp && Date.now() - matchTimestamp > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'Match result expired.' }, { status: 400 });
  }

  const chipsEarned = outcome === 'extract' ? bankedAmountFromBody : 0;
  const chipsLost = outcome === 'death' ? carriedChips : 0;
  // XP formula: floor((score*5 + kills*50) * rewardMultiplier)
  const xpGained = Math.floor((score * 5 + kills * 50) * arena.rewardMultiplier);

  // Use a transaction so stats and challenge progress are atomic
  let updated;
  try {
    updated = await db.$transaction(async (tx) => {
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
      durationSeconds,
    });

    // --- Milestone tracking (first time reaching each tier) + HOF induction ---
    if (outcome === 'extract') {
      const newChips = p.bankedChips + (chipsEarned || 0);
      for (const tierId of TRACKABLE_TIERS) {
        const tier = MILESTONE_TIERS.find(t => t.id === tierId);
        if (tier && newChips >= tier.minChips) {
          const milestoneCreated = await tx.playerMilestone.upsert({
            where: { playerId_tierId: { playerId: player.id, tierId } },
            create: { playerId: player.id, tierId, chipsAtMilestone: newChips },
            update: {},
          });

          // Auto-induct into Hall of Fame on first-time tier achievement
          if (milestoneCreated.createdAt.getTime() === milestoneCreated.updatedAt.getTime()) {
            const hofTierId = MILESTONE_TO_HOF_TIER[tierId];
            if (hofTierId) {
              const hofTier = HALL_OF_FAME_TIERS.find(t => t.id === hofTierId);
              try {
                const existing = await tx.hallOfFameEntry.findFirst({
                  where: { playerId: player.id, inductionType: 'milestone', milestoneTierId: hofTierId, championshipYear: null },
                });
                if (!existing) {
                  await tx.hallOfFameEntry.create({
                    data: {
                      playerId: player.id,
                      inductionType: 'milestone',
                      milestoneTierId: hofTierId,
                      hofBadge: hofTier?.badge ?? tier.badge,
                      title: hofTier?.name ?? tier.name,
                      chipsAtInduction: newChips,
                    },
                  });
                }
              } catch {
                // HOF induction is best-effort — don't block match result
              }
            }
          }
        }
      }
    }

    // --- Match History recording ---
    await tx.matchHistory.create({
      data: {
        playerId: player.id,
        arenaId,
        arenaName: arena.name,
        isOnline: arena.rewardMultiplier > 0,
        status: outcome === 'extract' ? 'EXTRACTED' : 'COLLIDED',
        chipsEarned,
        chipsLost,
        kills,
        snakeLength: score,
        durationSec: durationSeconds,
      },
    });

    // --- War scoring (if player is in a clan with an active war) ---
    if (p.clanTag && kills > 0) {
      const war = await tx.clanWar.findFirst({
        where: {
          OR: [
            { declarerTag: p.clanTag, status: 'active' },
            { targetTag: p.clanTag, status: 'active' },
          ],
        },
      });
      if (war) {
        const isDeclarer = war.declarerTag === p.clanTag;
        await tx.clanWar.update({
          where: { id: war.id },
          data: { [isDeclarer ? 'declarerScore' : 'targetScore']: { increment: kills } },
        });
        // Re-read to check if war should end
        const updatedWar = await tx.clanWar.findUnique({ where: { id: war.id } });
        if (updatedWar && (updatedWar.declarerScore >= 50 || updatedWar.targetScore >= 50)) {
          const winnerTag = updatedWar.declarerScore >= updatedWar.targetScore ? updatedWar.declarerTag : updatedWar.targetTag;
          const pot = updatedWar.wager * 2;
          await tx.clanWar.update({
            where: { id: war.id },
            data: { status: 'ended', endedAt: new Date(), winnerTag },
          });
          await tx.clan.update({
            where: { tag: winnerTag },
            data: { bankedChips: { increment: pot } },
          });
          const detail = `War ended! [${winnerTag}] won ${pot.toLocaleString()}c pot (${updatedWar.declarerScore}-${updatedWar.targetScore})`;
          await tx.clanActivity.create({ data: { clanTag: updatedWar.declarerTag, type: 'war_end', actorTag: p.userTag, actorName: p.name, detail } });
          await tx.clanActivity.create({ data: { clanTag: updatedWar.targetTag, type: 'war_end', actorTag: p.userTag, actorName: p.name, detail } });
        }
      }
    }

    return updatedPlayer;
    });
  } catch (err) {
    return NextResponse.json({ error: 'Database error processing match result.' }, { status: 500 });
  }

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