'use client';

import { Loader2, Zap, Star } from 'lucide-react';
import { fmtChipsIndian as fmtChips } from '@/lib/format-chips';
import { SPIN_PRIZES, SPIN_COST } from '@/lib/game-config';

interface SpinTabProps {
  spinning: boolean;
  spinResult: { reward: number; tier: string; label: string } | null;
  freeSpinsToday: number;
  playerBankedChips: number;
  onSpin: (useFree: boolean) => void;
}

export function SpinTab({ spinning, spinResult, freeSpinsToday, playerBankedChips, onSpin }: SpinTabProps) {
  return (
    <div className="space-y-4 lg:space-y-1">
      <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 lg:p-1 text-[11px] text-amber-200 leading-relaxed">
        <strong>LUCKY SPIN WHEEL</strong><br />
        1 free spin per day, or pay {fmtChips(SPIN_COST)}c for extra spins. Prizes range from 5c to 5,000c jackpot!
      </div>

      {/* Prize Table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-1">
        {SPIN_PRIZES.map((p, i) => (
          <div key={i} className={`bg-gradient-to-br ${p.color} rounded-xl p-3 lg:p-1.5 text-center border border-white/10`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">{p.tier}</div>
            <div className="text-sm lg:text-[11px] font-bold font-mono text-white mt-1 lg:mt-0">{p.label}</div>
          </div>
        ))}
      </div>

      {/* Spin Result */}
      {spinResult && (
        <div className={`rounded-2xl border p-4 lg:p-1.5 text-center ${
          spinResult.tier === 'legendary' ? 'border-yellow-500/40 bg-yellow-950/20' :
          spinResult.tier === 'epic' ? 'border-amber-500/40 bg-amber-950/20' :
          spinResult.tier === 'rare' ? 'border-violet-500/40 bg-violet-950/20' :
          'border-slate-700 bg-slate-950/40'
        }`}>
          <div className={`text-3xl lg:text-xl font-black font-mono ${
            spinResult.tier === 'legendary' ? 'text-yellow-400' :
            spinResult.tier === 'epic' ? 'text-amber-400' :
            spinResult.tier === 'rare' ? 'text-violet-400' :
            'text-white'
          }`}>
            +{fmtChips(spinResult.reward)}c
          </div>
          <div className="text-xs lg:text-[11px] text-slate-300 mt-1 lg:mt-0 uppercase tracking-wider">{spinResult.tier} — {spinResult.label}</div>
        </div>
      )}

      {/* Spin Buttons */}
      <div className="flex items-center justify-center gap-3 lg:gap-1">
        <button type="button" onClick={() => onSpin(true)} disabled={spinning || freeSpinsToday <= 0}
          className={`inline-flex items-center gap-2 lg:gap-1 px-6 py-3 lg:px-2 lg:py-1 font-bold rounded-xl text-sm lg:text-[11px] uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
            freeSpinsToday > 0
              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 shadow-amber-950/40'
              : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
          }`}>
          {spinning ? <Loader2 className="w-5 h-5 lg:w-3 lg:h-3 animate-spin" /> : <Zap className="w-5 h-5 lg:w-3 lg:h-3" />}
          Free Spin ({freeSpinsToday} left)
        </button>
        <button type="button" onClick={() => onSpin(false)} disabled={spinning || playerBankedChips < SPIN_COST}
          className="inline-flex items-center gap-2 lg:gap-1 px-6 py-3 lg:px-2 lg:py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl text-sm lg:text-[11px] uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {spinning ? <Loader2 className="w-5 h-5 lg:w-3 lg:h-3 animate-spin" /> : <Star className="w-5 h-5 lg:w-3 lg:h-3" />}
          Pay {fmtChips(SPIN_COST)}c
        </button>
      </div>
    </div>
  );
}
