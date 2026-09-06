'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  UserPlus,
  Swords,
  Ban,
  Crown,
  Sparkles,
  Check,
  ExternalLink,
  Users,
  Loader2,
  Heart,
  Unlock,
  Crosshair,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import {
  countryFlag,
  milestoneTierForChips,
  getCosmeticById,
  MILESTONE_TIERS,
  type InspectedPlayer,
} from '@/lib/game-config';
import { notify, type ToastFn } from './_panel-primitives';

interface PlayerInspectorModalProps {
  player?: InspectedPlayer | null;
  onClose: () => void;
  onToast?: ToastFn;
}

interface PublicProfile {
  avatar?: string | null;
  bankedChips?: number;
  level?: number;
  friendsCount: number;
  followersCount: number;
  followingCount: number;
  rivalsCount: number;
  milestones: Array<{ id: string; tierId: string; chipsAtMilestone: number; createdAt: string }>;
  hofEntries: Array<{
    id: string; inductionType: string; hofBadge: string | null; title: string | null;
    championshipYear: number | null; championshipRank: number | null;
    chipsAtInduction: number; inductedAt: string;
  }>;
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
  lastSeenAt?: string | null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Championship hofBadge ids → pretty labels (fallback when an entry has no title)
const HOF_BADGE_LABELS: Record<string, string> = {
  crown: '👑 Crown',
  silver: '🥈 Silver',
  bronze: '🥉 Bronze',
  contender: '🛡️ Contender',
};

export function PlayerInspectorModal({ player, onClose, onToast }: PlayerInspectorModalProps) {
  const [friendRequested, setFriendRequested] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRival, setIsRival] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [rivalLoading, setRivalLoading] = useState(false);
  const [rivalToFriendLoading, setRivalToFriendLoading] = useState(false);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Reset state when the inspected player changes
  const lastUserTagRef = useRef<string | undefined>(undefined);
  if (player?.userTag !== lastUserTagRef.current) {
    lastUserTagRef.current = player?.userTag;
    if (friendRequested) setFriendRequested(false);
    if (blocked) setBlocked(false);
    if (isFollowing) setIsFollowing(false);
    if (isRival) setIsRival(false);
    setProfile(null);
    setRivalToFriendLoading(false);
    if (player) {
      fetch('/api/friends/list')
        .then((r) => r.json())
        .then((data) => {
          const isBlk = (data.blocked ?? []).some(
            (b: { userTag: string }) => b.userTag === player.userTag,
          );
          if (isBlk) setBlocked(true);
          // Accepted friend OR already-sent pending request → show the
          // disabled "Sent" state instead of letting the player click Friend
          // again and hit "Already friends." / "Request already pending."
          const isFrnd = (data.friends ?? []).some(
            (f: { userTag: string }) => f.userTag === player.userTag,
          );
          const isPendingSent = (data.pendingSent ?? []).some(
            (f: { userTag: string }) => f.userTag === player.userTag,
          );
          if (isFrnd || isPendingSent) setFriendRequested(true);
        })
        .catch(() => { /* ignore */ });
      fetch(`/api/player/follow?tag=${encodeURIComponent(player.userTag)}`)
        .then(r => r.json())
        .then(d => { if (d.following) setIsFollowing(true); })
        .catch(() => {});
      fetch(`/api/rivals?check=${encodeURIComponent(player.userTag)}`)
        .then(r => r.json())
        .then(d => { if (d.isRival) setIsRival(true); })
        .catch(() => {});
    }
  }

  const fetchPublicProfile = useCallback(async (tag: string) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/player/public-profile?tag=${encodeURIComponent(tag)}`);
      if (res.ok) {
        const data: PublicProfile = await res.json();
        setProfile(data);
      }
    } catch { /* silent */ } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (player) fetchPublicProfile(player.userTag);
  }, [player, fetchPublicProfile]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (player) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, onClose]);

  if (!player) return null;

  const p = {
    ...player,
    ...(profile ? {
      // Current live values win over caller-passed snapshots (e.g. opening the
      // inspector from Hall of Fame passes chips-at-induction, not the
      // player's present bank) — the public profile has the real numbers.
      bankedChips: profile.bankedChips ?? player.bankedChips,
      level: profile.level ?? player.level,
      lifetimeKills: profile.lifetimeKills ?? player.lifetimeKills,
      lifetimeDeaths: profile.lifetimeDeaths ?? player.lifetimeDeaths,
      lifetimeExtracts: profile.lifetimeExtracts ?? player.lifetimeExtracts,
      bestStreak: profile.bestStreak ?? player.bestStreak,
      biggestExtract: profile.biggestExtract ?? player.biggestExtract,
      totalEarned: profile.totalEarned ?? player.totalEarned,
      totalLost: profile.totalLost ?? player.totalLost,
      currentSkin: profile.currentSkin ?? player.currentSkin,
      currentTrail: profile.currentTrail ?? player.currentTrail,
      currentDeath: profile.currentDeath ?? player.currentDeath,
      currentFlag: profile.currentFlag ?? player.currentFlag,
      currentBanner: profile.currentBanner ?? player.currentBanner,
    } : {}),
  };

  const flag = p.flag || countryFlag(p.country);
  const clanTag = profile?.clanTag || p.clanTag;
  const clanRank = profile?.clanRank || null;
  const avatarSrc = profile?.avatar || null;

  // MAJOR fix: ranks are shown ONLY when real data was passed in by the
  // caller (or the public profile). The old fallback INVENTED ranks —
  // e.g. a level-45 player with no rank data displayed "#1 in the world".
  const globalRank = p.globalRank ?? null;
  const countryRank = p.countryRank ?? null;
  const regionalRank = p.regionalRank ?? null;

  const friendsCount = profile?.friendsCount ?? null;
  const followersCount = profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const rivalsCount = profile?.rivalsCount ?? 0;

  const socialLinks = [
    { platform: 'Instagram', handle: profile?.instagram, color: '#E4405F', icon: '📸', url: 'https://instagram.com/' },
    { platform: 'YouTube', handle: profile?.youtube, color: '#FF0000', icon: '▶', url: 'https://youtube.com/' },
    { platform: 'Twitch', handle: profile?.twitch, color: '#9146FF', icon: '🎮', url: 'https://twitch.tv/' },
  ];
  const activeSocials = socialLinks.filter(s => s.handle);

  const milestone = milestoneTierForChips(p.bankedChips);
  const allTiers = MILESTONE_TIERS.filter(t => t.id !== 'all');
  const realMilestones = profile?.milestones ?? [];
  const realHofEntries = profile?.hofEntries ?? [];

  const skinItem = p.currentSkin ? getCosmeticById(p.currentSkin) : undefined;
  const trailItem = p.currentTrail ? getCosmeticById(p.currentTrail) : undefined;
  const deathItem = p.currentDeath ? getCosmeticById(p.currentDeath) : undefined;
  const flagItem = p.currentFlag ? getCosmeticById(p.currentFlag) : undefined;
  const bannerItem = p.currentBanner ? getCosmeticById(p.currentBanner) : undefined;

  const highestExtraction = p.biggestExtract ? `${p.biggestExtract.toLocaleString('en-IN')} c` : '\u2014';
  const successRate =
    (p.lifetimeExtracts != null && p.lifetimeDeaths != null && (p.lifetimeExtracts + p.lifetimeDeaths) > 0)
      ? `${((p.lifetimeExtracts / (p.lifetimeExtracts + p.lifetimeDeaths)) * 100).toFixed(1)}%`
      : '\u2014';
  const totalKills = p.lifetimeKills != null ? `${p.lifetimeKills.toLocaleString()} Kills` : '\u2014';

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;
  const lastSeen = profile?.lastSeenAt ? relativeTime(profile.lastSeenAt) : null;

  // Inline loadout items
  const loadoutItems = [
    { label: 'Skin', item: skinItem, fallback: '\uD83D\uDC0D Default' },
    { label: 'Trail', item: trailItem, fallback: '\u2728 None' },
    { label: 'Kill FX', item: deathItem, fallback: '\uD83D\uDCA5 Default' },
    { label: 'Emote', item: flagItem || bannerItem, fallback: '\uD83C\uDFC6 Default' },
  ];

  // Milestone badges (from DB, compact)
  const milestoneChips = realMilestones.length > 0
    ? realMilestones.map(m => {
        const tier = allTiers.find(t => t.id === m.tierId);
        return tier
          ? { name: tier.badge.split(' ')[0], color: tier.color, date: m.createdAt }
          : null;
      }).filter(Boolean) as Array<{ name: string; color: string; date: string }>
    : allTiers.filter(t => p.bankedChips >= t.minChips).map(t => ({
        name: t.badge.split(' ')[0], color: t.color, date: '',
      }));

  function handleAddFriend() {
    if (friendRequested) return;
    fetch('/api/friends/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userTag: p.userTag }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) { setFriendRequested(true); notify(`Friend request sent to ${p.name}!`, 'success', onToast); }
        else notify(data.error || 'Failed to send request.', 'error', onToast);
      })
      .catch(() => notify('Network error.', 'error', onToast));
  }

  async function handleFollowToggle() {
    setFollowLoading(true);
    try {
      const res = await fetch('/api/player/follow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: p.userTag }),
      });
      const data = await res.json();
      if (data.following !== undefined) {
        setIsFollowing(data.following);
        if (profile) setProfile({ ...profile, followersCount: data.followersCount });
      }
    } catch { /* silent */ } finally { setFollowLoading(false); }
  }

  async function handleRivalToggle() {
    setRivalLoading(true);
    try {
      const res = await fetch('/api/rivals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: p.userTag, name: p.name, action: isRival ? 'remove' : 'add' }),
      });
      const data = await res.json();
      if (data.isRival !== undefined) {
        setIsRival(data.isRival);
        if (profile) setProfile({ ...profile, rivalsCount: data.rivalsCount });
        notify(data.isRival ? `${p.name} added as rival!` : `${p.name} removed from rivals.`, data.isRival ? 'error' : 'success', onToast);
      }
    } catch { /* silent */ } finally { setRivalLoading(false); }
  }

  async function handleRivalToFriend() {
    setRivalToFriendLoading(true);
    try {
      const rivalRes = await fetch('/api/rivals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: p.userTag, name: p.name, action: 'remove' }),
      });
      const rivalData = await rivalRes.json();
      if (rivalData.isRival === false) {
        setIsRival(false);
        if (profile) setProfile({ ...profile, rivalsCount: (rivalData.rivalsCount ?? profile.rivalsCount) - 1 });
      }
      if (!friendRequested) {
        const friendRes = await fetch('/api/friends/request', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userTag: p.userTag }),
        });
        const friendData = await friendRes.json();
        if (friendData.ok) { setFriendRequested(true); notify(`${p.name} is now a friend! Rivalry removed.`, 'success', onToast); }
        else notify(`Rivalry removed, but couldn't send friend request: ${friendData.error || 'unknown'}`, 'error', onToast);
      } else { notify(`${p.name} is no longer a rival.`, 'success', onToast); }
    } catch { notify('Network error. Try again.', 'error', onToast); } finally { setRivalToFriendLoading(false); }
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

  // Compact stat cell
  const S = ({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) => (
    <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg px-2 py-1">
      <div className="text-[9px] text-slate-500 font-bold uppercase">{label}</div>
      <div className={`text-[11px] font-mono font-bold ${color}`}>{value}</div>
    </div>
  );

  // Avatar render: actual avatar image or flag fallback
  const avatarEl = avatarSrc ? (
    (avatarSrc.startsWith('data:') || avatarSrc.startsWith('http')) ? (
      <img src={avatarSrc} alt={p.name} className="w-full h-full object-cover rounded-[10px]" />
    ) : (
      <span className="text-xl select-none">{avatarSrc}</span>
    )
  ) : (
    <span className="text-xl select-none">{flag}</span>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="player-inspector-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-950/60">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 font-mono">
            <Sparkles className="w-3 h-3 text-amber-400" /> PLAYER DOSSIER
            {realHofEntries.length > 0 && <Crown className="w-3 h-3 text-yellow-400 ml-1" />}
          </span>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition" aria-label="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-3 py-2 space-y-1.5">
          {/* Identity row: avatar + name + meta + counts */}
          <div className="flex items-start gap-2.5">
            {/* Avatar with flag badge */}
            <div className="w-11 h-11 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-center shrink-0 relative overflow-hidden">
              {avatarEl}
              {avatarSrc && (
                <span className="absolute bottom-0 right-0 text-[10px] leading-none">{flag}</span>
              )}
              <div className="absolute -top-0.5 -right-0.5 bg-amber-600 text-white font-mono text-[8px] font-bold px-1 py-px rounded border border-amber-400">
                L{p.level}
              </div>
            </div>
            {/* Name + meta */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 id="player-inspector-title" className="text-sm font-black text-white tracking-tight truncate">{p.name}</h2>
                {clanTag && (
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-mono font-bold px-1 py-px rounded">
                    [{clanTag}]{clanRank ? ` ${clanRank}` : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                <span className="font-mono text-amber-400">{p.userTag}</span>
                <span>&bull;</span>
                <span className="font-mono font-bold text-emerald-400">{p.bankedChips.toLocaleString('en-IN')}c</span>
                <span>&bull;</span>
                <span style={{ color: milestone.color }}>{milestone.badge}</span>
              </div>
              {/* Rank pills (only when REAL data exists) + social counts — single row */}
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {globalRank != null && (
                <span className="text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-px rounded">
                  🏆 #{globalRank}
                </span>
                )}
                {countryRank != null && (
                <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-px rounded">
                  {flag} #{countryRank}
                </span>
                )}
                {regionalRank != null && (
                <span className="text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-px rounded">
                  🌍 #{regionalRank}
                </span>
                )}
                <span className="text-[9px] text-slate-700 mx-0.5">|</span>
                <span className="text-[9px] font-mono text-slate-400">
                  <Users className="w-2.5 h-2.5 inline text-indigo-400" /> {friendsCount != null ? friendsCount : (profileLoading ? '...' : '\u2014')}
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  <Heart className="w-2.5 h-2.5 inline text-rose-400" /> {followersCount}
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  <Users className="w-2.5 h-2.5 inline text-emerald-400" /> {followingCount}
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  <Swords className="w-2.5 h-2.5 inline text-orange-400" /> {rivalsCount}
                </span>
              </div>
              {/* Timeline: Since + Last Seen */}
              <div className="flex items-center gap-2 text-[9px] text-slate-600 font-mono mt-0.5">
                {memberSince && <span>Since {memberSince}</span>}
                {memberSince && lastSeen && <span>&bull;</span>}
                {lastSeen && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2 h-2" /> {lastSeen}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Body: 2-column grid - Career Stats | Loadout + Milestones + Social */}
          <div className="grid grid-cols-2 gap-2">
            {/* LEFT: Career Stats (no redundant Banked) */}
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Career Stats</div>
              <div className="grid grid-cols-2 gap-1">
                <S label="Highest Ext." value={highestExtraction} color="text-amber-400" />
                <S label="Success Rate" value={successRate} color="text-cyan-400" />
                <S label="Kills" value={totalKills} color="text-rose-400" />
                {p.lifetimeExtracts != null && <S label="Extracts" value={String(p.lifetimeExtracts)} color="text-emerald-400" />}
                {p.bestStreak != null && <S label="Best Streak" value={`${p.bestStreak}W`} color="text-yellow-400" />}
                {p.totalEarned != null && <S label="Total Earned" value={`${(p.totalEarned / 1_000_000).toFixed(1)}M c`} color="text-emerald-300" />}
                {p.totalLost != null && <S label="Total Lost" value={`${(p.totalLost / 1_000_000).toFixed(1)}M c`} color="text-red-400" />}
              </div>
            </div>

            {/* RIGHT: Loadout + Milestones + Social */}
            <div className="space-y-1">
              {/* Inline loadout - single line */}
              <div className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Loadout</div>
              <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg px-2 py-1">
                <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[9px]">
                  {loadoutItems.map((l) => (
                    <span key={l.label} className="inline-flex items-center gap-0.5">
                      <span className="text-slate-600">{l.label}:</span>
                      <span className="font-mono font-bold text-slate-300">
                        {l.item ? `${l.item.emoji || ''} ${l.item.name}` : l.fallback}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Milestones: compact inline chips */}
              {milestoneChips.length > 0 && (
                <>
                  <div className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">
                    Milestones ({milestoneChips.length}/{allTiers.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {milestoneChips.map((m, i) => (
                      <span
                        key={`${m.name}-${i}`}
                        className="text-[9px] font-mono font-bold px-1.5 py-px rounded border"
                        style={{ color: m.color, borderColor: m.color + '40', backgroundColor: m.color + '10' }}
                        title={m.date ? `Achieved ${new Date(m.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* Social links */}
              {activeSocials.length > 0 && (
                <div className="flex gap-1.5">
                  {activeSocials.map((s) => (
                    <a
                      key={s.platform}
                      href={`${s.url}${encodeURIComponent(s.handle!)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-px rounded border border-slate-800 hover:border-slate-600 transition"
                      style={{ color: s.color }}
                    >
                      {s.icon} {s.handle}
                      <ExternalLink className="w-2 h-2" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* HOF entry (if any) */}
          {realHofEntries.length > 0 && (
            <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-2 py-1">
              <div className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider">
                👑 Hall of Fame - {realHofEntries.length} Induction{realHofEntries.length !== 1 ? 's' : ''}
              </div>
              {realHofEntries.slice(0, 2).map((e) => (
                <div key={e.id} className="flex justify-between text-[10px] mt-0.5">
                  <span className="text-yellow-200 font-bold truncate">
                    {/* Championship badges are raw ids ('crown'…); their title is the pretty form. Milestone badges already carry the emoji. */}
                    {e.inductionType === 'championship'
                      ? (e.title || HOF_BADGE_LABELS[e.hofBadge || ''] || 'HOF Inductee')
                      : (e.hofBadge || e.title || 'HOF Inductee')}
                  </span>
                  <span className="text-emerald-400 font-mono shrink-0 ml-2">{e.chipsAtInduction.toLocaleString('en-IN')}c</span>
                </div>
              ))}
              {realHofEntries.length > 2 && (
                <div className="text-[9px] text-yellow-500/80 mt-0.5">+ {realHofEntries.length - 2} more induction{realHofEntries.length - 2 !== 1 ? 's' : ''}</div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons - single row */}
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-950/40">
          {isRival && (
            <button type="button" onClick={handleRivalToFriend} disabled={rivalToFriendLoading}
              className={`w-full mb-1.5 py-1.5 px-2 border rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500/20 to-emerald-500/20 text-white border-orange-500/30 hover:border-emerald-500/40 transition ${rivalToFriendLoading ? 'opacity-50' : ''}`}
            >
              {rivalToFriendLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className="w-3 h-3 text-rose-400" />}
              {rivalToFriendLoading ? 'Processing...' : 'Turn Rival -> Friend'}
            </button>
          )}
          <div className="grid grid-cols-4 gap-1.5">
            <button type="button" onClick={handleFollowToggle} disabled={followLoading}
              className={`py-1.5 px-1 border rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition ${isFollowing ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/30'} ${followLoading ? 'opacity-50' : ''}`}
            >
              {followLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : isFollowing ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
            </button>
            <button type="button" onClick={handleRivalToggle} disabled={rivalLoading}
              className={`py-1.5 px-1 border rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition ${isRival ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500/30'} ${rivalLoading ? 'opacity-50' : ''}`}
            >
              {rivalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
              {rivalLoading ? '...' : isRival ? 'Unrival' : 'Rival'}
            </button>
            <button type="button" onClick={handleAddFriend} disabled={friendRequested}
              className={`py-1.5 px-1 border rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition ${friendRequested ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-default' : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30'}`}
            >
              {friendRequested ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
              {friendRequested ? 'Sent' : 'Friend'}
            </button>
            <button type="button" onClick={handleBlockToggle} disabled={blockLoading}
              className={`py-1.5 px-1 border rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition ${blocked ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/20 text-rose-400 border-rose-500/20'} ${blockLoading ? 'opacity-50' : ''}`}
            >
              {blockLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : blocked ? <Unlock className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
              {blockLoading ? '...' : blocked ? 'Unblock' : 'Block'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
