'use client';

import { useState, type RefObject } from 'react';
import {
  CHAMPIONSHIP_PRIZE_TIERS,
  COUNTRIES,
  countryFlag,
  type ChampionshipPrize,
} from '@/lib/game-config';
import { MicroLabel } from '../_panel-primitives';
import {
  Globe,
  MapPin,
  Flag,
  Users,
  Search,
  Crosshair,
  X,
  History,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';

// ── Types ──

export type Scope = 'GLOBAL' | 'REGIONAL' | 'NATIONAL' | 'CLAN';
export type RankFilter = 'all' | 'rank1' | 'rank2_10' | 'rank11_50' | 'rank51_100';

export interface ApiEntry {
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
  isPlayer: boolean;
  prize: { chipsReward: number; crownTitle: string } | null;
  efficiency: number;
  flag: string;
}

export interface ClanEntry {
  rank: number;
  tag: string;
  totalChips: number;
  count: number;
  topChips: number;
  topName: string;
  topCountry: string;
  avgChips: number;
}

export interface ArchiveEntry {
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

// ── Helpers ──

export function fmtINR(n: number) { return n.toLocaleString('en-IN'); }

export function prizeForRank(rank: number): ChampionshipPrize | null {
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

// Heading suffix for Regional/National scopes — display names, not raw codes
function scopeHeadingSuffix(scope: Scope, region: string, country: string): string {
  if (scope === 'REGIONAL' && region !== 'ALL') {
    const r = REGIONS.find((x) => x.code === region);
    const name = (r?.name ?? region).replace(/\s*\([A-Z_]+\)$/, '');
    return ` · ${name}`;
  }
  if (scope === 'NATIONAL' && country !== 'ALL') {
    const c = COUNTRIES.find((x) => x.code === country);
    return ` · ${c ? c.name : country}`;
  }
  return '';
}

// ── Constants ──

export const REGIONS = [
  { code: 'ALL', name: 'All Regions', flag: '🌐' },
  { code: 'APAC', name: 'Asia-Pacific (APAC)', flag: '🌏' },
  { code: 'SA', name: 'South Asia (SA)', flag: '🇮🇳' },
  { code: 'MEA', name: 'Middle East & Africa (MEA)', flag: '🌍' },
  { code: 'NA', name: 'North America (NA)', flag: '🌎' },
  { code: 'SA_AM', name: 'South America (SA_AM)', flag: '🌎' },
  { code: 'EU', name: 'Europe (EU)', flag: '🌍' },
  { code: 'CIS', name: 'CIS & Central Asia (CIS)', flag: '🌏' },
  { code: 'OC', name: 'Oceania (OC)', flag: '🏝️' },
];

export const COUNTRY_OPTIONS = [
  { code: 'ALL', name: 'All Countries', flag: '🌐' },
  ...COUNTRIES.map((c) => ({ code: c.code, name: c.name, flag: c.flag })),
];

// ── ScopeTab utility ──

interface ScopeTabProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Globe;
  label: string;
}

export function ScopeTab({ active, onClick, icon: Icon, label }: ScopeTabProps) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-1.5 lg:px-2 lg:py-1 rounded-lg text-xs lg:text-[11px] font-bold flex items-center gap-1.5 transition border ${active ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}>
      <Icon className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> {label}
    </button>
  );
}

// ── Top 3 Podium ──

export function ChampionshipPodium({ entries }: { entries: ApiEntry[] }) {
  const top3 = entries.slice(0, 3);
  if (top3.length < 3) return null;
  const order = [top3[1], top3[0], top3[2]];
  const styles = [
    { medal: '🥈', place: '2ND', border: 'border-slate-300/30', bg: 'from-slate-200/5 to-slate-900', accent: 'text-slate-200', glow: 'bg-slate-300/5' },
    { medal: '🥇', place: '1ST', border: 'border-amber-400/50', bg: 'from-amber-950/30 to-slate-900', accent: 'text-amber-300', glow: 'bg-amber-400/8' },
    { medal: '🥉', place: '3RD', border: 'border-orange-600/30', bg: 'from-orange-950/15 to-slate-900', accent: 'text-orange-300', glow: 'bg-orange-500/5' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-1 mb-5 lg:mb-2">
      {order.map((c, i) => (
        <div key={c.userTag} className={`relative rounded-2xl border ${styles[i].border} bg-gradient-to-b ${styles[i].bg} p-3 sm:p-4 lg:p-1.5 ${i === 1 ? 'sm:-mt-2 sm:pb-6' : ''} overflow-hidden transition hover:brightness-110`}>
          <div className={`absolute top-0 right-0 w-24 h-24 lg:w-12 lg:h-12 ${styles[i].glow} rounded-full blur-2xl pointer-events-none`} aria-hidden />
          <div className="relative text-center">
            <div className="text-3xl sm:text-4xl mb-1 lg:text-lg lg:mb-0">{styles[i].medal}</div>
            <div className={`text-[11px] font-mono font-bold ${styles[i].accent} uppercase tracking-widest`}>{styles[i].place} PLACE</div>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <div className="text-xs sm:text-sm font-bold text-white lg:text-[11px] lg:truncate">{c.flag} {c.name}</div>
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">{c.userTag}{c.clanTag ? ` · [${c.clanTag}]` : ''}</div>
            <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-2 lg:text-[11px]">{fmtINR(c.bankedChips)}c</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{c.gamesPlayed.toLocaleString()} games · {c.efficiency > 0 ? fmtINR(c.efficiency) : '—'} c/game</div>
            <div className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-mono text-yellow-300/80 bg-yellow-500/10 px-1.5 py-0.5 rounded-full border border-yellow-500/20">
              <Award className="w-2.5 h-2.5 lg:w-3 lg:h-3" /> HOF ELIGIBLE
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Past Championships Archives (P3-4) ──

export function PastChampionships({ archives }: { archives: ArchiveEntry[] }) {
  const [open, setOpen] = useState(false);
  if (!archives.length) return null;
  return (
    <div className="mb-6 lg:mb-1 rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 lg:p-1.5 hover:bg-slate-900/40 transition">
        <span className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 lg:w-3 lg:h-3 text-slate-400" /> Past Championship Archives
        </span>
        <span className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
          {archives.length} completed{open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 lg:px-1.5 lg:pb-1.5 space-y-3 border-t border-slate-900">
          {archives.map((a) => (
            <div key={a.year} className="flex flex-wrap items-center gap-3 lg:gap-1 p-3 lg:p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/50">
              <div className="text-lg lg:text-[11px] font-black font-mono text-slate-400 w-14 lg:w-10">{a.year}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs lg:text-[11px] font-bold text-white lg:truncate">{a.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {a.totalParticipants.toLocaleString()} participants
                  {a.payoutsProcessed && <span className="text-emerald-400"> · Payouts Complete</span>}
                  {a.finalizedAt && <span> · Finalized {new Date(a.finalizedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              {a.winnerName && (
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Winner</div>
                  <div className="text-xs lg:text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    🥇 {countryFlag(a.winnerCountry ?? '')} {a.winnerName}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400">{a.winnerChips ? fmtINR(a.winnerChips) : '—'}c</div>
                </div>
              )}
              {a.topClanName && (
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono text-slate-500 uppercase">Top Clan</div>
                  <div className="text-xs lg:text-[11px] font-bold text-slate-200">{a.topClanName}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Clan Rankings Table (P3-3) ──

export function ClanRankingsTable({ clans, hasRealData, isAdmin }: { clans: ClanEntry[]; hasRealData: boolean; isAdmin: boolean }) {
  const [expandedClan, setExpandedClan] = useState<string | null>(null);
  if (!hasRealData && !isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 p-6 lg:p-3 text-center">
        <Users className="w-8 h-8 lg:w-5 lg:h-5 text-slate-600 mx-auto mb-2 lg:mb-1" />
        <p className="text-xs lg:text-[11px] text-slate-500">No clan data available yet. Clans appear here once members register for the championship.</p>
      </div>
    );
  }
  if (clans.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 p-6 lg:p-3 text-center">
        <Users className="w-8 h-8 lg:w-5 lg:h-5 text-slate-600 mx-auto mb-2 lg:mb-1" />
        <p className="text-xs lg:text-[11px] text-slate-500">No clan data available yet. Clans appear here once members register for the championship.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
      <div className="overflow-x-auto lg:overflow-visible">
        <div className="min-w-[500px] lg:min-w-0">
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <div className="lg:col-span-1">Rank</div>
            <div className="lg:col-span-2">Clan</div>
            <div className="lg:col-span-2 text-right">Members</div>
            <div className="lg:col-span-3 text-right">Total Chips</div>
            <div className="lg:col-span-2 text-right">Avg Chips</div>
            <div className="lg:col-span-2 text-right">Top Member</div>
          </div>
          <ol className="divide-y divide-slate-900 max-h-[60vh] overflow-y-auto va-scroll lg:max-h-none lg:overflow-visible">
            {clans.map((c) => (
              <li key={c.tag}>
                <div className="lg:contents">
                  {/* Mobile: compact card */}
                  <div className="lg:hidden p-2 rounded-lg mb-1 bg-slate-900/60 border border-slate-800/50">
                    <button type="button" onClick={() => setExpandedClan(expandedClan === c.tag ? null : c.tag)} className="w-full flex items-center gap-2 text-left">
                      <span className="font-mono text-slate-400 font-bold w-8 shrink-0">
                        {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : <span>#{c.rank}</span>}
                      </span>
                      <span className="font-bold text-white flex-1">[{c.tag}]</span>
                      <span className="font-mono font-bold text-emerald-400 tabular-nums shrink-0">{fmtINR(c.totalChips)}c</span>
                      <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${expandedClan === c.tag ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedClan === c.tag && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-800/50 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span>Members: <span className="font-mono text-slate-300">{c.count}</span></span>
                          <span>Avg: <span className="font-mono text-cyan-400">{fmtINR(c.avgChips)}c</span></span>
                        </div>
                        <div>
                          Top: {countryFlag(c.topCountry)} {c.topName} · <span className="font-mono text-emerald-400">{fmtINR(c.topChips)}c</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Desktop: grid columns */}
                  <div className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px] hover:bg-slate-900/40 transition">
                    <div className="lg:col-span-1 font-mono text-slate-400 font-bold">
                      {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : <span>#{c.rank}</span>}
                    </div>
                    <div className="lg:col-span-2">
                      <div className="font-bold text-white lg:truncate">[{c.tag}]</div>
                    </div>
                    <div className="lg:col-span-2 text-right font-mono text-slate-400 tabular-nums">{c.count}</div>
                    <div className="lg:col-span-3 text-right font-mono font-bold text-emerald-400 tabular-nums">{fmtINR(c.totalChips)}c</div>
                    <div className="lg:col-span-2 text-right font-mono text-cyan-400/70 tabular-nums">{fmtINR(c.avgChips)}c</div>
                    <div className="lg:col-span-2 text-right lg:min-w-0">
                      <div className="text-white lg:truncate">{countryFlag(c.topCountry)} {c.topName}</div>
                      <div className="font-mono text-slate-500">{fmtINR(c.topChips)}c</div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ── Standings Table Component ──

interface StandingsTableProps {
  scope: Scope;
  region: string;
  country: string;
  rankFilter: RankFilter;
  search: string;
  onScopeChange: (s: Scope) => void;
  onRegionChange: (r: string) => void;
  onCountryChange: (c: string) => void;
  onRankFilterChange: (f: RankFilter) => void;
  onSearchChange: (s: string) => void;
  entries: ApiEntry[];
  clanEntries: ClanEntry[];
  hasRealData: boolean;
  isAdmin: boolean;
  loading: boolean;
  findMeHighlight: boolean;
  findMeResult: ApiEntry | null;
  listRef: RefObject<HTMLOListElement | null>;
  onFindMe: () => void;
  onClearFindMeResult: () => void;
}

export function StandingsTable({
  scope, region, country, rankFilter, search,
  onScopeChange, onRegionChange, onCountryChange, onRankFilterChange, onSearchChange,
  entries, clanEntries, hasRealData, isAdmin, loading,
  findMeHighlight, findMeResult, listRef, onFindMe, onClearFindMeResult,
}: StandingsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const filteredEntries = entries;
  const top3 = scope === 'CLAN' ? [] : filteredEntries.slice(0, 3);

  return (
    <>
      {/* ═══ TOOLBAR: Scope Tabs + Find Me + Search ═══ */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-4 lg:mb-1">
        <ScopeTab active={scope === 'GLOBAL'} onClick={() => onScopeChange('GLOBAL')} icon={Globe} label="GLOBAL" />
        <ScopeTab active={scope === 'REGIONAL'} onClick={() => onScopeChange('REGIONAL')} icon={MapPin} label="REGIONAL" />
        <ScopeTab active={scope === 'NATIONAL'} onClick={() => onScopeChange('NATIONAL')} icon={Flag} label="NATIONAL" />
        {/* P3-3: Clan tab */}
        <ScopeTab active={scope === 'CLAN'} onClick={() => onScopeChange('CLAN')} icon={Users} label="CLAN" />
        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search player/tag/clan" title="Search by player name, VM tag, or clan tag" className="bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-7 py-1.5 text-[11px] text-white font-mono w-28 sm:w-40 focus:outline-none focus:border-amber-500/50 placeholder:text-slate-600" />
            {search && <button type="button" onClick={() => onSearchChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Clear search"><X className="w-3 h-3" /></button>}
          </div>
          {scope !== 'CLAN' && (
            <button type="button" onClick={onFindMe} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition border border-amber-500/30 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"><Crosshair className="w-3 h-3" /> Find Me</button>
          )}
        </div>
      </div>

      {/* Filters row */}
      {scope !== 'CLAN' && (
        <div className="flex flex-wrap items-center gap-2 lg:gap-1 mb-4 lg:mb-1">
          {scope === 'REGIONAL' && (
            <select value={region} onChange={(e) => onRegionChange(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 lg:px-2 lg:py-1 text-xs lg:text-[11px] text-white font-mono focus:outline-none focus:border-amber-500/50">
              {REGIONS.map((r) => (<option key={r.code} value={r.code}>{r.flag} {r.name}</option>))}
            </select>
          )}
          {scope === 'NATIONAL' && (
            <select value={country} onChange={(e) => onCountryChange(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 lg:px-2 lg:py-1 text-xs lg:text-[11px] text-white font-mono focus:outline-none focus:border-amber-500/50">
              {COUNTRY_OPTIONS.map((c) => (<option key={c.code} value={c.code}>{c.flag} {c.name}</option>))}
            </select>
          )}
          <span className="text-[11px] font-mono text-slate-500 sm:ml-auto">Rank:</span>
          {(
            [{ id: 'all' as RankFilter, label: 'All' }, { id: 'rank1' as RankFilter, label: '👑 #1' }, { id: 'rank2_10' as RankFilter, label: '🥈 2–10' }, { id: 'rank11_50' as RankFilter, label: '🥉 11–50' }, { id: 'rank51_100' as RankFilter, label: '🛡️ 51–100' }]
          ).map((f) => (
            <button key={f.id} type="button" onClick={() => onRankFilterChange(f.id)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition border ${rankFilter === f.id ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}>{f.label}</button>
          ))}
        </div>
      )}

      {/* Find Me Result Card */}
      {findMeResult && (
        <div className="mb-4 lg:mb-1 p-4 lg:p-1.5 rounded-xl border border-amber-500/30 bg-amber-950/15">
          <div className="flex items-center justify-between mb-2 lg:mb-0.5">
            <span className="text-xs lg:text-[11px] font-bold text-amber-300 flex items-center gap-1.5"><Crosshair className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> Your Global Position</span>
            <button type="button" onClick={onClearFindMeResult} className="text-slate-500 hover:text-white transition" aria-label="Close"><X className="w-3.5 h-3.5 lg:w-3 lg:h-3" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-1">
            <div><MicroLabel className="text-[11px]">GLOBAL RANK</MicroLabel><div className="text-sm lg:text-[11px] font-bold text-white font-mono">#{findMeResult.rank}</div></div>
            <div><MicroLabel className="text-[11px]">WALLET CHIPS</MicroLabel><div className="text-sm lg:text-[11px] font-bold text-emerald-400 font-mono">{fmtINR(findMeResult.bankedChips)}c</div></div>
            <div><MicroLabel className="text-[11px]">PROJECTED PRIZE</MicroLabel><div className={`text-xs lg:text-[11px] font-bold mt-0.5 ${prizeColorForRank(findMeResult.rank)}`}>{findMeResult.prize ? `+${fmtINR(findMeResult.prize.chipsReward)}c` : '— Outside Top 100'}</div></div>
            <div><MicroLabel className="text-[11px]">GAMES PLAYED</MicroLabel><div className="text-sm lg:text-[11px] font-bold text-slate-300 font-mono">{findMeResult.gamesPlayed.toLocaleString()}</div></div>
          </div>
        </div>
      )}

      {/* Top 3 Podium (Global, no filters, no search) */}
      {scope === 'GLOBAL' && rankFilter === 'all' && !search.trim() && top3.length >= 3 && <ChampionshipPodium entries={top3} />}

      {/* ═══ STANDINGS ═══ */}
      {scope === 'CLAN' ? (
        /* P3-3: Clan Rankings View */
        <div>
          <div className="flex items-center justify-between mb-3 lg:mb-0.5 flex-wrap gap-2">
            <h3 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 lg:w-3 lg:h-3 text-cyan-400" /> Clan Championship Rankings</h3>
            <span className="text-[11px] font-mono text-slate-500">{clanEntries.length} clan{clanEntries.length !== 1 ? 's' : ''}</span>
          </div>
          <ClanRankingsTable clans={clanEntries} hasRealData={hasRealData} isAdmin={isAdmin} />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3 lg:mb-0.5 flex-wrap gap-2">
            <h3 className="text-sm lg:text-[11px] font-bold text-white">
              2026 Championship Standings{scopeHeadingSuffix(scope, region, country)}
            </h3>
            <span className="text-[11px] font-mono text-slate-500">{filteredEntries.length} contender{filteredEntries.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="overflow-x-auto lg:overflow-visible">
              <div className="min-w-[680px] lg:min-w-0">
                {/* Header */}
                <div className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="lg:col-span-1">Rank</div>
                  <div className="lg:col-span-3">Contender</div>
                  <div className="lg:col-span-2">Tag</div>
                  <div className="lg:col-span-1 text-right">Games</div>
                  <div className="lg:col-span-1 text-right">c/game</div>
                  <div className="lg:col-span-2 text-right">Wallet Chips</div>
                  <div className="lg:col-span-2 text-right">Projected Prize</div>
                </div>
                {/* Body */}
                <ol ref={listRef} className="divide-y divide-slate-900 max-h-[60vh] overflow-y-auto va-scroll lg:max-h-none lg:overflow-visible">
                  {loading ? (
                    <li className="p-8 lg:p-3 text-center text-xs lg:text-[11px] text-slate-500 animate-pulse">Loading standings...</li>
                  ) : filteredEntries.length === 0 ? (
                    <li className="p-6 lg:p-3 text-center text-xs lg:text-[11px] text-slate-500">{!hasRealData ? 'No championship contenders yet. Register and play to appear in the standings!' : 'No contenders match the current filters.'}</li>
                  ) : filteredEntries.map((c) => {
                    const isMe = c.isPlayer;
                    const prize = c.prize ?? prizeForRank(c.rank);
                    return (
                      <li key={c.userTag + c.rank} data-champ-me={isMe ? 'true' : undefined} className={`${isMe && findMeHighlight ? 'bg-amber-500/20 ring-1 ring-inset ring-amber-400/40' : isMe ? 'bg-amber-500/10' : ''}`}>
                        <div className="lg:contents">
                          {/* Mobile: compact card */}
                          <div className="lg:hidden p-2 rounded-lg mb-1 bg-slate-900/60 border border-slate-800/50">
                            <button type="button" onClick={() => setExpandedRow(expandedRow === c.userTag ? null : c.userTag)} className="w-full flex items-center gap-2 text-left">
                              <span className="font-mono text-slate-400 font-bold w-8 shrink-0">
                                {c.rank === 1 ? <span className="text-[11px]">🥇</span> : c.rank === 2 ? <span className="text-[11px]">🥈</span> : c.rank === 3 ? <span className="text-[11px]">🥉</span> : <span>#{c.rank}</span>}
                              </span>
                              <span className="font-bold text-white flex items-center gap-1 flex-1 min-w-0">
                                <span className="shrink-0">{c.flag}</span>
                                <span>{c.name}</span>
                                {isMe && <span className="text-[11px] bg-amber-500 text-black px-1 rounded font-bold ml-0.5">YOU</span>}
                              </span>
                              <span className="font-mono font-bold text-emerald-400 tabular-nums shrink-0">{fmtINR(c.bankedChips)}c</span>
                              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${expandedRow === c.userTag ? 'rotate-180' : ''}`} />
                            </button>
                            {expandedRow === c.userTag && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-800/50 space-y-1 text-[11px]">
                                <div className="flex justify-between">
                                  <span className="font-mono text-slate-500">{c.userTag}{c.clanTag ? ` · [${c.clanTag}]` : ''}</span>
                                  <span className="font-mono text-slate-500">{c.region}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Games: <span className="font-mono text-slate-300">{c.gamesPlayed.toLocaleString()}</span></span>
                                  <span>c/game: <span className="font-mono text-cyan-400">{c.efficiency > 0 ? fmtINR(c.efficiency) : '—'}</span></span>
                                </div>
                                <div>
                                  {prize ? (
                                    <span className={`font-mono font-bold ${prizeColorForRank(c.rank)}`}>+{fmtINR(prize.chipsReward)}c · {prize.crownTitle}</span>
                                  ) : <span className="font-mono text-slate-500">— Outside Top 100</span>}
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Desktop: grid columns */}
                          <div className={`hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px] transition-all duration-500 ${isMe && findMeHighlight ? 'border-l-2 border-amber-400' : isMe ? 'border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}>
                            {/* Rank */}
                            <div className="lg:col-span-1 font-mono flex items-center gap-0.5">
                              {c.rank === 1 ? <span className="text-[11px]">🥇</span> : c.rank === 2 ? <span className="text-[11px]">🥈</span> : c.rank === 3 ? <span className="text-[11px]">🥉</span> : <span className="text-slate-400 font-bold">#{c.rank}</span>}
                              {isMe && <span className="text-[11px] bg-amber-500 text-black px-1 rounded font-bold ml-0.5">YOU</span>}
                            </div>
                            {/* Name */}
                            <div className="lg:col-span-3 lg:min-w-0">
                              <div className="font-bold text-white lg:truncate flex items-center gap-1.5">
                                <span aria-hidden className="shrink-0">{c.flag}</span>
                                <span className="lg:truncate">{c.name}</span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 lg:truncate">{c.clanTag ? `[${c.clanTag}] · ` : ''}{c.region}</div>
                            </div>
                            {/* Tag */}
                            <div className="lg:col-span-2 font-mono text-slate-500 lg:truncate">{c.userTag}</div>
                            {/* Games */}
                            <div className="lg:col-span-1 text-right font-mono text-slate-400 tabular-nums">{c.gamesPlayed.toLocaleString()}</div>
                            {/* Efficiency */}
                            <div className="lg:col-span-1 text-right font-mono text-cyan-400/60 tabular-nums">{c.efficiency > 0 ? fmtINR(c.efficiency) : '—'}</div>
                            {/* Wallet Chips */}
                            <div className="lg:col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">{fmtINR(c.bankedChips)}c</div>
                            {/* Dynamic prize */}
                            <div className="lg:col-span-2 text-right">
                              {prize ? (
                                <div className="leading-tight">
                                  <div className={`font-mono font-bold ${prizeColorForRank(c.rank)}`}>+{fmtINR(prize.chipsReward)}c</div>
                                  <div className="font-mono text-slate-500 lg:truncate">{prize.crownTitle}</div>
                                </div>
                              ) : <span className="font-mono text-slate-600">— Outside Top 100</span>}
                            </div>
                          </div>
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
    </>
  );
}
