import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EMAIL_VERIFY_BONUS } from '@/lib/game-config';

export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  // Look up the token
  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 });
  }

  // Check expiry
  if (record.expiresAt < new Date()) {
    await db.verificationToken.delete({ where: { id: record.id } });
    return NextResponse.json({ error: 'Token expired. Please request a new one.' }, { status: 410 });
  }

  // Find the player by email and mark verified
  const player = await db.player.findUnique({
    where: { email: record.email },
    select: { id: true, emailVerified: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found for this email.' }, { status: 400 });
  }

  // Already verified — idempotent
  if (player.emailVerified) {
    await db.verificationToken.delete({ where: { id: record.id } });
    return NextResponse.json({ verified: true, bonusGranted: false, message: 'Email already verified.' });
  }

  // Mark verified AND grant chip bonus
  const updated = await db.player.update({
    where: { id: player.id },
    data: {
      emailVerified: true,
      bankedChips: { increment: EMAIL_VERIFY_BONUS },
      totalEarned: { increment: EMAIL_VERIFY_BONUS },
    },
  });

  // Delete the used token
  await db.verificationToken.delete({ where: { id: record.id } });

  return NextResponse.json({
    verified: true,
    bonusGranted: true,
    bonusChips: EMAIL_VERIFY_BONUS,
    newBankedChips: updated.bankedChips,
    message: `Email verified! You earned +${EMAIL_VERIFY_BONUS} chips as a verification bonus.`,
  });
}
