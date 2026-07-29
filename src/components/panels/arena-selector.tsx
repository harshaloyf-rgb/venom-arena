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

// ── Difficulty filter groups ──────────────────────────────────────────

const DIFFICULTY_GROUPS = [
  { label: 'All',       difficulty: null as const,            accent: 'text-slate-400' },
  { label: 'Beginner',   difficulty: 'Beginner' as const,    accent: 'text-emerald-400' },
  { label: 'Medium',     difficulty: 'Medium' as const,      accent: 'text-amber-400' },
  { label: 'High Stakes', difficulty: 'High Stakes' as const, accent: 'text-rose-400' },
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
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [arenaStats, setArenaStats] = useState<
    Record<string, ArenaStats>
  >({});

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
      setDifficultyFilter(null);
      setSelectedTierId('tier-1');
    } else {
      setSelectedTierId('practice-easy');
    }
  }

  function handleDifficultyFilter(diff: string | null) {
    setDifficultyFilter(diff);
    // Auto-select first visible tier
    const target = diff
      ? ARENA_TIERS.find((t) => t.difficulty === diff)
      : ARENA_TIERS[0];
    if (target) setSelectedTierId(target.id);
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
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* LEFT: tier list */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        {/* Header row: title + mode toggle */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h3 className="text-sm font-bold font-sans uppercase tracking-wider text-slate-400">
              {isOnline ? 'Online PvP Shards' : 'Practice Arenas'}
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              {isOnline ? '30 tiers · 10c → 1B chips' : 'Choose your difficulty'}
            </p>
          </div>

          {/* Mode Selector */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800/80">
            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              className={`px-3 py-1 rounded-md text-xs font-sans font-medium flex items-center gap-1 transition-all ${
                isOnline
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Online
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch(false)}
              className={`px-3 py-1 rounded-md text-xs font-sans font-medium flex items-center gap-1 transition-all ${
                !isOnline
                  ? 'bg-amber-600/25 text-amber-300 border border-amber-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Swords className="w-3.5 h-3.5" /> Offline
            </button>
          </div>
        </div>

        {/* Difficulty filter tabs (online mode only) */}
        {isOnline && (
          <div className="flex items-center gap-1.5 px-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-slate-600 shrink-0" />
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
                  className={`px-2.5 py-1 rounded-md text-[10px] font-sans font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-slate-950 border-slate-800/80 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {group.label}
                  <span className="ml-1 text-slate-600">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Highest affordable badge (online mode) */}
        {isOnline && highestAffordableTier && (
          <div className="px-2">
            <button
              type="button"
              onClick={() => {
                setDifficultyFilter(null);
                setSelectedTierId(highestAffordableTier.id);
              }}
              className="text-[10px] font-sans text-emerald-400/70 hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              Jump to highest affordable: {highestAffordableTier.name} ({highestAffordableTier.buyIn.toLocaleString()}c)
            </button>
          </div>
        )}

        {/* Tiers list — no max-height needed since filter shows max 6 tiers */}
        <div className="flex flex-col gap-2.5 pr-1">
          {tiersList.map((tier) => {
            const active = tier.id === selectedTierId;
            const unaffordable =
              isOnline && player.bankedChips < tier.buyIn;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedTierId(tier.id)}
                className={`relative flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${
                  active
                    ? 'bg-slate-800/50 border-indigo-500 shadow-md shadow-indigo-950/20'
                    : 'bg-slate-900 border-slate-800/80 hover:border-slate-700/80'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Glowing accent dot */}
                  <div
                    aria-hidden="true"
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-lg shrink-0"
                    style={{
                      backgroundColor: tier.accentColor,
                      boxShadow: active
                        ? `0 0 12px ${tier.accentColor}`
                        : 'none',
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold font-sans text-white group-hover:text-indigo-300 transition-colors truncate">
                        {tier.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-sans border border-transparent ${tier.color}`}
                      >
                        {tier.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-sans mt-1 line-clamp-1">
                      {tier.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isOnline && (
                    <div className="text-right mr-3 select-none">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
                        Online
                      </span>
                      <span className="text-xs font-bold font-mono text-indigo-400 flex items-center justify-end gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        {arenaStats[tier.id]
                          ? `${arenaStats[tier.id].players} / ${arenaStats[tier.id].maxPlayers.toLocaleString()}`
                          : '0 / 1,000'}
                      </span>
                    </div>
                  )}
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
                      Buy-In
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        unaffordable ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {tier.buyIn === 0
                        ? 'FREE'
                        : `${tier.buyIn.toLocaleString()} c`}
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-500 transition-transform ${
                      active ? 'translate-x-1 text-indigo-400' : ''
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: selected arena detail card */}
      <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div
          aria-hidden="true"
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-10 pointer-events-none transition-all duration-300"
          style={{ backgroundColor: selectedTier.accentColor }}
        />

        <div>
          <span
            className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider font-sans border border-transparent ${selectedTier.color}`}
          >
            {selectedTier.difficulty} Match
          </span>

          <h2 className="text-2xl font-bold font-sans tracking-tight text-white mt-4 flex items-center gap-2">
            {selectedTier.name}
            {isOnline && tierIndex > 0 && (
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-800">
                TIER {tierIndex} / {ARENA_TIERS.length}
              </span>
            )}
          </h2>

          <p className="text-sm text-slate-300 font-sans mt-2.5 leading-relaxed">
            {selectedTier.description}
          </p>

          {/* Details list */}
          <div className="flex flex-col gap-3 mt-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800/60">
            <DetailRow
              icon={<Landmark className="w-3.5 h-3.5 text-slate-500" />}
              label="Stake Buy-In"
              value={
                selectedTier.buyIn === 0
                  ? 'FREE'
                  : `${selectedTier.buyIn.toLocaleString()} CHIPS`
              }
              valueClass="text-white"
            />

            <DetailRow
              icon={<Trophy className="w-3.5 h-3.5 text-slate-500" />}
              label="Extraction"
              value={'EXIT ANYTIME'}
              valueClass="text-emerald-400"
            />

            <DetailRow
              icon={<Users className="w-3.5 h-3.5 text-slate-500" />}
              label="Bot Population"
              value={`${selectedTier.botsCount.toLocaleString()} Bots`}
              valueClass="text-cyan-400"
            />

            {isOnline && (
              <div className="flex items-center justify-between text-xs font-sans text-slate-400 border-t border-slate-900/50 pt-2.5 mt-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Online Players
                </span>
                <span className="font-mono text-indigo-400 font-semibold">
                  {arenaStats[selectedTier.id]
                    ? `${arenaStats[selectedTier.id].players} / ${arenaStats[selectedTier.id].maxPlayers.toLocaleString()}`
                    : '0 / 1,000'}
                </span>
              </div>
            )}

            <DetailRow
              icon={<Zap className="w-3.5 h-3.5 text-slate-500" />}
              label="XP Multiplier"
              value={`x${selectedTier.rewardMultiplier} Multi`}
              valueClass="text-indigo-400"
            />
          </div>

          {/* Mode warning */}
          <div className="mt-4 p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 text-[11px] text-indigo-300 font-sans flex items-start gap-2 leading-relaxed">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
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
        <div className="mt-6 pt-4 border-t border-slate-800/60">
          <button
            type="button"
            onClick={handleEnterArena}
            className={`w-full py-3 rounded-xl font-sans font-bold text-sm flex items-center justify-center gap-2 transition duration-200 cursor-pointer ${
              canPlay
                ? isOnline
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-950/30 border border-indigo-500'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-lg shadow-amber-950/30 border border-amber-500'
                : 'bg-slate-950 border border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            {isOnline
              ? canPlay
                ? `BUY IN ARENA (-${selectedTier.buyIn.toLocaleString()} c)`
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
    <div className="flex items-center justify-between text-xs font-sans text-slate-400">
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`font-mono font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

export default ArenaSelector;
