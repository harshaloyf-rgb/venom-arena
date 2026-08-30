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
import { detectCountry } from '@/lib/geoip';
import { COUNTRIES, regionOf } from '@/lib/game-config';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 10 per 15 min per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(`guest:${ip}`, 10, 15 * 60 * 1000);
    if (rl) return rl;
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || 'Guest').trim().slice(0, 20) || 'Guest';

    // Country: use client-provided value if valid, otherwise auto-detect via GeoIP
    let country: string;
    const clientCountry = String(body.country || '').trim();
    if (clientCountry && clientCountry !== 'AUTO' && COUNTRIES.some(c => c.code === clientCountry)) {
      country = clientCountry;
    } else {
      // GeoIP auto-detect (returns '' for private/localhost IPs)
      country = await detectCountry(ip, req.headers);
      // If GeoIP can't determine (localhost, no CF header, API failure), require manual selection
      if (!country) {
        return NextResponse.json(
          { error: 'Please select your country to continue.', code: 'COUNTRY_REQUIRED' },
          { status: 400 },
        );
      }
    }

    // Compute region from country
    const region = regionOf(country);

    const userTag = await generateUniqueUserTag();
    const referralCode = generateReferralCode();
    const player = await db.player.create({
      data: {
        email: null,
        passwordHash: null,
        userTag,
        name,
        country,
        region,
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
