import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';

const VIDEO_REWARD_COOLDOWN_MS = 60_000; // 60 seconds
const VIDEO_REWARD_AMOUNT = 50;

// POST /api/player/video-reward
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const playerId = session.playerId;

  // Check cooldown via most recent VideoReward record
  const lastReward = await db.videoReward.findFirst({
    where: { playerId },
    orderBy: { createdAt: 'desc' },
  });

  if (lastReward) {
    const elapsed = Date.now() - lastReward.createdAt.getTime();
    if (elapsed < VIDEO_REWARD_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((VIDEO_REWARD_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json({
        error: `Cooldown active. Try again in ${remainingSeconds} seconds.`,
      }, { status: 429 });
    }
  }

  // Award chips and record in a transaction
  const updated = await db.$transaction(async (tx) => {
    const player = await tx.player.update({
      where: { id: playerId },
      data: {
        bankedChips: { increment: VIDEO_REWARD_AMOUNT },
        totalEarned: { increment: VIDEO_REWARD_AMOUNT },
      },
    });
    await tx.videoReward.create({
      data: { playerId, reward: VIDEO_REWARD_AMOUNT },
    });
    return player;
  });

  return NextResponse.json({
    player: toProfile(updated),
    reward: VIDEO_REWARD_AMOUNT,
    cooldownSeconds: 60,
  });
}
