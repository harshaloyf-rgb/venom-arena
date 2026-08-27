'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  COUNTRIES,
  countryFlag,
  type InspectedPlayer,
} from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  type ToastFn,
} from './_panel-primitives';
import { PanelTabBtn } from '@/components/ui/panel-tab-btn';
import { Crown, Radio, Trophy, Sparkles, Star } from 'lucide-react';

// ── HOF sub-modules ──────────────────────────────────────────────────────
import {
  type Tab,
  type CommentaryFilter,
  type InducteeEntry,
  type MyEntry,
  type NextMilestone,
  type HofStats,
  INITIAL_COMMENTARY,
  COMMENTARY_NAMES,
  fmtChips,
  fmtDate,
  DEMO_CHAMPIONS,
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
  const isAdmin = player?.role === 'admin';

  // ── Shared state ──
  const [tab, setTab] = useState<Tab>('my-hof');
  const [commentary, setCommentary] = useState(INITIAL_COMMENTARY);

  // Clear fake commentary for non-admin users
  useEffect(() => {
    if (!isAdmin) setCommentary([]);
  }, [isAdmin]);

  const [tickerFilter, setTickerFilter] = useState<CommentaryFilter>('all');

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
  const [champEntries, setChampEntries] = useState<InducteeEntry[]>([]);
  const [champTotal, setChampTotal] = useState(0);

  // ── Milestones state ──
  const [mileLoading, setMileLoading] = useState(false);
  const [mileTierFilter, setMileTierFilter] = useState<string>('all');
  const [mileSearch, setMileSearch] = useState('');
  const mileListRef = useRef<HTMLDivElement | null>(null);
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

  // Fetch champions when tab changes or filters change
  useEffect(() => {
    if (tab === 'champions') {
      fetchChampions(champYear, champSearch);
    }
  }, [tab, champYear, champSearch, fetchChampions]);

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

  // Live commentary ticker
  useEffect(() => {
    if (tab !== 'ticker' || !isAdmin) return;
    const id = setInterval(() => {
      const name = COMMENTARY_NAMES[Math.floor(Math.random() * COMMENTARY_NAMES.length)];
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      const chips = 50_000 + Math.floor(Math.random() * 5_000_000);
      const templates = [
        `🎙️ LIVE EXTRACTION: ${name} from ${country.name} ${country.flag} successfully extracted ${fmtChips(chips)} chips in Tier-05 Arena!`,
        `💥 ARENA ELIMINATION: ${name} ${country.flag} trapped a rival viper and claimed ${fmtChips(Math.floor(chips / 2))} star chips!`,
        `👑 MILESTONE UPDATE: ${name} ${country.flag} reached a new milestone tier with ${fmtChips(chips)} chips!`,
        `🔥 HIGH STAKES ACTION: Room #04 is boiling as ${name} ${country.flag} enters extraction zone holding ${fmtChips(chips)} chips!`,
      ];
      const text = templates[Math.floor(Math.random() * templates.length)];
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
      setCommentary((prev) => [{ id: `c-${Date.now()}`, ts, text }, ...prev].slice(0, 30));
    }, 5000);
    return () => clearInterval(id);
  }, [tab]);

  // ── Derived ──

  const filteredCommentary = useMemo(() => {
    if (tickerFilter === 'all') return commentary;
    const filters: Record<Exclude<CommentaryFilter, 'all'>, RegExp> = {
      extractions: /EXTRACTION/i,
      eliminations: /ELIMINATION/i,
      milestones: /MILESTONE/i,
    };
    return commentary.filter((c) =>
      filters[tickerFilter as Exclude<CommentaryFilter, 'all'>].test(c.text),
    );
  }, [commentary, tickerFilter]);

  const champYears = useMemo(() => {
    if (stats?.championshipYears && stats.championshipYears.length > 0) {
      return stats.championshipYears.map((y) => y.year).sort((a, b) => b - a);
    }
    if (!isAdmin) return [];
    return [2026, 2025, 2024];
  }, [stats, isAdmin]);

  const champDisplayEntries = useMemo(() => {
    if (champEntries.length > 0) return champEntries;
    if (!isAdmin) return [];
    // Fallback to demo data (admin only)
    let demo = [...DEMO_CHAMPIONS];
    if (champYear) demo = demo.filter((d) => d.date.includes(String(champYear)));
    return demo;
  }, [champEntries, champYear, isAdmin]);

  const champIsDemo = champEntries.length === 0 && isAdmin;
  const mileIsDemo = mileEntries.length === 0 && isAdmin;

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

  function inspectDemo(name: string, userTag: string, country: string, chips: number, level: number) {
    if (!onInspectPlayer) return;
    onInspectPlayer({
      name,
      userTag,
      country,
      flag: countryFlag(country),
      bankedChips: chips,
      level,
      clanTag: 'APEX',
      clanName: 'Viper Apex Syndicate',
      achievedAt: '01 Jan 2026',
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
            Project Venom Hall of Fame &amp; Esports Shrine
          </h2>
          <p className="text-xs lg:text-[11px] text-slate-400 mt-1 lg:mt-0 max-w-3xl">
            Permanent shrine for milestone achievers and championship legends. DB-backed, immutable, and forever.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 lg:gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-4 lg:mb-1">
        <PanelTabBtn active={tab === 'my-hof'} onClick={() => setTab('my-hof')} icon={Star} label="My HOF Profile" color="yellow" />
        <PanelTabBtn active={tab === 'champions'} onClick={() => setTab('champions')} icon={Trophy} label="Champions Wing" color="yellow" />
        <PanelTabBtn active={tab === 'milestones'} onClick={() => setTab('milestones')} icon={Sparkles} label="Milestones Wing" color="yellow" />
        <PanelTabBtn active={tab === 'ticker'} onClick={() => setTab('ticker')} icon={Radio} label="Live Ticker" color="yellow" />
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

      {/* Live broadcast marquee - hidden for non-admin */}
      {isAdmin && (
      <div className="relative mb-5 lg:mb-1 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 lg:p-1.5 flex items-center gap-3 lg:gap-1 overflow-hidden">
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-rose-300 uppercase tracking-widest px-2 lg:px-1.5 py-1 bg-rose-500/20 border border-rose-500/40 rounded shrink-0">
          <Radio className="w-3 h-3 lg:w-3 lg:h-3 animate-pulse" /> LIVE BROADCAST
        </span>
        <div className="text-xs lg:text-[11px] text-rose-200">
          {commentary[0]?.text || (isAdmin ? '🎙️ ESPORTS COMMENTARY ACTIVE: Welcome to Project Venom World Arena Championship!' : 'No live commentary at this time.')}
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
          displayEntries={champDisplayEntries}
          isDemo={champIsDemo}
          onYearChange={setChampYear}
          onSearchChange={setChampSearch}
          onInspectEntry={inspectEntry}
          onInspectDemo={inspectDemo}
        />
      )}

      {/* ═══════════════════ TAB: Milestones Wing ═══════════════════ */}
      {tab === 'milestones' && (
        <MilestonesTab
          loading={mileLoading}
          tierFilter={mileTierFilter}
          search={mileSearch}
          isDemo={mileIsDemo}
          entries={mileEntries}
          firstAchievers={mileFirstAchievers}
          listRef={mileListRef}
          myPlayerTag={player?.userTag ?? null}
          onToast={onToast}
          onTierFilterChange={setMileTierFilter}
          onSearchChange={setMileSearch}
          onInspectPlayer={onInspectPlayer}
        />
      )}

      {/* ═══════════════════ TAB: Live Esports Ticker ═══════════════════ */}
      {tab === 'ticker' && (
        <div className="space-y-4 lg:space-y-1">
          <div className="flex flex-wrap items-center gap-2 lg:gap-1">
            <Radio className="w-4 h-4 lg:w-3 lg:h-3 text-rose-400" />
            <span className="text-xs lg:text-[11px] font-bold text-white">Channel Filter:</span>
            {([
              { id: 'all', label: '🌐 All Arena Events' },
              { id: 'extractions', label: '💰 High Stakes Extractions' },
              { id: 'eliminations', label: '💥 Viper Eliminations' },
              { id: 'milestones', label: '👑 Milestone Breakers' },
            ] as const).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTickerFilter(f.id)}
                className={`px-2.5 lg:px-1.5 py-1 rounded-full text-[11px] font-bold transition border ${tickerFilter === f.id ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <ol className="divide-y divide-slate-900 max-h-96 lg:max-h-[340px] overflow-y-auto va-scroll">
              {filteredCommentary.length === 0 ? (
                <li className="p-6 lg:p-3 text-center text-xs lg:text-[11px] text-slate-500">No events in this channel yet…</li>
              ) : (
                filteredCommentary.map((c) => (
                  <li key={c.id} className="px-4 lg:px-1.5 py-3 lg:py-1 text-sm lg:text-[11px] flex items-start gap-3 lg:gap-1 hover:bg-slate-900/40 transition-colors">
                    <span className="text-[11px] font-mono text-slate-500 mt-0.5 shrink-0">{c.ts}</span>
                    <span className="text-slate-200 leading-relaxed">{c.text}</span>
                  </li>
                ))
              )}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default HallOfFame;
