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

  // Award chips and record in a transaction — cooldown check inside tx to prevent race
  try {
    const updated = await db.$transaction(async (tx) => {
      // Check cooldown inside transaction
      const lastReward = await tx.videoReward.findFirst({
        where: { playerId },
        orderBy: { createdAt: 'desc' },
      });

      if (lastReward) {
        const elapsed = Date.now() - lastReward.createdAt.getTime();
        if (elapsed < VIDEO_REWARD_COOLDOWN_MS) {
          const remainingSeconds = Math.ceil((VIDEO_REWARD_COOLDOWN_MS - elapsed) / 1000);
          throw new Error(`COOLDOWN:${remainingSeconds}`);
        }
      }

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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith('COOLDOWN:')) {
      const seconds = msg.split(':')[1];
      return NextResponse.json({
        error: `Cooldown active. Try again in ${seconds} seconds.`,
      }, { status: 429 });
    }
    console.error('[video-reward] error', e);
    return NextResponse.json({ error: 'Reward failed.' }, { status: 500 });
  }
}
