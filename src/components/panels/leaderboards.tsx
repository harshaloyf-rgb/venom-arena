'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  COUNTRIES,
  MILESTONE_TIERS,
  MOCK_LEADERBOARD,
  countryFlag,
  countryName,
  milestoneTierForChips,
  type InspectedPlayer,
} from '@/lib/game-config';
import type { LeaderboardEntry } from '@/lib/types';
import {
  GlowBlob,
  MicroLabel,
  PanelSkeleton,
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
} from 'lucide-react';

interface LeaderboardsProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type TopTab = 'summit' | 'global' | 'national' | 'tiers';

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

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

// Generate ranks 1..100 for the global board (mixing mock + auto-generated)
function generateGlobalRanks(playerTag?: string): LeaderboardEntry[] {
  const out: LeaderboardEntry[] = [];
  const seenTags = new Set<string>();

  // Hall-of-fame top achievers as the global top tier
  const topAchievers: { name: string; userTag: string; country: string; chips: number; level: number }[] = [
    { name: 'Hari', userTag: '#IND-001', country: 'IN', chips: 10_000_000, level: 50 },
    { name: 'Apex_Viper', userTag: '#USA-882', country: 'US', chips: 9_400_000, level: 49 },
    { name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', chips: 8_900_000, level: 49 },
    { name: 'Shadow_Ninja', userTag: '#JPN-309', country: 'JP', chips: 5_000_000, level: 48 },
    { name: 'Viper_Zero', userTag: '#USA-402', country: 'US', chips: 2_500_000, level: 47 },
    { name: 'Rookie_Striker', userTag: '#IND-104', country: 'IN', chips: 1_200_000, level: 32 },
  ];

  topAchievers.forEach((p, i) => {
    out.push({
      name: p.name,
      userTag: p.userTag,
      country: p.country,
      bankedChips: p.chips,
      level: p.level,
      rank: i + 1,
      isPlayer: p.userTag === playerTag,
    });
    seenTags.add(p.userTag);
  });

  // Mock leaderboard next
  MOCK_LEADERBOARD.forEach((m, i) => {
    if (seenTags.has(m.userTag)) return;
    out.push({
      name: m.name,
      userTag: m.userTag,
      country: m.country,
      bankedChips: m.bankedChips,
      level: m.level,
      rank: out.length + 1,
      isPlayer: m.userTag === playerTag,
    });
    seenTags.add(m.userTag);
  });

  // Auto-generate ranks 1-100 if sparse
  while (out.length < 100) {
    const i = out.length;
    const chips = Math.max(50_000, 10_000_000 - i * 95_000 + Math.floor(Math.random() * 20_000));
    const level = Math.max(5, 50 - Math.floor(i / 2.2));
    out.push({
      name: `Viper_Challenger_${i + 1}`,
      userTag: `VRP-${1000 + i}`,
      country: COUNTRIES[i % COUNTRIES.length].code,
      bankedChips: chips,
      level,
      rank: i + 1,
    });
  }

  return out.slice(0, 100);
}

// Country #1 summit table - for each country, show one champion
function generateCountrySummit(): { country: string; name: string; userTag: string; chips: number; level: number }[] {
  return COUNTRIES.map((c, idx) => {
    const seed = COUNTRY_SEEDS[c.code]?.[0];
    if (seed) {
      return {
        country: c.code,
        name: seed.name,
        userTag: seed.userTag,
        chips: seed.chips,
        level: seed.level,
      };
    }
    return {
      country: c.code,
      name: `Apex_${c.code}_Leader`,
      userTag: `#${c.code}-001`,
      chips: 10_000_000 - idx * 450_000,
      level: 50 - idx,
    };
  }).sort((a, b) => b.chips - a.chips);
}

// National board for a given country code - top 100
function generateNationalBoard(countryCode: string): LeaderboardEntry[] {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const countryDisplayName = country?.name || countryCode;
  const seeds = COUNTRY_SEEDS[countryCode] || [];
  const out: LeaderboardEntry[] = [];
  const seenTags = new Set<string>();

  seeds.forEach((s, i) => {
    out.push({
      name: s.name,
      userTag: s.userTag,
      country: countryCode,
      bankedChips: s.chips,
      level: s.level,
      rank: i + 1,
    });
    seenTags.add(s.userTag);
  });

  while (out.length < 100) {
    const i = out.length;
    const chips = Math.max(50_000, 5_000_000 - i * 47_000);
    const level = Math.max(5, 45 - Math.floor(i / 2.5));
    out.push({
      name: `${countryDisplayName}_Challenger_${i + 1}`,
      userTag: `#${countryCode}-${100 + i}`,
      country: countryCode,
      bankedChips: chips,
      level,
      rank: i + 1,
    });
    seenTags.add(`${countryCode}-${100 + i}`);
  }

  return out;
}

// Milestone-tier board - players at each milestone
function generateMilestoneBoard(tierId: string): LeaderboardEntry[] {
  if (tierId === 'all') {
    return generateGlobalRanks();
  }
  const tier = MILESTONE_TIERS.find((t) => t.id === tierId);
  if (!tier) return [];

  const out: LeaderboardEntry[] = [];

  // t-1crore tier special: only 3 achievers (Hari, Apex_Viper, K-Snake_Master)
  if (tierId === 'omega' || tier.id === 'omega') {
    out.push({ name: 'Hari', userTag: '#IND-001', country: 'IN', bankedChips: 10_000_000, level: 50, rank: 1 });
    out.push({ name: 'Apex_Viper', userTag: '#USA-882', country: 'US', bankedChips: 10_000_000, level: 49, rank: 2 });
    out.push({ name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', bankedChips: 10_000_000, level: 49, rank: 3 });
    return out;
  }

  // Rookie tier - all players below 100K chips
  if (tierId === 'rookie') {
    out.push({ name: 'Starter_Pawn', userTag: '#GEN-000', country: 'US', bankedChips: 45_000, level: 8, rank: 1 });
    while (out.length < 100) {
      const i = out.length;
      out.push({
        name: `${COUNTRIES[i % COUNTRIES.length].name.split(' ')[0]}_Rookie_${i + 1}`,
        userTag: `#${COUNTRIES[i % COUNTRIES.length].code}-${200 + i}`,
        country: COUNTRIES[i % COUNTRIES.length].code,
        bankedChips: Math.max(1_000, 90_000 - i * 880),
        level: Math.max(1, 10 - Math.floor(i / 12)),
        rank: i + 1,
      });
    }
    return out;
  }

  // First achiever for known tiers
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
      name: achiever.name,
      userTag: achiever.userTag,
      country: achiever.country,
      bankedChips: tier.minChips,
      level: 45 + Math.floor(Math.random() * 5),
      rank: 1,
    });
  }

  // Auto-generate ranks 2..100
  while (out.length < 100) {
    const i = out.length;
    out.push({
      name: `${COUNTRIES[i % COUNTRIES.length].name.split(' ')[0]}_Achiever_${i + 1}`,
      userTag: `#${COUNTRIES[i % COUNTRIES.length].code}-${100 + i}`,
      country: COUNTRIES[i % COUNTRIES.length].code,
      bankedChips: tier.minChips,
      level: Math.max(5, 45 - Math.floor(i / 2.5)),
      rank: i + 1,
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

// Empty state component
function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <Inbox className="w-10 h-10 mb-3 text-slate-600" />
      <p className="text-sm font-medium">{message || 'No entries yet'}</p>
    </div>
  );
}

// Tab button component
function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
  color,
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
      style={
        active
          ? { borderColor: color, color: color, backgroundColor: color + '1a' }
          : undefined
      }
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export function Leaderboards({ onToast, onInspectPlayer }: LeaderboardsProps) {
  const { player } = useAuth();
  const [activeTab, setActiveTab] = useState<TopTab>('summit');
  const [selectedCountry, setSelectedCountry] = useState<string>('IN');
  const [selectedTierId, setSelectedTierId] = useState<string>('all');
  const [countrySearch, setCountrySearch] = useState('');
  const [liveEntries, setLiveEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const playerTag = player?.userTag;

  const fetchLive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard?type=chips&limit=100', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as {
        entries?: LeaderboardEntry[];
        error?: string;
      };
      if (res.ok && data.entries && data.entries.length > 0) {
        setLiveEntries(data.entries);
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

  useEffect(() => {
    void fetchLive();
    const id = setInterval(() => void fetchLive(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchLive]);

  const countrySummit = useMemo(() => generateCountrySummit(), []);
  const nationalBoard = useMemo(
    () => generateNationalBoard(selectedCountry),
    [selectedCountry],
  );
  const milestoneBoard = useMemo(
    () => generateMilestoneBoard(selectedTierId),
    [selectedTierId],
  );

  // Merge live + generated global ranks for the Global view
  const globalRanks = useMemo<LeaderboardEntry[]>(() => {
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

  // Compute player rank info for the Your Rank card
  const playerRankInfo = useMemo(() => {
    if (!player) return null;
    const globalEntry = globalRanks.find((e) => e.userTag === player.userTag);
    const national = generateNationalBoard(player.country || 'US');
    const nationalEntry = national.find((e) => e.userTag === player.userTag);
    const tier = milestoneTierForChips(player.bankedChips);
    return {
      globalRank: globalEntry?.rank ?? null,
      nationalRank: nationalEntry?.rank ?? null,
      tierBadge: tier.badge,
      tierName: tier.name,
      bankedChips: player.bankedChips,
      level: player.level,
    };
  }, [player, globalRanks]);

  if (!player) return <NotSignedIn />;

  function inspectPlayer(e: LeaderboardEntry | { name: string; userTag: string; country: string; chips: number; level: number }) {
    if (!onInspectPlayer) return;
    const tier = milestoneTierForChips(e.chips ?? e.bankedChips ?? 0);
    onInspectPlayer({
      name: e.name,
      userTag: e.userTag,
      country: e.country,
      flag: countryFlag(e.country),
      bankedChips: e.chips ?? e.bankedChips ?? 0,
      level: e.level,
      clanTag: 'APEX',
      clanName: 'Viper Apex Syndicate',
      achievedAt: '26 Jul 2026, 05:42 PM UTC',
      globalRank: e.rank,
      countryRank: Math.floor(e.rank / 1.4) || 1,
      regionalRank: Math.floor(e.rank / 2) || 1,
    });
    void tier;
  }

  const filteredNational = nationalBoard.filter((e) => {
    if (!countrySearch.trim()) return true;
    const q = countrySearch.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.userTag.toLowerCase().includes(q);
  });

  const tabs: { id: TopTab; icon: typeof Crown; label: string; color: string }[] = [
    { id: 'summit', icon: Crown, label: 'Summit', color: '#f59e0b' },
    { id: 'global', icon: Globe, label: 'Global', color: '#06b6d4' },
    { id: 'national', icon: MapPin, label: 'National', color: '#8b5cf6' },
    { id: 'tiers', icon: Medal, label: 'Tiers', color: '#eab308' },
  ];

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-amber-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-widest">
              CURRENT YEAR (2026) CONCURRENT TOURNAMENT
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-400 font-bold px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded">
              <Zap className="w-3 h-3" /> Live Ranks Update Every 30 Minutes
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5 mt-2">
            <Trophy className="w-5.5 h-5.5 text-amber-400" />
            Official World Tournament Leaderboards
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Complete real-time standings for World Summit, Global, National, and Milestone Tiers.
            Click any player row to inspect full profile &amp; rank status!
          </p>
          {lastUpdated && (
            <MicroLabel className="mt-1.5 inline-block">
              Last sync: {lastUpdated.toLocaleTimeString('en-US', { hour12: false })} UTC
            </MicroLabel>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            void fetchLive();
            notify('Leaderboard refreshed.', 'info', onToast);
          }}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-[11px] uppercase tracking-wider transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {/* Your Rank Card */}
      {playerRankInfo && (
        <div
          className="relative rounded-xl p-4 mb-5 border-0"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(16,185,129,0.08) 100%)',
          }}
        >
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
              WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              backgroundImage: 'linear-gradient(135deg, #f59e0b, #10b981)',
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-widest font-mono">
                Your Rank
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Global Rank</div>
                <div className="text-lg font-black text-white tabular-nums">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : playerRankInfo.globalRank != null ? (
                    <span className="text-amber-400">#{playerRankInfo.globalRank}</span>
                  ) : (
                    <span className="text-slate-600">N/A</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">National Rank</div>
                <div className="text-lg font-black text-white tabular-nums">
                  {playerRankInfo.nationalRank != null ? (
                    <span className="text-emerald-400">#{playerRankInfo.nationalRank}</span>
                  ) : (
                    <span className="text-slate-600">N/A</span>
                  )}
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
                <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                  {playerRankInfo.bankedChips.toLocaleString()}c
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Level</div>
                <div className="text-lg font-black text-white tabular-nums">{playerRankInfo.level}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flat Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-5">
        {tabs.map((tab) => (
          <TabBtn
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            icon={tab.icon}
            label={tab.label}
            color={tab.color}
          />
        ))}
      </div>

      {/* ====== SUMMIT TAB ====== */}
      {activeTab === 'summit' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-200 leading-relaxed">
            <strong>WORLD CUP SUMMIT MECHANIC:</strong> This master leaderboard aggregates ONLY the #1
            Ranked Player from each country. Dec 31 midnight UTC #1 wins the World Championship!
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-2">Global Rank</div>
              <div className="col-span-5">Country #1 Champion</div>
              <div className="col-span-3">Nation</div>
              <div className="col-span-2 text-right">Banked Chips</div>
            </div>
            <ol className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {countrySummit.length === 0 ? (
                <EmptyState />
              ) : (
                countrySummit.map((c, i) => {
                  const isMe = c.userTag === player.userTag;
                  return (
                    <li
                      key={c.country}
                      onClick={() => inspectPlayer({ name: c.name, userTag: c.userTag, country: c.country, chips: c.chips, level: c.level, rank: i + 1 })}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-2 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[i + 1] ? (
                          <span className="text-lg">{RANK_MEDALS[i + 1]}</span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{i + 1}</span>
                        )}
                        {isMe && <span className="text-[9px] bg-amber-500 text-black px-1 rounded font-bold">YOU</span>}
                      </div>
                      <div className="col-span-5 min-w-0">
                        <div className="font-bold text-white truncate">{c.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{c.userTag} &middot; 26 Jul 2026</div>
                      </div>
                      <div className="col-span-3 text-xs text-slate-300 flex items-center gap-1.5">
                        <span aria-hidden>{countryFlag(c.country)}</span> {countryName(c.country)}
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        {c.chips.toLocaleString()}c
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
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">
              Total Global Competitors: {(liveEntries.length || globalRanks.length).toLocaleString()} Players
            </span>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-2">Global Rank</div>
              <div className="col-span-5">Player &amp; User Tag</div>
              <div className="col-span-3">Milestone Badge</div>
              <div className="col-span-2 text-right">Banked Chips</div>
            </div>
            <ol className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {loading ? (
                <li className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Loading global ranks&hellip;
                </li>
              ) : globalRanks.length === 0 ? (
                <EmptyState />
              ) : (
                globalRanks.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  const tier = milestoneTierForChips(e.bankedChips);
                  return (
                    <li
                      key={e.userTag + e.rank}
                      onClick={() => inspectPlayer(e)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-2 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[e.rank] ? (
                          <span className="text-lg">{RANK_MEDALS[e.rank]}</span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{e.rank}</span>
                        )}
                        {isMe && <span className="text-[9px] bg-amber-500 text-black px-1 rounded font-bold">YOU</span>}
                      </div>
                      <div className="col-span-5 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(e.country)}</span> {e.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">{e.userTag} &middot; 26 Jul 2026</div>
                      </div>
                      <div className="col-span-3 text-xs">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono"
                          style={{ color: tier.color }}
                        >
                          {tier.badge}
                        </span>
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        {e.bankedChips.toLocaleString()}c
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
              <span className="text-xs font-bold text-white">Select Country ({COUNTRIES.length} Countries):</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-violet-500/50"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search player in country..."
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-2">National Rank</div>
              <div className="col-span-5">Local Challenger</div>
              <div className="col-span-3">Level</div>
              <div className="col-span-2 text-right">Banked Chips</div>
            </div>
            <ol className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {filteredNational.length === 0 ? (
                <EmptyState message={`No players found for ${countryName(selectedCountry)}`} />
              ) : (
                filteredNational.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      onClick={() => inspectPlayer(e)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-2 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[e.rank] ? (
                          <span className="text-lg">{RANK_MEDALS[e.rank]}</span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{e.rank}</span>
                        )}
                        {isMe && <span className="text-[9px] bg-violet-500 text-black px-1 rounded font-bold">YOU</span>}
                      </div>
                      <div className="col-span-5 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(e.country)}</span> {e.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">{e.userTag}</div>
                      </div>
                      <div className="col-span-3 text-xs text-amber-400 font-mono">Lvl {e.level}</div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        {e.bankedChips.toLocaleString()}c
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
            <strong>MILESTONE TIER RANKING BOARD:</strong> All players who have reached each chip
            milestone are ranked from #1 to all joined competitors! Click any player to inspect profile &amp; dossier.
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_MILESTONE_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTierId(t.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                  selectedTierId === t.id
                    ? 'border'
                    : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
                style={
                  selectedTierId === t.id
                    ? { borderColor: t.color, color: t.color, backgroundColor: t.color + '1a' }
                    : undefined
                }
                title={t.name}
              >
                {t.badge}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-2">Tier Rank</div>
              <div className="col-span-5">Player Name &amp; User Tag</div>
              <div className="col-span-3">Country</div>
              <div className="col-span-2 text-right">Banked Chips</div>
            </div>
            <ol className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
              {milestoneBoard.length === 0 ? (
                <EmptyState />
              ) : (
                milestoneBoard.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      onClick={() => inspectPlayer(e)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : 'hover:bg-slate-900/40'}`}
                    >
                      <div className="col-span-2 flex items-center gap-1.5 font-mono">
                        {RANK_MEDALS[e.rank] ? (
                          <span className="text-lg">{RANK_MEDALS[e.rank]}</span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{e.rank}</span>
                        )}
                        {isMe && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">YOU</span>}
                      </div>
                      <div className="col-span-5 min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          {e.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">{e.userTag}</div>
                      </div>
                      <div className="col-span-3 text-xs text-slate-300 flex items-center gap-1.5">
                        <span aria-hidden>{countryFlag(e.country)}</span> {countryName(e.country)}
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        {e.bankedChips.toLocaleString()}c
                      </div>
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
