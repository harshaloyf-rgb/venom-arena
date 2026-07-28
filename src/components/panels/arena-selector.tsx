'use client';

/**
 * BUILD-11 — `ArenaSelector` panel.
 *
 * Faithful replica of `/upload/extracted/src/components/ArenaSelector.tsx`
 * (328 lines). Adapted to read player chips from `useAuth()` instead of a
 * `playerStats` prop, and to expose an `onPlay(arenaId, isOnline)` callback.
 *
 * All textual strings, the inline Online/Offline toggle, the 7 ARENA_TIERS
 * cards, the 3 free PRACTICE_TIERS, the selected-arena detail card with its
 * "Stake Buy-In / Target Value / Active Challengers / XP Multiplier" rows,
 * the mode-warning paragraph (65% / 35% commission for online, risk-free
 * training for offline), and the three launch-button label variants
 * ("BUY IN ARENA (-N c)" / "STAKE AMOUNT EXCEEDS BANK" / "START PRACTICE
 * MODE (FREE)") are preserved verbatim from the original.
 */

import { useEffect, useState } from 'react';
import {
  ChevronRight,
  Compass,
  Landmark,
  Play,
  Shield,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ARENA_TIERS, PRACTICE_TIERS } from '@/lib/game-config';
import {
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';

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

  if (loading) return <PanelSkeleton count={4} height="h-40" />;
  if (!player) return <NotSignedIn />;

  const tiersList = isOnline ? ARENA_TIERS : PRACTICE_TIERS;
  const selectedTier =
    tiersList.find((t) => t.id === selectedTierId) || tiersList[0];
  const canAfford = player.bankedChips >= selectedTier.buyIn;
  const canPlay = !isOnline || canAfford;

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
        <div className="flex items-center justify-between px-2">
          <div>
            <h3 className="text-sm font-bold font-sans uppercase tracking-wider text-slate-400">
              {isOnline ? 'Online PvP Shards' : 'Practice Arenas'}
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Choose your buy-in risk level
            </p>
          </div>

          {/* Mode Selector */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setIsOnline(true);
                setSelectedTierId('tier-1');
              }}
              className={`px-3 py-1 rounded-md text-xs font-sans font-medium flex items-center gap-1 transition-all ${
                isOnline
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Online Arena
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOnline(false);
                setSelectedTierId('practice-easy');
              }}
              className={`px-3 py-1 rounded-md text-xs font-sans font-medium flex items-center gap-1 transition-all ${
                !isOnline
                  ? 'bg-amber-600/25 text-amber-300 border border-amber-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Swords className="w-3.5 h-3.5" /> Offline Mode
            </button>
          </div>
        </div>

        {/* Tiers scroll */}
        <div className="flex flex-col gap-2.5 max-h-[460px] overflow-y-auto va-scroll pr-1">
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
                          ? `${arenaStats[tier.id].players} / ${arenaStats[tier.id].maxPlayers}`
                          : '0 / 500'}
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
              label="Target Value"
              value={
                selectedTier.minExtract === 0
                  ? 'NONE (EXIT ANYTIME)'
                  : `${selectedTier.minExtract.toLocaleString()} CHIPS`
              }
              valueClass="text-emerald-400"
            />

            <DetailRow
              icon={<Users className="w-3.5 h-3.5 text-slate-500" />}
              label="Active Challengers"
              value={`${selectedTier.botsCount} Snakes`}
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
                    ? `${arenaStats[selectedTier.id].players} / ${arenaStats[selectedTier.id].maxPlayers}`
                    : '0 / 500'}
                </span>
              </div>
            )}

            <DetailRow
              icon={<Compass className="w-3.5 h-3.5 text-slate-500" />}
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
                  <strong>ONLINE MULTIPLAYER SIM:</strong> High-tension lobby.
                  Collect dropping star chips from opponents and escape safely.
                  Successful extraction banks <strong>65% of carried chips</strong>{' '}
                  after <strong>35% system commission</strong>.
                </span>
              ) : (
                <span>
                  <strong>OFFLINE PRACTICE MODE:</strong> Risk-free training
                  ground. Test your skills against bots without wagering,
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
