import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { PROMO_CODES } from '@/lib/game-config';
import { playerActionLimit } from '@/lib/api-helpers';

// POST /api/player/promo-reward  body: { code }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // Anti-hammer (X6): promo code brute-force damping
  const rl = playerActionLimit(session.playerId, 'promo', 5, 60_000);
  if (rl) return rl;

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

  // Credit chips and record redemption — duplicate check inside transaction
  try {
    const updated = await db.$transaction(async (tx) => {
      // Check inside tx to prevent race condition
      const existing = await tx.promoReward.findUnique({
        where: { playerId_code: { playerId, code } },
      });
      if (existing) {
        throw new Error('ALREADY_CLAIMED');
      }

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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'ALREADY_CLAIMED') {
      return NextResponse.json({ error: 'You already redeemed this promo code.' }, { status: 400 });
    }
    console.error('[promo-reward] error', e);
    return NextResponse.json({ error: 'Redemption failed.' }, { status: 500 });
  }
}
