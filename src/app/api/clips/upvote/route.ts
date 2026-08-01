import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clips/upvote
export async function POST(req: globalThis.Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { clipId } = body;
  if (!clipId) return NextResponse.json({ error: 'clipId required' }, { status: 400 });

  // Check for existing upvote
  const existing = await db.clipUpvote.findUnique({
    where: { playerId_clipId: { playerId: session.playerId, clipId } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Create upvote + increment in transaction
  const clip = await db.$transaction(async (tx) => {
    await tx.clipUpvote.create({
      data: { playerId: session.playerId, clipId },
    });
    return tx.clip.update({
      where: { id: clipId },
      data: { upvotes: { increment: 1 } },
      select: { upvotes: true },
    });
  });

  return NextResponse.json({ ok: true, upvotes: clip.upvotes });
}
