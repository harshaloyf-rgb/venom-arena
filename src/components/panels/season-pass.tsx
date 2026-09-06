'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  PASS_FREE_COSMETICS,
  PASS_ELITE_COSMETICS,
  PASS_TIER_XP,
  PASS_FREE_CHIP_REWARDS,
  PASS_ELITE_CHIP_REWARDS,
  PASS_SEASON_NAME,
  PASS_SEASON_NUMBER,
  PASS_DAILY_XP_CAP,
  ELITE_PASS_COST,
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
  const [claimingAll, setClaimingAll] = useState(false);

  const hasElite = player?.hasElitePass ?? false;
  const passXp = player?.passXp ?? 0;
  const bankedChips = player?.bankedChips ?? 0;

  // Daily cap is stored per UTC day (passXpDate). If the stored day is NOT
  // today, the counter is stale — the player hasn't earned Pass XP today, so
  // treat it as 0 instead of showing a false "Daily Cap Reached" until their
  // next match resets the field server-side.
  const utcTodayStr = new Date().toISOString().slice(0, 10);
  const passXpToday = player?.passXpDate === utcTodayStr ? (player?.passXpToday ?? 0) : 0;

  // Current pass tier from passXp
  const currentTier = useMemo(() => {
    for (let i = PASS_TIER_XP.length - 1; i >= 0; i--) {
      if (passXp >= PASS_TIER_XP[i]) return i + 1;
    }
    return 0;
  }, [passXp]);

  // XP progress toward next tier
  const currentTierXp = currentTier > 0 ? PASS_TIER_XP[currentTier - 1] : 0;
  const nextTierXp = currentTier < 20 ? PASS_TIER_XP[currentTier] : PASS_TIER_XP[19];
  const xpInThisTier = passXp - currentTierXp;
  const xpNeeded = nextTierXp - currentTierXp;
  const xpPct = currentTier >= 20 ? 100 : xpNeeded > 0 ? Math.min(100, Math.round((xpInThisTier / xpNeeded) * 100)) : 0;

  // Daily cap remaining
  const dailyRemaining = Math.max(0, PASS_DAILY_XP_CAP - passXpToday);
  const dailyPct = Math.min(100, Math.round((passXpToday / PASS_DAILY_XP_CAP) * 100));
  const isCapped = dailyRemaining <= 0;

  const claimedFreeSet = useMemo(() => new Set(player?.passClaimedFree ?? []), [player?.passClaimedFree]);
  const claimedEliteSet = useMemo(() => new Set(player?.passClaimedElite ?? []), [player?.passClaimedElite]);

  // Count unclaimed rewards (cosmetic OR chip)
  const unclaimedFree = useMemo(() => {
    let c = 0;
    for (let i = 0; i < 20; i++) {
      const tier = i + 1;
      if (passXp >= PASS_TIER_XP[i] && !claimedFreeSet.has(tier) && (PASS_FREE_COSMETICS[i] || PASS_FREE_CHIP_REWARDS[i] > 0)) c++;
    }
    return c;
  }, [passXp, claimedFreeSet]);

  const unclaimedElite = useMemo(() => {
    if (!hasElite) return 0;
    let c = 0;
    for (let i = 0; i < 20; i++) {
      const tier = i + 1;
      if (passXp >= PASS_TIER_XP[i] && !claimedEliteSet.has(tier) && (PASS_ELITE_COSMETICS[i] || PASS_ELITE_CHIP_REWARDS[i] > 0)) c++;
    }
    return c;
  }, [passXp, hasElite, claimedEliteSet]);

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
      const data = await res.json().catch(() => ({})) as { error?: string; cosmetic?: { id: string; name: string; type: string; emoji?: string }; chipReward?: number };
      if (!res.ok) {
        notify(data?.error || 'Failed to claim.', 'error', onToast);
        return;
      }
      const cosmetic = data.cosmetic;
      const chips = data.chipReward ?? 0;
      const parts: string[] = [];
      if (cosmetic) parts.push(`${cosmetic.emoji ?? ''} ${cosmetic.name}`);
      if (chips > 0) parts.push(`+${chips.toLocaleString()}c`);
      notify(`Claimed: ${parts.join(' + ')} — ${cosmetic ? 'equip it in Shop & Lab!' : 'chips banked!'}`, 'success', onToast);
      void refresh();
    } catch {
      notify('Network error. Try again.', 'error', onToast);
    } finally {
      setClaiming(null);
    }
  }

  async function handleClaimAll(track: 'free' | 'elite') {
    if (claimingAll) return;
    setClaimingAll(true);
    try {
      const res = await fetch('/api/season-pass/claim-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; claimed?: number[]; chipsClaimed?: number };
      if (!res.ok) {
        notify(data?.error || 'Failed to claim.', 'error', onToast);
        return;
      }
      const count = Array.isArray(data.claimed) ? data.claimed.length : 0;
      const chips = data.chipsClaimed ?? 0;
      const chipNote = chips > 0 ? ` (+${chips.toLocaleString()}c)` : '';
      notify(`Claimed ${count} reward${count !== 1 ? 's' : ''}${chipNote} — check Shop & Lab!`, 'success', onToast);
      void refresh();
    } catch {
      notify('Network error. Try again.', 'error', onToast);
    } finally {
      setClaimingAll(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 sm:p-6 shadow-md space-y-6 relative overflow-hidden lg:p-1.5 lg:space-y-0.5">
      <GlowBlob color="bg-purple-500/10" className="-top-12 -right-12 w-64 h-64" />

      {/* SEASON BANNER */}
      <section
        aria-label="Season banner"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950 via-slate-900 to-emerald-950 p-5 sm:p-6 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md lg:p-1.5 lg:gap-1 lg:rounded-lg lg:leading-tight"
      >
        <div className="space-y-2 min-w-0 lg:flex lg:flex-row lg:items-center lg:gap-2 lg:space-y-0 lg:leading-tight">
          <div className="flex items-center gap-2 flex-wrap lg:gap-0.5">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-widest lg:text-[11px]">
              Season {PASS_SEASON_NUMBER} · {PASS_SEASON_NAME}
            </span>
            <span className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
              <Trophy className="w-3 h-3 lg:w-3 lg:h-3" /> {currentTier}/20 Tiers
            </span>
            <span className="text-[11px] text-slate-400 font-mono lg:text-[11px]">
              {isCapped ? 'Daily Cap Reached' : `${dailyRemaining.toLocaleString()} XP left today`}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 lg:text-[11px] lg:leading-tight">
            <Award className="w-6 h-6 text-amber-400 lg:w-3 lg:h-3" />
            Cyber Pass
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed lg:text-[11px] lg:leading-tight">
            Play matches to earn Pass XP. Unlock cosmetics and chip rewards at each tier. {isCapped ? 'Daily cap reached — come back tomorrow!' : `Earn 50% of match XP as Pass XP (max ${PASS_DAILY_XP_CAP.toLocaleString()}/day).`}
          </p>
        </div>

        {/* Elite pass card */}
        <div className="bg-slate-950/90 p-4 rounded-xl border border-amber-500/40 space-y-2 shrink-0 min-w-[240px] w-full md:w-auto lg:p-1 lg:min-w-0 lg:space-y-0.5">
          <div className="flex justify-between items-center text-xs lg:text-[11px]">
            <span className="text-slate-300 font-bold flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-400 lg:w-3 lg:h-3" /> Pass Status
            </span>
            <span className={`font-mono font-bold text-[11px] ${hasElite ? 'text-amber-400' : 'text-slate-500'}`}>
              {hasElite ? '\u{1F451} ELITE ACTIVE' : 'FREE PASS'}
            </span>
          </div>
          {!hasElite && (
            <>
              <button
                type="button"
                onClick={handleUnlockElite}
                disabled={unlocking || bankedChips < ELITE_PASS_COST}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed lg:py-0.5"
              >
                {unlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                {unlocking ? 'Unlocking...' : `Unlock Elite (${ELITE_PASS_COST.toLocaleString('en-IN')}c)`}
              </button>
              {bankedChips < ELITE_PASS_COST && (
                <div className="text-[10px] text-rose-400 font-mono text-center">
                  Need {(ELITE_PASS_COST - bankedChips).toLocaleString('en-IN')} more banked chips
                </div>
              )}
            </>
          )}
          {hasElite && (
            <div className="text-[11px] text-emerald-400 font-mono text-center pt-1">
              Premium rewards unlocked — claim them below
            </div>
          )}
        </div>
      </section>

      {/* PASS XP BAR */}
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 lg:p-0.5 lg:space-y-0 lg:rounded-lg">
        <div className="flex justify-between items-center text-xs lg:text-[11px] lg:leading-tight">
          <span className="text-white font-bold flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-pink-400 lg:w-3 lg:h-3" /> Tier {currentTier}{currentTier < 20 ? ` → ${currentTier + 1}` : ''}
          </span>
          <span className="text-slate-400 font-mono lg:text-[11px]">
            {currentTier >= 20 ? 'MAX' : `${passXp.toLocaleString()} / ${nextTierXp.toLocaleString()} XP`}
          </span>
        </div>
        <div className="w-full h-3 bg-slate-900 rounded-full border border-slate-800 overflow-hidden lg:h-1.5">
          <div
            className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-slate-500 lg:text-[11px] lg:leading-tight">
          <span>{currentTier >= 20 ? 'All tiers unlocked!' : `${PASS_TIER_XP[currentTier].toLocaleString()} XP to next tier`}</span>
          <span className={isCapped ? 'text-red-400' : 'text-slate-500'}>
            Today: {passXpToday.toLocaleString()}/{PASS_DAILY_XP_CAP.toLocaleString()}{isCapped ? ' (capped)' : ''}
          </span>
        </div>
        {/* Daily cap mini-bar */}
        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden lg:h-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isCapped ? 'bg-red-500' : 'bg-cyan-500'}`}
            style={{ width: `${dailyPct}%` }}
          />
        </div>
      </section>

      {/* UNCLAIMED NOTIFICATION */}
      {(unclaimedFree > 0 || unclaimedElite > 0) && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 lg:p-1 lg:gap-1 lg:rounded-lg">
          <span className="text-xs text-emerald-300 font-bold lg:text-[11px] lg:leading-tight">
            {unclaimedFree > 0 && `${unclaimedFree} free reward${unclaimedFree > 1 ? 's' : ''} available!`}
            {unclaimedFree > 0 && unclaimedElite > 0 && ' \u00B7 '}
            {unclaimedElite > 0 && `${unclaimedElite} elite reward${unclaimedElite > 1 ? 's' : ''} available!`}
          </span>
          <div className="flex gap-2 lg:gap-1">
            {unclaimedFree > 0 && (
              <button
                type="button"
                onClick={() => void handleClaimAll('free')}
                disabled={claimingAll}
                className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition inline-flex items-center gap-1"
              >
                {claimingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Claim All Free
              </button>
            )}
            {unclaimedElite > 0 && (
              <button
                type="button"
                onClick={() => void handleClaimAll('elite')}
                disabled={claimingAll}
                className="text-[11px] font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-3 py-1 rounded-lg transition inline-flex items-center gap-1"
              >
                {claimingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Claim All Elite
              </button>
            )}
          </div>
        </div>
      )}

      {/* REWARD TIERS GRID */}
      <section aria-label="Reward tiers">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2 lg:mb-1 lg:leading-tight">
          <Trophy className="w-4 h-4 text-amber-400 lg:w-3 lg:h-3" /> Reward Track (20 Tiers)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto va-scroll pr-1 lg:grid-cols-[96px_1fr_1fr] lg:gap-x-1 lg:gap-y-px lg:max-h-none lg:overflow-visible lg:pr-0 lg:leading-tight">
          {PASS_FREE_COSMETICS.map((_freeCosmetic, i) => {
            const tier = i + 1;
            const freeCosmetic = PASS_FREE_COSMETICS[i];
            const eliteCosmetic = PASS_ELITE_COSMETICS[i];
            const requiredXp = PASS_TIER_XP[i];
            const freeChips = PASS_FREE_CHIP_REWARDS[i];
            const eliteChips = PASS_ELITE_CHIP_REWARDS[i];
            const isUnlocked = passXp >= requiredXp;
            const isFreeClaimed = claimedFreeSet.has(tier);
            const isEliteClaimed = claimedEliteSet.has(tier);
            const isClaimingThis = claiming === tier;

            return (
              <div
                key={tier}
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-3 transition-all lg:contents lg:p-0 lg:gap-0 lg:border-0 lg:rounded-none lg:bg-transparent lg:shadow-none lg:opacity-100 ${
                  isUnlocked
                    ? 'bg-slate-950 border-slate-700 shadow-md'
                    : 'bg-slate-950/60 border-slate-900 opacity-70'
                }`}
              >
                {/* TIER HEADER */}
                <div className="flex justify-between items-center border-b border-slate-900 pb-2 lg:flex lg:items-center lg:justify-between lg:px-1 lg:border-b-0 lg:pb-0 lg:bg-slate-900/40 lg:rounded">
                  <span className="text-xs font-mono font-bold text-amber-400 lg:text-[11px] lg:leading-tight">TIER {tier}</span>
                  <span className="text-[11px] text-slate-500 font-mono lg:text-[11px] lg:leading-tight">
                    {isUnlocked ? '✓' : `${requiredXp.toLocaleString()} XP`}
                  </span>
                </div>

                {/* FREE TRACK */}
                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1 lg:p-0 lg:bg-transparent lg:border-0 lg:rounded-none lg:space-y-0 lg:flex lg:flex-row lg:items-center lg:gap-1 lg:px-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 lg:flex lg:items-center lg:gap-0.5">
                    <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> FREE</span>
                    {isFreeClaimed && <span className="text-emerald-400 font-bold flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> OWNED</span>}
                  </div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 lg:text-[11px] lg:leading-tight">
                    <span aria-hidden>{freeCosmetic?.emoji ?? '💰'}</span>
                    <span>{freeCosmetic?.name ?? (freeChips > 0 ? `${freeChips.toLocaleString()} Chips` : '—')}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 lg:inline lg:text-[11px]">
                    {freeCosmetic && freeChips > 0 ? `skin + ${freeChips.toLocaleString()}c bonus` : freeChips > 0 ? 'chips' : freeCosmetic?.type ?? ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClaim(tier, 'free')}
                    disabled={!isUnlocked || isFreeClaimed || isClaimingThis}
                    className={`w-full py-1 mt-1 rounded text-[11px] font-bold transition-colors lg:py-0 lg:px-1.5 lg:mt-0 lg:w-auto lg:shrink-0 lg:text-[11px] ${
                      isFreeClaimed
                        ? 'bg-slate-800 text-slate-500 cursor-default'
                        : isUnlocked
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {isClaimingThis && !isFreeClaimed ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : isFreeClaimed ? 'Owned' : isUnlocked ? 'Claim' : `Need ${requiredXp.toLocaleString()} XP`}
                  </button>
                </div>

                {/* ELITE TRACK */}
                <div className={`p-2.5 rounded-xl border space-y-1 ${hasElite ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-900/40 border-slate-800'} lg:p-0 lg:bg-transparent lg:border-0 lg:rounded-none lg:space-y-0 lg:flex lg:flex-row lg:items-center lg:gap-1 lg:px-1`}>
                  <div className="flex justify-between text-[11px] font-mono text-amber-400 font-bold lg:flex lg:items-center lg:gap-0.5">
                    <span className="flex items-center gap-1"><Crown className="w-3 h-3 lg:w-3 lg:h-3" /> ELITE</span>
                    {isEliteClaimed && <span className="text-emerald-400 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> OWNED</span>}
                  </div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 lg:text-[11px] lg:leading-tight">
                    <span aria-hidden>{eliteCosmetic?.emoji ?? '💰'}</span>
                    <span>{eliteCosmetic?.name ?? (eliteChips > 0 ? `${eliteChips.toLocaleString()} Chips` : '—')}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 lg:inline lg:text-[11px]">
                    {eliteCosmetic && eliteChips > 0 ? `skin + ${eliteChips.toLocaleString()}c bonus` : eliteChips > 0 ? 'chips' : eliteCosmetic?.type ?? ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClaim(tier, 'elite')}
                    disabled={!isUnlocked || isEliteClaimed || !hasElite || isClaimingThis}
                    className={`w-full py-1 mt-1 rounded text-[11px] font-bold transition-colors lg:py-0 lg:px-1.5 lg:mt-0 lg:w-auto lg:shrink-0 lg:text-[11px] ${
                      isEliteClaimed
                        ? 'bg-slate-800 text-slate-500 cursor-default'
                        : isUnlocked && hasElite
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {isClaimingThis && !isEliteClaimed && hasElite ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : isEliteClaimed ? 'Owned' : !hasElite ? <span className="flex items-center justify-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Elite Required</span> : isUnlocked ? 'Claim' : `Need ${requiredXp.toLocaleString()} XP`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER INFO */}
      <div className="text-center text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-800/60 lg:pt-0 lg:space-y-0 lg:leading-tight">
        <p className="font-mono uppercase tracking-widest text-[10px] text-slate-600">How Pass XP works</p>
        <p>Match XP = (score × 5 + kills × 50) × arena reward multiplier — you earn it whether you extract or die.</p>
        <p>50% of match XP becomes Pass XP (max {PASS_DAILY_XP_CAP.toLocaleString()}/day, resets at midnight UTC). Daily challenge claims add +25 Pass XP each (same daily cap).</p>
        <p>Unlock tiers and claim cosmetics + chip rewards. Claimed cosmetics are added to your inventory and can be equipped in <strong className="text-slate-400">Shop &amp; Lab</strong>.</p>
      </div>
    </div>
  );
}

export default SeasonPass;
