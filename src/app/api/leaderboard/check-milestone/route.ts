import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { MILESTONE_TIERS, HALL_OF_FAME_TIERS } from '@/lib/game-config';

// Tier IDs tracked in PlayerMilestone (excludes 'all' and 'rookie')
const TRACKABLE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'omega'] as const;

// Map PlayerMilestone tier IDs → HallOfFameEntry milestoneTierId
const MILESTONE_TO_HOF_TIER: Record<string, string> = {
  bronze:   't-1lakh',
  silver:   't-5lakh',
  gold:     't-10lakh',
  platinum: 't-25lakh',
  diamond:  't-50lakh',
  omega:    't-1crore',
};

// POST /api/leaderboard/check-milestone
// Called internally (via INTERNAL_SECRET) after a match ends.
// Checks if the player has crossed any new milestone tier, records it,
// and auto-inducts into the Hall of Fame on first-time achievements.
export async function POST(req: Request) {
  // Accept either session auth or internal secret
  const session = await getSession();
  let userTag: string | undefined;

  if (session?.userTag) {
    // Session auth — only allow checking own milestones
    const earlyBody = await req.json().catch(() => ({})) as { userTag?: string };
    if (earlyBody.userTag && earlyBody.userTag.toUpperCase() !== session.userTag) {
      return NextResponse.json({ error: 'Can only check your own milestones' }, { status: 403 });
    }
    userTag = session.userTag;
  } else {
    // Check for internal secret (for game-server calls)
    const auth = req.headers.get('authorization');
    const secret = auth?.replace('Bearer ', '');
    if (!secret || secret !== process.env.INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({})) as { userTag?: string };
    userTag = body.userTag;
  }

  if (!userTag) {
    return NextResponse.json({ error: 'Missing userTag' }, { status: 400 });
  }

  const player = await db.player.findUnique({
    where: { userTag },
    select: { id: true, bankedChips: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Find which tiers the player qualifies for
  const newMilestones: Array<{ tierId: string; badge: string; chips: number; hofInducted?: boolean }> = [];

  for (const tierId of TRACKABLE_TIERS) {
    const tier = MILESTONE_TIERS.find(t => t.id === tierId);
    if (!tier) continue;

    if (player.bankedChips >= tier.minChips) {
      // Check if already recorded in PlayerMilestone
      const existing = await db.playerMilestone.findUnique({
        where: { playerId_tierId: { playerId: player.id, tierId } },
      });

      if (!existing) {
        // First time reaching this tier — record it in PlayerMilestone
        await db.playerMilestone.create({
          data: {
            playerId: player.id,
            tierId,
            chipsAtMilestone: player.bankedChips,
          },
        });

        // S3: Auto-induct into Hall of Fame
        const hofTierId = MILESTONE_TO_HOF_TIER[tierId];
        let hofInducted = false;
        if (hofTierId) {
          const hofTier = HALL_OF_FAME_TIERS.find(t => t.id === hofTierId);
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
                  hofBadge: hofTier?.badge ?? tier.badge,
                  title: hofTier?.name ?? tier.name,
                  chipsAtInduction: player.bankedChips,
                },
              });
              hofInducted = true;
            }
          } catch {
            // HOF induction is best-effort — don't block milestone recording
          }
        }

        newMilestones.push({
          tierId,
          badge: tier.badge,
          chips: player.bankedChips,
          hofInducted,
        });
      }
    }
  }

  return NextResponse.json({
    checked: true,
    bankedChips: player.bankedChips,
    newMilestones,
  });
}
