import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  signSession,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const player = await db.player.findUnique({ where: { email } });
    if (!player || !player.passwordHash) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
    if (player.banned) {
      return NextResponse.json({ error: 'This account has been banned.' }, { status: 403 });
    }

    const ok = await verifyPassword(password, player.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    await db.player.update({
      where: { id: player.id },
      data: { lastSeenAt: new Date() },
    });

    const token = await signSession({
      playerId: player.id,
      userTag: player.userTag,
      role: player.role as 'player' | 'admin',
    });
    await setSessionCookie(token);

    return NextResponse.json({ player: toProfile(player) });
  } catch (e) {
    console.error('[auth/login] error', e);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
