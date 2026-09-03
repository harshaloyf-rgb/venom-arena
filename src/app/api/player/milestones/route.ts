import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { MILESTONE_TIERS, HALL_OF_FAME_TIERS } from '@/lib/game-config';

/**
 * GET /api/player/milestones
 * Returns the authenticated player's chip-tier milestones.
 *
 * BACKFILL (user-reported bug): milestone rows were only created inside
 * /api/match/result on an EXTRACT, so players whose chips came from IAP packs,
 * promotions, or who played before the milestone system shipped saw an EMPTY
 * milestone card despite huge balances (e.g. 1B chips). We now lazily upsert
 * every tier the player's CURRENT bankedChips has reached, and best-effort
 * auto-induct genuinely-reached tiers into the Hall of Fame (same policy as
 * the extract path). Backfill is idempotent — existing rows keep their
 * original createdAt (and therefore their HOF "first achiever" order).
 */
const TRACKABLE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'omega'] as const;

// Same mapping as /api/match/result — PlayerMilestone tier -> HOF tier
const MILESTONE_TO_HOF_TIER: Record<string, string> = {
  bronze:   't-1lakh',
  silver:   't-5lakh',
  gold:     't-10lakh',
  platinum: 't-25lakh',
  diamond:  't-50lakh',
  omega:    't-1crore',
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const player = await db.player.findUnique({
      where: { id: session.playerId },
      select: { id: true, bankedChips: true },
    });
    if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

    let milestones = await db.playerMilestone.findMany({
      where: { playerId: player.id },
      orderBy: { chipsAtMilestone: 'desc' },
    });

    // ---- Lazy backfill: create rows for tiers already reached by balance ----
    const have = new Set(milestones.map((m) => m.tierId));
    const missing = TRACKABLE_TIERS.filter((tierId) => {
      const tier = MILESTONE_TIERS.find((t) => t.id === tierId);
      return tier && !have.has(tierId) && player.bankedChips >= tier.minChips;
    });

    if (missing.length > 0) {
      // Sequential upserts keep createdAt ordering honest (higher tiers later).
      for (const tierId of missing) {
        const tier = MILESTONE_TIERS.find((t) => t.id === tierId)!;
        const created = await db.playerMilestone.upsert({
          where: { playerId_tierId: { playerId: player.id, tierId } },
          create: { playerId: player.id, tierId, chipsAtMilestone: player.bankedChips },
          update: {},
        });
        milestones.push(created);

        // Best-effort HOF induction for the backfilled tier (first time only)
        const hofTierId = MILESTONE_TO_HOF_TIER[tierId];
        const hofTier = HALL_OF_FAME_TIERS.find((t) => t.id === hofTierId);
        if (hofTierId && hofTier) {
          try {
            const existing = await db.hallOfFameEntry.findFirst({
              where: { playerId: player.id, inductionType: 'milestone', milestoneTierId: hofTierId, championshipYear: null },
            });
            if (!existing) {
              await db.hallOfFameEntry.create({
                data: {
                  playerId: player.id,
                  inductionType: 'milestone',
                  milestoneTierId: hofTierId,
                  hofBadge: hofTier.badge,
                  title: hofTier.name,
                  chipsAtInduction: player.bankedChips,
                },
              });
            }
          } catch {
            // HOF induction stays best-effort — never block the read
          }
        }
      }

      milestones = await db.playerMilestone.findMany({
        where: { playerId: player.id },
        orderBy: { chipsAtMilestone: 'desc' },
      });
    }

    return NextResponse.json({ milestones });
  } catch (e) {
    console.error('[player/milestones] error', e);
    return NextResponse.json({ error: 'Failed to load milestones.' }, { status: 500 });
  }
}
