// Player helper utilities — minimal version for auth routes
import type { PlayerProfile } from './types';

// Convert a Prisma Player row to a PlayerProfile (strips passwordHash, parses JSON arrays)
export function toProfile(p: {
  id: string;
  userTag: string;
  name: string;
  email: string | null;
  country: string;
  avatar: string | null;
  role: string;
  bankedChips: number;
  totalEarned: number;
  totalLost: number;
  level: number;
  xp: number;
  lifetimeKills: number;
  lifetimeDeaths: number;
  lifetimeExtracts: number;
  bestStreak: number;
  biggestExtract: number;
  dailyStreak: number;
  lastDailyClaim: string | null;
  unlockedSkins: string;
  currentSkin: string;
  currentTrail: string;
  currentDeath: string;
  currentFlag: string | null;
  currentBanner: string | null;
  clanTag: string | null;
  clanRank: string | null;
  securityPin: string | null;
  oauthProvider: string | null;
  createdAt: Date;
  lastSeenAt: Date;
}): PlayerProfile {
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
    unlockedSkins: safeParseJSON<string[]>(p.unlockedSkins, []),
    currentSkin: p.currentSkin,
    currentTrail: p.currentTrail,
    currentDeath: p.currentDeath,
    currentFlag: p.currentFlag,
    currentBanner: p.currentBanner,
    clanTag: p.clanTag,
    clanRank: p.clanRank,
    securityPin: !!p.securityPin,
    oauthProvider: p.oauthProvider,
    createdAt: p.createdAt.toISOString(),
    lastSeenAt: p.lastSeenAt.toISOString(),
  };
}

// Encode a string array as JSON for SQLite storage
export function encodeSkins(skins: string[]): string {
  return JSON.stringify(skins);
}

// Safe JSON parse helper
function safeParseJSON<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
