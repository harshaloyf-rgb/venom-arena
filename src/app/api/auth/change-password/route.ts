import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hashPassword, verifyPassword, signSession, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
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
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }

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
