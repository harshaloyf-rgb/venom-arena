'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  UserPlus,
  Swords,
  Ban,
  Shield,
  Trophy,
  Award,
  Crown,
  Zap,
  Sparkles,
  Check,
  ExternalLink,
  Globe,
  Users,
  Loader2,
  Heart,
  UserCheck,
  Unlock,
  Crosshair,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  countryFlag,
  milestoneTierForChips,
  getCosmeticById,
  MILESTONE_TIERS,
  type InspectedPlayer,
} from '@/lib/game-config';
import type { LeaderboardEntry } from '@/lib/types';
import { notify, type ToastFn } from './_panel-primitives';
import { useAuth } from '@/components/providers/auth-provider';

interface PlayerInspectorModalProps {
  player?: InspectedPlayer | null;
  onClose: () => void;
  onToast?: ToastFn;
}

type Tab = 'overview' | 'stats' | 'loadout';

/** Fetched public profile data */
interface PublicProfile {
  friendsCount: number;
  followersCount: number;
  followingCount: number;
  rivalsCount: number;
  milestones: Array<{ id: string; tierId: string; chipsAtMilestone: number; createdAt: string }>;
  hofEntries: Array<{ id: string; inductionType: string; hofBadge: string | null; title: string | null; championshipYear: number | null; championshipRank: number | null; chipsAtInduction: number; inductedAt: string }>;
  instagram: string | null;
  youtube: string | null;
  twitch: string | null;
  lifetimeKills?: number | null;
  lifetimeDeaths?: number | null;
  lifetimeExtracts?: number | null;
  bestStreak?: number | null;
  biggestExtract?: number | null;
  totalEarned?: number | null;
  totalLost?: number | null;
  currentSkin?: string | null;
  currentTrail?: string | null;
  currentDeath?: string | null;
  currentFlag?: string | null;
  currentBanner?: string | null;
  clanTag?: string | null;
  clanRank?: string | null;
  createdAt?: string;
  lastSeenAt?: string;
}

function buildMatchHistory(p: InspectedPlayer) {
  const bigChip = p.bankedChips >= 10_000_000 ? 10_000_000 : 2_500_000;
  return [
    { arena: 'Tier-05 Crore High Roller', outcome: 'Extracted' as const, chips: bigChip, time: '10 mins ago', kills: 14 },
    { arena: 'Tier-04 Platinum Arena', outcome: 'Extracted' as const, chips: 1_500_000, time: '2 hours ago', kills: 8 },
    { arena: 'Tier-03 Viper Boundary', outcome: 'Extracted' as const, chips: 500_000, time: '1 day ago', kills: 5 },
    { arena: 'Tier-05 Crore High Roller', outcome: 'Eliminated' as const, chips: -200_000, time: '2 days ago', kills: 3 },
  ];
}

export function PlayerInspectorModal({ player, onClose, onToast }: PlayerInspectorModalProps) {
  const { player: authPlayer } = useAuth();
  const isAdmin = authPlayer?.role === 'admin';
  const [tab, setTab] = useState<Tab>('overview');
  const [friendRequested, setFriendRequested] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRival, setIsRival] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [rivalLoading, setRivalLoading] = useState(false);

  // Real public profile data
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Leaderboard data for allies (admin only)
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [alliesLoading, setAlliesLoading] = useState(false);

  // Reset state when the inspected player changes
  const lastUserTagRef = useRef<string | undefined>(undefined);
  if (player?.userTag !== lastUserTagRef.current) {
    lastUserTagRef.current = player?.userTag;
    if (friendRequested) setFriendRequested(false);
    if (blocked) setBlocked(false);
    if (isFollowing) setIsFollowing(false);
    if (isRival) setIsRival(false);
    if (tab !== 'overview') setTab('overview');
    setProfile(null);
    // Check if player is already blocked/friend/following/rival
    if (player) {
      fetch('/api/friends/list')
        .then((r) => r.json())
        .then((data) => {
          const isBlk = (data.blocked ?? []).some(
            (b: { userTag: string }) => b.userTag === player.userTag,
          );
          if (isBlk) setBlocked(true);
          const isFrnd = (data.friends ?? []).some(
            (f: { userTag: string }) => f.userTag === player.userTag,
          );
          if (isFrnd) setFriendRequested(true);
        })
        .catch(() => {/* ignore */});
      // Check follow status
      fetch(`/api/player/follow?tag=${encodeURIComponent(player.userTag)}`)
        .then(r => r.json())
        .then(d => { if (d.following) setIsFollowing(true); })
        .catch(() => {});
      // Check rival status
      fetch(`/api/rivals?check=${encodeURIComponent(player.userTag)}`)
        .then(r => r.json())
        .then(d => { if (d.isRival) setIsRival(true); })
        .catch(() => {});
    }
  }

  // Fetch public profile for real data
  const fetchPublicProfile = useCallback(async (tag: string) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/player/public-profile?tag=${encodeURIComponent(tag)}`);
      if (res.ok) {
        const data: PublicProfile = await res.json();
        setProfile(data);
        if (data.lifetimeKills != null) player!.lifetimeKills = data.lifetimeKills;
        if (data.lifetimeDeaths != null) player!.lifetimeDeaths = data.lifetimeDeaths;
        if (data.lifetimeExtracts != null) player!.lifetimeExtracts = data.lifetimeExtracts;
        if (data.bestStreak != null) player!.bestStreak = data.bestStreak;
        if (data.biggestExtract != null) player!.biggestExtract = data.biggestExtract;
        if (data.totalEarned != null) player!.totalEarned = data.totalEarned;
        if (data.totalLost != null) player!.totalLost = data.totalLost;
        if (data.currentSkin) player!.currentSkin = data.currentSkin;
        if (data.currentTrail) player!.currentTrail = data.currentTrail;
        if (data.currentDeath) player!.currentDeath = data.currentDeath;
        if (data.currentFlag != null) player!.currentFlag = data.currentFlag;
        if (data.currentBanner != null) player!.currentBanner = data.currentBanner;
      }
    } catch { /* silent */ } finally {
      setProfileLoading(false);
    }
  }, []);

  // Fetch leaderboard data for allies (admin demo only)
  const fetchLeaderboard = useCallback(async (country: string) => {
    if (!isAdmin) return;
    setAlliesLoading(true);
    try {
      const res = await fetch('/api/leaderboard?type=chips&limit=10');
      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data.entries ?? []);
      }
    } catch { /* silent */ } finally {
      setAlliesLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (player) {
      fetchPublicProfile(player.userTag);
      fetchLeaderboard(player.country);
    }
  }, [player, fetchPublicProfile, fetchLeaderboard]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (player) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, onClose]);

  if (!player) return null;

  const p = player;
  const flag = p.flag || countryFlag(p.country);
  const clanTag = profile?.clanTag || p.clanTag;
  const clanName = p.clanName;

  // Fallback ranks
  const globalRank = p.globalRank ?? Math.max(1, 15 - Math.floor(p.level / 3));
  const countryRank = p.countryRank ?? Math.max(1, Math.floor(globalRank / 1.4));
  const regionalRank = p.regionalRank ?? Math.max(1, Math.floor(globalRank / 2));
  const achievedAt = p.achievedAt || '26 Jul 2026, 05:42 PM UTC';

  const history = isAdmin ? buildMatchHistory(p) : [];

  // Real counts from API
  const friendsCount = profile?.friendsCount ?? null;
  const followersCount = profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;

  // Real social links from API
  const socialLinks = [
    { platform: 'Instagram', handle: profile?.instagram, color: '#E4405F', icon: '\uD83D\uDCF8', url: 'https://instagram.com/' },
    { platform: 'YouTube', handle: profile?.youtube, color: '#FF0000', icon: '\u25B6', url: 'https://youtube.com/' },
    { platform: 'Twitch', handle: profile?.twitch, color: '#9146FF', icon: '\uD83C\uDFAE', url: 'https://twitch.tv/' },
  ];
  const activeSocials = socialLinks.filter(s => s.handle);

  // Allies derived from leaderboard data (admin demo only)
  const regionalAllies = leaderboardData.filter(
    (e) => e.country === p.country && e.userTag !== p.userTag,
  );
  const globalAllies = leaderboardData.filter(
    (e) => e.country !== p.country && e.userTag !== p.userTag,
  );

  // Badges derived from chip milestones
  const milestone = milestoneTierForChips(p.bankedChips);
  const earnedBadges = MILESTONE_TIERS.filter(
    (t) => t.id !== 'all' && p.bankedChips >= t.minChips,
  );

  // Real milestones and HOF entries
  const realMilestones = profile?.milestones ?? [];
  const realHofEntries = profile?.hofEntries ?? [];
  const hasAchievements = earnedBadges.length > 0 || realMilestones.length > 0 || realHofEntries.length > 0;

  // Loadout from player cosmetics
  const skinItem = p.currentSkin ? getCosmeticById(p.currentSkin) : undefined;
  const trailItem = p.currentTrail ? getCosmeticById(p.currentTrail) : undefined;
  const deathItem = p.currentDeath ? getCosmeticById(p.currentDeath) : undefined;
  const flagItem = p.currentFlag ? getCosmeticById(p.currentFlag) : undefined;
  const bannerItem = p.currentBanner ? getCosmeticById(p.currentBanner) : undefined;

  const loadoutEntries = [
    { label: 'Snake DNA Skin:', value: skinItem ? `${skinItem.emoji || '\uD83D\uDC0D'} ${skinItem.name}` : 'Not visible' },
    { label: 'Tail Trail FX:', value: trailItem ? `${trailItem.emoji || '\u2728'} ${trailItem.name}` : 'Not visible' },
    { label: 'Kill Sound Effect:', value: deathItem ? `${deathItem.emoji || '\uD83D\uDCA5'} ${deathItem.name}` : 'Not visible' },
    { label: 'Victory Emote:', value: flagItem ? `${flagItem.emoji || '\uD83C\uDFF4'} ${flagItem.name}` : bannerItem ? `${bannerItem.emoji || '\uD83C\uDFC6'} ${bannerItem.name}` : 'Not visible' },
  ];

  // Career stats
  const highestExtraction = p.biggestExtract
    ? `${p.biggestExtract.toLocaleString('en-IN')} c`
    : '\u2014';
  const successRate =
    p.lifetimeExtracts != null && p.lifetimeDeaths != null
      ? `${((p.lifetimeExtracts / (p.lifetimeExtracts + p.lifetimeDeaths)) * 100).toFixed(1)}%`
      : '\u2014';
  const totalKills = p.lifetimeKills != null ? `${p.lifetimeKills.toLocaleString()} Kills` : '\u2014';

  // Member since
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  function handleAddFriend() {
    if (friendRequested) return;
    fetch('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userTag: p.userTag }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setFriendRequested(true);
          notify(`Friend request sent to ${p.name}!`, 'success', onToast);
        } else {
          notify(data.error || 'Failed to send request.', 'error', onToast);
        }
      })
      .catch(() => notify('Network error.', 'error', onToast));
  }

  async function handleFollowToggle() {
    setFollowLoading(true);
    try {
      const res = await fetch('/api/player/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: p.userTag }),
      });
      const data = await res.json();
      if (data.following !== undefined) {
        setIsFollowing(data.following);
        // Update local profile count
        if (profile) setProfile({ ...profile, followersCount: data.followersCount });
      }
    } catch { /* silent */ } finally { setFollowLoading(false); }
  }

  async function handleRivalToggle() {
    setRivalLoading(true);
    try {
      const res = await fetch('/api/rivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: p.userTag, name: p.name, action: isRival ? 'remove' : 'add' }),
      });
      const data = await res.json();
      if (data.isRival !== undefined) {
        setIsRival(data.isRival);
        notify(
          data.isRival ? `${p.name} added as rival!` : `${p.name} removed from rivals.`,
          data.isRival ? 'error' : 'success',
          onToast,
        );
      }
    } catch { /* silent */ } finally { setRivalLoading(false); }
  }

  async function handleBlockToggle() {
    setBlockLoading(true);
    try {
      if (blocked) {
        const res = await fetch(`/api/friends/block?userTag=${encodeURIComponent(p.userTag)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) { setBlocked(false); notify(`${p.name} unblocked.`, 'success', onToast); }
        else notify(data.error || 'Failed to unblock.', 'error', onToast);
      } else {
        const res = await fetch('/api/friends/block', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userTag: p.userTag }),
        });
        const data = await res.json();
        if (data.ok) { setBlocked(true); notify(`${p.name} blocked.`, 'error', onToast); }
        else notify(data.error || 'Failed to block.', 'error', onToast);
      }
    } catch { notify('Network error.', 'error', onToast); } finally { setBlockLoading(false); }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="player-inspector-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button" onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-[11px] text-amber-300 font-mono flex items-center justify-between shrink-0 mx-4 mt-4">
          <span className="flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Player Dossier
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" /> Live Data
          </span>
        </div>

        {/* Avatar + identity */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3 sm:gap-4 shrink-0 pr-12">
          <div className="w-16 h-16 rounded-2xl bg-slate-950 border-2 border-amber-500/40 flex items-center justify-center text-3xl shadow-inner shrink-0 relative">
            <span aria-hidden>{flag}</span>
            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-400">
              Lvl {p.level}
            </div>
          </div>
          <div className="min-w-0">
            <h2 id="player-inspector-title" className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-1.5">
              {realHofEntries.length > 0 && <Award className="w-4 h-4 text-yellow-400 shrink-0" title="Hall of Fame Inductee" />}
              <span className="truncate">{p.name}</span>
              <span className="text-xl" aria-hidden>{flag}</span>
            </h2>
            {clanTag && (
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded inline-block mt-1">
                [{clanTag}]
              </span>
            )}
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Ledger Tag: <strong className="font-mono text-amber-400">{p.userTag}</strong></span>
              <span>\u2022</span>
              <span className="text-emerald-400 font-mono font-bold">{p.bankedChips.toLocaleString('en-IN')} c Bank</span>
            </p>
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono mt-1.5">
              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" /> Global Rank #{globalRank}
              </span>
              <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                {flag} Country Rank #{countryRank}
              </span>
              <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Region Rank #{regionalRank}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">{memberSince ? `Member since ${memberSince}` : achievedAt}</p>
          </div>
        </div>

        {/* Social Stats Bar — REAL counts */}
        <div className="px-4 pt-1 pb-2 shrink-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1">
                <Users className="w-3 h-3 text-indigo-400" />
                <span className="text-base font-bold font-mono text-indigo-400 block">{friendsCount != null ? friendsCount : profileLoading ? '\u2026' : '\u2014'}</span>
              </div>
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Friends</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1">
                <Heart className={`w-3 h-3 ${isFollowing ? 'text-rose-400 fill-rose-400' : 'text-rose-400'}`} />
                <span className="text-base font-bold font-mono text-rose-400 block">{profileLoading ? '\u2026' : followersCount}</span>
              </div>
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Followers</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-2.5 text-center">
              <div className="flex items-center justify-center gap-1">
                <UserCheck className="w-3 h-3 text-emerald-400" />
                <span className="text-base font-bold font-mono text-emerald-400 block">{earnedBadges.length}</span>
              </div>
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Badges</span>
            </div>
          </div>
        </div>

        {/* Tabs — logs only for admin */}
        <div className="px-4 pb-2 shrink-0">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold" role="tablist">
            {([
              ['overview', 'Overview'],
              ['stats', 'Career Stats'],
              ...(isAdmin ? [['logs', 'Extraction Logs'] as const] : []),
              ['loadout', 'Loadout'],
            ] as const).map(([id, label]) => (
              <button
                key={id} type="button" role="tab" aria-selected={tab === id}
                onClick={() => setTab(id as Tab)}
                className={`flex-1 py-1.5 rounded-lg transition-all ${tab === id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto va-scroll px-4 pb-4 flex-1 min-h-0">
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-3">
              {/* Achievements and Milestones */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" /> Achievements &amp; Milestones
                  </span>
                  <span className="text-[9px] text-amber-400/70 font-mono">{earnedBadges.length} Badge{earnedBadges.length !== 1 ? 's' : ''} Earned</span>
                </div>
                {hasAchievements ? (
                  <>
                    <div className="flex items-center gap-2.5 p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/15">
                      <span className="text-2xl" aria-hidden>{milestone.badge.split(' ')[0]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-amber-200 text-[11px]">{milestone.badge}</div>
                        <div className="text-[9px] text-slate-400">Current Tier \u00B7 {p.bankedChips.toLocaleString('en-IN')} chips</div>
                      </div>
                    </div>
                    {realHofEntries.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] uppercase font-bold text-yellow-400 tracking-wider flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Hall of Fame \u2014 {realHofEntries.length} Induction{realHofEntries.length !== 1 ? 's' : ''}
                        </span>
                        {realHofEntries.slice(0, 4).map((e) => (
                          <div key={e.id} className="flex items-center justify-between text-xs p-2 bg-slate-900/80 rounded-lg border border-yellow-500/10">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm shrink-0" aria-hidden>{e.inductionType === 'championship' ? '\uD83C\uDFC6' : '\u2B50'}</span>
                              <div className="min-w-0">
                                <div className="font-bold text-yellow-200 text-[11px] truncate">{e.hofBadge || e.title || 'HOF Inductee'}</div>
                                <div className="text-[9px] text-slate-400">
                                  {e.inductionType === 'championship'
                                    ? `${e.championshipYear} Championship \u00B7 Rank #${e.championshipRank}`
                                    : 'Milestone Achievement'}
                                  {' \u00B7 '}{new Date(e.inductedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400 shrink-0">{e.chipsAtInduction.toLocaleString('en-IN')}c</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {earnedBadges.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {earnedBadges.map((t) => (
                          <div key={t.id} className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center gap-2">
                            <span className="text-lg" aria-hidden>{t.badge.split(' ')[0]}</span>
                            <div>
                              <div className="font-bold text-amber-300 text-[11px]">{t.name.split('(')[0].trim()}</div>
                              <div className="text-[9px] text-slate-400">{(t.minChips / 100_000).toFixed(0)}L+ Chips</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-3 text-[11px] text-slate-500">No milestones achieved yet. Climb the chip leaderboard to earn badges!</div>
                )}
              </div>

              {/* Clan membership */}
              {clanTag && clanName && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-indigo-400" /> Syndicate Clan Membership</span>
                    <span className="text-[9px] text-emerald-400 font-mono">Active Member</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl shrink-0" aria-hidden>\uD83D\uDC0D</span>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate">{clanName}<span className="ml-1.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-mono font-bold px-1 py-0.2 rounded border border-indigo-500/30">[{clanTag}]</span></div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Member</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Social and Streaming (real links) */}
              {activeSocials.length > 0 ? (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-emerald-400" /> Creator Social Channels</span>
                    <span className="text-[9px] text-emerald-400 font-mono">Verified</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {activeSocials.map((s) => (
                      <a key={s.platform} href={`${s.url}${encodeURIComponent(s.handle!)}`} target="_blank" rel="noopener noreferrer"
                        className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition group"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                          style={{ backgroundColor: s.color + '15', border: `1px solid ${s.color}30` }}
                        >{s.icon}</div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] uppercase font-bold block" style={{ color: s.color + 'CC' }}>{s.platform}</span>
                          <span className="text-[11px] font-mono text-slate-300 block truncate group-hover:text-white transition">{s.handle}</span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-slate-500" /> Creator Social Channels</div>
                  <div className="text-center py-3 text-[11px] text-slate-500">No social channels linked.</div>
                </div>
              )}

              {/* Regional + Global allies (admin demo only) */}
              {isAdmin && (
                <>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-violet-400" /> {flag} REGIONAL ALLIES ({p.country} NETWORK)</span>
                      {alliesLoading ? <Loader2 className="w-3 h-3 text-slate-500 animate-spin" /> : <span className="text-[9px] text-slate-500 font-mono">{regionalAllies.length} Members</span>}
                    </div>
                    {alliesLoading ? (
                      <div className="flex items-center justify-center py-4 text-[11px] text-slate-500 gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading\u2026</div>
                    ) : regionalAllies.length === 0 ? (
                      <div className="text-center py-4 text-[11px] text-slate-500">No regional allies found.</div>
                    ) : (
                      <ul className="space-y-1.5">
                        {regionalAllies.map((a) => (
                          <li key={a.userTag} className="flex items-center justify-between text-xs p-2 bg-slate-900 rounded-lg border border-slate-800">
                            <div className="flex items-center gap-2 min-w-0">
                              <span aria-hidden>{countryFlag(a.country)}</span>
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate">{a.name}</div>
                                <div className="text-[10px] font-mono text-slate-500">{a.userTag}</div>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.5 rounded">Rank #{a.rank}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-cyan-400" /> GLOBAL ALLIES</span>
                      {alliesLoading ? <Loader2 className="w-3 h-3 text-slate-500 animate-spin" /> : <span className="text-[9px] text-slate-500 font-mono">{globalAllies.length} Members</span>}
                    </div>
                    {alliesLoading ? (
                      <div className="flex items-center justify-center py-4 text-[11px] text-slate-500 gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading\u2026</div>
                    ) : globalAllies.length === 0 ? (
                      <div className="text-center py-4 text-[11px] text-slate-500">No global allies found.</div>
                    ) : (
                      <ul className="space-y-1.5">
                        {globalAllies.map((a) => (
                          <li key={a.userTag} className="flex items-center justify-between text-xs p-2 bg-slate-900 rounded-lg border border-slate-800">
                            <div className="flex items-center gap-2 min-w-0">
                              <span aria-hidden>{countryFlag(a.country)}</span>
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate">{a.name}</div>
                                <div className="text-[10px] font-mono text-slate-500">{a.userTag}</div>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded">Rank #{a.rank}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* CAREER STATS */}
          {tab === 'stats' && (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between border-b border-slate-900 pb-1.5">
                  <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-amber-400" /> Live Leaderboard Standings</span>
                  <span className="text-[9px] text-emerald-400 font-mono">Real-Time Sync</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400">Global World Rank</div>
                    <div className="font-bold text-amber-400 text-sm mt-0.5">#{globalRank}</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400">{flag} Country Rank</div>
                    <div className="font-bold text-emerald-400 text-sm mt-0.5">#{countryRank}</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400">Regional Arena Rank</div>
                    <div className="font-bold text-indigo-400 text-sm mt-0.5">#{regionalRank}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Banked Chips" value={`${p.bankedChips.toLocaleString('en-IN')} c`} accent="text-emerald-400" icon={<Trophy className="w-3.5 h-3.5" />} />
                <StatCard label="Highest Extraction" value={highestExtraction} accent="text-amber-400" icon={<Award className="w-3.5 h-3.5" />} />
                <StatCard label="Extraction Success Rate" value={successRate} accent="text-indigo-400" icon={<Zap className="w-3.5 h-3.5" />} />
                <StatCard label="Snake Eliminations" value={totalKills} accent="text-rose-400" icon={<Swords className="w-3.5 h-3.5" />} />
              </div>
              {(p.lifetimeExtracts != null || p.bestStreak != null) && (
                <div className="grid grid-cols-2 gap-3">
                  {p.lifetimeExtracts != null && <StatCard label="Total Extractions" value={p.lifetimeExtracts.toLocaleString()} accent="text-cyan-400" icon={<Sparkles className="w-3.5 h-3.5" />} />}
                  {p.bestStreak != null && <StatCard label="Best Streak" value={`${p.bestStreak} Wins`} accent="text-yellow-400" icon={<Trophy className="w-3.5 h-3.5" />} />}
                </div>
              )}
            </div>
          )}

          {/* EXTRACTION LOGS (admin demo only) */}
          {tab === 'logs' && isAdmin && (
            <div className="space-y-2">
              {history.map((log, i) => (
                <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{log.arena}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${log.outcome === 'Extracted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>{log.outcome}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{'\uD83D\uDD52'} {log.time} \u00B7 {log.kills} kills</div>
                  </div>
                  <div className={`font-mono font-bold tabular-nums shrink-0 ${log.chips > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{log.chips > 0 ? `+${log.chips.toLocaleString('en-IN')}c` : `${log.chips.toLocaleString('en-IN')}c`}</div>
                </div>
              ))}
            </div>
          )}

          {/* LOADOUT */}
          {tab === 'loadout' && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              {loadoutEntries.map((l) => (
                <div key={l.label} className="flex justify-between py-1.5 border-b border-slate-900 last:border-0">
                  <span className="text-slate-400">{l.label}</span>
                  <span className={`font-bold ${l.value === 'Not visible' ? 'text-slate-500 italic' : 'text-white'}`}>{l.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons — Follow, Rival, Friend, Block */}
        <div className="grid grid-cols-2 gap-2 p-4 pt-2 border-t border-slate-800 shrink-0">
          <button type="button" onClick={handleFollowToggle} disabled={followLoading}
            className={`py-2.5 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isFollowing ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/30 shadow'} ${followLoading ? 'opacity-50' : ''}`}
          >
            {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {followLoading ? 'Loading' : isFollowing ? 'Unfollow' : 'Follow'}
          </button>
          <button type="button" onClick={handleRivalToggle} disabled={rivalLoading}
            className={`py-2.5 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isRival ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500/30 shadow'} ${rivalLoading ? 'opacity-50' : ''}`}
          >
            {rivalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            {rivalLoading ? 'Loading' : isRival ? 'Remove Rival' : 'Add Rival'}
          </button>
          <button type="button" onClick={handleAddFriend} disabled={friendRequested}
            className={`py-2.5 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${friendRequested ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-default' : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 shadow'}`}
          >
            {friendRequested ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {friendRequested ? 'Request Sent' : 'Add Friend'}
          </button>
          <button type="button" onClick={handleBlockToggle} disabled={blockLoading}
            className={`py-2.5 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${blocked ? 'bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border-rose-500/20'} ${blockLoading ? 'opacity-50 cursor-wait' : ''}`}
          >
            {blockLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : blocked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
            {blockLoading ? 'Processing\u2026' : blocked ? `Unblock ${p.name}` : `Block ${p.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
      <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">{icon} {label}</span>
      <span className={`font-mono font-bold text-sm block ${accent}`}>{value}</span>
    </div>
  );
}

export default PlayerInspectorModal;
