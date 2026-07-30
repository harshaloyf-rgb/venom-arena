// Shared player-facing types (used by both client and API routes)

export interface PlayerProfile {
  id: string;
  userTag: string;
  name: string;
  email: string | null;
  country: string;
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

  unlockedSkins: string[];
  currentSkin: string;
  currentTrail: string;
  currentDeath: string;
  currentFlag: string | null;
  currentBanner: string | null;

  clanTag: string | null;
  clanRank: string | null;

  securityPin: boolean;       // true if PIN is set
  oauthProvider: string | null; // "google" | "facebook" | "apple" | null

  createdAt: string;
  lastSeenAt: string;
}

export interface LeaderboardEntry {
  userTag: string;
  name: string;
  country: string;
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
  newLevel: number;
  newBankedChips: number;
  durationSeconds: number;
  killerName?: string;
  killerTag?: string;
  isOffline?: boolean; // true if practice mode (no XP, no chips)
}

// Snake (used in client rendering of server snapshots)
export interface SnakeSnapshot {
  id: string;
  name: string;
  userTag?: string;
  points: { x: number; y: number }[];
  angle: number;
  size: number;
  color: string;
  secondaryColor?: string;
  isPlayer: boolean;
  isBot: boolean;
  carriedChips: number;
  score: number; // body length score (INITIAL_SPAWN_SCORE + all food collected)
  isExtracting: boolean;
  extractionProgress: number; // 0..1
  isDead: boolean;
  spawnProtected: boolean;
  chatMessage?: string;
  country?: string;
  isBoosting: boolean; // whether snake is actively boosting (for head-on collision rendering)
  botState?: 'harvesting' | 'selfDestruct'; // online bots only; undefined for players
  visualRadius?: number;
  collisionRadius?: number;
}

export interface FoodSnapshot {
  id: string;
  x: number;
  y: number;
  size: number;
  value: number;
  isStarChip: boolean;
  color: string;
  glowColor?: string;
  orbSize?: 'small' | 'medium' | 'large'; // only for regular food orbs
}

export interface ArenaLeaderboardEntry {
  id: string;
  name: string;
  userTag?: string;
  carriedChips: number;
  score: number;
  kills: number;
  isPlayer: boolean;
  country?: string;
}

export interface GameSnapshot {
  arenaId: string;
  tick: number;
  snakes: SnakeSnapshot[];
  foods: FoodSnapshot[];
  worldSize: number;
  mapRadius: number; // current dynamic map radius (online) or 0 (offline infinite)
  mapCenterX: number; // center of the map
  mapCenterY: number;
  leaderId: string | null;
  leaderChips: number;
  /** Number of real (human) players in the arena — bots excluded. */
  realPlayerCount: number;
  /** Your rank among real players (1 = highest chips). 0 if not in arena. */
  yourRank: number;
  /** Top 10 real players by carried chips, for the arena leaderboard HUD. */
  arenaLeaderboard: ArenaLeaderboardEntry[];
  /** Current commission rate (0 if <=3 players, 0.35 if >=4). */
  commissionRate: number;
}
