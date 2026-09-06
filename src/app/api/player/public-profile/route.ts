import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HALL_OF_FAME_TIERS } from '@/lib/game-config';

/**
 * GET /api/player/public-profile?tag=VM-XXXXXX
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
    const hofEntriesRaw = await db.hallOfFameEntry.findMany({
      where: { playerId: player.id },
      orderBy: { inductedAt: 'desc' },
      take: 20,
    });

    // Sort by badge prestige so the player's HIGHEST badge is listed first in
    // the inspector (FAQ 47 / Section 14 promise "highest badge in inspector").
    const milestoneChipsById = new Map(HALL_OF_FAME_TIERS.map((t) => [t.id, t.chips]));
    const badgeScore = (e: (typeof hofEntriesRaw)[number]): number => {
      if (e.inductionType === 'milestone') {
        const chips = e.milestoneTierId ? milestoneChipsById.get(e.milestoneTierId) : undefined;
        return chips ? 40 + chips / 1_000_000 : 40; // 100K..10M → ~40.1..50
      }
      // Championship: crown > silver > bronze > contender
      if (e.championshipRank === 1) return 100;
      if ((e.championshipRank ?? 999) <= 10) return 30;
      if ((e.championshipRank ?? 999) <= 50) return 20;
      return 10;
    };
    const hofEntries = [...hofEntriesRaw].sort((a, b) => {
      const diff = badgeScore(b) - badgeScore(a);
      if (diff !== 0) return diff;
      return new Date(a.inductedAt).getTime() - new Date(b.inductedAt).getTime();
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
