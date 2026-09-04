'use client';

// Vault — Venom Arena's monetization hub (locked spec 2026-09-04).
//
// Tab 1 "Ad-Free Passes": the Global USD One-Time Pass Matrix. Buying a pass
//   grants the ad-free entitlement (stacking time) + bundled Virtual Tickets
//   upfront. Real-money IAP via Google Play / App Store, verified server-side.
// Tab 2 "Earn Chips": user-initiated rewarded ads (watch-ad-for-chips) + promo
//   codes. User-initiated only — ads never auto-pop anywhere.
// Tab 3 "Chip Packs" (dormant): the old real-money chip store, hidden unless
//   NEXT_PUBLIC_STORE_CHIPS=true. Server routes reject pack purchases without
//   the flag — the UI and the API are gated together.

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CHIP_PACKS,
  type ChipPack,
  chipsStoreEnabled,
} from '@/lib/game-config';
import { allStoreProducts } from '@/lib/store-catalog';
import { isNativeApp, nativeBillingAvailable, purchaseAndVerify, purchasePassAndVerify, IapError } from '@/lib/iap';
import { rewardedAdsAvailable, showRewardedAd } from '@/lib/ads';
import { PASS_PLANS, PASS_LEGAL_TEXT, formatUsd } from '@/lib/pass-catalog';
import {
  GlowBlob,
  MicroLabel,
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Landmark,
  Coins,
  Loader2,
  Sparkles,
  Info,
  ShieldAlert,
  CreditCard,
  Lock,
  Gift,
  Video,
  Smartphone,
  ShieldCheck,
  Ticket,
  Crown,
  Check,
} from 'lucide-react';

interface ChipStoreProps {
  onToast?: ToastFn;
}

type VaultTab = 'passes' | 'earn' | 'packs';

// packId -> store product id (server keeps the authoritative chips mapping)
const PRODUCT_ID_BY_PACK = new Map(allStoreProducts().map((p) => [p.packId, p.productId]));
const SHOW_CHIP_PACKS = chipsStoreEnabled(); // dormant by default (locked spec)

export function ChipStore({ onToast }: ChipStoreProps) {
  const { player, loading, refresh } = useAuth();
  const [tab, setTab] = useState<VaultTab>('passes');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  // Yearly buy cap is server truth now (GET /api/store/verify) — the old
  // localStorage counter was trivially bypassable and lied after reinstalls.
  const [yearlyPurchased, setYearlyPurchased] = useState<number | null>(null);
  const [storeLocked, setStoreLocked] = useState(false);
  // Ad status is ALSO server truth (GET /api/ads/session) — count, cap and
  // reward size come from the same authority that verifies and credits.
  const [adStatus, setAdStatus] = useState<{ adsToday: number; dailyCap: number; rewardPerAd: number; remaining: number } | null>(null);
  // Time Pass status (GET /api/store/verify-pass) — server truth for the
  // ad-free expiry and the ticket balance.
  const [passStatus, setPassStatus] = useState<{ passActive: boolean; adFreeUntil: string | null; tickets: number } | null>(null);

  useEffect(() => {
    if (!player) return;
    let cancelled = false;
    fetch('/api/store/verify-pass')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { passActive?: boolean; adFreeUntil?: string | null; tickets?: number } | null) => {
        if (cancelled || !d) return;
        setPassStatus({ passActive: d.passActive ?? false, adFreeUntil: d.adFreeUntil ?? null, tickets: d.tickets ?? 0 });
      })
      .catch(() => undefined);
    if (SHOW_CHIP_PACKS) {
      fetch('/api/store/verify')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { yearlyPurchased?: number; storeLocked?: boolean } | null) => {
          if (cancelled || !d) return;
          setYearlyPurchased(d.yearlyPurchased ?? 0);
          setStoreLocked(d.storeLocked ?? false);
        })
        .catch(() => undefined);
    }
    // Ad card only appears when rewarded ads are genuinely available
    // (native app + NEXT_PUBLIC_ADMOB_ENABLED flag).
    if (rewardedAdsAvailable()) {
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
    }
    return () => {
      cancelled = true;
    };
  }, [player]);

  if (loading) return <PanelSkeleton count={4} height="h-44" />;
  if (!player) return <NotSignedIn />;

  const inApp = isNativeApp() && nativeBillingAvailable();
  const currentPlayer = player;

  async function handleBuyPass(sku: string, productId: string) {
    if (!inApp) {
      notify(
        'Time Passes are purchased inside the Venom Arena Android/iOS app (Google Play / App Store billing).',
        'info',
        onToast,
      );
      return;
    }
    setBusyId(sku);
    try {
      // Server verifies the store receipt and applies the entitlement
      // idempotently (stacking adFreeUntil + upfront tickets) — the server
      // response is the only source of truth.
      const result = await purchasePassAndVerify(sku, productId, currentPlayer.id);
      setPassStatus({
        passActive: true,
        adFreeUntil: result.adFreeUntil,
        tickets: result.tickets,
      });
      notify(
        result.alreadyCredited
          ? 'Pass already active on this account.'
          : `Time Pass activated! Ad-free for the pass duration + ${result.ticketsGranted} Virtual Tickets added.`,
        'success',
        onToast,
      );
      await refresh();
    } catch (e) {
      if (e instanceof IapError) {
        if (e.code !== 'PAYMENT_CANCELLED') notify(e.message, 'error', onToast);
      } else {
        notify('Network error. If you were charged, your pass activates automatically on next app start.', 'error', onToast);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleGetPack(pack: ChipPack) {
    if (!inApp) {
      notify(
        'Chips can be purchased inside the Venom Arena Android/iOS app (Google Play / App Store billing).',
        'info',
        onToast,
      );
      return;
    }
    if (storeLocked) {
      notify('Store is locked for 365 days after reaching the 25 Lakh yearly cap.', 'error', onToast);
      return;
    }
    const productId = PRODUCT_ID_BY_PACK.get(pack.id);
    if (!productId) {
      notify('Pack unavailable — please update the app.', 'error', onToast);
      return;
    }
    setBusyId(pack.id);
    try {
      // Server verifies the store receipt and credits chips idempotently —
      // the server response is the only source of truth.
      const result = await purchaseAndVerify(pack.id, productId, currentPlayer.id);
      setYearlyPurchased(result.yearlyPurchased);
      setStoreLocked(result.storeLocked);
      if (result.storeLocked) {
        notify(
          `Purchase Successful! +${result.credited.toLocaleString('en-IN')} CHIPS added! Annual buy cap of 25 Lakh Chips (2,500,000) reached — Store locked for 365 days to maintain tournament skill parity!`,
          'success',
          onToast,
        );
      } else {
        notify(
          `Purchase Successful! +${result.credited.toLocaleString('en-IN')} CHIPS credited. (Bought this year: ${result.yearlyPurchased.toLocaleString('en-IN')} / 25,00,000 max)`,
          'success',
          onToast,
        );
      }
      await refresh();
    } catch (e) {
      if (e instanceof IapError) {
        if (e.code !== 'PAYMENT_CANCELLED') notify(e.message, 'error', onToast);
      } else {
        notify('Network error. If you were charged, your chips are credited automatically on next app start.', 'error', onToast);
      }
    } finally {
      setBusyId(null);
    }
  }

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

  const tabs: { id: VaultTab; label: string; icon: React.ReactNode }[] = [
    { id: 'passes', label: 'Ad-Free Passes', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'earn', label: 'Earn Chips', icon: <Coins className="w-3.5 h-3.5" /> },
    ...(SHOW_CHIP_PACKS ? [{ id: 'packs' as VaultTab, label: 'Chip Packs', icon: <Landmark className="w-3.5 h-3.5" /> }] : []),
  ];

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-emerald-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <Landmark className="w-5.5 h-5.5 text-emerald-400" />
            The Vault
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl flex items-center gap-1.5">
            <Info className="w-3 h-3 shrink-0" />
            Go ad-free with a Time Pass, or top up free chips through rewarded ads. Chips are earned by playing — never required.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 shrink-0">
            <Coins className="w-4 h-4 text-amber-400" />
            <div>
              <MicroLabel>Your Wallet</MicroLabel>
              <div className="font-mono font-bold text-amber-300 text-sm">
                {player.bankedChips.toLocaleString('en-IN')}c
              </div>
            </div>
          </div>
          {passStatus?.passActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <MicroLabel>Ad-Free Pass</MicroLabel>
                <div className="font-mono font-bold text-emerald-300 text-sm">
                  until {passStatus.adFreeUntil ? new Date(passStatus.adFreeUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 shrink-0">
            <Ticket className="w-4 h-4 text-sky-400" />
            <div>
              <MicroLabel>Tickets</MicroLabel>
              <div className="font-mono font-bold text-sky-300 text-sm">
                {(passStatus?.tickets ?? 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative flex items-center gap-2 mb-5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              tab === t.id
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Ad-Free Passes ─────────────────────────────────────────────── */}
      {tab === 'passes' && (
        <div className="relative">
          {!inApp && (
            <div className="mb-4 p-3 rounded-xl border border-indigo-900/40 bg-indigo-950/30 text-xs text-indigo-200 leading-relaxed flex items-start gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Time Passes are purchased via Google Play / App Store in-app billing inside the{' '}
                <strong>Venom Arena mobile app</strong>. Sign in with the same account and your pass + tickets
                appear here instantly.
              </span>
            </div>
          )}

          {passStatus?.passActive && (
            <div className="mb-4 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-xs text-emerald-200 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Ad-Free Pass active</strong> — you see no ads anywhere until{' '}
                {passStatus.adFreeUntil ? new Date(passStatus.adFreeUntil).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}.
                Buying another pass <strong>extends</strong> this date (time stacks) and adds its tickets immediately.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PASS_PLANS.map((plan) => (
              <PassCard
                key={plan.id}
                sku={plan.id}
                label={plan.label}
                priceUsd={formatUsd(plan.priceUsd)}
                tickets={plan.tickets}
                hook={plan.hook}
                isBestSeller={plan.id === 'pass-3m'}
                busy={busyId === plan.id}
                onBuy={() => void handleBuyPass(plan.id, plan.productId)}
              />
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-[10px] text-slate-400 leading-relaxed flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>{PASS_LEGAL_TEXT}</span>
          </div>

          <div className="mt-3 p-3 rounded-xl border border-sky-900/40 bg-sky-950/20 text-[10px] text-sky-300 leading-relaxed flex items-start gap-2">
            <Ticket className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>
              <strong>Virtual Tickets</strong> grant one completely free entry (no buy-in, no ad) to the{' '}
              <strong>Jade Corridor</strong> online arena each. Redeem them from the arena join screen.
            </span>
          </div>
        </div>
      )}

      {/* ── Earn Chips ─────────────────────────────────────────────────── */}
      {tab === 'earn' && (
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Promo codes */}
          <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-amber-400" /> Promotional Codes
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Redeem a promo code for instant bonus chips. Try <code className="text-amber-300 font-mono">VENOM</code> (+500c) or <code className="text-amber-300 font-mono">CHAMPION</code> (+1000c).
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter Code (e.g. VENOM)"
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

          {/* Ad rewards — ONLY rendered when rewarded ads are genuinely available
              (native app + NEXT_PUBLIC_ADMOB_ENABLED). The old fake "sponsor"
              button (no ad SDK, instant credit) was a Play policy violation.
              USER-INITIATED ONLY — ads never auto-pop (locked spec). */}
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
      )}

      {/* ── Chip Packs (dormant behind NEXT_PUBLIC_STORE_CHIPS) ────────── */}
      {tab === 'packs' && SHOW_CHIP_PACKS && (
        <div className="relative">
          {/* Store lock alert */}
          {storeLocked && (
            <div className="mb-5 p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 leading-relaxed">
              <h3 className="text-sm font-bold text-rose-100 mb-1 flex items-center gap-1.5">
                <Lock className="w-4 h-4" /> ANTI-MONOPOLY STORE LOCK ACTIVE (365 DAYS)
              </h3>
              <p>
                You have reached the absolute maximum yearly buy cap of 25 Lakh Chips (2,500,000 chips).
                Store purchases are disabled to ensure tournament skill remains 100% fair across all
                197 countries. Free ad rewards (600 chips/day) and arena wagers remain fully active!
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {CHIP_PACKS.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                busy={busyId === pack.id}
                disabled={busyId !== null || (inApp && storeLocked)}
                inApp={inApp}
                onGet={() => void handleGetPack(pack)}
              />
            ))}
          </div>

          <div className="mt-4 p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-[10px] text-indigo-300 leading-relaxed flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              <strong>STORE POLICY COMPLIANCE ASSURANCE:</strong> Spending is capped at ₹15,000/year to block
              monopoly loops. Free potential daily rewards allow non-paying competitors to fully win the
              World Cup purely through skill and win-rate!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface PassCardProps {
  sku: string;
  label: string;
  priceUsd: string;
  tickets: number;
  hook: string;
  isBestSeller: boolean;
  busy: boolean;
  onBuy: () => void;
}

function PassCard({ sku, label, priceUsd, tickets, hook, isBestSeller, busy, onBuy }: PassCardProps) {
  return (
    <div
      className={`relative p-4 rounded-2xl border bg-slate-950/90 flex flex-col justify-between transition-all duration-200 group ${
        isBestSeller
          ? 'border-pink-500/50 bg-gradient-to-b from-pink-950/20 to-slate-950 shadow-lg shadow-pink-950/20 hover:border-pink-400'
          : 'border-slate-800/80 hover:border-emerald-500/40 hover:-translate-y-0.5'
      }`}
    >
      {isBestSeller && (
        <span className="absolute top-2.5 right-2.5 bg-pink-500 text-slate-950 text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 leading-none animate-pulse">
          <Crown className="w-2.5 h-2.5" /> Best Seller
        </span>
      )}

      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="text-3xl leading-none"
            aria-hidden
            role="img"
            style={{ filter: isBestSeller ? 'drop-shadow(0 0 8px rgba(236,72,153,0.6))' : 'drop-shadow(0 0 6px rgba(16,185,129,0.4))' }}
          >
            🛡️
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white font-sans tracking-tight truncate">No Ads · {label}</h3>
            <MicroLabel className="text-slate-500">One-time · {sku.replace('pass-', '')}</MicroLabel>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed mb-2 line-clamp-2">{hook}</p>
      </div>

      <div className="my-3">
        <div className="flex items-baseline gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-2xl font-extrabold font-mono text-emerald-400 tabular-nums">{priceUsd}</span>
          <span className="text-[10px] text-slate-500">one-time</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 border border-sky-500/30 text-sky-300">
            <Ticket className="w-2.5 h-2.5" /> +{tickets} Tickets
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <Check className="w-2.5 h-2.5" /> 0 Ads
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onBuy}
        disabled={busy}
        className="w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 bg-slate-900 group-hover:bg-emerald-600 group-hover:text-white text-slate-200 border border-slate-800 group-hover:border-emerald-500"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <>
            <CreditCard className="w-3.5 h-3.5" /> Buy · {priceUsd}
          </>
        )}
      </button>
    </div>
  );
}

interface PackCardProps {
  pack: ChipPack;
  busy: boolean;
  disabled: boolean;
  inApp: boolean;
  onGet: () => void;
}

function PackCard({ pack, busy, disabled, inApp, onGet }: PackCardProps) {
  const isMax = pack.id === 'pack-15000';
  return (
    <div
      className={`relative p-4 rounded-2xl border bg-slate-950/90 flex flex-col justify-between transition-all duration-200 group ${
        isMax
          ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-slate-950 shadow-lg shadow-amber-950/20 hover:border-amber-400'
          : 'border-slate-800/80 hover:border-emerald-500/40 hover:-translate-y-0.5'
      }`}
    >
      {isMax && (
        <span className="absolute top-2.5 right-2.5 bg-amber-500 text-slate-950 text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 leading-none animate-pulse">
          <Sparkles className="w-2.5 h-2.5" /> MAX CAP
        </span>
      )}

      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="text-3xl leading-none"
            aria-hidden
            role="img"
            style={{ filter: isMax ? 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' : 'drop-shadow(0 0 6px rgba(16,185,129,0.4))' }}
          >
            {pack.emoji}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white font-sans tracking-tight truncate">{pack.name}</h3>
            <MicroLabel className="text-slate-500">₹{pack.priceINR} · {pack.priceUSD}</MicroLabel>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed mb-2 line-clamp-2">{pack.desc}</p>
      </div>

      <div className="my-3">
        <div className="flex items-baseline gap-1.5">
          <Coins className="w-4 h-4 text-emerald-400" />
          <span className="text-2xl font-extrabold font-mono text-emerald-400 tabular-nums">
            {pack.chips.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500">chips</span>
        </div>
        <div className="mt-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <Sparkles className="w-2.5 h-2.5" /> {pack.bonus}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onGet}
        disabled={busy || disabled}
        className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
          isMax
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-950/40'
            : 'bg-slate-900 group-hover:bg-emerald-600 group-hover:text-white text-slate-200 border border-slate-800 group-hover:border-emerald-500'
        }`}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : !inApp ? (
          <>
            <Smartphone className="w-3.5 h-3.5" /> Buy in App
          </>
        ) : disabled ? (
          <>
            <Lock className="w-3.5 h-3.5" /> Locked
          </>
        ) : (
          <>
            <CreditCard className="w-3.5 h-3.5" /> Buy · ₹{pack.priceINR}
          </>
        )}
      </button>
    </div>
  );
}

export default ChipStore;
