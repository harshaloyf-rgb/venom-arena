import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { JOIN_AD_WINDOW_MS, JADE_CORRIDOR_TIER_ID } from '@/lib/game-config';
import { adsMockEnabled } from '@/lib/ads-mock';

// GET /api/ads/gate — pre-join gate status for the signed-in player.
//
// Single source of truth for the JoinGateModal:
//   passActive  → Time Pass valid: gate never shown, join directly.
//   windowActive→ ad window valid: join directly (countdown shown in UI).
//   needsAd     → a watched ad is required before the next online join.
//   tickets     → Virtual Tickets (free Jade Corridor entry only).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const player = await db.player.findUnique({
    where: { id: session.playerId },
    select: { adFreeUntil: true, adUnlockUntil: true, tickets: true },
  });
  if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  const now = Date.now();
  const adFreeActive = !!player.adFreeUntil && player.adFreeUntil.getTime() > now;
  const windowActive = !!player.adUnlockUntil && player.adUnlockUntil.getTime() > now;

  return NextResponse.json({
    passActive: adFreeActive,
    adFreeUntil: player.adFreeUntil,
    windowActive,
    adUnlockUntil: player.adUnlockUntil,
    windowMs: JOIN_AD_WINDOW_MS,
    needsAd: !adFreeActive && !windowActive,
    tickets: player.tickets,
    ticketArenaId: JADE_CORRIDOR_TIER_ID,
    mockAds: adsMockEnabled(),
  });
}
