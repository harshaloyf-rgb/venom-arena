import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { playerActionLimit } from '@/lib/api-helpers';
import { MAX_DAILY_ADS, AD_REWARD_CHIPS, JOIN_AD_WINDOW_MS } from '@/lib/game-config';
import { rewardedAdsAvailable } from '@/lib/ads';

const SESSION_TTL_MS = 10 * 60 * 1000; // nonce lives 10 minutes

// GET /api/ads/session            → today's ad status (card counter)
// GET /api/ads/session?nonce=XXX  → poll a specific session { credited, purpose }
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const nonce = req.nextUrl.searchParams.get('nonce');

  if (nonce) {
    const row = await db.adRewardSession.findUnique({ where: { nonce } });
    // Only the owning player may poll a nonce.
    if (!row || row.playerId !== session.playerId) {
      return NextResponse.json({ error: 'Unknown ad session.' }, { status: 404 });
    }
    const adsToday = await adsTodayCount(session.playerId);
    const base: Record<string, unknown> = {
      credited: row.consumed,
      purpose: row.purpose,
      adsToday,
      dailyCap: MAX_DAILY_ADS,
    };
    if (row.purpose === 'join' && row.consumed) {
      // Join-gate sessions unlock the window instead of crediting chips.
      const player = await db.player.findUnique({
        where: { id: session.playerId },
        select: { adUnlockUntil: true },
      });
      base.unlockUntil = player?.adUnlockUntil ?? null;
      base.windowMs = JOIN_AD_WINDOW_MS;
    }
    return NextResponse.json(base);
  }

  const adsToday = await adsTodayCount(session.playerId);
  return NextResponse.json({
    adsAvailable: rewardedAdsAvailable(),
    adsToday,
    dailyCap: MAX_DAILY_ADS,
    rewardPerAd: AD_REWARD_CHIPS,
    remaining: Math.max(0, MAX_DAILY_ADS - adsToday),
  });
}

// POST /api/ads/session → issue a one-time nonce bound to this player.
// The nonce travels inside the ad's SSV custom_data (<=64 bytes) and comes
// back signed by Google to /api/ads/ssv — that callback is the ONLY way
// chips are credited / the join window is unlocked for an ad.
//
// Body: { purpose?: 'chips' | 'join' } (default 'chips')
//   chips → watch-ad-for-chips faucet (daily-capped)
//   join  → pre-join gate unlock (NOT chip-capped — needing an ad per
//           10-min window is already self-limiting; the action rate limit
//           below still applies)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = playerActionLimit(session.playerId, 'ads-session', 10, 60_000);
  if (rl) return rl;

  const body = await req.json().catch(() => ({}));
  const purpose = body?.purpose === 'join' ? 'join' : 'chips';

  if (!rewardedAdsAvailable()) {
    return NextResponse.json({ error: 'Rewarded ads are not available in this client.' }, { status: 403 });
  }

  const adsToday = await adsTodayCount(session.playerId);
  if (purpose === 'chips' && adsToday >= MAX_DAILY_ADS) {
    return NextResponse.json(
      { error: `Daily ad limit reached (${MAX_DAILY_ADS}/${MAX_DAILY_ADS}). Resets at 00:00 UTC.` },
      { status: 429 },
    );
  }

  const nonce = crypto.randomBytes(16).toString('hex'); // 32 chars — fits the 64-byte SSV custom_data cap
  await db.adRewardSession.create({
    data: { playerId: session.playerId, nonce, purpose },
  });

  return NextResponse.json({
    nonce,
    adsToday,
    dailyCap: MAX_DAILY_ADS,
    remaining: Math.max(0, MAX_DAILY_ADS - adsToday),
    expiresInMs: SESSION_TTL_MS,
  });
}

async function adsTodayCount(playerId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return db.videoReward.count({ where: { playerId, createdAt: { gte: todayStart } } });
}
