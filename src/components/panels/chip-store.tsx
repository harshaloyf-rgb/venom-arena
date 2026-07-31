'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CHIP_PACKS,
  PROMO_CODES,
  MAX_YEARLY_BUY_CHIPS,
  MAX_DAILY_ADS,
  AD_REWARD_CHIPS,
  type ChipPack,
} from '@/lib/game-config';
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
} from 'lucide-react';

interface ChipStoreProps {
  onToast?: ToastFn;
}

const YEARLY_PURCHASED_KEY = 'venom_yearly_purchased_chips';
const DAILY_ADS_KEY = 'venom_daily_ads';

function getYearlyPurchased(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const v = localStorage.getItem(YEARLY_PURCHASED_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function getTodayAdCount(): { date: string; count: number } {
  const today = new Date().toISOString().slice(0, 10);
  if (typeof window === 'undefined') return { date: today, count: 0 };
  try {
    const v = localStorage.getItem(DAILY_ADS_KEY);
    if (!v) return { date: today, count: 0 };
    const parsed = JSON.parse(v) as { date: string; count: number };
    if (parsed.date !== today) return { date: today, count: 0 };
    return parsed;
  } catch {
    return { date: today, count: 0 };
  }
}

export function ChipStore({ onToast }: ChipStoreProps) {
  const { player, loading, refresh } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [yearlyPurchased, setYearlyPurchased] = useState(0);
  const [adState, setAdState] = useState({ date: '', count: 0 });

  // Init from localStorage on mount
  useEffect(() => {
    setYearlyPurchased(getYearlyPurchased());
    setAdState(getTodayAdCount());
  }, []);

  if (loading) return <PanelSkeleton count={4} height="h-44" />;
  if (!player) return <NotSignedIn />;

  const storeLocked = yearlyPurchased >= MAX_YEARLY_BUY_CHIPS;
  const adsRemaining = MAX_DAILY_ADS - adState.count;

  async function handleGetPack(pack: ChipPack) {
    if (storeLocked) {
      notify('Store is locked for 365 days after reaching the 25 Lakh yearly cap.', 'error', onToast);
      return;
    }
    setBusyId(pack.id);
    try {
      notify(`Initializing secure App Store/Play Store sandboxed billing for ₹${pack.priceINR} (${pack.priceUSD})...`, 'info', onToast);
      const res = await fetch('/api/chips/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        granted?: number;
      };
      if (!res.ok) {
        notify(data?.error || 'Failed to add chips.', 'error', onToast);
        return;
      }
      const granted = data.granted ?? pack.chips;
      const newPurchased = yearlyPurchased + pack.chips;
      setYearlyPurchased(newPurchased);
      if (typeof window !== 'undefined') {
        localStorage.setItem(YEARLY_PURCHASED_KEY, String(newPurchased));
      }
      if (newPurchased >= MAX_YEARLY_BUY_CHIPS) {
        notify(
          `🎉 Purchase Successful! +${granted.toLocaleString('en-IN')} CHIPS added! Annual buy cap of 25 Lakh Chips (2,500,000) reached — Store locked for 365 days to maintain tournament skill parity!`,
          'success',
          onToast,
        );
      } else {
        notify(
          `Purchase Successful! +${granted.toLocaleString('en-IN')} CHIPS credited. (Bought this year: ${newPurchased.toLocaleString('en-IN')} / 25,00,000 max)`,
          'success',
          onToast,
        );
      }
      await refresh();
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
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
    if (adsRemaining <= 0) {
      notify('Daily Ad Limit Reached (12/12)! Resets at 00:00 UTC.', 'error', onToast);
      return;
    }
    setAdBusy(true);
    notify('Launching high-definition sponsor video... Keep active.', 'info', onToast);
    try {
      const res = await fetch('/api/player/video-reward', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string; reward?: number; newBankedChips?: number };
      if (!res.ok) {
        notify(data?.error || 'Failed to claim ad reward.', 'error', onToast);
        return;
      }
      const newCount = adState.count + 1;
      const today = new Date().toISOString().slice(0, 10);
      const newState = { date: today, count: newCount };
      setAdState(newState);
      if (typeof window !== 'undefined') {
        localStorage.setItem(DAILY_ADS_KEY, JSON.stringify(newState));
      }
      notify(`Sponsor Ad Completed: +${data.reward || AD_REWARD_CHIPS} FREE CHIPS deposited! (${newCount}/12 ads today)`, 'success', onToast);
      void refresh();
    } catch {
      notify('Network error claiming ad reward.', 'error', onToast);
    } finally {
      setAdBusy(false);
    }
  }

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-emerald-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <Landmark className="w-5.5 h-5.5 text-emerald-400" />
            Integrated Store Matrix (Base Rate: 100 Chips = ₹1)
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl flex items-center gap-1.5">
            <Info className="w-3 h-3 shrink-0" />
            Rebuild your bank cushion with fair-play packages bounded by strict annual buy limits (25 Lakh Chips max / year).
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 shrink-0">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <div>
              <MicroLabel>Yearly Buy Cap</MicroLabel>
              <div className="font-mono font-bold text-rose-300 text-sm">
                {yearlyPurchased.toLocaleString('en-IN')} / 25,00,000 c
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Store lock alert */}
      {storeLocked && (
        <div className="relative mb-5 p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 leading-relaxed">
          <h3 className="text-sm font-bold text-rose-100 mb-1 flex items-center gap-1.5">
            <Lock className="w-4 h-4" /> ANTI-MONOPOLY STORE LOCK ACTIVE (365 DAYS)
          </h3>
          <p>
            You have reached the absolute maximum yearly buy cap of 25 Lakh Chips (2,500,000 chips).
            Store purchases are disabled to ensure tournament skill remains 100% fair across all
            197 countries. Free ad rewards (1,200 chips/day) and arena wagers remain fully active!
          </p>
        </div>
      )}

      {/* Pack grid */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {CHIP_PACKS.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            busy={busyId === pack.id}
            disabled={busyId !== null || storeLocked}
            onGet={() => void handleGetPack(pack)}
          />
        ))}
      </div>

      {/* Promo + Ads row */}
      <div className="relative mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Ad rewards */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
            <Video className="w-4 h-4 text-indigo-400" /> Daily Reward Ads (12 Max / Day)
          </h3>
          <p className="text-[11px] text-slate-400 mb-3">
            Each completed ad awards 100 chips directly to your wallet (Max 1,200 free chips per day).
            Resets strictly at 00:00 UTC daily.
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-slate-500">
              Today: {adState.count}/12 ads · {adsRemaining} remaining
            </span>
            <button
              type="button"
              onClick={handleWatchAd}
              disabled={adBusy || adsRemaining <= 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {adBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
              {adBusy ? 'Buffering Sponsor Offer...' : adsRemaining <= 0 ? 'Daily Limit Reached (12/12)' : 'Watch Sponsor Ad (+100 Chips)'}
            </button>
          </div>
        </div>
      </div>

      {/* Compliance notice */}
      <div className="relative mt-5 p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-[10px] text-indigo-300 leading-relaxed flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <span>
          <strong>STORE POLICY COMPLIANCE ASSURANCE:</strong> This is a store-safe edition.
          Spending is capped at ₹15,000/year to block monopoly loops. Free potential daily rewards
          allow non-paying competitors to fully win the World Cup purely through skill and win-rate!
        </span>
      </div>
    </div>
  );
}

interface PackCardProps {
  pack: ChipPack;
  busy: boolean;
  disabled: boolean;
  onGet: () => void;
}

function PackCard({ pack, busy, disabled, onGet }: PackCardProps) {
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
        ) : disabled ? (
          <>
            <Lock className="w-3.5 h-3.5" /> Locked
          </>
        ) : (
          <>
            <CreditCard className="w-3.5 h-3.5" /> Buy Pack
          </>
        )}
      </button>
    </div>
  );
}

export default ChipStore;
