import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// In-memory rate limiting: email -> { count, firstAt }
const forgotAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_FORGOT_ATTEMPTS = 5;
const FORGOT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

    // Rate limiting
    const now = Date.now();
    const attempt = forgotAttempts.get(email);
    if (attempt) {
      if (now - attempt.firstAt > FORGOT_WINDOW_MS) {
        // Window expired, reset
        forgotAttempts.delete(email);
      } else if (attempt.count >= MAX_FORGOT_ATTEMPTS) {
        const remainingMs = FORGOT_WINDOW_MS - (now - attempt.firstAt);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${remainingMin} minute(s).` },
          { status: 429 },
        );
      }
    }

    // Find the player by email (use generic message to prevent email enumeration)
    const player = await db.player.findUnique({ where: { email } });
    if (!player || !player.passwordHash || !player.securityPin) {
      // Always return the same generic message regardless of which check failed
      return NextResponse.json(
        { error: 'If the email and PIN are correct, the password has been reset.' },
        { status: 200 },
      );
    }

    // Increment attempt counter before checking PIN
    const existing = forgotAttempts.get(email);
    if (existing && now - existing.firstAt <= FORGOT_WINDOW_MS) {
      existing.count++;
    } else {
      forgotAttempts.set(email, { count: 1, firstAt: now });
    }

    const valid = await bcrypt.compare(securityPin, player.securityPin);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect Security PIN. Please try again.' }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);
    await db.player.update({
      where: { id: player.id },
      data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
    });

    // Clear rate limit on success
    forgotAttempts.delete(email);

    return NextResponse.json({ ok: true, message: 'Password has been reset. You can now log in.' });
  } catch (e) {
    console.error('[auth/forgot-password] error', e);
    return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 });
  }
}
