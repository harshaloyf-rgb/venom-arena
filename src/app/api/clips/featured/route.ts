import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/clips/featured — return top featured clip, or highest upvoted clip
export async function GET() {
  // Try featured first (most recent featured)
  let clip = await db.clip.findFirst({
    where: { featured: true },
    orderBy: { createdAt: 'desc' },
    include: {
      player: { select: { name: true, userTag: true, country: true, level: true } },
    },
  });

  // Fallback: highest upvoted non-featured
  if (!clip) {
    clip = await db.clip.findFirst({
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
      include: {
        player: { select: { name: true, userTag: true, country: true, level: true } },
      },
    });
  }

  if (!clip) return NextResponse.json({ clip: null });

  return NextResponse.json({
    clip: {
      ...clip,
      tags: JSON.parse(clip.tags),
    },
  });
}
