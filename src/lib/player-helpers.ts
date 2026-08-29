import { db } from './db';
import type { Player } from '@prisma/client';
import type { PlayerProfile } from './types';

function safeParseArray(val: string | null | undefined): number[] {
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr.map(Number).filter(n => !isNaN(n)) : [];
  } catch {
    return [];
  }
}

/** Generate a unique VIPER-XXXX referral code */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `VIPER-${code}`;
}

/** Ensure a player has a referral code, generating one if missing (with retry on collision) */
export async function ensureReferralCode(playerId: string): Promise<string> {
  const player = await db.player.findUnique({ where: { id: playerId }, select: { referralCode: true } });
  if (player?.referralCode) return player.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await db.player.update({
        where: { id: playerId },
        data: { referralCode: code },
      });
      return updated.referralCode!;
    } catch {
      // unique constraint collision — retry
    }
  }
  throw new Error('Failed to generate unique referral code after multiple attempts');
}

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
    hasElitePass: p.hasElitePass,
    passClaimedFree: safeParseArray(p.passClaimedFree),
    passClaimedElite: safeParseArray(p.passClaimedElite),
    passXp: p.passXp,
    passXpToday: p.passXpToday,
    passXpDate: p.passXpDate ?? null,
    clanTag: p.clanTag,
    clanRank: p.clanRank,
    securityPin: !!p.securityPin,
    oauthProvider: p.oauthProvider,
    instagram: p.instagram,
    youtube: p.youtube,
    twitch: p.twitch,
    instagramVerified: p.instagramVerified ?? false,
    youtubeVerified: p.youtubeVerified ?? false,
    twitchVerified: p.twitchVerified ?? false,
    nameChangedAt: p.nameChangedAt?.toISOString() ?? null,
    countryChangedAt: p.countryChangedAt?.toISOString() ?? null,
    emailVerified: p.emailVerified ?? false,
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
