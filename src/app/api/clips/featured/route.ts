import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/clips/featured — return the top featured clip (approved only)
// Priority: 1) Admin-featured  2) Today's best match-card  3) Highest upvoted
// No auth required
export async function GET() {
  const baseWhere = { status: 'approved' as const };

  // 1) Try admin-featured first (most recent)
  let clip = await db.clip.findFirst({
    where: { ...baseWhere, featured: true },
    orderBy: { createdAt: 'desc' },
    include: {
      player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } },
    },
  });

  // 2) Fallback: today's best match-card (highest chips, then kills)
  if (!clip) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    clip = await db.clip.findFirst({
      where: {
        ...baseWhere,
        cardType: 'match-card',
        createdAt: { gte: todayStart },
      },
      orderBy: [{ chipsExtracted: 'desc' }, { kills: 'desc' }],
      include: {
        player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } },
      },
    });
  }

  // 3) Fallback: highest upvoted ever
  if (!clip) {
    clip = await db.clip.findFirst({
      where: baseWhere,
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
      include: {
        player: { select: { name: true, userTag: true, country: true, level: true, clanTag: true } },
      },
    });
  }

  if (!clip) return NextResponse.json({ clip: null });

  return NextResponse.json({
    clip: {
      ...clip,
      tags: JSON.parse(clip.tags),
      matchData: clip.matchData ? JSON.parse(clip.matchData) : null,
    },
  });
}
