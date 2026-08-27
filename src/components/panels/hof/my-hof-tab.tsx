'use client';

import { useState } from 'react';
import { Check, Loader2, Sparkles, Trophy, Award, Target, ChevronDown } from 'lucide-react';
import { HALL_OF_FAME_TIERS, fmtChips, fmtDate, badgeIcon } from './_types';
import { MicroLabel } from '../_panel-primitives';
import type { MyEntry, NextMilestone } from './_types';

// ── My HOF Profile Tab ─────────────────────────────────────────────────────

interface MyHofTabProps {
  loading: boolean;
  error: boolean;
  totalEntries: number;
  currentChips: number;
  milestoneEntries: MyEntry[];
  championshipEntries: MyEntry[];
  nextMilestone: NextMilestone | null;
}

export function MyHofTab({
  loading,
  error,
  totalEntries,
  currentChips,
  milestoneEntries,
  championshipEntries,
  nextMilestone,
}: MyHofTabProps) {
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 lg:py-3">
        <Loader2 className="w-6 h-6 lg:w-3 lg:h-3 text-yellow-400 animate-spin" />
        <span className="ml-2 text-xs lg:text-[11px] text-slate-400">Loading your HOF profile…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 lg:py-3">
        <p className="text-sm lg:text-[11px] text-slate-500">Could not load your HOF profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-1">
      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-1">
        <div className="p-4 lg:p-1.5 rounded-xl border border-yellow-500/20 bg-yellow-950/10">
          <MicroLabel className="lg:text-[11px]">Your HOF Inductions</MicroLabel>
          <div className="text-2xl lg:text-[11px] font-mono font-black text-yellow-400 mt-1">{totalEntries}</div>
        </div>
        <div className="p-4 lg:p-1.5 rounded-xl border border-emerald-500/20 bg-emerald-950/10">
          <MicroLabel className="lg:text-[11px]">Current Banked Chips</MicroLabel>
          <div className="text-2xl lg:text-[11px] font-mono font-black text-emerald-400 mt-1">{fmtChips(currentChips)}c</div>
        </div>
      </div>

      {/* Next milestone card */}
      {nextMilestone && (
        <div className="p-4 lg:p-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/10 flex items-center gap-4 lg:gap-1">
          <div className="w-12 h-12 lg:w-5 lg:h-5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl lg:text-[11px] shrink-0">
            <Target className="w-6 h-6 lg:w-3 lg:h-3 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <MicroLabel className="lg:text-[11px]">Next Milestone Target</MicroLabel>
            <div className="text-sm lg:text-[11px] font-bold text-white mt-0.5">{nextMilestone.name}</div>
            <div className="text-[11px] font-mono text-cyan-300 mt-0.5">{nextMilestone.badge}</div>
          </div>
          <div className="text-right shrink-0">
            <MicroLabel className="lg:text-[11px]">Chips Needed</MicroLabel>
            <div className="text-lg lg:text-[11px] font-mono font-black text-cyan-400 mt-1">{fmtChips(nextMilestone.chipsNeeded)}c</div>
          </div>
        </div>
      )}

      {/* Milestone entries */}
      {milestoneEntries.length > 0 && (
        <div>
          <h3 className="text-sm lg:text-[11px] font-bold text-white mb-2 lg:mb-0.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 lg:w-3 lg:h-3 text-yellow-400" /> Milestone Inductions
          </h3>
          <div className="space-y-2 lg:space-y-0.5 max-h-48 lg:max-h-32 overflow-y-auto va-scroll">
            {milestoneEntries.map((e) => {
              const tier = HALL_OF_FAME_TIERS.find((t) => t.id === e.milestoneTierId);
              const isExpanded = expandedEntry === `m-${e.id}`;
              return (
                <div
                  key={e.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80"
                >
                  {/* Mobile card */}
                  <button
                    type="button"
                    onClick={() => setExpandedEntry(isExpanded ? null : `m-${e.id}`)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <span className="text-xl shrink-0" aria-hidden>{tier?.badge.split(' ')[0] || '🏅'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white">{e.title || tier?.name || 'Milestone'}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {fmtChips(e.chipsAtInduction)}c · {fmtDate(e.inductedAt)}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                      <Check className="w-3 h-3 inline" /> Inducted
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 lg:hidden ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {/* Desktop row */}
                  <div className="hidden lg:flex lg:contents">
                    <div className="lg:flex lg:items-center lg:gap-1 lg:p-1.5 lg:w-full">
                      <span className="text-[11px] shrink-0" aria-hidden>{tier?.badge.split(' ')[0] || '🏅'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-white">{e.title || tier?.name || 'Milestone'}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {fmtChips(e.chipsAtInduction)}c · {fmtDate(e.inductedAt)}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                        <Check className="w-3 h-3 inline" /> Inducted
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Championship entries */}
      {championshipEntries.length > 0 && (
        <div>
          <h3 className="text-sm lg:text-[11px] font-bold text-white mb-2 lg:mb-0.5 flex items-center gap-2">
            <Trophy className="w-4 h-4 lg:w-3 lg:h-3 text-amber-400" /> Championship Inductions
          </h3>
          <div className="space-y-2 lg:space-y-0.5 max-h-48 lg:max-h-32 overflow-y-auto va-scroll">
            {championshipEntries.map((e) => {
              const isExpanded = expandedEntry === `c-${e.id}`;
              return (
                <div
                  key={e.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80"
                >
                  {/* Mobile card */}
                  <button
                    type="button"
                    onClick={() => setExpandedEntry(isExpanded ? null : `c-${e.id}`)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <span className="text-xl shrink-0" aria-hidden>{badgeIcon(e.hofBadge)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white">{e.title || `Championship ${e.championshipYear || ''}`}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Rank #{e.championshipRank ?? '?'} · {e.championshipYear || '?'} · {fmtChips(e.chipsAtInduction)}c
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                      <Check className="w-3 h-3 inline" /> Inducted
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 lg:hidden ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {/* Desktop row */}
                  <div className="hidden lg:flex lg:contents">
                    <div className="lg:flex lg:items-center lg:gap-1 lg:p-1.5 lg:w-full">
                      <span className="text-[11px] shrink-0" aria-hidden>{badgeIcon(e.hofBadge)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-white">{e.title || `Championship ${e.championshipYear || ''}`}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Rank #{e.championshipRank ?? '?'} · {e.championshipYear || '?'} · {fmtChips(e.chipsAtInduction)}c
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                        <Check className="w-3 h-3 inline" /> Inducted
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No entries yet */}
      {milestoneEntries.length === 0 && championshipEntries.length === 0 && !nextMilestone && (
        <div className="text-center py-12 lg:py-3 px-4">
          <Award className="w-10 h-10 lg:w-5 lg:h-5 text-slate-600 mx-auto mb-3 lg:mb-0.5" />
          <p className="text-sm lg:text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
            You haven&apos;t been inducted yet. Keep playing and banking chips to reach milestone thresholds or finish in the top 100 of the Annual Championship!
          </p>
        </div>
      )}
    </div>
  );
}
