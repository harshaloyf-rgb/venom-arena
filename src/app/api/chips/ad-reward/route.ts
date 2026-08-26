import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';

// POST /api/chips/ad-reward — credit chips after watching a rewarded ad.
// body: {} (no params needed — reward is fixed at 50 chips)
//
// Rate limit: one ad reward per 60 seconds per player (enforced in-memory
// via a Map). This is deliberately simple; a production system would use
// Redis or a DB column. The 60-second cooldown prevents abuse while keeping
// the UX snappy.
const AD_REWARD_AMOUNT = 50;
const COOLDOWN_SECONDS = 60;

// In-memory cooldown tracker (playerId → timestamp of last reward).
const lastRewardTime = new Map<string, number>();

// Clean up stale entries every 5 minutes to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of lastRewardTime) {
    if (now - ts > COOLDOWN_SECONDS * 1000 * 2) {
      lastRewardTime.delete(id);
    }
  }
}, 300_000);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit check
  const now = Date.now();
  const lastTime = lastRewardTime.get(session.playerId) ?? 0;
  if (now - lastTime < COOLDOWN_SECONDS * 1000) {
    const waitSecs = Math.ceil((COOLDOWN_SECONDS * 1000 - (now - lastTime)) / 1000);
    return NextResponse.json(
      { error: `Ad reward on cooldown. Wait ${waitSecs}s.`, cooldownSeconds: waitSecs },
      { status: 429 },
    );
  }

  const player = await db.player.findUnique({ where: { id: session.playerId } });
  if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  const [updated] = await db.$transaction([
    db.player.update({
      where: { id: player.id },
      data: {
        bankedChips: { increment: AD_REWARD_AMOUNT },
        totalEarned: { increment: AD_REWARD_AMOUNT },
      },
    }),
    db.purchase.create({
      data: {
        playerId: player.id,
        itemId: 'rewarded-ad',
        itemType: 'ad_reward',
        amountChips: AD_REWARD_AMOUNT,
      },
    }),
  ]);

  // Record the reward timestamp
  lastRewardTime.set(session.playerId, now);

  return NextResponse.json({ player: toProfile(updated), granted: AD_REWARD_AMOUNT });
}
