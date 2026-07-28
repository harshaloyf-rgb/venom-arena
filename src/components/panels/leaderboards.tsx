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
} from 'lucide-react';

interface LeaderboardsProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type LevelTab = 'level3' | 'level2' | 'level1';
type Level3Sub = 'summit' | 'global';

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

// Country #1 summit table — for each of 12 countries, show one champion
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

// National board for a given country code — top 100
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

// Milestone-tier board — players at each milestone
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

  // Rank 1 is the first achiever of this tier
  const firstAchieverMap: Record<string, { name: string; userTag: string; country: string; dateStr: string }> = {
    bronze: { name: 'Rookie_Striker', userTag: '#IND-104', country: 'IN', dateStr: '02 Jan 2026, 09:15 AM UTC' },
    silver: { name: 'Viper_Zero', userTag: '#USA-402', country: 'US', dateStr: '07 Jan 2026, 02:40 PM UTC' },
    gold: { name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', dateStr: '11 Jan 2026, 06:30 AM SGT' },
    platinum: { name: 'Apex_Viper', userTag: '#USA-882', country: 'US', dateStr: '16 Jan 2026, 11:10 PM UTC' },
    diamond: { name: 'Shadow_Ninja', userTag: '#JPN-309', country: 'JP', dateStr: '19 Jan 2026, 08:22 PM JST' },
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

export function Leaderboards({ onToast, onInspectPlayer }: LeaderboardsProps) {
  const { player } = useAuth();
  const [levelTab, setLevelTab] = useState<LevelTab>('level3');
  const [level3Sub, setLevel3Sub] = useState<Level3Sub>('summit');
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
        // Fallback to mock
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
    // Auto-refresh every 30 minutes (per audit D.4)
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
    // Live entries are higher priority; append generated for ranks beyond live count
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

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-amber-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-widest">
              CURRENT YEAR (2026) CONCURRENT TOURNAMENT HIERARCHY
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
            Complete real-time standings for Level 1 (Milestone Tiers), Level 2 (National Boards),
            and Level 3 (World Summit). Click any player row to inspect full profile &amp; rank status!
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

      {/* Level Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-5">
        <LevelTabBtn active={levelTab === 'level3'} onClick={() => setLevelTab('level3')} icon={Crown} label="Level 3: World Summit & Global" color="amber" />
        <LevelTabBtn active={levelTab === 'level2'} onClick={() => setLevelTab('level2')} icon={Globe} label="Level 2: National Boards" color="cyan" />
        <LevelTabBtn active={levelTab === 'level1'} onClick={() => setLevelTab('level1')} icon={Medal} label="Level 1: Milestone Tier Ranks" color="yellow" />
      </div>

      {/* Level 3: World Summit / Global */}
      {levelTab === 'level3' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLevel3Sub('summit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${level3Sub === 'summit' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              <Crown className="w-3.5 h-3.5" /> #1 Country Champions (World Summit)
            </button>
            <button
              type="button"
              onClick={() => setLevel3Sub('global')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${level3Sub === 'global' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              <Globe className="w-3.5 h-3.5" /> All Players Global Rankings (Rank #1 to N)
            </button>
            <span className="ml-auto text-[10px] font-mono text-slate-500">
              Total Global Competitors: {(liveEntries.length || globalRanks.length).toLocaleString()} Players
            </span>
          </div>

          {level3Sub === 'summit' && (
            <>
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
                  {countrySummit.map((c, i) => {
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
                          <div className="text-[10px] font-mono text-slate-500">{c.userTag} · 🕒 26 Jul 2026</div>
                        </div>
                        <div className="col-span-3 text-xs text-slate-300 flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(c.country)}</span> {countryName(c.country)}
                        </div>
                        <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                          {c.chips.toLocaleString()}c
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}

          {level3Sub === 'global' && (
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
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Loading global ranks…
                  </li>
                ) : globalRanks.map((e) => {
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
                        <div className="text-[10px] font-mono text-slate-500">{e.userTag} · 🕒 26 Jul 2026</div>
                      </div>
                      <div className="col-span-3 text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono" style={{ color: tier.color }}>
                          {tier.badge}
                        </span>
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        {e.bankedChips.toLocaleString()}c
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Level 2: National */}
      {levelTab === 'level2' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">Select Country Leaderboard (197 Supported):</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500/50"
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
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
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
              {filteredNational.map((e) => {
                const isMe = e.userTag === player.userTag;
                return (
                  <li
                    key={e.userTag + e.rank}
                    onClick={() => inspectPlayer(e)}
                    className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm cursor-pointer transition-colors ${isMe ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : 'hover:bg-slate-900/40'}`}
                  >
                    <div className="col-span-2 flex items-center gap-1.5 font-mono">
                      {RANK_MEDALS[e.rank] ? (
                        <span className="text-lg">{RANK_MEDALS[e.rank]}</span>
                      ) : (
                        <span className="text-slate-400 font-bold">#{e.rank}</span>
                      )}
                      {isMe && <span className="text-[9px] bg-cyan-500 text-black px-1 rounded font-bold">YOU</span>}
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
              })}
            </ol>
          </div>
        </div>
      )}

      {/* Level 1: Milestone Tiers */}
      {levelTab === 'level1' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/10 p-3 text-[11px] text-yellow-200 leading-relaxed">
            <strong>LEVEL 1 MILESTONE TIER RANKING BOARD:</strong> All players who have reached each chip
            milestone are ranked from #1 to all joined competitors! Click any player to inspect profile &amp; dossier.
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {MILESTONE_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTierId(t.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${selectedTierId === t.id ? 'border' : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'}`}
                style={selectedTierId === t.id ? { borderColor: t.color, color: t.color, background: `${t.color}1a` } : {}}
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
              {milestoneBoard.map((e) => {
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
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

interface LevelTabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Crown;
  label: string;
  color: 'amber' | 'cyan' | 'yellow';
}

function LevelTabBtn({ active, onClick, icon: Icon, label, color }: LevelTabBtnProps) {
  const colorMap = {
    amber: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    cyan: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
    yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${active ? colorMap[color] : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

export default Leaderboards;
