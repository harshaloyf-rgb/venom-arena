'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { MicroLabel } from '../_panel-primitives';
import { notify, type ToastFn } from '../_panel-primitives';

interface CalendarDay {
  date: string;
  dayNum: number;
  claimed: boolean;
  isFuture: boolean;
}

interface CalendarTabProps {
  player: {
    dailyStreak: number;
    streakFreezes: number;
    referralCode?: string | null;
  };
  onToast?: ToastFn;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function CalendarTab({ player, onToast }: CalendarTabProps) {
  const [claimedDates, setClaimedDates] = useState<Set<string>>(new Set());
  const [calendarLoading, setCalendarLoading] = useState(true);

  // Current month info
  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  // Fetch real calendar data from API
  useEffect(() => {
    let cancelled = false;
    async function fetchCalendar() {
      setCalendarLoading(true);
      try {
        const res = await fetch('/api/player/claims/calendar');
        if (res.ok) {
          const { claimedDates: dates } = await res.json();
          if (!cancelled) setClaimedDates(new Set<string>(dates));
        }
      } catch { /* silent */ }
      if (!cancelled) setCalendarLoading(false);
    }
    fetchCalendar();
    return () => { cancelled = true; };
  }, []);

  // Build days array for current month
  const calendarDays: CalendarDay[] = useMemo(() => {
    const days: CalendarDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date: ds,
        dayNum: d,
        claimed: claimedDates.has(ds),
        isFuture: d > today,
      });
    }
    return days;
  }, [year, month, daysInMonth, today, claimedDates]);

  const claimedCount = calendarDays.filter(d => d.claimed && !d.isFuture).length;

  return (
    <div className="space-y-4 lg:space-y-1">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:p-1 text-[11px] text-slate-300 leading-relaxed">
        <strong>{MONTH_NAMES[month].toUpperCase()} {year} — CLAIM CALENDAR</strong><br />
        This month's daily claims. Green = claimed, dark = missed, dimmed = upcoming.
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
          <MicroLabel>This Month</MicroLabel>
          <div className="text-lg lg:text-sm font-mono font-black text-emerald-400 mt-1 lg:mt-0">{claimedCount}/{today}</div>
        </div>
      </div>

      {/* Monthly grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:p-1.5">
        {calendarLoading ? (
          <div className="flex items-center justify-center py-6 text-[11px] text-slate-500">Loading calendar...</div>
        ) : (
          <div className="grid grid-cols-7 gap-x-1 gap-y-0.5 lg:gap-x-px lg:gap-y-px">
            {calendarDays.map((d) => (
              <div key={d.date} className="flex flex-col items-center">
                <div
                  className={`w-full h-4 lg:h-3 rounded-sm transition-colors flex items-center justify-center text-[9px] lg:text-[8px] font-mono font-bold ${
                    d.claimed ? 'bg-emerald-500 text-white' :
                    d.isFuture ? 'bg-slate-900/40 text-slate-600' :
                    'bg-slate-800/60 text-slate-500'
                  }`}
                >
                  {d.dayNum}
                </div>
                <span className="text-[7px] lg:text-[6px] font-mono text-slate-500 mt-px leading-none whitespace-nowrap">{MONTH_NAMES[month].slice(0,3)} {d.dayNum}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 mt-3 lg:mt-1 justify-end">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-emerald-500" /><span className="text-[11px] text-slate-500">Claimed</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-800" /><span className="text-[11px] text-slate-500">Missed</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-900/40" /><span className="text-[11px] text-slate-500">Upcoming</span></div>
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
