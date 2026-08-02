'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { timeAgo } from '@/lib/date-utils';
import {
  Award,
  Calendar,
  Check,
  Clock,
  Compass,
  Copy,
  Crown,
  Edit2,
  Filter,
  Gamepad2,
  Globe,
  History,
  Landmark,
  Link as LinkIcon,
  Lock,
  LogOut,
  RefreshCw,
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
  UserPlus,
  Users,
  X,
  AlertTriangle,
  Download,
  UserCircle,
  Share2,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { COUNTRIES, getCosmeticById, MILESTONE_TIERS, milestoneTierForChips } from '@/lib/game-config';
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
// Match history type
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type ProfileTab = 'stats' | 'history';



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

  // Local matches (fallback when DB is empty)
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);

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

  // -- NEW: Delete account
  const [deletingAccount, setDeletingAccount] = useState(false);
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

  // -- derived values
  const xpNeeded = player.level * 200;
  const xpPercent = Math.min(100, Math.floor((player.xp / xpNeeded) * 100));
  const deathsCount = player.lifetimeDeaths || 0;
  const killsCount = player.lifetimeKills || 0;
  const kdRatio = deathsCount > 0
    ? (killsCount / deathsCount).toFixed(2)
    : killsCount > 0 ? 'Perfect' : '0.00';
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

  // Identity cooldown helpers
  function cooldownRemainingText(changedAt: string | null, cooldownDays: number): string | null {
    if (!changedAt) return null;
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(changedAt).getTime();
    if (elapsed >= cooldownMs) return null;
    const remainingMs = cooldownMs - elapsed;
    const d = Math.floor(remainingMs / 86_400_000);
    const h = Math.floor((remainingMs % 86_400_000) / 3_600_000);
    return d > 0 ? `${d}d ${h}h remaining` : `${h}h remaining`;
  }
  const nameCooldownText = cooldownRemainingText(player.nameChangedAt, 30);
  const countryCooldownText = cooldownRemainingText(player.countryChangedAt, 7);

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
    if (trimmed.length > 20) {
      notify('Nickname must be 20 characters or less.', 'error', onToast);
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

  // -- Determine which matches to display (only show real data, never fake samples)
  const displayMatches = dbMatches;

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
              nameCooldownText={nameCooldownText}
              countryCooldownText={countryCooldownText}
            />
          )}

          {/* Statistics grid — now 10 cards (8 original + Total Matches + Account Age) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label="Banked Wallet"
              subLabel="Deposited Chips"
              value={player.bankedChips.toLocaleString() + ' c'}
              icon={<Landmark className="w-4 h-4 text-emerald-400" />}
              valueClass="text-emerald-400"
            />
            <StatCard
              label="Total Kills"
              subLabel="All Snake Eliminations"
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

          {/* Identity Change Policy Banner */}
          <div className="p-4 rounded-xl border border-slate-900 bg-slate-900/10 flex items-center gap-4">
            <Shield className="w-8 h-8 text-indigo-500 shrink-0" />
            <div className="text-xs leading-relaxed text-slate-400">
              <span className="font-bold text-slate-200 uppercase block mb-0.5">
                IDENTITY LOCK POLICY
              </span>
              Your <strong className="text-slate-200">Challenger Handle</strong> can only be changed once every <strong className="text-amber-400">30 days</strong> and your <strong className="text-slate-200">Faction Region</strong> once every <strong className="text-amber-400">7 days</strong>. This protects leaderboard integrity and prevents identity confusion. Your permanent VENOM-XXXX tag never changes.
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
              Showing {dbMatches.length} of {matchTotal || dbMatches.length} operations
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
  nameCooldownText: string | null;
  countryCooldownText: string | null;
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
    nameCooldownText,
    countryCooldownText,
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
            maxLength={20}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full"
            placeholder="Enter nickname"
          />
          <span className="text-[10px] text-slate-500">
            Max 20 characters. Your VENOM-XXXX tag is permanent and never changes.
          </span>
          {nameCooldownText && (
            <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
              <Timer className="w-3 h-3" /> {nameCooldownText}
            </span>
          )}
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
            Associates your extraction chips to regional champion rankings. 7-day change cooldown applies.
          </span>
          {countryCooldownText && (
            <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
              <Timer className="w-3 h-3" /> {countryCooldownText}
            </span>
          )}
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
            IDENTITY CHANGE COOLDOWN:
          </strong>
          Your Challenger Handle is locked for <strong className="text-amber-400">30 days</strong> after each change. Your Faction Region is locked for <strong className="text-amber-400">7 days</strong>. These cooldowns protect leaderboard and championship integrity. Your VENOM-XXXX tag is always permanent.
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

export default PlayerProfilePanel;
