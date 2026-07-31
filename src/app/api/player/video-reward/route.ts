import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// In-memory cooldown tracking (playerId -> last reward timestamp)
// NOTE: Cooldown state is lost on server restart. Acceptable for now —
// TODO: store cooldown timestamps in the database for durability.
const videoRewardCooldowns = new Map<string, number>();
const VIDEO_REWARD_COOLDOWN_MS = 60_000; // 60 seconds
const VIDEO_REWARD_AMOUNT = 50;

// POST /api/player/video-reward
export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const playerId = session.playerId;
  const now = Date.now();

  // Check cooldown
  const lastReward = videoRewardCooldowns.get(playerId);
  if (lastReward) {
    const elapsed = now - lastReward;
    if (elapsed < VIDEO_REWARD_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((VIDEO_REWARD_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json({
        error: `Cooldown active. Try again in ${remainingSeconds} seconds.`,
      }, { status: 429 });
    }
  }

  // Award chips
  const updated = await db.player.update({
    where: { id: playerId },
    data: {
      bankedChips: { increment: VIDEO_REWARD_AMOUNT },
      totalEarned: { increment: VIDEO_REWARD_AMOUNT },
    },
    select: { bankedChips: true },
  });

  // Record the cooldown
  videoRewardCooldowns.set(playerId, now);

  // Clean up stale entries periodically (keep map from growing unbounded)
  if (videoRewardCooldowns.size > 10000) {
    for (const [key, ts] of videoRewardCooldowns) {
      if (now - ts > VIDEO_REWARD_COOLDOWN_MS * 2) {
        videoRewardCooldowns.delete(key);
      }
    }
  }

  return NextResponse.json({
    success: true,
    reward: VIDEO_REWARD_AMOUNT,
    newBankedChips: updated.bankedChips,
  });
}
