import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/clips/featured — return the top featured clip (approved only)
// Priority: 1) Admin-featured  2) Today's best match-card  3) Highest upvoted
export async function GET() {
  try {
  const session = await getSession();
  const baseWhere = { status: 'approved' as const };

  // 1) Try admin-featured first (most recent)
  let clip = await db.clip.findFirst({
    where: { ...baseWhere, featured: true },
    orderBy: { createdAt: 'desc' },
    include: { player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } } },
  });

  // 2) Fallback: today's best match-card (highest chips, then kills)
  if (!clip) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    clip = await db.clip.findFirst({
      where: { ...baseWhere, cardType: 'match-card', createdAt: { gte: todayStart } },
      orderBy: [{ chipsExtracted: 'desc' }, { kills: 'desc' }],
      include: { player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } } },
    });
  }

  // 3) Fallback: highest upvoted ever
  if (!clip) {
    clip = await db.clip.findFirst({
      where: baseWhere,
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
      include: { player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } } },
    });
  }

  if (!clip) return NextResponse.json({ clip: null });

  // Fetch current user's vote for this clip
  let myVote: 'like' | 'dislike' | null = null;
  if (session) {
    const v = await db.clipUpvote.findUnique({
      where: { playerId_clipId: { playerId: session.playerId, clipId: clip.id } },
      select: { voteType: true },
    });
    if (v) myVote = v.voteType as 'like' | 'dislike';
  }

  return NextResponse.json({
    clip: {
      ...clip,
      tags: JSON.parse(clip.tags),
      matchData: clip.matchData ? JSON.parse(clip.matchData) : null,
      likes: clip.upvotes,
      dislikes: clip.downvotes,
      myVote,
    },
  });
  } catch (e) {
    console.error('[clips/featured] error', e);
    return NextResponse.json({ clip: null, error: 'Featured clip unavailable (database error).' }, { status: 500 });
  }
}
