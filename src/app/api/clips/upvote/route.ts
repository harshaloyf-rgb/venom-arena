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

  // Create upvote + increment inside transaction — check inside tx to prevent race
  try {
    const clip = await db.$transaction(async (tx) => {
      // Check for existing upvote inside transaction
      const existing = await tx.clipUpvote.findUnique({
        where: { playerId_clipId: { playerId: session.playerId, clipId } },
      });
      if (existing) {
        throw new Error('ALREADY_UPVOTED');
      }

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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'ALREADY_UPVOTED') {
      return NextResponse.json({ ok: true, already: true });
    }
    console.error('[clips/upvote] error', e);
    return NextResponse.json({ error: 'Upvote failed.' }, { status: 500 });
  }
}
