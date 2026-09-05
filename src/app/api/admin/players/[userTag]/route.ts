import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/admin/players/:userTag
// Admin-only. Returns full player detail with aggregated counts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userTag: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const { userTag: rawTag } = await params;
  const userTag = rawTag.trim();

  if (!userTag) {
    return NextResponse.json({ error: 'userTag is required' }, { status: 400 });
  }

  const player = await db.player.findUnique({
    where: { userTag },
    select: {
      id: true,
      email: true,
      userTag: true,
      name: true,
      country: true,
      avatar: true,
      oauthProvider: true,
      oauthProviderId: true,
      bankedChips: true,
      totalEarned: true,
      totalLost: true,
      level: true,
      xp: true,
      lifetimeKills: true,
      lifetimeDeaths: true,
      lifetimeExtracts: true,
      bestStreak: true,
      biggestExtract: true,
      dailyStreak: true,
      lastDailyClaim: true,
      lastHourlyClaim: true,
      streakFreezes: true,
      emailVerified: true,
      region: true,
      referralCode: true,
      unlockedSkins: true,
      currentSkin: true,
      currentTrail: true,
      currentDeath: true,
      currentFlag: true,
      currentBanner: true,
      role: true,
      banned: true,
      createdAt: true,
      updatedAt: true,
      lastSeenAt: true,
      clanTag: true,
      clanRank: true,
      instagram: true,
      youtube: true,
      twitch: true,
      clan: {
        select: {
          tag: true,
          name: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const [matchCount, giftsSent, giftsReceived, friendsCount, clipCount, referredBy, referredPlayers] =
    await Promise.all([
      db.matchHistory.count({ where: { playerId: player.id } }),
      db.gift.count({ where: { fromId: player.id } }),
      db.gift.count({ where: { toId: player.id } }),
      db.friendship.count({
        where: {
          OR: [
            { initiatorId: player.id, status: 'accepted' },
            { recipientId: player.id, status: 'accepted' },
          ],
        },
      }),
      db.clip.count({ where: { playerId: player.id } }),
      // Referral support: who brought this player in (they entered a code at
      // registration) — needed to debug "my referral never paid out" tickets.
      db.referral.findFirst({
        where: { referredId: player.id },
        select: {
          status: true,
          matchesPlayed: true,
          reward: true,
          createdAt: true,
          referrer: { select: { userTag: true, name: true } },
        },
      }),
      // Referral support: players this person referred (their payout pipeline).
      db.referral.findMany({
        where: { referrerId: player.id },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          matchesPlayed: true,
          reward: true,
          createdAt: true,
          referred: { select: { userTag: true, name: true } },
        },
      }),
    ]);

  const clanMembers = player.clan
    ? { clanName: player.clan.name, memberCount: player.clan._count.members }
    : null;

  const { clan, ...playerData } = player;

  return NextResponse.json({
    ...playerData,
    matchCount,
    clanMembers,
    giftsSent,
    giftsReceived,
    friendsCount,
    clipCount,
    referredBy,
    referredPlayers,
  });
}
