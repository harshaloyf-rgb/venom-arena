// Shared player-facing types (used by both client and API routes)

export interface PlayerProfile {
  id: string;
  userTag: string;
  name: string;
  email: string | null;
  country: string;
  region: string;
  avatar: string | null;
  role: 'player' | 'admin';

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
  lastHourlyClaim: string | null;
  streakFreezes: number;
  referralCode: string | null;

  unlockedSkins: string[];
  currentSkin: string;
  currentTrail: string;
  currentDeath: string;
  currentFlag: string | null;
  currentBanner: string | null;

  // Season Pass
  hasElitePass: boolean;
  passClaimedFree: number[];
  passClaimedElite: number[];
  passXp: number;
  passXpToday: number;
  passXpDate: string | null;

  clanTag: string | null;
  clanRank: string | null;

  securityPin: boolean;       // true if PIN is set
  oauthProvider: string | null; // "google" | "facebook" | "apple" | null

  instagram: string | null;
  youtube: string | null;
  twitch: string | null;
  instagramVerified: boolean;
  youtubeVerified: boolean;
  twitchVerified: boolean;

  nameChangedAt: string | null;
  countryChangedAt: string | null;

  emailVerified: boolean;

  createdAt: string;
  lastSeenAt: string;
}

export interface LeaderboardEntry {
  userTag: string;
  name: string;
  country: string;
  region: string;
  bankedChips: number;
  level: number;
  rank: number;
  isPlayer?: boolean;
}

export interface MatchResult {
  outcome: 'extract' | 'death';
  arenaId: string;
  arenaName: string;
  chipsExtracted: number; // chips taken out (extract) or lost (death)
  commission: number; // 35% commission on extract (0 if <=3 players)
  bankedAmount: number; // actual chips banked after commission
  kills: number;
  score: number; // body-length score at end
  deaths: number; // 0 or 1
  xpGained: number; // XP: floor((score*5 + kills*50) * rewardMultiplier) — only on extract
  passXpGained: number; // Pass XP earned this match
  newPassTier: number; // Current pass tier after this match
  newLevel: number;
  newBankedChips: number;
  durationSeconds: number;
  killerName?: string;
  killerTag?: string;
  isOffline?: boolean; // true if practice mode (no XP, no chips)
}
