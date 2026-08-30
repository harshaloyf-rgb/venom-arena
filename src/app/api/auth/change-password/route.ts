import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, signSession, setSessionCookie } from '@/lib/auth';
import { requireAuth } from '@/lib/api-helpers';

// In-memory rate limit: 5 attempts per 15 min per player
const changePwAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_CHANGE_PW = 5;
const CHANGE_PW_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    // Rate limit: 5 attempts per 15 min
    const now = Date.now();
    const attempt = changePwAttempts.get(session.playerId);
    if (attempt && now - attempt.firstAt <= CHANGE_PW_WINDOW_MS && attempt.count >= MAX_CHANGE_PW) {
      const remaining = Math.ceil((CHANGE_PW_WINDOW_MS - (now - attempt.firstAt)) / 60000);
      return NextResponse.json({ error: `Too many attempts. Try again in ${remaining} minute(s).` }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }

    const player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player || !player.passwordHash) {
      return NextResponse.json({ error: 'This account has no password set.' }, { status: 400 });
    }

    const valid = await verifyPassword(currentPassword, player.passwordHash);
    if (!valid) {
      // Increment rate limit counter
      if (attempt && now - attempt.firstAt <= CHANGE_PW_WINDOW_MS) {
        attempt.count++;
      } else {
        changePwAttempts.set(session.playerId, { count: 1, firstAt: now });
      }
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }

    // Clear rate limit on success
    changePwAttempts.delete(session.playerId);

    const newHash = await hashPassword(newPassword);
    // Increment tokenVersion to invalidate all existing sessions
    const updated = await db.player.update({
      where: { id: session.playerId },
      data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
    });

    // Re-sign session with new tokenVersion
    const token = await signSession({
      playerId: updated.id,
      userTag: updated.userTag,
      role: updated.role as 'player' | 'admin',
      tokenVersion: updated.tokenVersion,
    });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[auth/change-password] error', e);
    return NextResponse.json({ error: 'Failed to change password.' }, { status: 500 });
  }
}
