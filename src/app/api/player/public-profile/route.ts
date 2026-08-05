import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/player/public-profile?tag=VENOM-XXXX
 * Returns publicly-visible data for any player (no auth required).
 * Used by inspection modals (leaderboard, HOF, clan, etc.)
 */
export async function GET(req: NextRequest) {
  try {
    const tag = req.nextUrl.searchParams.get('tag')?.trim();
    if (!tag) return NextResponse.json({ error: 'Missing tag' }, { status: 400 });

    const player = await db.player.findUnique({
      where: { userTag: tag },
      select: {
        id: true,
        name: true,
        userTag: true,
        country: true,
        avatar: true,
        level: true,
        bankedChips: true,
        lifetimeKills: true,
        lifetimeDeaths: true,
        lifetimeExtracts: true,
        bestStreak: true,
        biggestExtract: true,
        totalEarned: true,
        totalLost: true,
        currentSkin: true,
        currentTrail: true,
        currentDeath: true,
        currentFlag: true,
        currentBanner: true,
        clanTag: true,
        clanRank: true,
        instagram: true,
        youtube: true,
        twitch: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });

    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    // Count friends (accepted friendships)
    const friendsCount = await db.friendship.count({
      where: {
        AND: [
          { status: 'accepted' },
          { OR: [{ initiatorId: player.id }, { recipientId: player.id }] },
        ],
      },
    });

    // Count followers and following
    const [followersCount, followingCount, rivalsCount] = await Promise.all([
      db.follow.count({ where: { followingId: player.id } }),
      db.follow.count({ where: { followerId: player.id } }),
      db.rival.count({ where: { playerId: player.id } }),
    ]);

    // Fetch milestones
    const milestones = await db.playerMilestone.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch HOF entries
    const hofEntries = await db.hallOfFameEntry.findMany({
      where: { playerId: player.id },
      orderBy: { inductedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      ...player,
      friendsCount,
      followersCount,
      followingCount,
      rivalsCount,
      milestones,
      hofEntries,
    });
  } catch (e) {
    console.error('[public-profile] error', e);
    return NextResponse.json({ error: 'Failed to load profile.' }, { status: 500 });
  }
}
