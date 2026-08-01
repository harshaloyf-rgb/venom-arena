import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { PROMO_CODES } from '@/lib/game-config';

// POST /api/player/promo-reward  body: { code }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || '').trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: 'Promo code is required.' }, { status: 400 });
  }

  // Look up reward amount
  const reward = PROMO_CODES[code];
  if (!reward) {
    return NextResponse.json({ error: `Invalid or expired promo code. Try "VENOM" or "CHAMPION".` }, { status: 400 });
  }

  const playerId = session.playerId;

  // Check if already claimed (DB-backed)
  const existing = await db.promoReward.findFirst({
    where: { playerId, code },
  });
  if (existing) {
    return NextResponse.json({ error: 'You already redeemed this promo code.' }, { status: 400 });
  }

  // Credit chips and record redemption in a transaction
  const updated = await db.$transaction(async (tx) => {
    const player = await tx.player.update({
      where: { id: playerId },
      data: {
        bankedChips: { increment: reward },
        totalEarned: { increment: reward },
      },
    });
    await tx.promoReward.create({
      data: { playerId, code, reward },
    });
    return player;
  });

  return NextResponse.json({
    player: toProfile(updated),
    reward,
    label: `${code} promo code`,
  });
}
