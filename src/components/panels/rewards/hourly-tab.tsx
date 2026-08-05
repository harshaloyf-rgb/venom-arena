'use client';

import { Clock, Gift, Loader2 } from 'lucide-react';
import { HOURLY_REWARD_MIN, HOURLY_REWARD_MAX } from '@/lib/game-config';

interface HourlyTabProps {
  hourlyCanClaim: boolean;
  hourlyTimeLeft: number;
  hourlyBusy: boolean;
  onHourlyClaim: () => void;
}

function timeLabel(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function HourlyTab({ hourlyCanClaim, hourlyTimeLeft, hourlyBusy, onHourlyClaim }: HourlyTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4 text-[11px] text-cyan-200 leading-relaxed">
        <strong>HOURLY MICRO-CLAIMS</strong><br />
        Claim {HOURLY_REWARD_MIN}–{HOURLY_REWARD_MAX} chips every hour. Small but steady — keeps your wallet alive between matches!
      </div>

      <div className="bg-slate-950/40 rounded-2xl border border-slate-800 p-6 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-center">
          <Clock className={`w-8 h-8 ${hourlyCanClaim ? 'text-cyan-400' : 'text-slate-500'}`} />
        </div>
        {hourlyCanClaim ? (
          <>
            <p className="text-sm text-cyan-300 font-bold">Micro-claim is ready!</p>
            <button type="button" onClick={onHourlyClaim} disabled={hourlyBusy}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-sm uppercase tracking-wider transition-all shadow-lg shadow-cyan-950/40 disabled:opacity-50">
              {hourlyBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />} Claim {HOURLY_REWARD_MIN}–{HOURLY_REWARD_MAX}c
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">Next claim in:</p>
            <span className="text-3xl font-mono font-black text-white tabular-nums">{timeLabel(hourlyTimeLeft)}</span>
            <button type="button" disabled className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 text-slate-500 font-bold rounded-xl text-sm uppercase tracking-wider cursor-not-allowed">
              <Clock className="w-5 h-5" /> Cooling Down
            </button>
          </>
        )}
      </div>
    </div>
  );
}
