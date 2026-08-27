'use client';

import { useState } from 'react';
import { Info, Lock, Shield, UserPlus, X, Link as LinkIcon } from 'lucide-react';
import { notify, type ToastFn } from '../_panel-primitives';

function GuestUpgradeBanner({
  onRefresh,
  onToast,
}: {
  onRefresh: () => Promise<void>;
  onToast?: ToastFn;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [referralCode, setReferralCode] = useState('');

  if (!open) {
    return (
      <div className="p-4 lg:p-2 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 lg:gap-2">
          <div className="flex items-center gap-3 lg:gap-1.5 min-w-0">
            <div className="w-10 h-10 lg:w-6 lg:h-6 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-5 h-5 lg:w-3 lg:h-3" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm lg:text-[11px] font-bold text-amber-300 font-sans">
                You&apos;re playing as a Guest
              </h3>
              <p className="text-xs lg:text-[11px] text-slate-400 font-sans mt-0.5">
                Upgrade to a registered account to secure your progress. All chips, stats, cosmetics, and friends carry over.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 px-4 lg:px-3 py-2 lg:py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold font-sans rounded-xl border border-amber-500 transition cursor-pointer shadow-lg shadow-amber-600/20"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5 inline" />
            Upgrade Now
          </button>
        </div>
      </div>
    );
  }

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, pin, referralCode: referralCode.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Upgrade failed.');
        return;
      }
      setOpen(false);
      notify('Account upgraded successfully! All progress preserved.', 'success', onToast);
      await onRefresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5 lg:p-2 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 space-y-4 lg:space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 lg:w-3 lg:h-3 text-amber-400" />
          <h3 className="text-sm lg:text-[11px] font-bold text-amber-300 font-sans">Upgrade to Registered Account</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
        >
          <X className="w-4 h-4 lg:w-3 lg:h-3" />
        </button>
      </div>

      <div className="p-3 lg:p-1.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] lg:text-[11px] text-slate-400 leading-relaxed">
        <Lock className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
        <strong className="text-slate-300">Your progress is safe.</strong> All chips, stats, cosmetics, streaks, friends, and clan memberships carry over. You keep your VENOM tag. Just add an email and password to secure your account.
      </div>

      <form onSubmit={handleUpgrade} className="space-y-3 lg:space-y-1.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-2">
          <div className="space-y-1 lg:space-y-0">
            <label htmlFor="ug-name" className="text-[11px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Display Name
            </label>
            <input
              id="ug-name"
              type="text"
              required
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ViperStrike"
              className="w-full px-3 lg:px-2 py-2 lg:py-1 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm lg:text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <div className="space-y-1 lg:space-y-0">
            <label htmlFor="ug-email" className="text-[11px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Email
            </label>
            <input
              id="ug-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@arena.gg"
              className="w-full px-3 lg:px-2 py-2 lg:py-1 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm lg:text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <div className="space-y-1 lg:space-y-0">
            <label htmlFor="ug-pass" className="text-[11px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Password (min 6)
            </label>
            <input
              id="ug-pass"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 lg:px-2 py-2 lg:py-1 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm lg:text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <div className="space-y-1 lg:space-y-0">
            <label htmlFor="ug-pin" className="text-[11px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Security PIN (4 digits)
            </label>
            <input
              id="ug-pin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 1234"
              className="w-full px-3 lg:px-2 py-2 lg:py-1 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm lg:text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <div className="space-y-1 lg:space-y-0">
            <label htmlFor="ug-referral" className="text-[11px] uppercase tracking-wider text-slate-500 font-bold font-sans flex items-center gap-1">
              <LinkIcon className="w-3 h-3 text-emerald-400" /> Referral Code (optional)
            </label>
            <input
              id="ug-referral"
              type="text"
              maxLength={20}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.trim().toUpperCase())}
              placeholder="e.g. VIP-ABC123"
              className="w-full px-3 lg:px-2 py-2 lg:py-1 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm lg:text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition font-mono"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="px-5 lg:px-3 py-2.5 lg:py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs lg:text-[11px] font-bold font-sans rounded-xl border border-amber-500 transition cursor-pointer shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Upgrading…' : 'Upgrade & Secure Account'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 lg:px-2.5 py-2.5 lg:py-1 border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-white text-xs lg:text-[11px] font-bold font-sans rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Social login — quick alternative */}
      <div className="border-t border-slate-800/60 pt-3 lg:pt-1.5">
        <div className="flex items-center gap-1.5 mb-2 lg:mb-1">
          <span className="text-[11px] text-slate-500 font-sans uppercase tracking-wider font-bold">Or quick sign-up with</span>
          <Info className="w-3 h-3 text-slate-600" title="Social login creates a new account. Your guest progress (chips, skins, levels) will NOT carry over. Use the form above to preserve your progress." />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:gap-1">
          <button
            type="button"
            onClick={() => { window.location.href = '/api/auth/social-login?provider=google'; }}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 lg:py-1 bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 rounded-lg text-[11px] text-slate-300 hover:text-white font-bold font-sans transition cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/api/auth/social-login?provider=facebook'; }}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 lg:py-1 bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 rounded-lg text-[11px] text-slate-300 hover:text-white font-bold font-sans transition cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/api/auth/social-login?provider=apple'; }}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 lg:py-1 bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 rounded-lg text-[11px] text-slate-300 hover:text-white font-bold font-sans transition cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Apple
          </button>
        </div>
        <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          Social login creates a <strong className="text-amber-400">new account</strong> — guest progress won&apos;t carry over. Use the email form above to preserve everything.
        </p>
      </div>
    </div>
  );
}

export { GuestUpgradeBanner };
