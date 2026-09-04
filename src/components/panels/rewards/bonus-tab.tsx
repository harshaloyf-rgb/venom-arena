'use client';

// BonusTab — free-rewards extras that used to live inside the Ad-Free panel
// (moved 2026-09-05: they are rewards, not store items).
//
// Card 1 "Promotional Codes": redeem a code for bonus chips via
//   POST /api/player/promo-reward (server-validated, idempotent per user).
//   Note: codes are distributed through official channels only — they are
//   deliberately NOT printed in the UI anymore.
// Card 2 "Daily Reward Ads": user-initiated rewarded videos credited
//   server-side via Google SSV. ONLY rendered when rewarded ads are genuinely
//   available (native app + NEXT_PUBLIC_ADMOB_ENABLED). The old fake
//   "sponsor" button (no ad SDK, instant credit) was a Play policy violation.
//   USER-INITIATED ONLY — ads never auto-pop anywhere (locked spec).

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { rewardedAdsAvailable, showRewardedAd } from '@/lib/ads';
import { notify, type ToastFn } from '../_panel-primitives';
import { Gift, Loader2, Video } from 'lucide-react';

interface BonusTabProps {
  onToast?: ToastFn;
}

export function BonusTab({ onToast }: BonusTabProps) {
  const { refresh } = useAuth();
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  // Ad status is server truth (GET /api/ads/session) — count, cap and reward
  // size come from the same authority that verifies and credits.
  const [adStatus, setAdStatus] = useState<{ adsToday: number; dailyCap: number; rewardPerAd: number; remaining: number } | null>(null);

  useEffect(() => {
    // Ad card only appears when rewarded ads are genuinely available
    // (native app + NEXT_PUBLIC_ADMOB_ENABLED flag).
    if (!rewardedAdsAvailable()) return;
    let cancelled = false;
    fetch('/api/ads/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { adsToday?: number; dailyCap?: number; rewardPerAd?: number; remaining?: number } | null) => {
        if (cancelled || !d) return;
        setAdStatus({
          adsToday: d.adsToday ?? 0,
          dailyCap: d.dailyCap ?? 12,
          rewardPerAd: d.rewardPerAd ?? 50,
          remaining: d.remaining ?? 0,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoBusy(true);
    try {
      const res = await fetch('/api/player/promo-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; reward?: number; newBankedChips?: number };
      if (!res.ok) {
        notify(data?.error || 'Invalid or expired promo code.', 'error', onToast);
        return;
      }
      notify(`Promo Code redeemed: +${data.reward?.toLocaleString('en-IN')} CHIPS credited!`, 'success', onToast);
      setPromoCode('');
      void refresh();
    } catch {
      notify('Network error redeeming promo code.', 'error', onToast);
    } finally {
      setPromoBusy(false);
    }
  }

  async function handleWatchAd() {
    if (!adStatus || adStatus.remaining <= 0) {
      notify('Daily Ad Limit Reached! Resets at 00:00 UTC.', 'error', onToast);
      return;
    }
    setAdBusy(true);
    try {
      // 1. Server issues a one-time nonce bound to this player.
      const sessionRes = await fetch('/api/ads/session', { method: 'POST' });
      const sessionData = (await sessionRes.json().catch(() => ({}))) as { error?: string; nonce?: string };
      if (!sessionRes.ok || !sessionData.nonce) {
        notify(sessionData.error || 'Could not start an ad session.', 'error', onToast);
        return;
      }
      // 2. Real rewarded ad. The nonce rides along as the SSV custom_data.
      const result = await showRewardedAd(sessionData.nonce);
      if (result !== 'earned') {
        if (result === 'dismissed') notify('Ad closed before completion — no reward.', 'info', onToast);
        else notify('Ad failed to load. Please try again later.', 'error', onToast);
        return;
      }
      // 3. Google now calls OUR server (/api/ads/ssv) with a signed callback.
      //    Poll for the credit — the client can never mint chips itself.
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise((r) => setTimeout(r, 2500));
        const poll = await fetch(`/api/ads/session?nonce=${encodeURIComponent(sessionData.nonce)}`);
        const pollData = (await poll.json().catch(() => ({}))) as { credited?: boolean; reward?: number; adsToday?: number; dailyCap?: number };
        if (poll.ok && pollData.credited) {
          notify(`+${pollData.reward ?? adStatus.rewardPerAd} FREE CHIPS credited from the ad! (${pollData.adsToday ?? adStatus.adsToday + 1}/${pollData.dailyCap ?? adStatus.dailyCap} today)`, 'success', onToast);
          setAdStatus({ ...adStatus, adsToday: pollData.adsToday ?? adStatus.adsToday + 1, remaining: Math.max(0, adStatus.remaining - 1) });
          void refresh();
          return;
        }
      }
      notify('Ad verified — your chips will appear in your wallet within a minute.', 'info', onToast);
    } catch {
      notify('Network error during the ad reward.', 'error', onToast);
    } finally {
      setAdBusy(false);
    }
  }

  return (
    <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Promo codes — codes are never printed here; distribute via official channels */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <Gift className="w-4 h-4 text-amber-400" /> Promotional Codes
        </h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Got a promo code from an official Venom Arena event or creator? Redeem it here for
          instant bonus chips. Codes are limited-time — follow our official channels for drops.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter Code"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500/50"
          />
          <button
            type="button"
            onClick={handlePromo}
            disabled={promoBusy || !promoCode.trim()}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50"
          >
            {promoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Redeem'}
          </button>
        </div>
      </div>

      {/* Reward ads — USER-INITIATED ONLY, native app only (Play policy safe) */}
      {adStatus && (
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
            <Video className="w-4 h-4 text-indigo-400" /> Daily Reward Ads ({adStatus.dailyCap} Max / Day)
          </h3>
          <p className="text-[11px] text-slate-400 mb-3">
            Each completed rewarded video awards {adStatus.rewardPerAd} chips directly to your wallet
            (Max {adStatus.dailyCap * adStatus.rewardPerAd} free chips per day). Credits are verified
            server-side via Google and post shortly after the ad finishes. Resets at 00:00 UTC.
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-500">
              Today: {adStatus.adsToday}/{adStatus.dailyCap} ads · {adStatus.remaining} remaining
            </span>
            <button
              type="button"
              onClick={handleWatchAd}
              disabled={adBusy || adStatus.remaining <= 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {adBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
              {adBusy ? 'Verifying ad reward...' : adStatus.remaining <= 0 ? 'Daily Limit Reached' : `Watch Ad (+${adStatus.rewardPerAd} Chips)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
