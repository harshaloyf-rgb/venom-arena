'use client';

/**
 * Arena Selector panel.
 * Displays practice arenas for offline play.
 */

import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Landmark,
  Play,
  Shield,
  Trophy,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ARENA_TIERS, PRACTICE_TIERS } from '@/lib/game-config';
import {
  PanelSkeleton,
  NotSignedIn,
} from './_panel-primitives';
import { chipShort, chipFull } from '@/lib/format-chips';

interface ArenaSelectorProps {
  onPlay: (arenaId: string) => void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function ArenaSelector({ onPlay, onToast }: ArenaSelectorProps) {
  const { player, loading } = useAuth();
  const [selectedTierId, setSelectedTierId] = useState<string>('practice-easy');

  // Use all tiers for selection
  const tiersList = ARENA_TIERS;
  const selectedTier =
    tiersList.find((t) => t.id === selectedTierId) || tiersList[0];

  const tierIndex = ARENA_TIERS.findIndex((t) => t.id === selectedTier.id) + 1;

  function handleEnterArena() {
    onPlay(selectedTier.id);
  }

  if (loading) return <PanelSkeleton count={4} height="h-40" />;
  if (!player) return <NotSignedIn />;

  return (
    <div
      id="arena-selector"
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* LEFT: tier list */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h3 className="text-sm font-bold font-sans uppercase tracking-wider text-slate-400">
              Arena Shards
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              30 tiers · 10c → 1B chips
            </p>
          </div>
        </div>

        {/* Tiers list */}
        <div className="flex flex-col gap-2.5 pr-1 max-h-[480px] overflow-y-auto">
          {tiersList.map((tier) => {
            const active = tier.id === selectedTierId;
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
                  <div
                    aria-hidden="true"
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-lg shrink-0"
                    style={{
                      backgroundColor: tier.accentColor,
                      boxShadow: active ? `0 0 12px ${tier.accentColor}` : 'none',
                    }}
                  />\n                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold font-sans text-white group-hover:text-indigo-300 transition-colors truncate">
                        {tier.name}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-sans border border-transparent ${tier.color}`}>
                        {tier.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-sans mt-1 line-clamp-1">
                      {tier.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">Stake</span>
                    <span className="text-sm font-bold font-mono block text-emerald-400">
                      {tier.buyIn === 0 ? 'FREE' : `${tier.buyIn.toLocaleString()}c`}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${active ? 'translate-x-1 text-indigo-400' : ''}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: selected arena detail card */}
      <div className="lg:col-span-5 lg:sticky lg:top-4 lg:self-start flex flex-col justify-between bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-10 pointer-events-none transition-all duration-300" style={{ backgroundColor: selectedTier.accentColor }} />

        <div>
          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider font-sans border border-transparent ${selectedTier.color}`}>
            {selectedTier.difficulty} Match
          </span>

          <h2 className="text-2xl font-bold font-sans tracking-tight text-white mt-4 flex items-center gap-2">
            {selectedTier.name}
            {tierIndex > 0 && (
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-800">
                TIER {tierIndex} / {ARENA_TIERS.length}
              </span>
            )}
          </h2>

          <p className="text-sm text-slate-300 font-sans mt-2.5 leading-relaxed">{selectedTier.description}</p>

          <div className="flex flex-col gap-3 mt-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800/60">
            <DetailRow icon={<Landmark className="w-3.5 h-3.5 text-slate-500" />} label="Stake Buy-In" value={selectedTier.buyIn === 0 ? 'FREE' : chipFull(selectedTier.buyIn)} valueClass="text-white" />
            <DetailRow icon={<Trophy className="w-3.5 h-3.5 text-slate-500" />} label="Extraction" value="EXIT ANYTIME" valueClass="text-emerald-400" />
            <DetailRow icon={<Zap className="w-3.5 h-3.5 text-slate-500" />} label="XP Multiplier" value={`x${selectedTier.rewardMultiplier} Multi`} valueClass="text-indigo-400" />
          </div>

          <div className="mt-4 p-3 rounded-lg bg-amber-950/20 border border-amber-900/30 text-[11px] text-amber-300 font-sans flex items-start gap-2 leading-relaxed">
            <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>PRACTICE MODE:</strong> Risk-free training ground. Test your skills without wagering any banked chips!
            </span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/60">
          <button
            type="button"
            onClick={handleEnterArena}
            className="w-full py-3 rounded-xl font-sans font-bold text-sm flex items-center justify-center gap-2 transition duration-200 cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-lg shadow-amber-950/30 border border-amber-500"
          >
            <Play className="w-4 h-4 fill-current" />
            START PRACTICE MODE (FREE)
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, valueClass = 'text-white' }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-xs font-sans text-slate-400">
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      <span className={`font-mono font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

export default ArenaSelector;
