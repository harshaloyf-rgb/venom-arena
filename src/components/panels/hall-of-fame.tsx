'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  HALL_OF_FAME_TIERS,
  INITIAL_COMMENTARY,
  COMMENTARY_NAMES,
  COUNTRIES,
  countryFlag,
  countryName,
  type InspectedPlayer,
} from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Crown,
  Sparkles,
  Trophy,
  Radio,
  Globe,
  Check,
  Award,
  X,
  Search,
  Users,
  Loader2,
  Star,
  Target,
  Crosshair,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface HallOfFameProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type Tab = 'my-hof' | 'champions' | 'milestones' | 'ticker';
type CommentaryFilter = 'all' | 'extractions' | 'eliminations' | 'milestones';

interface InducteeEntry {
  id: string;
  playerId: string;
  playerTag: string;
  playerName: string;
  country: string;
  level: number;
  clanTag: string;
  inductionType: string;
  milestoneTierId: string | null;
  championshipYear: number | null;
  championshipRank: number | null;
  hofBadge: string | null;
  title: string | null;
  chipsAtInduction: number;
  inductedAt: string;
}

interface MyEntry {
  id: string;
  inductionType: string;
  milestoneTierId: string | null;
  championshipYear: number | null;
  championshipRank: number | null;
  hofBadge: string | null;
  title: string | null;
  chipsAtInduction: number;
  inductedAt: string;
}

interface NextMilestone {
  name: string;
  badge: string;
  chips: number;
  chipsNeeded: number;
}

interface HofStats {
  totalInductedPlayers: number;
  totalEntries: number;
  byType: { milestone?: number; championship?: number };
  milestoneFirstAchievers: Record<string, { playerName: string; userTag: string; country: string; inductedAt: string } | null>;
  milestoneCounts: Record<string, number>;
  championshipYears: { year: number; inducteeCount: number }[];
}

// ── Demo data ───────────────────────────────────────────────────────────────

const DEMO_MILESTONES: InducteeEntry[] = [
  // 1 Lakh tier
  { id: 'dm-1', playerId: 'dm-1', playerTag: '#IND-104', playerName: 'Rookie_Striker', country: 'IN', level: 12, clanTag: 'VIPER', inductionType: 'milestone', milestoneTierId: 't-1lakh', championshipYear: null, championshipRank: null, hofBadge: 'bronze_elite', title: '🥉 Bronze Elite', chipsAtInduction: 1_12_500, inductedAt: '2026-01-02T09:15:00Z' },
  { id: 'dm-2', playerId: 'dm-2', playerTag: '#BRA-217', playerName: 'Cobra_Brasil', country: 'BR', level: 10, clanTag: 'FANG', inductionType: 'milestone', milestoneTierId: 't-1lakh', championshipYear: null, championshipRank: null, hofBadge: 'bronze_elite', title: '🥉 Bronze Elite', chipsAtInduction: 1_05_200, inductedAt: '2026-01-02T14:30:00Z' },
  { id: 'dm-3', playerId: 'dm-3', playerTag: '#JPN-456', playerName: 'Sakura_Viper', country: 'JP', level: 9, clanTag: '', inductionType: 'milestone', milestoneTierId: 't-1lakh', championshipYear: null, championshipRank: null, hofBadge: 'bronze_elite', title: '🥉 Bronze Elite', chipsAtInduction: 1_01_800, inductedAt: '2026-01-03T08:00:00Z' },
  // 5 Lakh tier
  { id: 'dm-4', playerId: 'dm-4', playerTag: '#USA-402', playerName: 'Viper_Zero', country: 'US', level: 22, clanTag: 'APEX', inductionType: 'milestone', milestoneTierId: 't-5lakh', championshipYear: null, championshipRank: null, hofBadge: 'silver_commander', title: '🥈 Silver Commander', chipsAtInduction: 5_25_000, inductedAt: '2026-01-07T14:40:00Z' },
  { id: 'dm-5', playerId: 'dm-5', playerTag: '#IND-055', playerName: 'Delhi_King', country: 'IN', level: 19, clanTag: 'NAGA', inductionType: 'milestone', milestoneTierId: 't-5lakh', championshipYear: null, championshipRank: null, hofBadge: 'silver_commander', title: '🥈 Silver Commander', chipsAtInduction: 5_10_300, inductedAt: '2026-01-08T11:20:00Z' },
  // 10 Lakh tier
  { id: 'dm-6', playerId: 'dm-6', playerTag: '#KOR-114', playerName: 'K-Snake_Master', country: 'KR', level: 28, clanTag: 'DRAGON', inductionType: 'milestone', milestoneTierId: 't-10lakh', championshipYear: null, championshipRank: null, hofBadge: 'gold_apex_vanguard', title: '🥇 Gold Apex Vanguard', chipsAtInduction: 10_50_000, inductedAt: '2026-01-11T06:30:00Z' },
  { id: 'dm-7', playerId: 'dm-7', playerTag: '#GB-387', playerName: 'SidewinderAlpha', country: 'GB', level: 25, clanTag: 'COBRA', inductionType: 'milestone', milestoneTierId: 't-10lakh', championshipYear: null, championshipRank: null, hofBadge: 'gold_apex_vanguard', title: '🥇 Gold Apex Vanguard', chipsAtInduction: 10_12_000, inductedAt: '2026-01-12T16:45:00Z' },
  // 25 Lakh tier
  { id: 'dm-8', playerId: 'dm-8', playerTag: '#USA-882', playerName: 'Apex_Viper', country: 'US', level: 35, clanTag: 'VIPER', inductionType: 'milestone', milestoneTierId: 't-25lakh', championshipYear: null, championshipRank: null, hofBadge: 'platinum_sovereign', title: '💎 Platinum Sovereign', chipsAtInduction: 25_80_000, inductedAt: '2026-01-16T23:10:00Z' },
  // 50 Lakh tier
  { id: 'dm-9', playerId: 'dm-9', playerTag: '#JPN-309', playerName: 'Shadow_Ninja', country: 'JP', level: 42, clanTag: '', inductionType: 'milestone', milestoneTierId: 't-50lakh', championshipYear: null, championshipRank: null, hofBadge: 'diamond_warlord', title: '🔮 Diamond Warlord', chipsAtInduction: 52_00_000, inductedAt: '2026-01-19T11:22:00Z' },
  // 1 Crore tier
  { id: 'dm-10', playerId: 'dm-10', playerTag: '#IND-001', playerName: 'Hari', country: 'IN', level: 55, clanTag: 'OMEGA', inductionType: 'milestone', milestoneTierId: 't-1crore', championshipYear: null, championshipRank: null, hofBadge: 'omega_immortal_god', title: '👑 OMEGA IMMORTAL GOD', chipsAtInduction: 10_200_000, inductedAt: '2026-01-23T17:00:00Z' },
];

const DEMO_CHAMPIONS = [
  { rank: 1, name: 'Hari', userTag: '#IND-001', country: 'IN', badge: 'crown', title: '👑 2026 WORLD VENOM CHAMPION', chips: 10_000_000, date: '01 Jan 2026' },
  { rank: 2, name: 'Apex_Viper', userTag: '#USA-882', country: 'US', badge: 'silver', title: '🥈 2026 VENOM ARENA OVERLORD', chips: 9_400_000, date: '01 Jan 2026' },
  { rank: 3, name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', badge: 'bronze', title: '🥉 2026 ARENA ELITE MASTER', chips: 8_900_000, date: '01 Jan 2026' },
  { rank: 4, name: 'Shadow_Ninja', userTag: '#JPN-309', country: 'JP', badge: 'silver', title: '🥈 VENOM ARENA OVERLORD', chips: 8_200_000, date: '01 Jan 2026' },
  { rank: 5, name: 'Elysium_God', userTag: '#DEU-901', country: 'DE', badge: 'silver', title: '🥈 VENOM ARENA OVERLORD', chips: 6_900_000, date: '01 Jan 2026' },
  { rank: 11, name: 'Delhi_King', userTag: '#IND-003', country: 'IN', badge: 'bronze', title: '🥉 ARENA ELITE MASTER', chips: 4_500_000, date: '01 Jan 2026' },
  { rank: 52, name: 'Challenger_Viper', userTag: '#IND-902', country: 'IN', badge: 'contender', title: '🛡️ CHAMPIONSHIP CONTENDER', chips: 1_200_000, date: '01 Jan 2026' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtChips(n: number) {
  return n.toLocaleString('en-IN');
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function badgeIcon(badge: string | null | undefined) {
  if (!badge) return '🏅';
  switch (badge) {
    case 'crown': return '👑';
    case 'silver': return '🥈';
    case 'bronze': return '🥉';
    case 'contender': return '🛡️';
    default: return badge;
  }
}

// ── Tab button ──────────────────────────────────────────────────────────────

interface HoFTabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Crown;
  label: string;
}

function HoFTabBtn({ active, onClick, icon: Icon, label }: HoFTabBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${
        active
          ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
          : 'text-slate-500 hover:text-slate-300 border-transparent'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

// ── Milestones Flat Table (single table, like Champions Wing) ─────

interface MilestonesFlatTableProps {
  entries: InducteeEntry[];
  tierFilter: string;
  search: string;
  isDemo?: boolean;
  firstAchievers: Record<string, { playerName: string; userTag: string; country: string; inductedAt: string } | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  myPlayerTag: string | null;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

function MilestonesFlatTable({ entries, tierFilter, search, isDemo, firstAchievers, listRef, myPlayerTag, onInspectPlayer }: MilestonesFlatTableProps) {
  // Build a tier lookup map
  const tierMap = useMemo(() => {
    const m: Record<string, (typeof HALL_OF_FAME_TIERS)[number]> = {};
    for (const t of HALL_OF_FAME_TIERS) m[t.id] = t;
    return m;
  }, []);

  // Filter by search + tier
  const filtered = useMemo(() => {
    let result = entries;
    if (tierFilter !== 'all') {
      result = result.filter((e) => e.milestoneTierId === tierFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.playerName.toLowerCase().includes(q) ||
        e.playerTag.toLowerCase().includes(q) ||
        (e.clanTag && e.clanTag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, tierFilter, search]);

  if (filtered.length === 0 && search.trim()) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center text-xs text-slate-500">
        No players found matching &quot;{search}&quot;
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
      {isDemo && (
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">DEMO</span>
          <span className="text-[10px] text-slate-500">No real milestone inductees yet. Showing sample data.</span>
        </div>
      )}
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
        <div className="col-span-1">Rank</div>
        <div className="col-span-3">Player</div>
        <div className="col-span-3">Milestone Tier</div>
        <div className="col-span-2 text-right">Chips</div>
        <div className="col-span-2 text-right">Date</div>
        <div className="col-span-1 text-right">Action</div>
      </div>
      <ol ref={listRef} className="divide-y divide-slate-900 max-h-[28rem] overflow-y-auto va-scroll">
        {filtered.map((entry, idx) => {
  const tier = tierMap[entry.milestoneTierId || ''] ?? HALL_OF_FAME_TIERS[0];
  const rank = idx + 1;
  const isFirst = firstAchievers[entry.milestoneTierId || '']?.userTag === entry.playerTag;
  const isMe = myPlayerTag && entry.playerTag === myPlayerTag;
  return (
    <li
      key={entry.id}
      data-is-me={isMe ? 'true' : undefined}
      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm hover:bg-slate-900/40 transition-colors cursor-pointer ${isDemo ? 'opacity-60' : ''} ${isMe ? 'bg-yellow-500/10' : ''}`}
      onClick={() => {
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
      }}
    >
      {/* Rank */}
      <div className="col-span-1 font-mono">
        {rank === 1 ? (
          <span className="text-yellow-400 font-bold">👑 #1</span>
        ) : rank <= 3 ? (
          <span className="text-lg">{['', '🥇', '🥈', '🥉'][rank]}</span>
        ) : (
          <span className="text-slate-400 font-bold">#{rank}</span>
        )}
      </div>
      {/* Player */}
      <div className="col-span-3 min-w-0">
        <div className="font-bold text-white truncate flex items-center gap-1.5">
          <span aria-hidden>{countryFlag(entry.country)}</span>
          {entry.playerName}
          {isFirst && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
              <Check className="w-2.5 h-2.5" /> First!
            </span>
          )}
          {isMe && (
            <span className="text-[9px] font-mono font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/30 shrink-0">YOU</span>
          )}
        </div>
        <div className="text-[10px] font-mono text-slate-500 truncate">
          {entry.playerTag}{entry.clanTag ? ` [${entry.clanTag}]` : ''}
        </div>
      </div>
      {/* Tier */}
      <div className="col-span-3 min-w-0">
        <div className="text-[11px] text-slate-300 truncate flex items-center gap-1">
          <span>{tier.badge.split(' ')[0]}</span>
          <span className="text-slate-400">{tier.name}</span>
        </div>
        <div className="text-[10px] font-mono text-slate-500">{fmtChips(tier.chips)}c threshold</div>
      </div>
      {/* Chips */}
      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums text-[11px]">
        {fmtChips(entry.chipsAtInduction)}c
      </div>
      {/* Date */}
      <div className="col-span-2 text-right text-[10px] font-mono text-slate-500">
        {fmtDate(entry.inductedAt)}
      </div>
      {/* Inspect */}
      <div className="col-span-1 text-right">
        <span className="text-[9px] font-mono text-slate-500 hover:text-yellow-300 px-1.5 py-0.5 rounded border border-slate-800">Inspect</span>
      </div>
    </li>
  );
})}
      </ol>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function HallOfFame({ onToast, onInspectPlayer }: HallOfFameProps) {
  const { player } = useAuth();

  // ── Shared state ──
  const [tab, setTab] = useState<Tab>('my-hof');
  const [commentary, setCommentary] = useState(INITIAL_COMMENTARY);
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
    if (tab !== 'ticker') return;
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
    return [2026, 2025, 2024];
  }, [stats]);

  const champDisplayEntries = useMemo(() => {
    if (champEntries.length > 0) return champEntries;
    // Fallback to demo data
    let demo = [...DEMO_CHAMPIONS];
    if (champYear) demo = demo.filter((d) => d.date.includes(String(champYear)));
    return demo;
  }, [champEntries, champYear]);

  const champIsDemo = champEntries.length === 0;

  const mileIsDemo = mileEntries.length === 0;

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
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-yellow-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <Crown className="w-5.5 h-5.5 text-yellow-400" />
            Project Venom Hall of Fame &amp; Esports Shrine
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Permanent shrine for milestone achievers and championship legends. DB-backed, immutable, and forever.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-4">
        <HoFTabBtn active={tab === 'my-hof'} onClick={() => setTab('my-hof')} icon={Star} label="My HOF Profile" />
        <HoFTabBtn active={tab === 'champions'} onClick={() => setTab('champions')} icon={Trophy} label="Champions Wing" />
        <HoFTabBtn active={tab === 'milestones'} onClick={() => setTab('milestones')} icon={Sparkles} label="Milestones Wing" />
        <HoFTabBtn active={tab === 'ticker'} onClick={() => setTab('ticker')} icon={Radio} label="Live Ticker" />
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-4 rounded-xl border border-slate-800/60 bg-slate-950/80">
          <div className="text-center">
            <MicroLabel>Total Inducted Players</MicroLabel>
            <div className="text-lg font-mono font-black text-yellow-400 mt-1">{stats.totalInductedPlayers}</div>
          </div>
          <div className="text-center">
            <MicroLabel>Total Entries</MicroLabel>
            <div className="text-lg font-mono font-black text-white mt-1">{stats.totalEntries}</div>
          </div>
          <div className="text-center">
            <MicroLabel>Milestone Inductees</MicroLabel>
            <div className="text-lg font-mono font-black text-emerald-400 mt-1">{stats.byType.milestone ?? 0}</div>
          </div>
          <div className="text-center">
            <MicroLabel>Championship Inductees</MicroLabel>
            <div className="text-lg font-mono font-black text-amber-400 mt-1">{stats.byType.championship ?? 0}</div>
          </div>
        </div>
      )}

      {/* Live broadcast marquee */}
      <div className="relative mb-5 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 flex items-center gap-3 overflow-hidden">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-rose-300 uppercase tracking-widest px-2 py-1 bg-rose-500/20 border border-rose-500/40 rounded shrink-0">
          <Radio className="w-3 h-3 animate-pulse" /> LIVE BROADCAST
        </span>
        <div className="text-xs text-rose-200 truncate">
          {commentary[0]?.text || '🎙️ ESPORTS COMMENTARY ACTIVE: Welcome to Project Venom World Arena Championship!'}
        </div>
      </div>

      {/* ═══════════════════ TAB: My HOF Profile ═══════════════════ */}
      {tab === 'my-hof' && (
        <div className="space-y-4">
          {myLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
              <span className="ml-2 text-xs text-slate-400">Loading your HOF profile…</span>
            </div>
          ) : myError ? (
            <div className="text-center py-16">
              <p className="text-sm text-slate-500">Could not load your HOF profile.</p>
            </div>
          ) : (
            <>
              {/* Summary card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-950/10">
                  <MicroLabel>Your HOF Inductions</MicroLabel>
                  <div className="text-2xl font-mono font-black text-yellow-400 mt-1">{myTotalEntries}</div>
                </div>
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10">
                  <MicroLabel>Current Banked Chips</MicroLabel>
                  <div className="text-2xl font-mono font-black text-emerald-400 mt-1">{fmtChips(myCurrentChips)}c</div>
                </div>
              </div>

              {/* Next milestone card */}
              {myNextMilestone && (
                <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl shrink-0">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <MicroLabel>Next Milestone Target</MicroLabel>
                    <div className="text-sm font-bold text-white mt-0.5 truncate">{myNextMilestone.name}</div>
                    <div className="text-[11px] font-mono text-cyan-300 mt-0.5">{myNextMilestone.badge}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <MicroLabel>Chips Needed</MicroLabel>
                    <div className="text-lg font-mono font-black text-cyan-400 mt-1">{fmtChips(myNextMilestone.chipsNeeded)}c</div>
                  </div>
                </div>
              )}

              {/* Milestone entries */}
              {myMilestoneEntries.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" /> Milestone Inductions
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto va-scroll">
                    {myMilestoneEntries.map((e) => {
                      const tier = HALL_OF_FAME_TIERS.find((t) => t.id === e.milestoneTierId);
                      return (
                        <div
                          key={e.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/80"
                        >
                          <span className="text-xl shrink-0" aria-hidden>{tier?.badge.split(' ')[0] || '🏅'}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-white truncate">{e.title || tier?.name || 'Milestone'}</div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {fmtChips(e.chipsAtInduction)}c · {fmtDate(e.inductedAt)}
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                            <Check className="w-2.5 h-2.5 inline" /> Inducted
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Championship entries */}
              {myChampionshipEntries.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" /> Championship Inductions
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto va-scroll">
                    {myChampionshipEntries.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/80"
                      >
                        <span className="text-xl shrink-0" aria-hidden>{badgeIcon(e.hofBadge)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white truncate">{e.title || `Championship ${e.championshipYear || ''}`}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            Rank #{e.championshipRank ?? '?'} · {e.championshipYear || '?'} · {fmtChips(e.chipsAtInduction)}c
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                          <Check className="w-2.5 h-2.5 inline" /> Inducted
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No entries yet */}
              {myMilestoneEntries.length === 0 && myChampionshipEntries.length === 0 && !myNextMilestone && (
                <div className="text-center py-12 px-4">
                  <Award className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    You haven&apos;t been inducted yet. Keep playing and banking chips to reach milestone thresholds or finish in the top 100 of the Annual Championship!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════ TAB: Champions Wing ═══════════════════ */}
      {tab === 'champions' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3 text-[11px] text-amber-200 leading-relaxed">
            <strong>CHAMPIONSHIPS WING</strong>
            <br />
            Players inducted for finishing in the Top 100 of the Annual Venom Arena Championship. Ranks 1–100 earn permanent HOF status with unique badges.
          </div>

          {/* Year filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Year:</span>
            <button
              type="button"
              onClick={() => setChampYear(null)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition border ${champYear === null ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
            >
              All Years
            </button>
            {champYears.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setChampYear(y)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition border ${champYear === y ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                {y}{y === 2026 ? ' (Current)' : ''}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search by player name…"
              value={champSearch}
              onChange={(e) => setChampSearch(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
            />
            {champSearch && (
              <button
                type="button"
                onClick={() => setChampSearch('')}
                className="p-1 rounded text-slate-500 hover:text-white transition"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Loading */}
          {champLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              <span className="ml-2 text-xs text-slate-400">Loading champions…</span>
            </div>
          )}

          {/* Table */}
          {!champLoading && (
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
              {champIsDemo && (
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
                  <span className="text-[9px] font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">
                    DEMO
                  </span>
                  <span className="text-[10px] text-slate-500">No real championship inductees yet. Showing sample data.</span>
                </div>
              )}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-2">Badge</div>
                <div className="col-span-3">Title</div>
                <div className="col-span-1 text-right">Chips</div>
                <div className="col-span-1 text-right">Date</div>
              </div>
              <ol className="divide-y divide-slate-900 max-h-96 overflow-y-auto va-scroll">
                {champDisplayEntries.map((entry, idx) => {
                  const isDemo = champIsDemo;
                  const rank = isDemo
                    ? (entry as unknown as { rank: number }).rank
                    : (entry as InducteeEntry).championshipRank ?? idx + 1;
                  const name = isDemo
                    ? (entry as unknown as { name: string }).name
                    : (entry as InducteeEntry).playerName;
                  const tag = isDemo
                    ? (entry as unknown as { userTag: string }).userTag
                    : (entry as InducteeEntry).playerTag;
                  const country = isDemo
                    ? (entry as unknown as { country: string }).country
                    : (entry as InducteeEntry).country;
                  const badge = isDemo
                    ? (entry as unknown as { badge: string }).badge
                    : (entry as InducteeEntry).hofBadge;
                  const title = isDemo
                    ? (entry as unknown as { title: string }).title
                    : (entry as InducteeEntry).title;
                  const chips = isDemo
                    ? (entry as unknown as { chips: number }).chips
                    : (entry as InducteeEntry).chipsAtInduction;
                  const date = isDemo
                    ? (entry as unknown as { date: string }).date
                    : fmtDate((entry as InducteeEntry).inductedAt);

                  return (
                    <li
                      key={isDemo ? `${(entry as unknown as { name: string }).name}-${rank}` : (entry as InducteeEntry).id}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm hover:bg-slate-900/40 transition-colors cursor-pointer ${isDemo ? 'opacity-60' : ''}`}
                      onClick={() => {
                        if (isDemo) {
                          inspectDemo(name, tag, country, chips, 45);
                        } else {
                          inspectEntry(entry as InducteeEntry);
                        }
                      }}
                    >
                      <div className="col-span-1 font-mono">
                        {rank === 1 ? (
                          <span className="text-yellow-400 font-bold">👑 #1</span>
                        ) : rank <= 3 ? (
                          <span className="text-lg">{['', '🥇', '🥈', '🥉'][rank]}</span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{rank}</span>
                        )}
                      </div>
                      <div className="col-span-4 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(country)}</span>
                          {name}
                          {isDemo && (
                            <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                              DEMO
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{tag}</div>
                      </div>
                      <div className="col-span-2 text-lg" aria-label={badge || 'badge'}>{badgeIcon(badge)}</div>
                      <div className="col-span-3 min-w-0">
                        <div className="text-[11px] text-slate-300 truncate">{title}</div>
                      </div>
                      <div className="col-span-1 text-right font-mono font-bold text-emerald-400 tabular-nums text-[11px]">
                        {fmtChips(chips)}c
                      </div>
                      <div className="col-span-1 text-right text-[10px] font-mono text-slate-500">{date}</div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ TAB: Milestones Wing ═══════════════════ */}
      {tab === 'milestones' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/10 p-3 text-[11px] text-yellow-200 leading-relaxed">
            <strong>PERMANENT MILESTONE IMMORTALITY</strong>
            <br />
            Every player who crosses a milestone threshold gets permanently inducted.
            Players are ranked by <strong>induction order</strong> — #1 is the first to achieve that tier.
          </div>

          {/* Search + Find Me toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 p-1.5 rounded-xl border border-slate-800 bg-slate-950/80">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search by player name, tag, or clan…"
                value={mileSearch}
                onChange={(e) => setMileSearch(e.target.value)}
                className="flex-1 bg-transparent border-none text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none"
              />
              {mileSearch && (
                <button
                  type="button"
                  onClick={() => setMileSearch('')}
                  className="p-1 rounded text-slate-500 hover:text-white transition"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const myRow = mileListRef.current?.querySelector('[data-is-me="true"]');
                if (myRow) {
                  myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  myRow.classList.add('ring-2', 'ring-yellow-400/60');
                  setTimeout(() => myRow.classList.remove('ring-2', 'ring-yellow-400/60'), 2000);
                  notify('Found you in the milestones list!', 'success', onToast);
                } else {
                  notify('You are not yet inducted into any milestone. Keep banking chips!', 'info', onToast);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition border bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25 shrink-0"
            >
              <Crosshair className="w-3 h-3" /> Find Me
            </button>
          </div>

          {/* Tier filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Filter:</span>
            <button
              type="button"
              onClick={() => setMileTierFilter('all')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition border ${mileTierFilter === 'all' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
            >
              All Tiers
            </button>
            {HALL_OF_FAME_TIERS.map((t) => {
              // Build a short label: "🥉 1 Lakh", "👑 1 Crore"
              const shortLabel = t.name
                .replace(' (10,000,000) LEGENDARY', '')
                .replace(' (1 MILLION)', '')
                .replace(' CHIPS MILESTONE', '');
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMileTierFilter(t.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition border whitespace-nowrap ${mileTierFilter === t.id ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
                >
                  {t.badge.split(' ')[0]} {shortLabel}
                </button>
              );
            })}
          </div>

          {/* Loading */}
          {mileLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
              <span className="ml-2 text-xs text-slate-400">Loading milestones…</span>
            </div>
          )}

          {/* Demo data */}
          {!mileLoading && mileIsDemo && (
            <MilestonesFlatTable
              entries={DEMO_MILESTONES}
              tierFilter={mileTierFilter}
              search={mileSearch}
              isDemo
              firstAchievers={
                Object.fromEntries(
                  HALL_OF_FAME_TIERS.map((t) => [t.id, {
                    playerName: t.firstAchiever.name,
                    userTag: t.firstAchiever.userTag,
                    country: t.firstAchiever.country,
                    inductedAt: t.firstAchiever.dateStr,
                  }])
                )
              }
              listRef={mileListRef}
              myPlayerTag={player?.userTag ?? null}
              onInspectPlayer={onInspectPlayer}
            />
          )}

          {/* Real data */}
          {!mileLoading && !mileIsDemo && (
            <MilestonesFlatTable
              entries={mileEntries}
              tierFilter={mileTierFilter}
              search={mileSearch}
              firstAchievers={mileFirstAchievers}
              listRef={mileListRef}
              myPlayerTag={player?.userTag ?? null}
              onInspectPlayer={onInspectPlayer}
            />
          )}
        </div>
      )}

      {/* ═══════════════════ TAB: Live Esports Ticker ═══════════════════ */}
      {tab === 'ticker' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold text-white">Channel Filter:</span>
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
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition border ${tickerFilter === f.id ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <ol className="divide-y divide-slate-900 max-h-96 overflow-y-auto va-scroll">
              {filteredCommentary.length === 0 ? (
                <li className="p-6 text-center text-xs text-slate-500">No events in this channel yet…</li>
              ) : (
                filteredCommentary.map((c) => (
                  <li key={c.id} className="px-4 py-3 text-sm flex items-start gap-3 hover:bg-slate-900/40 transition-colors">
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5 shrink-0">{c.ts}</span>
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
