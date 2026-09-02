'use client';

import { Loader2, Search, X, Crosshair } from 'lucide-react';
import { HALL_OF_FAME_TIERS } from './_types';
import { notify, type ToastFn } from '../_panel-primitives';
import { MilestonesFlatTable } from './milestones-table';
import type { InducteeEntry } from './_types';
import type { InspectedPlayer } from '@/lib/game-config';

// ── Milestones Wing Tab ──────────────────────────────────────────────────

interface MilestonesTabProps {
  loading: boolean;
  tierFilter: string;
  search: string;
  entries: InducteeEntry[];
  firstAchievers: Record<string, { playerName: string; userTag: string; country: string; inductedAt: string } | null>;
  listRef: React.RefObject<HTMLOListElement | null>;
  myPlayerTag: string | null;
  onToast?: ToastFn;
  onTierFilterChange: (filter: string) => void;
  onSearchChange: (search: string) => void;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

export function MilestonesTab({
  loading,
  tierFilter,
  search,
  entries,
  firstAchievers,
  listRef,
  myPlayerTag,
  onToast,
  onTierFilterChange,
  onSearchChange,
  onInspectPlayer,
}: MilestonesTabProps) {
  return (
    <div className="space-y-4 lg:space-y-1">
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/10 p-3 lg:p-1.5 text-[11px] text-yellow-200 leading-relaxed">
        <strong>PERMANENT MILESTONE IMMORTALITY</strong>
        <br />
        Every player who crosses a milestone threshold gets permanently inducted.
        Players are ranked by <strong>induction order</strong> — #1 is the first to achieve that tier.
      </div>

      {/* Search + Find Me toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:gap-1">
        <div className="flex items-center gap-2 lg:gap-1 flex-1 p-1.5 lg:p-1 rounded-xl border border-slate-800 bg-slate-950/80">
          <Search className="w-4 h-4 lg:w-3 lg:h-3 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by player name, tag, or clan…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs lg:text-[11px] text-white font-mono placeholder:text-slate-600 focus:outline-none"
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
        <button
          type="button"
          onClick={() => {
            const myRow = listRef.current?.querySelector('[data-is-me="true"]');
            if (myRow) {
              myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
              myRow.classList.add('ring-2', 'ring-yellow-400/60');
              setTimeout(() => myRow.classList.remove('ring-2', 'ring-yellow-400/60'), 2000);
              notify('Found you in the milestones list!', 'success', onToast);
            } else {
              notify('You are not yet inducted into any milestone. Keep banking chips!', 'info', onToast);
            }
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition border bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25 shrink-0"
        >
          <Crosshair className="w-3 h-3" /> Find Me
        </button>
      </div>

      {/* Tier filter */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-1">
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Filter:</span>
        <button
          type="button"
          onClick={() => onTierFilterChange('all')}
          className={`px-2.5 lg:px-1.5 py-1 rounded-full text-[11px] font-bold font-mono transition border ${tierFilter === 'all' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
        >
          All Tiers
        </button>
        {HALL_OF_FAME_TIERS.map((t) => {
          const shortLabel = t.name
            .replace(' (10,000,000) LEGENDARY', '')
            .replace(' (1 MILLION)', '')
            .replace(' CHIPS MILESTONE', '');
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTierFilterChange(t.id)}
              className={`px-2.5 lg:px-1.5 py-1 rounded-full text-[11px] font-bold font-mono transition border whitespace-nowrap ${tierFilter === t.id ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
            >
              {t.badge.split(' ')[0]} {shortLabel}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 lg:py-3">
          <Loader2 className="w-5 h-5 lg:w-3 lg:h-3 text-yellow-400 animate-spin" />
          <span className="ml-2 text-xs lg:text-[11px] text-slate-400">Loading milestones…</span>
        </div>
      )}

      {/* Real data */}
      {!loading && entries.length > 0 && (
        <MilestonesFlatTable
          entries={entries}
          tierFilter={tierFilter}
          search={search}
          firstAchievers={firstAchievers}
          listRef={listRef}
          myPlayerTag={myPlayerTag}
          onInspectPlayer={onInspectPlayer}
        />
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 lg:p-3 text-center text-xs lg:text-[11px] text-slate-500">
          No milestone inductees yet
        </div>
      )}
    </div>
  );
}
