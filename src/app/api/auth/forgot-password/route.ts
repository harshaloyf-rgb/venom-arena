import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').toLowerCase().trim();
    const securityPin = String(body.securityPin || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!/^\d{4}$/.test(securityPin)) {
      return NextResponse.json({ error: 'A valid 4-digit Security PIN is required.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }

    // Find the player by email
    const player = await db.player.findUnique({ where: { email } });
    if (!player) {
      return NextResponse.json({ error: 'No account found with that email.' }, { status: 404 });
    }
    if (!player.passwordHash) {
      return NextResponse.json(
        { error: 'This is a guest account. Guest accounts have no password to reset.' },
        { status: 400 }
      );
    }
    if (!player.securityPin) {
      return NextResponse.json(
        { error: 'This account has no Security PIN set. PIN is required for password recovery. Please create a new account or contact an admin.' },
        { status: 400 }
      );
    }
    if (player.securityPin !== securityPin) {
      return NextResponse.json({ error: 'Incorrect Security PIN. Please try again.' }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);
    await db.player.update({
      where: { id: player.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ ok: true, message: 'Password has been reset. You can now log in.' });
  } catch (e) {
    console.error('[auth/forgot-password] error', e);
    return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 });
  }
}
