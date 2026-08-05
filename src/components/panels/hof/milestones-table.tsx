'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { HALL_OF_FAME_TIERS, countryFlag, fmtChips, fmtDate } from './_types';
import type { InducteeEntry } from './_types';
import type { InspectedPlayer } from '@/lib/game-config';

// ── Milestones Flat Table (single table, like Champions Wing) ─────

interface MilestonesFlatTableProps {
  entries: InducteeEntry[];
  tierFilter: string;
  search: string;
  isDemo?: boolean;
  firstAchievers: Record<string, { playerName: string; userTag: string; country: string; inductedAt: string } | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  myPlayerTag: string | null;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

export function MilestonesFlatTable({ entries, tierFilter, search, isDemo, firstAchievers, listRef, myPlayerTag, onInspectPlayer }: MilestonesFlatTableProps) {
  // Build a tier lookup map
  const tierMap = useMemo(() => {
    const m: Record<string, (typeof HALL_OF_FAME_TIERS)[number]> = {};
    for (const t of HALL_OF_FAME_TIERS) m[t.id] = t;
    return m;
  }, []);

  // Filter by search + tier
  const filtered = useMemo(() => {
    let result = entries;
    if (tierFilter !== 'all') {
      result = result.filter((e) => e.milestoneTierId === tierFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.playerName.toLowerCase().includes(q) ||
        e.playerTag.toLowerCase().includes(q) ||
        (e.clanTag && e.clanTag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, tierFilter, search]);

  if (filtered.length === 0 && search.trim()) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center text-xs text-slate-500">
        No players found matching &quot;{search}&quot;
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
      {isDemo && (
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">DEMO</span>
          <span className="text-[10px] text-slate-500">No real milestone inductees yet. Showing sample data.</span>
        </div>
      )}
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
        <div className="col-span-1">Rank</div>
        <div className="col-span-3">Player</div>
        <div className="col-span-3">Milestone Tier</div>
        <div className="col-span-2 text-right">Chips</div>
        <div className="col-span-2 text-right">Date</div>
        <div className="col-span-1 text-right">Action</div>
      </div>
      <ol ref={listRef} className="divide-y divide-slate-900 max-h-[28rem] overflow-y-auto va-scroll">
        {filtered.map((entry, idx) => {
  const tier = tierMap[entry.milestoneTierId || ''] ?? HALL_OF_FAME_TIERS[0];
  const rank = idx + 1;
  const isFirst = firstAchievers[entry.milestoneTierId || '']?.userTag === entry.playerTag;
  const isMe = myPlayerTag && entry.playerTag === myPlayerTag;
  return (
    <li
      key={entry.id}
      data-is-me={isMe ? 'true' : undefined}
      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm hover:bg-slate-900/40 transition-colors cursor-pointer ${isDemo ? 'opacity-60' : ''} ${isMe ? 'bg-yellow-500/10' : ''}`}
      onClick={() => {
        if (!onInspectPlayer) return;
        onInspectPlayer({
          name: entry.playerName,
          userTag: entry.playerTag,
          country: entry.country,
          flag: countryFlag(entry.country),
          bankedChips: entry.chipsAtInduction,
          level: entry.level,
          clanTag: entry.clanTag || undefined,
          achievedAt: fmtDate(entry.inductedAt),
        });
      }}
    >
      {/* Rank */}
      <div className="col-span-1 font-mono">
        {rank === 1 ? (
          <span className="text-yellow-400 font-bold">👑 #1</span>
        ) : rank <= 3 ? (
          <span className="text-lg">{['', '🥇', '🥈', '🥉'][rank]}</span>
        ) : (
          <span className="text-slate-400 font-bold">#{rank}</span>
        )}
      </div>
      {/* Player */}
      <div className="col-span-3 min-w-0">
        <div className="font-bold text-white truncate flex items-center gap-1.5">
          <span aria-hidden>{countryFlag(entry.country)}</span>
          {entry.playerName}
          {isFirst && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
              <Check className="w-2.5 h-2.5" /> First!
            </span>
          )}
          {isMe && (
            <span className="text-[9px] font-mono font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/30 shrink-0">YOU</span>
          )}
        </div>
        <div className="text-[10px] font-mono text-slate-500 truncate">
          {entry.playerTag}{entry.clanTag ? ` [${entry.clanTag}]` : ''}
        </div>
      </div>
      {/* Tier */}
      <div className="col-span-3 min-w-0">
        <div className="text-[11px] text-slate-300 truncate flex items-center gap-1">
          <span>{tier.badge.split(' ')[0]}</span>
          <span className="text-slate-400">{tier.name}</span>
        </div>
        <div className="text-[10px] font-mono text-slate-500">{fmtChips(tier.chips)}c threshold</div>
      </div>
      {/* Chips */}
      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums text-[11px]">
        {fmtChips(entry.chipsAtInduction)}c
      </div>
      {/* Date */}
      <div className="col-span-2 text-right text-[10px] font-mono text-slate-500">
        {fmtDate(entry.inductedAt)}
      </div>
      {/* Inspect */}
      <div className="col-span-1 text-right">
        <span className="text-[9px] font-mono text-slate-500 hover:text-yellow-300 px-1.5 py-0.5 rounded border border-slate-800">Inspect</span>
      </div>
    </li>
  );
})}
      </ol>
    </div>
  );
}
