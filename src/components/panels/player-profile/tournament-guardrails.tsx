'use client';

import { Shield, Swords } from 'lucide-react';
import { CapCard } from './stat-card';

// Shows ONLY the Matches Allowed card.
// 2026-09-05: Annual Buy Cap + Rewarded Ads Today cards removed by user decision —
// the buy cap counted the retired real-money chip packs (always 0 now, and the
// wording implied chips were purchasable), and the daily ad cap is an internal
// anti-abuse limit the Bonus tab already surfaces contextually when it matters.
interface TournamentStats {
  matchesPlayed: number;
  matchesMax: number;
}

export type { TournamentStats };

export function TournamentGuardrailsSection({
  tournamentStats,
  tournamentLoading,
}: {
  tournamentStats: TournamentStats | null;
  tournamentLoading: boolean;
}) {
  if (tournamentLoading) {
    return (
      <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 lg:p-1.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3 lg:pb-0.5 mb-4 lg:mb-0.5">
          <div className="h-4 lg:h-3 w-48 lg:w-28 bg-slate-800 rounded animate-pulse" />
          <div className="h-5 lg:h-3.5 w-36 lg:w-20 bg-amber-500/10 rounded-full animate-pulse" />
        </div>
        <div className="h-12 lg:h-8 bg-slate-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  const matchesPlayed = tournamentStats?.matchesPlayed ?? 0;
  const matchesMax = tournamentStats?.matchesMax ?? 10000;

  const matchPct = matchesMax > 0 ? (matchesPlayed / matchesMax) * 100 : 0;

  return (
    <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 lg:p-1.5 shadow-xl space-y-4 lg:space-y-0.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-3 lg:pb-0.5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 lg:w-3 lg:h-3 text-amber-400" />
          <h3 className="text-sm lg:text-[11px] lg:leading-tight font-bold text-white uppercase tracking-wider font-sans">
            Tournament Guardrails &amp; Limits
          </h3>
        </div>
        <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 lg:px-2 py-1 lg:py-0.5 rounded-full border border-amber-500/20">
          1-YEAR CYCLE ACTIVE
        </span>
      </div>

      <div>
        <CapCard
          icon={<Swords className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-indigo-400" />}
          label="Matches Allowed"
          value={`${matchesPlayed.toLocaleString()} / ${matchesMax.toLocaleString()}`}
          barClass="from-indigo-500 to-purple-500"
          pct={matchPct}
          leftLabel={`Completed: ${matchesPlayed.toLocaleString()}`}
          rightLabel={`Remaining: ${(matchesMax - matchesPlayed).toLocaleString()}`}
          rightClass="text-emerald-400 font-bold"
        />
      </div>
    </div>
  );
}
