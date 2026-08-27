'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
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
  const [expanded, setExpanded] = useState<string | null>(null);

  const tierMap = useMemo(() => {
    const m: Record<string, (typeof HALL_OF_FAME_TIERS)[number]> = {};
    for (const t of HALL_OF_FAME_TIERS) m[t.id] = t;
    return m;
  }, []);

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
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 lg:p-3 text-center text-xs lg:text-[11px] text-slate-500">
        No players found matching &quot;{search}&quot;
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
      {isDemo && (
        <div className="px-4 lg:px-1.5 py-2 lg:py-1 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">DEMO</span>
          <span className="text-[11px] text-slate-500">No real milestone inductees yet. Showing sample data.</span>
        </div>
      )}
      {/* Desktop header */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
        <div className="lg:col-span-1">Rank</div>
        <div className="lg:col-span-3">Player</div>
        <div className="lg:col-span-3">Milestone Tier</div>
        <div className="lg:col-span-2 text-right">Chips</div>
        <div className="lg:col-span-2 text-right">Date</div>
        <div className="lg:col-span-1 text-right">Action</div>
      </div>
      <ol ref={listRef} className="divide-y divide-slate-900 max-h-[28rem] lg:max-h-[340px] overflow-y-auto va-scroll">
        {filtered.map((entry, idx) => {
          const tier = tierMap[entry.milestoneTierId || ''] ?? HALL_OF_FAME_TIERS[0];
          const rank = idx + 1;
          const isFirst = firstAchievers[entry.milestoneTierId || '']?.userTag === entry.playerTag;
          const isMe = myPlayerTag && entry.playerTag === myPlayerTag;
          const isExpanded = expanded === entry.id;

          const handleInspect = () => {
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
          };

          const rankDisplay = rank === 1 ? (
            <span className="text-yellow-400 font-bold">👑 #1</span>
          ) : rank <= 3 ? (
            <span>{['', '🥇', '🥈', '🥉'][rank]}</span>
          ) : (
            <span className="text-slate-400 font-bold">#{rank}</span>
          );

          return (
            <li
              key={entry.id}
              data-is-me={isMe ? 'true' : undefined}
              className={`${isDemo ? 'opacity-60' : ''} ${isMe && !isExpanded ? 'bg-yellow-500/10' : ''}`}
            >
              {/* Mobile card */}
              <button
                type="button"
                onClick={() => { setExpanded(isExpanded ? null : entry.id); handleInspect(); }}
                className={`w-full flex items-center gap-2 p-3 text-left transition-colors lg:hidden ${isExpanded ? 'bg-slate-900/60' : 'hover:bg-slate-900/40'}`}
              >
                <span className="font-mono text-slate-400 font-bold w-8 shrink-0">
                  {rank <= 3 ? ['', '🥇', '🥈', '🥉'][rank] : `#${rank}`}
                </span>
                <span className="shrink-0">{countryFlag(entry.country)}</span>
                <span className="font-bold text-white flex-1 min-w-0">{entry.playerName}</span>
                {isFirst && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                    <Check className="w-3 h-3" /> First!
                  </span>
                )}
                {isMe && (
                  <span className="text-[11px] font-mono font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/30 shrink-0">YOU</span>
                )}
                <span className="font-mono font-bold text-emerald-400 tabular-nums shrink-0">{fmtChips(entry.chipsAtInduction)}c</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {/* Mobile expanded detail */}
              {isExpanded && (
                <div className="lg:hidden px-3 pb-3 pt-0">
                  <div className="border-t border-slate-800/50 pt-2 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="font-mono text-slate-500">{entry.playerTag}{entry.clanTag ? ` [${entry.clanTag}]` : ''}</span>
                      <span className="font-mono text-slate-500">{fmtDate(entry.inductedAt)}</span>
                    </div>
                    <div className="text-slate-300">{tier.badge.split(' ')[0]} {tier.name}</div>
                    <div className="text-slate-500">{fmtChips(tier.chips)}c threshold</div>
                  </div>
                </div>
              )}

              {/* Desktop grid row */}
              <div
                className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px] hover:bg-slate-900/40 transition-colors cursor-pointer"
                onClick={handleInspect}
              >
                <div className="lg:col-span-1 font-mono">{rankDisplay}</div>
                <div className="lg:col-span-3 min-w-0">
                  <div className="font-bold text-white flex items-center gap-1">
                    <span aria-hidden>{countryFlag(entry.country)}</span>
                    {entry.playerName}
                    {isFirst && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                        <Check className="w-3 h-3" /> First!
                      </span>
                    )}
                    {isMe && (
                      <span className="text-[11px] font-mono font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/30 shrink-0">YOU</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {entry.playerTag}{entry.clanTag ? ` [${entry.clanTag}]` : ''}
                  </div>
                </div>
                <div className="lg:col-span-3 min-w-0">
                  <div className="text-[11px] text-slate-300 flex items-center gap-1">
                    <span>{tier.badge.split(' ')[0]}</span>
                    <span className="text-slate-400">{tier.name}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">{fmtChips(tier.chips)}c threshold</div>
                </div>
                <div className="lg:col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                  {fmtChips(entry.chipsAtInduction)}c
                </div>
                <div className="lg:col-span-2 text-right font-mono text-slate-500">
                  {fmtDate(entry.inductedAt)}
                </div>
                <div className="lg:col-span-1 text-right">
                  <span className="text-[11px] font-mono text-slate-500 hover:text-yellow-300 px-1.5 py-0.5 rounded border border-slate-800">Inspect</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
