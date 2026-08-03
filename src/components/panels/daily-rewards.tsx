'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { fmtChipsIndian as fmtChips } from '@/lib/format-chips';
import {
  DAILY_REWARDS,
  STREAK_MILESTONES,
  STREAK_FREEZE_COST,
  STREAK_FREEZE_MAX,
  SPIN_PRIZES,
  SPIN_COST,
  HOURLY_REWARD_MIN,
  HOURLY_REWARD_MAX,
  SEASONAL_BONUS_DAYS,
} from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
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
  Clock,
  Zap,
  Shield,
  History,
  Target,
  Users,
  Star,
  X,
  ChevronRight,
  Snowflake,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface ClaimsProps {
  onToast?: ToastFn;
}

type ClaimTab = 'daily' | 'hourly' | 'spin' | 'calendar' | 'history';

interface HistoryEntry {
  id: string;
  type: string;
  reward: number;
  detail: string;
  createdAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function timeLabel(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function utcTodayStr(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function seasonalToday() {
  const today = utcTodayStr();
  return SEASONAL_BONUS_DAYS[today] ?? null;
}

const TABS: { id: ClaimTab; label: string; icon: typeof Gift }[] = [
  { id: 'daily', label: 'Daily Streak', icon: Flame },
  { id: 'hourly', label: 'Hourly', icon: Clock },
  { id: 'spin', label: 'Lucky Spin', icon: Zap },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'history', label: 'History', icon: History },
];

// ── Reward Fly Animation ────────────────────────────────────────────────────

function RewardFly({ amount, onDone }: { amount: number; onDone: () => void }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 2000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (gone) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
  }, [gone, onDone]);

  return (
    <div className={`fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-[2s] ease-out ${gone ? 'opacity-0 -translate-y-32 scale-150' : 'opacity-100 scale-100'}`}>
      <div className="bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-sm rounded-2xl px-6 py-3 text-center shadow-2xl shadow-emerald-950/60">
        <div className="text-2xl font-black font-mono text-emerald-300">+{fmtChips(amount)}c</div>
        <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Chips Earned!</div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function DailyRewards({ onToast }: ClaimsProps) {
  const { player, loading, refresh } = useAuth();
  const [tab, setTab] = useState<ClaimTab>('daily');
  const [now, setNow] = useState(Date.now());
  const [flyReward, setFlyReward] = useState<number | null>(null);

  // Daily claim state
  const [dailyBusy, setDailyBusy] = useState(false);
  const [adBusy, setAdBusy] = useState(false);

  // Hourly state
  const [hourlyCanClaim, setHourlyCanClaim] = useState(false);
  const [hourlyTimeLeft, setHourlyTimeLeft] = useState(0);
  const [hourlyBusy, setHourlyBusy] = useState(false);

  // Spin state
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<{ reward: number; tier: string; label: string } | null>(null);
  const [freeSpinsToday, setFreeSpinsToday] = useState(1);
  const [spinCount, setSpinCount] = useState(0);

  // Freeze state
  const [freezeBusy, setFreezeBusy] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);

  // Streak milestone claimed state
  const [claimedMilestones, setClaimedMilestones] = useState<Set<number>>(new Set());

  // Timer tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch hourly status
  const fetchHourly = useCallback(async () => {
    try {
      const res = await fetch('/api/player/hourly');
      if (res.ok) {
        const data = await res.json();
        setHourlyCanClaim(data.canClaim);
        setHourlyTimeLeft(data.timeLeftMs);
      }
    } catch { /* silent */ }
  }, []);

  // Fetch spin status
  const fetchSpinStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/player/spin');
      if (res.ok) {
        const data = await res.json();
        setFreeSpinsToday(data.freeSpinsToday);
        setSpinCount(data.spinsToday);
      }
    } catch { /* silent */ }
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async (page = 0) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/player/claims/history?limit=30&offset=${page * 30}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.entries);
        setHistoryTotal(data.total);
        setHistoryPage(page);
      }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  // Initial fetches
  useEffect(() => { fetchHourly(); fetchSpinStatus(); }, [fetchHourly, fetchSpinStatus]);
  useEffect(() => { if (tab === 'history') fetchHistory(0); }, [tab, fetchHistory]);

  // ── Daily Claim ──
  async function handleDailyClaim() {
    setDailyBusy(true);
    try {
      const res = await fetch('/api/player/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { notify((data as { error?: string })?.error || 'Claim failed.', 'error', onToast); return; }
      const d = data as { reward?: number; streak?: number; streakMilestone?: { milestone: number; reward: number; title: string; emoji: string } | null; seasonalBonus?: { multiplier: number; label: string } | null };
      setFlyReward(d.reward ?? 0);
      let msg = `+${fmtChips(d.reward ?? 0)} CHIPS! Streak: ${d.streak ?? 0} days`;
      if (d.seasonalBonus) msg += ` | ${d.seasonalBonus.label}`;
      if (d.streakMilestone) {
        msg += ` | ${d.streakMilestone.emoji} ${d.streakMilestone.title} bonus: +${fmtChips(d.streakMilestone.reward)}c!`;
        setClaimedMilestones(prev => new Set([...prev, d.streakMilestone!.milestone]));
      }
      notify(msg, 'success', onToast);
      await refresh();
    } catch { notify('Network error.', 'error', onToast); }
    finally { setDailyBusy(false); setAdBusy(false); }
  }

  function handleWatchAd() {
    setAdBusy(true);
    notify('Launching sponsor stream... Please hold', 'info', onToast);
    setTimeout(() => void handleDailyClaim(), 2500);
  }

  // ── Hourly Claim ──
  async function handleHourlyClaim() {
    setHourlyBusy(true);
    try {
      const res = await fetch('/api/player/hourly', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { notify((data as { error?: string })?.error || 'Hourly claim failed.', 'error', onToast); return; }
      const d = data as { reward?: number };
      setFlyReward(d.reward ?? 0);
      notify(`Hourly micro-claim: +${fmtChips(d.reward ?? 0)} CHIPS!`, 'success', onToast);
      await refresh();
      fetchHourly();
    } catch { notify('Network error.', 'error', onToast); }
    finally { setHourlyBusy(false); }
  }

  // ── Spin ──
  async function handleSpin(useFree: boolean) {
    setSpinning(true);
    setSpinResult(null);
    try {
      const res = await fetch('/api/player/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useFree }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { notify((data as { error?: string })?.error || 'Spin failed.', 'error', onToast); setSpinning(false); return; }
      const d = data as { reward?: number; prizeTier?: string; prizeLabel?: string };
      // Simulate spin animation delay
      await new Promise(r => setTimeout(r, 2000));
      setSpinResult({ reward: d.reward ?? 0, tier: d.prizeTier ?? 'common', label: d.prizeLabel ?? '' });
      setFlyReward(d.reward ?? 0);
      notify(`🎰 ${d.prizeLabel}: +${fmtChips(d.reward ?? 0)} CHIPS!`, 'success', onToast);
      await refresh();
      fetchSpinStatus();
    } catch { notify('Network error.', 'error', onToast); }
    finally { setSpinning(false); }
  }

  // ── Freeze ──
  async function handleBuyFreeze() {
    setFreezeBusy(true);
    try {
      const res = await fetch('/api/player/streak/freeze', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { notify((data as { error?: string })?.error || 'Failed to buy freeze.', 'error', onToast); return; }
      notify('🛡️ Streak Freeze purchased! Your streak is now protected for 1 missed day.', 'success', onToast);
      await refresh();
    } catch { notify('Network error.', 'error', onToast); }
    finally { setFreezeBusy(false); }
  }

  // ── Derived ──
  const today = utcTodayStr();
  const alreadyClaimed = player?.lastDailyClaim === today;
  const currentDayIndex = player ? (alreadyClaimed ? (player.dailyStreak - 1 + 7) % 7 : player.dailyStreak % 7) : 0;
  const claimedCount = player ? (alreadyClaimed ? ((player.dailyStreak - 1) % 7) + 1 : player.dailyStreak === 0 ? 0 : ((player.dailyStreak - 1) % 7) + 1) : 0;
  const nextDailyTime = player?.lastDailyClaim ? new Date(player.lastDailyClaim + 'T00:00:00Z').getTime() + DAY_MS - now : 0;
  const seasonal = seasonalToday();

  // Calendar heatmap data (last 90 days)
  const calendarDays = useMemo(() => {
    const days: { date: string; claimed: boolean }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY_MS);
      const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      days.push({ date: ds, claimed: i === 0 ? alreadyClaimed : false });
    }
    return days;
  }, [alreadyClaimed]);

  if (loading) return <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 animate-pulse h-64" />;
  if (!player) return <NotSignedIn />;

  // ── Tab button helper ──
  function TabBtn({ id, label, icon: Icon }: { id: ClaimTab; label: string; icon: typeof Gift }) {
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${
          tab === id
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            : 'text-slate-500 hover:text-slate-300 border-transparent'
        }`}
      >
        <Icon className="w-3.5 h-3.5" /> {label}
      </button>
    );
  }

  // ── RENDER ──
  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-emerald-500/10" className="-top-12 -right-12 w-56 h-56" />
      {flyReward !== null && <RewardFly amount={flyReward} onDone={() => setFlyReward(null)} />}

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <Gift className="w-5.5 h-5.5 text-emerald-400 animate-bounce" />
            Claims & Rewards Center
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Daily streaks, hourly micro-claims, lucky spins, and more. Never miss a reward!
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-amber-500/30">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-bold font-mono text-white">{player.dailyStreak}d</span>
          </div>
          {player.streakFreezes > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-sky-500/30">
              <Snowflake className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-bold font-mono text-sky-300">{player.streakFreezes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Seasonal Banner */}
      {seasonal && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 text-[11px] text-amber-200 font-bold flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400 shrink-0" />
          {seasonal.label} ({seasonal.multiplier}× all rewards today!)
        </div>
      )}

      {/* Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-4">
        {TABS.map(t => <TabBtn key={t.id} {...t} />)}
      </div>

      {/* ═══════ TAB: Daily Streak ═══════ */}
      {tab === 'daily' && (
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
                <button type="button" onClick={() => void handleDailyClaim()} disabled={dailyBusy || adBusy}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50">
                  {dailyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Claim
                </button>
                <button type="button" onClick={handleWatchAd} disabled={dailyBusy || adBusy}
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
            <button type="button" onClick={() => void handleBuyFreeze()} disabled={freezeBusy || player.streakFreezes >= STREAK_FREEZE_MAX || player.bankedChips < STREAK_FREEZE_COST}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:cursor-not-allowed shrink-0">
              {freezeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Buy ({fmtChips(STREAK_FREEZE_COST)}c)
            </button>
          </div>
        </div>
      )}

      {/* ═══════ TAB: Hourly ═══════ */}
      {tab === 'hourly' && (
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
                <button type="button" onClick={() => void handleHourlyClaim()} disabled={hourlyBusy}
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
      )}

      {/* ═══════ TAB: Lucky Spin ═══════ */}
      {tab === 'spin' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 text-[11px] text-amber-200 leading-relaxed">
            <strong>LUCKY SPIN WHEEL</strong><br />
            1 free spin per day, or pay {fmtChips(SPIN_COST)}c for extra spins. Prizes range from 5c to 5,000c jackpot!
          </div>

          {/* Prize Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SPIN_PRIZES.map((p, i) => (
              <div key={i} className={`bg-gradient-to-br ${p.color} rounded-xl p-3 text-center border border-white/10`}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">{p.tier}</div>
                <div className="text-sm font-bold font-mono text-white mt-1">{p.label}</div>
              </div>
            ))}
          </div>

          {/* Spin Result */}
          {spinResult && (
            <div className={`rounded-2xl border p-4 text-center ${
              spinResult.tier === 'legendary' ? 'border-yellow-500/40 bg-yellow-950/20' :
              spinResult.tier === 'epic' ? 'border-amber-500/40 bg-amber-950/20' :
              spinResult.tier === 'rare' ? 'border-violet-500/40 bg-violet-950/20' :
              'border-slate-700 bg-slate-950/40'
            }`}>
              <div className={`text-3xl font-black font-mono ${
                spinResult.tier === 'legendary' ? 'text-yellow-400' :
                spinResult.tier === 'epic' ? 'text-amber-400' :
                spinResult.tier === 'rare' ? 'text-violet-400' :
                'text-white'
              }`}>
                +{fmtChips(spinResult.reward)}c
              </div>
              <div className="text-xs text-slate-300 mt-1 uppercase tracking-wider">{spinResult.tier} — {spinResult.label}</div>
            </div>
          )}

          {/* Spin Buttons */}
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => void handleSpin(true)} disabled={spinning || freeSpinsToday <= 0}
              className={`inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl text-sm uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                freeSpinsToday > 0
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 shadow-amber-950/40'
                  : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {spinning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              Free Spin ({freeSpinsToday} left)
            </button>
            <button type="button" onClick={() => void handleSpin(false)} disabled={spinning || player.bankedChips < SPIN_COST}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {spinning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Star className="w-5 h-5" />}
              Pay {fmtChips(SPIN_COST)}c
            </button>
          </div>
        </div>
      )}

      {/* ═══════ TAB: Calendar ═══════ */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-[11px] text-slate-300 leading-relaxed">
            <strong>CLAIM CALENDAR</strong><br />
            Your last 90 days of daily claims. Green = claimed, dark = missed.
            Keep the grid lit to maintain your streak!
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <MicroLabel>Current Streak</MicroLabel>
              <div className="text-lg font-mono font-black text-amber-400 mt-1">{player.dailyStreak}d</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <MicroLabel>Freezes Held</MicroLabel>
              <div className="text-lg font-mono font-black text-sky-400 mt-1">{player.streakFreezes}</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <MicroLabel>Next Milestone</MicroLabel>
              <div className="text-lg font-mono font-black text-emerald-400 mt-1">
                {player.dailyStreak < 30 ? `${30 - player.dailyStreak}d` : player.dailyStreak < 60 ? `${60 - player.dailyStreak}d` : player.dailyStreak < 90 ? `${90 - player.dailyStreak}d` : '✅'}
              </div>
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 overflow-x-auto">
            <div className="grid grid-cols-10 sm:grid-cols-[repeat(15,minmax(0,1fr))] gap-1 min-w-[300px]">
              {calendarDays.map((d, i) => (
                <div
                  key={d.date}
                  title={`${d.date}${d.claimed ? ' ✓ Claimed' : ''}`}
                  className={`aspect-square rounded-sm transition-colors ${
                    d.claimed ? 'bg-emerald-500' :
                    i < 7 ? 'bg-slate-700' : 'bg-slate-800/60'
                  } hover:ring-1 hover:ring-slate-500`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3 justify-end">
              <span className="text-[9px] text-slate-500">Less</span>
              <div className="w-3 h-3 rounded-sm bg-slate-800" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-[9px] text-slate-500">More</span>
            </div>
          </div>

          {/* Referral section */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold text-white">Refer & Earn</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-3">
              Share your referral code. When your friend plays 5 matches, you both get <span className="text-emerald-400 font-bold">2,000c</span>!
            </p>
            {player.referralCode ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-violet-300 select-all">
                  {player.referralCode}
                </code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(player.referralCode!); notify('Referral code copied!', 'success', onToast); }}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition">
                  Copy
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">Generating your referral code...</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════ TAB: History ═══════ */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-[11px] text-slate-300 leading-relaxed">
            <strong>UNIFIED CLAIM HISTORY</strong><br />
            All your rewards in one timeline — daily, hourly, spins, streak milestones, promos, and video ads.
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-slate-500 animate-spin" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">No claim history yet. Start claiming daily rewards!</div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Type</div>
                  <div className="col-span-4">Detail</div>
                  <div className="col-span-2 text-right">Reward</div>
                  <div className="col-span-2 text-right">Date</div>
                </div>
                <ol className="divide-y divide-slate-900 max-h-96 overflow-y-auto va-scroll">
                  {history.map((e, i) => {
                    const typeIcon = e.type === 'daily' ? '📅' : e.type === 'hourly' ? '⏰' : e.type === 'spin' ? '🎰' : e.type === 'streak_milestone' ? '🏆' : e.type === 'promo' ? '🎟️' : '📺';
                    return (
                      <li key={e.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 text-sm hover:bg-slate-900/40 transition-colors">
                        <div className="col-span-1 text-slate-500 font-mono text-xs">{historyPage * 30 + i + 1}</div>
                        <div className="col-span-3 flex items-center gap-1.5">
                          <span>{typeIcon}</span>
                          <span className="text-[10px] font-bold uppercase text-slate-300">{e.type.replace('_', ' ')}</span>
                        </div>
                        <div className="col-span-4 text-xs text-slate-400 truncate">{e.detail}</div>
                        <div className="col-span-2 text-right font-mono font-bold text-emerald-400 text-xs">+{fmtChips(e.reward)}c</div>
                        <div className="col-span-2 text-right text-[10px] font-mono text-slate-500">
                          {new Date(e.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
              {historyTotal > 30 && (
                <div className="flex items-center justify-center gap-2">
                  <button type="button" onClick={() => fetchHistory(Math.max(0, historyPage - 1))} disabled={historyPage === 0}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-lg text-xs uppercase tracking-wider transition disabled:opacity-40">
                    ← Prev
                  </button>
                  <span className="text-xs text-slate-500 font-mono">Page {historyPage + 1} of {Math.ceil(historyTotal / 30)}</span>
                  <button type="button" onClick={() => fetchHistory(historyPage + 1)} disabled={(historyPage + 1) * 30 >= historyTotal}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-lg text-xs uppercase tracking-wider transition disabled:opacity-40">
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default DailyRewards;
