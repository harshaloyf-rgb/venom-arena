'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  COUNTRIES,
  MILESTONE_TIERS,
  MOCK_LEADERBOARD,
  HALL_OF_FAME_TIERS,
  INITIAL_COMMENTARY,
  COMMENTARY_NAMES,
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
} from 'lucide-react';

interface LeaderboardsProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type TopTab = 'summit' | 'global' | 'national' | 'regional' | 'tiers';

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ── Regional mapping ──────────────────────────────────────────────
const REGION_MAP: Record<string, string> = {
  IN: 'APAC', JP: 'APAC', KR: 'APAC', SG: 'APAC', AU: 'APAC', CN: 'APAC', TW: 'APAC', TH: 'APAC', VN: 'APAC', PH: 'APAC', ID: 'APAC', MY: 'APAC',
  US: 'NA', CA: 'NA', MX: 'NA',
  GB: 'EU', DE: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', NL: 'EU', PL: 'EU', SE: 'EU', NO: 'EU', FI: 'EU', DK: 'EU', PT: 'EU', AT: 'EU', CH: 'EU', BE: 'EU', IE: 'EU', CZ: 'EU', GR: 'EU',
  BR: 'LATAM', AR: 'LATAM', CO: 'LATAM', CL: 'LATAM', PE: 'LATAM',
};

const REGIONS = [
  { code: 'APAC', name: 'Asia-Pacific', flag: '🌏' },
  { code: 'NA', name: 'North America', flag: '🌎' },
  { code: 'EU', name: 'Europe', flag: '🌍' },
  { code: 'LATAM', name: 'Latin America', flag: '💃' },
];

function regionOf(countryCode: string): string {
  return REGION_MAP[countryCode] || 'EU';
}

// ── Championship prize tier for a given rank ───────────────────────
function championshipPrizeForRank(rank: number) {
  if (rank === 1) return { label: '👑 World Champion', color: '#fbbf24' };
  if (rank <= 10) return { label: '🥈 Elite 10', color: '#cbd5e1' };
  if (rank <= 50) return { label: '🥉 Masters 50', color: '#b45309' };
  if (rank <= 100) return { label: '🛡️ Qualifier 100', color: '#64748b' };
  return null;
}

// ── HOF achiever set (top names from HOF tiers) ───────────────────
const HOF_ACHIEVER_TAGS = new Set<string>([
  '#IND-001', '#USA-882', '#KOR-114', '#JPN-309', '#USA-402', '#IND-104',
]);

// ── Mock clan tag assignment for generated players ────────────────
const CLAN_TAGS = ['APEX', 'SLYK', 'VNOM', 'STRK', 'ELIT', 'PHNX', 'CYBR', 'SHDW', 'GLXY', 'NINJ'];
function mockClanTagFor(index: number): string {
  return CLAN_TAGS[index % CLAN_TAGS.length];
}

// ── Rank change simulator (mock +/- data) ─────────────────────────
function mockRankChange(index: number): number {
  if (index < 3) return 0;
  const changes = [3, -2, 1, -5, 7, -1, 2, -3, 0, 4, -6, 1, -1, 0, 5];
  return changes[index % changes.length];
}

// National seed data for top-3 of select countries (per audit H.10)
const COUNTRY_SEEDS: Record<string, { name: string; userTag: string; chips: number; level: number }[]> = {
  IN: [
    { name: 'Hari', userTag: '#IND-001', chips: 10_000_000, level: 50 },
    { name: 'Arjun_Viper', userTag: '#IND-002', chips: 8_400_000, level: 48 },
    { name: 'Delhi_King', userTag: '#IND-003', chips: 6_200_000, level: 45 },
  ],
  US: [
    { name: 'Apex_Viper', userTag: '#USA-882', chips: 9_400_000, level: 49 },
    { name: 'Cyber_Wolf', userTag: '#USA-102', chips: 7_800_000, level: 46 },
  ],
  KR: [
    { name: 'K-Snake_Master', userTag: '#KOR-114', chips: 8_900_000, level: 49 },
  ],
};

// ── Data Generators ───────────────────────────────────────────────

interface EnrichedEntry extends LeaderboardEntry {
  clanTag?: string;
  isHOF?: boolean;
  championshipPrize?: { label: string; color: string } | null;
  rankChange?: number;
  region?: string;
}

// Generate ranks 1..100 for the global board
function generateGlobalRanks(playerTag?: string): EnrichedEntry[] {
  const out: EnrichedEntry[] = [];
  const seenTags = new Set<string>();

  const topAchievers: { name: string; userTag: string; country: string; chips: number; level: number }[] = [
    { name: 'Hari', userTag: '#IND-001', country: 'IN', chips: 10_000_000, level: 50 },
    { name: 'Apex_Viper', userTag: '#USA-882', country: 'US', chips: 9_400_000, level: 49 },
    { name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', chips: 8_900_000, level: 49 },
    { name: 'Shadow_Ninja', userTag: '#JPN-309', country: 'JP', chips: 5_000_000, level: 48 },
    { name: 'Viper_Zero', userTag: '#USA-402', country: 'US', chips: 2_500_000, level: 47 },
    { name: 'Rookie_Striker', userTag: '#IND-104', country: 'IN', chips: 1_200_000, level: 32 },
  ];

  topAchievers.forEach((p, i) => {
    const entry: EnrichedEntry = {
      name: p.name, userTag: p.userTag, country: p.country,
      bankedChips: p.chips, level: p.level, rank: i + 1,
      isPlayer: p.userTag === playerTag,
      clanTag: mockClanTagFor(i),
      isHOF: HOF_ACHIEVER_TAGS.has(p.userTag),
      championshipPrize: championshipPrizeForRank(i + 1),
      rankChange: mockRankChange(i),
      region: regionOf(p.country),
    };
    out.push(entry);
    seenTags.add(p.userTag);
  });

  MOCK_LEADERBOARD.forEach((m, i) => {
    if (seenTags.has(m.userTag)) return;
    out.push({
      name: m.name, userTag: m.userTag, country: m.country,
      bankedChips: m.bankedChips, level: m.level, rank: out.length + 1,
      isPlayer: m.userTag === playerTag,
      clanTag: mockClanTagFor(out.length),
      isHOF: HOF_ACHIEVER_TAGS.has(m.userTag),
      championshipPrize: championshipPrizeForRank(out.length + 1),
      rankChange: mockRankChange(out.length),
      region: regionOf(m.country),
    });
    seenTags.add(m.userTag);
  });

  while (out.length < 100) {
    const i = out.length;
    const chips = Math.max(50_000, 10_000_000 - i * 95_000 + Math.floor(Math.random() * 20_000));
    const level = Math.max(5, 50 - Math.floor(i / 2.2));
    const c = COUNTRIES[i % COUNTRIES.length];
    out.push({
      name: `Viper_Challenger_${i + 1}`, userTag: `VRP-${1000 + i}`, country: c.code,
      bankedChips: chips, level, rank: i + 1,
      clanTag: mockClanTagFor(i),
      isHOF: false,
      championshipPrize: championshipPrizeForRank(i + 1),
      rankChange: mockRankChange(i),
      region: regionOf(c.code),
    });
  }

  return out.slice(0, 100);
}

// Country #1 summit table
function generateCountrySummit(): EnrichedEntry[] {
  return COUNTRIES.map((c, idx) => {
    const seed = COUNTRY_SEEDS[c.code]?.[0];
    if (seed) {
      return {
        country: c.code, name: seed.name, userTag: seed.userTag,
        chips: seed.chips, level: seed.level, bankedChips: seed.chips, rank: 0,
        clanTag: mockClanTagFor(idx),
        isHOF: HOF_ACHIEVER_TAGS.has(seed.userTag),
        championshipPrize: championshipPrizeForRank(idx + 1),
        region: regionOf(c.code),
      };
    }
    return {
      country: c.code, name: `Apex_${c.code}_Leader`, userTag: `#${c.code}-001`,
      chips: Math.max(50_000, 10_000_000 - idx * 450_000), level: Math.max(5, 50 - idx), bankedChips: Math.max(50_000, 10_000_000 - idx * 450_000), rank: 0,
      clanTag: mockClanTagFor(idx),
      isHOF: false,
      championshipPrize: championshipPrizeForRank(idx + 1),
      region: regionOf(c.code),
    };
  }).sort((a, b) => b.bankedChips - a.bankedChips).map((e, i) => ({ ...e, rank: i + 1 }));
}

// National board
function generateNationalBoard(countryCode: string): EnrichedEntry[] {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const countryDisplayName = country?.name || countryCode;
  const seeds = COUNTRY_SEEDS[countryCode] || [];
  const out: EnrichedEntry[] = [];
  const seenTags = new Set<string>();

  seeds.forEach((s, i) => {
    out.push({
      name: s.name, userTag: s.userTag, country: countryCode,
      bankedChips: s.chips, level: s.level, rank: i + 1,
      clanTag: mockClanTagFor(i),
      isHOF: HOF_ACHIEVER_TAGS.has(s.userTag),
      championshipPrize: championshipPrizeForRank(i + 1),
      rankChange: mockRankChange(i),
      region: regionOf(countryCode),
    });
    seenTags.add(s.userTag);
  });

  while (out.length < 100) {
    const i = out.length;
    const chips = Math.max(50_000, 5_000_000 - i * 47_000);
    const level = Math.max(5, 45 - Math.floor(i / 2.5));
    out.push({
      name: `${countryDisplayName}_Challenger_${i + 1}`, userTag: `#${countryCode}-${100 + i}`,
      country: countryCode, bankedChips: chips, level, rank: i + 1,
      clanTag: mockClanTagFor(i),
      isHOF: false,
      championshipPrize: championshipPrizeForRank(i + 1),
      rankChange: mockRankChange(i),
      region: regionOf(countryCode),
    });
    seenTags.add(`${countryCode}-${100 + i}`);
  }

  return out;
}

// Regional board
function generateRegionalBoard(regionCode: string): EnrichedEntry[] {
  const globalRanks = generateGlobalRanks();
  return globalRanks
    .filter((e) => e.region === regionCode)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// Milestone-tier board
function generateMilestoneBoard(tierId: string): EnrichedEntry[] {
  if (tierId === 'all') return generateGlobalRanks();
  const tier = MILESTONE_TIERS.find((t) => t.id === tierId);
  if (!tier) return [];

  const out: EnrichedEntry[] = [];

  if (tierId === 'omega') {
    out.push({ name: 'Hari', userTag: '#IND-001', country: 'IN', bankedChips: 10_000_000, level: 50, rank: 1, isHOF: true, clanTag: 'APEX', region: 'APAC' });
    out.push({ name: 'Apex_Viper', userTag: '#USA-882', country: 'US', bankedChips: 10_000_000, level: 49, rank: 2, isHOF: true, clanTag: 'VNOM', region: 'NA' });
    out.push({ name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', bankedChips: 10_000_000, level: 49, rank: 3, isHOF: true, clanTag: 'STRK', region: 'APAC' });
    return out;
  }

  if (tierId === 'rookie') {
    out.push({ name: 'Starter_Pawn', userTag: '#GEN-000', country: 'US', bankedChips: 45_000, level: 8, rank: 1, clanTag: 'ELIT', region: 'NA' });
    while (out.length < 100) {
      const i = out.length;
      out.push({
        name: `${COUNTRIES[i % COUNTRIES.length].name.split(' ')[0]}_Rookie_${i + 1}`,
        userTag: `#${COUNTRIES[i % COUNTRIES.length].code}-${200 + i}`,
        country: COUNTRIES[i % COUNTRIES.length].code,
        bankedChips: Math.max(1_000, 90_000 - i * 880),
        level: Math.max(1, 10 - Math.floor(i / 12)),
        rank: i + 1,
        clanTag: mockClanTagFor(i),
        region: regionOf(COUNTRIES[i % COUNTRIES.length].code),
      });
    }
    return out;
  }

  // Normal tiers
  const firstAchieverMap: Record<string, { name: string; userTag: string; country: string }> = {
    bronze: { name: 'Rookie_Striker', userTag: '#IND-104', country: 'IN' },
    silver: { name: 'Viper_Zero', userTag: '#USA-402', country: 'US' },
    gold: { name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR' },
    platinum: { name: 'Apex_Viper', userTag: '#USA-882', country: 'US' },
    diamond: { name: 'Shadow_Ninja', userTag: '#JPN-309', country: 'JP' },
  };
  const achiever = firstAchieverMap[tierId];
  if (achiever) {
    out.push({
      name: achiever.name, userTag: achiever.userTag, country: achiever.country,
      bankedChips: tier.minChips, level: 45 + Math.floor(Math.random() * 5), rank: 1,
      isHOF: HOF_ACHIEVER_TAGS.has(achiever.userTag),
      clanTag: mockClanTagFor(0),
      region: regionOf(achiever.country),
    });
  }

  while (out.length < 100) {
    const i = out.length;
    const c = COUNTRIES[i % COUNTRIES.length];
    out.push({
      name: `${c.name.split(' ')[0]}_Achiever_${i + 1}`,
      userTag: `#${c.code}-${100 + i}`,
      country: c.code,
      bankedChips: tier.minChips,
      level: Math.max(5, 45 - Math.floor(i / 2.5)),
      rank: i + 1,
      clanTag: mockClanTagFor(i),
      region: regionOf(c.code),
    });
  }
  return out;
}

// Extended milestone tiers including Rookie
const ALL_MILESTONE_TIERS = [
  { id: 'all', name: 'All Tiers', minChips: 0, badge: '\u2b50 All', color: '#94a3b8' },
  { id: 'rookie', name: 'Rookie (Below 100K)', minChips: 0, badge: '\ud83d\udee1\ufe0f Rookie', color: '#64748b' },
  ...MILESTONE_TIERS.filter((t) => t.id !== 'all'),
];

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

// Rank change indicator
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
          {/* HOF badge */}
          {p.isHOF && (
            <span className="absolute -top-1 -right-1 text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">HOF</span>
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

// ── MAIN COMPONENT ─────────────────────────────────────────────────

export function Leaderboards({ onToast, onInspectPlayer }: LeaderboardsProps) {
  const { player } = useAuth();
  const [activeTab, setActiveTab] = useState<TopTab>('summit');
  const [selectedCountry, setSelectedCountry] = useState<string>('IN');
  const [selectedRegion, setSelectedRegion] = useState<string>('APAC');
  const [selectedTierId, setSelectedTierId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveEntries, setLiveEntries] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tickerMessages, setTickerMessages] = useState(INITIAL_COMMENTARY);
  const listRef = useRef<HTMLOListElement>(null);
  const playerRowRef = useRef<HTMLLIElement>(null);

  const playerTag = player?.userTag;

  // Fetch live global data
  const fetchLive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard?type=chips&limit=100', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as {
        entries?: LeaderboardEntry[];
        error?: string;
      };
      if (res.ok && data.entries && data.entries.length > 0) {
        // Enrich with mock clan/HOF/championship data
        setLiveEntries(data.entries.map((e, i) => ({
          ...e,
          clanTag: mockClanTagFor(i),
          isHOF: HOF_ACHIEVER_TAGS.has(e.userTag),
          championshipPrize: championshipPrizeForRank(e.rank),
          rankChange: mockRankChange(i),
          region: regionOf(e.country),
        })));
      } else {
        setLiveEntries(generateGlobalRanks(playerTag));
      }
      setLastUpdated(new Date());
    } catch {
      setLiveEntries(generateGlobalRanks(playerTag));
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [playerTag]);

  useEffect(() => { void fetchLive(); const id = setInterval(() => void fetchLive(), 30 * 60 * 1000); return () => clearInterval(id); }, [fetchLive]);

  // Live ticker (same as HOF but lighter)
  useEffect(() => {
    const id = setInterval(() => {
      const name = COMMENTARY_NAMES[Math.floor(Math.random() * COMMENTARY_NAMES.length)];
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      const chips = 50_000 + Math.floor(Math.random() * 5_000_000);
      const templates = [
        `🎙️ ${name} from ${country.name} ${country.flag} extracted ${chips.toLocaleString('en-IN')} chips!`,
        `💥 ${name} ${country.flag} eliminated a rival and claimed ${(chips / 2).toLocaleString('en-IN')} chips!`,
        `👑 ${name} ${country.flag} reached a new milestone tier!`,
        `🔥 ${country.name} Arena boiling — ${name} enters extraction zone with ${chips.toLocaleString('en-IN')} chips!`,
      ];
      const text = templates[Math.floor(Math.random() * templates.length)];
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
      setTickerMessages((prev) => [{ id: `c-${Date.now()}`, ts, text }, ...prev].slice(0, 20));
    }, 6000);
    return () => clearInterval(id);
  }, []);

  // Board data
  const countrySummit = useMemo(() => generateCountrySummit(), []);
  const nationalBoard = useMemo(() => generateNationalBoard(selectedCountry), [selectedCountry]);
  const regionalBoard = useMemo(() => generateRegionalBoard(selectedRegion), [selectedRegion]);
  const milestoneBoard = useMemo(() => generateMilestoneBoard(selectedTierId), [selectedTierId]);

  // Merge live + generated global ranks
  const globalRanks = useMemo<EnrichedEntry[]>(() => {
    const generated = generateGlobalRanks(playerTag);
    if (liveEntries.length === 0) return generated;
    const liveSet = new Set(liveEntries.map((e) => e.userTag));
    const merged = [...liveEntries];
    let rankCounter = merged.length;
    for (const g of generated) {
      if (!liveSet.has(g.userTag)) {
        merged.push({ ...g, rank: ++rankCounter });
      }
    }
    return merged.slice(0, 100);
  }, [liveEntries, playerTag]);

  // Player rank info
  const playerRankInfo = useMemo(() => {
    if (!player) return null;
    const globalEntry = globalRanks.find((e) => e.userTag === player.userTag);
    const national = generateNationalBoard(player.country || 'US');
    const nationalEntry = national.find((e) => e.userTag === player.userTag);
    const regional = generateRegionalBoard(regionOf(player.country || 'US'));
    const regionalEntry = regional.find((e) => e.userTag === player.userTag);
    const tier = milestoneTierForChips(player.bankedChips);
    const prize = championshipPrizeForRank(globalEntry?.rank || 999);
    return {
      globalRank: globalEntry?.rank ?? null,
      nationalRank: nationalEntry?.rank ?? null,
      regionalRank: regionalEntry?.rank ?? null,
      regionName: REGIONS.find((r) => r.code === regionOf(player.country || 'US'))?.name || 'EU',
      tierBadge: tier.badge,
      tierName: tier.name,
      bankedChips: player.bankedChips,
      level: player.level,
      clanTag: player.clanTag || null,
      championshipPrize: prize,
      isHOF: HOF_ACHIEVER_TAGS.has(player.userTag),
    };
  }, [player, globalRanks]);

  // Get current board entries based on active tab
  const currentEntries = useMemo(() => {
    switch (activeTab) {
      case 'summit': return countrySummit;
      case 'global': return globalRanks;
      case 'national': return nationalBoard;
      case 'regional': return regionalBoard;
      case 'tiers': return milestoneBoard;
      default: return [];
    }
  }, [activeTab, countrySummit, globalRanks, nationalBoard, regionalBoard, milestoneBoard]);

  // Filter by search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return currentEntries;
    const q = searchQuery.toLowerCase();
    return currentEntries.filter((e) =>
      e.name.toLowerCase().includes(q) || e.userTag.toLowerCase().includes(q) || (e.clanTag && e.clanTag.toLowerCase().includes(q))
    );
  }, [currentEntries, searchQuery]);

  if (!player) return <NotSignedIn />;

  function inspectPlayer(e: EnrichedEntry) {
    if (!onInspectPlayer) return;
    const tier = milestoneTierForChips(e.bankedChips);
    onInspectPlayer({
      name: e.name, userTag: e.userTag, country: e.country,
      flag: countryFlag(e.country), bankedChips: e.bankedChips, level: e.level,
      clanTag: e.clanTag || 'APEX', clanName: 'Clan ' + (e.clanTag || 'APEX'),
      achievedAt: '26 Jul 2026, 05:42 PM UTC',
      globalRank: e.rank, countryRank: Math.floor(e.rank / 1.4) || 1,
      regionalRank: Math.floor(e.rank / 2) || 1,
    });
    void tier;
  }


  // Find Me handler
  function handleFindMe() {
    const myRow = listRef.current?.querySelector('[data-is-me="true"]');
    if (myRow) {
      myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      myRow.classList.add('ring-2', 'ring-amber-400/60');
      setTimeout(() => myRow.classList.remove('ring-2', 'ring-amber-400/60'), 2000);
      notify('Found you on the leaderboard!', 'success', onToast);
    } else {
      notify('You are not ranked in this view yet. Play more matches!', 'info', onToast);
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
            Real-time standings across Summit, Global, National, Regional &amp; Milestone Tiers.
            Cross-linked with Championship &amp; Hall of Fame systems.
          </p>
          {lastUpdated && (
            <MicroLabel className="mt-1.5 inline-block">
              Last sync: {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} UTC
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
            onClick={() => { void fetchLive(); notify('Leaderboard refreshed.', 'info', onToast); }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-[11px] uppercase tracking-wider transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Live Ticker */}
      <LiveTicker messages={tickerMessages} />

      {/* Your Rank Card — Enhanced */}
      {playerRankInfo && (
        <div className="relative rounded-xl p-4 mb-4 border-0" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(16,185,129,0.08) 100%)' }}>
          <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ border: '2px solid transparent', backgroundClip: 'padding-box', WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', backgroundImage: 'linear-gradient(135deg, #f59e0b, #10b981)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-widest font-mono">Your Rank</span>
              {playerRankInfo.championshipPrize && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ color: playerRankInfo.championshipPrize.color, backgroundColor: playerRankInfo.championshipPrize.color + '1a', border: `1px solid ${playerRankInfo.championshipPrize.color}40` }}>
                  {playerRankInfo.championshipPrize.label}
                </span>
              )}
              {playerRankInfo.isHOF && (
                <span className="text-[9px] font-mono font-bold text-yellow-300 bg-yellow-500/15 border border-yellow-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Award className="w-2.5 h-2.5" /> HOF Inducted
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Global Rank</div>
                <div className="text-lg font-black text-white tabular-nums">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : playerRankInfo.globalRank != null ? <span className="text-amber-400">#{playerRankInfo.globalRank}</span> : <span className="text-slate-600">N/A</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">National Rank</div>
                <div className="text-lg font-black text-white tabular-nums">
                  {playerRankInfo.nationalRank != null ? <span className="text-emerald-400">#{playerRankInfo.nationalRank}</span> : <span className="text-slate-600">N/A</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Regional ({playerRankInfo.regionName})</div>
                <div className="text-lg font-black text-white tabular-nums">
                  {playerRankInfo.regionalRank != null ? <span className="text-pink-400">#{playerRankInfo.regionalRank}</span> : <span className="text-slate-600">N/A</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Milestone Badge</div>
                <div className="text-sm font-bold" style={{ color: milestoneTierForChips(player.bankedChips).color }}>
                  {playerRankInfo.tierBadge}
                </div>
                <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{playerRankInfo.tierName}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Banked Chips</div>
                <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums">{playerRankInfo.bankedChips.toLocaleString()}c</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Level</div>
                <div className="text-lg font-black text-white tabular-nums">{playerRankInfo.level}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Clan</div>
                <div className="text-sm font-bold text-slate-300">{playerRankInfo.clanTag ? <span className="text-cyan-300">[{playerRankInfo.clanTag}]</span> : <span className="text-slate-600">None</span>}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 flex-1">
          {tabs.map((tab) => (
            <TabBtn key={tab.id} active={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }} icon={tab.icon} label={tab.label} color={tab.color} />
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
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-200 leading-relaxed">
            <strong>WORLD CUP SUMMIT:</strong> Aggregates ONLY the #1 Ranked Player from each country.
            Dec 31 midnight UTC — #1 wins the World Championship! Clan &amp; Championship status shown.
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
              {filteredEntries.length === 0 ? <EmptyState /> : (
                filteredEntries.map((c, i) => {
                  const isMe = c.userTag === player.userTag;
                  return (
                    <li
                      key={c.country}
                      ref={isMe ? playerRowRef : undefined}
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
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{c.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {c.clanTag && <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{c.clanTag}]</span>}
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
            <span className="text-[10px] font-mono text-slate-500">Total Competitors: {(liveEntries.length || globalRanks.length).toLocaleString()} Players</span>
            <span className="text-[9px] font-mono text-pink-300 px-2 py-0.5 bg-pink-500/10 border border-pink-500/30 rounded-full">🔗 Cross-linked with Championship &amp; HOF</span>
          </div>

          {/* Top 3 Podium */}
          {!searchQuery.trim() && <GlobalPodium entries={globalRanks} onInspect={inspectPlayer} />}

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
              ) : filteredEntries.length === 0 ? <EmptyState /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  const tier = milestoneTierForChips(e.bankedChips);
                  return (
                    <li
                      key={e.userTag + e.rank}
                      ref={isMe ? playerRowRef : undefined}
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
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {e.clanTag && <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{e.clanTag}]</span>}
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
              <span className="text-xs font-bold text-white">Country ({COUNTRIES.length}):</span>
              <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-violet-500/50">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{filteredEntries.length} players</span>
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
              {filteredEntries.length === 0 ? <EmptyState message={`No players found for ${countryName(selectedCountry)}`} /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      ref={isMe ? playerRowRef : undefined}
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
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {e.clanTag && <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{e.clanTag}]</span>}
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
          <div className="rounded-xl border border-pink-500/30 bg-pink-950/10 p-3 text-[11px] text-pink-200 leading-relaxed">
            <strong>REGIONAL STANDINGS:</strong> Players grouped by world region (APAC, NA, EU, LATAM).
            Same ranking data as Global, filtered by geography. Connects to Championship Regional Masters circuit.
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {REGIONS.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={() => setSelectedRegion(r.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${selectedRegion === r.code ? 'bg-pink-500/15 border-pink-500/40 text-pink-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                <span>{r.flag}</span> {r.name}
                <span className="text-[9px] font-mono opacity-70">({regionalBoard.length})</span>
              </button>
            ))}
          </div>

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
              {filteredEntries.length === 0 ? <EmptyState message={`No players found in ${REGIONS.find((r) => r.code === selectedRegion)?.name || selectedRegion}`} /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      ref={isMe ? playerRowRef : undefined}
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
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {e.clanTag && <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{e.clanTag}]</span>}
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
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/10 p-3 text-[11px] text-yellow-200 leading-relaxed">
            <strong>MILESTONE TIER BOARD:</strong> Players who reached each chip milestone, ranked #1 to all achievers.
            HOF-immortalized players shown with <Award className="w-3 h-3 text-yellow-400 inline" /> badge.
          </div>

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
              <span>HOF Achievers: <span className="text-yellow-400 font-bold">{(HALL_OF_FAME_TIERS.find((t) => t.id === `t-${selectedTierId}`)?.totalAchieversCount || 0).toLocaleString()}</span></span>
              <span>·</span>
              <span>Showing: <span className="text-white font-bold">{filteredEntries.length} players</span></span>
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
              {filteredEntries.length === 0 ? <EmptyState /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      ref={isMe ? playerRowRef : undefined}
                      data-is-me={isMe || undefined}
                      onClick={() => inspectPlayer(e)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-1 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[e.rank] ? <span className="text-lg">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                        {e.rank === 1 && selectedTierId !== 'all' && selectedTierId !== 'rookie' && <span className="text-[9px] text-yellow-400 font-bold ml-1">👑 FIRST</span>}
                      </div>
                      <div className="col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                      <div className="col-span-3 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" />}
                          {e.name}
                          {isMe && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">YOU</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{e.userTag}</div>
                      </div>
                      <div className="col-span-2">
                        {e.clanTag && <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">[{e.clanTag}]</span>}
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
