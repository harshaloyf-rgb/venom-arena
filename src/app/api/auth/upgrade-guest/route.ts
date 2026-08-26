import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    if (player.passwordHash) {
      return NextResponse.json({ error: 'This account is already registered.' }, { status: 409 });
    }

    // Check if email is already taken
    const existing = await db.player.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const updated = await db.player.update({
      where: { id: session.playerId },
      data: { email, passwordHash },
    });

    return NextResponse.json({ player: toProfile(updated) });
  } catch (e) {
    console.error('[auth/upgrade-guest] error', e);
    return NextResponse.json({ error: 'Failed to upgrade account.' }, { status: 500 });
  }
}
