'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Users,
  Coins,
  Trophy,
  Crown,
  MessageSquare,
  Loader2,
  RefreshCw,
  Hash,
  ChevronRight,
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

  const selected = clans.find((c) => c.tag === selectedTag) ?? null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or tag…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all"
          />
        </div>

        {/* Refresh + count */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
            {loading ? '—' : `${clans.length} clan${clans.length !== 1 ? 's' : ''}`}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-[11px] uppercase tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div
              key={i}
              className="h-28 w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 animate-pulse"
            />
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
          <p className="text-sm text-slate-500">
            {searchQuery ? 'No clans match your search.' : 'No clans found.'}
          </p>
        </div>
      )}

      {/* ── Clan list ────────────────────────────────────────────────────── */}
      {!loading && !error && clans.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Scrollable list */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {clans.map((clan) => {
                const isSelected = clan.tag === selectedTag;
                const nextLevelXp = xpForLevel(clan.level + 1);
                const progress = Math.min(
                  (clan.xp / nextLevelXp) * 100,
                  99.9,
                );

                return (
                  <button
                    key={clan.tag}
                    type="button"
                    onClick={() =>
                      setSelectedTag(isSelected ? null : clan.tag)
                    }
                    className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 group cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500/60 bg-indigo-500/10'
                        : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3">
                      <span className="text-2xl leading-none flex-shrink-0">
                        {clan.emblem || '🏴'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">
                            {clan.name}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 text-[10px] font-mono text-slate-400 flex-shrink-0">
                            <Hash className="h-2.5 w-2.5" />
                            {clan.tag}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <Users className="h-3 w-3" />
                            {clan.memberCount}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-500">
                            <Trophy className="h-3 w-3" />
                            Lv {clan.level}
                          </span>
                          <span className="text-[10px] text-slate-600 ml-auto">
                            {timeAgo(clan.createdAt)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                          isSelected
                            ? 'rotate-90 text-indigo-400'
                            : 'text-slate-600 group-hover:text-slate-400'
                        }`}
                      />
                    </div>

                    {/* XP bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">
                          XP
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {formatNumber(clan.xp)} / {formatNumber(nextLevelXp)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
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
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Clan header */}
                <div className="flex items-start gap-4 mb-6">
                  <span className="text-4xl leading-none flex-shrink-0">
                    {selected.emblem || '🏴'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg font-black text-white tracking-tight">
                        {selected.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700/60 text-xs font-mono text-slate-300">
                        <Hash className="h-3 w-3" />
                        {selected.tag}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-400">
                        <Crown className="h-3 w-3" />
                        Level {selected.level}
                      </span>
                    </div>
                    {selected.description && (
                      <p className="text-sm text-slate-400 mt-2 flex items-start gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{selected.description}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* XP Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      Experience Progress
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {formatNumber(selected.xp)} / {formatNumber(xpForLevel(selected.level + 1))} XP
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min((selected.xp / xpForLevel(selected.level + 1)) * 100, 99.9)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {Math.min((selected.xp / xpForLevel(selected.level + 1)) * 100, 99.9).toFixed(1)}% to Level {selected.level + 1}
                  </p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <StatCard
                    icon={<Users className="h-4 w-4" />}
                    label="Members"
                    value={String(selected.memberCount)}
                    color="text-emerald-400"
                    bg="bg-emerald-500/10"
                    border="border-emerald-500/20"
                  />
                  <StatCard
                    icon={<Coins className="h-4 w-4" />}
                    label="Banked Chips"
                    value={formatNumber(selected.bankedChips)}
                    color="text-amber-400"
                    bg="bg-amber-500/10"
                    border="border-amber-500/20"
                  />
                  <StatCard
                    icon={<Coins className="h-4 w-4" />}
                    label="Total Deposited"
                    value={formatNumber(selected.totalDeposited)}
                    color="text-sky-400"
                    bg="bg-sky-500/10"
                    border="border-sky-500/20"
                  />
                  <StatCard
                    icon={<Trophy className="h-4 w-4" />}
                    label="Level"
                    value={String(selected.level)}
                    color="text-purple-400"
                    bg="bg-purple-500/10"
                    border="border-purple-500/20"
                  />
                </div>

                {/* Footer info */}
                <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Created {timeAgo(selected.createdAt)}
                  </span>
                  <span className="font-mono">
                    {new Date(selected.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-900/20 p-10 flex flex-col items-center justify-center text-center min-h-[320px]">
                <Crown className="h-10 w-10 text-slate-700 mb-3" />
                <p className="text-sm text-slate-600 font-medium">
                  Select a clan to view details
                </p>
                <p className="text-xs text-slate-700 mt-1">
                  Click on any clan from the list
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.3);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.5);
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      className={`rounded-xl border ${border} ${bg} p-3 flex flex-col gap-1.5`}
    >
      <div className="flex items-center gap-1.5">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {label}
        </span>
      </div>
      <span className={`text-base font-bold ${color} tabular-nums`}>{value}</span>
    </div>
  );
}
