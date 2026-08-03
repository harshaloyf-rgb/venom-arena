'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  PASS_FREE_COSMETICS,
  PASS_ELITE_COSMETICS,
  PASS_TIER_LEVEL,
  PASS_SEASON_NAME,
  ELITE_PASS_COST,
  xpForLevel,
} from '@/lib/game-config';
import {
  GlowBlob,
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
  Loader2,
} from 'lucide-react';

interface SeasonPassProps {
  onToast?: ToastFn;
}

export function SeasonPass({ onToast }: SeasonPassProps) {
  const { player, refresh } = useAuth();
  const [unlocking, setUnlocking] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);

  const hasElite = player?.hasElitePass ?? false;
  const currentLevel = player?.level ?? 1;
  const currentXp = player?.xp ?? 0;
  const bankedChips = player?.bankedChips ?? 0;

  // Real XP progress toward next level
  const thisLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const xpInThisLevel = currentXp - thisLevelXp;
  const xpNeeded = nextLevelXp - thisLevelXp;
  const xpPct = xpNeeded > 0 ? Math.min(100, Math.round((xpInThisLevel / xpNeeded) * 100)) : 100;

  // How many tiers are unlocked based on real player level
  const unlockedTiers = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 20; i++) {
      if (currentLevel >= PASS_TIER_LEVEL[i]) count = i + 1;
      else break;
    }
    return count;
  }, [currentLevel]);

  const claimedFreeSet = useMemo(() => new Set(player?.passClaimedFree ?? []), [player?.passClaimedFree]);
  const claimedEliteSet = useMemo(() => new Set(player?.passClaimedElite ?? []), [player?.passClaimedElite]);

  // Count unclaimed rewards
  const unclaimedFree = useMemo(() => {
    let c = 0;
    for (let i = 0; i < 20; i++) {
      const tier = i + 1;
      if (currentLevel >= PASS_TIER_LEVEL[i] && !claimedFreeSet.has(tier)) c++;
    }
    return c;
  }, [currentLevel, claimedFreeSet]);

  const unclaimedElite = useMemo(() => {
    if (!hasElite) return 0;
    let c = 0;
    for (let i = 0; i < 20; i++) {
      const tier = i + 1;
      if (currentLevel >= PASS_TIER_LEVEL[i] && !claimedEliteSet.has(tier)) c++;
    }
    return c;
  }, [currentLevel, hasElite, claimedEliteSet]);

  if (!player) return <NotSignedIn />;

  async function handleUnlockElite() {
    if (hasElite) return;
    setUnlocking(true);
    try {
      const res = await fetch('/api/season-pass/unlock-elite', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        notify(data?.error || 'Failed to unlock.', 'error', onToast);
        return;
      }
      notify('Elite Cyber Pass UNLOCKED! Claim your premium rewards now. \u{1F451}', 'success', onToast);
      void refresh();
    } catch {
      notify('Network error. Try again.', 'error', onToast);
    } finally {
      setUnlocking(false);
    }
  }

  async function handleClaim(tier: number, track: 'free' | 'elite') {
    setClaiming(tier);
    try {
      const res = await fetch('/api/season-pass/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, track }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; cosmetic?: { id: string; name: string; type: string; emoji?: string } };
      if (!res.ok) {
        notify(data?.error || 'Failed to claim.', 'error', onToast);
        return;
      }
      const cosmetic = data.cosmetic;
      const label = `${cosmetic?.emoji ?? ''} ${cosmetic?.name ?? 'Reward'}`;
      notify(`Claimed: ${label} — now in your Shop!`, 'success', onToast);
      void refresh();
    } catch {
      notify('Network error. Try again.', 'error', onToast);
    } finally {
      setClaiming(null);
    }
  }

  function handleClaimAll(track: 'free' | 'elite') {
    const tiers = track === 'free'
      ? Array.from({ length: 20 }, (_, i) => i + 1).filter(t => currentLevel >= PASS_TIER_LEVEL[t - 1] && !claimedFreeSet.has(t))
      : Array.from({ length: 20 }, (_, i) => i + 1).filter(t => currentLevel >= PASS_TIER_LEVEL[t - 1] && !claimedEliteSet.has(t));
    // Claim sequentially
    (async () => {
      for (const t of tiers) {
        await handleClaim(t, track);
        await new Promise(r => setTimeout(r, 300)); // small delay between claims
      }
    })();
  }

  // Current tier = highest unlocked tier
  const currentTier = unlockedTiers;

  // Find what level the next tier needs
  const nextTierLevel = currentTier < 20 ? PASS_TIER_LEVEL[currentTier] : null;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 sm:p-6 shadow-md space-y-6 relative overflow-hidden">
      <GlowBlob color="bg-purple-500/10" className="-top-12 -right-12 w-64 h-64" />

      {/* SEASON BANNER */}
      <section
        aria-label="Season banner"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950 via-slate-900 to-emerald-950 p-5 sm:p-6 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md"
      >
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-widest">
              Season {PASS_SEASON_NAME}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
              <Trophy className="w-3 h-3" /> {unlockedTiers}/20 Tiers Unlocked
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" />
            Cyber Pass
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Play matches to earn XP and level up. Each level milestone unlocks a real cosmetic reward —
            skins, trails, death effects, flags, and banners. Claimed rewards appear in your Shop &amp; Lab.
          </p>
        </div>

        {/* Elite pass card */}
        <div className="bg-slate-950/90 p-4 rounded-xl border border-amber-500/40 space-y-2 shrink-0 min-w-[240px] w-full md:w-auto">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-400" /> Pass Status
            </span>
            <span className={`font-mono font-bold text-[10px] ${hasElite ? 'text-amber-400' : 'text-slate-500'}`}>
              {hasElite ? '\u{1F451} ELITE ACTIVE' : 'FREE PASS'}
            </span>
          </div>
          {!hasElite && (
            <button
              type="button"
              onClick={handleUnlockElite}
              disabled={unlocking || bankedChips < ELITE_PASS_COST}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {unlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
              {unlocking ? 'Unlocking...' : `Unlock Elite (${ELITE_PASS_COST.toLocaleString('en-IN')}c)`}
            </button>
          )}
          {hasElite && (
            <div className="text-[10px] text-emerald-400 font-mono text-center pt-1">
              Premium rewards unlocked — claim them below
            </div>
          )}
        </div>
      </section>

      {/* REAL XP BAR */}
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-white font-bold flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-emerald-400" /> Player Level {currentLevel}
          </span>
          <span className="text-slate-400 font-mono">
            {xpInThisLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
          </span>
        </div>
        <div className="w-full h-3 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>Tier {currentTier}/20 unlocked &middot; {nextTierLevel ? `Next tier at Level ${nextTierLevel}` : 'All tiers unlocked!'}</span>
          <span>Banked: {bankedChips.toLocaleString()}c</span>
        </div>
      </section>

      {/* UNCLAIMED NOTIFICATION */}
      {(unclaimedFree > 0 || unclaimedElite > 0) && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-xs text-emerald-300 font-bold">
            {unclaimedFree > 0 && `${unclaimedFree} free reward${unclaimedFree > 1 ? 's' : ''} available!`}
            {unclaimedFree > 0 && unclaimedElite > 0 && ' \u00B7 '}
            {unclaimedElite > 0 && `${unclaimedElite} elite reward${unclaimedElite > 1 ? 's' : ''} available!`}
          </span>
          <div className="flex gap-2">
            {unclaimedFree > 0 && (
              <button
                type="button"
                onClick={() => handleClaimAll('free')}
                className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg transition"
              >
                Claim All Free
              </button>
            )}
            {unclaimedElite > 0 && (
              <button
                type="button"
                onClick={() => handleClaimAll('elite')}
                className="text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg transition"
              >
                Claim All Elite
              </button>
            )}
          </div>
        </div>
      )}

      {/* REWARD TIERS GRID */}
      <section aria-label="Reward tiers">
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Reward Track (20 Tiers)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 max-h-[600px] overflow-y-auto va-scroll pr-1">
          {PASS_FREE_COSMETICS.map((freeCosmetic, i) => {
            const tier = i + 1;
            const eliteCosmetic = PASS_ELITE_COSMETICS[i];
            const requiredLevel = PASS_TIER_LEVEL[i];
            const isUnlocked = currentLevel >= requiredLevel;
            const isFreeClaimed = claimedFreeSet.has(tier);
            const isEliteClaimed = claimedEliteSet.has(tier);
            const isClaimingThis = claiming === tier;

            return (
              <div
                key={tier}
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                  isUnlocked
                    ? 'bg-slate-950 border-slate-700 shadow-md'
                    : 'bg-slate-950/60 border-slate-900 opacity-70'
                }`}
              >
                {/* TIER HEADER */}
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <span className="text-xs font-mono font-bold text-amber-400">TIER {tier}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {isUnlocked ? '✓' : `Lv ${requiredLevel}`}
                  </span>
                </div>

                {/* FREE TRACK */}
                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> FREE</span>
                    {isFreeClaimed && <span className="text-emerald-400 font-bold flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> OWNED</span>}
                  </div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span aria-hidden>{freeCosmetic.emoji}</span>
                    <span className="truncate">{freeCosmetic.name}</span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">{freeCosmetic.type}</div>
                  <button
                    type="button"
                    onClick={() => handleClaim(tier, 'free')}
                    disabled={!isUnlocked || isFreeClaimed || isClaimingThis}
                    className={`w-full py-1 mt-1 rounded text-[10px] font-bold transition-colors ${
                      isFreeClaimed
                        ? 'bg-slate-800 text-slate-500 cursor-default'
                        : isUnlocked
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {isClaimingThis && !isFreeClaimed ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : isFreeClaimed ? 'Owned' : isUnlocked ? 'Claim' : `Reach Lv ${requiredLevel}`}
                  </button>
                </div>

                {/* ELITE TRACK */}
                <div className={`p-2.5 rounded-xl border space-y-1 ${hasElite ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-900/40 border-slate-800'}`}>
                  <div className="flex justify-between text-[10px] font-mono text-amber-400 font-bold">
                    <span className="flex items-center gap-1"><Crown className="w-3 h-3" /> ELITE</span>
                    {isEliteClaimed && <span className="text-emerald-400 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> OWNED</span>}
                  </div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span aria-hidden>{eliteCosmetic.emoji}</span>
                    <span className="truncate">{eliteCosmetic.name}</span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">{eliteCosmetic.type}</div>
                  <button
                    type="button"
                    onClick={() => handleClaim(tier, 'elite')}
                    disabled={!isUnlocked || isEliteClaimed || !hasElite || isClaimingThis}
                    className={`w-full py-1 mt-1 rounded text-[10px] font-bold transition-colors ${
                      isEliteClaimed
                        ? 'bg-slate-800 text-slate-500 cursor-default'
                        : isUnlocked && hasElite
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {isClaimingThis && !isEliteClaimed && hasElite ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : isEliteClaimed ? 'Owned' : !hasElite ? <span className="flex items-center justify-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Elite Required</span> : isUnlocked ? 'Claim' : `Reach Lv ${requiredLevel}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER INFO */}
      <div className="text-center text-[10px] text-slate-500 space-y-1 pt-2 border-t border-slate-800/60">
        <p>Play matches and complete daily challenges to earn XP. Level up to unlock tiers and claim real cosmetics.</p>
        <p>Claimed rewards are added to your inventory and can be equipped in <strong className="text-slate-400">Shop &amp; Lab</strong>.</p>
      </div>
    </div>
  );
}

export default SeasonPass;
