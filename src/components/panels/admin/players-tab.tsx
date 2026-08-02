'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Ban,
  ShieldBan,
  Coins,
  Loader2,
  ChevronRight,
  Eye,
  X,
  ShieldAlert,
  UserCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { notify, type ToastFn } from '../_panel-primitives';
import { countryFlag } from '@/lib/game-config';
import { timeAgo } from '@/lib/date-utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminPlayer {
  id: string;
  userTag: string;
  name: string;
  country: string;
  avatar: string | null;
  role: string;
  banned: boolean;
  bankedChips: number;
  level: number;
  clanTag: string | null;
  clanRank: string | null;
  lastSeenAt: string;
  createdAt: string;
}

interface PlayerDetail extends AdminPlayer {
  email: string | null;
  totalEarned: number;
  totalLost: number;
  lifetimeKills: number;
  lifetimeDeaths: number;
  lifetimeExtracts: number;
  bestStreak: number;
  biggestExtract: number;
  dailyStreak: number;
  streakFreezes: number;
  referralCode: string | null;
  unlockedSkins: string;
  currentSkin: string;
  currentTrail: string;
  currentDeath: string;
  instagram: string | null;
  youtube: string | null;
  twitch: string | null;
  matchCount: number;
  giftsSent: number;
  giftsReceived: number;
  friendsCount: number;
  clipCount: number;
  clanMembers: { clanName: string; memberCount: number } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatChips(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded text-amber-400 bg-amber-500/10 border-amber-500/30">
        <ShieldAlert className="w-2.5 h-2.5" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
      <UserCheck className="w-2.5 h-2.5" /> Player
    </span>
  );
}

function BannedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded text-red-400 bg-red-500/10 border-red-500/30">
      <Ban className="w-2.5 h-2.5" /> Banned
    </span>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color = 'text-white',
  sub,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
          {label}
        </span>
        {icon}
      </div>
      <span className={`text-sm font-black ${color}`}>{value}</span>
      {sub && <span className="text-[9px] text-slate-600 font-mono">{sub}</span>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PlayersTab({ onToast }: { onToast?: ToastFn }) {
  const { player } = useAuth();
  const isAdmin = player?.role === 'admin';

  // State
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chipAmount, setChipAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [showBannedOnly, setShowBannedOnly] = useState(false);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch search results ──
  const fetchPlayers = useCallback(async (query: string, bannedOnly: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, banned: String(bannedOnly) });
      const res = await fetch(`/api/admin/search-players?${params}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();
      const data = (await res.json().catch(() => ({}))) as { players?: AdminPlayer[] };
      setPlayers(data.players || []);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch player detail ──
  const fetchDetail = useCallback(async (userTag: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/players/${encodeURIComponent(userTag)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();
      const data = (await res.json().catch(() => ({}))) as { player?: PlayerDetail };
      setPlayerDetail(data.player || null);
    } catch {
      setPlayerDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Debounced search effect ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchPlayers(search, showBannedOnly);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, showBannedOnly, fetchPlayers]);

  // ── Initial load ──
  useEffect(() => {
    if (isAdmin) void fetchPlayers('', false);
  }, [isAdmin, fetchPlayers]);

  // ── Handle row click ──
  function handleSelectPlayer(userTag: string) {
    setSelectedTag(userTag);
    setChipAmount('');
    void fetchDetail(userTag);
  }

  // ── Close detail ──
  function closeDetail() {
    setSelectedTag(null);
    setPlayerDetail(null);
    setChipAmount('');
  }

  // ── Refresh both list + detail ──
  async function refreshAll() {
    void fetchPlayers(search, showBannedOnly);
    if (selectedTag) {
      void fetchDetail(selectedTag);
    }
  }

  // ── Modify chips ──
  async function handleModifyChips(type: 'add' | 'remove') {
    if (!selectedTag || !chipAmount.trim()) {
      notify('Select a player and enter an amount.', 'error', onToast);
      return;
    }
    const amount = Math.abs(Number(chipAmount));
    if (!Number.isFinite(amount) || amount === 0) {
      notify('Amount must be a positive number.', 'error', onToast);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/modify-chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userTag: selectedTag,
          amount: type === 'remove' ? -amount : amount,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        notify(data?.error || 'Failed to modify chips.', 'error', onToast);
        return;
      }
      notify(
        `${type === 'remove' ? 'Removed' : 'Added'} ${formatChips(amount)} chips for ${selectedTag}.`,
        'success',
        onToast,
      );
      setChipAmount('');
      await refreshAll();
    } catch {
      notify('Network error while modifying chips.', 'error', onToast);
    } finally {
      setBusy(false);
    }
  }

  // ── Ban / Unban ──
  async function handleBanToggle() {
    if (!selectedTag || !playerDetail) return;
    const banning = !playerDetail.banned;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: selectedTag, ban: banning }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        notify(data?.error || `Failed to ${banning ? 'ban' : 'unban'} player.`, 'error', onToast);
        return;
      }
      notify(
        `${playerDetail.name} has been ${banning ? 'banned' : 'unbanned'}.`,
        banning ? 'info' : 'success',
        onToast,
      );
      await refreshAll();
    } catch {
      notify('Network error.', 'error', onToast);
    } finally {
      setBusy(false);
    }
  }

  // ── Guard: not admin ──
  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-8 text-center max-w-sm mx-auto">
        <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-xs text-slate-400">Access restricted to administrators.</p>
      </div>
    );
  }

  // ── K/D helper ──
  const kd = playerDetail
    ? playerDetail.lifetimeDeaths > 0
      ? (playerDetail.lifetimeKills / playerDetail.lifetimeDeaths).toFixed(2)
      : playerDetail.lifetimeKills.toFixed(0)
    : '—';

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* ── LEFT: Player list ── */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Banned-only toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                Banned Only
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showBannedOnly}
                onClick={() => setShowBannedOnly((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${showBannedOnly ? 'bg-red-600' : 'bg-slate-700'}`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${showBannedOnly ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </label>

            {/* Result count */}
            <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
              {loading ? '…' : `${players.length} result${players.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Player list */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
            ) : players.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Search className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-xs">No players found</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  Try a different search query
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {players.map((p) => {
                  const isSelected = selectedTag === p.userTag;
                  return (
                    <button
                      key={p.userTag}
                      type="button"
                      onClick={() => handleSelectPlayer(p.userTag)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-150 group ${isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : 'hover:bg-slate-800/40 border-l-2 border-transparent'}`}
                    >
                      {/* Avatar / Flag */}
                      <div className="shrink-0">
                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover border border-slate-700"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-base">
                            {countryFlag(p.country)}
                          </div>
                        )}
                      </div>

                      {/* Name + tag */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">
                            {p.name}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded">
                            #{p.userTag}
                          </span>
                          {p.clanTag && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              [{p.clanTag}]
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                            <Coins className="w-2.5 h-2.5" />
                            {formatChips(p.bankedChips)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Lvl {p.level}
                          </span>
                          <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(p.lastSeenAt)}
                          </span>
                        </div>
                      </div>

                      {/* Right side: badges + chevron */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.banned && <BannedBadge />}
                        {p.role === 'admin' && <RoleBadge role="admin" />}
                        {p.role !== 'admin' && !p.banned && <RoleBadge role="player" />}
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-emerald-400 -rotate-90' : 'text-slate-600 group-hover:text-slate-400'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Detail panel ── */}
      <div
        className={`w-full lg:w-[440px] shrink-0 transition-all duration-300 ${selectedTag ? 'opacity-100 translate-x-0' : 'opacity-0 lg:translate-x-4 pointer-events-none lg:pointer-events-auto lg:opacity-0'}`}
        aria-hidden={!selectedTag}
      >
        {selectedTag ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-lg overflow-hidden sticky top-4">
            {/* Detail header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Player Details
              </span>
              <button
                type="button"
                onClick={closeDetail}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
            ) : playerDetail ? (
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* ── Player identity ── */}
                <div className="flex items-start gap-3">
                  {playerDetail.avatar ? (
                    <img
                      src={playerDetail.avatar}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shrink-0">
                      {countryFlag(playerDetail.country)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-white truncate">
                        {playerDetail.name}
                      </h3>
                      <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded">
                        #{playerDetail.userTag}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm">{countryFlag(playerDetail.country)}</span>
                      <RoleBadge role={playerDetail.role} />
                      {playerDetail.banned && <BannedBadge />}
                      {playerDetail.clanTag && (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          [{playerDetail.clanTag}]
                          {playerDetail.clanRank && ` ${playerDetail.clanRank}`}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1.5 font-mono flex items-center gap-3 flex-wrap">
                      {playerDetail.email && (
                        <span className="truncate max-w-[200px]">{playerDetail.email}</span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        Seen {timeAgo(playerDetail.lastSeenAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Stats grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <StatCard
                    label="Banked Chips"
                    value={formatChips(playerDetail.bankedChips)}
                    icon={<Coins className="w-3.5 h-3.5 text-amber-400" />}
                    color="text-amber-400"
                  />
                  <StatCard
                    label="Total Earned"
                    value={formatChips(playerDetail.totalEarned)}
                    icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                    color="text-emerald-400"
                  />
                  <StatCard
                    label="Total Lost"
                    value={formatChips(playerDetail.totalLost)}
                    icon={<TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                    color="text-red-400"
                  />
                  <StatCard
                    label="Kills"
                    value={playerDetail.lifetimeKills.toLocaleString()}
                    icon={<TrendingUp className="w-3.5 h-3.5 text-orange-400" />}
                    color="text-orange-400"
                  />
                  <StatCard
                    label="Deaths"
                    value={playerDetail.lifetimeDeaths.toLocaleString()}
                    icon={<TrendingDown className="w-3.5 h-3.5 text-slate-400" />}
                    color="text-slate-300"
                  />
                  <StatCard
                    label="K/D Ratio"
                    value={kd}
                    color={Number(kd) >= 2 ? 'text-emerald-400' : Number(kd) >= 1 ? 'text-amber-400' : 'text-red-400'}
                  />
                  <StatCard
                    label="Extracts"
                    value={playerDetail.lifetimeExtracts.toLocaleString()}
                    icon={<Eye className="w-3.5 h-3.5 text-cyan-400" />}
                    color="text-cyan-400"
                  />
                  <StatCard
                    label="Best Streak"
                    value={playerDetail.bestStreak.toLocaleString()}
                    icon={<TrendingUp className="w-3.5 h-3.5 text-yellow-400" />}
                    color="text-yellow-400"
                  />
                  <StatCard
                    label="Biggest Extract"
                    value={formatChips(playerDetail.biggestExtract)}
                    icon={<Coins className="w-3.5 h-3.5 text-emerald-400" />}
                    color="text-emerald-400"
                  />
                  <StatCard
                    label="Matches"
                    value={playerDetail.matchCount.toLocaleString()}
                  />
                  <StatCard
                    label="Friends"
                    value={playerDetail.friendsCount.toLocaleString()}
                  />
                  <StatCard
                    label="Clips"
                    value={playerDetail.clipCount.toLocaleString()}
                  />
                </div>

                {/* Extra stats row */}
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    label="Daily Streak"
                    value={playerDetail.dailyStreak}
                    sub={`${playerDetail.streakFreezes} freeze${playerDetail.streakFreezes !== 1 ? 's' : ''} remaining`}
                  />
                  <StatCard
                    label="Gifts"
                    value={`${playerDetail.giftsSent} / ${playerDetail.giftsReceived}`}
                    sub="sent / received"
                  />
                </div>

                {/* ── Clan info ── */}
                {playerDetail.clanMembers && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500/70 block mb-1">
                      Clan
                    </span>
                    <p className="text-xs font-bold text-amber-300">
                      {playerDetail.clanMembers.clanName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {playerDetail.clanMembers.memberCount} members
                    </p>
                  </div>
                )}

                {/* ── Social links ── */}
                {(playerDetail.instagram || playerDetail.youtube || playerDetail.twitch) && (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
                      Social Links
                    </span>
                    <div className="space-y-1.5">
                      {playerDetail.youtube && (
                        <a
                          href={playerDetail.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[10px] text-red-400 hover:text-red-300 transition truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          YouTube
                        </a>
                      )}
                      {playerDetail.twitch && (
                        <a
                          href={playerDetail.twitch}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[10px] text-violet-400 hover:text-violet-300 transition truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          Twitch
                        </a>
                      )}
                      {playerDetail.instagram && (
                        <a
                          href={playerDetail.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[10px] text-pink-400 hover:text-pink-300 transition truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          Instagram
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Cosmetics info ── */}
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
                    Equipped Cosmetics
                  </span>
                  <div className="space-y-1 text-[10px] font-mono text-slate-400">
                    {playerDetail.currentSkin && (
                      <p>Skin: <span className="text-white">{playerDetail.currentSkin}</span></p>
                    )}
                    {playerDetail.currentTrail && (
                      <p>Trail: <span className="text-white">{playerDetail.currentTrail}</span></p>
                    )}
                    {playerDetail.currentDeath && (
                      <p>Death FX: <span className="text-white">{playerDetail.currentDeath}</span></p>
                    )}
                    {playerDetail.unlockedSkins && (
                      <p className="text-slate-500">
                        {playerDetail.unlockedSkins.split(',').length} skin{playerDetail.unlockedSkins.split(',').length !== 1 ? 's' : ''} unlocked
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Referral code ── */}
                {playerDetail.referralCode && (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">
                      Referral Code
                    </span>
                    <p className="text-xs font-mono font-bold text-emerald-400">
                      {playerDetail.referralCode}
                    </p>
                  </div>
                )}

                {/* ── Account dates ── */}
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-0.5">
                        Joined
                      </span>
                      <span className="text-[10px] text-slate-300 font-mono">
                        {timeAgo(playerDetail.createdAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-0.5">
                        Last Seen
                      </span>
                      <span className="text-[10px] text-slate-300 font-mono">
                        {timeAgo(playerDetail.lastSeenAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Actions ── */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  {/* Chip modification */}
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
                      Chip Modification
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={chipAmount}
                        onChange={(e) => setChipAmount(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50 transition"
                        min="1"
                      />
                      <button
                        type="button"
                        onClick={() => void handleModifyChips('add')}
                        disabled={busy || !chipAmount.trim()}
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {busy ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleModifyChips('remove')}
                        disabled={busy || !chipAmount.trim()}
                        className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {busy ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        Remove
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-600 font-mono mt-1.5">
                      Current balance: <span className="text-amber-400 font-bold">{formatChips(playerDetail.bankedChips)}</span> chips
                    </p>
                  </div>

                  {/* Ban / Unban */}
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
                      Account Action
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleBanToggle()}
                      disabled={busy}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${playerDetail.banned ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : playerDetail.banned ? (
                        <>
                          <ShieldBan className="w-4 h-4" />
                          Unban Player
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4" />
                          Ban Player
                        </>
                      )}
                    </button>
                    {playerDetail.banned && (
                      <p className="text-[9px] text-red-400/70 font-mono mt-1.5 text-center">
                        This player is currently banned from the game
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <ShieldAlert className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-xs">Failed to load player details</p>
              </div>
            )}
          </div>
        ) : (
          /* Empty state when no player selected */
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 border-dashed flex flex-col items-center justify-center py-20 text-slate-500">
            <Eye className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs">Select a player to view details</p>
            <p className="text-[10px] text-slate-600 mt-1">
              Click on any row in the list
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
