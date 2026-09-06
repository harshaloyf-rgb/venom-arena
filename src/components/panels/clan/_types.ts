import type { LucideIcon } from 'lucide-react';
import type { ToastFn } from '../_panel-primitives';
import type { InspectedPlayer } from '@/lib/game-config';
import { Coins, UserMinus, MessageSquare, Zap } from 'lucide-react';

// ──── Interfaces ───────────────────────────────────────────

export interface ClanSystemProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

export type Tab = 'mine' | 'browse' | 'form';
export type MineSubTab = 'overview' | 'challenges' | 'wars' | 'activity' | 'stats';

export interface ClanInfo {
  tag: string;
  name: string;
  emblem: string;
  description: string;
  level: number;
  xp: number;
  totalDeposited: number;
  bankedChips: number;
  maxMembers: number;
  memberCount: number;
}

export interface ClanMember {
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips: number;
  clanRank: string | null;
  avatar: string | null;
  lastSeenAt: string;
}

export interface ChatMessage {
  id: string;
  senderTag: string;
  senderName: string;
  rank: string;
  message: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  type: string;
  actorTag: string;
  actorName: string;
  detail: string | null;
  createdAt: string;
}

export interface ClanChallenge {
  id: string;
  type: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
  claimedBy: string | null;
  weekStart: string;
}

export interface ClanStats {
  totalMembers: number;
  onlineCount: number;
  totalChips: number;
  avgLevel: number;
  totalKills: number;
  totalDeaths: number;
  totalExtracts: number;
  totalEarned: number;
  highestLevel: number;
  richestChips: number;
  bestStreak: number;
  kdRatio: string;
}

export interface ClanInviteRow {
  id: string;
  clanTag: string;
  clanName: string;
  clanEmblem: string;
  clanDescription: string;
  clanLevel: number;
  memberCount: number;
  maxMembers: number;
  invitedByTag: string;
  invitedByName: string;
  createdAt: string;
}

export interface WarInfo {
  id: string;
  declarerTag: string;
  declarerName: string;
  targetTag: string;
  targetName: string;
  wager: number;
  declarerScore: number;
  targetScore: number;
  totalPot: number;
  startedAt: string;
}

// ──── Constants ────────────────────────────────────────────

export const EMBLEM_OPTIONS = [
  { value: '🐍', label: '🐍 Viper Snake' },
  { value: '👑', label: '👑 Royal Crown' },
  { value: '🥷', label: '🥷 Cyber Ninja' },
  { value: '🔥', label: '🔥 Phoenix Fire' },
  { value: '\u26a1', label: '\u26a1 Lightning Bolt' },
  { value: '💎', label: '💎 Diamond Shield' },
];

export const ACTIVITY_ICONS: Record<string, string> = {
  join: '\u2b06\ufe0f',
  leave: '\u2b07\ufe0f',
  deposit: '💰',
  create: '🎯',
  promote: '\u2b06\ufe0f',
  demote: '\u2b07\ufe0f',
  challenge_claim: '🏆',
  level_up: '\u2b50',
  withdraw: '💰',
  payout: '💰',
  shop_purchase: '🛒',
  war_declare: '\u2694\ufe0f',
  war_end: '🏆',
  settings: '⚙️',
  invite: '\ud83d\udce8',
};

export const CHALLENGE_ICONS: Record<string, LucideIcon> = {
  treasury_target: Coins,
  recruitment_drive: UserMinus,
  chat_activity: MessageSquare,
  deposit_streak: Zap,
};

export const RANK_COLORS: Record<string, string> = {
  Leader: 'text-amber-300',
  'Co-Leader': 'text-purple-300',
  Viper: 'text-indigo-300',
};

export const RANK_BG: Record<string, string> = {
  Leader: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  'Co-Leader': 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  Viper: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

// Real, implemented level effects — every line is verifiable in code:
// challenge targets/rewards scale with level (challenges route), XP Windfall
// grants Level × 500 XP (shop route), recruitment target caps at 5 (min(L,5)).
export const PERK_ROADMAP = [
  { level: 1, title: 'Base', desc: '30 member slots · weekly challenges' },
  { level: 2, title: 'Bigger Challenges', desc: 'Treasury Target reward: 2,000c' },
  { level: 3, title: 'Higher Targets', desc: 'Syndicate Comms: 30 messages' },
  { level: 5, title: 'Elite Windfall', desc: 'XP Windfall grants 2,500 XP' },
  { level: 10, title: 'Legendary Syndicate', desc: 'Treasury Target: 20,000c / 10,000c reward' },
];
