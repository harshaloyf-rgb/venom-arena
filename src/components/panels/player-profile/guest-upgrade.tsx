'use client';

import { useState } from 'react';
import { Lock, Shield, UserPlus, X } from 'lucide-react';
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

  if (!open) {
    return (
      <div className="p-4 lg:p-2.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 lg:gap-2">
          <div className="flex items-center gap-3 lg:gap-2 min-w-0">
            <div className="w-10 h-10 lg:w-7 lg:h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-5 h-5 lg:w-3.5 lg:h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm lg:text-[11px] font-bold text-amber-300 font-sans">
                You&apos;re playing as a Guest
              </h3>
              <p className="text-xs lg:text-[10px] text-slate-400 font-sans mt-0.5">
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
        body: JSON.stringify({ name, email, password, pin }),
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
    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-amber-300 font-sans">Upgrade to Registered Account</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
        <Lock className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
        <strong className="text-slate-300">Your progress is safe.</strong> All chips, stats, cosmetics, streaks, friends, and clan memberships carry over. You keep your VENOM tag. Just add an email and password to secure your account.
      </div>

      <form onSubmit={handleUpgrade} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="ug-name" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-sans">
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
              className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ug-email" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Email
            </label>
            <input
              id="ug-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@arena.gg"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="ug-pass" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Password (min 6 chars)
            </label>
            <input
              id="ug-pass"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ug-pin" className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-sans">
              Security PIN (4 digits, optional)
            </label>
            <input
              id="ug-pin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 1234"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700/60 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold font-sans rounded-xl border border-amber-500 transition cursor-pointer shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Upgrading…' : 'Upgrade & Secure Account'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-white text-xs font-bold font-sans rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export { GuestUpgradeBanner };
