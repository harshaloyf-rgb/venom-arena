import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { playerActionLimit } from '@/lib/api-helpers';
import { JOIN_AD_WINDOW_MS } from '@/lib/game-config';
import { adsMockEnabled } from '@/lib/ads-mock';

// POST /api/ads/mock-complete — DEV/PREVIEW-ONLY join-gate unlock.
//
// Simulates the full rewarded-ad trust path for environments where the AdMob
// SDK cannot run (web/preview): the server mints the nonce, creates the
// AdRewardSession (purpose='join') and consumes it in one server-side step —
// the client never supplies a nonce, so the session invariant (server-issued,
// single-use) is preserved even in dev.
//
// SECURITY: 403 unless NEXT_PUBLIC_ADS_MOCK=true. Never set that env in
// production — real unlocks must come from the signed AdMob SSV callback.
export async function POST(req: NextRequest) {
  if (!adsMockEnabled()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const rl = playerActionLimit(session.playerId, 'ads-mock', 10, 60_000);
  if (rl) return rl;

  const nonce = await db.$transaction(async (tx) => {
    const minted = crypto.randomUUID().replace(/-/g, ''); // 32 hex chars, like the SSV path
    await tx.adRewardSession.create({
      data: { playerId: session.playerId, nonce: minted, purpose: 'join', consumed: true, consumedAt: new Date() },
    });
    await tx.player.update({
      where: { id: session.playerId },
      data: { adUnlockUntil: new Date(Date.now() + JOIN_AD_WINDOW_MS) },
    });
    return minted;
  });

  const player = await db.player.findUnique({
    where: { id: session.playerId },
    select: { adUnlockUntil: true },
  });

  return NextResponse.json({
    unlocked: true,
    mock: true,
    nonce,
    unlockUntil: player?.adUnlockUntil ?? null,
    windowMs: JOIN_AD_WINDOW_MS,
  });
}
