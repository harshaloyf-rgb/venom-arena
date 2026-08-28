'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { MicroLabel } from '../_panel-primitives';
import { notify, type ToastFn } from '../_panel-primitives';

interface CalendarDay {
  date: string;
  claimed: boolean;
}

interface CalendarTabProps {
  player: {
    dailyStreak: number;
    streakFreezes: number;
    referralCode?: string | null;
  };
  onToast?: ToastFn;
}

export function CalendarTab({ player, onToast }: CalendarTabProps) {
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  // Fetch real calendar data from API
  useEffect(() => {
    let cancelled = false;
    async function fetchCalendar() {
      setCalendarLoading(true);
      try {
        const res = await fetch('/api/player/claims/calendar');
        if (res.ok) {
          const { claimedDates } = await res.json();
          const claimedSet = new Set<string>(claimedDates);
          const DAY_MS = 86_400_000;
          const days: CalendarDay[] = [];
          for (let i = 89; i >= 0; i--) {
            const d = new Date(Date.now() - i * DAY_MS);
            const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            days.push({ date: ds, claimed: claimedSet.has(ds) });
          }
          if (!cancelled) setCalendarDays(days);
        }
      } catch { /* silent */ }
      if (!cancelled) setCalendarLoading(false);
    }
    fetchCalendar();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4 lg:space-y-1">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:p-1 text-[11px] text-slate-300 leading-relaxed">
        <strong>CLAIM CALENDAR</strong><br />
        Your last 90 days of daily claims. Green = claimed, dark = missed.
        Keep the grid lit to maintain your streak!
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 lg:gap-1">
        <div className="text-center p-3 lg:p-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <MicroLabel>Current Streak</MicroLabel>
          <div className="text-lg lg:text-sm font-mono font-black text-amber-400 mt-1 lg:mt-0">{player.dailyStreak}d</div>
        </div>
        <div className="text-center p-3 lg:p-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <MicroLabel>Freezes Held</MicroLabel>
          <div className="text-lg lg:text-sm font-mono font-black text-sky-400 mt-1 lg:mt-0">{player.streakFreezes}</div>
        </div>
        <div className="text-center p-3 lg:p-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <MicroLabel>Next Milestone</MicroLabel>
          <div className="text-lg lg:text-sm font-mono font-black text-emerald-400 mt-1 lg:mt-0">
            {player.dailyStreak < 30 ? `${30 - player.dailyStreak}d` : player.dailyStreak < 60 ? `${60 - player.dailyStreak}d` : player.dailyStreak < 90 ? `${90 - player.dailyStreak}d` : '✅'}
          </div>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:p-1.5 overflow-x-auto">
        {calendarLoading ? (
          <div className="flex items-center justify-center py-6 text-[11px] text-slate-500">Loading calendar...</div>
        ) : (
          <div className="grid grid-cols-10 sm:grid-cols-[repeat(15,minmax(0,1fr))] gap-1 lg:gap-px">
            {calendarDays.map((d, i) => (
              <div
                key={d.date}
                title={`${d.date}${d.claimed ? ' ✓ Claimed' : ''}`}
                className={`aspect-square lg:aspect-auto lg:h-3.5 rounded-sm transition-colors ${
                  d.claimed ? 'bg-emerald-500' :
                  i < 7 ? 'bg-slate-700' : 'bg-slate-800/60'
                } hover:ring-1 hover:ring-slate-500`}
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3 lg:mt-1 justify-end">
          <span className="text-[11px] text-slate-500">Less</span>
          <div className="w-3 h-3 rounded-sm bg-slate-800" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-[11px] text-slate-500">More</span>
        </div>
      </div>

      {/* Referral section */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4 lg:p-1.5">
        <div className="flex items-center gap-2 lg:gap-1 mb-2 lg:mb-1">
          <Users className="w-4 h-4 lg:w-3 lg:h-3 text-violet-400" />
          <span className="text-xs lg:text-[11px] font-bold text-white">Refer & Earn</span>
        </div>
        <p className="text-[11px] text-slate-400 mb-3 lg:mb-1">
          Share your referral code. When your friend plays 5 matches, you both get <span className="text-emerald-400 font-bold">2,500c</span>!
        </p>
        {player.referralCode ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 lg:px-1.5 lg:py-1 text-sm lg:text-[11px] font-mono font-bold text-violet-300 select-all">
              {player.referralCode}
            </code>
            <button type="button" onClick={() => { navigator.clipboard.writeText(player.referralCode!); notify('Referral code copied!', 'success', onToast); }}
              className="px-3 py-2 lg:px-1.5 lg:py-1 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg text-xs lg:text-[11px] uppercase tracking-wider transition">
              Copy
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Generating your referral code...</p>
        )}
      </div>
    </div>
  );
}
