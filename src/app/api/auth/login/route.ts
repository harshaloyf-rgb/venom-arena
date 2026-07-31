import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  signSession,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import { rateLimit } from '@/lib/api-helpers';

const SESSION_REMEMBER_DAYS = 30;
const SESSION_DEFAULT_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 10 per 15 min per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (rl) return rl;
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    const remember = Boolean(body.remember);

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

    const sessionDays = remember ? SESSION_REMEMBER_DAYS : SESSION_DEFAULT_DAYS;
    const token = await signSession({
      playerId: player.id,
      userTag: player.userTag,
      role: player.role as 'player' | 'admin',
    }, `${sessionDays}d`);
    await setSessionCookie(token, sessionDays * 24 * 60 * 60);

    return NextResponse.json({ player: toProfile(player) });
  } catch (e) {
    console.error('[auth/login] error', e);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
