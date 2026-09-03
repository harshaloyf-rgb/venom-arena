import type { ToastFn } from '../_panel-primitives';
import type { InspectedPlayer } from '@/lib/game-config';

// ──── Interfaces ───────────────────────────────────────────

export interface SocialPanelProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

export type SubTab = 'friends' | 'followers' | 'following' | 'rivals' | 'search' | 'gifts';

export interface FriendItem {
  id: string;
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips: number;
  online: boolean;
  skinColor: string;
  clanTag: string | null;
}

export interface PendingRequestItem {
  id: string;
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips: number;
  online: boolean;
  skinColor: string;
}

export interface SearchPlayer {
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips: number;
  clanTag: string | null;
  online: boolean;
  avatar: string | null;
  relation: 'none' | 'friend' | 'pending_sent' | 'pending_received';
}

export interface BlockedPlayerItem {
  id: string;
  userTag: string;
  name: string;
  country: string;
  level: number;
  skinColor: string;
}

export interface GiftEntry {
  id: string;
  amount: number;
  createdAt: string;
  direction: 'sent' | 'received';
  player: { name: string; userTag: string };
}

export interface FollowItem {
  followerId?: string;
  followerName?: string;
  followerUserTag?: string;
  followerCountry?: string;
  followingId?: string;
  followingName?: string;
  followingUserTag?: string;
  followingCountry?: string;
  name?: string;
  userTag?: string;
  country?: string;
  isFollowingBack?: boolean;
}

export interface CountryOption {
  code: string;
  name: string;
  count: number;
}

export interface RecentMatch {
  arenaName: string;
  status: string;
  chipsEarned: number;
  chipsLost: number;
  kills: number;
  snakeLength: number;
  durationSec: number;
  createdAt: string;
  isOnline: boolean;
  // FIX KILL-1: who killed the player in this match (online deaths only).
  // killerIsBot=false + killerTag present → real player → UI offers
  // Profile / Add Friend / Add Rival actions on the row.
  killerName?: string | null;
  killerTag?: string | null;
  killerIsBot?: boolean | null;
}

// ──── Helpers ──────────────────────────────────────────────

export function deriveSkinColor(tag: string): string {
  const palette = ['#10b981', '#a855f7', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#8b5cf6'];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}
