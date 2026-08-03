'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  SEASONAL_BONUS_DAYS,
} from '@/lib/game-config';
import {
  GlowBlob,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Gift,
  Flame,
  Snowflake,
} from 'lucide-react';
import { DailyStreakTab } from './rewards/daily-streak-tab';
import { HourlyTab } from './rewards/hourly-tab';
import { SpinTab } from './rewards/spin-tab';
import { CalendarTab } from './rewards/calendar-tab';
import { HistoryTab } from './rewards/history-tab';

// ── Types ──

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

// ── Helpers ──

const DAY_MS = 86_400_000;

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
  { id: 'hourly', label: 'Hourly', icon: Flame },
  { id: 'spin', label: 'Lucky Spin', icon: Flame },
  { id: 'calendar', label: 'Calendar', icon: Flame },
  { id: 'history', label: 'History', icon: Flame },
];

// ── Reward Fly Animation ──

import { fmtChipsIndian as fmtChips } from '@/lib/format-chips';

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

// ── Main Component ──

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
          <Flame className="w-4 h-4 text-amber-400 shrink-0" />
          {seasonal.label} ({seasonal.multiplier}× all rewards today!)
        </div>
      )}

      {/* Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-4">
        {TABS.map(t => <TabBtn key={t.id} {...t} />)}
      </div>

      {/* ═══════ TAB: Daily Streak ═══════ */}
      {tab === 'daily' && (
        <DailyStreakTab
          player={player}
          alreadyClaimed={alreadyClaimed}
          currentDayIndex={currentDayIndex}
          claimedCount={claimedCount}
          dailyBusy={dailyBusy}
          adBusy={adBusy}
          freezeBusy={freezeBusy}
          nextDailyTime={nextDailyTime}
          claimedMilestones={claimedMilestones}
          onDailyClaim={() => void handleDailyClaim()}
          onWatchAd={handleWatchAd}
          onBuyFreeze={() => void handleBuyFreeze()}
        />
      )}

      {/* ═══════ TAB: Hourly ═══════ */}
      {tab === 'hourly' && (
        <HourlyTab
          hourlyCanClaim={hourlyCanClaim}
          hourlyTimeLeft={hourlyTimeLeft}
          hourlyBusy={hourlyBusy}
          onHourlyClaim={() => void handleHourlyClaim()}
        />
      )}

      {/* ═══════ TAB: Lucky Spin ═══════ */}
      {tab === 'spin' && (
        <SpinTab
          spinning={spinning}
          spinResult={spinResult}
          freeSpinsToday={freeSpinsToday}
          playerBankedChips={player.bankedChips}
          onSpin={(useFree) => void handleSpin(useFree)}
        />
      )}

      {/* ═══════ TAB: Calendar ═══════ */}
      {tab === 'calendar' && (
        <CalendarTab
          player={player}
          calendarDays={calendarDays}
          onToast={onToast}
        />
      )}

      {/* ═══════ TAB: History ═══════ */}
      {tab === 'history' && (
        <HistoryTab
          history={history}
          historyTotal={historyTotal}
          historyLoading={historyLoading}
          historyPage={historyPage}
          onFetchHistory={fetchHistory}
        />
      )}
    </div>
  );
}

export default DailyRewards;
