import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { requireAuth, rateLimit } from '@/lib/api-helpers';

export async function POST() {
  const { session, error } = await requireAuth();
  if (error) return error;

  // Rate limit: 1 request per 60 seconds per player
  const rl = rateLimit(`send-verify:${session.playerId}`, 1, 60_000);
  if (rl) return rl;

  const player = await db.player.findUnique({
    where: { id: session.playerId },
    select: { email: true, emailVerified: true },
  });

  if (!player?.email) {
    return NextResponse.json({ error: 'No email on file.' }, { status: 400 });
  }

  if (player.emailVerified) {
    return NextResponse.json({ error: 'Email already verified.' }, { status: 400 });
  }

  // Generate a random 32-char hex token
  const token = randomBytes(16).toString('hex');

  // Delete any existing tokens for this email
  await db.verificationToken.deleteMany({ where: { email: player.email } });

  // Store new token with 24h expiry
  await db.verificationToken.create({
    data: {
      token,
      email: player.email,
      playerId: session.playerId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // In production this would send via Resend/SendGrid
  return NextResponse.json({ sent: true, token });
}
