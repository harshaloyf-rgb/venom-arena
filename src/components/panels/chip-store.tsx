'use client';

// Ad-Free — Venom Arena's pass & referrals hub (renamed from "The Vault",
// 2026-09-05: real-money chip packs are dormant, so the old name mislead).
//
// Tab 1 "Ad-Free Passes": the Global USD One-Time Pass Matrix. Buying a pass
//   grants the ad-free entitlement (stacking time) + bundled Virtual Tickets
//   upfront. Real-money IAP via Google Play / App Store, verified server-side.
// Tab 2 "Referrals": share a referral code — both players earn chips once the
//   referred player completes REFERRAL_MATCH_THRESHOLD matches. Live status
//   list (pending → active → claimed) from /api/player/referral.
// Tab 3 "Chip Packs" (dormant): the old real-money chip store, hidden unless
//   NEXT_PUBLIC_STORE_CHIPS=true. Server routes reject pack purchases without
//   the flag — the UI and the API are gated together.
// (Promo code redemption + Daily Reward Ads moved to the Claims panel's
//   "Bonus" tab on 2026-09-05 — they are free rewards, not store items.)

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CHIP_PACKS,
  type ChipPack,
  chipsStoreEnabled,
  REFERRAL_REWARD,
  REFERRAL_MATCH_THRESHOLD,
} from '@/lib/game-config';
import { allStoreProducts } from '@/lib/store-catalog';
import { isNativeApp, nativeBillingAvailable, purchaseAndVerify, purchasePassAndVerify, IapError } from '@/lib/iap';
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
  Users,
  Copy,
  Smartphone,
  ShieldCheck,
  Ticket,
  Crown,
  Check,
} from 'lucide-react';

interface ChipStoreProps {
  onToast?: ToastFn;
}

type AdFreeTab = 'passes' | 'refer' | 'packs';

// packId -> store product id (server keeps the authoritative chips mapping)
const PRODUCT_ID_BY_PACK = new Map(allStoreProducts().map((p) => [p.packId, p.productId]));
const SHOW_CHIP_PACKS = chipsStoreEnabled(); // dormant by default (locked spec)

export function ChipStore({ onToast }: ChipStoreProps) {
  const { player, loading, refresh } = useAuth();
  const [tab, setTab] = useState<AdFreeTab>('passes');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Yearly buy cap is server truth now (GET /api/store/verify) — the old
  // localStorage counter was trivially bypassable and lied after reinstalls.
  const [yearlyPurchased, setYearlyPurchased] = useState<number | null>(null);
  const [storeLocked, setStoreLocked] = useState(false);
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

  const tabs: { id: AdFreeTab; label: string; icon: React.ReactNode }[] = [
    { id: 'passes', label: 'Ad-Free Passes', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'refer', label: 'Referrals', icon: <Users className="w-3.5 h-3.5" /> },
    ...(SHOW_CHIP_PACKS ? [{ id: 'packs' as AdFreeTab, label: 'Chip Packs', icon: <Landmark className="w-3.5 h-3.5" /> }] : []),
  ];

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-emerald-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-5.5 h-5.5 text-emerald-400" />
            Go Ad-Free
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl flex items-center gap-1.5">
            <Info className="w-3 h-3 shrink-0" />
            One-time Time Passes remove every ad and bundle free Jade Corridor tickets. Or invite friends — you both earn chips. Ads never interrupt gameplay.
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

      {/* ── Referrals ─────────────────────────────────────────────────── */}
      {tab === 'refer' && <ReferralTab onToast={onToast} />}

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

// ── Referrals ──────────────────────────────────────────────────────────
// Share a code → both players earn chips once the referred player completes
// REFERRAL_MATCH_THRESHOLD matches. Statuses mirror the backend Referral
// model: pending → active → claimed. Guests see a register prompt (codes are
// issued to registered accounts only).

interface ReferralData {
  referralCode: string;
  hasReferrer: boolean;
  referrerName: string | null;
  referrerCode: string | null;
  referrals: Array<{ id: string; referredName: string; status: string; matchesPlayed: number; createdAt: string }>;
}

function ReferralTab({ onToast }: { onToast?: ToastFn }) {
  const { player } = useAuth();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/player/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ReferralData | null) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [player?.id]);

  async function copyCode() {
    if (!data?.referralCode) return;
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      notify('Could not copy — please copy the code manually.', 'error', onToast);
    }
  }

  if (loading) return <PanelSkeleton count={2} height="h-28" />;

  if (!player?.email) {
    return (
      <div className="relative p-5 rounded-2xl border border-slate-800 bg-slate-950/60 text-center">
        <Users className="w-6 h-6 text-slate-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-white mb-1">Referrals need a registered account</h3>
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-md mx-auto">
          Create your free account from <strong className="text-slate-200">Agent Profile → Account</strong> to unlock
          your referral code. Invite a friend and you <strong className="text-emerald-400">both</strong> earn{' '}
          <strong className="text-emerald-400">{REFERRAL_REWARD.toLocaleString('en-IN')} chips</strong> once they
          complete <strong className="text-amber-400">{REFERRAL_MATCH_THRESHOLD} matches</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* How it works + your code */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-emerald-400" /> Invite Friends — Both Earn
        </h3>
        <ul className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed mb-3">
          <li className="flex items-start gap-1.5">
            <span className="text-emerald-400 mt-0.5 shrink-0 font-bold">1.</span>
            <span>Share your referral code — your friend enters it when they sign up.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-emerald-400 mt-0.5 shrink-0 font-bold">2.</span>
            <span>They play <strong className="text-amber-400">{REFERRAL_MATCH_THRESHOLD} matches</strong>.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-emerald-400 mt-0.5 shrink-0 font-bold">3.</span>
            <span>You <strong className="text-emerald-400">both</strong> get <strong className="text-emerald-400">{REFERRAL_REWARD.toLocaleString('en-IN')} chips</strong> automatically.</span>
          </li>
        </ul>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg tracking-wider">
            {data?.referralCode ?? '———'}
          </span>
          <button
            type="button"
            onClick={copyCode}
            disabled={!data?.referralCode}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        {data?.hasReferrer && data.referrerName && (
          <p className="text-[11px] text-slate-500 mt-3">
            Referred by <strong className="text-slate-300">{data.referrerName}</strong> ({data.referrerCode})
          </p>
        )}
      </div>

      {/* Referral status list */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Ticket className="w-4 h-4 text-sky-400" /> Referral Status ({data?.referrals.length ?? 0})
        </h3>
        {(data?.referrals.length ?? 0) > 0 ? (
          <div className="max-h-56 overflow-y-auto va-scroll space-y-1.5">
            {data!.referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-950/40 border border-slate-900/40 px-3 py-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-200 block truncate">{r.referredName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{r.matchesPlayed}/{REFERRAL_MATCH_THRESHOLD} matches</span>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ml-2 ${
                  r.status === 'claimed'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : r.status === 'active'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {r.status === 'claimed' ? 'Claimed' : r.status === 'active' ? 'Active' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Copy className="w-5 h-5 text-slate-600 mx-auto mb-2" />
            <p className="text-[11px] text-slate-500">No referrals yet. Share your code to start earning!</p>
          </div>
        )}
      </div>
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
