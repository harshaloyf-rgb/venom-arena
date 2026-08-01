import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  signSession,
  setSessionCookie,
  generateUniqueUserTag,
} from '@/lib/auth';
import { toProfile, encodeSkins, generateReferralCode } from '@/lib/player-helpers';
import { DEFAULT_UNLOCKED_SKINS } from '@/lib/constants';
import { rateLimit } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 10 per 15 min per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(`guest:${ip}`, 10, 15 * 60 * 1000);
    if (rl) return rl;
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || 'Guest').trim().slice(0, 20) || 'Guest';

    const userTag = await generateUniqueUserTag();
    const referralCode = generateReferralCode();
    const player = await db.player.create({
      data: {
        email: null,
        passwordHash: null,
        userTag,
        name,
        country: 'US',
        unlockedSkins: encodeSkins(DEFAULT_UNLOCKED_SKINS),
        bankedChips: 150,
        totalEarned: 150,
        referralCode,
      },
    });

    const token = await signSession({
      playerId: player.id,
      userTag: player.userTag,
      role: 'player',
    });
    await setSessionCookie(token);

    return NextResponse.json({ player: toProfile(player) });
  } catch (e) {
    console.error('[auth/guest] error', e);
    return NextResponse.json({ error: 'Guest login failed.' }, { status: 500 });
  }
}
