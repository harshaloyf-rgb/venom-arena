'use client';

/**
 * BUILD-11 — `AuthGate` panel.
 *
 * Faithful replica of `/upload/extracted/src/components/AuthGate.tsx` (376
 * lines). Re-implemented on top of the BUILD-2 server-authoritative stack:
 * `useAuth().refresh()` is called after a successful POST so the rest of the
 * dashboard re-renders with the freshly-issued session.
 *
 * Visual layout, every label, placeholder, region dropdown value, the
 * Guest warning copy (with the original &quot;results&quot; typo preserved),
 * the Google / Apple social connectors, and the indigo→cyan title gradient
 * are all preserved verbatim.
 */

import { useState } from 'react';
import {
  AlertCircle,
  Globe,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { notify, type ToastFn } from './_panel-primitives';

interface AuthGateProps {
  onToast?: ToastFn;
}

type Mode = 'login' | 'register' | 'guest';

const REGIONS: { value: string; label: string }[] = [
  { value: 'US', label: 'United States (US-West Shard)' },
  { value: 'GB', label: 'United Kingdom (EU-Central Shard)' },
  { value: 'IN', label: 'India (Asia-South Shard)' },
  { value: 'AU', label: 'Australia (APAC-East Shard)' },
  { value: 'SG', label: 'Singapore (Asia-East Shard)' },
];

export function AuthGate({ onToast }: AuthGateProps) {
  const { refresh } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('US');
  const [isLoading, setIsLoading] = useState(false);

  async function callAuth(path: string, body: unknown, successMsg: string) {
    setIsLoading(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        stats?: unknown;
        player?: unknown;
      };
      if (!res.ok) {
        notify(data?.error || 'Authentication failed.', 'error', onToast);
        return;
      }
      await refresh();
      notify(successMsg, 'success', onToast);
    } catch {
      notify('Authentication service is currently offline.', 'error', onToast);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      notify('Please fill in all credentials.', 'error', onToast);
      return;
    }
    await callAuth(
      '/api/auth/login',
      { email, password },
      'Welcome back! Sync enabled.',
    );
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !username) {
      notify('Please complete all registration fields.', 'error', onToast);
      return;
    }
    await callAuth(
      '/api/auth/register',
      { email, password, name: username, country },
      'Account registered successfully! Welcome to the Syndicate!',
    );
  }

  async function handleGuestLogin(e: React.FormEvent) {
    e.preventDefault();
    await callAuth(
      '/api/auth/guest',
      { name: username || 'GuestViper', country },
      'Entered arena with guest credentials.',
    );
  }

  async function handleSocialAuth(provider: 'Google' | 'Apple') {
    notify(`Connecting to ${provider} Secure Identity Hub...`, 'info', onToast);
    setIsLoading(true);
    const namePrefix = provider === 'Google' ? 'G-' : 'A-';
    setTimeout(() => {
      void callAuth(
        '/api/auth/guest',
        { name: namePrefix + (username || 'Challenger'), country },
        `Linked and authorized via ${provider} OAuth!`,
      );
    }, 1000);
  }

  return (
    <div
      id="auth-gate-container"
      className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Dynamic grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden z-10 flex flex-col gap-6">
        {/* Neon gradient stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500" />

        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400 text-xs font-mono font-semibold mb-3">
            <Shield className="w-3.5 h-3.5" />
            <span>SECURE SYNDICATE GATEWAY v2</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white font-sans uppercase">
            Venom{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              Arena
            </span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Authorized Multiplayer Snake Warfare and Capital Extraction
          </p>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-800">
          {(['login', 'register', 'guest'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 pb-3 text-sm font-semibold tracking-wide transition-all uppercase ${
                mode === m
                  ? 'text-white border-b-2 border-indigo-500 font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'login' ? 'Login' : m === 'register' ? 'Register' : 'Guest'}
            </button>
          ))}
        </div>

        {/* Forms */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Field
              label="Email address"
              icon={<Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />}
            >
              <input
                type="email"
                placeholder="name@syndicate.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </Field>

            <Field
              label="Password"
              icon={<Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />}
            >
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </Field>

            <SubmitButton
              disabled={isLoading}
              busy={isLoading}
              busyLabel="Processing Auth..."
              label="Decrypt & Login"
            />
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <Field
              label="Squad Call-Sign (Name)"
              icon={<User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />}
            >
              <input
                type="text"
                placeholder="Striker"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </Field>

            <Field
              label="Email address"
              icon={<Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />}
            >
              <input
                type="email"
                placeholder="your-name@syndicate.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </Field>

            <Field
              label="Security Encryption Key (Password)"
              icon={<Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />}
            >
              <input
                type="password"
                placeholder="Choose password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </Field>

            <Field
              label="Operational Region"
              icon={<Globe className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />}
            >
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>

            <SubmitButton
              disabled={isLoading}
              busy={isLoading}
              busyLabel="Registering Profile..."
              label="Register & Create Profile"
            />
          </form>
        )}

        {mode === 'guest' && (
          <form onSubmit={handleGuestLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 bg-slate-950/40 p-4 border border-slate-800/60 rounded-2xl mb-2">
              <div className="flex gap-2 text-amber-500 mb-1.5 items-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider font-sans">
                  Guest Terminal Warning
                </span>
              </div>
              <p className="text-slate-500 text-[10px] leading-relaxed font-sans">
                Guest sessions are bound to local cache. Unregistering or
                clearing browser data will results in total loss of chips,
                skins, and levels.
              </p>
            </div>

            <Field
              label="Temporary Nickname (Optional)"
              icon={<User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />}
            >
              <input
                type="text"
                placeholder="GuestViper"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </Field>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-white font-bold rounded-xl py-3 text-xs uppercase tracking-wider transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <span>Enter as Guest Challenger</span>
              )}
            </button>
          </form>
        )}

        {/* Social Auth Connectors */}
        <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-5">
          <div className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            Or authorized linking hubs
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void handleSocialAuth('Google')}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-2 px-3 rounded-xl text-[11px] uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50"
            >
              <svg
                className="w-3.5 h-3.5 text-red-500 shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12.24 10.285V13.4h6.887c-.648 2.41-2.519 4.19-5.136 4.19A5.46 5.46 0 018.55 12a5.46 5.46 0 015.44-5.59c2.28 0 4.35.8 5.86 2.36l2.384-2.38C20.17 4.5 17.15 3 14 3a9 9 0 000 18c4.91 0 9-3.55 9-9 0-.62-.07-1.22-.2-1.715H12.24z" />
              </svg>
              <span>Google ID</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSocialAuth('Apple')}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-2 px-3 rounded-xl text-[11px] uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-300 shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.84-1 2.94 1.08.08 2.18-.52 2.83-1.33z" />
              </svg>
              <span>Apple ID</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-slate-400 font-bold tracking-wider uppercase">
        {label}
      </label>
      <div className="relative">{children}{icon}</div>
    </div>
  );
}

function SubmitButton({
  disabled,
  busy,
  busyLabel,
  label,
}: {
  disabled: boolean;
  busy: boolean;
  busyLabel: string;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-bold rounded-xl py-3 text-xs uppercase tracking-wider transition-colors mt-2 shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2"
    >
      {busy ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>{busyLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}

export default AuthGate;
