'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { DAILY_REWARDS } from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Gift,
  Check,
  Calendar,
  Flame,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface DailyRewardsProps {
  onToast?: ToastFn;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function timeLeftLabel(ms: number): string {
  if (ms <= 0) return 'now';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function DailyRewards({ onToast }: DailyRewardsProps) {
  const { player, loading, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <PanelSkeleton count={1} height="h-48" />;
  if (!player) return <NotSignedIn />;

  const today = todayStr();
  const alreadyClaimed = player.lastDailyClaim === today;

  const currentDayIndex = alreadyClaimed
    ? (player.dailyStreak - 1 + 7) % 7
    : player.dailyStreak % 7;

  const claimedCount = alreadyClaimed
    ? ((player.dailyStreak - 1) % 7) + 1
    : player.dailyStreak === 0
      ? 0
      : ((player.dailyStreak - 1) % 7) + 1;

  // Next-claim time
  let timeLeft = '';
  if (alreadyClaimed && player.lastDailyClaim) {
    const last = new Date(player.lastDailyClaim + 'T00:00:00Z').getTime();
    const next = last + DAY_MS;
    timeLeft = timeLeftLabel(next - now);
  }

  async function handleClaim(multiplier: 1 | 2) {
    setBusy(true);
    try {
      const res = await fetch('/api/player/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reward?: number;
        streak?: number;
      };
      if (!res.ok) {
        notify(data?.error || 'Failed to claim daily reward.', 'error', onToast);
        return;
      }
      notify(
        `Claimed Daily Reward: +${data.reward} CHIPS! ${multiplier > 1 ? '(2x Ad Bonus!)' : ''}`,
        'success',
        onToast,
      );
      await refresh();
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    } finally {
      setBusy(false);
      setAdBusy(false);
    }
  }

  function handleWatchAd() {
    setAdBusy(true);
    notify('Launching ad-stream sponsor link... Please hold', 'info', onToast);
    setTimeout(() => {
      void handleClaim(2);
    }, 2500);
  }

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-emerald-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <Gift className="w-5.5 h-5.5 text-emerald-400 animate-bounce" />
            Daily Log Rewards
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Build your claim streak to secure massive payouts for arena entries!
          </p>
        </div>
        <div className="inline-flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-amber-500/30">
          <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
          <div>
            <MicroLabel className="block">Current Streak</MicroLabel>
            <span className="text-base font-bold font-mono text-white">
              {player.dailyStreak} Days
            </span>
          </div>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="relative grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-5">
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
              <MicroLabel className={isToday ? 'text-emerald-300/80' : ''}>
                Day {idx + 1}
              </MicroLabel>
              <Calendar
                className={`w-7 h-7 my-3 transition-colors ${
                  isClaimed ? 'text-emerald-500/40' : isToday ? 'text-emerald-400 animate-pulse' : 'text-slate-600'
                }`}
                aria-hidden
              />
              <span
                className={`text-base font-bold font-mono tracking-tight ${
                  isToday ? 'text-white' : isClaimed ? 'text-slate-500' : 'text-emerald-400'
                }`}
              >
                {reward}
                <span className="text-[10px] text-emerald-400 ml-0.5">c</span>
              </span>

              {isClaimed && (
                <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5" aria-label="Claimed">
                  <Check className="w-3 h-3 text-slate-950" />
                </div>
              )}
              {isToday && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-500 text-[9px] font-bold text-slate-950 uppercase tracking-wider whitespace-nowrap">
                  Today
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Claim actions */}
      <div className="relative bg-slate-950/40 rounded-2xl border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          {alreadyClaimed ? (
            <p className="text-sm text-slate-400">
              Next Daily Claim available in: <span className="font-mono font-bold text-amber-400">{timeLeft || 'calculating...'}</span>
            </p>
          ) : (
            <p className="text-sm text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
              Day {currentDayIndex + 1} reward is available! Claim now to boost your chips balance.
            </p>
          )}
        </div>
        {alreadyClaimed ? (
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-950 border border-slate-800 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-wider cursor-not-allowed"
          >
            <Check className="w-4 h-4" /> Already Claimed Today
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void handleClaim(1)}
              disabled={busy || adBusy}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              Standard Claim
            </button>
            <button
              type="button"
              onClick={handleWatchAd}
              disabled={busy || adBusy}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-950/40 disabled:opacity-50"
            >
              {adBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {adBusy ? 'Buffering Sponsor...' : 'Watch Ad (Double Claim)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyRewards;
