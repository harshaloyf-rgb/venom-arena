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
  commission: number; // 35% commission on extract
  bankedAmount: number; // actual chips banked after commission
  kills: number;
  score: number; // body-length score
  deaths: number; // 0 or 1
  xpGained: number;
  newLevel: number;
  newBankedChips: number;
  durationSeconds: number;
  killerName?: string;
  killerTag?: string;
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
  score: number; // body length score (regular food + star chips grow this)
  isExtracting: boolean;
  extractionProgress: number; // 0..1
  isDead: boolean;
  spawnProtected: boolean;
  chatMessage?: string;
  country?: string;
}

export interface FoodSnapshot {
  id: string;
  x: number;
  y: number;
  size: number;
  value: number;
  isStarChip: boolean;
  color: string;
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
