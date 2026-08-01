import { db } from './db';
import type { Player } from '@prisma/client';
import type { PlayerProfile } from './types';

export function toProfile(p: Player): PlayerProfile {
  let unlocked: string[] = [];
  try {
    unlocked = JSON.parse(p.unlockedSkins || '[]');
    if (!Array.isArray(unlocked)) unlocked = [];
  } catch {
    unlocked = [];
  }
  return {
    id: p.id,
    userTag: p.userTag,
    name: p.name,
    email: p.email,
    country: p.country,
    avatar: p.avatar,
    role: p.role as 'player' | 'admin',
    bankedChips: p.bankedChips,
    totalEarned: p.totalEarned,
    totalLost: p.totalLost,
    level: p.level,
    xp: p.xp,
    lifetimeKills: p.lifetimeKills,
    lifetimeDeaths: p.lifetimeDeaths,
    lifetimeExtracts: p.lifetimeExtracts,
    bestStreak: p.bestStreak,
    biggestExtract: p.biggestExtract,
    dailyStreak: p.dailyStreak,
    lastDailyClaim: p.lastDailyClaim,
    lastHourlyClaim: p.lastHourlyClaim?.toISOString() ?? null,
    streakFreezes: p.streakFreezes,
    referralCode: p.referralCode,
    unlockedSkins: unlocked,
    currentSkin: p.currentSkin,
    currentTrail: p.currentTrail,
    currentDeath: p.currentDeath,
    currentFlag: p.currentFlag,
    currentBanner: p.currentBanner,
    clanTag: p.clanTag,
    clanRank: p.clanRank,
    securityPin: !!p.securityPin,
    oauthProvider: p.oauthProvider,
    instagram: p.instagram,
    youtube: p.youtube,
    twitch: p.twitch,
    createdAt: p.createdAt.toISOString(),
    lastSeenAt: p.lastSeenAt.toISOString(),
  };
}

// Serialized JSON helper for unlockedSkins
export function encodeSkins(skins: string[]): string {
  return JSON.stringify(Array.from(new Set(skins)));
}

export async function getFirstAdmin(): Promise<Player | null> {
  const admin = await db.player.findFirst({ where: { role: 'admin' } });
  return admin;
}
