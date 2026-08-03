'use client';

import { TrendingUp, Crosshair, Skull, Zap } from 'lucide-react';
import { MicroLabel, PanelSkeleton } from '../_panel-primitives';
import type { ClanStats } from './_types';

interface ClanStatsViewProps {
  clanStats: ClanStats | null;
  statsLoading: boolean;
}

export function ClanStatsView({ clanStats, statsLoading }: ClanStatsViewProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
        <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-indigo-400" /><h4 className="text-sm font-bold text-white">Syndicate Combat Statistics</h4></div>
        <p className="text-[11px] text-slate-400">Aggregate combat stats across all clan members.</p>
      </div>
      {statsLoading ? <PanelSkeleton count={2} height="h-48" /> : clanStats ? (
        <div className="space-y-3">
          {/* Combat Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Kills', value: clanStats.totalKills.toLocaleString(), icon: Crosshair, color: 'text-rose-400' },
              { label: 'Total Deaths', value: clanStats.totalDeaths.toLocaleString(), icon: Skull, color: 'text-slate-400' },
              { label: 'K/D Ratio', value: clanStats.kdRatio, icon: TrendingUp, color: 'text-amber-400' },
              { label: 'Total Extracts', value: clanStats.totalExtracts.toLocaleString(), icon: Zap, color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-1.5 mb-1"><s.icon className={`w-3 h-3 ${s.color}`} /><MicroLabel>{s.label.toUpperCase()}</MicroLabel></div>
                <div className={`text-lg font-mono font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
          {/* Wealth & Level Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Combined Wealth', value: `${(clanStats.totalChips / 1000).toFixed(1)}K c`, color: 'text-emerald-400' },
              { label: 'Total Earned', value: `${(clanStats.totalEarned / 1000).toFixed(1)}K c`, color: 'text-emerald-300' },
              { label: 'Highest Level', value: `Lvl ${clanStats.highestLevel}`, color: 'text-amber-400' },
              { label: 'Best Streak', value: clanStats.bestStreak.toLocaleString(), color: 'text-amber-300' },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <MicroLabel>{s.label.toUpperCase()}</MicroLabel>
                <div className={`text-sm font-mono font-bold mt-0.5 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
          {/* Member Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
              <MicroLabel>TOTAL MEMBERS</MicroLabel>
              <div className="text-white text-sm font-bold mt-0.5">{clanStats.totalMembers}</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
              <MicroLabel>AVG LEVEL</MicroLabel>
              <div className="text-white text-sm font-bold mt-0.5">{clanStats.avgLevel}</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
              <MicroLabel>RICHEST MEMBER</MicroLabel>
              <div className="text-emerald-400 text-sm font-bold mt-0.5">{clanStats.richestChips.toLocaleString()}c</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-slate-500"><TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />Stats will load when your clan has members.</div>
      )}
    </div>
  );
}
