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
  Edit2,
  Filter,
  Gamepad2,
  History,
  Landmark,
  Link as LinkIcon,
  LogOut,
  MailWarning,
  RefreshCw,
  Shield,
  Skull,
  Sparkles,
  Target,
  Timer,
  Trophy,
  UserCircle,
  Users,
  UserPlus,
  UserMinus,
  Swords,
  Share2,
  X,
  Download,
  Gift,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { COUNTRIES, getCosmeticById, MILESTONE_TIERS, milestoneTierForChips, REFERRAL_REWARD, REFERRAL_MATCH_THRESHOLD } from '@/lib/game-config';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { renderProfileCard, renderMilestoneCard, downloadBlob, shareBlob, copyBlobToClipboard, type MilestoneCardData } from '@/lib/share-card';
import { GameSnakePreview } from './cosmetics/game-snake-preview';

// Sub-components
import { StatCard, CapCard } from './player-profile/stat-card';
import { TournamentGuardrailsSection, type TournamentStats } from './player-profile/tournament-guardrails';
import { DeleteAccountSection } from './player-profile/delete-account';
import { IdentityEditor } from './player-profile/identity-editor';
import { SecuritySettingsCard } from './player-profile/security';
import { GuestUpgradeBanner } from './player-profile/guest-upgrade';

interface PlayerProfilePanelProps {
  onToast?: ToastFn;
}

// ---------------------------------------------------------------------------
// FACTION_COUNTRIES
// ---------------------------------------------------------------------------
const FACTION_COUNTRIES = COUNTRIES;

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

// ---------------------------------------------------------------------------
// Email Verification Banner
// ---------------------------------------------------------------------------
function EmailVerificationBanner({ onRefresh, onToast }: { onRefresh: () => void; onToast?: ToastFn }) {
  const [step, setStep] = useState<'idle' | 'sent' | 'verifying' | 'verified' | 'error'>('idle');
  const [devToken, setDevToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const handleSend = useCallback(async () => {
    setErrMsg('');
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error || 'Failed to send.');
        return;
      }
      // In sandbox, API returns the token directly for dev testing
      if (data.token) setDevToken(data.token);
      setStep('sent');
      if (onToast) onToast('Verification token sent!', 'success');
    } catch {
      setErrMsg('Network error.');
    }
  }, [onToast]);

  const handleVerify = useCallback(async () => {
    const t = tokenInput.trim();
    if (!t) return;
    setErrMsg('');
    setStep('verifying');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error || 'Verification failed.');
        setStep('sent');
        return;
      }
      setStep('verified');
      if (onToast) onToast('Email verified!', 'success');
      onRefresh();
    } catch {
      setErrMsg('Network error.');
      setStep('sent');
    }
  }, [tokenInput, onToast, onRefresh]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(devToken);
    if (onToast) onToast('Token copied!', 'success');
  }, [devToken, onToast]);

  if (step === 'verified') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 lg:py-1.5 flex items-center gap-2">
        <Check className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-emerald-400 shrink-0" />
        <span className="text-[11px] lg:text-[11px] text-emerald-300 font-medium">Email verified — full account features unlocked.</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 lg:py-1.5 space-y-2">
      <div className="flex items-center gap-2">
        <MailWarning className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-amber-400 shrink-0" />
        <span className="text-[11px] lg:text-[11px] text-amber-300 font-medium">
          Email not verified. Verify now to unlock full account features.
        </span>
      </div>

      {step === 'idle' && (
        <button
          onClick={handleSend}
          className="ml-6 text-[11px] lg:text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 transition"
        >
          Send Verification
        </button>
      )}

      {step === 'sent' && (
        <div className="ml-6 space-y-1.5">
          <p className="text-[11px] text-slate-400">Check your email! (or paste the token below for dev testing)</p>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste token here…"
              className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono"
            />
            <button
              onClick={handleVerify}
              disabled={step === 'verifying'}
              className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-md px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition disabled:opacity-50"
            >
              {step === 'verifying' ? '…' : 'Verify'}
            </button>
          </div>
          {/* Dev helper — show token in non-production */}
          {devToken && process.env.NODE_ENV !== 'production' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-600 font-mono">dev token:</span>
              <button
                onClick={handleCopy}
                className="text-[10px] text-slate-500 hover:text-slate-300 font-mono bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 transition cursor-pointer"
                title="Click to copy"
              >
                {devToken}
              </button>
            </div>
          )}
        </div>
      )}

      {errMsg && <p className="ml-6 text-[11px] text-red-400">{errMsg}</p>}
    </div>
  );
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

  // -- Avatar lightbox & character loadout modal
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [showSkinDemoModal, setShowSkinDemoModal] = useState(false);

  // -- Social counts
  const [socialCounts, setSocialCounts] = useState({ friendsCount: 0, followersCount: 0, followingCount: 0, rivalsCount: 0 });
  const [socialLoading, setSocialLoading] = useState(true);

  // -- Referral data
  const [referralData, setReferralData] = useState<{
    referralCode: string;
    hasReferrer: boolean;
    referrerName: string | null;
    referrerCode: string | null;
    referrals: Array<{ id: string; referredName: string; status: string; matchesPlayed: number; createdAt: string }>;
  } | null>(null);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralExpanded, setReferralExpanded] = useState(false);

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
    mountedRef.current = true;
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

  // -- Fetch social counts
  const fetchSocialCounts = useCallback(async () => {
    setSocialLoading(true);
    try {
      const res = await fetch('/api/player/social-counts');
      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) setSocialCounts(data);
      }
    } catch {
      // silently ignore
    } finally {
      if (mountedRef.current) setSocialLoading(false);
    }
  }, []);

  // -- Fetch referral data
  const fetchReferralData = useCallback(async () => {
    setReferralLoading(true);
    try {
      const res = await fetch('/api/player/referral');
      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) setReferralData(data);
      }
    } catch {
      // silently ignore
    } finally {
      if (mountedRef.current) setReferralLoading(false);
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
    // Fetch social counts (registered only)
    if (player.email) {
      fetchSocialCounts();
      fetchReferralData();
    }
  }, [player.name, player.country, player.instagram, player.youtube, player.twitch, player.email, fetchTournamentStats, fetchMilestones, fetchSocialCounts, fetchReferralData]);

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
    if (isEditing) {
      setIsEditing(false);
      return;
    }
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
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-2 bg-slate-950/60 border border-slate-900 rounded-2xl shadow-xl relative backdrop-blur-md">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-2 border-b border-slate-900 pb-4 mb-4 lg:pb-2 lg:mb-2">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className="w-16 h-16 lg:w-9 lg:h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-indigo-400/30 relative shadow-md overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-400/50 transition"
            onClick={() => setShowAvatarLightbox(true)}
            title="Click to view profile picture"
          >
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
                <span className="text-3xl lg:text-base select-none">{player.avatar}</span>
              )
            ) : (
              <span
                className="text-3xl lg:text-base select-none"
                title="Equipped DNA Skin"
              >
                {activeSkin?.emoji || '🐍'}
              </span>
            )}
            <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold text-indigo-400 shadow">
              Lvl {player.level}
            </div>
          </div>

          {/* Name + tag + socials */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl lg:text-[13px] font-bold text-white font-sans tracking-tight flex items-center gap-2">
                <span>{player.name}</span>
                {player.clanTag && (
                  <span className="text-[11px] text-indigo-300 font-mono">
                    clan - {player.clanTag}{player.clanRank ? ` (${player.clanRank})` : ''}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  country - {(player.country || 'US').toUpperCase()}
                </span>
              </h2>
              {/* Hide Edit Identity for guest accounts */}
              {player.email && (
              <button
                type="button"
                onClick={handleStartEditing}
                className="text-slate-400 hover:text-white p-1 transition cursor-pointer"
                title="Edit Identity"
                aria-label="Edit identity"
              >
                <Edit2 className="w-4 h-4 lg:w-3 lg:h-3" />
              </button>
              )}
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
                  {globalRank ? `Rank ${globalRank.replace('#', '')}` : '…'}
                </span>
              </span>
            </p>

            {/* Referral code — registered only */}
            {player.email && player.referralCode && (
              <div className="flex items-center gap-1.5 mt-1.5 ">
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
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-sans ">
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
            <div className="flex flex-wrap items-center gap-2 mt-2 ">
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
          <div className="w-full md:w-72 lg:w-52 bg-slate-900/60 p-3 lg:p-1.5 rounded-xl border border-slate-800 backdrop-blur-sm flex-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-sans mb-1.5 lg:mb-0.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />{' '}
                Level Progress
              </span>
              <span className="font-mono text-white font-bold">
                {player.xp} / {xpNeeded} XP
              </span>
            </div>
            <div className="w-full h-2.5 lg:h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
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
                className="px-4 py-3 lg:px-2.5 lg:py-1 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow h-[52px] lg:h-8 disabled:opacity-50"
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

      {/* Generate Profile Card Button */}
      <button
        type="button"
        onClick={handleGenerateProfileCard}
        disabled={profileCardLoading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 lg:hidden text-xs font-bold text-violet-300 hover:bg-violet-500/20 transition disabled:opacity-50 cursor-pointer"
      >
        <UserCircle className="w-4 h-4" />
        {profileCardLoading ? 'Generating Profile Card…' : '🪪 Generate Profile Card'}
      </button>

      {/* TAB NAV */}
      <div className="flex flex-wrap gap-2 mb-4 lg:mb-2 border-b border-slate-900 pb-3 lg:pb-1">
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
              className={`px-4 lg:px-2.5 py-2 lg:py-1 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
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
        <div className="space-y-6 lg:space-y-1.5">
          {/* Guest Upgrade Banner */}
          {!player.email && <GuestUpgradeBanner onRefresh={onRefresh} onToast={onToast} />}

          {/* Email Verification Banner — registered users with unverified email */}
          {player.email && !player.emailVerified && (
            <EmailVerificationBanner onRefresh={onRefresh} onToast={onToast} />
          )}

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

          {/* Compact Profile Pic + Equipped Skin — registered only */}
          {player.email && (
          <div className="flex items-center gap-3 lg:gap-2">
            {/* Small profile picture — click to enlarge */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-12 h-12 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-indigo-400/30 shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-400/50 transition overflow-hidden"
                onClick={() => setShowAvatarLightbox(true)}
                title="Click to enlarge profile picture"
              >
                {player.avatar ? (
                  player.avatar.startsWith('data:') || player.avatar.startsWith('http') ? (
                    <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xl lg:text-lg select-none">{player.avatar}</span>
                  )
                ) : (
                  <span className="text-xl lg:text-lg select-none">{activeSkin?.emoji || '🐍'}</span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Profile Pic</span>
            </div>
            {/* Equipped snake skin — click for live demo */}
            <div
              className="flex-1 flex items-center gap-2 bg-slate-950/50 border border-slate-900 hover:border-slate-800 rounded-xl px-3 py-2 lg:py-1.5 cursor-pointer transition group"
              onClick={() => setShowSkinDemoModal(true)}
              title="Click to see live snake demo"
            >
              <div className="w-8 h-8 lg:w-7 lg:h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (activeSkin?.color || '#22c55e') + '20' }}>
                <span className="text-base lg:text-sm">{activeSkin?.emoji || '🐍'}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Equipped Skin:</span>
                  <span className="text-[11px] font-bold text-slate-200 group-hover:text-white transition truncate">{activeSkin?.name || 'Default Viper'}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-3 h-3 rounded-full border border-slate-700" style={{ backgroundColor: activeSkin?.color || '#22c55e' }} />
                  <span className="text-[11px] text-slate-500 font-mono">{activeSkin?.pattern || 'solid'}</span>
                  <span className="text-[11px] text-slate-600">•</span>
                  <span className="text-[11px] text-slate-500">Trail: {activeTrail?.name || 'None'}</span>
                </div>
              </div>
              <span className="text-[11px] text-indigo-400 ml-auto shrink-0 hidden sm:inline">Live Demo →</span>
            </div>
          </div>
          )}

          {/* Statistics grid — 10 stat cards + 4 social cards for registered */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-1.5">
            <StatCard
              label="Banked Wallet"
              subLabel="Deposited Chips"
              value={player.bankedChips.toLocaleString() + ' c'}
              icon={<Landmark className="w-4 h-4 lg:w-3 lg:h-3 text-emerald-400" />}
              valueClass="text-emerald-400"
            />
            <StatCard
              label="Total Kills"
              subLabel="All Snake Eliminations"
              value={String(player.lifetimeKills)}
              icon={<Skull className="w-4 h-4 lg:w-3 lg:h-3 text-rose-400" />}
              valueClass="text-white"
            />
            <StatCard
              label="K/D Ratio"
              subLabel="Kill / Death Index"
              value={kdRatio}
              icon={<Target className="w-4 h-4 lg:w-3 lg:h-3 text-amber-400" />}
              valueClass="text-amber-400"
            />
            <StatCard
              label="Extraction Rate"
              subLabel="Successful Handshakes"
              value={extractRate}
              icon={<Compass className="w-4 h-4 lg:w-3 lg:h-3 text-cyan-400" />}
              valueClass="text-cyan-400"
            />
            <StatCard
              label="Survival Streak"
              subLabel="Consecutive Extractions"
              value={String(player.bestStreak)}
              icon={<Trophy className="w-4 h-4 lg:w-3 lg:h-3 text-yellow-500" />}
              valueClass="text-yellow-500"
            />
            <StatCard
              label="Record Extraction"
              subLabel="Max Retained in One Run"
              value={player.biggestExtract.toLocaleString()}
              icon={<Award className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" />}
              valueClass="text-indigo-400"
            />
            <StatCard
              label="Lifetime Retained"
              subLabel="Cumulative Chip Profit"
              value={player.totalEarned.toLocaleString()}
              icon={<Landmark className="w-4 h-4 lg:w-3 lg:h-3 text-teal-400" />}
              valueClass="text-teal-400"
            />
            <StatCard
              label="Total Forfeited"
              subLabel="Forfeited in Crash Events"
              value={player.totalLost.toLocaleString()}
              icon={<RefreshCw className="w-4 h-4 lg:w-3 lg:h-3 text-red-400" />}
              valueClass="text-red-400"
            />
            <StatCard
              label="Total Matches"
              subLabel="All Arena Runs"
              value={String(totalRuns)}
              icon={<Gamepad2 className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" />}
              valueClass="text-indigo-300"
            />
            <StatCard
              label="Account Age"
              subLabel="Days Since Join"
              value={String(accountAgeDays)}
              icon={<Calendar className="w-4 h-4 lg:w-3 lg:h-3 text-emerald-400" />}
              valueClass="text-emerald-300"
            />
            {/* Social stat cards — registered only */}
            {player.email && (
              <>
                <StatCard
                  label="Friends"
                  subLabel="Accepted Allies"
                  value={socialLoading ? '…' : String(socialCounts.friendsCount)}
                  icon={<Users className="w-4 h-4 lg:w-3 lg:h-3 text-blue-400" />}
                  valueClass="text-blue-400"
                />
                <StatCard
                  label="Followers"
                  subLabel="Tracking You"
                  value={socialLoading ? '…' : String(socialCounts.followersCount)}
                  icon={<UserPlus className="w-4 h-4 lg:w-3 lg:h-3 text-violet-400" />}
                  valueClass="text-violet-400"
                />
                <StatCard
                  label="Following"
                  subLabel="You Track"
                  value={socialLoading ? '…' : String(socialCounts.followingCount)}
                  icon={<UserMinus className="w-4 h-4 lg:w-3 lg:h-3 text-cyan-400" />}
                  valueClass="text-cyan-400"
                />
                <StatCard
                  label="Rivals"
                  subLabel="Nemesis List"
                  value={socialLoading ? '…' : String(socialCounts.rivalsCount)}
                  icon={<Swords className="w-4 h-4 lg:w-3 lg:h-3 text-rose-400" />}
                  valueClass="text-rose-400"
                />
              </>
            )}
          </div>

          {/* Referral Section — registered only — ABOVE milestones */}
          {player.email && (
          <div className="rounded-xl border border-slate-900 bg-slate-950/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setReferralExpanded(!referralExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 lg:px-2.5 lg:py-1.5 cursor-pointer hover:bg-slate-900/30 transition"
            >
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-emerald-400" />
                <h3 className="text-sm lg:text-[11px] font-bold uppercase tracking-wider text-slate-300">Referral Program</h3>
                {!referralLoading && referralData && (
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    +{REFERRAL_REWARD.toLocaleString()}c each
                  </span>
                )}
              </div>
              {referralExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {referralExpanded && (
              <div className="px-4 pb-4 lg:px-2.5 lg:pb-2.5 space-y-3 lg:space-y-1.5 border-t border-slate-900 pt-3 lg:pt-1.5">
                {referralLoading ? (
                  <PanelSkeleton count={1} height="h-24" />
                ) : referralData ? (
                  <>
                    {/* How it works */}
                    <div className="rounded-lg bg-slate-950/60 border border-slate-900/60 p-3 lg:p-2">
                      <h4 className="text-[11px] font-bold text-white mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400" /> How Referrals Work
                      </h4>
                      <ul className="text-[11px] text-slate-400 space-y-1 leading-relaxed">
                        <li className="flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5 shrink-0">1.</span>
                          <span>Share your referral code with friends. They enter it when they join.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5 shrink-0">2.</span>
                          <span>Your referred friend must play <strong className="text-amber-400">{REFERRAL_MATCH_THRESHOLD} matches</strong> to activate the reward.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5 shrink-0">3.</span>
                          <span>Once activated, <strong className="text-emerald-400">both of you earn {REFERRAL_REWARD.toLocaleString()} chips</strong> automatically!</span>
                        </li>
                      </ul>
                    </div>

                    {/* Referral code + copy */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-sans">Your Code:</span>
                      <span className="font-mono text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        {referralData.referralCode}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(referralData.referralCode, setCopiedReferral)}
                            className="text-slate-500 hover:text-emerald-400 transition cursor-pointer"
                            aria-label="Copy referral code"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700 text-xs">
                          {copiedReferral ? 'Copied!' : 'Copy code'}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Referred by */}
                    {referralData.hasReferrer && referralData.referrerName && (
                      <div className="text-[11px] text-slate-500">
                        Referred by <strong className="text-slate-300">{referralData.referrerName}</strong> ({referralData.referrerCode})
                      </div>
                    )}

                    {/* Referral history */}
                    {referralData.referrals.length > 0 ? (
                      <div className="space-y-1.5">
                        <h4 className="text-[11px] font-bold text-slate-300 uppercase">Referral History ({referralData.referrals.length})</h4>
                        <div className="max-h-32 overflow-y-auto va-scroll space-y-1">
                          {referralData.referrals.map((r) => (
                            <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-950/40 border border-slate-900/40 px-3 py-1.5 lg:px-2 lg:py-1">
                              <div className="min-w-0">
                                <span className="text-[11px] font-bold text-slate-200 block truncate">{r.referredName}</span>
                                <span className="text-[11px] text-slate-600 font-mono">{r.matchesPlayed}/{REFERRAL_MATCH_THRESHOLD} matches</span>
                              </div>
                              <Badge className={`text-[11px] font-mono font-bold border shrink-0 ml-2 ${
                                r.status === 'claimed'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : r.status === 'active'
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}>
                                {r.status === 'claimed' ? 'Claimed' : r.status === 'active' ? 'Active' : 'Pending'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-600 text-center py-2">No referrals yet. Share your code to start earning!</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 text-center py-2">Could not load referral data.</p>
                )}
              </div>
            )}
          </div>
          )}

          {/* Milestones Section — chip tier progression */}
          <div className="space-y-3 lg:space-y-1">
            <h3 className="text-sm lg:text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Award className="w-4 h-4 lg:w-3 lg:h-3 text-amber-400" /> Chip Milestones
            </h3>
            {milestonesLoading ? (
              <PanelSkeleton count={2} height="h-16" />
            ) : milestones.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-4 lg:p-2 text-center">
                <Trophy className="w-6 h-6 lg:w-4 lg:h-4 text-slate-600 mx-auto mb-1" />
                <p className="text-xs lg:text-[11px] text-slate-400">No chip milestones achieved yet.</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Banked: {player.bankedChips.toLocaleString()}c — Next milestone: Bronze at 100,000c. Keep extracting!
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
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 lg:px-2 lg:py-1.5"
                    >
                      <div className="flex items-center gap-3 lg:gap-1.5">
                        <span className="text-2xl lg:text-base" title={tier.name}>{tier.badge.split(' ')[0]}</span>
                        <div className="lg:leading-tight">
                          <div className="text-xs lg:text-[11px] font-bold text-white">{tier.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {ms.chipsAtMilestone.toLocaleString('en-IN')} chips • {new Date(ms.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGenerateMilestoneCard(ms)}
                        disabled={milestoneCardLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 lg:px-2 py-1.5 lg:py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Share2 className="w-3 h-3 lg:w-2.5 lg:h-2.5" />
                        Share
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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

          {/* Identity Change Policy Banner — hidden on desktop (info is in identity editor) */}
          <div className="p-4 lg:p-2.5 rounded-xl border border-slate-900 bg-slate-900/10 flex items-center gap-4 lg:gap-2 ">
            <Shield className="w-8 h-8 lg:w-5 lg:h-5 text-indigo-500 shrink-0" />
            <div className="text-xs lg:text-[11px] leading-relaxed text-slate-400">
              <span className="font-bold text-slate-200 uppercase block mb-0.5">
                IDENTITY LOCK POLICY
              </span>
              Your <strong className="text-slate-200">Challenger Handle</strong> can only be changed once every <strong className="text-amber-400">30 days</strong> and your <strong className="text-slate-200">Faction Region</strong> once every <strong className="text-amber-400">7 days</strong>. This protects leaderboard integrity and prevents identity confusion. Your permanent Ledger Tag never changes.
            </div>
          </div>

        </div>
      )}

      {/* TAB: HISTORY — DB-backed with filters and mobile-responsive */}
      {activeTab === 'history' && (
        <div className="space-y-4 lg:space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 lg:gap-2 border-b border-slate-900 pb-3 lg:pb-1.5">
            <h3 className="text-sm lg:text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <History className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" /> Match Run Records
              Ledger
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Showing {dbMatches.length} of {matchTotal || dbMatches.length} operations
            </span>
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-2 lg:gap-1">
            <Filter className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-500" />
            {(['all', 'EXTRACTED', 'COLLIDED'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setMatchFilter(f)}
                className={`px-3 lg:px-2 py-1.5 lg:py-1 rounded-lg text-[11px] font-bold font-sans transition cursor-pointer border ${
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
            <div className="text-center py-6 lg:py-3 border border-dashed border-slate-900 rounded-2xl">
              <History className="w-6 h-6 lg:w-4 lg:h-4 text-slate-600 mx-auto mb-1" />
              <p className="text-xs lg:text-[11px] text-slate-400">
                No match records found in the ledger.
              </p>
              <p className="text-[11px] lg:text-[11px] text-slate-600 mt-0.5">
                Play arena matches to log your extraction data here. Future matches will appear automatically.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table (md+) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
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
                            className={`text-[11px] font-mono font-bold border ${
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
                          className={`text-[11px] font-mono px-1 rounded ${
                            match.isOnline
                              ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {match.isOnline ? 'ONLINE' : 'PRACTICE'}
                        </span>
                      </div>
                      <Badge
                        className={`text-[11px] font-mono font-bold border ${
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
                        <span className="text-slate-500 block text-[11px] font-mono uppercase">Chips</span>
                        <span className={`font-mono font-bold ${match.status === 'EXTRACTED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {match.status === 'EXTRACTED'
                            ? `+${match.chipsEarned.toLocaleString()}`
                            : `-${match.chipsLost.toLocaleString()}`} c
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px] font-mono uppercase">Kills</span>
                        <span className="font-mono font-semibold text-slate-300">{match.kills}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px] font-mono uppercase">Duration</span>
                        <span className="font-mono text-slate-400">{match.durationSec}s</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
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
      {/* AVATAR LIGHTBOX — compact, top-aligned, no scroll needed */}
      {showAvatarLightbox && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-slate-950/90 backdrop-blur-sm" onClick={() => setShowAvatarLightbox(false)}>
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-3 text-center" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowAvatarLightbox(false)} className="absolute -top-2.5 -right-2.5 p-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer z-10">
              <X className="h-4 w-4" />
            </button>
            <div className="w-28 h-28 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-2 border-indigo-400/30 shadow-lg overflow-hidden">
              {player.avatar ? (
                player.avatar.startsWith('data:') || player.avatar.startsWith('http') ? (
                  <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-5xl select-none">{player.avatar}</span>
                )
              ) : (
                <span className="text-5xl select-none">{activeSkin?.emoji || '🐍'}</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 font-sans">{player.name} · Lvl {player.level} · #{player.userTag}</p>
          </div>
        </div>
      )}

      {/* LIVE SNAKE SKIN DEMO MODAL — compact, top-aligned, no scroll needed */}
      {showSkinDemoModal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-slate-950/90 backdrop-blur-sm" onClick={() => setShowSkinDemoModal(false)}>
          <div className="relative w-full max-w-md mx-4 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-3" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowSkinDemoModal(false)} className="absolute -top-2.5 -right-2.5 p-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer z-10">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-indigo-400" /> {activeSkin?.name || 'Default Viper'} — Live Demo
            </h3>
            <p className="text-[11px] text-slate-500 mb-2">Trail: {activeTrail?.name || 'None'}</p>

            {/* Canvas-based live snake animation */}
            <div className="relative w-full rounded-xl bg-slate-950/60 border border-slate-800 overflow-hidden">
              <GameSnakePreview
                skinId={player.currentSkin}
                width={480}
                height={150}
                segments={28}
                speed={1.2}
              />
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-950/80 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-mono text-slate-400">LIVE</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}

export default PlayerProfilePanel;
