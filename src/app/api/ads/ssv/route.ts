import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MAX_DAILY_ADS, AD_REWARD_CHIPS } from '@/lib/game-config';
import { verifySsvCallback } from '@/lib/ads-ssv';

const SESSION_TTL_MS = 10 * 60 * 1000;

// GET /api/ads/ssv — AdMob Server-Side Verification callback (Google → us).
//
// This is the ONLY path that credits rewarded-ad chips. Google calls this URL
// (configured per ad unit in the AdMob console) right after a user earns the
// reward, with a cryptographically signed query string. We:
//   1. verify the ECDSA signature against Google's public verifier keys,
//   2. look up the AdRewardSession by the signed custom_data nonce,
//   3. claim the nonce (single-use) and credit AD_REWARD_CHIPS inside one
//      transaction that also enforces the daily cap — same hardening as the
//      old video-reward route, but now the "ad was watched" proof is real.
//
// Google expects HTTP 200 and retries non-200 up to five times. We always
// answer 200 with a status body; retry storms only happen for genuine
// delivery problems, never for rejected/forged callbacks.
export async function GET(req: NextRequest) {
  // Keep the RAW query string — the signature covers it percent-encoded.
  const rawQuery = (new URL(req.url).search || '').replace(/^\?/, '');

  try {
    const { customData } = await verifySsvCallback(rawQuery);
    const nonce = customData;

    if (!nonce) {
      return NextResponse.json({ status: 'rejected', reason: 'missing custom_data' });
    }

    const result = await db.$transaction(async (tx) => {
      const row = await tx.adRewardSession.findUnique({ where: { nonce } });
      if (!row) return 'unknown_session' as const;
      if (Date.now() - row.createdAt.getTime() > SESSION_TTL_MS) return 'expired' as const;

      // Single-use claim — replays and concurrent callbacks no-op here.
      const claimed = await tx.adRewardSession.updateMany({
        where: { id: row.id, consumed: false },
        data: { consumed: true, consumedAt: new Date() },
      });
      if (claimed.count !== 1) return 'already_used' as const;

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayCount = await tx.videoReward.count({
        where: { playerId: row.playerId, createdAt: { gte: todayStart } },
      });
      if (todayCount >= MAX_DAILY_ADS) return 'daily_cap' as const;

      const player = await tx.player.update({
        where: { id: row.playerId },
        data: {
          bankedChips: { increment: AD_REWARD_CHIPS },
          totalEarned: { increment: AD_REWARD_CHIPS },
        },
      });
      await tx.videoReward.create({ data: { playerId: row.playerId, reward: AD_REWARD_CHIPS } });
      void player;
      return 'credited' as const;
    });

    return NextResponse.json({ status: result });
  } catch (e) {
    // Signature/verification failures: answer 200 so Google does not retry a
    // forged or malformed callback. Everything is logged for ops review.
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[ads/ssv] rejected callback:', msg, '\n[ads/ssv] raw query:', rawQuery);
    return NextResponse.json({ status: 'rejected', reason: 'verification_failed' });
  }
}
