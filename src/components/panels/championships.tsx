'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  GlowBlob,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Sparkles,
  Timer,
  Activity,
} from 'lucide-react';
import { PlayerStatusCard, type PlayerStatus } from './championships/player-status-card';
import {
  StandingsTable,
  PastChampionships,
  type Scope,
  type RankFilter,
  type ApiEntry,
  type ClanEntry,
  type ArchiveEntry,
} from './championships/standings-table';

// ============================================================================
// Types
// ============================================================================

interface ChampionshipsProps {
  onToast?: ToastFn;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_GAMES = 10000;
const CHAMPIONSHIP_END_DATE = new Date('2027-01-01T00:00:00Z');

// ============================================================================
// Helpers
// ============================================================================

function pad2(n: number) { return String(n).padStart(2, '0'); }

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

  const warning_level = gamesPlayed >= 9900 ? 'critical' : gamesPlayed >= 9500 ? 'danger' : gamesPlayed >= 9000 ? 'warning' : 'safe';
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

  // ── Display entries: use real data or empty ─────────────────────────────
  const displayEntries = useMemo<ApiEntry[]>(() => {
    if (hasRealData) return entries;
    return [];
  }, [hasRealData, entries]);

  // ── Filtered entries ──────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    return displayEntries;
  }, [displayEntries]);

  const top3 = useMemo(() => (scope === 'CLAN' ? [] : filteredEntries.slice(0, 3)), [scope, filteredEntries]);

  // ── Player summary data ──────────────────────────────────────────────────
  const mySummary = useMemo(() => {
    if (!registered || !player) return null;
    if (playerStatus) return playerStatus;
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
        setTimeout(() => { fetchStandings(true); fetchClans(); }, 2000);
      } else {
        const err = await res.json();
        notify(err.error || 'Failed to start match.', 'error', onToast);
      }
    } catch {
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
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 lg:p-2 overflow-hidden">
      <GlowBlob color="bg-amber-500/10" className="-top-12 -right-12 w-64 h-64 lg:w-32 lg:h-32" />

      {/* ═══ HERO BANNER ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-indigo-950/40 p-5 sm:p-7 lg:p-2 border border-amber-500/30 shadow-md mb-6 lg:mb-1">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none lg:w-32 lg:h-32" aria-hidden />
        <div className="flex items-center gap-2 flex-wrap mb-3 lg:mb-0.5">
          <span className="bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-widest">OFFICIAL 1-YEAR TOURNAMENT</span>
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-widest">
            <Activity className="w-3 h-3" /> DB-BACKED REGISTRATION
          </span>
          <span className="inline-flex items-center gap-1 bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-[11px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-widest">
            <Sparkles className="w-3 h-3" /> JAN 1 HALL OF FAME PAYOUT
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight lg:text-sm">2026 ANNUAL VENOM WORLD CHAMPIONSHIP</h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 lg:text-[11px] max-w-3xl leading-relaxed">
          Join anytime during the year! Play up to 10,000 games. When the year ends, players with the maximum wallet chips across Global, Regional, and Country leaderboards will be awarded massive chip prizes and permanently inducted into the Hall of Fame on January 1st!
        </p>
        <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-amber-500/30 lg:mt-1 lg:p-1.5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2 lg:mb-0.5 lg:gap-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-amber-300"><Timer className="w-4 h-4 lg:w-3 lg:h-3" /> YEAR-END FINALE &amp; JAN 1 PAYOUT IN:</span>
            <span className="text-[11px] font-mono text-slate-500">Payout Date: Midnight UTC, 01 January 2027</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:gap-1">
            {[{ v: cd.days, l: 'Days' }, { v: cd.hours, l: 'Hours' }, { v: cd.minutes, l: 'Mins' }, { v: cd.seconds, l: 'Secs' }].map((t) => (
              <div key={t.l} className="text-center bg-slate-900 border border-slate-800 rounded-lg py-2.5 lg:py-1">
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tabular-nums lg:text-sm">{pad2(t.v)}</div>
                <div className="text-[11px] font-mono uppercase text-slate-500 mt-0.5">{t.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ PAST CHAMPIONSHIP ARCHIVES (P3-4) ═══ */}
      <PastChampionships archives={archives} />

      {/* ═══ PLAYER STATUS + PRIZE TIERS ═══ */}
      <PlayerStatusCard
        registered={registered}
        mySummary={mySummary}
        player={player}
        gamesPlayed={gamesPlayed}
        onRegister={handleRegister}
        onPlayMatch={handlePlayMatch}
      />

      {/* ═══ STANDINGS TABLE ═══ */}
      <StandingsTable
        scope={scope}
        region={region}
        country={country}
        rankFilter={rankFilter}
        search={search}
        onScopeChange={handleScopeChange}
        onRegionChange={setRegion}
        onCountryChange={setCountry}
        onRankFilterChange={setRankFilter}
        onSearchChange={setSearch}
        entries={filteredEntries}
        clanEntries={clanEntries}
        hasRealData={hasRealData}
        isAdmin={isAdmin}
        loading={loading}
        findMeHighlight={findMeHighlight}
        findMeResult={findMeResult}
        listRef={listRef}
        onFindMe={handleFindMe}
        onClearFindMeResult={() => setFindMeResult(null)}
      />
    </div>
  );
}

export default Championships;
