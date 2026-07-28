'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CHAMPIONSHIP_PRIZE_TIERS,
  INITIAL_CONTENDERS,
  COUNTRIES,
  countryFlag,
  countryName,
  type ChampionshipContender,
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
  Timer,
  Trophy,
  Gift,
  Globe,
  MapPin,
  Flag,
  Play,
  Award,
  Swords,
} from 'lucide-react';

interface ChampionshipsProps {
  onToast?: ToastFn;
}

type Scope = 'GLOBAL' | 'REGIONAL' | 'NATIONAL';
type RankFilter = 'all' | 'rank1' | 'rank2_10' | 'rank11_50' | 'rank51_100';

const REGIONS = [
  { code: 'ALL', name: 'All Regions', flag: '🌐' },
  { code: 'APAC', name: 'Asia-Pacific (APAC)', flag: '🌏' },
  { code: 'NA', name: 'North America (NA)', flag: '🌎' },
  { code: 'EU', name: 'Europe (EU)', flag: '🌍' },
  { code: 'LATAM', name: 'Latin America (LATAM)', flag: '💃' },
];

const COUNTRIES_FILTER = [
  { code: 'ALL', name: 'All Countries', flag: '🌐' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
];

const MAX_GAMES = 10000;
const DEFAULT_GAMES_PLAYED = 34;
const CHAMPIONSHIP_END_DATE = new Date('2027-01-01T00:00:00Z');

function fmtINR(n: number) {
  return n.toLocaleString('en-IN');
}

function rankCategoryOf(rank: number): Exclude<RankFilter, 'all'> {
  if (rank === 1) return 'rank1';
  if (rank <= 10) return 'rank2_10';
  if (rank <= 50) return 'rank11_50';
  return 'rank51_100';
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

export function Championships({ onToast }: ChampionshipsProps) {
  const { player, refresh } = useAuth();
  const [registered, setRegistered] = useState(false);
  const [gamesPlayed, setGamesPlayed] = useState(DEFAULT_GAMES_PLAYED);
  const [scope, setScope] = useState<Scope>('GLOBAL');
  const [region, setRegion] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [rankFilter, setRankFilter] = useState<RankFilter>('all');
  const cd = useCountdown(CHAMPIONSHIP_END_DATE);

  const contenders = useMemo<ChampionshipContender[]>(() => {
    const list = [...INITIAL_CONTENDERS];
    // Auto-inject the player at rank 142 if registered
    if (registered && player) {
      const exists = list.find((c) => c.userTag === `#${player.userTag}`);
      if (!exists) {
        list.push({
          rank: 142,
          name: player.name,
          userTag: `#${player.userTag}`,
          gamesPlayed,
          walletChips: player.bankedChips,
          clanTag: player.clanTag || 'VPR',
          country: player.country,
          region: ['IN', 'JP', 'KR', 'SG'].includes(player.country) ? 'APAC' : player.country === 'US' || player.country === 'CA' ? 'NA' : 'EU',
          projectedPrize: 'Hall of Fame Qualifying Contender',
        });
      }
    }
    return list.sort((a, b) => b.walletChips - a.walletChips).map((c, i) => ({ ...c, rank: i + 1 }));
  }, [registered, player, gamesPlayed]);

  const filteredContenders = useMemo(() => {
    return contenders.filter((c) => {
      if (scope === 'REGIONAL' && region !== 'ALL' && c.region !== region) return false;
      if (scope === 'NATIONAL' && country !== 'ALL' && c.country !== country) return false;
      if (rankFilter !== 'all' && rankCategoryOf(c.rank) !== rankFilter) return false;
      return true;
    });
  }, [contenders, scope, region, country, rankFilter]);

  if (!player) return <NotSignedIn />;

  const remaining = MAX_GAMES - gamesPlayed;

  function handleRegister() {
    setRegistered(true);
    notify('🏆 REGISTERED FOR 2026 ANNUAL VENOM WORLD CHAMPIONSHIP! You have 10,000 matches limit. Good luck!', 'success', onToast);
  }

  function handlePlayMatch() {
    if (!registered) {
      notify('Register first to play championship matches!', 'error', onToast);
      return;
    }
    if (remaining <= 0) {
      notify('You have reached the 10,000 championship match cap for this year!', 'error', onToast);
      return;
    }
    setGamesPlayed((g) => g + 1);
    notify('Entering Championship High-Stakes Arena match...', 'info', onToast);
    void refresh();
  }

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-amber-500/10" className="-top-12 -right-12 w-64 h-64" />

      {/* HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-indigo-950/40 p-5 sm:p-7 border border-amber-500/30 shadow-md mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden />
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-widest">
            OFFICIAL 1-YEAR TOURNAMENT
          </span>
          <span className="inline-flex items-center gap-1 bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-[9px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-widest">
            <Sparkles className="w-3 h-3" /> JAN 1 HALL OF FAME PAYOUT
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          2026 ANNUAL VENOM WORLD CHAMPIONSHIP
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
          Join anytime during the year! Play up to 10,000 Games. When the year ends,
          players with the Maximum Wallet Chips across Global, Regional, and Country
          leaderboards will be awarded massive chip prizes and permanently inducted
          into the Hall of Fame on January 1st!
        </p>

        {/* COUNTDOWN */}
        <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-amber-500/30">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300">
              <Timer className="w-4 h-4" /> YEAR-END FINALE &amp; JAN 1 PAYOUT IN:
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Payout Date: Midnight UTC, 01 January 2027
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { v: cd.days, l: 'Days' },
              { v: cd.hours, l: 'Hours' },
              { v: cd.minutes, l: 'Mins' },
              { v: cd.seconds, l: 'Secs' },
            ].map((t) => (
              <div key={t.l} className="text-center bg-slate-900 border border-slate-800 rounded-lg py-2.5">
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tabular-nums">
                  {pad2(t.v)}
                </div>
                <div className="text-[9px] font-mono uppercase text-slate-500 mt-0.5">{t.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PLAYER DOSSIER */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5 mb-6 shadow-md">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
            <Swords className="w-4 h-4 text-indigo-400" /> Matches Limit Progress:
          </span>
          <span className="text-xs font-mono text-slate-300">
            {gamesPlayed.toLocaleString()} / 10,000 Played
          </span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mb-3">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-amber-500 rounded-full"
            style={{ width: `${Math.min(100, (gamesPlayed / MAX_GAMES) * 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mb-4">
          {remaining.toLocaleString()} Championship matches remaining this year
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <MicroLabel>COMPETING WALLET CHIPS</MicroLabel>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {fmtINR(player.bankedChips)} Chips
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Max chips at year-end decides rank!</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <MicroLabel>STATUS</MicroLabel>
            <div className="text-sm font-bold text-white mt-1">
              {registered ? '✅ Registered & Active in 2026 Championship' : 'Free Entry | Join Anytime'}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center gap-2">
            {!registered ? (
              <button
                type="button"
                onClick={handleRegister}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5"
              >
                <Trophy className="w-4 h-4" /> JOIN 2026 CHAMPIONSHIP NOW
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlayMatch}
                className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> PLAY CHAMPIONSHIP MATCH
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PRIZE TIERS */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" /> Jan 1st Payout &amp; Hall of Fame Induction Tiers
          </h2>
          <span className="text-[10px] font-mono text-slate-500">Awarded automatically on 01 January</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CHAMPIONSHIP_PRIZE_TIERS.map((tier) => (
            <div key={tier.category} className="relative p-4 rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" aria-hidden />
              <div className="relative">
                <div className="text-[10px] font-mono text-amber-300 mb-1">{tier.badge}</div>
                <h3 className="text-sm font-bold text-white">{tier.title}</h3>
                <div className="mt-2 text-lg font-black font-mono text-emerald-400">
                  +{fmtINR(tier.chipsReward)} CHIPS
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Crown Title: <span className="text-white font-bold">{tier.crownTitle}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> {tier.itemReward}
                </div>
                {tier.hallOfFameInduction && (
                  <div className="text-[11px] text-yellow-300 mt-1 flex items-center gap-1">
                    <Award className="w-3 h-3" /> Permanent Hall of Fame Inscription
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SCOPE TABS */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-4">
        <ScopeTab active={scope === 'GLOBAL'} onClick={() => setScope('GLOBAL')} icon={Globe} label="GLOBAL WORLD CHAMPIONSHIP" />
        <ScopeTab active={scope === 'REGIONAL'} onClick={() => setScope('REGIONAL')} icon={MapPin} label="REGIONAL MASTERS" />
        <ScopeTab active={scope === 'NATIONAL'} onClick={() => setScope('NATIONAL')} icon={Flag} label="NATIONAL COUNTRY CIRCUIT" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {scope === 'REGIONAL' && (
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/50"
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>{r.flag} {r.name}</option>
            ))}
          </select>
        )}
        {scope === 'NATIONAL' && (
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/50"
          >
            {COUNTRIES_FILTER.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
        )}
        <span className="ml-auto text-[10px] font-mono text-slate-500">Rank Filter:</span>
        {([
          { id: 'all', label: 'All Ranks' },
          { id: 'rank1', label: '👑 Rank 1' },
          { id: 'rank2_10', label: '🥈 Ranks 2–10' },
          { id: 'rank11_50', label: '🥉 Ranks 11–50' },
          { id: 'rank51_100', label: '🛡️ Ranks 51–100' },
        ] as const).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setRankFilter(f.id)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition border ${rankFilter === f.id ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* LEADERBOARD TABLE */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">
          2026 Championship Standings ({scope})
        </h3>
        <span className="text-[9px] font-mono text-amber-300 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
          Jan 1 Hall of Fame Payout Eligible
        </span>
      </div>

      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
          <div className="col-span-1">Rank</div>
          <div className="col-span-3">Contender Name</div>
          <div className="col-span-2">User Tag</div>
          <div className="col-span-1 text-right">Games</div>
          <div className="col-span-2 text-right">Wallet Chips</div>
          <div className="col-span-2 text-right">Projected Jan 1 Payout</div>
          <div className="col-span-1 text-right">HOF</div>
        </div>
        <ol className="divide-y divide-slate-900 max-h-[60vh] overflow-y-auto va-scroll">
          {filteredContenders.length === 0 ? (
            <li className="p-6 text-center text-xs text-slate-500">No contenders match the current filters.</li>
          ) : (
            filteredContenders.map((c) => {
              const isMe = c.userTag === `#${player.userTag}`;
              return (
                <li
                  key={c.userTag + c.rank}
                  className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm transition-colors ${isMe ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'hover:bg-slate-900/40'}`}
                >
                  <div className="col-span-1 font-mono">
                    {c.rank === 1 ? (
                      <span className="text-lg">🥇</span>
                    ) : c.rank <= 3 ? (
                      <span className="text-lg">{['', '🥇', '🥈', '🥉'][c.rank]}</span>
                    ) : (
                      <span className="text-slate-400 font-bold">#{c.rank}</span>
                    )}
                    {isMe && <span className="ml-1 text-[9px] bg-amber-500 text-black px-1 rounded font-bold">YOU</span>}
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="font-bold text-white truncate flex items-center gap-1.5">
                      <span aria-hidden>{countryFlag(c.country)}</span> {c.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">[{c.clanTag}] · {c.region}</div>
                  </div>
                  <div className="col-span-2 text-[10px] font-mono text-slate-500 truncate">{c.userTag}</div>
                  <div className="col-span-1 text-right text-xs font-mono text-slate-400 tabular-nums">{c.gamesPlayed.toLocaleString()}</div>
                  <div className="col-span-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                    {fmtINR(c.walletChips)}c
                  </div>
                  <div className="col-span-2 text-right text-[10px] font-mono text-amber-300 leading-tight">
                    {c.projectedPrize}
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-yellow-300 bg-yellow-500/10 px-1.5 py-0.5 rounded-full border border-yellow-500/30">
                      <Award className="w-2.5 h-2.5" /> INDUCTED JAN 1
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ol>
      </div>
    </div>
  );
}

interface ScopeTabProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Globe;
  label: string;
}

function ScopeTab({ active, onClick, icon: Icon, label }: ScopeTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${active ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

export default Championships;
