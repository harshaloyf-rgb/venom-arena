'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { countryFlag, type InspectedPlayer } from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  type ToastFn,
} from './_panel-primitives';
import { PanelTabBtn } from '@/components/ui/panel-tab-btn';
import { Crown, Trophy, Sparkles, Star } from 'lucide-react';

// ── HOF sub-modules ──────────────────────────────────────────────────────
import {
  type Tab,
  type InducteeEntry,
  type MyEntry,
  type NextMilestone,
  type HofStats,
  fmtChips,
  fmtDate,
} from './hof/_types';
import { MyHofTab } from './hof/my-hof-tab';
import { ChampionsTab } from './hof/champions-tab';
import { MilestonesTab } from './hof/milestones-tab';

// ── Main component ───────────────────────────────────────────────────────

interface HallOfFameProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

export function HallOfFame({ onToast, onInspectPlayer }: HallOfFameProps) {
  const { player } = useAuth();

  // ── Shared state ──
  const [tab, setTab] = useState<Tab>('my-hof');

  // ── Stats bar state ──
  const [stats, setStats] = useState<HofStats | null>(null);

  // ── My HOF state ──
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState(false);
  const [myTotalEntries, setMyTotalEntries] = useState(0);
  const [myCurrentChips, setMyCurrentChips] = useState(0);
  const [myMilestoneEntries, setMyMilestoneEntries] = useState<MyEntry[]>([]);
  const [myChampionshipEntries, setMyChampionshipEntries] = useState<MyEntry[]>([]);
  const [myNextMilestone, setMyNextMilestone] = useState<NextMilestone | null>(null);

  // ── Champions state ──
  const [champLoading, setChampLoading] = useState(false);
  const [champYear, setChampYear] = useState<number | null>(null);
  const [champSearch, setChampSearch] = useState('');
  const [debouncedChampSearch, setDebouncedChampSearch] = useState('');
  const [champEntries, setChampEntries] = useState<InducteeEntry[]>([]);
  const [champTotal, setChampTotal] = useState(0);

  // ── Milestones state ──
  const [mileLoading, setMileLoading] = useState(false);
  const [mileTierFilter, setMileTierFilter] = useState<string>('all');
  const [mileSearch, setMileSearch] = useState('');
  const mileListRef = useRef<HTMLOListElement | null>(null);
  const [mileEntries, setMileEntries] = useState<InducteeEntry[]>([]);
  const [mileTotal, setMileTotal] = useState(0);
  const [mileFirstAchievers, setMileFirstAchievers] = useState<Record<string, { playerName: string; userTag: string; country: string; inductedAt: string } | null>>({});

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/hof/stats');
      if (res.ok) {
        const data = await res.json();
        queueMicrotask(() => setStats(data));
      }
    } catch {
      // stats bar is optional, fail silently
    }
  }, []);

  // ── Fetch my-entries ──
  const fetchMyEntries = useCallback(async () => {
    queueMicrotask(() => setMyLoading(true));
    queueMicrotask(() => setMyError(false));
    try {
      const res = await fetch('/api/hof/my-entries');
      if (res.ok) {
        const data = await res.json();
        queueMicrotask(() => {
          setMyTotalEntries(data.totalEntries ?? 0);
          setMyCurrentChips(data.currentChips ?? 0);
          setMyMilestoneEntries(data.milestoneEntries ?? []);
          setMyChampionshipEntries(data.championshipEntries ?? []);
          setMyNextMilestone(data.nextMilestone ?? null);
          setMyError(false);
        });
      } else {
        queueMicrotask(() => setMyError(true));
      }
    } catch {
      queueMicrotask(() => setMyError(true));
    } finally {
      queueMicrotask(() => setMyLoading(false));
    }
  }, []);

  // ── Fetch champions ──
  const fetchChampions = useCallback(async (year: number | null, search: string) => {
    queueMicrotask(() => setChampLoading(true));
    try {
      const params = new URLSearchParams({ type: 'championship', limit: '100' });
      if (year) params.set('year', String(year));
      if (search) params.set('search', search);
      const res = await fetch(`/api/hof/inductees?${params}`);
      if (res.ok) {
        const data = await res.json();
        queueMicrotask(() => {
          setChampEntries(data.entries ?? []);
          setChampTotal(data.total ?? 0);
        });
      } else {
        queueMicrotask(() => {
          setChampEntries([]);
          setChampTotal(0);
        });
      }
    } catch {
      queueMicrotask(() => {
        setChampEntries([]);
        setChampTotal(0);
      });
    } finally {
      queueMicrotask(() => setChampLoading(false));
    }
  }, []);

  // ── Fetch milestones ──
  const fetchMilestones = useCallback(async (tierFilter: string) => {
    queueMicrotask(() => setMileLoading(true));
    try {
      const params = new URLSearchParams({ type: 'milestone', limit: '100' });
      if (tierFilter !== 'all') params.set('milestoneTier', tierFilter);
      const res = await fetch(`/api/hof/inductees?${params}`);
      if (res.ok) {
        const data = await res.json();
        queueMicrotask(() => {
          setMileEntries(data.entries ?? []);
          setMileTotal(data.total ?? 0);
        });
      } else {
        queueMicrotask(() => {
          setMileEntries([]);
          setMileTotal(0);
        });
      }
    } catch {
      queueMicrotask(() => {
        setMileEntries([]);
        setMileTotal(0);
      });
    } finally {
      queueMicrotask(() => setMileLoading(false));
    }
  }, []);

  // ── Effects ──

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch my-entries when tab is my-hof and player exists
  useEffect(() => {
    if (tab === 'my-hof' && player) {
      fetchMyEntries();
    }
  }, [tab, player, fetchMyEntries]);

  // Debounce the champions search so typing doesn't fire a request per keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedChampSearch(champSearch), 300);
    return () => clearTimeout(t);
  }, [champSearch]);

  // Fetch champions when tab changes or filters change
  useEffect(() => {
    if (tab === 'champions') {
      fetchChampions(champYear, debouncedChampSearch);
    }
  }, [tab, champYear, debouncedChampSearch, fetchChampions]);

  // Fetch milestones when tab changes or filter changes
  useEffect(() => {
    if (tab === 'milestones') {
      fetchMilestones(mileTierFilter);
    }
  }, [tab, mileTierFilter, fetchMilestones]);

  // Populate milestoneFirstAchievers from stats
  useEffect(() => {
    if (stats?.milestoneFirstAchievers) {
      const hasReal = Object.values(stats.milestoneFirstAchievers).some(Boolean);
      if (hasReal) {
        queueMicrotask(() => setMileFirstAchievers(stats.milestoneFirstAchievers));
      }
    }
  }, [stats]);

  // ── Derived ──

  const champYears = useMemo(() => {
    if (stats?.championshipYears && stats.championshipYears.length > 0) {
      return stats.championshipYears.map((y) => y.year).sort((a, b) => b - a);
    }
    return [];
  }, [stats]);

  // ── Inspect helper ──
  function inspectEntry(entry: InducteeEntry) {
    if (!onInspectPlayer) return;
    onInspectPlayer({
      name: entry.playerName,
      userTag: entry.playerTag,
      country: entry.country,
      flag: countryFlag(entry.country),
      bankedChips: entry.chipsAtInduction,
      level: entry.level,
      clanTag: entry.clanTag || undefined,
      achievedAt: fmtDate(entry.inductedAt),
    });
  }

  if (!player) return <NotSignedIn />;

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 lg:p-1.5 overflow-hidden">
      <GlowBlob color="bg-yellow-500/10" className="-top-12 -right-12 w-56 h-56 lg:w-24 lg:h-24" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-1 mb-4 lg:mb-1 pb-4 lg:pb-1 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-[11px] font-sans font-black text-white tracking-tight flex items-center gap-2.5 lg:gap-1">
            <Crown className="w-5.5 h-5.5 lg:w-3 lg:h-3 text-yellow-400" />
            Venom Arena Hall of Fame &amp; Esports Shrine
          </h2>
          <p className="text-xs lg:text-[11px] text-slate-400 mt-1 lg:mt-0 max-w-3xl">
            Permanent shrine for milestone achievers and championship legends. Every record is immutable and here forever.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 lg:gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-4 lg:mb-1">
        <PanelTabBtn active={tab === 'my-hof'} onClick={() => setTab('my-hof')} icon={Star} label="My HOF Profile" color="yellow" />
        <PanelTabBtn active={tab === 'champions'} onClick={() => setTab('champions')} icon={Trophy} label="Champions Wing" color="yellow" />
        <PanelTabBtn active={tab === 'milestones'} onClick={() => setTab('milestones')} icon={Sparkles} label="Milestones Wing" color="yellow" />
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-1 mb-4 lg:mb-1 p-4 lg:p-1.5 rounded-xl border border-slate-800/60 bg-slate-950/80">
          <div className="text-center">
            <MicroLabel className="text-[11px]">Total Inducted Players</MicroLabel>
            <div className="text-lg lg:text-[11px] font-mono font-black text-yellow-400 mt-1">{stats.totalInductedPlayers}</div>
          </div>
          <div className="text-center">
            <MicroLabel className="text-[11px]">Total Entries</MicroLabel>
            <div className="text-lg lg:text-[11px] font-mono font-black text-white mt-1">{stats.totalEntries}</div>
          </div>
          <div className="text-center">
            <MicroLabel className="text-[11px]">Milestone Inductees</MicroLabel>
            <div className="text-lg lg:text-[11px] font-mono font-black text-emerald-400 mt-1">{stats.byType.milestone ?? 0}</div>
          </div>
          <div className="text-center">
            <MicroLabel className="text-[11px]">Championship Inductees</MicroLabel>
            <div className="text-lg lg:text-[11px] font-mono font-black text-amber-400 mt-1">{stats.byType.championship ?? 0}</div>
          </div>
        </div>
      )}

      {/* ═══════════════════ TAB: My HOF Profile ═══════════════════ */}
      {tab === 'my-hof' && (
        <MyHofTab
          loading={myLoading}
          error={myError}
          totalEntries={myTotalEntries}
          currentChips={myCurrentChips}
          milestoneEntries={myMilestoneEntries}
          championshipEntries={myChampionshipEntries}
          nextMilestone={myNextMilestone}
        />
      )}

      {/* ═══════════════════ TAB: Champions Wing ═══════════════════ */}
      {tab === 'champions' && (
        <ChampionsTab
          loading={champLoading}
          year={champYear}
          years={champYears}
          search={champSearch}
          entries={champEntries}
          total={champTotal}
          onYearChange={setChampYear}
          onSearchChange={setChampSearch}
          onInspectEntry={inspectEntry}
        />
      )}

      {/* ═══════════════════ TAB: Milestones Wing ═══════════════════ */}
      {tab === 'milestones' && (
        <MilestonesTab
          loading={mileLoading}
          tierFilter={mileTierFilter}
          search={mileSearch}
          entries={mileEntries}
          total={mileTotal}
          tierCounts={stats?.milestoneCounts ?? {}}
          firstAchievers={mileFirstAchievers}
          listRef={mileListRef}
          myPlayerTag={player?.userTag ?? null}
          onToast={onToast}
          onTierFilterChange={setMileTierFilter}
          onSearchChange={setMileSearch}
          onInspectPlayer={onInspectPlayer}
        />
      )}
    </div>
  );
}

export default HallOfFame;
