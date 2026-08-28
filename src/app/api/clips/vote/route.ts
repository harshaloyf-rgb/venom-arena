import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clips/vote  { clipId: string, vote: 'like' | 'dislike' }
// Toggle logic:
//   No existing vote → create with given type
//   Same vote type   → delete (undo)
//   Different type   → update type (switch)
export async function POST(req: globalThis.Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { clipId?: string; vote?: string } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  const { clipId, vote } = body;
  if (!clipId || (vote !== 'like' && vote !== 'dislike')) {
    return NextResponse.json({ error: 'clipId and vote (like|dislike) required.' }, { status: 400 });
  }

  const voteType = vote as 'like' | 'dislike';

  try {
    const result = await db.$transaction(async (tx) => {
      const clip = await tx.clip.findUnique({ where: { id: clipId }, select: { id: true, upvotes: true, downvotes: true } });
      if (!clip) throw new Error('CLIP_NOT_FOUND');

      const existing = await tx.clipUpvote.findUnique({
        where: { playerId_clipId: { playerId: session.playerId, clipId } },
      });

      let newUpvotes = clip.upvotes;
      let newDownvotes = clip.downvotes;
      let myVote: 'like' | 'dislike' | null = null;

      if (!existing) {
        await tx.clipUpvote.create({ data: { playerId: session.playerId, clipId, voteType } });
        if (voteType === 'like') newUpvotes++; else newDownvotes++;
        myVote = voteType;
      } else if (existing.voteType === voteType) {
        await tx.clipUpvote.delete({ where: { id: existing.id } });
        if (voteType === 'like') newUpvotes--; else newDownvotes--;
        myVote = null;
      } else {
        await tx.clipUpvote.update({ where: { id: existing.id }, data: { voteType } });
        if (existing.voteType === 'like') { newUpvotes--; newDownvotes++; }
        else { newDownvotes--; newUpvotes++; }
        myVote = voteType;
      }

      await tx.clip.update({ where: { id: clipId }, data: { upvotes: newUpvotes, downvotes: newDownvotes } });
      return { upvotes: newUpvotes, downvotes: newDownvotes, myVote };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'CLIP_NOT_FOUND') return NextResponse.json({ error: 'Clip not found.' }, { status: 404 });
    console.error('[clips/vote] error', e);
    return NextResponse.json({ error: 'Vote failed.' }, { status: 500 });
  }
}
