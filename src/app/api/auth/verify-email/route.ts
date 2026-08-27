import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    select: { id: true },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found for this email.' }, { status: 400 });
  }

  await db.player.update({
    where: { id: player.id },
    data: { emailVerified: true },
  });

  // Delete the used token
  await db.verificationToken.delete({ where: { id: record.id } });

  return NextResponse.json({ verified: true });
}
