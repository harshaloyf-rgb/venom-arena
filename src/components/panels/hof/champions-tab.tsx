'use client';

import { Loader2, Search, X } from 'lucide-react';
import { countryFlag, fmtChips, fmtDate, badgeIcon } from './_types';
import type { InducteeEntry } from './_types';
import type { InspectedPlayer } from '@/lib/game-config';

// ── Champions Wing Tab ────────────────────────────────────────────────────

interface ChampionsTabProps {
  loading: boolean;
  year: number | null;
  years: number[];
  search: string;
  displayEntries: (InducteeEntry | Record<string, unknown>)[];
  isDemo: boolean;
  onYearChange: (year: number | null) => void;
  onSearchChange: (search: string) => void;
  onInspectEntry: (entry: InducteeEntry) => void;
  onInspectDemo: (name: string, userTag: string, country: string, chips: number, level: number) => void;
}

export function ChampionsTab({
  loading,
  year,
  years,
  search,
  displayEntries,
  isDemo,
  onYearChange,
  onSearchChange,
  onInspectEntry,
  onInspectDemo,
}: ChampionsTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3 text-[11px] text-amber-200 leading-relaxed">
        <strong>CHAMPIONSHIPS WING</strong>
        <br />
        Players inducted for finishing in the Top 100 of the Annual Venom Arena Championship. Ranks 1–100 earn permanent HOF status with unique badges.
      </div>

      {/* Year filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Year:</span>
        <button
          type="button"
          onClick={() => onYearChange(null)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition border ${year === null ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
        >
          All Years
        </button>
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onYearChange(y)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition border ${year === y ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
          >
            {y}{y === 2026 ? ' (Current)' : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Search by player name…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="p-1 rounded text-slate-500 hover:text-white transition"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          <span className="ml-2 text-xs text-slate-400">Loading champions…</span>
        </div>
      )}

      {/* Empty state for non-admin */}
      {!loading && displayEntries.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center text-xs text-slate-500">
          No championship inductees yet
        </div>
      )}

      {/* Table */}
      {!loading && displayEntries.length > 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
          {isDemo && (
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
              <span className="text-[9px] font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">
                DEMO
              </span>
              <span className="text-[10px] text-slate-500">No real championship inductees yet. Showing sample data.</span>
            </div>
          )}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Player</div>
            <div className="col-span-2">Badge</div>
            <div className="col-span-3">Title</div>
            <div className="col-span-1 text-right">Chips</div>
            <div className="col-span-1 text-right">Date</div>
          </div>
          <ol className="divide-y divide-slate-900 max-h-96 overflow-y-auto va-scroll">
            {displayEntries.map((entry, idx) => {
              const isD = isDemo;
              const rank = isD
                ? (entry as unknown as { rank: number }).rank
                : (entry as InducteeEntry).championshipRank ?? idx + 1;
              const name = isD
                ? (entry as unknown as { name: string }).name
                : (entry as InducteeEntry).playerName;
              const tag = isD
                ? (entry as unknown as { userTag: string }).userTag
                : (entry as InducteeEntry).playerTag;
              const country = isD
                ? (entry as unknown as { country: string }).country
                : (entry as InducteeEntry).country;
              const badge = isD
                ? (entry as unknown as { badge: string }).badge
                : (entry as InducteeEntry).hofBadge;
              const title = isD
                ? (entry as unknown as { title: string }).title
                : (entry as InducteeEntry).title;
              const chips = isD
                ? (entry as unknown as { chips: number }).chips
                : (entry as InducteeEntry).chipsAtInduction;
              const date = isD
                ? (entry as unknown as { date: string }).date
                : fmtDate((entry as InducteeEntry).inductedAt);

              return (
                <li
                  key={isD ? `${(entry as unknown as { name: string }).name}-${rank}` : (entry as InducteeEntry).id}
                  className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm hover:bg-slate-900/40 transition-colors cursor-pointer ${isD ? 'opacity-60' : ''}`}
                  onClick={() => {
                    if (isD) {
                      onInspectDemo(name, tag, country, chips, 45);
                    } else {
                      onInspectEntry(entry as InducteeEntry);
                    }
                  }}
                >
                  <div className="col-span-1 font-mono">
                    {rank === 1 ? (
                      <span className="text-yellow-400 font-bold">👑 #1</span>
                    ) : rank <= 3 ? (
                      <span className="text-lg">{['', '🥇', '🥈', '🥉'][rank]}</span>
                    ) : (
                      <span className="text-slate-400 font-bold">#{rank}</span>
                    )}
                  </div>
                  <div className="col-span-4 min-w-0">
                    <div className="font-bold text-white truncate flex items-center gap-1.5">
                      <span aria-hidden>{countryFlag(country)}</span>
                      {name}
                      {isD && (
                        <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          DEMO
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{tag}</div>
                  </div>
                  <div className="col-span-2 text-lg" aria-label={badge || 'badge'}>{badgeIcon(badge)}</div>
                  <div className="col-span-3 min-w-0">
                    <div className="text-[11px] text-slate-300 truncate">{title}</div>
                  </div>
                  <div className="col-span-1 text-right font-mono font-bold text-emerald-400 tabular-nums text-[11px]">
                    {fmtChips(chips)}c
                  </div>
                  <div className="col-span-1 text-right text-[10px] font-mono text-slate-500">{date}</div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
