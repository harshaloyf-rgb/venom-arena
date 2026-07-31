import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { PROMO_CODES } from '@/lib/game-config';

// In-memory tracking: playerId -> Set<code> to prevent double-claim
// NOTE: Redemption state is lost on server restart. Acceptable for now —
// TODO: store redemption records in the database for durability.
const redeemedPromos = new Map<string, Set<string>>();

// POST /api/player/promo-reward  body: { code }
export async function POST(req: NextRequest) {
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

  // Check if already claimed
  const playerClaimed = redeemedPromos.get(playerId);
  if (playerClaimed?.has(code)) {
    return NextResponse.json({ error: 'You already redeemed this promo code.' }, { status: 400 });
  }

  // Credit chips atomically
  const updated = await db.player.update({
    where: { id: playerId },
    data: {
      bankedChips: { increment: reward },
      totalEarned: { increment: reward },
    },
    select: { bankedChips: true },
  });

  // Record redemption
  if (!playerClaimed) {
    redeemedPromos.set(playerId, new Set([code]));
  } else {
    playerClaimed.add(code);
  }

  return NextResponse.json({
    success: true,
    reward,
    newBankedChips: updated.bankedChips,
  });
}
