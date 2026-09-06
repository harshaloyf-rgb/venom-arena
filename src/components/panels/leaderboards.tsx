'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  COUNTRIES,
  MILESTONE_TIERS,
  countryFlag,
  countryName,
  milestoneTierForChips,
  regionOf,
  REGIONS,
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
  Clock,
  Swords,
  Eye,
} from 'lucide-react';

interface LeaderboardsProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type TopTab = 'summit' | 'global' | 'national' | 'regional' | 'tiers';

const RANK_MEDALS: Record<number, string> = { 1: '\u{1F947}', 2: '\u{1F948}', 3: '\u{1F949}' };

// ── Region utilities (regionOf, REGIONS) imported from game-config ──

// ── Championship prize tier for a given rank ───────────────────────
// Names mirror the Annual Championship prize tiers (Rules Section 13).
// `short` is the compact desktop Status pill; the full label is always in
// the title tooltip and in the mobile expanded row.
function championshipPrizeForRank(rank: number): { label: string; short: string; color: string } | null {
  if (rank === 1) return { label: '\u{1F451} World Champion', short: '\u{1F451} Champion', color: '#fbbf24' };
  if (rank <= 10) return { label: '\u{1F948} Elite 10', short: '\u{1F948} Elite 10', color: '#cbd5e1' };
  if (rank <= 50) return { label: '\u{1F949} Masters 50', short: '\u{1F949} Masters 50', color: '#b45309' };
  if (rank <= 100) return { label: '\u{1F6E1}\u{FE0F} Qualifier 100', short: '\u{1F6E1}\u{FE0F} Qualifier 100', color: '#64748b' };
  return null;
}

// ── Extended milestone tiers including Rookie ──────────────────────
const ALL_MILESTONE_TIERS = [
  { id: 'all', name: 'All Tiers', minChips: 0, badge: '\u2b50 All', color: '#94a3b8' },
  ...MILESTONE_TIERS.filter((t) => t.id !== 'all'),
];

// ── Tab descriptions ──────────────────────────────────────────────
const TAB_DESCRIPTIONS: Record<TopTab, { title: string; desc: string; scope: string }> = {
  summit: {
    title: 'World Cup Summit',
    desc: 'Only the #1 ranked player from each country appears here. Think of it as the Olympics \u2014 one champion per nation, ranked by banked chips.',
    scope: '1 player per country \u2192 top 100 ranked by banked chips',
  },
  global: {
    title: 'Global Rankings',
    desc: 'Every single player in the world, ranked #1 to N by total banked chips. This is the main leaderboard \u2014 all players, one unified ranking.',
    scope: 'All players worldwide \u2192 ranked #1 to N (fetches the top 1000)',
  },
  national: {
    title: 'National Rankings',
    desc: 'Players from your selected country only, ranked against each other. See who dominates your home turf.',
    scope: 'Players from 1 country \u2192 top 100 by banked chips',
  },
  regional: {
    title: 'Regional Rankings',
    desc: 'Players grouped by world region (8 regions covering all countries). See how you stack up against your geographic neighbors.',
    scope: 'Players from 1 region \u2192 top 100 by banked chips',
  },
  tiers: {
    title: 'Milestone Tiers',
    desc: 'Players whose current Milestone Badge matches the selected tier. Badges are exclusive \u2014 a player holds exactly one \u2014 so each board never overlaps another (e.g. Gold holds players from 1M up to 2.5M banked chips).',
    scope: 'Players currently holding the selected badge \u2192 top 100',
  },
};

// ── Tie-break explanation text (shown on every tab) ───────────────
const TIE_BREAK_EXPLANATION = 'Tie-break: Most chips wins. If tied: higher level wins. If still tied: earlier join date wins (veteran advantage).';

// ── No more demo entries — empty state shown instead ──────────

// ── Types ─────────────────────────────────────────────────────────
interface EnrichedEntry extends LeaderboardEntry {
  clanTag?: string | null;
  isHOF?: boolean;
  championshipPrize?: { label: string; short: string; color: string } | null;
  rankChange?: number;
  milestoneBadge?: string;
  milestoneColor?: string;
  // Tie-breaking: set when this entry has the same chips as the entry above
  tieBreakReason?: 'level' | 'joinDate';
}

interface MilestoneRecord {
  tier: string;
  badge: string;
  color: string;
  chips: number;
  achievedAt: string;
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
  milestones: MilestoneRecord[];
}

// ── Sub-components ─────────────────────────────────────────────────

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 lg:py-4 text-slate-500">
      <Inbox className="w-10 h-10 mb-3 lg:w-5 lg:h-5 lg:mb-1 text-slate-600" />
      <p className="text-sm lg:text-[11px] font-medium">{message || 'No entries yet'}</p>
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border whitespace-nowrap lg:gap-1 lg:px-1.5 lg:py-0.5 lg:text-[11px] ${
        active
          ? `border ${color}/40 ${color.replace('#', 'text-')}`
          : 'text-slate-500 hover:text-slate-300 border-transparent'
      }`}
      style={active ? { borderColor: color, color: color, backgroundColor: color + '1a' } : undefined}
    >
      <Icon className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5" />
      {label}
    </button>
  );
}

// Rank change indicator
function RankChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <Minus className="w-3 h-3 text-slate-600" />;
  if (change > 0) return <span className="inline-flex items-center gap-0.5 text-emerald-400 font-mono text-[11px] font-bold"><TrendingUp className="w-3 h-3" />+{change}</span>;
  return <span className="inline-flex items-center gap-0.5 text-red-400 font-mono text-[11px] font-bold"><TrendingDown className="w-3 h-3" />{change}</span>;
}

// Tie-break badge — shows WHY this player is ranked here when chips are tied
function TieBreakBadge({ reason }: { reason: 'level' | 'joinDate' }) {
  if (reason === 'level') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded" title="Ranked lower because of lower level. Tie-break: chips \u2192 level \u2192 join date.">
        <Swords className="w-3 h-3" /> Lower Lv
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-mono text-slate-400/80 bg-slate-500/10 border border-slate-500/20 px-1.5 py-0.5 rounded" title="Same level \u2014 ranked lower because joined later. Tie-break: chips \u2192 level \u2192 join date.">
      <Clock className="w-3 h-3" /> Joined Later
    </span>
  );
}

// Top 3 Podium for Global tab
function GlobalPodium({ entries, onInspect }: { entries: EnrichedEntry[]; onInspect: (e: EnrichedEntry) => void }) {
  if (entries.length < 3) return null;
  const top3 = entries.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]];
  const heights = ['h-28', 'h-36', 'h-22'];
  const sizes = ['text-base lg:text-[11px]', 'text-2xl lg:text-[11px]', 'text-sm lg:text-[11px]'];
  const chipColors = ['text-slate-300', 'text-amber-400', 'text-amber-600'];
  const borderColors = ['border-slate-500/40', 'border-amber-500/60', 'border-amber-700/40'];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5 lg:gap-1 lg:mb-1">
      {order.map((p, i) => (
        <button
          key={p.userTag}
          type="button"
          onClick={() => onInspect(p)}
          className={`relative flex flex-col items-center justify-end rounded-2xl border ${borderColors[i]} bg-slate-950/80 p-3 pb-4 lg:p-1.5 lg:pb-1.5 transition hover:brightness-125 cursor-pointer`}
        >
          <div className={`absolute top-2 ${sizes[i]} font-bold`}>{RANK_MEDALS[p.rank]}</div>
          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 ${borderColors[i]} flex items-center justify-center text-lg sm:text-xl mb-2 lg:w-6 lg:h-6 lg:mb-1 lg:text-[11px]`}>
            {countryFlag(p.country)}
          </div>
          <div className="font-bold text-white text-xs sm:text-sm lg:text-[11px] max-w-full text-center">{p.name}</div>
          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500">{p.userTag}</div>
          <div className={`font-mono font-black ${chipColors[i]} text-xs sm:text-sm mt-1 lg:text-[11px] lg:mt-0`}>{p.bankedChips.toLocaleString()}c</div>
          {p.clanTag && (
            <span className="text-[9px] lg:text-[11px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 lg:px-1 lg:py-0 rounded mt-1 lg:mt-0">[{p.clanTag}]</span>
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
    <div className="relative mb-4 p-2.5 flex items-center gap-3 overflow-hidden lg:mb-1 lg:p-1 lg:gap-1.5">
      <span className="inline-flex items-center gap-1 text-[9px] lg:text-[11px] font-mono font-bold text-rose-300 uppercase tracking-widest px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 rounded shrink-0">
        <Radio className="w-2.5 h-2.5 lg:w-2 lg:h-2 animate-pulse" /> LIVE
      </span>
      <div ref={tickerRef} className="text-xs lg:text-[11px] text-rose-200/90 flex-1">{msg.text}</div>
      <span className="text-[9px] lg:text-[11px] font-mono text-slate-600 shrink-0">{msg.ts}</span>
    </div>
  );
}

// Find Me rank card
function FindMeCard({ myRank, activeTab, onClose }: {
  myRank: MyRankData;
  activeTab: TopTab;
  onClose: () => void;
}) {
  const contextualRank = (() => {
    switch (activeTab) {
      case 'summit': return { label: 'National (your country)', rank: myRank.nationalRank, total: myRank.totalNational, color: 'text-amber-400' };
      case 'global': return { label: 'Global', rank: myRank.globalRank, total: myRank.totalGlobal, color: 'text-amber-400' };
      // Always the player's OWN country — viewing a foreign national board
      // must not label your home-country rank with the viewed country name.
      case 'national': return { label: `National (${myRank.country ? countryName(myRank.country) : 'your country'})`, rank: myRank.nationalRank, total: myRank.totalNational, color: 'text-violet-400' };
      case 'regional': return { label: `Regional (${myRank.regionName})`, rank: myRank.regionalRank, total: myRank.totalRegional, color: 'text-pink-400' };
      case 'tiers': return { label: 'Global (tier boards keep global order)', rank: myRank.globalRank, total: myRank.totalGlobal, color: 'text-yellow-400' };
    }
  })();

  const cr = contextualRank;
  const currentTier = milestoneTierForChips(myRank.bankedChips);
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) + ', ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';
  };

  return (
    <div className="relative rounded-xl p-4 mb-4 lg:p-1.5 lg:mb-1 border border-amber-500/40 bg-amber-950/20 animate-in fade-in slide-in-from-top-2 duration-300">
      <button type="button" onClick={onClose} className="absolute top-2 right-2 lg:top-0.5 lg:right-0.5 text-slate-500 hover:text-white transition"><X className="w-4 h-4 lg:w-2.5 lg:h-2.5" /></button>
      <div className="flex items-center gap-2 mb-3 lg:gap-1 lg:mb-0.5">
        <Crosshair className="w-4 h-4 lg:w-2.5 lg:h-2.5 text-amber-400" />
        <span className="text-xs lg:text-[11px] font-bold text-amber-300 uppercase tracking-widest font-mono">Your Rank Summary</span>
      </div>

      <div className="rounded-lg bg-slate-950/60 p-3 mb-3 lg:p-1 lg:mb-0.5 border border-slate-800">
        <div className="text-[10px] lg:text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Your rank in this view</div>
        <div className={`text-2xl lg:text-[11px] font-black tabular-nums ${cr.color}`}>#{cr.rank}<span className="text-[10px] lg:text-[11px] text-slate-500 font-normal ml-1">/ {cr.total}</span></div>
        <div className="text-[10px] lg:text-[11px] text-slate-400">{cr.label}</div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3 lg:gap-1 lg:mb-0.5">
        <div>
          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Global</div>
          <div className="text-sm lg:text-[11px] font-black text-amber-400 tabular-nums">#{myRank.globalRank}<span className="text-[9px] lg:text-[11px] text-slate-500 font-normal ml-1">/ {myRank.totalGlobal}</span></div>
        </div>
        <div>
          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">National</div>
          <div className="text-sm lg:text-[11px] font-black text-emerald-400 tabular-nums">#{myRank.nationalRank}<span className="text-[9px] lg:text-[11px] text-slate-500 font-normal ml-1">/ {myRank.totalNational}</span></div>
        </div>
        <div>
          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Regional</div>
          <div className="text-sm lg:text-[11px] font-black text-pink-400 tabular-nums">#{myRank.regionalRank}<span className="text-[9px] lg:text-[11px] text-slate-500 font-normal ml-1">/ {myRank.totalRegional}</span></div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] lg:gap-1 lg:text-[11px] font-mono text-slate-400 mb-3">
        <span>Chips: <span className="text-emerald-400 font-bold">{myRank.bankedChips.toLocaleString()}c</span></span>
        <span>&middot;</span>
        <span>Level: <span className="text-white font-bold">{myRank.level}</span></span>
        <span>&middot;</span>
        <span>Badge: <span className="font-bold" style={{ color: currentTier.color }}>{myRank.tier}</span></span>
        {myRank.clanTag && <><span>&middot;</span><span>Clan: <span className="text-cyan-300 font-bold">[{myRank.clanTag}]</span></span></>}
      </div>

      {/* Milestones in Find Me card */}
      {myRank.milestones.length > 0 && (
        <div className="border-t border-slate-800 pt-2 mt-2 lg:pt-0.5 lg:mt-0.5">
          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Milestone History</div>
          <div className="flex flex-wrap gap-2 lg:gap-1">
            {myRank.milestones.map((m) => (
              <div key={m.tier} className="rounded-md bg-slate-900 border border-slate-800 px-2 py-1 lg:px-1 lg:py-0.5 flex flex-col">
                <span className="text-[10px] lg:text-[11px] font-bold" style={{ color: m.color }}>{m.badge}</span>
                <span className="text-[9px] lg:text-[11px] font-mono text-slate-400">{m.chips.toLocaleString()}c</span>
                <span className="text-[8px] lg:text-[11px] font-mono text-slate-500">{fmtDate(m.achievedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Tab description banner
function TabDescription({ tab }: { tab: TopTab }) {
  const info = TAB_DESCRIPTIONS[tab];
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3 lg:p-1">
      <div className="flex items-start gap-2 lg:items-center lg:gap-1">
        <Info className="w-4 h-4 lg:w-2.5 lg:h-2.5 text-slate-400 mt-0.5 lg:mt-0 shrink-0" />
        <div className="lg:flex lg:items-center lg:gap-2 lg:flex-1 lg:min-w-0">
          <div className="text-xs lg:text-[11px] font-bold text-white mb-1 lg:mb-0 shrink-0">{info.title}</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">{info.desc}</p>
          <div className="mt-1.5 lg:mt-0 inline-flex items-center gap-1.5 text-[11px] lg:text-[11px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 lg:px-1 lg:py-0 rounded">
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
  const [showFindMe, setShowFindMe] = useState(true);
  const [myRankData, setMyRankData] = useState<MyRankData | null>(null);
  const [isRealData, setIsRealData] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // userTag -> rank from the previous successful fetch of the SAME board
  // (for Move deltas). boardSignatureRef guards against cross-tab bleed:
  // without it, switching tabs produced meaningless movement (global #5 ->
  // national #1 would show as a false +4 gain).
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const boardSignatureRef = useRef<string>('');

  const playerTag = player?.userTag;

  // Fetch board data from API based on active tab
  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: 'chips' });

      switch (activeTab) {
        case 'summit':
          params.set('view', 'world_summit');
          params.set('limit', '100');
          break;
        case 'global':
          params.set('view', 'global');
          // No limit = server defaults to 1000 (1-to-N)
          break;
        case 'national':
          params.set('view', 'national');
          params.set('country', selectedCountry);
          params.set('limit', '100');
          break;
        case 'regional':
          params.set('view', 'regional');
          params.set('region', selectedRegion);
          params.set('limit', '100');
          break;
        case 'tiers':
          params.set('view', 'global');
          params.set('limit', '100');
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
          isHOF?: boolean; createdAt?: string;
        }>; error?: string;
      };

      if (res.ok && data.entries && data.entries.length > 0) {
        // Real rank movement: deltas are computed against the PREVIOUS fetch
        // of the SAME board (tab + country/region/tier). The API's real
        // isHOF flag drives the golden HOF icon (previously hardcoded false,
        // so the documented Hall-of-Fame icon never rendered).
        const signature = `${activeTab}:${selectedCountry}:${selectedRegion}:${selectedTierId}`;
        const sameBoard = boardSignatureRef.current === signature;
        boardSignatureRef.current = signature;
        const prevRanks = sameBoard ? prevRanksRef.current : null;
        const enriched: EnrichedEntry[] = data.entries.map((e) => ({
          ...e,
          isPlayer: e.userTag === playerTag,
          isHOF: !!e.isHOF,
          championshipPrize: championshipPrizeForRank(e.rank),
          rankChange: prevRanks?.has(e.userTag) ? (prevRanks.get(e.userTag)! - e.rank) : 0,
          region: e.region || regionOf(e.country || ''),
        }));
        const currentRanks = new Map<string, number>();
        for (const e of data.entries) currentRanks.set(e.userTag, e.rank);
        prevRanksRef.current = currentRanks;

        // Compute tie-break reasons by comparing consecutive entries
        for (let i = 1; i < enriched.length; i++) {
          if (enriched[i].bankedChips === enriched[i - 1].bankedChips) {
            if (enriched[i].level < enriched[i - 1].level) {
              enriched[i].tieBreakReason = 'level';
            } else {
              // Same level or lower — ranked by join date (veteran wins)
              enriched[i].tieBreakReason = 'joinDate';
            }
          }
        }

        setEntries(enriched);
        setIsRealData(true);
      } else {
        setEntries([]);
        setIsRealData(false);
      }
      setLastUpdated(new Date());
    } catch {
      setEntries([]);
      setIsRealData(false);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedCountry, selectedRegion, selectedTierId, playerTag]);

  // Fetch milestone history for the current player
  const fetchMilestones = useCallback(async () => {
    if (!playerTag) {
      setMilestones([]);
      setMilestonesLoading(false);
      return;
    }
    setMilestonesLoading(true);
    try {
      const res = await fetch('/api/leaderboard/my-rank', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { milestones?: MilestoneRecord[] };
        setMilestones(data.milestones || []);
      } else {
        setMilestones([]);
      }
    } catch {
      setMilestones([]);
    } finally {
      setMilestonesLoading(false);
    }
  }, [playerTag]);

  // Fetch board when tab/selection changes
  useEffect(() => { void fetchBoard(); }, [fetchBoard]);

  // Auto-refresh every 30 min
  useEffect(() => {
    const id = setInterval(() => void fetchBoard(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchBoard]);

  // Live ticker — REAL aggregate stats from /api/stats/live (MAJOR fix: this
  // previously FABRICATED random "A player from X extracted Y chips" events
  // every 8s — fake activity presented as live data).
  useEffect(() => {
    let cancelled = false;
    async function pollLiveStats() {
      if (!isRealData) return;
      try {
        const res = await fetch('/api/stats/live', { cache: 'no-store' });
        if (!res.ok) return;
        const d = (await res.json()) as {
          today?: { totalMatches?: number; extractions?: number; chipsEarned?: number; kills?: number };
          totalPlayers?: number;
        };
        if (cancelled) return;
        const t = d.today ?? {};
        const parts: string[] = [];
        if ((t.totalMatches ?? 0) > 0) parts.push(`\u{1F3AE} ${t.totalMatches!.toLocaleString('en-IN')} matches played today`);
        if ((t.extractions ?? 0) > 0) parts.push(`\u{1F4B0} ${t.extractions!.toLocaleString('en-IN')} extractions`);
        if ((t.chipsEarned ?? 0) > 0) parts.push(`${(t.chipsEarned ?? 0).toLocaleString('en-IN')}c banked`);
        if ((t.kills ?? 0) > 0) parts.push(`\u{1F4A5} ${t.kills!.toLocaleString('en-IN')} eliminations`);
        if ((d.totalPlayers ?? 0) > 0) parts.push(`\u{1F30D} ${d.totalPlayers!.toLocaleString('en-IN')} registered agents`);
        if (parts.length === 0) return;
        const ts = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
        setTickerMessages([{ id: `live-${Date.now()}`, ts, text: ' ' + parts.join('  ·  ') }]);
      } catch {
        // stats endpoint unavailable — ticker simply stays empty (never fake)
      }
    }
    void pollLiveStats();
    const id = setInterval(() => void pollLiveStats(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isRealData]);

  // Sync selected country with player's country when it changes
  useEffect(() => {
    if (player?.country) setSelectedCountry(player.country);
  }, [player?.country]);

  // Regional tab opens on the player's own world region (same pattern as
  // the country sync above; APAC default only before the profile loads)
  useEffect(() => {
    if (player?.country) setSelectedRegion(regionOf(player.country));
  }, [player?.country]);

  // Silent rank fetch (no toast, no scroll) — used on mount
  const handleFindMeSilent = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard/my-rank', { cache: 'no-store' });
      const data = await res.json() as { error?: string } & MyRankData;
      if (res.ok && !data.error) {
        setMyRankData(data);
        if (data.milestones && data.milestones.length > 0) {
          setMilestones(data.milestones);
        }
      }
    } catch { /* silent */ }
  }, []);

  // Fetch milestones and rank summary on mount
  useEffect(() => {
    void fetchMilestones();
    void handleFindMeSilent();
  }, [fetchMilestones, handleFindMeSilent]);

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
    onInspectPlayer({
      name: e.name, userTag: e.userTag, country: e.country,
      flag: countryFlag(e.country), bankedChips: e.bankedChips, level: e.level,
      clanTag: e.clanTag || '\u2014', clanName: 'Clan ' + (e.clanTag || '\u2014'),
      // Pass the rank matching the clicked view — the inspector labels its
      // chips Global / flag National / Regional. Summit and tier-band
      // positions have no matching dossier chip, so nothing is passed rather
      // than mislabeling them as a global rank.
      ...(activeTab === 'global' ? { globalRank: e.rank } : {}),
      ...(activeTab === 'national' ? { countryRank: e.rank } : {}),
      ...(activeTab === 'regional' ? { regionalRank: e.rank } : {}),
      ...(activeTab === 'tiers' && selectedTierId === 'all' ? { globalRank: e.rank } : {}),
    });
  }

  // Per-tab Find Me handler (with toast + scroll)
  async function handleFindMe() {
    try {
      const res = await fetch('/api/leaderboard/my-rank', { cache: 'no-store' });
      const data = await res.json() as { error?: string } & MyRankData;

      if (!res.ok || data.error) {
        notify('Could not fetch your rank. Try again.', 'error', onToast);
        return;
      }

      setMyRankData(data);

      // Also update milestones from this response
      if (data.milestones && data.milestones.length > 0) {
        setMilestones(data.milestones);
      }

      // Try to find the player in the current visible list
      const myRow = listRef.current?.querySelector('[data-is-me="true"]');
      if (myRow) {
        myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        myRow.classList.add('ring-2', 'ring-amber-400/60');
        setTimeout(() => myRow.classList.remove('ring-2', 'ring-amber-400/60'), 2000);
        notify('Found you on the leaderboard!', 'success', onToast);
      } else {
        setShowFindMe(true);
        notify(`You are #${data.globalRank} globally. See your rank summary below!`, 'info', onToast);
      }
    } catch {
      notify('Could not fetch your rank. Check your connection.', 'error', onToast);
    }
  }

  // Honest count labels: every board except Global is capped at 100 rows
  // (Global at 1000). When a board sits at its cap, say "Top N" instead of
  // implying the count is exhaustive.
  const activeRegionName = REGIONS.find((r) => r.code === selectedRegion)?.name || selectedRegion;
  const cap100 = entries.length >= 100;
  const cap1000 = entries.length >= 1000;
  const activeTier = ALL_MILESTONE_TIERS.find((t) => t.id === selectedTierId);
  const tierBadge = activeTier?.badge ?? '';
  const tiersCountLabel = !isRealData
    ? 'No players in this tier yet'
    : selectedTierId === 'all'
      ? (cap100 ? 'Top 100 players (all tiers)' : `${filteredEntries.length} players (all tiers)`)
      : (cap100 ? `Top 100 ${tierBadge} holders` : `${filteredEntries.length} ${tierBadge} holders`);

  const tabs: { id: TopTab; icon: typeof Crown; label: string; color: string }[] = [
    { id: 'summit', icon: Crown, label: 'Summit', color: '#f59e0b' },
    { id: 'global', icon: Globe, label: 'Global', color: '#06b6d4' },
    { id: 'national', icon: MapPin, label: 'National', color: '#8b5cf6' },
    { id: 'regional', icon: Users, label: 'Regional', color: '#ec4899' },
    { id: 'tiers', icon: Medal, label: 'Tiers', color: '#eab308' },
  ];

  // Reusable per-tab toolbar (count + Find Me + tie-break info)
  function TabToolbar({ countLabel, tabColor }: { countLabel?: string; tabColor: string }) {
    return (
      <div className="flex items-center justify-between flex-wrap gap-2 lg:gap-1">
        <span className="text-[10px] lg:text-[11px] font-mono text-slate-500">{countLabel}</span>
        <div className="flex items-center gap-2 lg:gap-1">
          <span className="text-[9px] lg:text-[11px] font-mono text-slate-600" title={TIE_BREAK_EXPLANATION}>
            Tie-break: chips &rarr; level &rarr; join date
          </span>
          <button
            type="button"
            onClick={() => { void handleFindMe(); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 lg:px-1.5 lg:py-0.5 rounded-lg text-[10px] lg:text-[11px] font-bold transition border"
            style={{
              borderColor: tabColor + '40',
              color: tabColor,
              backgroundColor: tabColor + '15',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tabColor + '25'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tabColor + '15'; }}
          >
            <Crosshair className="w-3 h-3 lg:w-2.5 lg:h-2.5" /> Find Me
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 lg:p-1.5 lg:pt-1 overflow-hidden lg:overflow-visible">
      <GlowBlob color="bg-amber-500/10" className="-top-12 -right-12 w-56 h-56 lg:hidden" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 lg:gap-1 lg:mb-0.5 lg:pb-0.5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 lg:gap-1 flex-wrap">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] lg:text-[11px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-widest">
              2026 CHAMPIONSHIP SEASON
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] lg:text-[11px] font-mono text-amber-400 font-bold px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded">
              <Zap className="w-3 h-3" /> LIVE &middot; 30min updates
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-[11px] font-sans font-black text-white tracking-tight flex items-center gap-2.5 mt-2">
            <Trophy className="w-5.5 h-5.5 lg:w-3 lg:h-3 text-amber-400" />
            Official World Tournament Leaderboards
          </h2>
          <p className="text-xs lg:text-[11px] lg:mt-0 text-slate-400 mt-1 max-w-3xl lg:hidden">
            Live standings, refreshed every 30 minutes. Tap any tab to see its description.
          </p>
          {lastUpdated && (
            <MicroLabel className="mt-1.5 lg:mt-0 inline-block !text-[11px]">
              Last sync: {lastUpdated.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })} UTC
            </MicroLabel>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { void fetchBoard(); void fetchMilestones(); setShowFindMe(false); notify('Leaderboard refreshed.', 'info', onToast); }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 lg:px-1.5 lg:py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-[11px] uppercase tracking-wider transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Live Ticker */}
      {tickerMessages.length > 0 && <LiveTicker messages={tickerMessages} />}

      {/* Find Me Card — visible until dismissed; switching tabs hides it,
          pressing Find Me brings it back (includes milestones) */}
      {myRankData && showFindMe && <FindMeCard myRank={myRankData} activeTab={activeTab} onClose={() => setShowFindMe(false)} />}

      {/* Tab Description */}
      <TabDescription tab={activeTab} />

      {/* Tabs + Search */}
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 mt-4 mb-4 lg:gap-1 lg:mt-1 lg:mb-1">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 lg:p-0.5 rounded-xl border border-slate-800/60 flex-1">
          {tabs.map((tab) => (
            <TabBtn key={tab.id} active={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setShowFindMe(false); setExpandedRow(null); }} icon={tab.icon} label={tab.label} color={tab.color} />
          ))}
        </div>
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search player, tag, clan..."
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 lg:py-0.5 text-xs lg:text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 w-full sm:w-52"
          />
        </div>
      </div>

      {/* ====== SUMMIT TAB ====== */}
      {activeTab === 'summit' && (
        <div className="space-y-4 lg:space-y-1">
          <TabToolbar
            countLabel={isRealData ? (cap100 ? 'Top 100 Country Champions' : `${filteredEntries.length} Country Champions`) : 'No country champions yet. Be the first!'}
            tabColor="#f59e0b"
          />
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden lg:overflow-visible">
            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Country Champion</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-2">Nation</div>
              <div className="col-span-2 text-right">Chips</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll lg:max-h-none lg:overflow-visible">
              {loading ? (
                <li className="p-4 lg:p-2 text-center text-slate-500 text-xs lg:text-[11px] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 lg:w-3 lg:h-3 animate-spin text-amber-400" /> Loading summit data&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message="No country champions yet. Be the first!" /> : (
                filteredEntries.map((c, i) => {
                  const isMe = c.userTag === player.userTag;
                  return (
                    <li
                      key={c.country + c.userTag}
                      data-is-me={isMe || undefined}
                      className={`cursor-pointer transition-colors ${isMe ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}
                    >
                      {/* Mobile card layout (hidden on desktop) */}
                      <div className="lg:hidden px-3 py-2" onClick={() => setExpandedRow(expandedRow === c.userTag ? null : c.userTag)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* c.rank = true Summit position (stable while searching) */}
                            {RANK_MEDALS[c.rank] ? <span className="text-base shrink-0">{RANK_MEDALS[c.rank]}</span> : <span className="text-slate-400 font-bold shrink-0">#{c.rank}</span>}
                            {c.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            <span className="font-bold text-white min-w-0">{c.name}</span>
                            {isMe && <span className="text-[11px] bg-amber-500 text-black px-1 rounded font-bold shrink-0">YOU</span>}
                            
                          </div>
                          <div className="font-mono font-bold text-emerald-400 shrink-0 ml-2">{c.bankedChips.toLocaleString()}c</div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono">{c.userTag}</span>
                          {c.clanTag && <span className="font-mono text-cyan-400">[{c.clanTag}]</span>}
                          <span className="flex items-center gap-1"><span aria-hidden>{countryFlag(c.country)}</span>{countryName(c.country)}</span>
                        </div>
                        {expandedRow === c.userTag && (
                          <div className="mt-1 pt-1 border-t border-slate-800 text-[11px]">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1"><span aria-hidden>{countryFlag(c.country)}</span>{countryName(c.country)}</span>
                              {c.clanTag && <span className="font-mono text-cyan-400">[{c.clanTag}]</span>}
                              {c.championshipPrize && <span className="font-mono font-bold" style={{ color: c.championshipPrize.color }}>{c.championshipPrize.label}</span>}
                            </div>
                            <button type="button" onClick={() => inspectPlayer(c)} title="View profile" className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white transition">
                              <Eye className="w-2.5 h-2.5" /> View Profile
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Desktop grid layout (hidden on mobile) */}
                      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px]" onClick={() => inspectPlayer(c)}>
                        <div className="lg:col-span-1 font-mono">
                          {RANK_MEDALS[c.rank] ? <span className="text-lg lg:text-[11px]">{RANK_MEDALS[c.rank]}</span> : <span className="text-slate-400 font-bold">#{c.rank}</span>}
                          {c.tieBreakReason && <TieBreakBadge reason={c.tieBreakReason} />}
                        </div>
                        <div className="lg:col-span-1"><RankChangeIndicator change={c.rankChange || 0} /></div>
                        <div className="lg:col-span-3 min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {c.isHOF && <Award className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            {c.name}
                            {isMe && <span className="text-[9px] lg:text-[11px] bg-amber-500 text-black px-1 rounded font-bold">YOU</span>}
                            
                          </div>
                          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500">{c.userTag}</div>
                        </div>
                        <div className="lg:col-span-2">
                          {c.clanTag ? <span className="text-[10px] lg:text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 lg:px-1 lg:py-0 rounded">[{c.clanTag}]</span> : <span className="text-slate-700 text-[10px] lg:text-[11px]">&mdash;</span>}
                        </div>
                        <div className="lg:col-span-2 text-xs lg:text-[11px] text-slate-300 flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(c.country)}</span> {countryName(c.country)}
                        </div>
                        <div className="lg:col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{c.bankedChips.toLocaleString()}c</div>
                        <div className="lg:col-span-1 text-right">
                          {c.championshipPrize && <span title={c.championshipPrize.label} className="text-[8px] lg:text-[11px] font-mono font-bold px-1 py-0.5 rounded" style={{ color: c.championshipPrize.color, backgroundColor: c.championshipPrize.color + '15' }}>{c.championshipPrize.short}</span>}
                        </div>
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
        <div className="space-y-4 lg:space-y-1">
          <TabToolbar
            countLabel={isRealData ? (cap1000 ? 'Top 1000 players worldwide' : `Total Players: ${filteredEntries.length}`) : 'No players ranked yet. Play matches to appear here!'}
            tabColor="#06b6d4"
          />

          {/* Top 3 Podium (only for real data with 3+ entries) */}
          {!searchQuery.trim() && isRealData && entries.length >= 3 && <GlobalPodium entries={entries} onInspect={inspectPlayer} />}

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden lg:overflow-visible">
            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Player</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-2">Tier</div>
              <div className="col-span-2 text-right">Chips</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll lg:max-h-[60vh] lg:overflow-y-auto">
              {loading ? (
                <li className="p-4 lg:p-2 text-center text-slate-500 text-xs lg:text-[11px] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 lg:w-3 lg:h-3 animate-spin text-amber-400" /> Loading global ranks&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message="No players ranked yet. Play matches to appear here!" /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  const tier = e.milestoneBadge && e.milestoneColor
                    ? { badge: e.milestoneBadge, color: e.milestoneColor }
                    : milestoneTierForChips(e.bankedChips);
                  return (
                    <li
                      key={e.userTag + e.rank}
                      data-is-me={isMe || undefined}
                      className={`cursor-pointer transition-colors ${isMe ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}
                    >
                      {/* Mobile card layout (hidden on desktop) */}
                      <div className="lg:hidden px-3 py-2" onClick={() => setExpandedRow(expandedRow === e.userTag ? null : e.userTag)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {RANK_MEDALS[e.rank] ? <span className="text-base shrink-0">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold shrink-0">#{e.rank}</span>}
                            <span aria-hidden className="shrink-0">{countryFlag(e.country)}</span>
                            {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            <span className="font-bold text-white min-w-0">{e.name}</span>
                            {isMe && <span className="text-[11px] bg-amber-500 text-black px-1 rounded font-bold shrink-0">YOU</span>}
                            
                          </div>
                          <div className="font-mono font-bold text-emerald-400 shrink-0 ml-2">{e.bankedChips.toLocaleString()}c</div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono">{e.userTag}</span>
                          {e.clanTag && <span className="font-mono text-cyan-400">[{e.clanTag}]</span>}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 font-mono" style={{ color: tier.color }}>{tier.badge}</span>
                        </div>
                        {expandedRow === e.userTag && (
                          <div className="mt-1 pt-1 border-t border-slate-800 text-[11px]">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1"><span aria-hidden>{countryFlag(e.country)}</span>{countryName(e.country)}</span>
                              {e.clanTag && <span className="font-mono text-cyan-400">[{e.clanTag}]</span>}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 font-mono" style={{ color: tier.color }}>{tier.badge}</span>
                              <span>Level: <span className="font-bold text-white">{e.level}</span></span>
                              {e.championshipPrize && <span className="font-mono font-bold" style={{ color: e.championshipPrize.color }}>{e.championshipPrize.label}</span>}
                            </div>
                            <button type="button" onClick={() => inspectPlayer(e)} title="View profile" className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white transition">
                              <Eye className="w-2.5 h-2.5" /> View Profile
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Desktop grid layout (hidden on mobile) */}
                      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px]" onClick={() => inspectPlayer(e)}>
                        <div className="lg:col-span-1 flex items-center gap-1.5 font-mono">
                          {RANK_MEDALS[e.rank] ? <span className="text-lg lg:text-[11px]">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                          {e.tieBreakReason && <TieBreakBadge reason={e.tieBreakReason} />}
                        </div>
                        <div className="lg:col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                        <div className="lg:col-span-3 min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span aria-hidden>{countryFlag(e.country)}</span>
                            {e.isHOF && <Award className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            {e.name}
                            {isMe && <span className="text-[9px] lg:text-[11px] bg-amber-500 text-black px-1 rounded font-bold">YOU</span>}
                            
                          </div>
                          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500">{e.userTag}</div>
                        </div>
                        <div className="lg:col-span-2">
                          {e.clanTag ? <span className="text-[10px] lg:text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 lg:px-1 lg:py-0 rounded">[{e.clanTag}]</span> : <span className="text-slate-700 text-[10px] lg:text-[11px]">&mdash;</span>}
                        </div>
                        <div className="lg:col-span-2 text-xs lg:text-[11px]">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] lg:text-[11px] font-mono" style={{ color: tier.color }}>{tier.badge}</span>
                        </div>
                        <div className="lg:col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{e.bankedChips.toLocaleString()}c</div>
                        <div className="lg:col-span-1 text-right">
                          {e.championshipPrize && <span title={e.championshipPrize.label} className="text-[8px] lg:text-[11px] font-mono font-bold px-1 py-0.5 rounded" style={{ color: e.championshipPrize.color, backgroundColor: e.championshipPrize.color + '15' }}>{e.championshipPrize.short}</span>}
                        </div>
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
        <div className="space-y-4 lg:space-y-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 lg:w-2.5 lg:h-2.5 text-violet-400" />
              <span className="text-xs lg:text-[11px] font-bold text-white">Country:</span>
              <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 lg:px-1.5 lg:py-0.5 text-xs lg:text-[11px] text-white font-mono focus:outline-none focus:border-violet-500/50">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <TabToolbar
              countLabel={isRealData ? (cap100 ? `Top 100 players from ${countryName(selectedCountry)}` : `${filteredEntries.length} players from ${countryName(selectedCountry)}`) : `No players ranked in ${countryName(selectedCountry)} yet`}
              tabColor="#8b5cf6"
            />
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden lg:overflow-visible">
            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Challenger</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-1 text-right">Lvl</div>
              <div className="col-span-2 text-right">Chips</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll lg:max-h-none lg:overflow-visible">
              {loading ? (
                <li className="p-4 lg:p-2 text-center text-slate-500 text-xs lg:text-[11px] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 lg:w-3 lg:h-3 animate-spin text-violet-400" /> Loading national ranks&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message={`No players ranked in ${countryName(selectedCountry)} yet`} /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      data-is-me={isMe || undefined}
                      className={`cursor-pointer transition-colors ${isMe ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-slate-900/40'}`}
                    >
                      {/* Mobile card layout (hidden on desktop) */}
                      <div className="lg:hidden px-3 py-2" onClick={() => setExpandedRow(expandedRow === e.userTag ? null : e.userTag)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {RANK_MEDALS[e.rank] ? <span className="text-base shrink-0">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold shrink-0">#{e.rank}</span>}
                            {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            <span className="font-bold text-white min-w-0">{e.name}</span>
                            {isMe && <span className="text-[11px] bg-violet-500 text-black px-1 rounded font-bold shrink-0">YOU</span>}
                            
                          </div>
                          <div className="font-mono font-bold text-emerald-400 shrink-0 ml-2">{e.bankedChips.toLocaleString()}c</div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono">{e.userTag}</span>
                          {e.clanTag && <span className="font-mono text-cyan-400">[{e.clanTag}]</span>}
                          <span>Level: <span className="text-amber-400 font-bold font-mono">{e.level}</span></span>
                        </div>
                        {expandedRow === e.userTag && (
                          <div className="mt-1 pt-1 border-t border-slate-800 text-[11px]">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1"><span aria-hidden>{countryFlag(e.country)}</span>{countryName(e.country)}</span>
                              {e.clanTag && <span className="font-mono text-cyan-400">[{e.clanTag}]</span>}
                              <span>Level: <span className="font-bold text-white">{e.level}</span></span>
                              {e.championshipPrize && <span className="font-mono font-bold" style={{ color: e.championshipPrize.color }}>{e.championshipPrize.label}</span>}
                            </div>
                            <button type="button" onClick={() => inspectPlayer(e)} title="View profile" className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white transition">
                              <Eye className="w-2.5 h-2.5" /> View Profile
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Desktop grid layout (hidden on mobile) */}
                      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px]" onClick={() => inspectPlayer(e)}>
                        <div className="lg:col-span-1 flex items-center gap-1.5 font-mono">
                          {RANK_MEDALS[e.rank] ? <span className="text-lg lg:text-[11px]">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                          {e.tieBreakReason && <TieBreakBadge reason={e.tieBreakReason} />}
                        </div>
                        <div className="lg:col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                        <div className="lg:col-span-3 min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {e.isHOF && <Award className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            {e.name}
                            {isMe && <span className="text-[9px] lg:text-[11px] bg-violet-500 text-black px-1 rounded font-bold">YOU</span>}
                            
                          </div>
                          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500">{e.userTag}</div>
                        </div>
                        <div className="lg:col-span-2">
                          {e.clanTag ? <span className="text-[10px] lg:text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 lg:px-1 lg:py-0 rounded">[{e.clanTag}]</span> : <span className="text-slate-700 text-[10px] lg:text-[11px]">&mdash;</span>}
                        </div>
                        <div className="lg:col-span-1 text-right text-xs lg:text-[11px] text-amber-400 font-mono">{e.level}</div>
                        <div className="lg:col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{e.bankedChips.toLocaleString()}c</div>
                        <div className="lg:col-span-2 text-right">
                          {e.championshipPrize && <span title={e.championshipPrize.label} className="text-[8px] lg:text-[11px] font-mono font-bold px-1 py-0.5 rounded" style={{ color: e.championshipPrize.color, backgroundColor: e.championshipPrize.color + '15' }}>{e.championshipPrize.short}</span>}
                        </div>
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
        <div className="space-y-4 lg:space-y-1">
          <div className="flex items-center gap-2 lg:gap-1 flex-wrap">
            {REGIONS.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={() => setSelectedRegion(r.code)}
                className={`px-3 py-1.5 lg:px-1.5 lg:py-0.5 rounded-lg text-xs lg:text-[11px] font-bold flex items-center gap-1.5 lg:gap-1 transition border ${selectedRegion === r.code ? 'bg-pink-500/15 border-pink-500/40 text-pink-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
              >
                <span>{r.flag}</span> {r.name}
              </button>
            ))}
          </div>

          <TabToolbar
            countLabel={isRealData ? (cap100 ? `Top 100 players in ${activeRegionName}` : `${filteredEntries.length} players in ${activeRegionName}`) : `No players in ${activeRegionName} yet`}
            tabColor="#ec4899"
          />

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden lg:overflow-visible">
            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Player</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-2">Country</div>
              <div className="col-span-2 text-right">Chips</div>
              <div className="col-span-1 text-right">Status</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll lg:max-h-none lg:overflow-visible">
              {loading ? (
                <li className="p-4 lg:p-2 text-center text-slate-500 text-xs lg:text-[11px] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 lg:w-3 lg:h-3 animate-spin text-pink-400" /> Loading regional ranks&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message={`No players found in ${REGIONS.find((r) => r.code === selectedRegion)?.name || selectedRegion}`} /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      data-is-me={isMe || undefined}
                      className={`cursor-pointer transition-colors ${isMe ? 'bg-pink-500/10 border-l-2 border-pink-500' : 'hover:bg-slate-900/40'}`}
                    >
                      {/* Mobile card layout (hidden on desktop) */}
                      <div className="lg:hidden px-3 py-2" onClick={() => setExpandedRow(expandedRow === e.userTag ? null : e.userTag)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {RANK_MEDALS[e.rank] ? <span className="text-base shrink-0">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold shrink-0">#{e.rank}</span>}
                            {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            <span className="font-bold text-white min-w-0">{e.name}</span>
                            {isMe && <span className="text-[11px] bg-pink-500 text-black px-1 rounded font-bold shrink-0">YOU</span>}
                            
                          </div>
                          <div className="font-mono font-bold text-emerald-400 shrink-0 ml-2">{e.bankedChips.toLocaleString()}c</div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono">{e.userTag}</span>
                          {e.clanTag && <span className="font-mono text-cyan-400">[{e.clanTag}]</span>}
                          <span className="flex items-center gap-1"><span aria-hidden>{countryFlag(e.country)}</span>{countryName(e.country)}</span>
                        </div>
                        {expandedRow === e.userTag && (
                          <div className="mt-1 pt-1 border-t border-slate-800 text-[11px]">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1"><span aria-hidden>{countryFlag(e.country)}</span>{countryName(e.country)}</span>
                              {e.clanTag && <span className="font-mono text-cyan-400">[{e.clanTag}]</span>}
                              <span>Level: <span className="font-bold text-white">{e.level}</span></span>
                              {e.championshipPrize && <span className="font-mono font-bold" style={{ color: e.championshipPrize.color }}>{e.championshipPrize.label}</span>}
                            </div>
                            <button type="button" onClick={() => inspectPlayer(e)} title="View profile" className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white transition">
                              <Eye className="w-2.5 h-2.5" /> View Profile
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Desktop grid layout (hidden on mobile) */}
                      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px]" onClick={() => inspectPlayer(e)}>
                        <div className="lg:col-span-1 flex items-center gap-1.5 font-mono">
                          {RANK_MEDALS[e.rank] ? <span className="text-lg lg:text-[11px]">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                          {e.tieBreakReason && <TieBreakBadge reason={e.tieBreakReason} />}
                        </div>
                        <div className="lg:col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                        <div className="lg:col-span-3 min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {e.isHOF && <Award className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            {e.name}
                            {isMe && <span className="text-[9px] lg:text-[11px] bg-pink-500 text-black px-1 rounded font-bold">YOU</span>}
                            
                          </div>
                          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500">{e.userTag}</div>
                        </div>
                        <div className="lg:col-span-2">
                          {e.clanTag ? <span className="text-[10px] lg:text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 lg:px-1 lg:py-0 rounded">[{e.clanTag}]</span> : <span className="text-slate-700 text-[10px] lg:text-[11px]">&mdash;</span>}
                        </div>
                        <div className="lg:col-span-2 text-xs lg:text-[11px] text-slate-300 flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(e.country)}</span> {countryName(e.country)}
                        </div>
                        <div className="lg:col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{e.bankedChips.toLocaleString()}c</div>
                        <div className="lg:col-span-1 text-right">
                          {e.championshipPrize && <span title={e.championshipPrize.label} className="text-[8px] lg:text-[11px] font-mono font-bold px-1 py-0.5 rounded" style={{ color: e.championshipPrize.color, backgroundColor: e.championshipPrize.color + '15' }}>{e.championshipPrize.short}</span>}
                        </div>
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
        <div className="space-y-4 lg:space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 lg:gap-1">
            {ALL_MILESTONE_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTierId(t.id)}
                className={`px-2.5 py-1 lg:px-1.5 lg:py-0.5 rounded-full text-xs lg:text-[11px] font-bold transition ${selectedTierId === t.id ? 'border' : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'}`}
                style={selectedTierId === t.id ? { borderColor: t.color, color: t.color, backgroundColor: t.color + '1a' } : undefined}
                title={t.name}
              >
                {t.badge}
              </button>
            ))}
          </div>

          <TabToolbar
            countLabel={tiersCountLabel}
            tabColor="#eab308"
          />

          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden lg:overflow-visible">
            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Move</div>
              <div className="col-span-3">Player</div>
              <div className="col-span-2">Clan</div>
              <div className="col-span-3">Country</div>
              <div className="col-span-2 text-right">Chips</div>
            </div>
            <ol ref={listRef} className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll lg:max-h-none lg:overflow-visible">
              {loading ? (
                <li className="p-4 lg:p-2 text-center text-slate-500 text-xs lg:text-[11px] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 lg:w-3 lg:h-3 animate-spin text-yellow-400" /> Loading tier data&hellip;
                </li>
              ) : filteredEntries.length === 0 ? <EmptyState message="No players in this tier yet" /> : (
                filteredEntries.map((e) => {
                  const isMe = e.userTag === player.userTag;
                  return (
                    <li
                      key={e.userTag + e.rank}
                      data-is-me={isMe || undefined}
                      className={`cursor-pointer transition-colors ${isMe ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : 'hover:bg-slate-900/40'}`}
                    >
                      {/* Mobile card layout (hidden on desktop) */}
                      <div className="lg:hidden px-3 py-2" onClick={() => setExpandedRow(expandedRow === e.userTag ? null : e.userTag)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {RANK_MEDALS[e.rank] ? <span className="text-base shrink-0">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold shrink-0">#{e.rank}</span>}
                            {e.rank === 1 && selectedTierId !== 'all' && selectedTierId !== 'rookie' && <span className="text-[11px] text-yellow-400 font-bold shrink-0">{'\u{1F451}'} FIRST</span>}
                            {e.isHOF && <Award className="w-3 h-3 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            <span className="font-bold text-white min-w-0">{e.name}</span>
                            {isMe && <span className="text-[11px] bg-yellow-500 text-black px-1 rounded font-bold shrink-0">YOU</span>}
                            
                          </div>
                          <div className="font-mono font-bold text-emerald-400 shrink-0 ml-2">{e.bankedChips.toLocaleString()}c</div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono">{e.userTag}</span>
                          {e.clanTag && <span className="font-mono text-cyan-400">[{e.clanTag}]</span>}
                          <span className="flex items-center gap-1"><span aria-hidden>{countryFlag(e.country)}</span>{countryName(e.country)}</span>
                        </div>
                        {expandedRow === e.userTag && (
                          <div className="mt-1 pt-1 border-t border-slate-800 text-[11px]">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1"><span aria-hidden>{countryFlag(e.country)}</span>{countryName(e.country)}</span>
                              {e.clanTag && <span className="font-mono text-cyan-400">[{e.clanTag}]</span>}
                              <span>Level: <span className="font-bold text-white">{e.level}</span></span>
                            </div>
                            <button type="button" onClick={() => inspectPlayer(e)} title="View profile" className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-600/15 border border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white transition">
                              <Eye className="w-2.5 h-2.5" /> View Profile
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Desktop grid layout (hidden on mobile) */}
                      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-0.5 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px]" onClick={() => inspectPlayer(e)}>
                        <div className="lg:col-span-1 flex items-center gap-1.5 font-mono">
                          {RANK_MEDALS[e.rank] ? <span className="text-lg lg:text-[11px]">{RANK_MEDALS[e.rank]}</span> : <span className="text-slate-400 font-bold">#{e.rank}</span>}
                          {e.rank === 1 && selectedTierId !== 'all' && selectedTierId !== 'rookie' && <span className="text-[9px] lg:text-[11px] text-yellow-400 font-bold ml-1">{'\u{1F451}'} FIRST</span>}
                          {e.tieBreakReason && <TieBreakBadge reason={e.tieBreakReason} />}
                        </div>
                        <div className="lg:col-span-1"><RankChangeIndicator change={e.rankChange || 0} /></div>
                        <div className="lg:col-span-3 min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {e.isHOF && <Award className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-yellow-400 shrink-0" aria-label="Hall of Fame inductee" />}
                            {e.name}
                            {isMe && <span className="text-[9px] lg:text-[11px] bg-yellow-500 text-black px-1 rounded font-bold">YOU</span>}
                            
                          </div>
                          <div className="text-[10px] lg:text-[11px] font-mono text-slate-500">{e.userTag}</div>
                        </div>
                        <div className="lg:col-span-2">
                          {e.clanTag ? <span className="text-[10px] lg:text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 lg:px-1 lg:py-0 rounded">[{e.clanTag}]</span> : <span className="text-slate-700 text-[10px] lg:text-[11px]">&mdash;</span>}
                        </div>
                        <div className="lg:col-span-3 text-xs lg:text-[11px] text-slate-300 flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(e.country)}</span> {countryName(e.country)}
                        </div>
                        <div className="lg:col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{e.bankedChips.toLocaleString()}c</div>
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
