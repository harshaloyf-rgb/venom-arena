import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  signSession,
  setSessionCookie,
  hashPassword,
  generateUniqueUserTag,
} from '@/lib/auth';
import { toProfile, encodeSkins, generateReferralCode } from '@/lib/player-helpers';
import { DEFAULT_UNLOCKED_SKINS } from '@/lib/constants';
import { rateLimit } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 10 per 15 min per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(`register:${ip}`, 10, 15 * 60 * 1000);
    if (rl) return rl;
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    const name = String(body.name || '').trim().slice(0, 20);
    const pin = String(body.pin || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }
    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Display name must be at least 2 characters.' }, { status: 400 });
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Security PIN must be exactly 4 digits.' }, { status: 400 });
    }

    const existing = await db.player.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered. Try logging in.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userTag = await generateUniqueUserTag();
    const referralCode = generateReferralCode();

    const player = await db.player.create({
      data: {
        email,
        passwordHash,
        securityPin: pin || null,
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Email already registered. Try logging in.' }, { status: 409 });
    }
    console.error('[auth/register] error', e);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
