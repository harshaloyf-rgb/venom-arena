import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/player/follow?tag=VM-XXXXXX → { following: boolean, followersCount, followingCount }
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tag = req.nextUrl.searchParams.get('tag')?.trim();
    if (!tag) {
      // Return own counts
      const [followersCount, followingCount] = await Promise.all([
        db.follow.count({ where: { followingId: session.playerId } }),
        db.follow.count({ where: { followerId: session.playerId } }),
      ]);
      return NextResponse.json({ followersCount, followingCount });
    }

    // Check relationship with specific player
    const target = await db.player.findUnique({ where: { userTag: tag }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const [existing, followersCount, followingCount] = await Promise.all([
      tag === session.userTag ? null : db.follow.findUnique({
        where: { followerId_followingId: { followerId: session.playerId, followingId: target.id } },
      }),
      db.follow.count({ where: { followingId: target.id } }),
      db.follow.count({ where: { followerId: target.id } }),
    ]);

    // For own profile following count
    const myFollowingCount = tag === session.userTag
      ? await db.follow.count({ where: { followerId: session.playerId } })
      : 0;

    return NextResponse.json({
      following: !!existing,
      followersCount,
      followingCount: tag === session.userTag ? myFollowingCount : followingCount,
    });
  } catch (e) {
    console.error('[follow/get] error', e);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}

// POST /api/player/follow { tag: string } — toggle follow/unfollow
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tag = String(body.tag || '').trim();
    if (!tag) return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
    if (tag === session.userTag) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

    const target = await db.player.findUnique({ where: { userTag: tag }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const existing = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: session.playerId, followingId: target.id } },
    });

    if (existing) {
      await db.follow.delete({ where: { id: existing.id } });
      const fc = await db.follow.count({ where: { followingId: target.id } });
      return NextResponse.json({ following: false, followersCount: fc });
    } else {
      await db.follow.create({ data: { followerId: session.playerId, followingId: target.id } });
      const fc = await db.follow.count({ where: { followingId: target.id } });
      return NextResponse.json({ following: true, followersCount: fc });
    }
  } catch (e) {
    console.error('[follow/post] error', e);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
