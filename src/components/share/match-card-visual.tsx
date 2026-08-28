'use client';

/**
 * MatchCardVisual — React DOM version of the canvas share card.
 * Renders a beautiful branded stats card directly in the feed.
 * Used by ClipShowcase for match-card type clips.
 */

import { countryFlag } from '@/lib/game-config';
import { formatChipsIndian as formatChips } from '@/lib/format-chips';

interface MatchCardVisualProps {
  title: string;
  playerName: string;
  userTag: string;
  country: string;
  level: number;
  clanTag?: string | null;
  arenaName: string;
  outcome: 'extract' | 'death';
  chipsEarned: number;
  chipsLost: number;
  kills: number;
  snakeLength: number;
  durationSec: number;
  isOnline: boolean;
  upvotes: number;
  compact?: boolean; // smaller version for feed list
}



function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function MatchCardVisual({
  playerName,
  userTag,
  country,
  level,
  clanTag,
  arenaName,
  outcome,
  chipsEarned,
  chipsLost,
  kills,
  snakeLength,
  durationSec,
  isOnline,
  upvotes,
  compact = false,
}: MatchCardVisualProps) {
  const isWin = outcome === 'extract';
  const accentColor = isWin ? 'emerald' : 'red';

  if (compact) {
    // Compact horizontal card for feed list
    return (
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Outcome strip */}
        <div className={`h-1.5 lg:h-1 w-full ${isWin ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-700 to-red-500'}`} />

        <div className="p-4 sm:p-5 lg:p-1.5">
          {/* Arena + online badge */}
          <div className="flex items-center justify-between mb-3 lg:mb-0.5">
            <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              {isOnline ? '🌐' : '🎮'} {arenaName}
            </span>
            <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2 lg:px-1 py-0.5 rounded-full border ${
              isWin
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                : 'text-red-300 bg-red-500/10 border-red-500/30'
            }`}>
              {isWin ? '✅ Extracted' : '💀 Eliminated'}
            </span>
          </div>

          {/* Player info */}
          <div className="flex items-center gap-3 lg:gap-1 mb-4 lg:mb-1">
            <span className="text-2xl lg:text-sm leading-none" aria-hidden>{countryFlag(country)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white lg:text-[11px]">{playerName}</span>
                {clanTag && (
                  <span className="text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">[{clanTag}]</span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-500">#{userTag} · LVL {level}</div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2 lg:gap-1">
            <StatPill
              icon="💰"
              label={isWin ? 'EARNED' : 'LOST'}
              value={`${isWin ? '+' : '-'}${formatChips(isWin ? chipsEarned : chipsLost)}`}
              color={isWin ? 'text-emerald-400' : 'text-red-400'}
            />
            <StatPill icon="💀" label="KILLS" value={String(kills)} color="text-amber-400" />
            <StatPill icon="🐍" label="LENGTH" value={String(snakeLength)} color="text-blue-400" />
            <StatPill icon="⏱️" label="TIME" value={formatDuration(durationSec)} color="text-purple-400" />
          </div>

          {/* Footer branding */}
          <div className="flex items-center justify-between mt-4 lg:mt-0.5 pt-3 lg:pt-0.5 border-t border-slate-800/60">
            <span className="text-[11px] font-mono text-slate-600">🐍 VENOM ARENA</span>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>🔥</span><span className="font-bold">{upvotes}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full-width hero card
  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800/60">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0f1623] to-slate-950" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* Accent glow */}
      <div className={`absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-20 ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full blur-3xl bg-violet-600 opacity-[0.07]" />

      <div className="relative z-10 p-5 sm:p-8 lg:p-2">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 lg:mb-1">
          <div className="flex items-center gap-2 lg:gap-1">
            <span className="text-lg lg:text-sm">🐍</span>
            <span className="text-sm lg:text-[11px] font-bold text-red-400 tracking-wide">VENOM ARENA</span>
          </div>
          <span className={`text-[11px] font-mono font-bold uppercase tracking-widest px-3 lg:px-1.5 py-1 lg:py-0.5 rounded-full border ${
            isWin
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
              : 'text-red-300 bg-red-500/10 border-red-500/30'
          }`}>
            {isWin ? '✅ EXTRACTED' : '💀 ELIMINATED'}
          </span>
        </div>

        {/* Arena */}
        <div className="text-center mb-5 lg:mb-0.5">
          <span className="text-xs lg:text-[11px] font-mono text-slate-500">
            {isOnline ? '🌐' : '🎮'} {arenaName}
          </span>
        </div>

        {/* Player info */}
        <div className="flex items-center justify-center gap-3 lg:gap-1 mb-6 lg:mb-1">
          <span className="text-3xl lg:text-base leading-none" aria-hidden>{countryFlag(country)}</span>
          <div className="text-center">
            <div className="flex items-center gap-2 justify-center">
              <span className="text-xl lg:text-[11px] font-bold text-white">{playerName}</span>
              {clanTag && (
                <span className="text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">[{clanTag}]</span>
              )}
            </div>
            <div className="text-xs lg:text-[11px] font-mono text-slate-500">#{userTag} · LVL {level}</div>
          </div>
        </div>

        {/* Main stat - chips */}
        <div className={`text-center mb-6 lg:mb-1 py-4 lg:py-1 rounded-2xl border ${
          isWin ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className={`text-3xl sm:text-4xl lg:text-[11px] font-black ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
            {isWin ? '+' : '-'}{formatChips(isWin ? chipsEarned : chipsLost)} c
          </div>
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mt-1 lg:mt-0">
            {isWin ? 'Chips Banked' : 'Chips Lost'}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 lg:gap-1 mb-6 lg:mb-1">
          <div className="text-center py-3 lg:py-1 rounded-xl bg-slate-900/80 border border-slate-800/50">
            <div className="text-lg lg:text-sm mb-0.5" aria-hidden>💀</div>
            <div className="text-lg lg:text-[11px] font-bold text-amber-400">{kills}</div>
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Kills</div>
          </div>
          <div className="text-center py-3 lg:py-1 rounded-xl bg-slate-900/80 border border-slate-800/50">
            <div className="text-lg lg:text-sm mb-0.5" aria-hidden>🐍</div>
            <div className="text-lg lg:text-[11px] font-bold text-blue-400">{snakeLength}</div>
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Length</div>
          </div>
          <div className="text-center py-3 lg:py-1 rounded-xl bg-slate-900/80 border border-slate-800/50">
            <div className="text-lg lg:text-sm mb-0.5" aria-hidden>⏱️</div>
            <div className="text-lg lg:text-[11px] font-bold text-purple-400">{formatDuration(durationSec)}</div>
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Survived</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 lg:pt-0.5 border-t border-slate-800/60">
          <span className="text-[11px] font-mono text-slate-600">play · extract · dominate</span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>🔥</span><span className="font-bold">{upvotes}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="text-center py-2 lg:py-0.5 rounded-xl bg-slate-900/80 border border-slate-800/50">
      <div className="text-sm lg:text-[11px] mb-0.5" aria-hidden>{icon}</div>
      <div className={`text-sm lg:text-[11px] font-bold ${color}`}>{value}</div>
      <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}
