'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  COSMETIC_FREE_REWARDS,
  COSMETIC_ELITE_REWARDS,
  ELITE_PASS_COST,
} from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Award,
  Lock,
  Check,
  Sparkles,
  Trophy,
  Zap,
  Crown,
  Coins,
} from 'lucide-react';

interface SeasonPassProps {
  onToast?: ToastFn;
}

interface PassTier {
  tier: number;
  xpRequired: number;
  freeReward: typeof COSMETIC_FREE_REWARDS[number];
  eliteReward: typeof COSMETIC_ELITE_REWARDS[number];
}

const SEASON_TIERS: PassTier[] = Array.from({ length: 20 }, (_, i) => ({
  tier: i + 1,
  xpRequired: (i + 1) * 1000,
  freeReward: COSMETIC_FREE_REWARDS[i],
  eliteReward: COSMETIC_ELITE_REWARDS[i],
}));

const SEASON_DAYS_REMAINING = 48;

export function SeasonPass({ onToast }: SeasonPassProps) {
  const { player, refresh } = useAuth();
  const currentLevel = player?.level ?? 1;
  const bankedChips = player?.bankedChips ?? 0;
  const [hasElite, setHasElite] = useState(() => (player?.level ?? 0) > 15);
  const [claimedFree, setClaimedFree] = useState<Set<number>>(new Set([1, 2, 3]));
  const [claimedElite, setClaimedElite] = useState<Set<number>>(new Set([1, 2]));
  const [unlocking, setUnlocking] = useState(false);

  if (!player) return <NotSignedIn />;

  const currentXP = currentLevel * 1000 - 400;
  const nextLevelXP = currentLevel * 1000;
  const xpPct = Math.min(100, Math.round((currentXP / nextLevelXP) * 100));

  function handleUnlockElite() {
    if (hasElite) return;
    if (bankedChips < ELITE_PASS_COST) {
      notify('1,00,000 Banked Chips required for Elite Cyber Pass!', 'error', onToast);
      return;
    }
    setUnlocking(true);
    setTimeout(() => {
      setHasElite(true);
      setUnlocking(false);
      notify('ELITE CYBER PASS UNLOCKED! Enjoy 3x Rewards & Exclusive Skins! 👑', 'success', onToast);
      void refresh();
    }, 800);
  }

  function handleClaimFree(tier: PassTier) {
    if (claimedFree.has(tier.tier)) return;
    if (currentLevel < tier.tier) {
      notify(`Reach Season Level ${tier.tier} to unlock this reward!`, 'error', onToast);
      return;
    }
    setClaimedFree((prev) => new Set(prev).add(tier.tier));
    notify(`Unlocked Free Cosmetic [${tier.freeReward.category}] for Tier ${tier.tier}: ${tier.freeReward.title}! 🎨`, 'success', onToast);
  }

  function handleClaimElite(tier: PassTier) {
    if (!hasElite) {
      notify('Unlock Elite Cyber Pass to claim premium rewards!', 'error', onToast);
      return;
    }
    if (claimedElite.has(tier.tier)) return;
    if (currentLevel < tier.tier) {
      notify(`Reach Season Level ${tier.tier} to unlock this reward!`, 'error', onToast);
      return;
    }
    setClaimedElite((prev) => new Set(prev).add(tier.tier));
    notify(`Unlocked ELITE Cosmetic [${tier.eliteReward.category}] for Tier ${tier.tier}: ${tier.eliteReward.title}! 👑`, 'success', onToast);
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 sm:p-6 shadow-md space-y-6 relative overflow-hidden">
      <GlowBlob color="bg-purple-500/10" className="-top-12 -right-12 w-64 h-64" />

      {/* SEASON BANNER */}
      <section
        aria-label="Season banner"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 p-5 sm:p-6 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md"
      >
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-widest">
              Season 01: Venom Genesis
            </span>
            <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Ends in {SEASON_DAYS_REMAINING} Days
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" />
            Cyber Pass &amp; Season Progression
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Earn Season XP from arena extractions and daily missions to unlock 20 tiers of
            exclusive DNA skins, tail trails, kill sounds, avatar borders, and badges!
          </p>
        </div>

        {/* Elite pass card */}
        <div className="bg-slate-950/90 p-4 rounded-xl border border-amber-500/40 space-y-2 shrink-0 min-w-[240px] w-full md:w-auto">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-400" /> Pass Status
            </span>
            <span className={`font-mono font-bold text-[10px] ${hasElite ? 'text-amber-400' : 'text-slate-500'}`}>
              {hasElite ? '👑 ELITE PASS ACTIVE' : 'FREE PASS'}
            </span>
          </div>
          {!hasElite && (
            <button
              type="button"
              onClick={handleUnlockElite}
              disabled={unlocking}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Crown className="w-3.5 h-3.5" /> {unlocking ? 'Unlocking...' : `Unlock Elite Pass (${ELITE_PASS_COST.toLocaleString('en-IN')} c)`}
            </button>
          )}
          {hasElite && (
            <div className="text-[10px] text-emerald-400 font-mono text-center pt-1">
              ✓ 3x rewards &amp; exclusive skins unlocked
            </div>
          )}
        </div>
      </section>

      {/* SEASON XP BAR */}
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-white font-bold flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-indigo-400" /> Season Level {currentLevel}
          </span>
          <span className="text-slate-400 font-mono">
            {currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
          </span>
        </div>
        <div className="w-full h-3 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>Tier unlocked: {Math.min(SEASON_TIERS.length, currentLevel)}/{SEASON_TIERS.length}</span>
          <span>Banked: {bankedChips.toLocaleString()}c</span>
        </div>
      </section>

      {/* REWARD TIERS GRID */}
      <section aria-label="Reward tiers">
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Reward Tier Track (1 to 20)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 max-h-[600px] overflow-y-auto va-scroll pr-1">
          {SEASON_TIERS.map((tier) => {
            const isUnlocked = currentLevel >= tier.tier;
            const isFreeClaimed = claimedFree.has(tier.tier);
            const isEliteClaimed = claimedElite.has(tier.tier);
            return (
              <div
                key={tier.tier}
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${isUnlocked ? 'bg-slate-950 border-slate-700 shadow-md' : 'bg-slate-950/60 border-slate-900 opacity-80'}`}
              >
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-xs font-mono font-bold text-amber-400">TIER {tier.tier}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{tier.xpRequired.toLocaleString()} XP</span>
                </div>

                {/* FREE TRACK */}
                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> FREE TRACK</span>
                    {isFreeClaimed && <span className="text-emerald-400 font-bold flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> CLAIMED</span>}
                  </div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span aria-hidden>{tier.freeReward.icon}</span>
                    <span className="truncate">{tier.freeReward.title}</span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">{tier.freeReward.category}</div>
                  <button
                    type="button"
                    onClick={() => handleClaimFree(tier)}
                    disabled={!isUnlocked || isFreeClaimed}
                    className={`w-full py-1 mt-1 rounded text-[10px] font-bold transition-colors ${isFreeClaimed ? 'bg-slate-800 text-slate-500 cursor-default' : isUnlocked ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
                  >
                    {isFreeClaimed ? 'Claimed' : isUnlocked ? 'Claim Free' : `Reach Lvl ${tier.tier}`}
                  </button>
                </div>

                {/* ELITE TRACK */}
                <div className={`p-2.5 rounded-xl border space-y-1 ${hasElite ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-900/40 border-slate-800'}`}>
                  <div className="flex justify-between text-[10px] font-mono text-amber-400 font-bold">
                    <span className="flex items-center gap-1"><Crown className="w-3 h-3" /> ELITE TRACK</span>
                    {isEliteClaimed && <span className="text-emerald-400 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> CLAIMED</span>}
                  </div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span aria-hidden>{tier.eliteReward.icon}</span>
                    <span className="truncate">{tier.eliteReward.title}</span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">{tier.eliteReward.category}</div>
                  <button
                    type="button"
                    onClick={() => handleClaimElite(tier)}
                    disabled={!isUnlocked || isEliteClaimed || !hasElite}
                    className={`w-full py-1 mt-1 rounded text-[10px] font-bold transition-colors ${isEliteClaimed ? 'bg-slate-800 text-slate-500 cursor-default' : isUnlocked && hasElite ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
                  >
                    {isEliteClaimed
                      ? 'Claimed'
                      : !hasElite
                        ? <span className="flex items-center justify-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Requires Elite Pass</span>
                        : isUnlocked ? 'Claim Elite' : `Reach Lvl ${tier.tier}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default SeasonPass;
