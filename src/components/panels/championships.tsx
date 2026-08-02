'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CHAMPIONSHIP_PRIZE_TIERS,
  COUNTRIES,
  INITIAL_CONTENDERS,
  countryFlag,
  type ChampionshipContender,
  type ChampionshipPrize,
} from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Sparkles,
  Timer,
  Trophy,
  Gift,
  Globe,
  MapPin,
  Flag,
  Play,
  Award,
  Swords,
  Search,
  Crosshair,
  AlertTriangle,
  X,
  Users,
  History,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ChampionshipsProps {
  onToast?: ToastFn;
}

type Scope = 'GLOBAL' | 'REGIONAL' | 'NATIONAL' | 'CLAN';
type RankFilter = 'all' | 'rank1' | 'rank2_10' | 'rank11_50' | 'rank51_100';

// Real API entry shape
interface ApiEntry {
  rank: number;
  userTag: string;
  name: string;
  country: string;
  region: string;
  bankedChips: number;
  level: number;
  clanTag: string;
  gamesPlayed: number;
  createdAt: string;
  isLive: boolean;
  isPlayer: boolean;
  prize: { chipsReward: number; crownTitle: string } | null;
  efficiency: number;
  flag: string;
}

// Clan entry from API
interface ClanEntry {
  rank: number;
  tag: string;
  totalChips: number;
  count: number;
  topChips: number;
  topName: string;
  topCountry: string;
  avgChips: number;
}

// Archive entry from API
interface ArchiveEntry {
  year: number;
  title: string;
  status: string;
  winnerTag: string | null;
  winnerName: string | null;
  winnerCountry: string | null;
  winnerClanTag: string | null;
  winnerChips: number | null;
  totalParticipants: number;
  topClanTag: string | null;
  topClanName: string | null;
  payoutsProcessed: boolean;
  finalizedAt: string | null;
}

// Player status from API
interface PlayerStatus {
  rank: number;
  bankedChips: number;
  gamesPlayed: number;
  efficiency: number;
  prize: { chipsReward: number; crownTitle: string } | null;
  gapAbove: number | null;
  gapBelow: number | null;
  aboveName: string | null;
  belowName: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const REGIONS = [
  { code: 'ALL', name: 'All Regions', flag: '🌐' },
  { code: 'APAC', name: 'Asia-Pacific (APAC)', flag: '🌏' },
  { code: 'NA', name: 'North America (NA)', flag: '🌎' },
  { code: 'EU', name: 'Europe (EU)', flag: '🌍' },
  { code: 'LATAM', name: 'Latin America (LATAM)', flag: '💃' },
];

const COUNTRY_OPTIONS = [
  { code: 'ALL', name: 'All Countries', flag: '🌐' },
  ...COUNTRIES.map((c) => ({ code: c.code, name: c.name, flag: c.flag })),
];

const MAX_GAMES = 10000;
const CHAMPIONSHIP_END_DATE = new Date('2027-01-01T00:00:00Z');

const PRIZE_TIER_VISUAL: Record<string, { border: string; bg: string; glow: string; accent: string }> = {
  RANK_1: {
    border: 'border-amber-400/50',
    bg: 'bg-gradient-to-br from-amber-950/30 via-slate-950/80 to-yellow-950/20',
    glow: 'bg-amber-400/10', accent: 'text-amber-300',
  },
  RANK_2_10: {
    border: 'border-slate-300/30',
    bg: 'bg-gradient-to-br from-slate-200/5 via-slate-950/80 to-slate-300/5',
    glow: 'bg-slate-300/5', accent: 'text-slate-200',
  },
  RANK_11_50: {
    border: 'border-orange-600/25',
    bg: 'bg-gradient-to-br from-orange-950/15 via-slate-950/80 to-orange-900/10',
    glow: 'bg-orange-500/5', accent: 'text-orange-300',
  },
  RANK_51_100: {
    border: 'border-slate-600/25',
    bg: 'bg-slate-950/80', glow: '', accent: 'text-slate-400',
  },
};

const PRIZE_SPOTS: Record<string, string> = {
  RANK_1: '1 Winner',
  RANK_2_10: '9 Spots',
  RANK_11_50: '40 Spots',
  RANK_51_100: '50 Spots',
};

// ============================================================================
// Helpers
// ============================================================================

function fmtINR(n: number) { return n.toLocaleString('en-IN'); }

function fmtEfficiency(chips: number, games: number): string {
  if (games <= 0) return '—';
  return fmtINR(Math.round(chips / games));
}

function rankCategoryOf(rank: number): Exclude<RankFilter, 'all'> {
  if (rank === 1) return 'rank1';
  if (rank <= 10) return 'rank2_10';
  if (rank <= 50) return 'rank11_50';
  return 'rank51_100';
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

function prizeForRank(rank: number): ChampionshipPrize | null {
  if (rank === 1) return CHAMPIONSHIP_PRIZE_TIERS[0];
  if (rank <= 10) return CHAMPIONSHIP_PRIZE_TIERS[1];
  if (rank <= 50) return CHAMPIONSHIP_PRIZE_TIERS[2];
  if (rank <= 100) return CHAMPIONSHIP_PRIZE_TIERS[3];
  return null;
}

function prizeColorForRank(rank: number): string {
  if (rank === 1) return 'text-amber-300';
  if (rank <= 10) return 'text-slate-200';
  if (rank <= 50) return 'text-orange-300';
  if (rank <= 100) return 'text-slate-400';
  return 'text-slate-600';
}

function matchCapWarning(played: number) {
  const remaining = MAX_GAMES - played;
  if (played >= 9900) return { level: 'critical' as const, color: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/30', label: `CRITICAL — Only ${remaining} match${remaining !== 1 ? 'es' : ''} left!`, barColor: 'from-red-600 to-red-400' };
  if (played >= 9500) return { level: 'danger' as const, color: 'text-orange-400', bg: 'bg-orange-500/10 border border-orange-500/30', label: `DANGER — ${remaining} matches remaining`, barColor: 'from-orange-500 to-amber-500' };
  if (played >= 9000) return { level: 'warning' as const, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border border-yellow-500/30', label: `CAUTION — ${remaining} matches remaining`, barColor: 'from-yellow-500 to-amber-400' };
  return { level: 'safe' as const, color: 'text-slate-400', bg: '', label: `${remaining.toLocaleString()} Championship matches remaining this year`, barColor: 'from-emerald-600 to-amber-500' };
}

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const diff = Math.max(0, target.getTime() - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

// ============================================================================
// Top 3 Podium
// ============================================================================

function ChampionshipPodium({ entries }: { entries: ApiEntry[] }) {
  const top3 = entries.slice(0, 3);
  if (top3.length < 3) return null;
  const order = [top3[1], top3[0], top3[2]];
  const styles = [
    { medal: '🥈', place: '2ND', border: 'border-slate-300/30', bg: 'from-slate-200/5 to-slate-900', accent: 'text-slate-200', glow: 'bg-slate-300/5' },
    { medal: '🥇', place: '1ST', border: 'border-amber-400/50', bg: 'from-amber-950/30 to-slate-900', accent: 'text-amber-300', glow: 'bg-amber-400/8' },
    { medal: '🥉', place: '3RD', border: 'border-orange-600/30', bg: 'from-orange-950/15 to-slate-900', accent: 'text-orange-300', glow: 'bg-orange-500/5' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
      {order.map((c, i) => (
        <div key={c.userTag} className={`relative rounded-2xl border ${styles[i].border} bg-gradient-to-b ${styles[i].bg} p-3 sm:p-4 ${i === 1 ? 'sm:-mt-2 sm:pb-6' : ''} overflow-hidden transition hover:brightness-110`}>
          <div className={`absolute top-0 right-0 w-24 h-24 ${styles[i].glow} rounded-full blur-2xl pointer-events-none`} aria-hidden />
          <div className="relative text-center">
            <div className="text-3xl sm:text-4xl mb-1">{styles[i].medal}</div>
            <div className={`text-[9px] font-mono font-bold ${styles[i].accent} uppercase tracking-widest`}>{styles[i].place} PLACE</div>
            {/* P3-5: Live dot */}
            <div className="flex items-center justify-center gap-1.5 mt-1">
              {c.isLive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>}
              <div className="text-xs sm:text-sm font-bold text-white truncate">{c.flag} {c.name}</div>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{c.userTag} · [{c.clanTag}]</div>
            <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-2">{fmtINR(c.bankedChips)}c</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{c.gamesPlayed.toLocaleString()} games · {fmtEfficiency(c.bankedChips, c.gamesPlayed)} c/game</div>
            <div className="mt-2 inline-flex items-center gap-0.5 text-[8px] font-mono text-yellow-300/80 bg-yellow-500/10 px-1.5 py-0.5 rounded-full border border-yellow-500/20">
              <Award className="w-2.5 h-2.5" /> HOF ELIGIBLE
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Past Championships Archives (P3-4)
// ============================================================================

function PastChampionships({ archives }: { archives: ArchiveEntry[] }) {
  const [open, setOpen] = useState(false);
  if (!archives.length) return null;
  return (
    <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-slate-900/40 transition">
        <span className="text-sm font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" /> Past Championship Archives
        </span>
        <span className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
          {archives.length} completed{open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-900">
          {archives.map((a) => (
            <div key={a.year} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/50">
              <div className="text-lg font-black font-mono text-slate-400 w-14">{a.year}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{a.title}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {a.totalParticipants.toLocaleString()} participants
                  {a.payoutsProcessed && <span className="text-emerald-400"> · Payouts Complete</span>}
                  {a.finalizedAt && <span> · Finalized {new Date(a.finalizedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              {a.winnerName && (
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-mono text-slate-500 uppercase">Winner</div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    🥇 {countryFlag(a.winnerCountry ?? '')} {a.winnerName}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400">{a.winnerChips ? fmtINR(a.winnerChips) : '—'}c</div>
                </div>
              )}
              {a.topClanName && (
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-mono text-slate-500 uppercase">Top Clan</div>
                  <div className="text-xs font-bold text-slate-200">{a.topClanName}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Clan Rankings Table (P3-3)
// ============================================================================

function ClanRankingsTable({ clans, hasRealData, isAdmin }: { clans: ClanEntry[]; hasRealData: boolean; isAdmin: boolean }) {
  if (!hasRealData && !isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 p-6 text-center">
        <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500">No clan data available yet. Clans appear here once members register for the championship.</p>
      </div>
    );
  }
  if (clans.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 p-6 text-center">
        <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500">No clan data available yet. Clans appear here once members register for the championship.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
      {!hasRealData && isAdmin && (
        <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-[9px] font-mono text-amber-300">· Showing demo data</div>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-2">Clan</div>
            <div className="col-span-2 text-right">Members</div>
            <div className="col-span-3 text-right">Total Chips</div>
            <div className="col-span-2 text-right">Avg Chips</div>
            <div className="col-span-2 text-right">Top Member</div>
          </div>
          <ol className="divide-y divide-slate-900 max-h-[60vh] overflow-y-auto va-scroll">
            {clans.map((c) => (
              <li key={c.tag} className="grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm hover:bg-slate-900/40 transition">
                <div className="col-span-1 font-mono text-slate-400 font-bold">
                  {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : <span>#{c.rank}</span>}
                </div>
                <div className="col-span-2">
                  <div className="font-bold text-white truncate">[{c.tag}]</div>
                </div>
                <div className="col-span-2 text-right text-xs font-mono text-slate-400 tabular-nums">{c.count}</div>
                <div className="col-span-3 text-right font-mono font-bold text-emerald-400 tabular-nums">{fmtINR(c.totalChips)}c</div>
                <div className="col-span-2 text-right text-[10px] font-mono text-cyan-400/70 tabular-nums">{fmtINR(c.avgChips)}c</div>
                <div className="col-span-2 text-right min-w-0">
                  <div className="text-[10px] text-white truncate">{countryFlag(c.topCountry)} {c.topName}</div>
                  <div className="text-[9px] font-mono text-slate-500">{fmtINR(c.topChips)}c</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function Championships({ onToast }: ChampionshipsProps) {
  const { player, refresh } = useAuth();
  const isAdmin = player?.role === 'admin';
  const listRef = useRef<HTMLOListElement>(null);
  const cd = useCountdown(CHAMPIONSHIP_END_DATE);

  // ── State ────────────────────────────────────────────────────────────────
  const [scope, setScope] = useState<Scope>('GLOBAL');
  const [region, setRegion] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [rankFilter, setRankFilter] = useState<RankFilter>('all');
  const [search, setSearch] = useState('');
  const [findMeHighlight, setFindMeHighlight] = useState(false);
  const [findMeResult, setFindMeResult] = useState<ApiEntry | null>(null);

  // P3: API-driven state
  const [registered, setRegistered] = useState(false);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ApiEntry[]>([]);
  const [clanEntries, setClanEntries] = useState<ClanEntry[]>([]);
  const [hasRealData, setHasRealData] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus | null>(null);
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);

  const warning = matchCapWarning(gamesPlayed);
  const remaining = MAX_GAMES - gamesPlayed;

  // ── Data loading helper (called from handlers, not directly in effects) ──
  const fetchStandings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ scope: scope === 'CLAN' ? 'global' : scope });
      if (scope === 'REGIONAL' && region !== 'ALL') params.set('region', region);
      if (scope === 'NATIONAL' && country !== 'ALL') params.set('country', country);
      if (rankFilter !== 'all') params.set('rankFilter', rankFilter);
      if (search.trim()) params.set('search', search);
      const res = await fetch(`/api/championship/standings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHasRealData(data.hasRealData);
        setPlayerStatus(data.playerStatus ?? null);
        setEntries(data.entries ?? []);
      }
    } catch { /* silent */ }
    if (!silent) setLoading(false);
  }, [scope, region, country, rankFilter, search]);

  const fetchClans = useCallback(async () => {
    try {
      const res = await fetch('/api/championship/standings?clanView=true');
      if (res.ok) {
        const data = await res.json();
        setClanEntries(data.entries ?? []);
        if (data.hasRealData) setHasRealData(true);
      }
    } catch { /* silent */ }
  }, []);

  // ── Mount: load registration, archives, clans ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [regRes, arcRes, clanRes] = await Promise.all([
          fetch('/api/championship/register'),
          fetch('/api/championship/archives'),
          fetch('/api/championship/standings?clanView=true'),
        ]);
        if (regRes.ok && !cancelled) {
          const d = await regRes.json();
          setRegistered(d.registered);
          setGamesPlayed(d.gamesPlayed ?? 0);
        }
        if (arcRes.ok && !cancelled) {
          const d = await arcRes.json();
          setArchives(d.archives ?? []);
        }
        if (clanRes.ok && !cancelled) {
          const d = await clanRes.json();
          setClanEntries(d.entries ?? []);
          if (d.hasRealData) setHasRealData(true);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Standings: refetch when scope/filters change ──────────────────────────
  useEffect(() => {
    if (scope === 'CLAN') return;
    let cancelled = false;
    const params = new URLSearchParams({ scope });
    if (scope === 'REGIONAL' && region !== 'ALL') params.set('region', region);
    if (scope === 'NATIONAL' && country !== 'ALL') params.set('country', country);
    if (rankFilter !== 'all') params.set('rankFilter', rankFilter);
    if (search.trim()) params.set('search', search);
    queueMicrotask(() => setLoading(true));
    fetch(`/api/championship/standings?${params}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setHasRealData(data.hasRealData); setPlayerStatus(data.playerStatus ?? null); setEntries(data.entries ?? []); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope, region, country, rankFilter, search]);

  // ── Demo fallback: merge real data with demo contenders (admin-only) ─────────
  const displayEntries = useMemo<ApiEntry[]>(() => {
    if (hasRealData) return entries;
    // No real data: only show demo fallback to admins
    if (!isAdmin) return [];
    // Admin demo: use INITIAL_CONTENDERS
    const demo: ApiEntry[] = INITIAL_CONTENDERS.map((c, i) => {
      const rank = i + 1;
      const prize = prizeForRank(rank);
      return {
        rank,
        userTag: c.userTag,
        name: c.name,
        country: c.country,
        region: c.region,
        bankedChips: c.walletChips,
        level: 0,
        clanTag: c.clanTag,
        gamesPlayed: c.gamesPlayed,
        createdAt: '',
        isLive: false, // Demo players not live
        isPlayer: false,
        prize: prize ? { chipsReward: prize.chipsReward, crownTitle: prize.crownTitle } : null,
        efficiency: c.gamesPlayed > 0 ? Math.round(c.walletChips / c.gamesPlayed) : 0,
        flag: countryFlag(c.country),
      };
    });
    // Inject real player if registered
    if (registered && player) {
      const exists = demo.find((d) => d.isPlayer);
      if (!exists) {
        const regionOf = (cc: string) => {
          if (['IN','JP','KR','SG','AU','CN','TW','TH','VN','PH','ID','MY'].includes(cc)) return 'APAC';
          if (['US','CA','MX'].includes(cc)) return 'NA';
          if (['GB','DE','FR','IT','ES','NL','PL','SE','NO','FI','DK','PT','AT','CH','BE','IE','CZ','GR'].includes(cc)) return 'EU';
          return 'LATAM';
        };
        demo.push({
          rank: 999, userTag: `#${player.userTag}`, name: player.name, country: player.country,
          region: regionOf(player.country), bankedChips: player.bankedChips, level: player.level,
          clanTag: player.clanTag || 'VPR', gamesPlayed, createdAt: '', isLive: false, isPlayer: true,
          prize: null, efficiency: gamesPlayed > 0 ? Math.round(player.bankedChips / gamesPlayed) : 0, flag: countryFlag(player.country),
        });
      }
    }
    return demo
      .sort((a, b) => b.bankedChips - a.bankedChips)
      .map((c, i) => ({ ...c, rank: i + 1 }));
  }, [hasRealData, isAdmin, entries, registered, player, gamesPlayed]);

  // ── Filtered entries (for client-side filtering of demo data) ─────────────
  const filteredEntries = useMemo(() => {
    // If API returned real data, it's already filtered server-side
    if (hasRealData) return displayEntries;
    let result = displayEntries;
    if (scope === 'REGIONAL' && region !== 'ALL') result = result.filter(c => c.region === region);
    else if (scope === 'NATIONAL' && country !== 'ALL') result = result.filter(c => c.country === country);
    if (rankFilter !== 'all') result = result.filter(c => rankCategoryOf(c.rank) === rankFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.userTag.toLowerCase().includes(q) || c.clanTag.toLowerCase().includes(q));
    }
    return result;
  }, [hasRealData, displayEntries, scope, region, country, rankFilter, search]);

  const top3 = useMemo(() => (scope === 'CLAN' ? [] : filteredEntries.slice(0, 3)), [scope, filteredEntries]);

  // ── Player summary data ──────────────────────────────────────────────────
  const mySummary = useMemo(() => {
    if (!registered || !player) return null;
    if (playerStatus) return playerStatus;
    // Fallback for demo: compute from displayEntries
    const me = displayEntries.find(c => c.isPlayer);
    if (!me) return null;
    const idx = displayEntries.indexOf(me);
    const above = idx > 0 ? displayEntries[idx - 1] : null;
    const below = idx < displayEntries.length - 1 ? displayEntries[idx + 1] : null;
    return {
      rank: me.rank, bankedChips: me.bankedChips, gamesPlayed: me.gamesPlayed,
      efficiency: me.efficiency, prize: me.prize,
      gapAbove: above ? above.bankedChips - me.bankedChips : null,
      gapBelow: below ? me.bankedChips - below.bankedChips : null,
      aboveName: above?.name ?? null, belowName: below?.name ?? null,
    };
  }, [registered, player, playerStatus, displayEntries]);

  if (!player) return <NotSignedIn />;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleRegister() {
    try {
      const res = await fetch('/api/championship/register', { method: 'POST' });
      if (res.ok) {
        setRegistered(true);
        const data = await res.json();
        setGamesPlayed(data.gamesPlayed ?? 0);
        notify('🏆 REGISTERED FOR 2026 ANNUAL VENOM WORLD CHAMPIONSHIP! You have 10,000 matches limit. Good luck!', 'success', onToast);
        fetchStandings(true); fetchClans();
      } else {
        const err = await res.json();
        notify(err.error || 'Registration failed.', 'error', onToast);
      }
    } catch {
      notify('Network error during registration.', 'error', onToast);
    }
  }

  async function handlePlayMatch() {
    if (!registered) { notify('Register first to play championship matches!', 'error', onToast); return; }
    if (remaining <= 0) { notify('You have reached the 10,000 championship match cap for this year!', 'error', onToast); return; }
    try {
      const res = await fetch('/api/championship/play', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setGamesPlayed(data.gamesPlayed);
        notify('Entering Championship High-Stakes Arena match...', 'info', onToast);
        void refresh();
        // Refresh standings after a short delay to pick up chip changes
        setTimeout(() => { fetchStandings(true); fetchClans(); }, 2000);
      } else {
        const err = await res.json();
        notify(err.error || 'Failed to start match.', 'error', onToast);
      }
    } catch {
      // Fallback for demo mode: just increment locally
      setGamesPlayed(g => g + 1);
      notify('Entering Championship High-Stakes Arena match...', 'info', onToast);
      void refresh();
    }
  }

  function handleFindMe() {
    setFindMeResult(null);
    if (!registered || !player) { notify('Register for the championship first!', 'error', onToast); return; }
    const myRow = listRef.current?.querySelector<HTMLElement>('[data-champ-me="true"]');
    if (myRow) {
      myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFindMeHighlight(true);
      setTimeout(() => setFindMeHighlight(false), 3000);
      notify('Found you in the standings!', 'success', onToast);
    } else if (mySummary) {
      const me = displayEntries.find(c => c.isPlayer);
      if (me) { setFindMeResult(me); notify(`You're ranked #${me.rank} globally — not visible in current filter.`, 'info', onToast); }
      else { notify('Could not find your championship entry.', 'error', onToast); }
    }
  }

  function handleScopeChange(s: Scope) {
    setScope(s);
    setRegion('ALL');
    setCountry('ALL');
    setRankFilter('all');
    setSearch('');
    setFindMeResult(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-amber-500/10" className="-top-12 -right-12 w-64 h-64" />

      {/* ═══ HERO BANNER ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-indigo-950/40 p-5 sm:p-7 border border-amber-500/30 shadow-md mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden />
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-widest">OFFICIAL 1-YEAR TOURNAMENT</span>
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[9px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-widest">
            <Activity className="w-3 h-3" /> DB-BACKED REGISTRATION
          </span>
          <span className="inline-flex items-center gap-1 bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-[9px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-widest">
            <Sparkles className="w-3 h-3" /> JAN 1 HALL OF FAME PAYOUT
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">2026 ANNUAL VENOM WORLD CHAMPIONSHIP</h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
          Join anytime during the year! Play up to 10,000 games. When the year ends, players with the maximum wallet chips across Global, Regional, and Country leaderboards will be awarded massive chip prizes and permanently inducted into the Hall of Fame on January 1st!
        </p>
        <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-amber-500/30">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300"><Timer className="w-4 h-4" /> YEAR-END FINALE &amp; JAN 1 PAYOUT IN:</span>
            <span className="text-[10px] font-mono text-slate-500">Payout Date: Midnight UTC, 01 January 2027</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[{ v: cd.days, l: 'Days' }, { v: cd.hours, l: 'Hours' }, { v: cd.minutes, l: 'Mins' }, { v: cd.seconds, l: 'Secs' }].map((t) => (
              <div key={t.l} className="text-center bg-slate-900 border border-slate-800 rounded-lg py-2.5">
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tabular-nums">{pad2(t.v)}</div>
                <div className="text-[9px] font-mono uppercase text-slate-500 mt-0.5">{t.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ PAST CHAMPIONSHIP ARCHIVES (P3-4) ═══ */}
      <PastChampionships archives={archives} />

      {/* ═══ MY CHAMPIONSHIP SUMMARY ═══ */}
      {!registered ? (
        <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-950/10 p-5 mb-6 text-center">
          <Trophy className="w-8 h-8 text-amber-400/60 mx-auto mb-2" />
          <p className="text-sm font-bold text-white">Register for the 2026 Championship</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">Join the annual tournament to track your ranking, projected prizes, and compete for the Hall of Fame induction on January 1st!</p>
          <button type="button" onClick={handleRegister} className="mt-3 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 mx-auto">
            <Trophy className="w-4 h-4" /> REGISTER NOW — FREE ENTRY
          </button>
        </div>
      ) : mySummary ? (
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/15 to-slate-950/60 p-4 sm:p-5 mb-6 shadow-md">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-sm font-bold text-white flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-400" /> My Championship Summary</span>
            <span className="text-[10px] font-mono text-amber-300 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full">Global Ranking</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <MicroLabel>PROJECTED RANK</MicroLabel>
              <div className="text-xl font-black font-mono text-amber-300 mt-1">#{mySummary.rank}</div>
              <div className="text-[9px] font-mono text-slate-500 mt-0.5">{mySummary.rank <= 100 ? 'HOF Eligible' : 'Outside Top 100'}</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <MicroLabel>PROJECTED PRIZE</MicroLabel>
              {mySummary.prize ? (<><div className="text-sm font-bold text-emerald-400 mt-1">+{fmtINR(mySummary.prize.chipsReward)}c</div><div className="text-[9px] font-mono text-slate-400 mt-0.5 truncate">{mySummary.prize.crownTitle}</div></>) : (<div className="text-sm font-bold text-slate-500 mt-1">— None</div>)}
            </div>
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <MicroLabel>AVG CHIPS / GAME</MicroLabel>
              <div className="text-lg font-bold font-mono text-cyan-300 mt-1">{mySummary.efficiency > 0 ? fmtINR(mySummary.efficiency) : '—'}</div>
              <div className="text-[9px] font-mono text-slate-500 mt-0.5">{gamesPlayed.toLocaleString()} games played</div>
            </div>
            {mySummary.gapAbove !== null && mySummary.aboveName ? (
              <div className="p-3 rounded-xl border border-red-500/15 bg-red-950/10">
                <MicroLabel>▲ PLAYER AHEAD</MicroLabel>
                <div className="text-xs font-bold text-white mt-1 truncate">{mySummary.aboveName}</div>
                <div className="text-[10px] font-mono text-red-300 mt-0.5">+{fmtINR(mySummary.gapAbove)} chips ahead</div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-amber-500/15 bg-amber-950/10">
                <MicroLabel>▲ POSITION</MicroLabel>
                <div className="text-xs font-bold text-amber-300 mt-1">👑 You're #1!</div>
                <div className="text-[9px] font-mono text-slate-500 mt-0.5">Nobody ahead of you</div>
              </div>
            )}
            {mySummary.gapBelow !== null && mySummary.belowName ? (
              <div className="p-3 rounded-xl border border-emerald-500/15 bg-emerald-950/10">
                <MicroLabel>▼ PLAYER BEHIND</MicroLabel>
                <div className="text-xs font-bold text-white mt-1 truncate">{mySummary.belowName}</div>
                <div className="text-[10px] font-mono text-emerald-300 mt-0.5">{fmtINR(mySummary.gapBelow)} chips behind you</div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
                <MicroLabel>▼ PLAYER BEHIND</MicroLabel>
                <div className="text-xs font-bold text-slate-500 mt-1">—</div>
                <div className="text-[9px] font-mono text-slate-600 mt-0.5">Last in standings</div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ═══ PLAYER DOSSIER ═══ */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5 mb-6 shadow-md">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white"><Swords className="w-4 h-4 text-indigo-400" /> Matches Limit Progress:</span>
          <span className="text-xs font-mono text-slate-300">{gamesPlayed.toLocaleString()} / 10,000 Played</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mb-3">
          <div className={`h-full bg-gradient-to-r ${warning.barColor} rounded-full transition-colors duration-500`} style={{ width: `${Math.min(100, (gamesPlayed / MAX_GAMES) * 100)}%` }} />
        </div>
        {warning.level !== 'safe' ? (
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-2 mb-3 text-[11px] font-bold ${warning.bg} ${warning.color}`}><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{warning.label}</div>
        ) : (
          <p className="text-[11px] text-slate-400 mb-4">{warning.label}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <MicroLabel>COMPETING WALLET CHIPS</MicroLabel>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">{fmtINR(player.bankedChips)} Chips</div>
            <p className="text-[10px] text-slate-500 mt-0.5">Max chips at year-end decides rank!</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <MicroLabel>STATUS</MicroLabel>
            <div className="text-sm font-bold text-white mt-1">{registered ? '✅ Registered & Active in 2026 Championship' : 'Free Entry | Join Anytime'}</div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center gap-2">
            {!registered ? (
              <button type="button" onClick={handleRegister} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5"><Trophy className="w-4 h-4" /> JOIN 2026 CHAMPIONSHIP NOW</button>
            ) : (
              <button type="button" onClick={handlePlayMatch} className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5"><Play className="w-3.5 h-3.5 fill-current" /> PLAY CHAMPIONSHIP MATCH</button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PRIZE TIERS ═══ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2"><Gift className="w-5 h-5 text-amber-400" /> Jan 1st Payout &amp; Hall of Fame Tiers</h2>
          <span className="text-[10px] font-mono text-slate-500">Awarded automatically on 01 January</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CHAMPIONSHIP_PRIZE_TIERS.map((tier) => {
            const vis = PRIZE_TIER_VISUAL[tier.category] ?? PRIZE_TIER_VISUAL.RANK_51_100;
            const spots = PRIZE_SPOTS[tier.category] ?? '';
            return (
              <div key={tier.category} className={`relative p-4 rounded-2xl border ${vis.border} ${vis.bg} shadow-md overflow-hidden`}>
                <div className={`absolute top-0 right-0 w-32 h-32 ${vis.glow} rounded-full blur-3xl pointer-events-none`} aria-hidden />
                <div className="relative">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className={`text-[10px] font-mono ${vis.accent}`}>{tier.badge}</div>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${vis.border} ${vis.accent} bg-slate-950/50`}>{spots}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{tier.title}</h3>
                  <div className="mt-2 text-lg font-black font-mono text-emerald-400">+{fmtINR(tier.chipsReward)} CHIPS</div>
                  <div className="text-[11px] text-slate-400 mt-1">Crown Title: <span className="text-white font-bold">{tier.crownTitle}</span></div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-400" /> {tier.itemReward}</div>
                  {tier.hallOfFameInduction && <div className="text-[11px] text-yellow-300 mt-1 flex items-center gap-1"><Award className="w-3 h-3" /> Permanent Hall of Fame Inscription</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ TOOLBAR: Scope Tabs + Find Me + Search ═══ */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-4">
        <ScopeTab active={scope === 'GLOBAL'} onClick={() => handleScopeChange('GLOBAL')} icon={Globe} label="GLOBAL" />
        <ScopeTab active={scope === 'REGIONAL'} onClick={() => handleScopeChange('REGIONAL')} icon={MapPin} label="REGIONAL" />
        <ScopeTab active={scope === 'NATIONAL'} onClick={() => handleScopeChange('NATIONAL')} icon={Flag} label="NATIONAL" />
        {/* P3-3: Clan tab */}
        <ScopeTab active={scope === 'CLAN'} onClick={() => handleScopeChange('CLAN')} icon={Users} label="CLAN" />
        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-7 py-1.5 text-[10px] text-white font-mono w-28 sm:w-40 focus:outline-none focus:border-amber-500/50 placeholder:text-slate-600" />
            {search && <button type="button" onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Clear search"><X className="w-3 h-3" /></button>}
          </div>
          <button type="button" onClick={handleFindMe} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition border border-amber-500/30 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"><Crosshair className="w-3 h-3" /> Find Me</button>
        </div>
      </div>

      {/* Filters row */}
      {scope !== 'CLAN' && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {scope === 'REGIONAL' && (
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/50">
              {REGIONS.map((r) => (<option key={r.code} value={r.code}>{r.flag} {r.name}</option>))}
            </select>
          )}
          {scope === 'NATIONAL' && (
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/50">
              {COUNTRY_OPTIONS.map((c) => (<option key={c.code} value={c.code}>{c.flag} {c.name}</option>))}
            </select>
          )}
          <span className="text-[10px] font-mono text-slate-500 sm:ml-auto">Rank:</span>
          {(
            [{ id: 'all', label: 'All' }, { id: 'rank1', label: '👑 #1' }, { id: 'rank2_10', label: '🥈 2–10' }, { id: 'rank11_50', label: '🥉 11–50' }, { id: 'rank51_100', label: '🛡️ 51–100' }] as const
          ).map((f) => (
            <button key={f.id} type="button" onClick={() => setRankFilter(f.id)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition border ${rankFilter === f.id ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}>{f.label}</button>
          ))}
        </div>
      )}

      {/* Find Me Result Card */}
      {findMeResult && (
        <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-950/15">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><Crosshair className="w-3.5 h-3.5" /> Your Global Position</span>
            <button type="button" onClick={() => setFindMeResult(null)} className="text-slate-500 hover:text-white transition" aria-label="Close"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><MicroLabel>GLOBAL RANK</MicroLabel><div className="text-sm font-bold text-white font-mono">#{findMeResult.rank}</div></div>
            <div><MicroLabel>WALLET CHIPS</MicroLabel><div className="text-sm font-bold text-emerald-400 font-mono">{fmtINR(findMeResult.bankedChips)}c</div></div>
            <div><MicroLabel>PROJECTED PRIZE</MicroLabel><div className={`text-xs font-bold mt-0.5 ${prizeColorForRank(findMeResult.rank)}`}>{findMeResult.prize ? `+${fmtINR(findMeResult.prize.chipsReward)}c` : '— Outside Top 100'}</div></div>
            <div><MicroLabel>GAMES PLAYED</MicroLabel><div className="text-sm font-bold text-slate-300 font-mono">{findMeResult.gamesPlayed.toLocaleString()}</div></div>
          </div>
        </div>
      )}

      {/* Top 3 Podium (Global, no filters, no search) */}
      {scope === 'GLOBAL' && rankFilter === 'all' && !search.trim() && top3.length >= 3 && <ChampionshipPodium entries={top3} />}

      {/* ═══ STANDINGS ═══ */}
      {scope === 'CLAN' ? (
        /* P3-3: Clan Rankings View */
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-cyan-400" /> Clan Championship Rankings</h3>
            <span className="text-[9px] font-mono text-slate-500">{clanEntries.length} clan{clanEntries.length !== 1 ? 's' : ''}</span>
          </div>
          <ClanRankingsTable clans={clanEntries} hasRealData={hasRealData} isAdmin={isAdmin} />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white">
              2026 Championship Standings
              {scope === 'REGIONAL' && region !== 'ALL' && ` · ${region}`}
              {scope === 'NATIONAL' && country !== 'ALL' && ` · ${country}`}
              {!hasRealData && isAdmin && ' · Showing demo data'}
            </h3>
            <span className="text-[9px] font-mono text-slate-500">{filteredEntries.length} contender{filteredEntries.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            {!hasRealData && isAdmin && <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-[9px] font-mono text-amber-300">· Showing demo data — register and play to appear in real standings</div>}
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-3">Contender</div>
                  <div className="col-span-2">Tag</div>
                  <div className="col-span-1 text-right">Games</div>
                  <div className="col-span-1 text-right">c/game</div>
                  <div className="col-span-2 text-right">Wallet Chips</div>
                  <div className="col-span-2 text-right">Projected Prize</div>
                </div>
                {/* Body */}
                <ol ref={listRef} className="divide-y divide-slate-900 max-h-[60vh] overflow-y-auto va-scroll">
                  {loading ? (
                    <li className="p-8 text-center text-xs text-slate-500 animate-pulse">Loading standings...</li>
                  ) : filteredEntries.length === 0 ? (
                    <li className="p-6 text-center text-xs text-slate-500">{!hasRealData && !isAdmin ? 'No championship contenders yet. Register and play to appear in the standings!' : 'No contenders match the current filters.'}</li>
                  ) : filteredEntries.map((c) => {
                    const isMe = c.isPlayer;
                    const isDemo = isAdmin && !hasRealData && !isMe;
                    const prize = c.prize ?? prizeForRank(c.rank);
                    return (
                      <li key={c.userTag + c.rank} data-champ-me={isMe ? 'true' : undefined} className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm transition-all duration-500 ${isMe && findMeHighlight ? 'bg-amber-500/20 border-l-2 border-amber-400 ring-1 ring-inset ring-amber-400/40' : isMe ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}>
                        {/* Rank */}
                        <div className="col-span-1 font-mono flex items-center gap-0.5">
                          {c.rank === 1 ? <span className="text-lg">🥇</span> : c.rank === 2 ? <span className="text-lg">🥈</span> : c.rank === 3 ? <span className="text-lg">🥉</span> : <span className="text-slate-400 font-bold">#{c.rank}</span>}
                          {/* P3-5: Live dot */}
                          {c.isLive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>}
                          {isMe && <span className="text-[8px] bg-amber-500 text-black px-1 rounded font-bold ml-0.5">YOU</span>}
                        </div>
                        {/* Name + DEMO badge */}
                        <div className="col-span-3 min-w-0">
                          <div className="font-bold text-white truncate flex items-center gap-1.5">
                            <span aria-hidden className="shrink-0">{c.flag}</span>
                            <span className="truncate">{c.name}</span>
                            {isDemo && <span className="text-[7px] font-mono text-slate-500 bg-slate-800 px-1 py-px rounded shrink-0">DEMO</span>}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate">[{c.clanTag}] · {c.region}</div>
                        </div>
                        {/* Tag */}
                        <div className="col-span-2 text-[10px] font-mono text-slate-500 truncate">{c.userTag}</div>
                        {/* Games */}
                        <div className="col-span-1 text-right text-xs font-mono text-slate-400 tabular-nums">{c.gamesPlayed.toLocaleString()}</div>
                        {/* Efficiency */}
                        <div className="col-span-1 text-right text-[10px] font-mono text-cyan-400/60 tabular-nums">{c.efficiency > 0 ? fmtINR(c.efficiency) : '—'}</div>
                        {/* Wallet Chips */}
                        <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{fmtINR(c.bankedChips)}c</div>
                        {/* Dynamic prize */}
                        <div className="col-span-2 text-right">
                          {prize ? (
                            <div className="leading-tight">
                              <div className={`text-[10px] font-mono font-bold ${prizeColorForRank(c.rank)}`}>+{fmtINR(prize.chipsReward)}c</div>
                              <div className="text-[8px] font-mono text-slate-500 truncate">{prize.crownTitle}</div>
                            </div>
                          ) : <span className="text-[10px] font-mono text-slate-600">— Outside Top 100</span>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ScopeTab utility
// ============================================================================

interface ScopeTabProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Globe;
  label: string;
}

function ScopeTab({ active, onClick, icon: Icon, label }: ScopeTabProps) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${active ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

export default Championships;
