'use client';

/**
 * BUILD-11 — `ArenaSelector` panel.
 *
 * Displays 30 online competitive tiers (10c → 1B) grouped by difficulty
 * with filter tabs, plus 3 offline practice arenas.
 *
 * Difficulty groups: Beginner (1-6) · Medium (7-12) · High Stakes (13-18) ·
 *                     Extreme (19-24) · Legendary (25-30)
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Filter,
  Landmark,
  Play,
  Shield,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ARENA_TIERS, PRACTICE_TIERS } from '@/lib/game-config';
import {
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';

import { chipShort, chipFull } from '@/lib/format-chips';
import { resolveOfflineBotTarget } from '@/lib/snake/config';

// ── Difficulty filter groups ──────────────────────────────────────────

const DIFFICULTY_GROUPS: { label: string; difficulty: string | null; accent: string }[] = [
  { label: 'All',       difficulty: null,            accent: 'text-slate-400' },
  { label: 'Beginner',   difficulty: 'Beginner',    accent: 'text-emerald-400' },
  { label: 'Medium',     difficulty: 'Medium',      accent: 'text-amber-400' },
  { label: 'High Stakes', difficulty: 'High Stakes', accent: 'text-rose-400' },
  { label: 'Extreme',    difficulty: 'Extreme' as const,     accent: 'text-red-400' },
  { label: 'Legendary',  difficulty: 'Legendary' as const,  accent: 'text-yellow-400' },
] as const;

interface ArenaSelectorProps {
  onPlay: (arenaId: string, isOnline: boolean) => void;
  onToast?: ToastFn;
}

interface ArenaStats {
  players: number;
  maxPlayers: number;
}

export function ArenaSelector({ onPlay, onToast }: ArenaSelectorProps) {
  const { player, loading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [selectedTierId, setSelectedTierId] = useState<string>('tier-1');
  const [mobileExpandedId, setMobileExpandedId] = useState<string | null>('tier-1');
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>('Beginner');
  const [arenaStats, setArenaStats] = useState<
    Record<string, ArenaStats>
  >({});
  // BOT-SCALE: the offline population is adaptive now (device heuristic or a
  // venom:bot-count override), so the detail card shows the REAL number this
  // device will simulate instead of a hardcoded "1,000 Bots".
  const [offlineBotLabel] = useState(() => {
    try {
      const { count, source } = resolveOfflineBotTarget();
      return `${count.toLocaleString()} Bots${source === 'device' ? ' (auto)' : ''}`;
    } catch { return 'Adaptive'; }
  });

  // Poll live arena stats every 5 seconds while in online mode.
  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/arena-stats');
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, ArenaStats>;
        if (!cancelled) setArenaStats(data);
      } catch {
        /* network errors silently ignored — stats are decorative */
      }
    };

    void fetchStats();
    const interval = setInterval(() => void fetchStats(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOnline]);

  // Filtered tier list for online mode (hook before early returns)
  const filteredOnlineTiers = useMemo(() => {
    if (!difficultyFilter) return ARENA_TIERS;
    return ARENA_TIERS.filter((t) => t.difficulty === difficultyFilter);
  }, [difficultyFilter]);

  // Find highest affordable tier (hook before early returns)
  const highestAffordableTier = useMemo(() => {
    if (!isOnline) return null;
    if (!player) return null;
    for (let i = ARENA_TIERS.length - 1; i >= 0; i--) {
      if (player.bankedChips >= ARENA_TIERS[i].buyIn) return ARENA_TIERS[i];
    }
    return null;
  }, [isOnline, player]);

  if (loading) return <PanelSkeleton count={4} height="h-40" />;
  if (!player) return <NotSignedIn />;

  const tiersList = isOnline ? filteredOnlineTiers : PRACTICE_TIERS;
  const selectedTier =
    tiersList.find((t) => t.id === selectedTierId) || tiersList[0];
  const canAfford = player.bankedChips >= selectedTier.buyIn;
  const canPlay = !isOnline || canAfford;
  // Derive tier index (1-based) for display
  const tierIndex = isOnline
    ? ARENA_TIERS.findIndex((t) => t.id === selectedTier.id) + 1
    : 0;

  function handleModeSwitch(online: boolean) {
    setIsOnline(online);
    if (online) {
      setDifficultyFilter('Beginner');
      setSelectedTierId('tier-1');
      setMobileExpandedId('tier-1');
    } else {
      setSelectedTierId('practice-easy');
      setMobileExpandedId('practice-easy');
    }
  }

  function handleDifficultyFilter(diff: string | null) {
    setDifficultyFilter(diff);
    const target = diff
      ? ARENA_TIERS.find((t) => t.difficulty === diff)
      : ARENA_TIERS[0];
    if (target) {
      setSelectedTierId(target.id);
      setMobileExpandedId(target.id);
    }
  }

  function handleEnterArena() {
    if (isOnline && !canAfford) {
      notify(
        'Insufficient chips to enter this arena! Claim daily rewards or play lower stakes to rebuild.',
        'error',
        onToast,
      );
      return;
    }
    onPlay(selectedTier.id, isOnline);
  }

  return (
    <div
      id="arena-selector"
      className="grid grid-cols-1 lg:grid-cols-12 lg:gap-2 gap-2"
    >
      {/* LEFT: tier list */}
      <div className="lg:col-span-7 flex flex-col lg:gap-1 gap-1.5">
        {/* Header row: title + mode toggle */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h3 className="text-[11px] lg:text-[11px] font-bold font-sans uppercase tracking-wider text-slate-400">
              {isOnline ? 'Online PvP Shards' : 'Practice Arenas'}
            </h3>
            <p className="text-[11px] text-slate-500 font-sans lg:text-[11px] lg:mt-0">
              {isOnline ? '30 tiers · 10c → 1B chips' : 'Choose your difficulty'}
            </p>
          </div>

          {/* Mode Selector */}
          <div className="flex bg-slate-950 p-0.5 lg:p-0.5 rounded-lg border border-slate-800/80">
            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              className={`px-2 py-0.5 lg:px-1.5 lg:py-0.5 rounded-md text-[11px] lg:text-[11px] font-sans font-medium flex items-center gap-1 transition-all ${
                isOnline
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users className="w-3 h-3" /> Online
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch(false)}
              className={`px-2 py-0.5 lg:px-1.5 lg:py-0.5 rounded-md text-[11px] lg:text-[11px] font-sans font-medium flex items-center gap-1 transition-all ${
                !isOnline
                  ? 'bg-amber-600/25 text-amber-300 border border-amber-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Swords className="w-3 h-3" /> Offline
            </button>
          </div>
        </div>

        {/* Difficulty filter tabs (online mode only) */}
        {isOnline && (
          <div className="flex items-center gap-1 lg:gap-1 lg:px-1 px-1 flex-wrap">
            <Filter className="w-3 h-3 text-slate-600 shrink-0" />
            {DIFFICULTY_GROUPS.map((group) => {
              const isActive = difficultyFilter === group.difficulty;
              const count = group.difficulty
                ? ARENA_TIERS.filter((t) => t.difficulty === group.difficulty).length
                : ARENA_TIERS.length;
              return (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => handleDifficultyFilter(group.difficulty)}
                  className={`px-1.5 py-0.5 lg:px-1.5 lg:py-0.5 rounded-md text-[11px] lg:text-[11px] font-sans font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-slate-950 border-slate-800/80 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {group.label}
                  <span className="ml-1 text-slate-600 lg:text-[11px]">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Highest affordable badge (online mode) */}
        {isOnline && highestAffordableTier && (
          <div className="px-1">
            <button
              type="button"
              onClick={() => {
                setDifficultyFilter(null);
                setSelectedTierId(highestAffordableTier.id);
              }}
              className="text-[11px] lg:text-[11px] font-sans text-emerald-400/70 hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-2.5 h-2.5" />
              Jump to highest affordable: {highestAffordableTier.name} ({chipFull(highestAffordableTier.buyIn)})
            </button>
          </div>
        )}

        {/* Tiers list — no max-height needed since filter shows max 6 tiers */}
        <div className="flex flex-col gap-1 lg:gap-0.5 lg:pr-0 pr-0">
          {tiersList.map((tier) => {
            const active = tier.id === selectedTierId;
            const unaffordable =
              isOnline && player.bankedChips < tier.buyIn;
            return (
              <div key={tier.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTierId(tier.id);
                    setMobileExpandedId(prev => prev === tier.id ? null : tier.id);
                  }}
                  className={`relative flex items-center justify-between p-2 lg:w-full lg:grid lg:grid-cols-[auto_1fr_5rem_7rem_auto] lg:items-center lg:p-1.5 rounded-xl border transition-all text-left group ${
                    active
                      ? 'bg-slate-800/50 border-indigo-500 shadow-md shadow-indigo-950/20'
                      : 'bg-slate-900 border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center gap-2 lg:gap-2 min-w-0 lg:contents">
                    {/* Glowing accent dot */}
                    <div
                      aria-hidden="true"
                      className="w-2.5 h-2.5 lg:w-2.5 lg:h-2.5 rounded-full border border-white/20 shadow-lg shrink-0"
                      style={{
                        backgroundColor: tier.accentColor,
                        boxShadow: active
                          ? `0 0 12px ${tier.accentColor}`
                          : 'none',
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] lg:text-[11px] font-bold font-sans text-white group-hover:text-indigo-300 transition-colors">
                          {tier.name}
                        </span>
                        <span
                          className={`text-[11px] lg:text-[11px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-sans border border-transparent ${tier.color}`}
                        >
                          {tier.difficulty}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0 lg:text-[11px] lg:mt-0">
                        {tier.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 lg:gap-1.5 shrink-0 lg:contents">
                    <div className={isOnline ? 'text-right mr-1.5 select-none lg:w-20' : 'lg:w-20'}>
                      {isOnline && (
                        <>
                        <span className="text-[11px] lg:text-[11px] text-slate-500 block uppercase font-mono tracking-wider">
                          Online
                        </span>
                        <span className="text-[11px] lg:text-[11px] font-bold font-mono text-indigo-400 flex items-center justify-end gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                          {arenaStats[tier.id]
                            ? `${arenaStats[tier.id].players} / ${arenaStats[tier.id].maxPlayers.toLocaleString()}`
                            : '— / 1,000'}
                        </span>
                        </>
                      )}
                    </div>
                    <div className="text-right lg:w-28">
                      <span className="text-[11px] lg:text-[11px] text-slate-500 block uppercase font-mono tracking-wider">
                        Buy-In
                      </span>
                      <span
                        className={`text-[11px] lg:text-[11px] font-bold font-mono block ${
                          unaffordable ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {tier.buyIn === 0 ? 'FREE' : `${tier.buyIn.toLocaleString()}c`}
                      </span>
                      {tier.buyIn >= 1_000 && (
                        <span className={`text-[11px] lg:text-[11px] font-mono block mt-0 lg:mt-0 ${unaffordable ? 'text-red-400/50' : 'text-emerald-400/50'}`}>
                          {chipShort(tier.buyIn)}
                        </span>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-3 h-3 lg:w-3 lg:h-3 text-slate-500 transition-transform ${
                        active ? 'translate-x-1 text-indigo-400' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Inline accordion detail — mobile only */}
                {tier.id === mobileExpandedId && (
                  <div
                    className="lg:hidden ml-4 pl-3 border-l-2 border-indigo-500/50 py-2 flex flex-col gap-1.5"
                    style={{ borderLeftColor: tier.accentColor }}
                  >
                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-sans text-slate-400">
                      <span><span className="text-slate-500">Extraction:</span> <span className="font-mono font-semibold text-emerald-400">EXIT ANYTIME</span></span>
                      <span><span className="text-slate-500">Bots:</span> <span className="font-mono font-semibold text-cyan-400">{tier.botsCount.toLocaleString()}</span></span>
                      <span><span className="text-slate-500">XP:</span> <span className="font-mono font-semibold text-indigo-400">x{tier.rewardMultiplier}</span></span>
                    </div>

                    {/* Warning — full text matching desktop */}
                    <div className="text-[11px] text-indigo-300/80 font-sans leading-tight">
                      {isOnline
                        ? <><strong>ONLINE MULTIPLAYER:</strong> High-stakes arena for up to 1,000 players. Collect star chips from defeated opponents and extract safely. Graduated commission: <strong>0% if ≤3 players</strong>, <strong>35% if ≥4 players</strong>.</>
                        : <><strong>OFFLINE PRACTICE MODE:</strong> Risk-free training ground. Test your skills against {tier.botsCount.toLocaleString()} bots without wagering, losing, or earning any of your banked chips!</>
                      }
                    </div>

                    {/* Buy button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEnterArena(); }}
                      className={`w-full py-1.5 rounded-lg font-sans font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        (!isOnline || player.bankedChips >= tier.buyIn)
                          ? isOnline
                            ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-950/30 border border-indigo-500'
                            : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-950/30 border border-amber-500'
                          : 'bg-slate-950 border border-slate-800 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {isOnline
                        ? (player.bankedChips >= tier.buyIn
                          ? `BUY IN ARENA (-${chipFull(tier.buyIn)})`
                          : 'STAKE AMOUNT EXCEEDS BANK')
                        : 'START PRACTICE MODE (FREE)'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: selected arena detail card — sticky so BUY IN stays visible */}
      <div className="hidden lg:flex lg:col-span-5 lg:sticky lg:top-4 lg:self-start lg:flex-col justify-between bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-2 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div
          aria-hidden="true"
          className="absolute -top-12 -right-12 w-48 h-48 lg:w-24 lg:h-24 rounded-full blur-3xl opacity-10 pointer-events-none transition-all duration-300"
          style={{ backgroundColor: selectedTier.accentColor }}
        />

        <div>
          <span
            className={`text-[10px] lg:text-[11px] px-2 lg:px-1.5 py-1 lg:py-0.5 rounded-full font-bold uppercase tracking-wider font-sans border border-transparent ${selectedTier.color}`}
          >
            {selectedTier.difficulty} Match
          </span>

          <h2 className="text-2xl lg:text-[11px] font-bold font-sans tracking-tight text-white mt-4 lg:mt-1 flex items-center gap-2">
            {selectedTier.name}
            {isOnline && tierIndex > 0 && (
              <span className="text-[10px] lg:text-[11px] font-mono font-bold text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-800">
                TIER {tierIndex} / {ARENA_TIERS.length}
              </span>
            )}
          </h2>

          <p className="text-sm text-slate-300 font-sans mt-2.5 lg:text-[11px] lg:mt-0.5 leading-relaxed">
            {selectedTier.description}
          </p>

          {/* Details list */}
          <div className="flex flex-col gap-3 lg:gap-1 mt-6 lg:mt-1 bg-slate-950/60 p-4 lg:p-1.5 rounded-xl border border-slate-800/60">
            <DetailRow
              icon={<Landmark className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-500" />}
              label="Stake Buy-In"
              value={
                selectedTier.buyIn === 0
                  ? 'FREE'
                  : `${chipFull(selectedTier.buyIn)}`
              }
              valueClass="text-white"
            />

            <DetailRow
              icon={<Trophy className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-500" />}
              label="Extraction"
              value={'EXIT ANYTIME'}
              valueClass="text-emerald-400"
            />

            <DetailRow
              icon={<Users className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-500" />}
              label="Bot Population"
              value={!isOnline ? offlineBotLabel : `${selectedTier.botsCount.toLocaleString()} Bots`}
              valueClass="text-cyan-400"
            />

            {isOnline && (
              <div className="flex items-center justify-between text-xs lg:text-[11px] font-sans text-slate-400 border-t border-slate-900/50 pt-2.5 lg:pt-1 mt-0.5 lg:mt-0">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Online Players
                </span>
                <span className="font-mono text-indigo-400 font-semibold">
                  {arenaStats[selectedTier.id]
                    ? `${arenaStats[selectedTier.id].players} / ${arenaStats[selectedTier.id].maxPlayers.toLocaleString()}`
                    : '— / 1,000'}
                </span>
              </div>
            )}

            <DetailRow
              icon={<Zap className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-500" />}
              label="XP Multiplier"
              value={`x${selectedTier.rewardMultiplier} Multi`}
              valueClass="text-indigo-400"
            />
          </div>

          {/* Mode warning */}
          <div className="mt-4 lg:mt-1 p-3 lg:p-1.5 rounded-lg bg-indigo-950/20 border border-indigo-900/30 text-[11px] text-indigo-300 font-sans flex items-start gap-2 leading-relaxed">
            <Shield className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              {isOnline ? (
                <span>
                  <strong>ONLINE MULTIPLAYER:</strong> High-stakes arena for up to 1,000 players.
                  Collect star chips from defeated opponents and extract safely.
                  Graduated commission: <strong>0% if ≤3 players</strong>, <strong>35% if ≥4 players</strong>.
                </span>
              ) : (
                <span>
                  <strong>OFFLINE PRACTICE MODE:</strong> Risk-free training
                  ground. Test your skills against {selectedTier.botsCount.toLocaleString()} bots without wagering,
                  losing, or earning any of your banked chips!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Enter trigger */}
        <div className="mt-6 lg:mt-1 pt-4 lg:pt-1 border-t border-slate-800/60">
          <button
            type="button"
            onClick={handleEnterArena}
            className={`w-full py-3 lg:py-1 rounded-xl font-sans font-bold text-sm lg:text-[11px] flex items-center justify-center gap-2 transition duration-200 cursor-pointer ${
              canPlay
                ? isOnline
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-950/30 border border-indigo-500'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-lg shadow-amber-950/30 border border-amber-500'
                : 'bg-slate-950 border border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Play className="w-4 h-4 lg:w-3 lg:h-3 fill-current" />
            {isOnline
              ? canPlay
                ? `BUY IN ARENA (-${chipFull(selectedTier.buyIn)})`
                : 'STAKE AMOUNT EXCEEDS BANK'
              : 'START PRACTICE MODE (FREE)'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueClass = 'text-white',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-[11px] lg:text-[11px] font-sans text-slate-400">
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`font-mono font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

export default ArenaSelector;
