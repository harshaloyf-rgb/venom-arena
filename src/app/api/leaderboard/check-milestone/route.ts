import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { MILESTONE_TIERS } from '@/lib/game-config';

// Tier IDs that are tracked (excludes 'all' and 'rookie')
const TRACKABLE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'omega'] as const;

// POST /api/leaderboard/check-milestone
// Called internally (via INTERNAL_SECRET) after a match ends.
// Checks if the player has crossed any new milestone tier and records it.
// Can also be called by the player directly (session auth) to check milestones.
export async function POST(req: Request) {
  // Accept either session auth or internal secret
  const session = await getSession();
  let userTag: string | undefined;

  if (session?.userTag) {
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
  const newMilestones: Array<{ tierId: string; badge: string; chips: number }> = [];

  for (const tierId of TRACKABLE_TIERS) {
    const tier = MILESTONE_TIERS.find(t => t.id === tierId);
    if (!tier) continue;

    if (player.bankedChips >= tier.minChips) {
 // Check if already recorded
      const existing = await db.playerMilestone.findUnique({
        where: { playerId_tierId: { playerId: player.id, tierId } },
      });

      if (!existing) {
        // First time reaching this tier — record it
        await db.playerMilestone.create({
          data: {
            playerId: player.id,
            tierId,
            chipsAtMilestone: player.bankedChips,
          },
        });
        newMilestones.push({
          tierId,
          badge: tier.badge,
          chips: player.bankedChips,
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
