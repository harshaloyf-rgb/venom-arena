'use client';

import { Shield, Swords, Landmark, Trophy } from 'lucide-react';
import { PanelSkeleton } from '../_panel-primitives';
import { CapCard } from './stat-card';

interface TournamentStats {
  matchesPlayed: number;
  matchesMax: number;
  totalBought: number;
  annualBuyCap: number;
  adsToday: number;
  adsMax: number;
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
      <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
        <PanelSkeleton count={3} height="h-24" />
      </div>
    );
  }

  const matchesPlayed = tournamentStats?.matchesPlayed ?? 0;
  const matchesMax = tournamentStats?.matchesMax ?? 10000;
  const totalBought = tournamentStats?.totalBought ?? 0;
  const annualBuyCap = tournamentStats?.annualBuyCap ?? 2500000;
  const adsToday = tournamentStats?.adsToday ?? 0;
  const adsMax = tournamentStats?.adsMax ?? 12;

  const matchPct = matchesMax > 0 ? (matchesPlayed / matchesMax) * 100 : 0;
  const buyPct = annualBuyCap > 0 ? (totalBought / annualBuyCap) * 100 : 0;
  const adsPct = adsMax > 0 ? (adsToday / adsMax) * 100 : 0;

  return (
    <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
            Annual Tournament Guardrails &amp; Limit Allowances
          </h3>
        </div>
        <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
          1-YEAR UTC TOURNAMENT CYCLE ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CapCard
          icon={<Swords className="w-3.5 h-3.5 text-indigo-400" />}
          label="Matches Allowed"
          value={`${matchesPlayed.toLocaleString()} / ${matchesMax.toLocaleString()}`}
          barClass="from-indigo-500 to-purple-500"
          pct={matchPct}
          leftLabel={`Completed: ${matchesPlayed.toLocaleString()}`}
          rightLabel={`Remaining: ${(matchesMax - matchesPlayed).toLocaleString()} matches`}
          rightClass="text-emerald-400 font-bold"
        />
        <CapCard
          icon={<Landmark className="w-3.5 h-3.5 text-emerald-400" />}
          label="Annual Buy Cap (25L)"
          value={`${totalBought.toLocaleString()} / ${annualBuyCap.toLocaleString()} c`}
          barClass="from-emerald-500 to-teal-400"
          pct={buyPct}
          leftLabel={`Bought: ${totalBought.toLocaleString()} c`}
          rightLabel={`Cap Remaining: ${(annualBuyCap - totalBought).toLocaleString()} c`}
          rightClass="text-emerald-400 font-bold"
        />
        <CapCard
          icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />}
          label="Rewarded Ads Today"
          value={`${adsToday} / ${adsMax} Ads`}
          barClass="from-amber-500 to-yellow-400"
          pct={adsPct}
          leftLabel={`Watched: ${adsToday}`}
          rightLabel="Resets at 00:00 UTC"
          rightClass="text-amber-400 font-bold"
        />
      </div>
    </div>
  );
}
