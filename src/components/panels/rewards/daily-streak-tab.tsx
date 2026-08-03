'use client';

import { Check, Calendar, Flame, Loader2, Sparkles, Shield, Snowflake } from 'lucide-react';
import { fmtChipsIndian as fmtChips } from '@/lib/format-chips';
import { DAILY_REWARDS, STREAK_MILESTONES, STREAK_FREEZE_COST, STREAK_FREEZE_MAX } from '@/lib/game-config';
import { MicroLabel } from '../_panel-primitives';

interface DailyStreakTabProps {
  player: {
    dailyStreak: number;
    streakFreezes: number;
    bankedChips: number;
    lastDailyClaim: string | null;
    referralCode?: string | null;
  };
  alreadyClaimed: boolean;
  currentDayIndex: number;
  claimedCount: number;
  dailyBusy: boolean;
  adBusy: boolean;
  freezeBusy: boolean;
  nextDailyTime: number;
  claimedMilestones: Set<number>;
  onDailyClaim: () => void;
  onWatchAd: () => void;
  onBuyFreeze: () => void;
}

export function DailyStreakTab({
  player, alreadyClaimed, currentDayIndex, claimedCount,
  dailyBusy, adBusy, freezeBusy, nextDailyTime,
  claimedMilestones, onDailyClaim, onWatchAd, onBuyFreeze,
}: DailyStreakTabProps) {
  return (
    <div className="space-y-4">
      {/* 7-day grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {DAILY_REWARDS.map((reward, idx) => {
          const isClaimed = idx < claimedCount;
          const isToday = idx === currentDayIndex && !isClaimed && !alreadyClaimed;
          const isFuture = idx > currentDayIndex;
          return (
            <div
              key={idx}
              className={`relative flex flex-col items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                isToday
                  ? 'bg-emerald-950/30 border-emerald-400 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                  : isClaimed
                    ? 'bg-slate-950 border-emerald-500/20 text-slate-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
              } ${isFuture ? 'opacity-70' : ''}`}
            >
              <MicroLabel className={isToday ? 'text-emerald-300/80' : ''}>Day {idx + 1}</MicroLabel>
              <Calendar className={`w-7 h-7 my-3 transition-colors ${isClaimed ? 'text-emerald-500/40' : isToday ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} aria-hidden />
              <span className={`text-base font-bold font-mono tracking-tight ${isToday ? 'text-white' : isClaimed ? 'text-slate-500' : 'text-emerald-400'}`}>
                {reward}<span className="text-[10px] text-emerald-400 ml-0.5">c</span>
              </span>
              {isClaimed && <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5"><Check className="w-3 h-3 text-slate-950" /></div>}
              {isToday && <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-500 text-[9px] font-bold text-slate-950 uppercase tracking-wider whitespace-nowrap">Today</div>}
            </div>
          );
        })}
      </div>

      {/* Claim actions */}
      <div className="bg-slate-950/40 rounded-2xl border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          {alreadyClaimed ? (
            <p className="text-sm text-slate-400">
              Next daily claim in: <span className="font-mono font-bold text-amber-400">{timeLabel(nextDailyTime)}</span>
            </p>
          ) : (
            <p className="text-sm text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 animate-spin" />
              Day {currentDayIndex + 1} reward is ready! Claim now.
            </p>
          )}
        </div>
        {alreadyClaimed ? (
          <button type="button" disabled className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-950 border border-slate-800 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-wider cursor-not-allowed">
            <Check className="w-4 h-4" /> Claimed Today
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={onDailyClaim} disabled={dailyBusy || adBusy}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50">
              {dailyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />} Claim
            </button>
            <button type="button" onClick={onWatchAd} disabled={dailyBusy || adBusy}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-950/40 disabled:opacity-50">
              {adBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {adBusy ? 'Loading...' : 'Watch Ad'}
            </button>
          </div>
        )}
      </div>

      {/* Streak Milestones */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <MicroLabel className="mb-3 block">Streak Milestones</MicroLabel>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(STREAK_MILESTONES).map(([days, info]) => {
            const d = Number(days);
            const hit = player.dailyStreak >= d;
            const claimed = claimedMilestones.has(d);
            return (
              <div key={d} className={`relative flex flex-col items-center p-3 rounded-xl border transition ${
                claimed ? 'bg-amber-950/20 border-amber-500/30' : hit ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-900 border-slate-800 opacity-60'
              }`}>
                <span className="text-2xl mb-1">{info.emoji}</span>
                <span className="text-[10px] font-mono font-bold text-white">{d} Days</span>
                <span className="text-[10px] text-slate-400 mt-0.5">{info.title}</span>
                <span className="text-xs font-bold font-mono text-emerald-400 mt-1">+{fmtChips(info.reward)}c</span>
                {claimed && <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-0.5"><Check className="w-2.5 h-2.5 text-slate-950" /></div>}
                {hit && !claimed && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[8px] font-bold text-slate-950 uppercase">Auto!</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak Freeze */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <Snowflake className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Streak Freeze Shield</div>
            <div className="text-[10px] text-slate-400">Protects your streak for 1 missed day. You have {player.streakFreezes}/{STREAK_FREEZE_MAX}.</div>
          </div>
        </div>
        <button type="button" onClick={onBuyFreeze} disabled={freezeBusy || player.streakFreezes >= STREAK_FREEZE_MAX || player.bankedChips < STREAK_FREEZE_COST}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:cursor-not-allowed shrink-0">
          {freezeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Buy ({fmtChips(STREAK_FREEZE_COST)}c)
        </button>
      </div>
    </div>
  );
}

function timeLabel(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
