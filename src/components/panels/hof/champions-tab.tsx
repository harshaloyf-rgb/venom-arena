'use client';

import { useMemo, useState } from 'react';
import { Loader2, Search, X, ChevronDown, Eye } from 'lucide-react';
import { countryFlag, fmtChips, fmtDate, badgeIcon } from './_types';
import type { InducteeEntry } from './_types';

// ── Champions Wing Tab ────────────────────────────────────────────────────

interface ChampionsTabProps {
  loading: boolean;
  year: number | null;
  years: number[];
  search: string;
  entries: InducteeEntry[];
  total: number;
  onYearChange: (year: number | null) => void;
  onSearchChange: (search: string) => void;
  onInspectEntry: (entry: InducteeEntry) => void;
}

export function ChampionsTab({
  loading,
  year,
  years,
  search,
  entries,
  total,
  onYearChange,
  onSearchChange,
  onInspectEntry,
}: ChampionsTabProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.playerName.toLowerCase().includes(q) ||
        e.playerTag.toLowerCase().includes(q) ||
        e.clanTag?.toLowerCase().includes(q),
    );
  }, [entries, search]);

  return (
    <div className="space-y-4 lg:space-y-1">
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3 lg:p-1.5 text-[11px] text-amber-200 leading-relaxed">
        <strong>CHAMPIONS WING</strong>
        <br />
        Players inducted for finishing in the Top 100 of the Annual Venom Arena Championship. Ranks 1–100 earn permanent HOF status with unique badges.
      </div>

      {/* Year filter */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-1">
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Year:</span>
        <button
          type="button"
          onClick={() => onYearChange(null)}
          className={`px-2.5 lg:px-1.5 py-1 rounded-full text-[11px] font-bold font-mono transition border ${year === null ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
        >
          All Years
        </button>
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onYearChange(y)}
            className={`px-2.5 lg:px-1.5 py-1 rounded-full text-[11px] font-bold font-mono transition border ${year === y ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
          >
            {y}{y === currentYear ? ' (Current)' : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 lg:gap-1">
        <Search className="w-4 h-4 lg:w-3 lg:h-3 text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Search name, tag, or clan…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 lg:px-1.5 py-1.5 lg:py-1 text-xs lg:text-[11px] text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
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
        <div className="flex items-center justify-center py-10 lg:py-3">
          <Loader2 className="w-5 h-5 lg:w-3 lg:h-3 text-amber-400 animate-spin" />
          <span className="ml-2 text-xs lg:text-[11px] text-slate-400">Loading champions…</span>
        </div>
      )}

      {/* Truncation hint (list is capped at 100 rows per fetch) */}
      {!loading && total > entries.length && (
        <p className="text-[11px] font-mono text-slate-600 text-center">
          Showing first {entries.length} of {total} inductees{search ? ' matching your search' : ''}
        </p>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 lg:p-3 text-center text-xs lg:text-[11px] text-slate-500">
          {search.trim()
            ? <>No champions found matching &quot;{search}&quot;</>
            : year
              ? <>No inductees for {year} yet</>
              : 'No championship inductees yet'}
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
          {/* Desktop header */}
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <div className="lg:col-span-1">Rank</div>
            <div className="lg:col-span-4">Player</div>
            <div className="lg:col-span-2">Badge</div>
            <div className="lg:col-span-3">Title</div>
            <div className="lg:col-span-1 text-right">Chips</div>
            <div className="lg:col-span-1 text-right">Date</div>
          </div>
          <ol className="divide-y divide-slate-900 max-h-96 lg:max-h-[340px] overflow-y-auto va-scroll">
            {filtered.map((entry, idx) => {
              const rank = entry.championshipRank ?? idx + 1;
              const key = entry.id;
              const isExpanded = expanded === key;

              const handleInspect = () => {
                onInspectEntry(entry);
              };

              const rankDisplay = rank === 1 ? (
                <span className="text-yellow-400 font-bold">👑 #1</span>
              ) : rank <= 3 ? (
                <span>{['', '🥇', '🥈', '🥉'][rank]}</span>
              ) : (
                <span className="text-slate-400 font-bold">#{rank}</span>
              );

              return (
                <li key={key}>
                  {/* Mobile card — tap expands; profile opens via the View Profile button */}
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : key)}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-slate-900/40 transition-colors lg:hidden"
                  >
                    <span className="font-mono text-slate-400 font-bold w-8 shrink-0">{rank <= 3 ? ['', '🥇', '🥈', '🥉'][rank] : `#${rank}`}</span>
                    <span className="font-bold text-white flex items-center gap-1 flex-1 min-w-0">
                      <span className="shrink-0">{countryFlag(entry.country)}</span>
                      <span>{entry.playerName}</span>
                    </span>
                    <span className="text-lg shrink-0" aria-label={entry.hofBadge || 'badge'}>{badgeIcon(entry.hofBadge)}</span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums shrink-0">{fmtChips(entry.chipsAtInduction)}c</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {/* Mobile expanded detail */}
                  {isExpanded && (
                    <div className="lg:hidden px-3 pb-3 pt-0">
                      <div className="border-t border-slate-800/50 pt-2 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="font-mono text-slate-500">{entry.playerTag}</span>
                          <span className="font-mono text-slate-500">{fmtDate(entry.inductedAt)}</span>
                        </div>
                        <div className="text-slate-300">{entry.title}</div>
                        <button type="button" onClick={handleInspect} title="View profile" className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white transition">
                          <Eye className="w-2.5 h-2.5" /> View Profile
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Desktop grid row */}
                  <div
                    className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px] hover:bg-slate-900/40 transition-colors cursor-pointer"
                    onClick={handleInspect}
                  >
                    <div className="lg:col-span-1 font-mono">{rankDisplay}</div>
                    <div className="lg:col-span-4 min-w-0">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span aria-hidden>{countryFlag(entry.country)}</span>
                        {entry.playerName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">{entry.playerTag}</div>
                    </div>
                    <div className="lg:col-span-2" aria-label={entry.hofBadge || 'badge'}>{badgeIcon(entry.hofBadge)}</div>
                    <div className="lg:col-span-3 min-w-0">
                      <div className="text-[11px] text-slate-300">{entry.title}</div>
                    </div>
                    <div className="lg:col-span-1 text-right font-mono font-bold text-emerald-400 tabular-nums">
                      {fmtChips(entry.chipsAtInduction)}c
                    </div>
                    <div className="lg:col-span-1 text-right font-mono text-slate-500">{fmtDate(entry.inductedAt)}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
