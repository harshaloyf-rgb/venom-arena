'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  COUNTRIES,
  MILESTONE_TIERS,
  countryFlag,
  countryName,
  milestoneTierForChips,
  type InspectedPlayer,
} from '@/lib/game-config';
import type { LeaderboardEntry } from '@/lib/types';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Trophy,
  Crown,
  Globe,
  Medal,
  Zap,
  Search,
  Loader2,
  RefreshCw,
  MapPin,
  Inbox,
  Radio,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Crosshair,
  Users,
  Info,
  X,
} from 'lucide-react';

interface LeaderboardsProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type TopTab = 'summit' | 'global' | 'national' | 'regional' | 'tiers';

const RANK_MEDALS: Record<number, string> = { 1: '\u{1F947}', 2: '\u{1F948}', 3: '\u{1F949}' };

// ── Regional mapping ──────────────────────────────────────────────
const REGION_MAP: Record<string, string> = {
  IN: 'APAC', JP: 'APAC', KR: 'APAC', SG: 'APAC', AU: 'APAC', CN: 'APAC', TW: 'APAC', TH: 'APAC', VN: 'APAC', PH: 'APAC', ID: 'APAC', MY: 'APAC',
  US: 'NA', CA: 'NA', MX: 'NA',
  GB: 'EU', DE: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', NL: 'EU', PL: 'EU', SE: 'EU', NO: 'EU', FI: 'EU', DK: 'EU', PT: 'EU', AT: 'EU', CH: 'EU', BE: 'EU', IE: 'EU', CZ: 'EU', GR: 'EU',
  BR: 'LATAM', AR: 'LATAM', CO: 'LATAM', CL: 'LATAM', PE: 'LATAM',
};

const REGIONS = [
  { code: 'APAC', name: 'Asia-Pacific', flag: '\u{1F30F}' },
  { code: 'NA', name: 'North America', flag: '\u{1F30E}' },
  { code: 'EU', name: 'Europe', flag: '\u{1F30D}' },
  { code: 'LATAM', name: 'Latin America', flag: '\u{1F483}' },
];

function regionOf(countryCode: string): string {
  return REGION_MAP[countryCode] || 'EU';
}

// ── Championship prize tier for a given rank ───────────────────────
function championshipPrizeForRank(rank: number) {
  if (rank === 1) return { label: '\u{1F451} World Champion', color: '#fbbf24' };
  if (rank <= 10) return { label: '\u{1F948} Elite 10', color: '#cbd5e1' };
  if (rank <= 50) return { label: '\u{1F949} Masters 50', color: '#b45309' };
  if (rank <= 100) return { label: '\u{1F6E1}\u{FE0F} Qualifier 100', color: '#64748b' };
  return null;
}

// ── Extended milestone tiers including Rookie ──────────────────────
const ALL_MILESTONE_TIERS = [
  { id: 'all', name: 'All Tiers', minChips: 0, badge: '\u2b50 All', color: '#94a3b8' },
  { id: 'rookie', name: 'Rookie (Below 100K)', minChips: 0, badge: '\u{1F6E1}\u{FE0F} Rookie', color: '#64748b' },
  ...MILESTONE_TIERS.filter((t) => t.id !== 'all'),
];

// ── Tab descriptions ──────────────────────────────────────────────
const TAB_DESCRIPTIONS: Record<TopTab, { title: string; desc: string; scope: string }> = {
  summit: {
    title: 'World Cup Summit',
    desc: 'Only the #1 ranked player from each country competes here. Think of it as the Olympics — one champion per nation, battling for the World Championship title.',
    scope: '1 player per country → ranked by banked chips',
  },
  global: {
    title: 'Global Rankings',
    desc: 'Every single player in the world, ranked #1 to N by total banked chips. This is the main leaderboard — all players, one unified ranking.',
    scope: 'All players worldwide → ranked by banked chips',
  },
  national: {
    title: 'National Rankings',
    desc: 'Players from your selected country only, ranked against each other. See who dominates your home turf.',
    scope: 'Players from 1 country → ranked by banked chips',
  },
  regional: {
    title: 'Regional Rankings',
    desc: 'Players grouped by world region (APAC, NA, EU, LATAM). See how you stack up against your geographic neighbors.',
    scope: 'Players from 1 region → ranked by banked chips',
  },
  tiers: {
    title: 'Milestone Tiers',
    desc: 'Players who reached specific chip milestones. Select a tier to see who achieved it. Think of it as a "hall of achievers" grouped by how much they have banked.',
    scope: 'Filtered by chip milestone threshold',
  },
};

// ── Demo entries (shown only when real data is empty) ─────────────
const DEMO_ENTRIES: LeaderboardEntry[] = [
  { name: 'Demo_Player_Alpha', userTag: 'DEMO-001', country: 'IN', bankedChips: 500_000, level: 25, rank: 1 },
  { name: 'Demo_Player_Beta', userTag: 'DEMO-002', country: 'US', bankedChips: 320_000, level: 20, rank: 2 },
  { name: 'Demo_Player_Gamma', userTag: 'DEMO-003', country: 'JP', bankedChips: 150_000, level: 14, rank: 3 },
];

// ── Types ─────────────────────────────────────────────────────────
interface EnrichedEntry extends LeaderboardEntry {
  clanTag?: string | null;
  isHOF?: boolean;
  championshipPrize?: { label: string; color: string } | null;
  rankChange?: number;
  region?: string;
  milestoneBadge?: string;
  milestoneColor?: string;
  isDemo?: boolean;
}

interface MyRankData {
  globalRank: number;
  nationalRank: number;
  regionalRank: number;
  region: string;
  regionName: string;
  country: string;
  bankedChips: number;
  level: number;
  clanTag: string | null;
  tier: string;
  tierName: string;
  totalGlobal: number;
  totalNational: number;
  totalRegional: number;
}

// ── Sub-components ─────────────────────────────────────────────────

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <Inbox className="w-10 h-10 mb-3 text-slate-600" />
      <p className="text-sm font-medium">{message || 'No entries yet'}</p>
    </div>
  );
}

function TabBtn({
  active, onClick, icon: Icon, label, color,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Crown;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border whitespace-nowrap ${
        active
          ? `border ${color}/40 ${color.replace('#', 'text-')}`
          : 'text-slate-500 hover:text-slate-300 border-transparent'
      }`}
      style={active ? { borderColor: color, color: color, backgroundColor: color + '1a' } : undefined}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// Rank change indicator (not used for real data — placeholder for future rank history)
function RankChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <Minus className="w-3 h-3 text-slate-600" />;
  if (change > 0) return <span className="inline-flex items-center gap-0.5 text-emerald-400 font-mono text-[10px] font-bold"><TrendingUp className="w-3 h-3" />+{change}</span>;
  return <span className="inline-flex items-center gap-0.5 text-red-400 font-mono text-[10px] font-bold"><TrendingDown className="w-3 h-3" />{change}</span>;
}

// Top 3 Podium for Global tab
function GlobalPodium({ entries, onInspect }: { entries: EnrichedEntry[]; onInspect: (e: EnrichedEntry) => void }) {
  if (entries.length < 3) return null;
  const top3 = entries.slice(0, 3);
  // Display order: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]];
  const heights = ['h-28', 'h-36', 'h-22'];
  const sizes = ['text-base', 'text-2xl', 'text-sm'];
  const chipColors = ['text-slate-300', 'text-amber-400', 'text-amber-600'];
  const borderColors = ['border-slate-500/40', 'border-amber-500/60', 'border-amber-700/40'];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
      {order.map((p, i) => (
        <button
          key={p.userTag}
          type="button"
          onClick={() => onInspect(p)}
          className={`relative flex flex-col items-center justify-end rounded-2xl border ${borderColors[i]} bg-slate-950/80 p-3 pb-4 transition hover:brightness-125 cursor-pointer`}
        >
          {/* Medal */}
          <div className={`absolute top-2 ${sizes[i]} font-bold`}>{RANK_MEDALS[p.rank]}</div>
          {/* Avatar circle */}
          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 ${borderColors[i]} flex items-center justify-center text-lg sm:text-xl mb-2`}>
            {countryFlag(p.country)}
          </div>
          <div className="font-bold text-white text-xs sm:text-sm truncate max-w-full text-center">{p.name}</div>
          <div className="text-[10px] font-mono text-slate-500">{p.userTag}</div>
          <div className={`font-mono font-black ${chipColors[i]} text-xs sm:text-sm mt-1`}>{p.bankedChips.toLocaleString()}c</div>
          {/* Clan tag */}
          {p.clanTag && (
            <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded mt-1">[{p.clanTag}]</span>
          )}
          {/* Demo badge */}
          {p.isDemo && (
            <span className="absolute -top-1 -right-1 text-[9px] bg-slate-600 text-slate-300 px-1 rounded font-bold">DEMO</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Live Ticker mini-bar
function LiveTicker({ messages }: { messages: { id: string; ts: string; text: string }[] }) {
  const tickerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [messages.length]);

  if (messages.length === 0) return null;
  const msg = messages[currentIndex];

  return (
    <div className="relative mb-4 rounded-xl border border-rose-500/20 bg-rose-950/10 p-2.5 flex items-center gap-3 overflow-hidden">
      <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-rose-300 uppercase tracking-widest px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 rounded shrink-0">
        <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
      </span>
      <div ref={tickerRef} className="text-xs text-rose-200/90 truncate flex-1">{msg.text}</div>
      <span className="text-[9px] font-mono text-slate-600 shrink-0">{msg.ts}</span>
    </div>
  );
}

// Find Me rank card (shown as a floating card when player not in visible list)
function FindMeCard({ myRank, onClose }: { myRank: MyRankData; onClose: () => void }) {
  return (
    <div className="relative rounded-xl p-4 mb-4 border border-amber-500/40 bg-amber-950/20 animate-in fade-in slide-in-from-top-2 duration-300">
      <button type="button" onClick={onClose} className="absolute top-2 right-2 text-slate-500 hover:text-white transition"><X className="w-4 h-4" /></button>
      <div className="flex items-center gap-2 mb-3">
        <Crosshair className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-amber-300 uppercase tracking-widest font-mono">Your Rank Summary</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Global</div>
          <div className="text-lg font-black text-amber-400 tabular-nums">#{myRank.globalRank}<span className="text-[10px] text-slate-500 font-normal ml-1">/ {myRank.totalGlobal}</span></div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">National ({myRank.country})</div>
          <div className="text-lg font-black text-emerald-400 tabular-nums">#{myRank.nationalRank}<span className="text-[10px] text-slate-500 font-normal ml-1">/ {myRank.totalNational}</span></div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Regional ({myRank.regionName})</div>
          <div className="text-lg font-black text-pink-400 tabular-nums">#{myRank.regionalRank}<span className="text-[10px] text-slate-500 font-normal ml-1">/ {myRank.totalRegional}</span></div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Milestone</div>
          <div className="text-sm font-bold" style={{ color: milestoneTierForChips(myRank.bankedChips).color }}>{myRank.tier}</div>
          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{myRank.tierName}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-slate-400">
        <span>Chips: <span className="text-emerald-400 font-bold">{myRank.bankedChips.toLocaleString()}c</span></span>
        <span>·</span>
        <span>Level: <span className="text-white font-bold">{myRank.level}</span></span>
        {myRank.clanTag && <><span>·</span><span>Clan: <span className="text-cyan-300 font-bold">[{myRank.clanTag}]</span></span></>}
      </div>
    </div>
  );
}

// Tab description banner
function TabDescription({ tab }: { tab: TopTab }) {
  const info = TAB_DESCRIPTIONS[tab];
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-xs font-bold text-white mb-1">{info.title}</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">{info.desc}</p>
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
            <span className="text-slate-400">Scope:</span> {info.scope}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────

export function Leaderboards({ onToast, onInspectPlayer }: LeaderboardsProps) {
  const { player } = useAuth();
  const [activeTab, setActiveTab] = useState<TopTab>('summit');
  const [selectedCountry, setSelectedCountry] = useState<string>(player?.country || 'IN');
  const [selectedRegion, setSelectedRegion] = useState<string>('APAC');
  const [selectedTierId, setSelectedTierId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tickerMessages, setTickerMessages] = useState<{ id: string; ts: string; text: string }[]>([]);
  const [showFindMe, setShowFindMe] = useState(false);
  const [myRankData, setMyRankData] = useState<MyRankData | null>(null);
  const [isRealData, setIsRealData] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  const playerTag = player?.userTag;

  // Fetch board data from API based on active tab
  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: 'chips', limit: '1000' });

      switch (activeTab) {
        case 'summit':
          params.set('view', 'world_summit');
          break;
        case 'global':
          params.set('view', 'global');
          break;
        case 'national':
          params.set('view', 'national');
          params.set('country', selectedCountry);
          break;
        case 'regional':
          params.set('view', 'regional');
          params.set('region', selectedRegion);
          break;
        case 'tiers':
          params.set('view', 'global');
          if (selectedTierId !== 'all') {
            params.set('milestone', selectedTierId);
          }
          break;
      }

      const res = await fetch(`/api/leaderboard?${params.toString()}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as {
        entries?: Array<{
          userTag: string; name: string; country: string; bankedChips: number;
          level: number; rank: number; isPlayer?: boolean; clanTag?: string | null;
          region?: string; milestoneBadge?: string; milestoneColor?: string;
        }>; error?: string;
      };

      if (res.ok && data.entries && data.entries.length > 0) {
        const enriched: EnrichedEntry[] = data.entries.map((e) => ({
          ...e,
          isPlayer: e.userTag === playerTag,
          isHOF: false,
          championshipPrize: championshipPrizeForRank(e.rank),
          rankChange: 0,
          region: e.region || regionOf(e.country || ''),
          isDemo: false,
        }));
        setEntries(enriched);
        setIsRealData(true);
      } else {
        // No real data — show demo entries
        const demo: EnrichedEntry[] = DEMO_ENTRIES.map((e, i) => ({
          ...e,
          rank: i + 1,
          isPlayer: false,
          isHOF: false,
          championshipPrize: null,
          rankChange: 0,
          region: regionOf(e.country),
          isDemo: true,
          clanTag: null,
        }));
        setEntries(demo);
        setIsRealData(false);
      }
      setLastUpdated(new Date());
    } catch {
      // On error, show demo entries
      const demo: EnrichedEntry[] = DEMO_ENTRIES.map((e, i) => ({
        ...e,
        rank: i + 1,
        isPlayer: false,
        isHOF: false,
        championshipPrize: null,
        rankChange: 0,
        region: regionOf(e.country),
        isDemo: true,
        clanTag: null,
      }));
      setEntries(demo);
      setIsRealData(false);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedCountry, selectedRegion, selectedTierId, playerTag]);

  // Fetch board when tab/selection changes
  useEffect(() => { void fetchBoard(); }, [fetchBoard]);

  // Auto-refresh every 30 min
  useEffect(() => {
    const id = setInterval(() => void fetchBoard(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchBoard]);

  // Live ticker
  useEffect(() => {
    const id = setInterval(() => {
      if (!isRealData) return;
      const names = ['A player', 'Someone', 'A challenger', 'A rival', 'A warrior'];
      const name = names[Math.floor(Math.random() * names.length)];
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      const chips = 50_000 + Math.floor(Math.random() * 5_000_000);
      const templates = [
        `\u{1F3A4} ${name} from ${country.name} ${country.flag} extracted ${chips.toLocaleString('en-IN')} chips!`,
        `\u{1F4A5} ${name} ${country.flag} eliminated a rival and claimed ${(chips / 2).toLocaleString('en-IN')} chips!`,
        `\u{1F451} ${name} ${country.flag} reached a new milestone tier!`,
      ];
      const text = templates[Math.floor(Math.random() * templates.length)];
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
      setTickerMessages((prev) => [{ id: `c-${Date.now()}`, ts, text }, ...prev].slice(0, 20));
    }, 8000);
    return () => clearInterval(id);
  }, [isRealData]);

  // Sync selected country with player's country when it changes
  useEffect(() => {
    if (player?.country) setSelectedCountry(player.country);
  }, [player?.country]);

  // Filter by search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) =>
      e.name.toLowerCase().includes(q) || e.userTag.toLowerCase().includes(q) || (e.clanTag && e.clanTag.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  if (!player) return <NotSignedIn />;

  function inspectPlayer(e: EnrichedEntry) {
    if (!onInspectPlayer) return;
    const tier = milestoneTierForChips(e.bankedChips);
    onInspectPlayer({
      name: e.name, userTag: e.userTag, country: e.country,
      flag: countryFlag(e.country), bankedChips: e.bankedChips, level: e.level,
      clanTag: e.clanTag || '—', clanName: 'Clan ' + (e.clanTag || '—'),
      achievedAt: new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC',
      globalRank: e.rank, countryRank: Math.max(1, Math.floor(e.rank / 1.4)),
      regionalRank: Math.max(1, Math.floor(e.rank / 2)),
    });
    void tier;
  }

  // Find Me handler — fetches from API and either scrolls to player or shows rank card
  async function handleFindMe() {
    try {
      const res = await fetch('/api/leaderboard/my-rank', { cache: 'no-store' });
      const data = await res.json() as { error?: string } & MyRankData;

      if (!res.ok || data.error) {
        notify('Could not fetch your rank. Try again.', 'error', onToast);
        return;
      }

      setMyRankData(data);

      // First try to find the player in the current visible list
      const myRow = listRef.current?.querySelector('[data-is-me="true"]');
      if (myRow) {
        myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        myRow.classList.add('ring-2', 'ring-amber-400/60');
        setTimeout(() => myRow.classList.remove('ring-2', 'ring-amber-400/60'), 2000);
        notify('Found you on the leaderboard!', 'success', onToast);
      } else {
        // Player not in visible list — show rank summary card
        setShowFindMe(true);
        notify(`You are #${data.globalRank} globally. See your rank summary below!`, 'info', onToast);
      }
    } catch {
      notify('Could not fetch your rank. Check your connection.', 'error', onToast);
    }
  }

  const tabs: { id: TopTab; icon: typeof Crown; label: string; color: string }[] = [
    { id: 'summit', icon: Crown, label: 'Summit', color: '#f59e0b' },
    { id: 'global', icon: Globe, label: 'Global', color: '#06b6d4' },
    { id: 'national', icon: MapPin, label: 'National', color: '#8b5cf6' },
    { id: 'regional', icon: Users, label: 'Regional', color: '#ec4899' },
    { id: 'tiers', icon: Medal, label: 'Tiers', color: '#eab308' },
  ];

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-amber-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-widest">
              2026 CONCURRENT TOURNAMENT
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-400 font-bold px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded">
              <Zap className="w-3 h-3" /> LIVE · 30min updates
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5 mt-2">
            <Trophy className="w-5.5 h-5.5 text-amber-400" />
            Official World Tournament Leaderboards
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Real-time player standings. Tap any tab to see its description.
          </p>
          {lastUpdated && (
            <MicroLabel className="mt-1.5 inline-block">
              Last sync: {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} UTC
              {!isRealData && <span className="text-amber-400 ml-2">· Showing demo data</span>}
            </MicroLabel>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleFindMe}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold rounded-xl text-[11px] uppercase tracking-wider transition"
          >
            <Crosshair className="w-3.5 h-3.5" /> Find Me
          </button>
          <button
            type="button"
            onClick={() => { void fetchBoard(); setShowFindMe(false); notify('Leaderboard refreshed.', 'info', onToast); }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-[11px] uppercase tracking-wider transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Live Ticker */}
      {tickerMessages.length > 0 && <LiveTicker messages={tickerMessages} />}

      {/* Find Me Card (shown when player not in visible list) */}
      {showFindMe && myRankData && <FindMeCard myRank={myRankData} onClose={() => setShowFindMe(false)} />}

      {/* Tab Description */}
      <TabDescription tab={activeTab} />

      {/* Tabs + Search */}
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 mt-4 mb-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 flex-1">
          {tabs.map((tab) => (
            <TabBtn key={tab.id} active={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setShowFindMe(false); }} icon={tab.icon} label={tab.label} color={tab.color} />
          ))}
        </div>
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search player, tag, clan..."
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 w-full sm:w-52"
          />
        </div>
      </div>

      {/* ====== SUMMIT TAB ====== */}
      {activeTab === 'summit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-mono text-slate-500">{isRealData ? `${filteredEntries.length} Country Champions` : 'Demo data — real champions appear when players compete'}</span>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Country Champion</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-2">Nation</div>
              <div className="col-span-2 text-right">Chips</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {loading ? (
                <li className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Loading summit data&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message="No country champions yet. Be the first!" /> : (
                filteredEntries.map((c, i) => {
                  const isMe = c.userTag === player.userTag;
                  return (
                    <li
                      key={c.country + c.userTag}
                      data-is-me={isMe || undefined}
                      onClick={() => inspectPlayer(c)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-1 font-mono">
                        {RANK_MEDALS[i + 1] ? <span className="text-lg">{RANK_MEDALS[i + 1]}</span> : <span className="text-slate-400 font-bold">#{i + 1}</span>}
                      </div>
                      <div className="col-span-1"><RankChangeIndicator change={c.rankChange || 0} /></div>
                      <div className="col-span-3 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          {c.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" />}
                          {c.name}
                          {isMe && <span className="text-[9px] bg-amber-500 text-black px-1 rounded font-bold">YOU</span>}
                          {c.isDemo && <span className="text-[9px] bg-slate-700 text-slate-400 px-1 rounded font-normal italic">DEMO</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{c.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {c.clanTag ? <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{c.clanTag}]</span> : <span className="text-slate-700 text-[10px]">—</span>}
                      </div>
                      <div className="col-span-2 text-xs text-slate-300 flex items-center gap-1.5">
                        <span aria-hidden>{countryFlag(c.country)}</span> {countryName(c.country)}
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{c.bankedChips.toLocaleString()}c</div>
                      <div className="col-span-1 text-right">
                        {c.championshipPrize && <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded" style={{ color: c.championshipPrize.color, backgroundColor: c.championshipPrize.color + '15' }}>{c.championshipPrize.label.split(' ').slice(0, 2).join(' ')}</span>}
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
          </div>
        </div>
      )}

      {/* ====== GLOBAL TAB ====== */}
      {activeTab === 'global' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-mono text-slate-500">
              {isRealData ? `Total Players: ${filteredEntries.length}` : 'Demo data — real rankings appear when players compete'}
            </span>
          </div>

          {/* Top 3 Podium (only for real data with 3+ entries) */}
          {!searchQuery.trim() && isRealData && entries.length >= 3 && <GlobalPodium entries={entries} onInspect={inspectPlayer} />}

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Player</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-2">Tier</div>
              <div className="col-span-2 text-right">Chips</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {loading ? (
                <li className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Loading global ranks&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message="No players ranked yet. Play matches to appear here!" /> : (
                filteredEntries.map((e, idx) => {
                  const isMe = e.userTag === player.userTag;
                  const tier = e.milestoneBadge && e.milestoneColor
                    ? { badge: e.milestoneBadge, color: e.milestoneColor }
                    : milestoneTierForChips(e.bankedChips);
                  return (
                    <li
                      key={e.userTag + e.rank}
                      data-is-me={isMe || undefined}
                      onClick={() => inspectPlayer(e)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-1 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[e.rank] ? <span className="text-lg">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                      </div>
                      <div className="col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                      <div className="col-span-3 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(e.country)}</span>
                          {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" />}
                          {e.name}
                          {isMe && <span className="text-[9px] bg-amber-500 text-black px-1 rounded font-bold">YOU</span>}
                          {e.isDemo && <span className="text-[9px] bg-slate-700 text-slate-400 px-1 rounded font-normal italic">DEMO</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {e.clanTag ? <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{e.clanTag}]</span> : <span className="text-slate-700 text-[10px]">—</span>}
                      </div>
                      <div className="col-span-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono" style={{ color: tier.color }}>{tier.badge}</span>
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{e.bankedChips.toLocaleString()}c</div>
                      <div className="col-span-1 text-right">
                        {e.championshipPrize && <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded" style={{ color: e.championshipPrize.color, backgroundColor: e.championshipPrize.color + '15' }}>{e.championshipPrize.label.split(' ').slice(0, 2).join(' ')}</span>}
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
          </div>
        </div>
      )}

      {/* ====== NATIONAL TAB ====== */}
      {activeTab === 'national' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold text-white">Country:</span>
              <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-violet-500/50">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {isRealData ? `${filteredEntries.length} players from ${countryName(selectedCountry)}` : `Demo — no real players ranked in ${countryName(selectedCountry)} yet`}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Challenger</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-1 text-right">Lvl</div>
              <div className="col-span-2 text-right">Chips</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {loading ? (
                <li className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" /> Loading national ranks&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message={`No players ranked in ${countryName(selectedCountry)} yet`} /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      data-is-me={isMe || undefined}
                      onClick={() => inspectPlayer(e)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-1 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[e.rank] ? <span className="text-lg">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                      </div>
                      <div className="col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                      <div className="col-span-3 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" />}
                          {e.name}
                          {isMe && <span className="text-[9px] bg-violet-500 text-black px-1 rounded font-bold">YOU</span>}
                          {e.isDemo && <span className="text-[9px] bg-slate-700 text-slate-400 px-1 rounded font-normal italic">DEMO</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {e.clanTag ? <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{e.clanTag}]</span> : <span className="text-slate-700 text-[10px]">—</span>}
                      </div>
                      <div className="col-span-1 text-right text-xs text-amber-400 font-mono">{e.level}</div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{e.bankedChips.toLocaleString()}c</div>
                      <div className="col-span-2 text-right">
                        {e.championshipPrize && <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded" style={{ color: e.championshipPrize.color, backgroundColor: e.championshipPrize.color + '15' }}>{e.championshipPrize.label.split(' ').slice(0, 2).join(' ')}</span>}
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
          </div>
        </div>
      )}

      {/* ====== REGIONAL TAB ====== */}
      {activeTab === 'regional' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {REGIONS.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={() => setSelectedRegion(r.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${selectedRegion === r.code ? 'bg-pink-500/15 border-pink-500/40 text-pink-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                <span>{r.flag}</span> {r.name}
                <span className="text-[9px] font-mono opacity-70">({filteredEntries.length})</span>
              </button>
            ))}
          </div>

          {!isRealData && (
            <div className="text-[10px] font-mono text-amber-400/70">Demo data — real regional rankings appear when players from these regions compete</div>
          )}

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Player</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-2">Country</div>
              <div className="col-span-2 text-right">Chips</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {loading ? (
                <li className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-pink-400" /> Loading regional ranks&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message={`No players found in ${REGIONS.find((r) => r.code === selectedRegion)?.name || selectedRegion}`} /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      data-is-me={isMe || undefined}
                      onClick={() => inspectPlayer(e)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-pink-500/10 border-l-2 border-pink-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-1 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[e.rank] ? <span className="text-lg">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                      </div>
                      <div className="col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                      <div className="col-span-3 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" />}
                          {e.name}
                          {isMe && <span className="text-[9px] bg-pink-500 text-black px-1 rounded font-bold">YOU</span>}
                          {e.isDemo && <span className="text-[9px] bg-slate-700 text-slate-400 px-1 rounded font-normal italic">DEMO</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {e.clanTag ? <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{e.clanTag}]</span> : <span className="text-slate-700 text-[10px]">—</span>}
                      </div>
                      <div className="col-span-2 text-xs text-slate-300 flex items-center gap-1.5">
                        <span aria-hidden>{countryFlag(e.country)}</span> {countryName(e.country)}
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{e.bankedChips.toLocaleString()}c</div>
                      <div className="col-span-1 text-right">
                        {e.championshipPrize && <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded" style={{ color: e.championshipPrize.color, backgroundColor: e.championshipPrize.color + '15' }}>{e.championshipPrize.label.split(' ').slice(0, 2).join(' ')}</span>}
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
          </div>
        </div>
      )}

      {/* ====== TIERS TAB ====== */}
      {activeTab === 'tiers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_MILESTONE_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTierId(t.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${selectedTierId === t.id ? 'border' : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'}`}
                style={selectedTierId === t.id ? { borderColor: t.color, color: t.color, backgroundColor: t.color + '1a' } : undefined}
                title={t.name}
              >
                {t.badge}
              </button>
            ))}
          </div>

          {/* Tier info bar */}
          {selectedTierId !== 'all' && selectedTierId !== 'rookie' && (
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
              <span>Threshold: <span className="text-emerald-400 font-bold">{(MILESTONE_TIERS.find((t) => t.id === selectedTierId)?.minChips || 0).toLocaleString('en-IN')}c</span></span>
              <span>·</span>
              <span>Showing: <span className="text-white font-bold">{filteredEntries.length} players</span></span>
              {!isRealData && <><span>·</span><span className="text-amber-400">Demo data</span></>}
            </div>
          )}

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Player</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-3">Country</div>
              <div className="col-span-2 text-right">Chips</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {loading ? (
                <li className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-400" /> Loading tier data&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message="No players in this tier yet" /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      data-is-me={isMe || undefined}
                      onClick={() => inspectPlayer(e)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-1 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[e.rank] ? <span className="text-lg">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                        {e.rank === 1 && selectedTierId !== 'all' && selectedTierId !== 'rookie' && <span className="text-[9px] text-yellow-400 font-bold ml-1">{'👑'} FIRST</span>}
                      </div>
                      <div className="col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                      <div className="col-span-3 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" />}
                          {e.name}
                          {isMe && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">YOU</span>}
                          {e.isDemo && <span className="text-[9px] bg-slate-700 text-slate-400 px-1 rounded font-normal italic">DEMO</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {e.clanTag ? <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{e.clanTag}]</span> : <span className="text-slate-700 text-[10px]">—</span>}
                      </div>
                      <div className="col-span-3 text-xs text-slate-300 flex items-center gap-1.5">
                        <span aria-hidden>{countryFlag(e.country)}</span> {countryName(e.country)}
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{e.bankedChips.toLocaleString()}c</div>
                    </li>
                  );
                })
              )}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default Leaderboards;
