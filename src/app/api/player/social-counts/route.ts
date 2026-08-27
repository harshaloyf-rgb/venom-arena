import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/player/social-counts — lightweight social stats for profile
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [friendsCount, followersCount, followingCount, rivalsCount] = await Promise.all([
      db.friendship.count({
        where: {
          OR: [
            { initiatorId: session.playerId, status: 'accepted' },
            { recipientId: session.playerId, status: 'accepted' },
          ],
        },
      }),
      db.follow.count({ where: { followingId: session.playerId } }),
      db.follow.count({ where: { followerId: session.playerId } }),
      db.rival.count({ where: { playerId: session.playerId } }),
    ]);

    return NextResponse.json({ friendsCount, followersCount, followingCount, rivalsCount });
  } catch (e) {
    console.error('[social-counts] error', e);
    return NextResponse.json({ error: 'Failed to load social counts.' }, { status: 500 });
  }
}
