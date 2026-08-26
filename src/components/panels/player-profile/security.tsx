'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import type { PlayerProfile } from '@/lib/types';
import { notify, type ToastFn } from '../_panel-primitives';

function SecuritySettingsCard({
  player,
  onToast,
}: {
  player: PlayerProfile;
  onToast?: ToastFn;
}) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpBusy, setCpBusy] = useState(false);

  const [showChangePin, setShowChangePin] = useState(false);
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setCpBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data?.error || 'Failed to change password.', 'error', onToast);
        return;
      }
      notify('Password changed successfully!', 'success', onToast);
      setShowChangePassword(false);
      setCpCurrent('');
      setCpNew('');
    } catch {
      notify('Network error.', 'error', onToast);
    } finally {
      setCpBusy(false);
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinBusy(true);
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: pinCurrent, newPin: pinNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data?.error || 'Failed to change PIN.', 'error', onToast);
        return;
      }
      notify(data?.message || 'Security PIN updated!', 'success', onToast);
      setShowChangePin(false);
      setPinCurrent('');
      setPinNew('');
    } catch {
      notify('Network error.', 'error', onToast);
    } finally {
      setPinBusy(false);
    }
  }

  const isRegistered = !!player.email;
  const canChangePassword = isRegistered;
  const canManagePin = isRegistered;

  if (!isRegistered) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      <div className="p-3 lg:p-2 flex items-center justify-between border-b border-slate-800/60">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          Security Settings
        </span>
        <span className="text-[10px] lg:text-[11px] text-slate-500 font-mono">
          {player.securityPin ? '\u{1f510} PIN Set' : '\u26a0\u{fe0f} No PIN'}
        </span>
      </div>

      {/* On desktop: side-by-side grid. On mobile: stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {canChangePassword && (
          <div className="p-3 lg:p-2 border-b border-slate-800/40 lg:border-b-0 lg:border-r border-slate-800/40">
            {!showChangePassword ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-300 font-semibold">Password</p>
                  <p className="text-[10px] lg:text-[11px] text-slate-500">Change your account password</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChangePassword(true)}
                  className="px-3 py-1.5 text-[10px] lg:text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg hover:bg-amber-500/20 transition cursor-pointer"
                >
                  Change
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="password"
                    required
                    placeholder="Current password"
                    value={cpCurrent}
                    onChange={(e) => setCpCurrent(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="New password (min 6)"
                    value={cpNew}
                    onChange={(e) => setCpNew(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={cpBusy}
                    className="px-3 py-1.5 text-[10px] lg:text-[11px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-400 transition cursor-pointer disabled:opacity-50"
                  >
                    {cpBusy ? 'Saving\u2026' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowChangePassword(false); setCpCurrent(''); setCpNew(''); }}
                    className="px-3 py-1.5 text-[10px] lg:text-[11px] border border-slate-700 text-slate-400 rounded-lg hover:border-slate-600 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {canManagePin && (
        <div className="p-3">
          {!showChangePin ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300 font-semibold">Security PIN</p>
                <p className="text-[10px] lg:text-[11px] text-slate-500">
                  {player.securityPin
                    ? 'Used for password recovery. Keep it safe!'
                    : 'Set a 4-digit PIN to enable password recovery.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePin(true)}
                className="px-3 py-1.5 text-[10px] lg:text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg hover:bg-emerald-500/20 transition cursor-pointer"
              >
                {player.securityPin ? 'Change PIN' : 'Set PIN'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePin} className="space-y-2">
              {player.securityPin && (
                <div>
                  <label className="text-[10px] lg:text-[11px] text-slate-500 block mb-1">Current PIN</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    placeholder="Enter current 4-digit PIN"
                    value={pinCurrent}
                    onChange={(e) => setPinCurrent(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition"
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] lg:text-[11px] text-slate-500 block mb-1">New PIN (4 digits)</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  placeholder="Enter new 4-digit PIN"
                  value={pinNew}
                  onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pinBusy}
                  className="px-3 py-1.5 text-[10px] lg:text-[11px] font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition cursor-pointer disabled:opacity-50"
                >
                  {pinBusy ? 'Saving\u2026' : player.securityPin ? 'Update PIN' : 'Set PIN'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowChangePin(false); setPinCurrent(''); setPinNew(''); }}
                  className="px-3 py-1.5 text-[10px] lg:text-[11px] border border-slate-700 text-slate-400 rounded-lg hover:border-slate-600 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

export { SecuritySettingsCard };
