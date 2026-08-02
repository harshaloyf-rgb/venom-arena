'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { timeAgo } from '@/lib/date-utils';
import {
  Award,
  BadgeCheck,
  Calendar,
  Check,
  Clock,
  Compass,
  Copy,
  Crown,
  Edit2,
  ExternalLink,
  Eye,
  Filter,
  Flag,
  Gamepad2,
  Globe,
  Heart,
  History,
  Landmark,
  Link as LinkIcon,
  Lock,
  LogOut,
  MessageCircle,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  Skull,
  Sparkles,
  Star,
  Swords,
  Target,
  Timer,
  Trash2,
  Trophy,
  Upload,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wifi,
  X,
  AlertTriangle,
  Download,
  Gift,
  UserCircle,
  Zap,
  Share2,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ARENA_TIERS, COUNTRIES, getCosmeticById, MILESTONE_TIERS, milestoneTierForChips, REFERRAL_REWARD, REFERRAL_MATCH_THRESHOLD } from '@/lib/game-config';
import type { PlayerProfile } from '@/lib/types';
import {
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { renderProfileCard, renderMilestoneCard, downloadBlob, shareBlob, copyBlobToClipboard, type MilestoneCardData } from '@/lib/share-card';

interface PlayerProfilePanelProps {
  onToast?: ToastFn;
}

// ---------------------------------------------------------------------------
// FACTION_COUNTRIES
// ---------------------------------------------------------------------------
const FACTION_COUNTRIES = COUNTRIES;

// ---------------------------------------------------------------------------
// PRESET_AVATARS
// ---------------------------------------------------------------------------
const PRESET_AVATARS = [
  { id: 'av-viper', label: 'Venomous Viper', emoji: '🐍' },
  { id: 'av-skull', label: 'Syndicate Skull', emoji: '🏴‍☠️' },
  { id: 'av-invader', label: 'Pixel Invader', emoji: '👾' },
  { id: 'av-sentinel', label: 'Cyber Sentinel', emoji: '🤖' },
  { id: 'av-king', label: 'Midas King', emoji: '👑' },
  { id: 'av-storm', label: 'Storm Surge', emoji: '⚡' },
  { id: 'av-fury', label: 'Crimson Fury', emoji: '🔥' },
  { id: 'av-nebula', label: 'Cosmic Nebula', emoji: '🌌' },
];

// ---------------------------------------------------------------------------
// Friend + history + identity-log types
// ---------------------------------------------------------------------------
type FriendStatus = 'online' | 'idle' | 'in-match' | 'offline';

interface Friend {
  id: string;
  name: string;
  userTag: string;
  status: FriendStatus;
  level: number;
  skinColor: string;
  country: string;
  giftSentToday: boolean;
  giftReceivedToday: boolean;
}

interface MatchHistoryEntry {
  id: string;
  arenaName: string;
  isOnline: boolean;
  status: 'EXTRACTED' | 'COLLIDED';
  chipsEarned: number;
  chipsLost: number;
  kills: number;
  snakeLength: number;
  timestamp: string;
  durationSec: number;
}

interface IdentityLogEntry {
  id: string;
  previousName: string;
  newName: string;
  previousCountry: string;
  newCountry: string;
  timestamp: string;
  status: 'VERIFIED' | 'APPROVED' | 'FIRST_HANDSHAKE';
  ipAddress?: string;
  deviceFingerprint?: string;
  verificationHash?: string;
  tamperFlag?: boolean;
}

interface ReferralEntry {
  id: string;
  referredName: string;
  status: 'pending' | 'active' | 'claimed';
  matchesPlayed: number;
  createdAt: string;
}

interface ReferralData {
  referralCode: string;
  hasReferrer: boolean;
  referrerName: string | null;
  referrerCode: string | null;
  referrals: ReferralEntry[];
}

interface SpectateSession {
  friend: Friend;
  arenaName: string;
  chipsCarried: number;
  kills: number;
  snakeLength: number;
  elapsed: number;
  status: 'alive' | 'extracting' | 'dead';
}

// ---------------------------------------------------------------------------
// Tournament stats type (from API)
// ---------------------------------------------------------------------------
interface TournamentStats {
  matchesPlayed: number;
  matchesMax: number;
  totalBought: number;
  annualBuyCap: number;
  adsToday: number;
  adsMax: number;
}

// ---------------------------------------------------------------------------
// Default seed data
// ---------------------------------------------------------------------------
const INITIAL_FRIENDS: Friend[] = [
  {
    id: 'f-1',
    name: 'ApexViper',
    userTag: 'APEX-1029',
    status: 'online',
    level: 42,
    skinColor: '#10b981',
    country: 'IN',
    giftSentToday: false,
    giftReceivedToday: true,
  },
  {
    id: 'f-2',
    name: 'ShadowSlinker',
    userTag: 'SLNK-9281',
    status: 'in-match',
    level: 18,
    skinColor: '#a855f7',
    country: 'US',
    giftSentToday: false,
    giftReceivedToday: false,
  },
  {
    id: 'f-3',
    name: 'CoinGobbler',
    userTag: 'COIN-5432',
    status: 'offline',
    level: 29,
    skinColor: '#eab308',
    country: 'JP',
    giftSentToday: true,
    giftReceivedToday: false,
  },
  {
    id: 'f-4',
    name: 'VenomKing',
    userTag: 'VNOM-0001',
    status: 'idle',
    level: 55,
    skinColor: '#ef4444',
    country: 'BR',
    giftSentToday: false,
    giftReceivedToday: false,
  },
  {
    id: 'f-5',
    name: 'NeonStriker',
    userTag: 'NEON-7742',
    status: 'in-match',
    level: 33,
    skinColor: '#06b6d4',
    country: 'GB',
    giftSentToday: false,
    giftReceivedToday: true,
  },
  {
    id: 'f-6',
    name: 'BlazeFang',
    userTag: 'BLZE-3301',
    status: 'online',
    level: 61,
    skinColor: '#f97316',
    country: 'KR',
    giftSentToday: true,
    giftReceivedToday: false,
  },
];

const SAMPLE_MATCHES: MatchHistoryEntry[] = [
  {
    id: 'match-mock1',
    arenaName: 'Slum Alley',
    isOnline: false,
    status: 'EXTRACTED',
    chipsEarned: 180,
    chipsLost: 0,
    kills: 3,
    snakeLength: 22,
    timestamp: new Date(Date.now() - 4 * 3_600_000).toISOString(),
    durationSec: 85,
  },
  {
    id: 'match-mock2',
    arenaName: 'Neon Grid',
    isOnline: true,
    status: 'COLLIDED',
    chipsEarned: 0,
    chipsLost: 50,
    kills: 1,
    snakeLength: 14,
    timestamp: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    durationSec: 42,
  },
  {
    id: 'match-mock3',
    arenaName: 'Viper Syndicate',
    isOnline: true,
    status: 'EXTRACTED',
    chipsEarned: 640,
    chipsLost: 0,
    kills: 6,
    snakeLength: 35,
    timestamp: new Date(Date.now() - 48 * 3_600_000).toISOString(),
    durationSec: 164,
  },
];

// ---------------------------------------------------------------------------
// Local-storage helpers
// ---------------------------------------------------------------------------
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota errors silently ignored */
  }
}

function getFriendSimulatedChips(friend: Friend): number {
  let h = 0;
  for (let i = 0; i < friend.id.length; i++) {
    h = (h * 31 + friend.id.charCodeAt(i)) & 0xffffffff;
  }
  return 750 + (Math.abs(h) % 9000);
}



// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type ProfileTab = 'stats' | 'history' | 'friends' | 'identityLog';

type InviteStatusMessageType =
  | 'success'
  | 'warning'
  | 'error'
  | 'counter';
interface InviteStatusMessage {
  type: InviteStatusMessageType;
  text: string;
  counterArenaId?: string;
}

export function PlayerProfilePanel({ onToast }: PlayerProfilePanelProps) {
  const { player, loading, refresh, logout } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4">
        <PanelSkeleton count={1} height="h-48" />
        <PanelSkeleton count={2} height="h-40" />
      </div>
    );
  }
  if (!player) return <NotSignedIn />;

  return (
    <ProfileContent
      player={player}
      onToast={onToast}
      onRefresh={refresh}
      onLogout={logout}
    />
  );
}

interface ProfileContentProps {
  player: PlayerProfile;
  onToast?: ToastFn;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

function ProfileContent({
  player,
  onToast,
  onRefresh,
  onLogout,
}: ProfileContentProps) {
  const isAdmin = player?.role === 'admin';
  const [globalRank, setGlobalRank] = useState<string | null>(null);

  // Fetch real global rank
  useEffect(() => {
    if (!player) return;
    fetch('/api/leaderboard/my-rank?type=chips')
      .then(r => r.json())
      .then(d => { if (d.globalRank != null) setGlobalRank(`#${d.globalRank}`); })
      .catch(() => {});
  }, [player?.userTag]);

  const [activeTab, setActiveTab] = useState<ProfileTab>('stats');

  // Co-Op Lobby Invite modal state
  const [activeInviteFriend, setActiveInviteFriend] = useState<Friend | null>(
    null,
  );
  const [inviteSelectedArenaId, setInviteSelectedArenaId] =
    useState<string>('tier-1');
  const [inviteStatusMessage, setInviteStatusMessage] =
    useState<InviteStatusMessage | null>(null);

  // Identity editing
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(player.name);
  const [selectedCountry, setSelectedCountry] = useState(
    player.country || 'US',
  );
  const [selectedAvatar, setSelectedAvatar] = useState(player.avatar || '');
  const [instagram, setInstagram] = useState(player.instagram || '');
  const [youtube, setYoutube] = useState(player.youtube || '');
  const [twitch, setTwitch] = useState(player.twitch || '');
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Friends, matches, logs
  const [friends, setFriends] = useState<Friend[]>([]);
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [identityLogs, setIdentityLogs] = useState<IdentityLogEntry[]>([]);
  const [newFriendName, setNewFriendName] = useState('');

  // -- NEW: DB-backed match history
  const [dbMatches, setDbMatches] = useState<MatchHistoryEntry[]>([]);
  const [matchFilter, setMatchFilter] = useState<'all' | 'EXTRACTED' | 'COLLIDED'>('all');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchTotal, setMatchTotal] = useState(0);

  // -- NEW: Tournament stats from DB
  const [tournamentStats, setTournamentStats] = useState<TournamentStats | null>(null);
  const [tournamentLoading, setTournamentLoading] = useState(true);

  // -- NEW: Copy tooltip state
  const [copiedTag, setCopiedTag] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // -- NEW: Friend removal confirmation
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);

  // -- NEW: Delete account
  const [deletingAccount, setDeletingAccount] = useState(false);

  // -- NEW: Friend search filter
  const [friendSearch, setFriendSearch] = useState('');
  const [friendStatusFilter, setFriendStatusFilter] = useState<'all' | 'online' | 'in-match' | 'offline'>('all');

  // -- NEW: Spectate session
  const [spectatingFriend, setSpectatingFriend] = useState<SpectateSession | null>(null);
  const [spectateTimer, setSpectateTimer] = useState(0);

  // -- NEW: Inspect friend profile
  const [inspectingFriend, setInspectingFriend] = useState<Friend | null>(null);

  // -- NEW: Referral data
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copiedReferralCode, setCopiedReferralCode] = useState(false);
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);

  // -- NEW: Redeem referral code
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [alreadyReferred, setAlreadyReferred] = useState(false);

  // -- Profile Card generation
  const [profileCardLoading, setProfileCardLoading] = useState(false);
  const [profileCardPreview, setProfileCardPreview] = useState<string | null>(null);
  const [profileCardCopied, setProfileCardCopied] = useState(false);
  const profileCardBlobRef = useRef<Blob | null>(null);

  // -- Milestone Card generation
  const [milestoneCardPreview, setMilestoneCardPreview] = useState<string | null>(null);
  const [milestoneCardCopied, setMilestoneCardCopied] = useState(false);
  const [milestoneCardLoading, setMilestoneCardLoading] = useState(false);
  const milestoneCardBlobRef = useRef<Blob | null>(null);

  // -- Milestones data
  const [milestones, setMilestones] = useState<Array<{
    id: string;
    tierId: string;
    chipsAtMilestone: number;
    createdAt: string;
  }>>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);

  // Ref to track mounted state for async ops
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -- Fetch tournament stats from DB
  const fetchTournamentStats = useCallback(async () => {
    setTournamentLoading(true);
    try {
      const res = await fetch('/api/player/tournament-stats');
      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) {
          setTournamentStats(data);
        }
      }
    } catch {
      // silently fall back to defaults
    } finally {
      if (mountedRef.current) setTournamentLoading(false);
    }
  }, []);

  // -- Fetch referral data
  const fetchReferralData = useCallback(async () => {
    setReferralLoading(true);
    try {
      const res = await fetch('/api/player/referral');
      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) {
          setReferralData(data);
          if (data.hasReferrer) setAlreadyReferred(true);
        }
      }
    } catch {
      // silently ignore
    } finally {
      if (mountedRef.current) setReferralLoading(false);
    }
  }, []);

  // -- Fetch player milestones
  const fetchMilestones = useCallback(async () => {
    setMilestonesLoading(true);
    try {
      const res = await fetch('/api/player/milestones');
      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) {
          setMilestones(data.milestones || []);
        }
      }
    } catch {
      // silently ignore
    } finally {
      if (mountedRef.current) setMilestonesLoading(false);
    }
  }, []);

  // -- Handle redeem referral code
  const redeemRef = useRef(false);
  const handleRedeemCode = useCallback(async () => {
    const code = redeemCode.trim().toUpperCase();
    if (!code || redeemRef.current) return;
    redeemRef.current = true;
    setRedeemLoading(true);
    setRedeemResult(null);
    try {
      const res = await fetch('/api/player/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        setRedeemResult({ ok: true, message: data.message || 'Invite code linked successfully!' });
        setRedeemCode('');
        setAlreadyReferred(true);
        fetchReferralData(); // refresh to show updated state
        onToast?.('Invite code applied! Complete ' + REFERRAL_MATCH_THRESHOLD + ' matches to claim your reward.', 'success');
      } else {
        const msg = data.error || 'Failed to apply invite code.';
        setRedeemResult({ ok: false, message: msg });
        if (msg.toLowerCase().includes('already')) {
          setAlreadyReferred(true);
        }
      }
    } catch {
      setRedeemResult({ ok: false, message: 'Network error. Please try again.' });
    } finally {
      setRedeemLoading(false);
      redeemRef.current = false;
    }
  }, [redeemCode, fetchReferralData, onToast]);

  // -- Auto-populate redeem code from ?ref= URL param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      setRedeemCode(refCode.trim().toUpperCase());
      // Clean the URL so it doesn't persist
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // -- Fetch DB match history
  const fetchDbMatches = useCallback(async (filter: 'all' | 'EXTRACTED' | 'COLLIDED') => {
    setMatchLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25', offset: '0' });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/player/match-history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) {
          const entries: MatchHistoryEntry[] = (data.entries || []).map((m: Record<string, unknown>) => ({
            id: m.id as string,
            arenaName: (m.arenaName || m.arena_id || 'Unknown') as string,
            isOnline: (m.isOnline ?? true) as boolean,
            status: (m.status || 'EXTRACTED') as 'EXTRACTED' | 'COLLIDED',
            chipsEarned: Number(m.chipsEarned ?? m.chips_extracted ?? 0),
            chipsLost: Number(m.chipsLost ?? m.chips_lost ?? 0),
            kills: Number(m.kills ?? 0),
            snakeLength: Number(m.snakeLength ?? m.score ?? 0),
            timestamp: (m.timestamp || m.created_at || new Date().toISOString()) as string,
            durationSec: Number(m.durationSec ?? m.duration_seconds ?? 0),
          }));
          setDbMatches(entries);
          setMatchTotal(Number(data.total ?? entries.length));
        }
      }
    } catch {
      // silently ignore
    } finally {
      if (mountedRef.current) setMatchLoading(false);
    }
  }, []);

  // Load from localStorage + socials from DB player object
  useEffect(() => {
    const storedFriends = readJSON<Friend[] | null>('venom_friends', null);
    if (storedFriends && Array.isArray(storedFriends)) {
      setFriends(storedFriends);
    } else {
      setFriends(INITIAL_FRIENDS);
      writeJSON('venom_friends', INITIAL_FRIENDS);
    }

    const storedMatches = readJSON<MatchHistoryEntry[] | null>(
      'venom_match_history',
      null,
    );
    if (storedMatches && Array.isArray(storedMatches) && storedMatches.length) {
      setMatches(storedMatches);
    } else {
      setMatches(SAMPLE_MATCHES);
      writeJSON('venom_match_history', SAMPLE_MATCHES);
    }

    const storedLogs = readJSON<IdentityLogEntry[] | null>(
      'venom_identity_history_log',
      null,
    );
    if (storedLogs && Array.isArray(storedLogs)) {
      setIdentityLogs(storedLogs);
    } else {
      const seed: IdentityLogEntry[] = [
        {
          id: 'log-1',
          previousName: 'Unregistered Agent',
          newName: player.name,
          previousCountry: 'None',
          newCountry: player.country || 'US',
          timestamp: new Date(Date.now() - 5 * 86_400_000).toISOString(),
          status: 'FIRST_HANDSHAKE',
          ipAddress: '103.42.xx.xx',
          deviceFingerprint: 'CRT-7f2a9b1e4d',
          verificationHash: 'sha256:a3f8c1e9b2d4...',
          tamperFlag: false,
        },
      ];
      setIdentityLogs(seed);
      writeJSON('venom_identity_history_log', seed);
    }

    // Socials loaded from player object (DB-backed) instead of localStorage
    setInstagram(player.instagram || '');
    setYoutube(player.youtube || '');
    setTwitch(player.twitch || '');

    // Fetch tournament stats from DB
    fetchTournamentStats();
    // Fetch milestones
    fetchMilestones();
  }, [player.name, player.country, player.instagram, player.youtube, player.twitch, fetchTournamentStats, fetchMilestones]);

  // Fetch DB matches when switching to history tab or changing filter
  useEffect(() => {
    if (activeTab === 'history') {
      fetchDbMatches(matchFilter);
    }
  }, [activeTab, matchFilter, fetchDbMatches]);

  // Fetch referral data when switching to friends tab
  useEffect(() => {
    if (activeTab === 'friends') {
      fetchReferralData();
    }
  }, [activeTab, fetchReferralData]);

  // -- derived values
  const xpNeeded = player.level * 200;
  const xpPercent = Math.min(100, Math.floor((player.xp / xpNeeded) * 100));
  const deathsCount = player.lifetimeDeaths || 1;
  const kdRatio = ((player.lifetimeKills || 0) / deathsCount).toFixed(2);
  const totalRuns =
    (player.lifetimeExtracts || 0) + (player.lifetimeDeaths || 0);
  const extractRate =
    totalRuns > 0
      ? `${Math.floor(((player.lifetimeExtracts || 0) / totalRuns) * 100)}%`
      : '0%';

  const activeSkin = getCosmeticById(player.currentSkin);
  const activeTrail = getCosmeticById(player.currentTrail);
  const activeDeath = getCosmeticById(player.currentDeath);
  const activeFlagCosmetic = getCosmeticById(player.currentFlag || '');
  const activeBanner = getCosmeticById(player.currentBanner || '');
  const activeFlag = FACTION_COUNTRIES.find(
    (c) => c.code === (player.country || 'US'),
  );

  // Account age in days
  const accountAgeDays = Math.floor(
    (Date.now() - new Date(player.createdAt).getTime()) / 86_400_000,
  );
  const createdAtFormatted = new Date(player.createdAt).toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );

  // -- avatar drag & drop handlers
  function processAvatarFile(file: File) {
    if (!file.type.startsWith('image/')) {
      notify('Please select a valid image file.', 'error', onToast);
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      notify(
        'Image size exceeds 1.5MB. Please choose a smaller file.',
        'error',
        onToast,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSelectedAvatar(event.target.result as string);
        notify(
          'Custom avatar selected! Save your handshake to lock it in.',
          'success',
          onToast,
        );
      }
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processAvatarFile(files[0]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) processAvatarFile(files[0]);
  }

  // -- copy to clipboard helper
  async function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify('Failed to copy.', 'error', onToast);
    }
  }

  // -- identity save
  function handleStartEditing() {
    setNewName(player.name);
    setSelectedCountry(player.country || 'US');
    setSelectedAvatar(player.avatar || '');
    setInstagram(player.instagram || '');
    setYoutube(player.youtube || '');
    setTwitch(player.twitch || '');
    setIsEditing(true);
  }

  async function handleSaveProfile() {
    const trimmed = newName.trim();
    if (!trimmed) {
      notify('Nickname cannot be empty!', 'error', onToast);
      return;
    }
    if (trimmed.length > 15) {
      notify('Nickname must be 15 characters or less.', 'error', onToast);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/player', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          country: selectedCountry,
          avatar:
            selectedAvatar && selectedAvatar.length <= 8
              ? selectedAvatar
              : undefined,
          instagram: instagram.trim(),
          youtube: youtube.trim(),
          twitch: twitch.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify(data?.error || 'Failed to save profile.', 'error', onToast);
        return;
      }

      // No longer persist socials to localStorage — they are now DB-backed

      const nameChanged = trimmed !== player.name;
      const countryChanged = selectedCountry !== (player.country || 'US');
      if (nameChanged || countryChanged) {
        const newLog: IdentityLogEntry = {
          id: 'log-' + Math.random().toString(36).slice(2, 11),
          previousName: player.name,
          newName: trimmed,
          previousCountry: player.country || 'US',
          newCountry: selectedCountry,
          timestamp: new Date().toISOString(),
          status: 'VERIFIED',
          ipAddress: '192.168.' + Math.floor(Math.random() * 255) + '.xx',
          deviceFingerprint: 'CRT-' + Math.random().toString(36).slice(2, 10),
          verificationHash: 'sha256:' + Math.random().toString(36).slice(2, 14) + '...',
          tamperFlag: false,
        };
        const updatedLogs = [newLog, ...identityLogs];
        setIdentityLogs(updatedLogs);
        writeJSON('venom_identity_history_log', updatedLogs);
      }

      await onRefresh();
      setIsEditing(false);
      notify(
        'Handshake secure! Profile & Social links saved successfully! 🔒',
        'success',
        onToast,
      );
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    } finally {
      setSaving(false);
    }
  }

  // -- friend handlers
  function handleAddFriend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newFriendName.trim();
    if (!trimmed) return;

    if (
      friends.some(
        (f) => f.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      notify(`${trimmed} is already in your allied squad list!`, 'error', onToast);
      return;
    }

    const newFriend: Friend = {
      id: 'f-' + Math.random().toString(36).slice(2, 11),
      name: trimmed,
      userTag: 'VIPR-' + Math.floor(1000 + Math.random() * 9000),
      status: Math.random() > 0.5 ? 'online' : 'offline',
      level: Math.floor(5 + Math.random() * 45),
      skinColor: '#38bdf8',
      country: 'US',
      giftSentToday: false,
      giftReceivedToday: false,
    };

    const updated = [...friends, newFriend];
    setFriends(updated);
    writeJSON('venom_friends', updated);
    setNewFriendName('');
    notify(`${trimmed} has been synced into your ally list! 🔗`, 'success', onToast);
  }

  function confirmRemoveFriend() {
    if (!friendToRemove) return;
    const updated = friends.filter((f) => f.id !== friendToRemove.id);
    setFriends(updated);
    writeJSON('venom_friends', updated);
    notify(`Alliance with ${friendToRemove.name} dismantled.`, 'info', onToast);
    setFriendToRemove(null);
  }

  function handleSendGift(id: string, name: string) {
    const updated = friends.map((f) =>
      f.id === id ? { ...f, giftSentToday: true } : f,
    );
    setFriends(updated);
    writeJSON('venom_friends', updated);
    notify(`Deposited 25 tactical bonus Chips to ${name}! 🎁`, 'success', onToast);
  }

  // -- co-op invite handlers
  function openInviteModal(friend: Friend) {
    setActiveInviteFriend(friend);
    setInviteSelectedArenaId('tier-1');
    setInviteStatusMessage(null);
  }

  function handleSendCoOpInvite() {
    if (!activeInviteFriend) return;
    const selectedTier =
      ARENA_TIERS.find((t) => t.id === inviteSelectedArenaId) || ARENA_TIERS[0];
    const friendChips = getFriendSimulatedChips(activeInviteFriend);
    const playerChips = player.bankedChips;

    if (playerChips < selectedTier.buyIn) {
      notify(
        `You do not have enough chips for ${selectedTier.name}!`,
        'error',
        onToast,
      );
      return;
    }

    if (friendChips < selectedTier.buyIn) {
      const affordableTiers = ARENA_TIERS.filter(
        (t) => friendChips >= t.buyIn && playerChips >= t.buyIn,
      );
      if (affordableTiers.length > 0) {
        const counterTier = affordableTiers[affordableTiers.length - 1];
        setInviteStatusMessage({
          type: 'counter',
          text: `Sorry! I don't have enough chips for ${selectedTier.name} (need ${selectedTier.buyIn.toLocaleString()} c, only have ${friendChips.toLocaleString()} c). Let's join the "${counterTier.name}" (Buy-In: ${counterTier.buyIn.toLocaleString()} c) instead! Re-invite me?`,
          counterArenaId: counterTier.id,
        });
        notify(
          'Co-op invitation rejected: Insufficient chips. Counter-proposal received!',
          'info',
          onToast,
        );
      } else {
        setInviteStatusMessage({
          type: 'error',
          text: `Ah, I'm super low on chips right now (${friendChips.toLocaleString()} c) and can't afford any of the available buy-ins. Send me a chip gift or invite me when I earn some more! 🐍`,
        });
        notify('Co-op invitation rejected: Insufficient chips.', 'error', onToast);
      }
      return;
    }

    writeJSON('venom_active_match_invite', {
      name: activeInviteFriend.name,
      skinColor: activeInviteFriend.skinColor,
      arenaId: selectedTier.id,
    });
    notify(
      `Co-op invite accepted by ${activeInviteFriend.name}! Staking buy-in... 🤝⚔️`,
      'success',
      onToast,
    );
    setActiveInviteFriend(null);
  }

  // -- logout with confirmation
  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
      notify('Signed out.', 'info', onToast);
    } finally {
      setLoggingOut(false);
    }
  }

  // -- delete account
  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/player', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        notify(data?.error || 'Failed to delete account.', 'error', onToast);
        return;
      }
      notify('Account deleted permanently.', 'info', onToast);
      await onLogout();
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    } finally {
      setDeletingAccount(false);
    }
  }

  // -- Determine which matches to display
  const displayMatches = dbMatches.length > 0 ? dbMatches : matches;

  // -- Profile Card handlers
  async function handleGenerateProfileCard() {
    setProfileCardLoading(true);
    try {
      const blob = await renderProfileCard({
        playerName: player.name,
        userTag: player.userTag,
        country: player.country || 'US',
        level: player.level,
        bankedChips: player.bankedChips,
        clanTag: player.clanTag || null,
        lifetimeKills: player.lifetimeKills,
        lifetimeExtracts: player.lifetimeExtracts,
        lifetimeDeaths: player.lifetimeDeaths,
        biggestExtract: player.biggestExtract,
        bestStreak: player.bestStreak,
        totalEarned: player.totalEarned,
        totalLost: player.totalLost,
      });
      profileCardBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setProfileCardPreview(url);
    } catch (e) {
      console.error('[profile-card] render error', e);
      notify('Failed to generate profile card.', 'error', onToast);
    } finally {
      setProfileCardLoading(false);
    }
  }

  function closeProfileCardModal() {
    if (profileCardPreview) URL.revokeObjectURL(profileCardPreview);
    setProfileCardPreview(null);
    setProfileCardCopied(false);
  }

  async function handleProfileCardDownload() {
    if (!profileCardBlobRef.current) return;
    downloadBlob(profileCardBlobRef.current, `venom-arena-profile-${player.userTag}-${Date.now()}.png`);
  }

  async function handleProfileCardShare() {
    if (!profileCardBlobRef.current) return;
    const result = await shareBlob(profileCardBlobRef.current, `Venom Arena — ${player.name}'s Profile Card`);
    if (result.method === 'cancelled') return;
    if (result.method === 'not-supported') {
      const ok = await copyBlobToClipboard(profileCardBlobRef.current);
      if (ok) {
        setProfileCardCopied(true);
        notify('Copied to clipboard! Paste it anywhere to share.', 'success', onToast);
        setTimeout(() => setProfileCardCopied(false), 3000);
      } else {
        notify('Share not available. Use Download instead.', 'error', onToast);
      }
    } else {
      notify('Profile card shared successfully! 🎬', 'success', onToast);
    }
  }

  async function handleProfileCardCopy() {
    if (!profileCardBlobRef.current) return;
    const ok = await copyBlobToClipboard(profileCardBlobRef.current);
    if (ok) {
      setProfileCardCopied(true);
      notify('Copied to clipboard! 📋', 'success', onToast);
      setTimeout(() => setProfileCardCopied(false), 3000);
    } else {
      notify('Clipboard copy failed. Try Download instead.', 'error', onToast);
    }
  }

  // -- Milestone Card handlers
  async function handleGenerateMilestoneCard(ms: { tierId: string; chipsAtMilestone: number }) {
    setMilestoneCardLoading(true);
    try {
      const tier = MILESTONE_TIERS.find(t => t.id === ms.tierId);
      if (!tier) {
        notify('Unknown milestone tier.', 'error', onToast);
        return;
      }
      const data: MilestoneCardData = {
        playerName: player.name,
        userTag: player.userTag,
        country: player.country || 'US',
        tierName: tier.name,
        tierBadge: tier.badge,
        chipsMilestone: ms.chipsAtMilestone,
        currentChips: player.bankedChips,
      };
      const blob = await renderMilestoneCard(data);
      milestoneCardBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setMilestoneCardPreview(url);
    } catch (e) {
      console.error('[milestone-card] render error', e);
      notify('Failed to generate milestone card.', 'error', onToast);
    } finally {
      setMilestoneCardLoading(false);
    }
  }

  function closeMilestoneCardModal() {
    if (milestoneCardPreview) URL.revokeObjectURL(milestoneCardPreview);
    setMilestoneCardPreview(null);
    setMilestoneCardCopied(false);
  }

  async function handleMilestoneCardDownload() {
    if (!milestoneCardBlobRef.current) return;
    downloadBlob(milestoneCardBlobRef.current, `venom-arena-milestone-${Date.now()}.png`);
  }

  async function handleMilestoneCardShare() {
    if (!milestoneCardBlobRef.current) return;
    const result = await shareBlob(milestoneCardBlobRef.current, 'Venom Arena — Milestone Unlocked!');
    if (result.method === 'cancelled') return;
    if (result.method === 'not-supported') {
      const ok = await copyBlobToClipboard(milestoneCardBlobRef.current);
      if (ok) {
        setMilestoneCardCopied(true);
        notify('Copied to clipboard! Paste it anywhere to share.', 'success', onToast);
        setTimeout(() => setMilestoneCardCopied(false), 3000);
      } else {
        notify('Share not available. Use Download instead.', 'error', onToast);
      }
    } else {
      notify('Milestone card shared! 🏆', 'success', onToast);
    }
  }

  async function handleMilestoneCardCopy() {
    if (!milestoneCardBlobRef.current) return;
    const ok = await copyBlobToClipboard(milestoneCardBlobRef.current);
    if (ok) {
      setMilestoneCardCopied(true);
      notify('Copied to clipboard! 📋', 'success', onToast);
      setTimeout(() => setMilestoneCardCopied(false), 3000);
    } else {
      notify('Clipboard copy failed. Try Download instead.', 'error', onToast);
    }
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <TooltipProvider>
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 bg-slate-950/60 border border-slate-900 rounded-2xl shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-900 pb-6 mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-indigo-400/30 relative shadow-md overflow-hidden shrink-0">
            {player.avatar ? (
              player.avatar.startsWith('data:') ||
              player.avatar.startsWith('http') ? (
                <img
                  src={player.avatar}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-3xl select-none">{player.avatar}</span>
              )
            ) : (
              <span
                className="text-3xl select-none"
                title="Equipped DNA Skin"
              >
                {activeSkin?.emoji || '🐍'}
              </span>
            )}
            <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-indigo-400 shadow">
              Lvl {player.level}
            </div>
          </div>

          {/* Name + tag + socials */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white font-sans tracking-tight flex items-center gap-2">
                <span className="text-xl" title="Region flag">
                  {activeFlag?.flag || '🇺🇸'}
                </span>
                <span>{player.name}</span>
                <span className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-indigo-400 px-1.5 py-0.5 rounded uppercase">
                  {player.country || 'US'}
                </span>
                {player.clanTag && (
                  <Badge className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold px-2 py-0.5">
                    [{player.clanTag}]{player.clanRank ? ` ${player.clanRank}` : ''}
                  </Badge>
                )}
              </h2>
              <button
                type="button"
                onClick={handleStartEditing}
                className="text-slate-400 hover:text-white p-1 transition cursor-pointer"
                title="Edit Identity"
                aria-label="Edit identity"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-1 flex items-center gap-1.5 flex-wrap">
              <span>
                Ledger Tag:{' '}
                <span className="font-mono text-slate-300 font-bold">
                  #{player.userTag || 'STRK-8291'}
                </span>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`#${player.userTag || 'STRK-8291'}`, setCopiedTag)}
                    className="text-slate-500 hover:text-indigo-400 transition cursor-pointer"
                    aria-label="Copy user tag"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700 text-xs">
                  {copiedTag ? 'Copied!' : 'Copy tag'}
                </TooltipContent>
              </Tooltip>
              <span>•</span>
              <span>
                Global Standing:{' '}
                <span className="text-amber-400 font-bold font-mono">
                  {globalRank ?? '…'}
                </span>
              </span>
            </p>

            {/* Referral code */}
            {player.referralCode && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <LinkIcon className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px] text-slate-400 font-sans">
                  Referral:{' '}
                  <span className="font-mono text-emerald-400 font-bold">
                    {player.referralCode}
                  </span>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(player.referralCode!, setCopiedReferral)}
                      className="text-slate-500 hover:text-emerald-400 transition cursor-pointer"
                      aria-label="Copy referral code"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700 text-xs">
                    {copiedReferral ? 'Copied!' : 'Copy referral code'}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Account age + last seen */}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-sans">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Member since {createdAtFormatted}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                Last active: {timeAgo(player.lastSeenAt)}
              </span>
            </div>

            {/* Socials */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {instagram && (
                <a
                  href={`https://instagram.com/${instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1.5 transition-all"
                >
                  📸 {instagram}
                </a>
              )}
              {youtube && (
                <a
                  href={
                    youtube.startsWith('http')
                      ? youtube
                      : `https://youtube.com/${youtube}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1.5 transition-all"
                >
                  🎥 YouTube
                </a>
              )}
              {twitch && (
                <a
                  href={`https://twitch.tv/${twitch}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-[11px] font-sans font-bold flex items-center gap-1.5 transition-all"
                >
                  📱 Twitch
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Level progress */}
          <div className="w-full md:w-72 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur-sm flex-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-sans mb-1.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />{' '}
                Level Progress
              </span>
              <span className="font-mono text-white font-bold">
                {player.xp} / {xpNeeded} XP
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>

          {/* Logout with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={loggingOut}
                className="px-4 py-3 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow h-[52px] disabled:opacity-50"
                title="Logout Session"
              >
                <LogOut className="w-4 h-4" />
                <span className="whitespace-nowrap">Sign Out</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-900 border-slate-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Sign Out</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  Are you sure you want to sign out? You can sign back in at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-500 text-white"
                >
                  Sign Out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Profile Picture + Character Appearance Row */}
      <ProfilePictureAndAppearance
        player={player}
        activeSkin={activeSkin}
        activeTrail={activeTrail}
        activeDeath={activeDeath}
        activeFlagCosmetic={activeFlagCosmetic}
        activeBanner={activeBanner}
        activeFlag={activeFlag}
        onStartEditing={handleStartEditing}
        onDrop={handleDrop}
        onFileChange={handleFileChange}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
      />

      {/* Cosmetics Showcase Row */}
      <CosmeticsShowcase
        activeSkin={activeSkin}
        activeTrail={activeTrail}
        activeDeath={activeDeath}
        activeFlagCosmetic={activeFlagCosmetic}
        activeBanner={activeBanner}
      />

      {/* Generate Profile Card Button */}
      <button
        type="button"
        onClick={handleGenerateProfileCard}
        disabled={profileCardLoading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-xs font-bold text-violet-300 hover:bg-violet-500/20 transition disabled:opacity-50 cursor-pointer"
      >
        <UserCircle className="w-4 h-4" />
        {profileCardLoading ? 'Generating Profile Card…' : '🪪 Generate Profile Card'}
      </button>

      {/* TAB NAV */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-900 pb-3">
        {(
          [
            { id: 'stats', label: 'Records & Statistics', icon: Target },
            { id: 'history', label: 'Match History Ledger', icon: History },
            ...(isAdmin ? [{
              id: 'friends',
              label: `Friends & Spectate (${friends.length})`,
              icon: Users,
            }] : []),
            ...(isAdmin ? [{
              id: 'identityLog',
              label: 'Identity Anti-Tamper Logs',
              icon: Lock,
            }] : []),
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setIsEditing(false);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-lg'
                  : 'bg-transparent border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Guest Upgrade Banner */}
          {!player.email && <GuestUpgradeBanner onRefresh={onRefresh} onToast={onToast} />}

          {/* Identity editor */}
          {isEditing && (
            <IdentityEditor
              newName={newName}
              setNewName={setNewName}
              selectedCountry={selectedCountry}
              setSelectedCountry={setSelectedCountry}
              selectedAvatar={selectedAvatar}
              setSelectedAvatar={setSelectedAvatar}
              instagram={instagram}
              setInstagram={setInstagram}
              youtube={youtube}
              setYoutube={setYoutube}
              twitch={twitch}
              setTwitch={setTwitch}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              onDrop={handleDrop}
              onFileChange={handleFileChange}
              onCancel={() => setIsEditing(false)}
              onSave={handleSaveProfile}
              saving={saving}
            />
          )}

          {/* Statistics grid — now 10 cards (8 original + Total Matches + Account Age) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label="Banked Wallet"
              subLabel="Deposited Chips"
              value={player.bankedChips.toLocaleString()}
              icon={<Landmark className="w-4 h-4 text-emerald-400" />}
              valueClass="text-emerald-400"
            />
            <StatCard
              label="Tournament Kills"
              subLabel="Total Terminations"
              value={String(player.lifetimeKills)}
              icon={<Skull className="w-4 h-4 text-rose-400" />}
              valueClass="text-white"
            />
            <StatCard
              label="K/D Ratio"
              subLabel="Kill / Death Index"
              value={kdRatio}
              icon={<Target className="w-4 h-4 text-amber-400" />}
              valueClass="text-amber-400"
            />
            <StatCard
              label="Extraction Rate"
              subLabel="Successful Handshakes"
              value={extractRate}
              icon={<Compass className="w-4 h-4 text-cyan-400" />}
              valueClass="text-cyan-400"
            />
            <StatCard
              label="Survival Streak"
              subLabel="Consecutive Extractions"
              value={String(player.bestStreak)}
              icon={<Trophy className="w-4 h-4 text-yellow-500" />}
              valueClass="text-yellow-500"
            />
            <StatCard
              label="Record Extraction"
              subLabel="Max Retained in One Run"
              value={player.biggestExtract.toLocaleString()}
              icon={<Award className="w-4 h-4 text-indigo-400" />}
              valueClass="text-indigo-400"
            />
            <StatCard
              label="Lifetime Retained"
              subLabel="Cumulative Chip Profit"
              value={player.totalEarned.toLocaleString()}
              icon={<Landmark className="w-4 h-4 text-teal-400" />}
              valueClass="text-teal-400"
            />
            <StatCard
              label="Total Forfeited"
              subLabel="Forfeited in Crash Events"
              value={player.totalLost.toLocaleString()}
              icon={<RefreshCw className="w-4 h-4 text-red-400" />}
              valueClass="text-red-400"
            />
            <StatCard
              label="Total Matches"
              subLabel="All Arena Runs"
              value={String(totalRuns)}
              icon={<Gamepad2 className="w-4 h-4 text-indigo-400" />}
              valueClass="text-indigo-300"
            />
            <StatCard
              label="Account Age"
              subLabel="Days Since Join"
              value={String(accountAgeDays)}
              icon={<Calendar className="w-4 h-4 text-emerald-400" />}
              valueClass="text-emerald-300"
            />
          </div>

          {/* Tournament Guardrails — DB-backed */}
          <TournamentGuardrailsSection
            tournamentStats={tournamentStats}
            tournamentLoading={tournamentLoading}
          />

          {/* Security Settings — Change Password & PIN */}
          <SecuritySettingsCard player={player} onToast={onToast} />

          {/* Delete Account Section */}
          <DeleteAccountSection
            onConfirm={handleDeleteAccount}
            deleting={deletingAccount}
          />

          {/* Challenger Standing Rating banner */}
          <div className="p-4 rounded-xl border border-slate-900 bg-slate-900/10 flex items-center gap-4">
            <Shield className="w-8 h-8 text-indigo-500 shrink-0" />
            <div className="text-xs leading-relaxed text-slate-400">
              <span className="font-bold text-slate-200 uppercase block mb-0.5">
                CHALLENGER STANDING RATING
              </span>
              All tournament statistics are linked directly to your global
              challenger index handle. Altering your registry flag updates
              leaderboard feeds dynamically. Data verification handshakes run
              periodically to check metrics validity.
            </div>
          </div>

          {/* Milestones Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> Chip Milestones
            </h3>
            {milestonesLoading ? (
              <PanelSkeleton count={2} height="h-16" />
            ) : milestones.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center">
                <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No chip milestones achieved yet.</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  Keep extracting to unlock Bronze (100K), Silver (500K), Gold (1M), and beyond!
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {milestones.map((ms) => {
                  const tier = MILESTONE_TIERS.find(t => t.id === ms.tierId);
                  if (!tier || tier.id === 'all') return null;
                  return (
                    <div
                      key={ms.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl" title={tier.name}>{tier.badge.split(' ')[0]}</span>
                        <div>
                          <div className="text-xs font-bold text-white">{tier.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {ms.chipsAtMilestone.toLocaleString('en-IN')} chips • {new Date(ms.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGenerateMilestoneCard(ms)}
                        disabled={milestoneCardLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Share2 className="w-3 h-3" />
                        Share
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: HISTORY — DB-backed with filters and mobile-responsive */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" /> Match Run Records
              Ledger
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Showing {displayMatches.length} of {matchTotal || displayMatches.length} operations
            </span>
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            {(['all', 'EXTRACTED', 'COLLIDED'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setMatchFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold font-sans transition cursor-pointer border ${
                  matchFilter === f
                    ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {f === 'all' ? 'All' : f === 'EXTRACTED' ? 'Extracted' : 'Collided'}
              </button>
            ))}
          </div>

          {matchLoading ? (
            <PanelSkeleton count={3} height="h-16" />
          ) : displayMatches.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-900 rounded-2xl">
              <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                No matches found in the active ledger standing.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Jump into any arena to log your first run data!
              </p>
              <button
                type="button"
                onClick={() => notify('Head to the Arena to log your first match!', 'info', onToast)}
                className="mt-4 px-4 py-2 bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/25 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                Go to Arena
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table (md+) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      <th className="py-3 px-4">Arena Sector</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Chips Outcome</th>
                      <th className="py-3 px-4 text-center">Kills</th>
                      <th className="py-3 px-4 text-center">Tail Score</th>
                      <th className="py-3 px-4">Time Elapsed</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-xs">
                    {displayMatches.map((match) => (
                      <tr key={match.id} className="hover:bg-slate-900/20 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{match.arenaName}</span>
                            <span
                              className={`text-[8px] font-mono px-1 rounded ${
                                match.isOnline
                                  ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {match.isOnline ? 'ONLINE' : 'PRACTICE'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            className={`text-[10px] font-mono font-bold border ${
                              match.status === 'EXTRACTED'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            }`}
                          >
                            {match.status}
                          </Badge>
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono font-bold ${
                            match.status === 'EXTRACTED'
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {match.status === 'EXTRACTED'
                            ? `+${match.chipsEarned.toLocaleString()} c`
                            : `-${match.chipsLost.toLocaleString()} c`}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-300">
                          {match.kills}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-medium text-indigo-300">
                          {match.snakeLength || 10}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{match.durationSec}s</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                          {new Date(match.timestamp).toLocaleDateString()}{' '}
                          {new Date(match.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card layout (below md) */}
              <div className="md:hidden space-y-3">
                {displayMatches.map((match) => (
                  <div
                    key={match.id}
                    className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-bold text-slate-300 font-sans">{match.arenaName}</span>
                        <span
                          className={`text-[7px] font-mono px-1 rounded ${
                            match.isOnline
                              ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {match.isOnline ? 'ONLINE' : 'PRACTICE'}
                        </span>
                      </div>
                      <Badge
                        className={`text-[9px] font-mono font-bold border ${
                          match.status === 'EXTRACTED'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        {match.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block text-[9px] font-mono uppercase">Chips</span>
                        <span className={`font-mono font-bold ${match.status === 'EXTRACTED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {match.status === 'EXTRACTED'
                            ? `+${match.chipsEarned.toLocaleString()}`
                            : `-${match.chipsLost.toLocaleString()}`} c
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] font-mono uppercase">Kills</span>
                        <span className="font-mono font-semibold text-slate-300">{match.kills}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] font-mono uppercase">Duration</span>
                        <span className="font-mono text-slate-400">{match.durationSec}s</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(match.timestamp).toLocaleDateString()}{' '}
                      {new Date(match.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: FRIENDS */}
      {activeTab === 'friends' && (
        <div className="space-y-5">
          {/* Spectate Overlay */}
          {spectatingFriend && (
            <SpectateOverlay
              session={spectatingFriend}
              onClose={() => setSpectatingFriend(null)}
            />
          )}

          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Friends &amp; Live
              Spectate Portal
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Build your operative squad. Spectate live arena runs, send chip gifts,
              or invite allies to high-stakes co-op matches.
            </p>
          </div>

          {/* ── INVITE FRIEND & GET 2,500 CHIPS BANNER ── */}
          <ReferralBanner
            player={player}
            referralData={referralData}
            referralLoading={referralLoading}
            copiedReferralCode={copiedReferralCode}
            copiedReferralLink={copiedReferralLink}
            onToast={onToast}
            onCopyCode={() => {
              const code = referralData?.referralCode || player.referralCode || '';
              if (code) copyToClipboard(code, setCopiedReferralCode);
            }}
            onCopyLink={() => {
              const code = referralData?.referralCode || player.referralCode || '';
              if (code) copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${code}`, setCopiedReferralLink);
            }}
          />

          {/* ── ENTER / REDEEM AN INVITE CODE ── */}
          {!alreadyReferred ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 overflow-hidden relative">
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="relative p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-4.5 h-4.5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-sans">Got an Invite Code?</h4>
                    <p className="text-[11px] text-slate-400 font-sans">Enter a friend's code below to link your accounts and both earn <strong className="text-emerald-400">{REFERRAL_REWARD.toLocaleString()} chips</strong>!</p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); handleRedeemCode(); }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Gift className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. VIPER-A7X2"
                      value={redeemCode}
                      onChange={(e) => {
                        setRedeemCode(e.target.value.toUpperCase());
                        if (redeemResult) setRedeemResult(null);
                      }}
                      maxLength={10}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!redeemCode.trim() || redeemLoading}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold font-sans transition shadow-lg shadow-indigo-500/15 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {redeemLoading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Applying...</>
                    ) : (
                      <><Zap className="w-4 h-4" /> Apply Code</>
                    )}
                  </button>
                </form>

                {redeemResult && (
                  <div className={`mt-3 px-4 py-2.5 rounded-xl text-xs font-sans flex items-center gap-2 border ${redeemResult.ok
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                    {redeemResult.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {redeemResult.message}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-emerald-400 font-sans">Invite Code Linked{referralData?.referrerName ? ` by ${referralData.referrerName}` : ''}</p>
                <p className="text-[10px] text-slate-400 font-sans">Play <strong className="text-amber-400">{REFERRAL_MATCH_THRESHOLD} matches</strong> to claim your <strong className="text-emerald-400">{REFERRAL_REWARD.toLocaleString()} chip</strong> bonus!</p>
              </div>
              {referralData?.referrerCode && (
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 shrink-0">{referralData.referrerCode}</span>
              )}
            </div>
          )}

          {/* Online stats bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3 text-center">
              <span className="text-lg font-bold font-mono text-emerald-400">{friends.filter(f => f.status === 'online' || f.status === 'idle').length}</span>
              <span className="block text-[9px] uppercase font-bold text-emerald-400/60 tracking-wider mt-0.5">Online</span>
            </div>
            <div className="bg-fuchsia-500/8 border border-fuchsia-500/20 rounded-xl p-3 text-center">
              <span className="text-lg font-bold font-mono text-fuchsia-400">{friends.filter(f => f.status === 'in-match').length}</span>
              <span className="block text-[9px] uppercase font-bold text-fuchsia-400/60 tracking-wider mt-0.5">In Match</span>
            </div>
            <div className="bg-slate-500/8 border border-slate-500/20 rounded-xl p-3 text-center">
              <span className="text-lg font-bold font-mono text-slate-400">{friends.filter(f => f.status === 'offline').length}</span>
              <span className="block text-[9px] uppercase font-bold text-slate-400/60 tracking-wider mt-0.5">Offline</span>
            </div>
          </div>

          {/* Add friend + Search row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleAddFriend} className="flex gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <UserPlus className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Enter challenger alias..." value={newFriendName} onChange={(e) => setNewFriendName(e.target.value)} maxLength={15} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-sans" />
              </div>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
                <UserPlus className="w-4 h-4" /> Sync Ally
              </button>
            </form>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search allies..." value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-sans" />
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            {(['all', 'online', 'in-match', 'offline'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setFriendStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold font-sans transition cursor-pointer border ${friendStatusFilter === s ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-400' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}>
                {s === 'all' ? 'All' : s === 'in-match' ? 'In Match' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Friends grid */}
          {(() => {
            const filtered = friends.filter((f) => {
              if (friendSearch && !f.name.toLowerCase().includes(friendSearch.toLowerCase()) && !f.userTag.toLowerCase().includes(friendSearch.toLowerCase())) return false;
              if (friendStatusFilter !== 'all' && f.status !== friendStatusFilter) return false;
              return true;
            });
            if (filtered.length === 0) {
              return (
                <div className="text-center py-10 border border-dashed border-slate-900 rounded-2xl">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No allies match your filters.</p>
                  <p className="text-xs text-slate-600 mt-1">Try adjusting your search or status filter.</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map((friend) => {
                  const friendChips = getFriendSimulatedChips(friend);
                  const statusText = friend.status === 'online' ? 'Online' : friend.status === 'idle' ? 'Idle' : friend.status === 'in-match' ? 'In Match' : 'Offline';
                  return (
                    <div key={friend.id} className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 hover:border-slate-800 transition shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center border-2" style={{ borderColor: friend.skinColor + '60', backgroundColor: friend.skinColor + '15' }}>
                              <span className="text-2xl">🐍</span>
                            </div>
                            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${friend.status === 'online' ? 'bg-emerald-500' : friend.status === 'idle' ? 'bg-amber-500 animate-pulse' : friend.status === 'in-match' ? 'bg-fuchsia-500 animate-pulse' : 'bg-slate-600'}`} title={statusText} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                              <button type="button" onClick={() => setInspectingFriend(friend)} className="truncate text-left hover:text-indigo-400 transition cursor-pointer" title="View profile">{friend.name}</button>
                              <span className="text-[9px] font-mono text-slate-500 font-normal shrink-0">#{friend.userTag}</span>
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Level {friend.level} •{' '}
                              <span className={`text-[10px] uppercase font-mono font-bold ${friend.status === 'online' ? 'text-emerald-400' : friend.status === 'idle' ? 'text-amber-400' : friend.status === 'in-match' ? 'text-fuchsia-400' : 'text-slate-500'}`}>{statusText}</span>
                            </p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setFriendToRemove(friend)} className="p-1.5 text-rose-400/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer" title="Remove ally">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Chip balance bar */}
                      <div className="bg-slate-900/60 rounded-lg p-2.5 mb-3 border border-slate-900/60">
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-slate-500 uppercase font-bold">Banked Chips</span>
                          <span className="font-mono font-bold text-slate-300">{friendChips.toLocaleString()} c</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (friendChips / 10000) * 100)}%`, backgroundColor: friend.skinColor }} />
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button type="button" onClick={() => setInspectingFriend(friend)} className="px-3 py-1.5 bg-indigo-600/15 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/25 rounded-xl transition cursor-pointer text-xs font-bold flex items-center gap-1.5" title="View Profile">
                          <Compass className="w-3.5 h-3.5" />
                          <span>Profile</span>
                        </button>
                        {friend.status === 'in-match' && (
                          <button type="button" onClick={() => {
                            setSpectatingFriend({
                              friend,
                              arenaName: ['Neon Grid', 'Viper Syndicate', 'Slum Alley', 'Toxic Wasteland'][Math.floor(Math.random() * 4)],
                              chipsCarried: 50 + Math.floor(Math.random() * 500),
                              kills: Math.floor(Math.random() * 8),
                              snakeLength: 10 + Math.floor(Math.random() * 30),
                              elapsed: 30 + Math.floor(Math.random() * 120),
                              status: Math.random() > 0.7 ? 'extracting' : 'alive',
                            });
                          }} className="px-3 py-1.5 bg-fuchsia-600/20 text-fuchsia-300 hover:bg-fuchsia-600 hover:text-white border border-fuchsia-500/30 rounded-xl transition cursor-pointer text-xs font-bold flex items-center gap-1.5 animate-pulse" title="Spectate Match">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Spectate</span>
                          </button>
                        )}
                        {(friend.status === 'online' || friend.status === 'idle') && (
                          <button type="button" onClick={() => openInviteModal(friend)} className="px-3 py-1.5 bg-violet-600/20 text-violet-300 hover:bg-violet-600 hover:text-white border border-violet-500/30 rounded-xl transition cursor-pointer text-xs font-bold flex items-center gap-1.5" title="Invite to Match">
                            <Swords className="w-3.5 h-3.5" />
                            <span>Invite</span>
                          </button>
                        )}
                        <button type="button" onClick={() => handleSendGift(friend.id, friend.name)} disabled={friend.giftSentToday || friend.status === 'offline'} className={`px-3 py-1.5 rounded-xl border transition cursor-pointer text-xs font-bold flex items-center gap-1 ${friend.giftSentToday ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`} title="Send Gift">
                          <Landmark className="w-3.5 h-3.5" />
                          <span>{friend.giftSentToday ? 'Gifted' : 'Gift 25c'}</span>
                        </button>
                        {friend.giftReceivedToday && (
                          <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-1 rounded-lg font-bold">🎁 Received</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Friend profile inspector dialog */}
          <FriendProfileInspector
            friend={inspectingFriend}
            allFriends={friends}
            onClose={() => setInspectingFriend(null)}
          />

          {/* Friend removal dialog */}
          <AlertDialog open={!!friendToRemove} onOpenChange={(open) => { if (!open) setFriendToRemove(null); }}>
            <AlertDialogContent className="bg-slate-900 border-slate-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Dismantle Alliance</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">Are you sure you want to remove <span className="text-white font-bold">{friendToRemove?.name}</span> from your allied squad? This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRemoveFriend} className="bg-rose-600 hover:bg-rose-500 text-white">Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* TAB: IDENTITY LOGS */}
      {activeTab === 'identityLog' && (
        <div className="space-y-5">
          {/* Security Status Banner */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-white uppercase block text-xs font-sans">INTEGRITY SEAL: VERIFIED</strong>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold tracking-wider">NO TAMPER DETECTED</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-sans leading-relaxed">
                All modifications to your challenger identity are cryptographically
                hashed and permanently recorded. Any unauthorized tampering will
                trigger automatic tournament streak reset and security lockdown.
              </p>
              <div className="flex items-center gap-4 mt-2 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-slate-500"><Monitor className="w-3 h-3" /> Device: <span className="text-slate-300">{typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 30) + '...' : 'Unknown'}</span></span>
                <span className="flex items-center gap-1 text-slate-500"><Wifi className="w-3 h-3" /> Session: <span className="text-emerald-400">Active</span></span>
              </div>
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 text-center">
              <span className="text-xl font-bold font-mono text-indigo-400">{identityLogs.length}</span>
              <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider mt-0.5">Total Handshakes</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 text-center">
              <span className="text-xl font-bold font-mono text-emerald-400">{identityLogs.filter(l => l.tamperFlag !== true).length}</span>
              <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider mt-0.5">Verified Clean</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 text-center">
              <span className="text-xl font-bold font-mono text-rose-400">{identityLogs.filter(l => l.tamperFlag === true).length}</span>
              <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider mt-0.5">Tamper Flags</span>
            </div>
          </div>

          {/* Log entries */}
          <div className="border border-slate-900 rounded-2xl overflow-hidden bg-slate-950/20">
            {identityLogs.length === 0 ? (
              <div className="text-center py-10">
                <Lock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No handshakes registered yet.</p>
                <p className="text-xs text-slate-600 mt-1">Edit your identity to create your first ledger entry.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-900">
                {identityLogs.map((log) => (
                  <div key={log.id} className={`p-4 text-xs font-mono ${log.tamperFlag ? 'bg-rose-950/20 border-l-2 border-l-rose-500' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        {/* Header with status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase ${
                            log.tamperFlag
                              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                              : log.status === 'FIRST_HANDSHAKE'
                                ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          }`}>
                            {log.tamperFlag ? '⚠ TAMPER FLAG' : log.status}
                          </Badge>
                          {log.tamperFlag && (
                            <span className="text-[9px] text-rose-400 font-sans font-bold animate-pulse">Security review pending</span>
                          )}
                        </div>
                        {/* Name change */}
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">TAG:</span>
                          <span className="text-slate-300 font-bold">{log.previousName}</span>
                          <span className="text-slate-500">➜</span>
                          <span className="text-indigo-400 font-bold">{log.newName}</span>
                        </div>
                        {/* Region change */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>REGION:</span>
                          <span className="text-slate-500 uppercase">{log.previousCountry}</span>
                          <span className="text-slate-500">➜</span>
                          <span className="text-emerald-400 uppercase font-bold">{log.newCountry}</span>
                        </div>
                        {/* Device & IP info */}
                        {(log.ipAddress || log.deviceFingerprint) && (
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 border-t border-slate-900/60">
                            {log.ipAddress && (
                              <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> IP: <span className="text-slate-400">{log.ipAddress}</span></span>
                            )}
                            {log.deviceFingerprint && (
                              <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Device: <span className="text-slate-400">{log.deviceFingerprint}</span></span>
                            )}
                          </div>
                        )}
                        {/* Verification hash */}
                        {log.verificationHash && (
                          <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>Hash: <span className="text-slate-400 font-mono">{log.verificationHash}</span></span>
                          </div>
                        )}
                      </div>
                      {/* Timestamp */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-500 block">TIMESTAMP</span>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(log.timestamp).toLocaleDateString()}{' '}
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security footer note */}
          <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/10 flex items-start gap-3">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs font-sans leading-relaxed text-slate-400">
              <strong className="text-amber-300 block mb-0.5">ANTI-TAMPER PROTOCOL ACTIVE</strong>
              Every identity modification generates a unique SHA-256 verification hash
              linked to your device fingerprint and IP session. These records are
              immutable and auditable by tournament officials.
            </div>
          </div>
        </div>
      )}

      {/* CO-OP LOBBY INVITE MODAL */}
      {activeInviteFriend && (
        <CoOpInviteModal
          friend={activeInviteFriend}
          playerChips={player.bankedChips}
          selectedArenaId={inviteSelectedArenaId}
          setSelectedArenaId={setInviteSelectedArenaId}
          statusMessage={inviteStatusMessage}
          setStatusMessage={setInviteStatusMessage}
          onClose={() => setActiveInviteFriend(null)}
          onSend={handleSendCoOpInvite}
          onToast={onToast}
        />
      )}

      {/* PROFILE CARD MODAL */}
      {profileCardPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-5">
            <button
              type="button"
              onClick={closeProfileCardModal}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-violet-400" /> Your Profile Card
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">Share on Instagram, WhatsApp, Twitter, or anywhere to flex your stats!</p>
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <img src={profileCardPreview} alt="Profile Card" className="w-full h-auto" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                type="button"
                onClick={handleProfileCardShare}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              <button
                type="button"
                onClick={handleProfileCardDownload}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button
                type="button"
                onClick={handleProfileCardCopy}
                disabled={profileCardCopied}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition cursor-pointer ${profileCardCopied ? 'bg-emerald-900 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'}`}
              >
                {profileCardCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {profileCardCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MILESTONE CARD MODAL */}
      {milestoneCardPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-5">
            <button
              type="button"
              onClick={closeMilestoneCardModal}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" /> Milestone Card
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">Share your achievement with the world!</p>
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <img src={milestoneCardPreview} alt="Milestone Card" className="w-full h-auto" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                type="button"
                onClick={handleMilestoneCardShare}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              <button
                type="button"
                onClick={handleMilestoneCardDownload}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button
                type="button"
                onClick={handleMilestoneCardCopy}
                disabled={milestoneCardCopied}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition cursor-pointer ${milestoneCardCopied ? 'bg-emerald-900 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'}`}
              >
                {milestoneCardCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {milestoneCardCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatCard({
  label,
  subLabel,
  value,
  icon,
  valueClass,
}: {
  label: string;
  subLabel: string;
  value: string;
  icon: React.ReactNode;
  valueClass: string;
}) {
  return (
    <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between hover:border-slate-800 transition shadow">
      <div className="flex items-center justify-between text-slate-400 mb-2">
        <span className="text-xs font-sans">{label}</span>
        {icon}
      </div>
      <div>
        <span
          className={`text-xl font-bold font-mono tracking-tight block ${valueClass}`}
        >
          {value}
        </span>
        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">
          {subLabel}
        </span>
      </div>
    </div>
  );
}

function CapCard({
  icon,
  label,
  value,
  barClass,
  pct,
  leftLabel,
  rightLabel,
  rightClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  barClass: string;
  pct: number;
  leftLabel: string;
  rightLabel: string;
  rightClass: string;
}) {
  return (
    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400 font-bold uppercase font-sans flex items-center gap-1">
          {icon} {label}
        </span>
        <span className="font-mono font-bold text-slate-300">{value}</span>
      </div>
      <div className="w-full h-2.5 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barClass} rounded-full`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
        <span>{leftLabel}</span>
        <span className={rightClass}>{rightLabel}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Picture + Character Appearance Section
// ---------------------------------------------------------------------------
function ProfilePictureAndAppearance({
  player,
  activeSkin,
  activeTrail,
  activeDeath,
  activeFlagCosmetic,
  activeBanner,
  activeFlag,
  onStartEditing,
  onDrop,
  onFileChange,
  isDragging,
  setIsDragging,
}: {
  player: PlayerProfile;
  activeSkin: ReturnType<typeof getCosmeticById>;
  activeTrail: ReturnType<typeof getCosmeticById>;
  activeDeath: ReturnType<typeof getCosmeticById>;
  activeFlagCosmetic: ReturnType<typeof getCosmeticById>;
  activeBanner: ReturnType<typeof getCosmeticById>;
  activeFlag: { code: string; flag: string; name: string } | undefined;
  onStartEditing: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
}) {
  const skinColor = activeSkin?.color || '#10b981';
  const trailColor = activeTrail?.color || '#a855f7';
  const deathColor = activeDeath?.color || '#ef4444';
  const isImageAvatar = player.avatar ? (player.avatar.startsWith('data:') || player.avatar.startsWith('http')) : false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-5 pb-5 border-b border-slate-900/60">
      {/* Profile Picture Card */}
      <div className="md:col-span-4">
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 h-full flex flex-col items-center justify-center text-center">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-3">Profile Picture</span>
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center border-2 shadow-lg relative overflow-hidden cursor-pointer group mb-3"
            style={{ borderColor: skinColor + '50', backgroundColor: skinColor + '10' }}
            onClick={onStartEditing}
            title="Click to change profile picture"
          >
            {player.avatar ? (
              isImageAvatar ? (
                <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-5xl select-none">{player.avatar}</span>
              )
            ) : (
              <span className="text-5xl select-none">{activeSkin?.emoji || '🐍'}</span>
            )}
            <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-indigo-400 shadow">
              Lvl {player.level}
            </div>
          </div>
          <button type="button" onClick={onStartEditing} className="px-3 py-1.5 bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/25 rounded-xl text-[10px] font-bold transition cursor-pointer flex items-center gap-1">
            <Edit2 className="w-3 h-3" /> Change Picture
          </button>
        </div>
      </div>

      {/* Character Appearance Card */}
      <div className="md:col-span-8">
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 h-full">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-4 block">Character Appearance</span>
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Snake Visual */}
            <div className="relative w-full sm:w-48 h-40 shrink-0 rounded-xl bg-slate-900/80 border border-slate-900 overflow-hidden">
              {/* Grid background */}
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
              {/* Snake body segments */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Trail glow */}
                  <div className="absolute -inset-4 rounded-full opacity-30 blur-xl" style={{ backgroundColor: trailColor }} />
                  {/* Snake body - 5 segments in a curve */}
                  <svg width="120" height="100" viewBox="0 0 120 100" className="relative z-10">
                    <defs>
                      <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    {/* Body segments (curved path) */}
                    <path d="M 20 70 Q 40 70 50 55 Q 60 40 75 35 Q 90 30 100 25" fill="none" stroke={skinColor} strokeWidth="10" strokeLinecap="round" filter="url(#glow)" opacity="0.6" />
                    <path d="M 20 70 Q 40 70 50 55 Q 60 40 75 35 Q 90 30 100 25" fill="none" stroke={skinColor} strokeWidth="7" strokeLinecap="round" />
                    {/* Head */}
                    <circle cx="100" cy="25" r="7" fill={skinColor} filter="url(#glow)" />
                    <circle cx="100" cy="25" r="5.5" fill={skinColor} />
                    {/* Eyes */}
                    <circle cx="103" cy="22" r="2" fill="white" />
                    <circle cx="103" cy="22" r="1" fill="#0f172a" />
                    {/* Trail sparkles */}
                    <circle cx="15" cy="73" r="2" fill={trailColor} opacity="0.5" className="animate-pulse" />
                    <circle cx="8" cy="76" r="1.5" fill={trailColor} opacity="0.3" className="animate-pulse" />
                    <circle cx="22" cy="68" r="1" fill={trailColor} opacity="0.4" className="animate-pulse" />
                  </svg>
                  {/* Death FX indicator */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500 uppercase tracking-wider">{activeDeath?.emoji || '💥'}</div>
                </div>
              </div>
              {/* Status indicator */}
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-950/80 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-mono text-slate-400">ACTIVE</span>
              </div>
            </div>

            {/* Equipped items grid */}
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-900/60">
                <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider block">Skin</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{activeSkin?.emoji || '🐍'}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{activeSkin?.name || 'Default'}</span>
                    <div className="w-full h-1 bg-slate-950 rounded-full mt-1"><div className="h-full rounded-full" style={{ width: '100%', backgroundColor: skinColor }} /></div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-900/60">
                <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider block">Trail</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{activeTrail?.emoji || '✨'}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{activeTrail?.name || 'Sparks'}</span>
                    <div className="w-full h-1 bg-slate-950 rounded-full mt-1"><div className="h-full rounded-full" style={{ width: '100%', backgroundColor: trailColor }} /></div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-900/60">
                <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider block">Death FX</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{activeDeath?.emoji || '💥'}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{activeDeath?.name || 'Splash'}</span>
                    <div className="w-full h-1 bg-slate-950 rounded-full mt-1"><div className="h-full rounded-full" style={{ width: '100%', backgroundColor: deathColor }} /></div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-900/60">
                <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider block">Region</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{activeFlag?.flag || '🏴'}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{activeFlag?.name || 'Unknown'}</span>
                    <span className="text-[9px] font-mono text-slate-500">{activeFlag?.code || 'US'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spectate Overlay
// ---------------------------------------------------------------------------
function SpectateOverlay({ session, onClose }: { session: SpectateSession; onClose: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-fuchsia-500/40 bg-fuchsia-950/10 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: session.friend.skinColor + '20', border: `1px solid ${session.friend.skinColor}50` }}>
            <span className="text-lg">🐍</span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-fuchsia-400 animate-pulse" />
              Spectating {session.friend.name}
            </h4>
            <span className="text-[10px] text-fuchsia-300 font-mono">LIVE • {session.arenaName}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mini arena view */}
      <div className="relative w-full h-36 rounded-xl bg-slate-950/80 border border-fuchsia-500/20 overflow-hidden mb-4">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
        {/* Simulated snakes */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="100%" height="100%" viewBox="0 0 400 144" preserveAspectRatio="xMidYMid meet">
            {/* Main friend snake */}
            <path d="M 80 100 Q 120 100 140 80 Q 160 60 200 55 Q 240 50 280 40 Q 310 35 340 30" fill="none" stroke={session.friend.skinColor} strokeWidth="8" strokeLinecap="round" opacity="0.4" />
            <path d="M 80 100 Q 120 100 140 80 Q 160 60 200 55 Q 240 50 280 40 Q 310 35 340 30" fill="none" stroke={session.friend.skinColor} strokeWidth="5" strokeLinecap="round" />
            <circle cx="340" cy="30" r="5" fill={session.friend.skinColor} />
            <circle cx="343" cy="27" r="1.5" fill="white" />
            <circle cx="343" cy="27" r="0.8" fill="#0f172a" />
            {/* Bot snakes */}
            <path d="M 50 40 Q 70 50 90 45" fill="none" stroke="#64748b" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            <path d="M 300 90 Q 320 80 340 85" fill="none" stroke="#64748b" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            <path d="M 150 100 Q 170 110 190 105" fill="none" stroke="#64748b" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
            {/* Food orbs */}
            <circle cx="60" cy="70" r="3" fill="#facc15" opacity="0.6" className="animate-pulse" />
            <circle cx="250" cy="65" r="3" fill="#facc15" opacity="0.5" className="animate-pulse" />
            <circle cx="180" cy="35" r="4" fill="#facc15" opacity="0.7" className="animate-pulse" />
            <circle cx="320" cy="55" r="2.5" fill="#facc15" opacity="0.4" className="animate-pulse" />
          </svg>
        </div>
        {/* Live badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-slate-950/80 rounded-full px-2.5 py-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">LIVE</span>
        </div>
        {/* Timer */}
        <div className="absolute top-2 right-2 bg-slate-950/80 rounded-full px-2.5 py-1">
          <span className="text-[10px] font-mono text-slate-300">{session.elapsed}s</span>
        </div>
        {/* Extraction progress */}
        {session.status === 'extracting' && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="bg-slate-950/80 rounded-lg p-1.5">
              <div className="flex items-center justify-between text-[9px] mb-1">
                <span className="text-amber-400 font-bold uppercase">Extraction in progress</span>
                <span className="text-amber-300 font-mono">67%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full animate-pulse" style={{ width: '67%' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-950/60 rounded-lg p-2.5 text-center border border-slate-900/60">
          <span className="text-sm font-bold font-mono text-emerald-400">{session.chipsCarried}</span>
          <span className="block text-[8px] uppercase font-bold text-slate-500 mt-0.5">Chips</span>
        </div>
        <div className="bg-slate-950/60 rounded-lg p-2.5 text-center border border-slate-900/60">
          <span className="text-sm font-bold font-mono text-rose-400">{session.kills}</span>
          <span className="block text-[8px] uppercase font-bold text-slate-500 mt-0.5">Kills</span>
        </div>
        <div className="bg-slate-950/60 rounded-lg p-2.5 text-center border border-slate-900/60">
          <span className="text-sm font-bold font-mono text-indigo-400">{session.snakeLength}</span>
          <span className="block text-[8px] uppercase font-bold text-slate-500 mt-0.5">Tail</span>
        </div>
        <div className="bg-slate-950/60 rounded-lg p-2.5 text-center border border-slate-900/60">
          <span className={`text-sm font-bold font-mono ${session.status === 'extracting' ? 'text-amber-400' : 'text-emerald-400'}`}>{session.status === 'extracting' ? 'EXIT' : 'ALIVE'}</span>
          <span className="block text-[8px] uppercase font-bold text-slate-500 mt-0.5">Status</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cosmetics Showcase Row
// ---------------------------------------------------------------------------
function CosmeticsShowcase({
  activeSkin,
  activeTrail,
  activeDeath,
  activeFlagCosmetic,
  activeBanner,
}: {
  activeSkin: ReturnType<typeof getCosmeticById>;
  activeTrail: ReturnType<typeof getCosmeticById>;
  activeDeath: ReturnType<typeof getCosmeticById>;
  activeFlagCosmetic: ReturnType<typeof getCosmeticById>;
  activeBanner: ReturnType<typeof getCosmeticById>;
}) {
  const items = [
    { label: 'Skin', cosmetic: activeSkin, fallbackEmoji: '🐍', fallbackName: 'Default' },
    { label: 'Trail', cosmetic: activeTrail, fallbackEmoji: '✨', fallbackName: 'Sparks' },
    { label: 'Death FX', cosmetic: activeDeath, fallbackEmoji: '💥', fallbackName: 'Splash' },
    { label: 'Flag', cosmetic: activeFlagCosmetic, fallbackEmoji: '🏴', fallbackName: 'None' },
    { label: 'Banner', cosmetic: activeBanner, fallbackEmoji: '🌅', fallbackName: 'None' },
  ];

  return (
    <div className="flex flex-wrap gap-3 mb-5 pb-5 border-b border-slate-900/60">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 bg-slate-950/40 border border-slate-900 rounded-lg px-2.5 py-1.5 hover:border-slate-800 transition"
        >
          <span className="text-sm">{item.cosmetic?.emoji || item.fallbackEmoji}</span>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase text-slate-500 leading-none">{item.label}</span>
            <span className="text-[11px] font-sans font-bold text-slate-300 leading-tight">
              {item.cosmetic?.name || item.fallbackName}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tournament Guardrails Section (DB-backed)
// ---------------------------------------------------------------------------
function TournamentGuardrailsSection({
  tournamentStats,
  tournamentLoading,
}: {
  tournamentStats: TournamentStats | null;
  tournamentLoading: boolean;
}) {
  if (tournamentLoading) {
    return (
      <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
        <PanelSkeleton count={3} height="h-24" />
      </div>
    );
  }

  const matchesPlayed = tournamentStats?.matchesPlayed ?? 0;
  const matchesMax = tournamentStats?.matchesMax ?? 10000;
  const totalBought = tournamentStats?.totalBought ?? 0;
  const annualBuyCap = tournamentStats?.annualBuyCap ?? 2500000;
  const adsToday = tournamentStats?.adsToday ?? 0;
  const adsMax = tournamentStats?.adsMax ?? 12;

  const matchPct = matchesMax > 0 ? (matchesPlayed / matchesMax) * 100 : 0;
  const buyPct = annualBuyCap > 0 ? (totalBought / annualBuyCap) * 100 : 0;
  const adsPct = adsMax > 0 ? (adsToday / adsMax) * 100 : 0;

  return (
    <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
            Annual Tournament Guardrails &amp; Limit Allowances
          </h3>
        </div>
        <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
          1-YEAR UTC TOURNAMENT CYCLE ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CapCard
          icon={<Swords className="w-3.5 h-3.5 text-indigo-400" />}
          label="Matches Allowed"
          value={`${matchesPlayed.toLocaleString()} / ${matchesMax.toLocaleString()}`}
          barClass="from-indigo-500 to-purple-500"
          pct={matchPct}
          leftLabel={`Completed: ${matchesPlayed.toLocaleString()}`}
          rightLabel={`Remaining: ${(matchesMax - matchesPlayed).toLocaleString()} matches`}
          rightClass="text-emerald-400 font-bold"
        />
        <CapCard
          icon={<Landmark className="w-3.5 h-3.5 text-emerald-400" />}
          label="Annual Buy Cap (25L)"
          value={`${totalBought.toLocaleString()} / ${annualBuyCap.toLocaleString()} c`}
          barClass="from-emerald-500 to-teal-400"
          pct={buyPct}
          leftLabel={`Bought: ${totalBought.toLocaleString()} c`}
          rightLabel={`Cap Remaining: ${(annualBuyCap - totalBought).toLocaleString()} c`}
          rightClass="text-emerald-400 font-bold"
        />
        <CapCard
          icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />}
          label="Rewarded Ads Today"
          value={`${adsToday} / ${adsMax} Ads`}
          barClass="from-amber-500 to-yellow-400"
          pct={adsPct}
          leftLabel={`Watched: ${adsToday}`}
          rightLabel="Resets at 00:00 UTC"
          rightClass="text-amber-400 font-bold"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Account Section
// ---------------------------------------------------------------------------
function DeleteAccountSection({
  onConfirm,
  deleting,
}: {
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-rose-300 font-sans uppercase tracking-wider">
            Danger Zone
          </h3>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Permanently delete your account and all associated data.
          </p>
        </div>
      </div>
      <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/15 text-xs text-rose-300/80 leading-relaxed mb-4">
        <strong className="text-rose-300 block mb-0.5">
          ⚠ This action is irreversible.
        </strong>
        Deleting your account will permanently remove all your chips, stats, cosmetics, friends, match history, and clan memberships. This cannot be undone.
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={deleting}
            className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-slate-900 border-rose-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-400">Delete Account Permanently</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently delete your account, all chips, stats, cosmetics, friends, and match history. This action is irreversible and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              Yes, Delete My Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identity Editor
// ---------------------------------------------------------------------------
interface IdentityEditorProps {
  newName: string;
  setNewName: (v: string) => void;
  selectedCountry: string;
  setSelectedCountry: (v: string) => void;
  selectedAvatar: string;
  setSelectedAvatar: (v: string) => void;
  instagram: string;
  setInstagram: (v: string) => void;
  youtube: string;
  setYoutube: (v: string) => void;
  twitch: string;
  setTwitch: (v: string) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

function IdentityEditor(props: IdentityEditorProps) {
  const {
    newName,
    setNewName,
    selectedCountry,
    setSelectedCountry,
    selectedAvatar,
    setSelectedAvatar,
    instagram,
    setInstagram,
    youtube,
    setYoutube,
    twitch,
    setTwitch,
    isDragging,
    setIsDragging,
    onDrop,
    onFileChange,
    onCancel,
    onSave,
    saving,
  } = props;

  const isImageAvatar =
    selectedAvatar.startsWith('data:') || selectedAvatar.startsWith('http');

  return (
    <div className="border border-indigo-500/30 bg-slate-950/80 rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
          <Lock className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white font-sans">
            Handshake Registration Protocol
          </h3>
          <p className="text-xs text-slate-400">
            Lock down your tournament handle and regional alignment. All
            changes are logged.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nickname */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Challenger Handle
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={15}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full"
            placeholder="Enter nickname"
          />
          <span className="text-[10px] text-slate-500">
            Max 15 characters. System validates non-duplicate handle signatures.
          </span>
        </div>

        {/* Country */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Faction Region (Flag)
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full cursor-pointer"
          >
            {FACTION_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.code})
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500">
            Associates your extraction chips to regional champion rankings.
          </span>
        </div>

        {/* Avatar customizer */}
        <div className="md:col-span-2 flex flex-col gap-3 border-t border-slate-900/60 pt-5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Profile Avatar / Identity Emblem
          </label>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Left: drag-drop */}
            <div className="md:col-span-5 flex flex-col gap-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() =>
                  document.getElementById('avatar-file-input')?.click()
                }
                className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 relative group h-44 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : 'border-slate-800 bg-slate-900/40 hover:border-indigo-500/40 hover:bg-slate-900/60'
                }`}
              >
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />

                {selectedAvatar && isImageAvatar ? (
                  <div className="absolute inset-0 p-1.5 flex flex-col items-center justify-center bg-slate-950/80 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Upload className="w-6 h-6 text-indigo-400 mb-1" />
                    <span className="text-[10px] text-white font-sans font-bold">
                      CHANGE IMAGE
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5">
                      Drag &amp; Drop or Click
                    </span>
                  </div>
                ) : null}

                {selectedAvatar ? (
                  isImageAvatar ? (
                    <div className="w-24 h-24 rounded-2xl border border-indigo-500/20 overflow-hidden relative shadow-lg">
                      <img
                        src={selectedAvatar}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-4xl mb-2 shadow-inner">
                        {selectedAvatar}
                      </div>
                      <span className="text-xs font-bold text-white font-sans">
                        Preset Selected
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-sans">
                        Click here to upload custom image instead
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors mb-2.5">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white font-sans">
                      Upload Custom Photo
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Drag &amp; Drop or click to browse
                    </span>
                    <span className="text-[9px] text-slate-500 mt-0.5">
                      PNG, JPG, WebP up to 1.5MB
                    </span>
                  </div>
                )}
              </div>

              {selectedAvatar && (
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('')}
                  className="py-1.5 px-3 bg-slate-900 hover:bg-red-950/40 hover:text-red-400 hover:border-red-500/20 border border-slate-800 text-slate-400 rounded-xl text-[10px] font-sans font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset to Skin Default
                </button>
              )}
            </div>

            {/* Right: preset grid */}
            <div className="md:col-span-7 flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                Choose Preset Emblem
              </span>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AVATARS.map((p) => {
                  const isSelected = selectedAvatar === p.emoji;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedAvatar(p.emoji)}
                      className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-1.5 group hover:scale-105 h-20 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg'
                          : 'border-slate-900 bg-slate-950/40 hover:border-slate-800'
                      }`}
                      title={p.label}
                    >
                      <span className="text-2xl select-none group-hover:scale-110 transition-transform">
                        {p.emoji}
                      </span>
                      <span className="text-[8.5px] font-sans font-semibold text-slate-400 group-hover:text-slate-200 truncate w-full text-center">
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Social channels — now DB-backed */}
        <div className="md:col-span-2 flex flex-col gap-3 border-t border-slate-900/60 pt-5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-400" /> Creator Social
            Channels (Showcased on your Public Profile)
          </label>
          <p className="text-[11px] text-slate-400 font-sans">
            Link your Instagram handle, YouTube channel, and Twitch profile so
            other vipers and allies can follow you and watch your game clips!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-pink-400 font-sans uppercase">
                📸 Instagram Handle
              </label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@username (e.g. @hari_snake_god)"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-pink-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-red-400 font-sans uppercase">
                🎥 YouTube Channel / Handle
              </label>
              <input
                type="text"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="@channel or URL"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-purple-400 font-sans uppercase">
                📱 Twitch Stream Handle
              </label>
              <input
                type="text"
                value={twitch}
                onChange={(e) => setTwitch(e.target.value)}
                placeholder="twitch_username"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 p-3.5 bg-indigo-950/20 border border-indigo-500/10 rounded-xl flex items-start gap-3">
        <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs font-sans leading-relaxed text-slate-300">
          <strong className="text-indigo-300 block mb-0.5">
            CYBER HANDSHAKE WARNING:
          </strong>
          Changing your registered alias or territory updates global tournament
          indices. Immutable record logs are appended to the ledger below.
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-900 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" /> Save Handshake
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Co-Op Invite Modal
// ---------------------------------------------------------------------------
interface CoOpInviteModalProps {
  friend: Friend;
  playerChips: number;
  selectedArenaId: string;
  setSelectedArenaId: (id: string) => void;
  statusMessage: InviteStatusMessage | null;
  setStatusMessage: (m: InviteStatusMessage | null) => void;
  onClose: () => void;
  onSend: () => void;
  onToast?: ToastFn;
}

function CoOpInviteModal({
  friend,
  playerChips,
  selectedArenaId,
  setSelectedArenaId,
  statusMessage,
  setStatusMessage,
  onClose,
  onSend,
  onToast,
}: CoOpInviteModalProps) {
  const friendChips = getFriendSimulatedChips(friend);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: friend.skinColor }}
        />

        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Swords className="w-5 h-5 text-violet-400 animate-pulse" />
            <div>
              <h3 className="font-bold text-white text-sm font-sans">
                Co-Op Lobby Invite
              </h3>
              <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                Assemble a squad with your allies
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl flex flex-col gap-1 text-center">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-sans">
              Your Balance
            </span>
            <span className="text-sm font-bold font-mono text-indigo-400">
              {playerChips.toLocaleString()}{' '}
              <span className="text-xs font-sans text-slate-500">c</span>
            </span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl flex flex-col gap-1 text-center">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-sans">
              {friend.name}
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {friendChips.toLocaleString()}{' '}
              <span className="text-xs font-sans text-slate-500">c</span>
            </span>
          </div>
        </div>

        {/* Arena selector */}
        <div className="flex flex-col gap-2 my-4">
          <label className="text-[10px] text-slate-400 font-bold uppercase font-sans tracking-wide">
            Select Arena Stakes
          </label>
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1 va-scroll">
            {ARENA_TIERS.map((tier) => {
              const isSelected = tier.id === selectedArenaId;
              const friendAffords = friendChips >= tier.buyIn;
              const youAfford = playerChips >= tier.buyIn;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setSelectedArenaId(tier.id);
                    setStatusMessage(null);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 border-indigo-500 shadow-md'
                      : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: tier.accentColor }}
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {tier.name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-sans mt-0.5 leading-none">
                        Buy-In: {tier.buyIn.toLocaleString()} c
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {!youAfford ? (
                      <span className="text-[8px] bg-rose-950/80 text-rose-400 border border-rose-900/40 px-1.5 py-0.5 rounded font-bold font-sans">
                        You can&apos;t afford
                      </span>
                    ) : !friendAffords ? (
                      <span className="text-[8px] bg-amber-950/80 text-amber-300 border border-amber-900/40 px-1.5 py-0.5 rounded font-bold font-sans">
                        They can&apos;t afford
                      </span>
                    ) : (
                      <span className="text-[8px] bg-emerald-950/80 text-emerald-300 border border-emerald-900/40 px-1.5 py-0.5 rounded font-bold font-sans">
                        Eligible 🤝
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Speech bubble */}
        {statusMessage && (
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col gap-2 my-4">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  backgroundColor: `${friend.skinColor}33`,
                  color: friend.skinColor,
                }}
              >
                💬
              </div>
              <span className="text-[10px] font-bold text-slate-300">
                {friend.name} responds:
              </span>
            </div>
            <p className="text-xs italic text-slate-300 leading-relaxed pl-7">
              &quot;{statusMessage.text}&quot;
            </p>

            {statusMessage.type === 'counter' &&
              statusMessage.counterArenaId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedArenaId(statusMessage.counterArenaId!);
                    setStatusMessage(null);
                    notify(
                      'Switched buy-in to match counter-proposal!',
                      'info',
                      onToast,
                    );
                  }}
                  className="mt-1 ml-7 self-start px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-[10px] font-bold font-sans transition cursor-pointer"
                >
                  🤝 Accept Proposal &amp; Invite
                </button>
              )}
          </div>
        )}

        {/* Modal actions */}
        <div className="flex items-center gap-2 border-t border-slate-800/60 pt-4 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-white rounded-xl text-xs font-bold font-sans transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border border-violet-500/30 text-white rounded-xl text-xs font-bold font-sans transition cursor-pointer"
          >
            Send Co-Op Invite
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Security Settings Card — Change Password & Security PIN                      */
/* ========================================================================== */

function SecuritySettingsCard({
  player,
  onToast,
}: {
  player: PlayerProfile;
  onToast?: ToastFn;
}) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpBusy, setCpBusy] = useState(false);

  const [showChangePin, setShowChangePin] = useState(false);
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setCpBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data?.error || 'Failed to change password.', 'error', onToast);
        return;
      }
      notify('Password changed successfully!', 'success', onToast);
      setShowChangePassword(false);
      setCpCurrent('');
      setCpNew('');
    } catch {
      notify('Network error.', 'error', onToast);
    } finally {
      setCpBusy(false);
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinBusy(true);
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: pinCurrent, newPin: pinNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data?.error || 'Failed to change PIN.', 'error', onToast);
        return;
      }
      notify(data?.message || 'Security PIN updated!', 'success', onToast);
      setShowChangePin(false);
      setPinCurrent('');
      setPinNew('');
    } catch {
      notify('Network error.', 'error', onToast);
    } finally {
      setPinBusy(false);
    }
  }

  const isRegistered = !!player.email;
  const canChangePassword = isRegistered;
  const canManagePin = isRegistered;

  if (!isRegistered) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      <div className="p-3 flex items-center justify-between border-b border-slate-800/60">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          Security Settings
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          {player.securityPin ? '🔐 PIN Set' : '⚠️ No PIN'}
        </span>
      </div>

      {canChangePassword && (
        <div className="p-3 border-b border-slate-800/40">
          {!showChangePassword ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300 font-semibold">Password</p>
                <p className="text-[10px] text-slate-500">Change your account password</p>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="px-3 py-1.5 text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg hover:bg-amber-500/20 transition cursor-pointer"
              >
                Change
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="password"
                  required
                  placeholder="Current password"
                  value={cpCurrent}
                  onChange={(e) => setCpCurrent(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="New password (min 6)"
                  value={cpNew}
                  onChange={(e) => setCpNew(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={cpBusy}
                  className="px-3 py-1.5 text-[10px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-400 transition cursor-pointer disabled:opacity-50"
                >
                  {cpBusy ? 'Saving…' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowChangePassword(false); setCpCurrent(''); setCpNew(''); }}
                  className="px-3 py-1.5 text-[10px] border border-slate-700 text-slate-400 rounded-lg hover:border-slate-600 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {canManagePin && (
      <div className="p-3">
        {!showChangePin ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-300 font-semibold">Security PIN</p>
              <p className="text-[10px] text-slate-500">
                {player.securityPin
                  ? 'Used for password recovery. Keep it safe!'
                  : 'Set a 4-digit PIN to enable password recovery.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowChangePin(true)}
              className="px-3 py-1.5 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg hover:bg-emerald-500/20 transition cursor-pointer"
            >
              {player.securityPin ? 'Change PIN' : 'Set PIN'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleChangePin} className="space-y-2">
            {player.securityPin && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Current PIN</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  placeholder="Enter current 4-digit PIN"
                  value={pinCurrent}
                  onChange={(e) => setPinCurrent(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition"
                />
              </div>
            )}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">New PIN (4 digits)</label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{4}"
                placeholder="Enter new 4-digit PIN"
                value={pinNew}
                onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ''))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pinBusy}
                className="px-3 py-1.5 text-[10px] font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition cursor-pointer disabled:opacity-50"
              >
                {pinBusy ? 'Saving…' : player.securityPin ? 'Update PIN' : 'Set PIN'}
              </button>
              <button
                type="button"
                onClick={() => { setShowChangePin(false); setPinCurrent(''); setPinNew(''); }}
                className="px-3 py-1.5 text-[10px] border border-slate-700 text-slate-400 rounded-lg hover:border-slate-600 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Guest → Registered Upgrade Banner                                         */
/* ========================================================================== */

function GuestUpgradeBanner({
  onRefresh,
  onToast,
}: {
  onRefresh: () => Promise<void>;
  onToast?: ToastFn;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  if (!open) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-amber-300 font-sans">
                You&apos;re playing as a Guest
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Upgrade to a registered account to secure your progress. All chips, stats, cosmetics, and friends carry over.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold font-sans rounded-xl border border-amber-500 transition cursor-pointer shadow-lg shadow-amber-600/20"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5 inline" />
            Upgrade Now
          </button>
        </div>
      </div>
    );
  }

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Upgrade failed.');
        return;
      }
      setOpen(false);
      notify('Account upgraded successfully! All progress preserved.', 'success', onToast);
      await onRefresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-amber-300 font-sans">Upgrade to Registered Account</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
        <Lock className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
        <strong className="text-slate-300">Your progress is safe.</strong> All chips, stats, cosmetics, streaks, friends, and clan memberships carry over. You keep your VENOM tag. Just add an email and password to secure your account.
      </div>

      <form onSubmit={handleUpgrade} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="ug-name" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Display Name
            </label>
            <input
              id="ug-name"
              type="text"
              required
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ViperStrike"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ug-email" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Email
            </label>
            <input
              id="ug-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@arena.gg"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="ug-pass" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Password (min 6 chars)
            </label>
            <input
              id="ug-pass"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ug-pin" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Security PIN (4 digits, optional)
            </label>
            <input
              id="ug-pin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 1234"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold font-sans rounded-xl border border-amber-500 transition cursor-pointer shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Upgrading…' : 'Upgrade & Secure Account'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-white text-xs font-bold font-sans rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================== */
/* Friend Profile Inspector Dialog                                            */
/* ========================================================================== */

/** Deterministic hash from friend id for consistent simulated stats */
function friendHash(friend: Friend, offset: number): number {
  let h = 0;
  for (let i = 0; i < friend.id.length; i++) {
    h = (h * 31 + friend.id.charCodeAt(i)) & 0xffffffff;
  }
  return (Math.abs(h + offset) % 1000) + 10;
}

function FriendProfileInspector({
  friend,
  allFriends,
  onClose,
}: {
  friend: Friend | null;
  allFriends: Friend[];
  onClose: () => void;
}) {
  const [isFollowing, setIsFollowing] = useState(() => {
    if (!friend) return false;
    try {
      const followed: string[] = JSON.parse(localStorage.getItem('venom_following') || '[]');
      return followed.includes(friend.id);
    } catch { return false; }
  });

  if (!friend) return null;

  const friendChips = getFriendSimulatedChips(friend);
  const statusText = friend.status === 'online'
    ? 'Online'
    : friend.status === 'idle'
      ? 'Idle'
      : friend.status === 'in-match'
        ? 'In Match'
        : 'Offline';

  // ── Deterministic simulated stats ──
  const kills = friendHash(friend, 100);
  const deaths = friendHash(friend, 200);
  const extracts = friendHash(friend, 300);
  const kd = (kills / Math.max(deaths, 1)).toFixed(2);
  const extractRate = ((extracts / Math.max(kills + deaths, 1)) * 100).toFixed(1);
  const bestStreak = friendHash(friend, 400);
  const biggestExtract = friendHash(friend, 500) * 5;
  const totalMatches = kills + deaths;
  const winStreak = Math.min(bestStreak, 12);

  // Social graph stats (deterministic)
  const friendCount = 8 + (friendHash(friend, 1000) % 40);
  const followerCount = 30 + (friendHash(friend, 1100) % 470);
  const followingCount = 5 + (friendHash(friend, 1200) % 80);

  // Mutual friends (pick from your friend list)
  const mutualFriends = allFriends
    .filter(f => f.id !== friend.id)
    .sort((a, b) => {
      const ha = friendHash({ ...friend, id: a.id }, 2000);
      const hb = friendHash({ ...friend, id: b.id }, 2000);
      return ha - hb;
    })
    .slice(0, Math.min(3, allFriends.length - 1));

  // Simulated recent matches
  const arenas = ['Slum Alley', 'Neon Grid', 'Viper Syndicate', 'Toxic Wasteland', 'Crimson District'];
  const recentMatches = Array.from({ length: 5 }, (_, i) => {
    const seed = friendHash(friend, 600 + i * 7);
    const won = seed % 3 !== 0;
    return {
      arena: arenas[seed % arenas.length],
      won,
      chips: won ? (seed % 300) + 50 : -(seed % 80) - 10,
      kills: seed % 7,
      length: (seed % 25) + 8,
      duration: (seed % 120) + 30,
    };
  });

  // Simulated cosmetics
  const skinNames = ['Venomous Viper', 'Crimson Fury', 'Neon Striker', 'Shadow Slinker', 'Arctic Ghost', 'Golden Cobra'];
  const trailNames = ['Toxic Trail', 'Flame Wake', 'Frost Path', 'Shadow Mist', 'Spark Stream', 'None'];
  const equippedSkin = skinNames[friendHash(friend, 800) % skinNames.length];
  const equippedTrail = trailNames[friendHash(friend, 900) % trailNames.length];

  // Simulated social links (deterministic handles)
  const socials = [
    { platform: 'YouTube', handle: `@${friend.name.toLowerCase().replace(/\s/g, '')}Gaming`, color: '#FF0000', icon: '▶' },
    { platform: 'Instagram', handle: `@${friend.name.toLowerCase().replace(/\s/g, '')}_va`, color: '#E4405F', icon: '📷' },
    { platform: 'Twitch', handle: `${friend.name.toLowerCase().replace(/\s/g, '')}tv`, color: '#9146FF', icon: '🎮' },
    { platform: 'Discord', handle: `${friend.name.toLowerCase().replace(/\s/g, '')}#0001`, color: '#5865F2', icon: '💬' },
  ];
  const activeSocials = socials.filter((_, i) => friendHash(friend, 1300 + i * 3) % 5 !== 0);

  // Playstyle tag
  const kdNum = parseFloat(kd);
  const playstyle = kdNum > 2.5
    ? { label: 'Aggressive Predator', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' }
    : kdNum > 1.5
      ? { label: 'Balanced Striker', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
      : { label: 'Stealth Extractor', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };

  // Favorite arena
  const arenaCounts: Record<string, number> = {};
  recentMatches.forEach(m => { arenaCounts[m.arena] = (arenaCounts[m.arena] || 0) + 1; });
  const favoriteArena = Object.entries(arenaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || arenas[0];

  // Member since (simulated)
  const daysAgo = 30 + (friendHash(friend, 1400) % 600);
  const joinDate = new Date(Date.now() - daysAgo * 86_400_000);
  const memberSince = joinDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Country flag
  const countryFlag = friend.country
    ? COUNTRIES.find(c => c.code === friend.country)?.flag || '🌐'
    : '🌐';
  const countryName = friend.country
    ? COUNTRIES.find(c => c.code === friend.country)?.name || 'Unknown'
    : 'Unknown';

  const isVerified = friend.level >= 50;

  const toggleFollow = () => {
    try {
      const followed: string[] = JSON.parse(localStorage.getItem('venom_following') || '[]');
      if (isFollowing) {
        const idx = followed.indexOf(friend.id);
        if (idx > -1) followed.splice(idx, 1);
      } else {
        followed.push(friend.id);
      }
      localStorage.setItem('venom_following', JSON.stringify(followed));
      setIsFollowing(!isFollowing);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Modal */}
      <div
        className="relative bg-slate-950 border border-slate-800 text-white max-w-2xl w-[95vw] max-h-[92vh] overflow-y-auto va-scroll rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HERO HEADER ── */}
        <div className="relative p-5 pb-4 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-b border-slate-800">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: friend.skinColor + '15' }} />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: friend.skinColor + '08' }} />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4 mb-4">
            {/* Avatar */}
            <div className="w-18 h-18 rounded-2xl flex items-center justify-center border-2 relative shadow-lg shrink-0" style={{ borderColor: friend.skinColor + '60', backgroundColor: friend.skinColor + '15' }}>
              <span className="text-4xl select-none">🐍</span>
              <span className="absolute -bottom-1.5 -right-1.5 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow" style={{ color: friend.skinColor }}>
                Lvl {friend.level}
              </span>
            </div>

            {/* Name + tag + status */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white">{friend.name}</h3>
                {isVerified && <BadgeCheck className="w-5 h-5 text-cyan-400 shrink-0" />}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${playstyle.color}`}>{playstyle.label}</span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                #{friend.userTag}
                <span className="mx-1.5 text-slate-700">•</span>
                {countryFlag} {countryName}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase font-mono ${
                  friend.status === 'online' ? 'text-emerald-400' :
                  friend.status === 'idle' ? 'text-amber-400' :
                  friend.status === 'in-match' ? 'text-fuchsia-400' :
                  'text-slate-500'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    friend.status === 'online' ? 'bg-emerald-500' :
                    friend.status === 'idle' ? 'bg-amber-500 animate-pulse' :
                    friend.status === 'in-match' ? 'bg-fuchsia-500 animate-pulse' :
                    'bg-slate-600'
                  }`} />
                  {statusText}
                </span>
                {friend.status === 'in-match' && (
                  <span className="text-[10px] bg-fuchsia-500/15 border border-fuchsia-500/25 text-fuchsia-400 px-2 py-0.5 rounded-full font-bold animate-pulse">LIVE</span>
                )}
                <span className="text-[10px] text-slate-600 font-sans">Member since {memberSince}</span>
              </div>
            </div>

            {/* Follow button */}
            <button
              type="button"
              onClick={toggleFollow}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                isFollowing
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400'
                  : 'bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 border-fuchsia-500/30 text-white shadow-lg shadow-fuchsia-500/15'
              }`}
            >
              {isFollowing ? <><UserMinus className="w-3.5 h-3.5" /> Unfollow</> : <><UserPlus className="w-3.5 h-3.5" /> Follow</>}
            </button>
          </div>

          {/* Social Stats Bar */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-900/70 border border-slate-800/60 rounded-xl p-2.5 text-center">
              <span className="text-base font-bold font-mono text-indigo-400 block">{friendCount}</span>
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Friends</span>
            </div>
            <div className="bg-slate-900/70 border border-slate-800/60 rounded-xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1">
                <Heart className={`w-3 h-3 ${isFollowing ? 'text-rose-400 fill-rose-400' : 'text-slate-500'}`} />
                <span className="text-base font-bold font-mono text-rose-400">{followerCount + (isFollowing ? 1 : 0)}</span>
              </div>
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Followers</span>
            </div>
            <div className="bg-slate-900/70 border border-slate-800/60 rounded-xl p-2.5 text-center">
              <span className="text-base font-bold font-mono text-emerald-400 block">{followingCount}</span>
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Following</span>
            </div>
          </div>

          {/* Chips bar */}
          <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-800/60">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-400 font-sans flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-emerald-400" /> Banked Chips
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{friendChips.toLocaleString()} c</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (friendChips / 10000) * 100)}%`, backgroundColor: friend.skinColor }} />
            </div>
          </div>
        </div>

        {/* ── BODY SECTIONS ── */}
        <div className="p-5 space-y-5">

          {/* ── Achievements & Milestones ── */}
          {(() => {
            const friendMilestone = milestoneTierForChips(friendChips);
            const friendBadges = MILESTONE_TIERS.filter(t => t.id !== 'all' && friendChips >= t.minChips);
            // Simulated HOF for high-chip friends
            const simulatedHof = friendChips >= 2_500_000
              ? [{
                  type: friendChips >= 10_000_000 ? 'championship' : 'milestone',
                  badge: friendMilestone.badge,
                  title: friendChips >= 10_000_000 ? 'World Venom Champion Contender' : `${friendMilestone.badge} Elite`,
                  chips: friendChips,
                  date: joinDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                }]
              : [];
            return (
              <div>
                <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3 font-sans flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-amber-400" /> Achievements &amp; Milestones
                  <span className="text-[10px] text-amber-400 font-mono normal-case">{friendBadges.length} Badge{friendBadges.length !== 1 ? 's' : ''}</span>
                </h4>
                {/* Current tier card */}
                <div className="bg-slate-900/50 border border-amber-500/15 rounded-xl p-3 flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl shrink-0">
                    {friendMilestone.badge.split(' ')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-amber-200 text-xs">{friendMilestone.badge}</div>
                    <div className="text-[10px] text-slate-400">Current Tier · {friendChips.toLocaleString()} chips</div>
                  </div>
                </div>
                {/* HOF entries */}
                {simulatedHof.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <span className="text-[9px] uppercase font-bold text-yellow-400 tracking-wider flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Hall of Fame
                    </span>
                    {simulatedHof.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2.5 bg-yellow-500/5 rounded-lg border border-yellow-500/10">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">{h.type === 'championship' ? '🏆' : '⭐'}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-yellow-200 text-[11px] truncate">{h.title}</div>
                            <div className="text-[9px] text-slate-400">Inducted {h.date}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 shrink-0">{h.chips.toLocaleString()}c</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Badge grid */}
                {friendBadges.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {friendBadges.map(t => (
                      <div key={t.id} className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-2.5 flex items-center gap-2">
                        <span className="text-lg" aria-hidden>{t.badge.split(' ')[0]}</span>
                        <div>
                          <div className="font-bold text-amber-300 text-[11px]">{t.name.split('(')[0].trim()}</div>
                          <div className="text-[9px] text-slate-400">{(t.minChips / 100_000).toFixed(0)}L+ Chips</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-[11px] text-slate-500">No milestones achieved yet.</div>
                )}
              </div>
            );
          })()}

          {/* Combat Statistics */}
          <div>
            <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3 font-sans flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-indigo-400" /> Combat Statistics
              <span className="ml-auto text-[9px] text-slate-600 font-normal normal-case tracking-normal">{totalMatches} total matches • Fav: {favoriteArena}</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <span className="text-lg font-bold font-mono text-white block">{kills}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Kills</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <span className="text-lg font-bold font-mono text-rose-400 block">{deaths}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Deaths</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <span className="text-lg font-bold font-mono text-indigo-400 block">{kd}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">K/D Ratio</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <span className="text-lg font-bold font-mono text-emerald-400 block">{extractRate}%</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Extract Rate</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <span className="text-lg font-bold font-mono text-amber-400 block">{extracts}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Extractions</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <span className="text-lg font-bold font-mono text-fuchsia-400 block">{winStreak}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Best Streak</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <span className="text-lg font-bold font-mono text-emerald-400 block">+{biggestExtract}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Big Extract</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <span className="text-lg font-bold font-mono text-amber-400 block">{Math.round((extracts / Math.max(totalMatches, 1)) * 100)}%</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Win Rate</span>
              </div>
            </div>
          </div>

          {/* Social Links */}
          {activeSocials.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3 font-sans flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-cyan-400" /> Social & Streaming
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                {activeSocials.map(s => (
                  <div
                    key={s.platform}
                    className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 flex items-center gap-3 group cursor-pointer hover:border-slate-700 transition"
                    onClick={() => window.open(`https://${s.platform.toLowerCase()}.com/search?q=${encodeURIComponent(s.handle)}`, '_blank')}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                      style={{ backgroundColor: s.color + '15', border: `1px solid ${s.color}30` }}
                    >
                      {s.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] uppercase font-bold block" style={{ color: s.color + 'CC' }}>{s.platform}</span>
                      <span className="text-[11px] font-mono text-slate-300 block truncate group-hover:text-white transition">{s.handle}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mutual Allies */}
          {mutualFriends.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3 font-sans flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-violet-400" /> Mutual Allies
                <span className="text-[10px] text-violet-400 font-mono normal-case">{mutualFriends.length}</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {mutualFriends.map(mf => (
                  <div
                    key={mf.id}
                    className="flex items-center gap-2 bg-slate-900/50 border border-slate-800/60 rounded-xl px-3 py-2 hover:border-slate-700 transition"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center border shrink-0" style={{ borderColor: mf.skinColor + '40', backgroundColor: mf.skinColor + '15' }}>
                      <span className="text-xs">🐍</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-200 block truncate max-w-[100px]">{mf.name}</span>
                      <span className={`text-[9px] font-mono ${
                        mf.status === 'online' ? 'text-emerald-400' :
                        mf.status === 'in-match' ? 'text-fuchsia-400' :
                        mf.status === 'idle' ? 'text-amber-400' : 'text-slate-500'
                      }`}>{mf.status === 'in-match' ? 'In Match' : mf.status === 'idle' ? 'Idle' : mf.status === 'online' ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipped Cosmetics */}
          <div>
            <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3 font-sans flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Equipped Loadout
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center border" style={{ borderColor: friend.skinColor + '40', backgroundColor: friend.skinColor + '10' }}>
                  <span className="text-lg">🐍</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Skin</span>
                  <span className="text-xs font-bold text-slate-200 block truncate">{equippedSkin}</span>
                </div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-center">
                  <span className="text-lg">✨</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Trail</span>
                  <span className="text-xs font-bold text-slate-200 block truncate">{equippedTrail}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Matches */}
          <div>
            <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3 font-sans flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-400" /> Recent Matches
            </h4>
            <div className="space-y-2 max-h-52 overflow-y-auto va-scroll">
              {recentMatches.map((m, i) => (
                <div key={i} className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.won ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                      {m.won ? <Trophy className="w-4 h-4 text-emerald-400" /> : <Skull className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-200 block font-sans">{m.arena}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{m.kills} kills • {m.length} length • {m.duration}s</span>
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-bold shrink-0 ${m.won ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {m.won ? `+${m.chips}` : m.chips} c
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500 font-sans flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Allied operative
              </span>
              <span className="text-[10px] text-slate-600">•</span>
              <span className="text-[10px] text-slate-600 font-sans flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {memberSince}
              </span>
              <span className="text-[10px] text-slate-600">•</span>
              <span className="text-[10px] text-slate-600 font-sans flex items-center gap-1">
                <Flag className="w-3 h-3" /> {countryName}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Referral Banner — Invite Friend & Get 2,500 Chips                             */
/* ========================================================================== */

function ReferralBanner({
  player,
  referralData,
  referralLoading,
  copiedReferralCode,
  copiedReferralLink,
  onToast,
  onCopyCode,
  onCopyLink,
}: {
  player: PlayerProfile;
  referralData: ReferralData | null;
  referralLoading: boolean;
  copiedReferralCode: boolean;
  copiedReferralLink: boolean;
  onToast?: ToastFn;
  onCopyCode: () => void;
  onCopyLink: () => void;
}) {
  const code = referralData?.referralCode || player.referralCode || '';
  const referrals = referralData?.referrals || [];
  const totalInvited = referrals.length;
  const claimedCount = referrals.filter(r => r.status === 'claimed').length;
  const pendingCount = referrals.filter(r => r.status === 'pending' || r.status === 'active').length;
  const totalChipsEarned = claimedCount * REFERRAL_REWARD;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-950/60 to-emerald-950/20 overflow-hidden relative">
      {/* Decorative glow blobs */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" />

      {/* HERO SECTION */}
      <div className="relative p-5 pb-4 border-b border-amber-500/15">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 relative">
              <Gift className="w-7 h-7 text-white" />
              <div className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-full shadow animate-pulse">
                +{REFERRAL_REWARD.toLocaleString()}
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white font-sans flex items-center gap-2">
                Invite a Friend & Get
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-emerald-400">
                  {REFERRAL_REWARD.toLocaleString()} Chips
                </span>
                <span className="text-xl">🎁</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 font-sans leading-relaxed">
                Share your unique invite code. When your friend joins and plays <strong className="text-amber-400">{REFERRAL_MATCH_THRESHOLD} matches</strong>, both of you receive <strong className="text-emerald-400">{REFERRAL_REWARD.toLocaleString()} chips</strong> instantly!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* REFERRAL CODE + ACTIONS ROW */}
      <div className="relative p-4 sm:p-5 border-b border-amber-500/10">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Code display */}
          <div className="flex-1 bg-slate-950/70 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block font-sans">Your Invite Code</span>
              {referralLoading && !code ? (
                <span className="text-sm font-mono text-slate-600">Loading...</span>
              ) : (
                <span className="text-lg sm:text-xl font-bold font-mono text-amber-400 tracking-wider block truncate">
                  {code || 'VIPER-XXXX'}
                </span>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onCopyCode}
                  disabled={!code}
                  className="shrink-0 p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-xl transition cursor-pointer text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Copy referral code"
                >
                  {copiedReferralCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700 text-xs">
                {copiedReferralCode ? 'Copied!' : 'Copy code'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Share link button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCopyLink}
                disabled={!code}
                className="shrink-0 px-5 py-3 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-white rounded-xl text-xs font-bold font-sans transition shadow-lg shadow-amber-500/15 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copiedReferralLink ? (
                  <><Check className="w-4 h-4" /> Link Copied!</>
                ) : (
                  <><Share2 className="w-4 h-4" /> Share Invite Link</>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700 text-xs">
              {copiedReferralLink ? 'Link copied to clipboard!' : 'Copy invite link to share'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="relative px-4 sm:px-5 py-3 border-b border-amber-500/10">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xl font-bold font-mono text-indigo-400">{totalInvited}</span>
            </div>
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Friends Invited</span>
          </div>
          <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xl font-bold font-mono text-amber-400">{pendingCount}</span>
            </div>
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Pending ({REFERRAL_MATCH_THRESHOLD} matches left)</span>
          </div>
          <div className="bg-slate-950/50 border border-emerald-500/15 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xl font-bold font-mono text-emerald-400">{totalChipsEarned.toLocaleString()}</span>
            </div>
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Chips Earned</span>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="relative px-4 sm:px-5 py-4 border-b border-amber-500/10">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-3 font-sans">How It Works</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-indigo-400 font-mono">1</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 block font-sans">Share Your Code</span>
              <span className="text-[10px] text-slate-400 font-sans leading-relaxed">Send your unique invite code or link to a friend.</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-amber-400 font-mono">2</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 block font-sans">Friend Plays {REFERRAL_MATCH_THRESHOLD} Matches</span>
              <span className="text-[10px] text-slate-400 font-sans leading-relaxed">They register using your code and complete {REFERRAL_MATCH_THRESHOLD} arena matches.</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-emerald-400 font-mono">3</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 block font-sans">Both Get {REFERRAL_REWARD.toLocaleString()} Chips!</span>
              <span className="text-[10px] text-slate-400 font-sans leading-relaxed">Rewards are deposited automatically to both accounts.</span>
            </div>
          </div>
        </div>
      </div>

      {/* REFERRED FRIENDS LIST (if any) */}
      {referrals.length > 0 && (
        <div className="relative px-4 sm:px-5 py-4">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-3 font-sans">Your Referred Friends</span>
          <div className="max-h-40 overflow-y-auto va-scroll space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-slate-950/40 border border-slate-900/60 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    <span className="text-sm">🐍</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-200 block font-sans truncate">{r.referredName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{timeAgo(r.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'pending' || r.status === 'active' ? (
                    <>
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-slate-400 block">{r.matchesPlayed}/{REFERRAL_MATCH_THRESHOLD} matches</span>
                        <div className="w-20 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, (r.matchesPlayed / REFERRAL_MATCH_THRESHOLD) * 100)}%` }} />
                        </div>
                      </div>
                      <Badge className="bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[9px] font-bold">PENDING</Badge>
                    </>
                  ) : (
                    <Badge className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[9px] font-bold">CLAIMED +{REFERRAL_REWARD.toLocaleString()}c</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerProfilePanel;
