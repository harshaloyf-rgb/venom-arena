'use client';

import {
  CHAMPIONSHIP_PRIZE_TIERS,
} from '@/lib/game-config';
import {
  MicroLabel,
} from '../_panel-primitives';
import {
  Trophy,
  Gift,
  Sparkles,
  Award,
  Swords,
  Play,
  AlertTriangle,
} from 'lucide-react';

// ── Types ──

export interface PlayerStatus {
  rank: number;
  bankedChips: number;
  gamesPlayed: number;
  efficiency: number;
  prize: { chipsReward: number; crownTitle: string } | null;
  gapAbove: number | null;
  gapBelow: number | null;
  aboveName: string | null;
  belowName: string | null;
}

// ── Constants ──

const MAX_GAMES = 10000;

const PRIZE_TIER_VISUAL: Record<string, { border: string; bg: string; glow: string; accent: string }> = {
  RANK_1: {
    border: 'border-amber-400/50',
    bg: 'bg-gradient-to-br from-amber-950/30 via-slate-950/80 to-yellow-950/20',
    glow: 'bg-amber-400/10', accent: 'text-amber-300',
  },
  RANK_2_10: {
    border: 'border-slate-300/30',
    bg: 'bg-gradient-to-br from-slate-200/5 via-slate-950/80 to-slate-300/5',
    glow: 'bg-slate-300/5', accent: 'text-slate-200',
  },
  RANK_11_50: {
    border: 'border-orange-600/25',
    bg: 'bg-gradient-to-br from-orange-950/15 via-slate-950/80 to-orange-900/10',
    glow: 'bg-orange-500/5', accent: 'text-orange-300',
  },
  RANK_51_100: {
    border: 'border-slate-600/25',
    bg: 'bg-slate-950/80', glow: '', accent: 'text-slate-400',
  },
};

const PRIZE_SPOTS: Record<string, string> = {
  RANK_1: '1 Winner',
  RANK_2_10: '9 Spots',
  RANK_11_50: '40 Spots',
  RANK_51_100: '50 Spots',
};

// ── Helpers ──

function fmtINR(n: number) { return n.toLocaleString('en-IN'); }

function matchCapWarning(played: number) {
  const remaining = MAX_GAMES - played;
  if (played >= 9900) return { level: 'critical' as const, color: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/30', label: `CRITICAL — Only ${remaining} match${remaining !== 1 ? 'es' : ''} left!`, barColor: 'from-red-600 to-red-400' };
  if (played >= 9500) return { level: 'danger' as const, color: 'text-orange-400', bg: 'bg-orange-500/10 border border-orange-500/30', label: `DANGER — ${remaining} matches remaining`, barColor: 'from-orange-500 to-amber-500' };
  if (played >= 9000) return { level: 'warning' as const, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border border-yellow-500/30', label: `CAUTION — ${remaining} matches remaining`, barColor: 'from-yellow-500 to-amber-400' };
  return { level: 'safe' as const, color: 'text-slate-400', bg: '', label: `${remaining.toLocaleString()} Championship matches remaining this year`, barColor: 'from-emerald-600 to-amber-500' };
}

// ── Component ──

interface PlayerStatusCardProps {
  registered: boolean;
  mySummary: PlayerStatus | null;
  player: { bankedChips: number };
  gamesPlayed: number;
  onRegister: () => void;
  onPlayMatch: () => void;
}

export function PlayerStatusCard({ registered, mySummary, player, gamesPlayed, onRegister, onPlayMatch }: PlayerStatusCardProps) {
  const warning = matchCapWarning(gamesPlayed);
  const remaining = MAX_GAMES - gamesPlayed;

  return (
    <>
      {/* ═══ MY CHAMPIONSHIP SUMMARY ═══ */}
      {!registered ? (
        <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-950/10 p-5 mb-6 text-center lg:p-2 lg:mb-1">
          <Trophy className="w-8 h-8 text-amber-400/60 mx-auto mb-2 lg:w-5 lg:h-5 lg:mb-0.5" />
          <p className="text-sm font-bold text-white lg:text-[11px]">Register for the 2026 Championship</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto lg:text-[11px]">Join the annual tournament to track your ranking, projected prizes, and compete for the Hall of Fame induction on January 1st!</p>
          <button type="button" onClick={onRegister} className="mt-3 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 mx-auto lg:mt-1 lg:px-3 lg:py-1">
            <Trophy className="w-4 h-4 lg:w-3 lg:h-3" /> REGISTER NOW — FREE ENTRY
          </button>
        </div>
      ) : mySummary ? (
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/15 to-slate-950/60 p-4 sm:p-5 mb-6 shadow-md lg:p-1.5 lg:mb-1">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2 lg:mb-0.5">
            <span className="text-sm font-bold text-white flex items-center gap-1.5 lg:text-[11px]"><Trophy className="w-4 h-4 text-amber-400 lg:w-3 lg:h-3" /> My Championship Summary</span>
            <span className="text-[11px] font-mono text-amber-300 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full">Global Ranking</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-1">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 lg:p-1.5">
              <MicroLabel className="text-[11px]">PROJECTED RANK</MicroLabel>
              <div className="text-xl font-black font-mono text-amber-300 mt-1 lg:text-[11px]">#{mySummary.rank}</div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">{mySummary.rank <= 100 ? 'HOF Eligible' : 'Outside Top 100'}</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 lg:p-1.5">
              <MicroLabel className="text-[11px]">PROJECTED PRIZE</MicroLabel>
              {mySummary.prize ? (<><div className="text-sm font-bold text-emerald-400 mt-1 lg:text-[11px]">+{fmtINR(mySummary.prize.chipsReward)}c</div><div className="text-[11px] font-mono text-slate-400 mt-0.5 lg:truncate">{mySummary.prize.crownTitle}</div></>) : (<div className="text-sm font-bold text-slate-500 mt-1">— None</div>)}
            </div>
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 lg:p-1.5">
              <MicroLabel className="text-[11px]">AVG CHIPS / GAME</MicroLabel>
              <div className="text-lg font-bold font-mono text-cyan-300 mt-1 lg:text-[11px]">{mySummary.efficiency > 0 ? fmtINR(mySummary.efficiency) : '—'}</div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">{gamesPlayed.toLocaleString()} games played</div>
            </div>
            {mySummary.gapAbove !== null && mySummary.aboveName ? (
              <div className="p-3 rounded-xl border border-red-500/15 bg-red-950/10 lg:p-1.5">
                <MicroLabel className="text-[11px]">▲ PLAYER AHEAD</MicroLabel>
                <div className="text-xs font-bold text-white mt-1 lg:truncate">{mySummary.aboveName}</div>
                <div className="text-[11px] font-mono text-red-300 mt-0.5">+{fmtINR(mySummary.gapAbove)} chips ahead</div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-amber-500/15 bg-amber-950/10 lg:p-1.5">
                <MicroLabel className="text-[11px]">▲ POSITION</MicroLabel>
                <div className="text-xs font-bold text-amber-300 mt-1 lg:text-[11px]">👑 You're #1!</div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">Nobody ahead of you</div>
              </div>
            )}
            {mySummary.gapBelow !== null && mySummary.belowName ? (
              <div className="p-3 rounded-xl border border-emerald-500/15 bg-emerald-950/10 lg:p-1.5">
                <MicroLabel className="text-[11px]">▼ PLAYER BEHIND</MicroLabel>
                <div className="text-xs font-bold text-white mt-1 lg:truncate">{mySummary.belowName}</div>
                <div className="text-[11px] font-mono text-emerald-300 mt-0.5">{mySummary.gapBelow} chips behind you</div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 lg:p-1.5">
                <MicroLabel className="text-[11px]">▼ PLAYER BEHIND</MicroLabel>
                <div className="text-xs font-bold text-slate-500 mt-1 lg:text-[11px]">—</div>
                <div className="text-[11px] font-mono text-slate-600 mt-0.5">Last in standings</div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ═══ PLAYER DOSSIER ═══ */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5 mb-6 shadow-md lg:p-1.5 lg:mb-1">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2 lg:mb-0.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white lg:text-[11px]"><Swords className="w-4 h-4 text-indigo-400 lg:w-3 lg:h-3" /> Matches Limit Progress:</span>
          <span className="text-xs font-mono text-slate-300 lg:text-[11px]">{gamesPlayed.toLocaleString()} / 10,000 Played</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mb-3 lg:h-1.5 lg:mb-1">
          <div className={`h-full bg-gradient-to-r ${warning.barColor} rounded-full transition-colors duration-500`} style={{ width: `${Math.min(100, (gamesPlayed / MAX_GAMES) * 100)}%` }} />
        </div>
        {warning.level !== 'safe' ? (
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-2 mb-3 text-[11px] font-bold ${warning.bg} ${warning.color} lg:px-2 lg:py-1 lg:mb-1`}><AlertTriangle className="w-3.5 h-3.5 shrink-0 lg:w-3 lg:h-3" />{warning.label}</div>
        ) : (
          <p className="text-[11px] text-slate-400 mb-4 lg:mb-1">{warning.label}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-1">
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 lg:p-1.5">
            <MicroLabel className="text-[11px]">COMPETING WALLET CHIPS</MicroLabel>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1 lg:text-[11px]">{fmtINR(player.bankedChips)} Chips</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Max chips at year-end decides rank!</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 lg:p-1.5">
            <MicroLabel className="text-[11px]">STATUS</MicroLabel>
            <div className="text-sm font-bold text-white mt-1 lg:text-[11px]">{registered ? '✅ Registered & Active in 2026 Championship' : 'Free Entry | Join Anytime'}</div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center gap-2 lg:p-1.5">
            {!registered ? (
              <button type="button" onClick={onRegister} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 lg:px-2 lg:py-1"><Trophy className="w-4 h-4 lg:w-3 lg:h-3" /> JOIN 2026 CHAMPIONSHIP NOW</button>
            ) : (
              <button type="button" onClick={onPlayMatch} className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 lg:px-2 lg:py-1"><Play className="w-3.5 h-3.5 fill-current lg:w-3 lg:h-3" /> PLAY CHAMPIONSHIP MATCH</button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PRIZE TIERS ═══ */}
      <div className="mb-6 lg:mb-1">
        <div className="flex items-center justify-between mb-3 lg:mb-0.5">
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 lg:text-[11px]"><Gift className="w-5 h-5 text-amber-400 lg:w-3 lg:h-3" /> Jan 1st Payout &amp; Hall of Fame Tiers</h2>
          <span className="text-[11px] font-mono text-slate-500">Awarded automatically on 01 January</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-1">
          {CHAMPIONSHIP_PRIZE_TIERS.map((tier) => {
            const vis = PRIZE_TIER_VISUAL[tier.category] ?? PRIZE_TIER_VISUAL.RANK_51_100;
            const spots = PRIZE_SPOTS[tier.category] ?? '';
            return (
              <div key={tier.category} className={`relative p-4 rounded-2xl border ${vis.border} ${vis.bg} shadow-md overflow-hidden lg:p-1.5`}>
                <div className={`absolute top-0 right-0 w-32 h-32 ${vis.glow} rounded-full blur-3xl pointer-events-none lg:w-16 lg:h-16`} aria-hidden />
                <div className="relative">
                  <div className="flex items-center justify-between gap-2 mb-1 lg:gap-1 lg:mb-0">
                    <div className={`text-[11px] font-mono ${vis.accent}`}>{tier.badge}</div>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${vis.border} ${vis.accent} bg-slate-950/50`}>{spots}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white lg:text-[11px]">{tier.title}</h3>
                  <div className="mt-2 text-lg font-black font-mono text-emerald-400 lg:text-[11px]">+{fmtINR(tier.chipsReward)} CHIPS</div>
                  <div className="text-[11px] text-slate-400 mt-1">Crown Title: <span className="text-white font-bold">{tier.crownTitle}</span></div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-400" /> {tier.itemReward}</div>
                  {tier.hallOfFameInduction && <div className="text-[11px] text-yellow-300 mt-1 flex items-center gap-1"><Award className="w-3 h-3" /> Permanent Hall of Fame Inscription</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
