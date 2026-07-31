import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getSession, signSession, setSessionCookie, hashPassword } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';

/**
 * POST /api/auth/upgrade
 *
 * Upgrades a guest account to a registered account.
 * Preserves ALL existing progress (chips, stats, cosmetics, friends, etc.)
 *
 * Body: { name, email, password, pin? }
 *
 * Rules & Guide Section 0:
 *   "Guest accounts can upgrade to registered later (in Profile panel).
 *    All progress carries over when upgrading."
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    const name = String(body.name || '').trim().slice(0, 20);
    const pin = String(body.pin || '').trim();

    // Validate inputs
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Display name is required.' }, { status: 400 });
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Security PIN must be exactly 4 digits.' }, { status: 400 });
    }

    // Check this player exists
    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // Only guests can upgrade (identified by null email)
    if (player.email) {
      return NextResponse.json({ error: 'This account is already registered.' }, { status: 400 });
    }

    // Check if email is already taken
    const existing = await db.player.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered. Try a different email.' }, { status: 409 });
    }

    // Upgrade: set email, password, name, PIN — keep everything else
    const passwordHash = await hashPassword(password);
    const upgraded = await db.player.update({
      where: { id: session.playerId },
      data: {
        email,
        passwordHash,
        name,
        securityPin: pin || null,
      },
    });

    // Issue a fresh session token
    const token = await signSession({
      playerId: upgraded.id,
      userTag: upgraded.userTag,
      role: upgraded.role as 'player' | 'admin',
    });
    await setSessionCookie(token);

    return NextResponse.json({ player: toProfile(upgraded) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Email already registered. Try a different email.' }, { status: 409 });
    }
    console.error('[auth/upgrade] error', e);
    return NextResponse.json({ error: 'Upgrade failed. Please try again.' }, { status: 500 });
  }
}
