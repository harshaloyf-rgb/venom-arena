'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search, Users, Coins, Trophy, Crown, MessageSquare, Loader2,
  RefreshCw, Hash, ChevronRight, Trash2, Pencil, UserMinus,
  ChevronDown, ChevronUp, Shield, Star, Settings, AlertTriangle,
  X, Check, ArrowUpDown,
} from 'lucide-react';
import { notify, type ToastFn } from '../_panel-primitives';
import { timeAgo } from '@/lib/date-utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminClan {
  tag: string;
  name: string;
  emblem: string;
  description: string;
  level: number;
  xp: number;
  totalDeposited: number;
  bankedChips: number;
  memberCount: number;
  createdAt: string;
}

interface ClanMember {
  id: string;
  userTag: string;
  name: string;
  avatar: string | null;
  clanRank: string | null;
  level: number;
  bankedChips: number;
  lifetimeKills: number;
  lifetimeDeaths: number;
  joinedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function xpForLevel(level: number): number {
  return Math.floor(500 * Math.pow(level, 1.6));
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClansTab({ onToast }: { onToast?: ToastFn }) {
  const [clans, setClans] = useState<AdminClan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editEmblem, setEditEmblem] = useState('');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statLevel, setStatLevel] = useState('');
  const [statXp, setStatXp] = useState('');
  const [statChips, setStatChips] = useState('');
  const [statTotalDep, setStatTotalDep] = useState('');
  const [disbandConfirm, setDisbandConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClans = useCallback(
    async (search = '') => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (search.trim()) params.set('search', search.trim());
        const res = await fetch(`/api/admin/clans?${params.toString()}`);
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || res.statusText);
        }
        const json = await res.json();
        const data: AdminClan[] = json.clans ?? json;
        setClans(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load clans';
        setError(message);
        notify(message, 'error', onToast);
      } finally {
        setLoading(false);
      }
    },
    [onToast],
  );

  useEffect(() => {
    fetchClans();
  }, [fetchClans]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchClans(value);
      }, 300);
    },
    [fetchClans],
  );

  const handleRefresh = useCallback(() => {
    fetchClans(searchQuery);
  }, [fetchClans, searchQuery]);

  // ── Admin actions ──

  const adminAction = useCallback(async (action: string, body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      notify(data.message || 'Done', 'success', onToast);
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      notify(msg, 'error', onToast);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [onToast]);

  const handleDisband = useCallback(async () => {
    if (!selectedTag || !disbandConfirm) return;
    try {
      await adminAction('disband', { tag: selectedTag });
      setSelectedTag(null);
      setShowMembers(false);
      setMembers([]);
      fetchClans(searchQuery);
    } catch { /* handled */ }
    setDisbandConfirm(false);
  }, [selectedTag, disbandConfirm, adminAction, fetchClans, searchQuery]);

  const handleEdit = useCallback(async () => {
    if (!selectedTag) return;
    const body: Record<string, unknown> = { tag: selectedTag };
    if (editName.trim().length >= 3) body.name = editName.trim();
    if (editDesc !== undefined) body.description = editDesc;
    if (editEmblem) body.emblem = editEmblem;
    try {
      await adminAction('edit', body);
      setShowEditModal(false);
      fetchClans(searchQuery);
    } catch { /* handled */ }
  }, [selectedTag, editName, editDesc, editEmblem, adminAction, fetchClans, searchQuery]);

  const handleStatSave = useCallback(async () => {
    if (!selectedTag) return;
    try {
      if (statLevel) await adminAction('setLevel', { tag: selectedTag, level: parseInt(statLevel, 10) });
      if (statXp) await adminAction('setXp', { tag: selectedTag, xp: parseInt(statXp, 10) });
      if (statChips) await adminAction('setChips', { tag: selectedTag, bankedChips: parseInt(statChips, 10) });
      if (statTotalDep) await adminAction('setTotalDep', { tag: selectedTag, totalDeposited: parseInt(statTotalDep, 10) });
      setShowStatsModal(false);
      fetchClans(searchQuery);
    } catch { /* handled */ }
  }, [selectedTag, statLevel, statXp, statChips, statTotalDep, adminAction, fetchClans, searchQuery]);

  const handleKickMember = useCallback(async (targetTag: string, memberName: string) => {
    if (!selectedTag) return;
    try {
      await adminAction('kick', { tag: selectedTag, targetTag });
      // Refresh members
      fetchMembers(selectedTag);
      fetchClans(searchQuery);
    } catch { /* handled */ }
  }, [selectedTag, adminAction, fetchClans, searchQuery]);

  const handlePromoteMember = useCallback(async (targetTag: string, newRank: string) => {
    if (!selectedTag) return;
    try {
      await adminAction('promote', { tag: selectedTag, targetTag, rank: newRank });
      fetchMembers(selectedTag);
    } catch { /* handled */ }
  }, [selectedTag, adminAction]);

  // ── Members fetch ──

  const fetchMembers = useCallback(async (tag: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch('/api/admin/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'members', tag }),
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const openClanDetail = useCallback((clan: AdminClan) => {
 setSelectedTag(clan.tag);
    setShowMembers(false);
    setMembers([]);
    setDisbandConfirm(false);
    // Pre-fill edit fields
    setEditName(clan.name);
    setEditDesc(clan.description);
    setEditEmblem(clan.emblem);
    // Pre-fill stat fields
    setStatLevel(String(clan.level));
    setStatXp(String(clan.xp));
    setStatChips(String(clan.bankedChips));
    setStatTotalDep(String(clan.totalDeposited));
  }, []);

  const toggleMembers = useCallback(() => {
    if (showMembers) {
      setShowMembers(false);
      setMembers([]);
    } else if (selectedTag) {
      setShowMembers(true);
      fetchMembers(selectedTag);
    }
  }, [showMembers, selectedTag, fetchMembers]);

  const selected = clans.find((c) => c.tag === selectedTag) ?? null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 lg:space-y-1">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 lg:h-3 lg:w-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or tag…"
            className="w-full pl-9 pr-4 py-2.5 lg:py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-sm lg:text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs lg:text-[11px] font-mono text-slate-500 whitespace-nowrap">
            {loading ? '—' : `${clans.length} clan${clans.length !== 1 ? 's' : ''}`}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 lg:px-2 lg:py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-[11px] uppercase tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-center">
          <p className="text-sm text-rose-300 mb-3">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!loading && !error && clans.length === 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
          <Users className="h-10 w-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{searchQuery ? 'No clans match your search.' : 'No clans found.'}</p>
        </div>
      )}

      {/* ── Clan list ────────────────────────────────────────────────────── */}
      {!loading && !error && clans.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-1">
          {/* Scrollable list */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="max-h-[500px] lg:max-h-[400px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {clans.map((clan) => {
                const isSelected = clan.tag === selectedTag;
                const nextLevelXp = xpForLevel(clan.level + 1);
                const progress = Math.min((clan.xp / nextLevelXp) * 100, 99.9);

                return (
                  <button
                    key={clan.tag}
                    type="button"
                    onClick={() => isSelected ? setSelectedTag(null) : openClanDetail(clan)}
                    className={`w-full text-left rounded-2xl border p-4 lg:p-1.5 transition-all duration-200 group cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 lg:gap-1.5">
                      <span className="text-2xl lg:text-[11px] leading-none flex-shrink-0">{clan.emblem || '🏴'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm lg:text-[11px] font-bold text-white">{clan.name}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 text-[10px] lg:text-[11px] font-mono text-slate-400 flex-shrink-0">
                            <Hash className="h-2.5 w-2.5" />{clan.tag}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Users className="h-3 w-3" />{clan.memberCount}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-500"><Trophy className="h-3 w-3" />Lv {clan.level}</span>
                          <span className="text-[10px] lg:text-[11px] text-slate-600 ml-auto">{timeAgo(clan.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 lg:h-3 lg:w-3 flex-shrink-0 transition-transform duration-200 ${isSelected ? 'rotate-90 text-emerald-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                    </div>
                    <div className="mt-3 lg:mt-1">
                      <div className="flex items-center justify-between mb-1 lg:mb-0">
                        <span className="text-[10px] lg:text-[11px] font-mono uppercase tracking-wider text-slate-600">XP</span>
                        <span className="text-[10px] lg:text-[11px] font-mono text-slate-500">{formatNumber(clan.xp)} / {formatNumber(nextLevelXp)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Detail panel ──────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 lg:p-2 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Clan header */}
                <div className="flex items-start gap-4 lg:gap-1.5 mb-5 lg:mb-1">
                  <span className="text-4xl lg:text-[11px] leading-none flex-shrink-0">{selected.emblem || '🏴'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg lg:text-[11px] font-black text-white tracking-tight">{selected.name}</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700/60 text-xs lg:text-[11px] font-mono text-slate-300">
                        <Hash className="h-3 w-3" />{selected.tag}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs lg:text-[11px] font-bold text-amber-400">
                        <Crown className="h-3 w-3" />Level {selected.level}
                      </span>
                    </div>
                    {selected.description && (
                      <p className="text-sm lg:text-[11px] text-slate-400 mt-2 lg:mt-0 flex items-start gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                        <span className="">{selected.description}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* ── ACTION BUTTONS ─────────────────────────────────────── */}
                <div className="flex flex-wrap gap-2 lg:gap-1 mb-6 lg:mb-1">
                  <button
                    onClick={() => { openClanDetail(selected); setShowEditModal(true); }}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 lg:px-2 lg:py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-xs lg:text-[11px] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5 lg:h-3 lg:w-3" /> Edit Info
                  </button>
                  <button
                    onClick={() => { openClanDetail(selected); setShowStatsModal(true); }}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 lg:px-2 lg:py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-xs lg:text-[11px] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Settings className="h-3.5 w-3.5 lg:h-3 lg:w-3" /> Adjust Stats
                  </button>
                  <button
                    onClick={toggleMembers}
                    disabled={actionLoading || membersLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 lg:px-2 lg:py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-xs lg:text-[11px] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {membersLoading ? <Loader2 className="h-3.5 w-3.5 lg:h-3 lg:w-3 animate-spin" /> : <Users className="h-3.5 w-3.5 lg:h-3 lg:w-3" />}
                    {showMembers ? 'Hide Members' : `View Members (${selected.memberCount})`}
                  </button>
                  {!disbandConfirm ? (
                    <button
                      onClick={() => setDisbandConfirm(true)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-2 lg:px-2 lg:py-1 bg-rose-950/50 hover:bg-rose-900/50 border border-rose-500/30 text-rose-400 hover:text-rose-300 font-bold rounded-xl text-xs lg:text-[11px] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 lg:h-3 lg:w-3" /> Disband Clan
                    </button>
                  ) : (
                    <button
                      onClick={handleDisband}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-2 lg:px-2 lg:py-1 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white font-bold rounded-xl text-xs lg:text-[11px] transition-all cursor-pointer animate-pulse disabled:opacity-50"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 lg:h-3 lg:w-3" /> Confirm Disband [${selected.tag}]
                    </button>
                  )}
                  {disbandConfirm && (
                    <button
                      onClick={() => setDisbandConfirm(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 lg:px-2 lg:py-1 bg-slate-950 border border-slate-800 text-slate-400 font-bold rounded-xl text-xs lg:text-[11px] transition-all cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5 lg:h-3 lg:w-3" /> Cancel
                    </button>
                  )}
                </div>

                {/* XP Progress */}
                <div className="mb-6 lg:mb-1">
                  <div className="flex items-center justify-between mb-2 lg:mb-0.5">
                    <span className="text-[10px] lg:text-[11px] font-mono uppercase tracking-widest text-slate-500">Experience Progress</span>
                    <span className="text-xs lg:text-[11px] font-mono text-slate-400">
                      {formatNumber(selected.xp)} / {formatNumber(xpForLevel(selected.level + 1))} XP
                    </span>
                  </div>
                  <div className="h-2.5 lg:h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 transition-all duration-700 ease-out"
                      style={{ width: `${Math.min((selected.xp / xpForLevel(selected.level + 1)) * 100, 99.9)}%` }}
                    />
                  </div>
                  <p className="text-[10px] lg:text-[11px] text-slate-600 mt-1 lg:mt-0">
                    {Math.min((selected.xp / xpForLevel(selected.level + 1)) * 100, 99.9).toFixed(1)}% to Level {selected.level + 1}
                  </p>
                </div>

                {/* ── Members list (when expanded) ────────────────────── */}
                {showMembers && (
                  <div className="mb-6 lg:mb-1">
                    <div className="flex items-center justify-between mb-3 lg:mb-0.5">
                      <span className="text-xs lg:text-[11px] font-bold text-slate-300 uppercase tracking-wider">Members ({members.length})</span>
                      <button onClick={toggleMembers} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                        <ChevronUp className="h-4 w-4 lg:h-3 lg:w-3" />
                      </button>
                    </div>
                    {membersLoading ? (
                      <div className="flex items-center justify-center py-8 lg:py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                        <span className="text-xs text-slate-400 ml-2">Loading members…</span>
                      </div>
                    ) : members.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6 lg:py-3">No members found.</p>
                    ) : (
                      <div className="max-h-[300px] lg:max-h-[150px] overflow-y-auto space-y-1.5 lg:space-y-1 pr-1 custom-scrollbar">
                        {members.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 p-2.5 lg:p-1 rounded-xl border border-slate-800/60 bg-slate-950/50 hover:bg-slate-900/60 transition-colors">
                            <div className="w-8 h-8 lg:w-6 lg:h-6 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800 text-xs overflow-hidden shrink-0">
                              {m.avatar ? (
                                m.avatar.startsWith('data:') || m.avatar.startsWith('http') ? (
                                  <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="select-none text-base">{m.avatar}</span>
                                )
                              ) : (
                                <span className="text-[10px] lg:text-[11px] font-mono font-bold text-slate-400">{m.level}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs lg:text-[11px] font-bold text-white">{m.name}</span>
                                <span className="text-[9px] lg:text-[11px] font-mono text-slate-500">#{m.userTag}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 lg:mt-0">
                                <RankBadge rank={m.clanRank} />
                                <span className="text-[10px] lg:text-[11px] text-slate-500">Lv {m.level}</span>
                                <span className="text-[10px] lg:text-[11px] text-emerald-500">{formatNumber(m.bankedChips)}c</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {m.clanRank !== 'Leader' && (
                                <button
                                  onClick={() => handlePromoteMember(m.userTag, m.clanRank === 'Co-Leader' ? 'Viper' : 'Co-Leader')}
                                  disabled={actionLoading}
                                  className="p-1.5 lg:p-1 rounded-lg bg-slate-900 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/30 text-slate-400 hover:text-amber-400 transition-all cursor-pointer disabled:opacity-50"
                                  title={m.clanRank === 'Co-Leader' ? 'Demote to Viper' : 'Promote to Co-Leader'}
                                >
                                  <ArrowUpDown className="h-3 w-3" />
                                </button>
                              )}
                              {m.clanRank !== 'Leader' && (
                                <button
                                  onClick={() => handleKickMember(m.userTag, m.name)}
                                  disabled={actionLoading}
                                  className="p-1.5 lg:p-1 rounded-lg bg-slate-900 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all cursor-pointer disabled:opacity-50"
                                  title="Kick from clan"
                                >
                                  <UserMinus className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-1 mb-6 lg:mb-1">
                  <StatCard icon={<Users className="h-4 w-4 lg:h-3 lg:w-3" />} label="Members" value={String(selected.memberCount)} color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" />
                  <StatCard icon={<Coins className="h-4 w-4 lg:h-3 lg:w-3" />} label="Banked Chips" value={formatNumber(selected.bankedChips)} color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20" />
                  <StatCard icon={<Coins className="h-4 w-4 lg:h-3 lg:w-3" />} label="Total Deposited" value={formatNumber(selected.totalDeposited)} color="text-sky-400" bg="bg-sky-500/10" border="border-sky-500/20" />
                  <StatCard icon={<Trophy className="h-4 w-4 lg:h-3 lg:w-3" />} label="Level" value={String(selected.level)} color="text-purple-400" bg="bg-purple-500/10" border="border-purple-500/20" />
                </div>

                {/* Footer info */}
                <div className="pt-4 lg:pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Created {timeAgo(selected.createdAt)}</span>
                  <span className="font-mono">
                    {new Date(selected.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-900/20 p-10 flex flex-col items-center justify-center text-center min-h-[320px]">
                <Crown className="h-10 w-10 text-slate-700 mb-3" />
                <p className="text-sm text-slate-600 font-medium">Select a clan to manage</p>
                <p className="text-xs text-slate-700 mt-1">Disband, edit, kick members, adjust stats</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────────── */}
      {showEditModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Pencil className="h-4 w-4 text-emerald-400" /> Edit Clan [{selected.tag}]</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Clan Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={30} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={200} rows={3} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition resize-none" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Emblem (emoji, max 4 chars)</label>
                <input type="text" value={editEmblem} onChange={(e) => setEditEmblem(e.target.value)} maxLength={4} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer">Cancel</button>
              <button
                onClick={handleEdit}
                disabled={actionLoading || editName.trim().length < 3}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Modal ─────────────────────────────────────────────────── */}
      {showStatsModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowStatsModal(false)} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Settings className="h-4 w-4 text-amber-400" /> Adjust Stats [{selected.tag}]</h3>
              <button onClick={() => setShowStatsModal(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Level (1-99, resets XP to 0)</label>
                <input type="number" value={statLevel} onChange={(e) => setStatLevel(e.target.value)} min={1} max={99} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-amber-500/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">XP (current experience points)</label>
                <input type="number" value={statXp} onChange={(e) => setStatXp(e.target.value)} min={0} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-amber-500/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Banked Chips (treasury balance)</label>
                <input type="number" value={statChips} onChange={(e) => setStatChips(e.target.value)} min={0} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-amber-500/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Total Deposited (lifetime)</label>
                <input type="number" value={statTotalDep} onChange={(e) => setStatTotalDep(e.target.value)} min={0} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-amber-500/50 transition" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowStatsModal(false)} className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer">Cancel</button>
              <button
                onClick={handleStatSave}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.3); border-radius: 999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.5); }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, bg, border }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string; border: string }) {
  return (
    <div className={`rounded-xl border ${border} ${bg} p-3 lg:p-1 flex flex-col gap-1.5 lg:gap-0.5`}>
      <div className="flex items-center gap-1.5">
        <span className={color}>{icon}</span>
        <span className="text-[10px] lg:text-[11px] font-mono uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <span className={`text-base lg:text-[11px] font-bold ${color} tabular-nums`}>{value}</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: string | null }) {
  if (rank === 'Leader') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[9px] lg:text-[11px] font-bold text-amber-400">
        <Crown className="h-2.5 w-2.5" />Leader
      </span>
    );
  }
  if (rank === 'Co-Leader') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[9px] lg:text-[11px] font-bold text-emerald-400">
        <Shield className="h-2.5 w-2.5" />Co-Leader
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 text-[9px] lg:text-[11px] font-bold text-slate-400">
      <Star className="h-2.5 w-2.5" />Member
    </span>
  );
}
