'use client';

// VA-SETTINGS-SECTION: the Settings tab of the profile panel.
// Entry button lives next to Sign Out (user-approved placement).
//
// Items (user approved "all"): report/email support, music, sound,
// orientation (default portrait), haptics, performance mode, privacy
// policy + data-request links, about. Notifications / languages are
// shown as clearly-labelled roadmap chips — no fake controls.

import { useState } from 'react';
import {
  BadgeCheck,
  Bug,
  Gauge,
  Info,
  Mail,
  Music,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Vibrate,
  Volume2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  getSettings,
  updateSettings,
  SUPPORT_EMAIL,
  APP_ENTITY,
  APP_VERSION,
  type GameSettings,
  type OrientationMode,
} from '@/lib/settings';
import { applyOrientation } from '@/lib/orientation';
import { haptic, hapticSupported, HAPTIC } from '@/lib/haptics';
import { notify, type ToastFn } from './_panel-primitives';

function Card({ icon: Icon, iconClass, title, children }: {
  icon: typeof Mail;
  iconClass: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      <div className="p-3 lg:p-1.5 flex items-center gap-2 border-b border-slate-800/60">
        <Icon className={`w-3.5 h-3.5 lg:w-3 lg:h-3 ${iconClass}`} />
        <span className="text-xs lg:text-[11px] font-bold uppercase tracking-wider text-slate-300">{title}</span>
      </div>
      <div className="p-3 lg:p-1.5 space-y-2.5 lg:space-y-1.5">{children}</div>
    </div>
  );
}

function SettingRow({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs lg:text-[11px] text-slate-300 font-semibold">{label}</p>
        {hint && <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function reportIssueHref(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  const subject = encodeURIComponent('Venom Arena — Issue Report');
  const body = encodeURIComponent(
    `Describe the issue:\n\n\n---\nApp: Venom Arena ${APP_VERSION}\nEntity: ${APP_ENTITY}\nPlatform: ${ua}\nTime: ${new Date().toISOString()}\n`,
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

function SettingsSection({ onToast }: { onToast?: ToastFn }) {
  const [s, setS] = useState<GameSettings>(() => getSettings());
  const [copied, setCopied] = useState(false);
  const hapticsAvailable = hapticSupported();

  function patch(p: Partial<GameSettings>, msg?: string) {
    const next = updateSettings(p);
    setS({ ...next });
    if (msg) notify(msg, 'success', onToast);
  }

  async function handleOrientation(mode: OrientationMode) {
    if (s.orientation === mode) return;
    patch({ orientation: mode }, mode === 'portrait' ? 'Portrait locked' : 'Landscape locked');
    await applyOrientation(mode);
    notify(
      mode === 'portrait'
        ? 'Portrait applied in the mobile app.'
        : 'Landscape applied in the mobile app. Desktop browsers follow the window.',
      'info',
      onToast,
    );
  }

  function copyEmail() {
    try {
      void navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify('Support email copied', 'success', onToast);
    } catch {
      notify('Could not copy — long-press to select', 'error', onToast);
    }
  }

  return (
    <div className="space-y-4 lg:space-y-1.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-900 pb-3 lg:pb-1.5">
        <h3 className="text-sm lg:text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Smartphone className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" /> Settings
        </h3>
        <span className="text-xs text-slate-500 font-mono">Saved on this device</span>
      </div>

      {/* HELP & SUPPORT */}
      <Card icon={Bug} iconClass="text-rose-400" title="Help & Support">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs lg:text-[11px] text-slate-300 font-semibold">Report an issue</p>
            <p className="text-[11px] text-slate-500">Email us for any issue — we reply personally.</p>
          </div>
          <a
            href={reportIssueHref()}
            className="shrink-0 px-3 lg:px-2 py-1.5 lg:py-1 text-[11px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg hover:bg-rose-500/20 transition flex items-center gap-1.5"
          >
            <Mail className="w-3 h-3" /> Email Us
          </a>
        </div>
        <button
          type="button"
          onClick={copyEmail}
          className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800/60 hover:border-slate-700 transition flex items-center justify-between gap-2"
          title="Copy support email"
        >
          <span className="text-[11px] text-slate-400 font-mono truncate">{SUPPORT_EMAIL}</span>
          <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0">{copied ? 'Copied ✓' : 'Copy'}</span>
        </button>
      </Card>

      {/* AUDIO */}
      <Card icon={Volume2} iconClass="text-emerald-400" title="Audio">
        <SettingRow label="Music" hint="Ambient arena soundtrack">
          <Switch
            checked={s.music}
            onCheckedChange={(v) => patch({ music: v }, v ? 'Music on' : 'Music off')}
          />
        </SettingRow>
        <SettingRow label="Sound effects" hint="Clicks, chip pickup, cash-out, elimination">
          <Switch
            checked={s.sound}
            onCheckedChange={(v) => patch({ sound: v }, v ? 'Sound on' : 'Sound off')}
          />
        </SettingRow>
      </Card>

      {/* MOBILE */}
      <Card icon={Smartphone} iconClass="text-sky-400" title="Mobile">
        <SettingRow
          label="Orientation"
          hint="Portrait is the default and recommended for one-hand play"
        >
          <div className="flex rounded-lg border border-slate-700/60 overflow-hidden shrink-0">
            {(['portrait', 'landscape'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleOrientation(m)}
                className={`px-3 lg:px-2 py-1.5 lg:py-1 text-[11px] font-bold capitalize transition cursor-pointer ${
                  s.orientation === m
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow
          label="Performance mode"
          hint="Renders at lower resolution — smoother on low-end phones, saves battery"
        >
          <Switch
            checked={s.perfMode}
            onCheckedChange={(v) => patch({ perfMode: v }, v ? 'Performance mode on' : 'Performance mode off')}
          />
        </SettingRow>
        <SettingRow
          label="Vibration"
          hint={hapticsAvailable ? 'Haptic feedback on death and cash-out' : 'Not supported on this device'}
        >
          <Switch
            checked={s.haptics && hapticsAvailable}
            disabled={!hapticsAvailable}
            onCheckedChange={(v) => {
              patch({ haptics: v }, v ? 'Vibration on' : 'Vibration off');
              if (v) haptic(HAPTIC.tickOn);
            }}
          />
        </SettingRow>
      </Card>

      {/* LEGAL & DATA */}
      <Card icon={ShieldCheck} iconClass="text-amber-400" title="Legal & Data">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs lg:text-[11px] text-slate-300 font-semibold">Privacy Policy</p>
            <p className="text-[11px] text-slate-500">What we collect and how it is protected</p>
          </div>
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 px-3 lg:px-2 py-1.5 lg:py-1 text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg hover:bg-amber-500/20 transition"
          >
            Open
          </a>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs lg:text-[11px] text-slate-300 font-semibold">Delete account & data</p>
            <p className="text-[11px] text-slate-500">Self-service in Profile → Delete Account, or email us</p>
          </div>
          <Trash2 className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-1" />
        </div>
        <p className="text-[11px] text-slate-500">
          Data access or removal requests: <span className="text-slate-300 font-mono">{SUPPORT_EMAIL}</span>
        </p>
      </Card>

      {/* ABOUT */}
      <Card icon={Info} iconClass="text-indigo-400" title="About">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs lg:text-[11px] text-slate-300 font-semibold">Venom Arena {APP_VERSION}</p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <BadgeCheck className="w-3 h-3 text-indigo-400" /> A {APP_ENTITY} production
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Season resets Jan 1
          </span>
        </div>
      </Card>

      {/* ROADMAP — honest chips, no fake controls */}
      <div className="p-3 lg:p-1.5 rounded-xl border border-slate-900 bg-slate-900/10 flex items-center gap-2 flex-wrap">
        <Gauge className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Coming soon:</span>
        {['Push notifications', 'More languages', 'Cloud settings sync'].map((x) => (
          <span key={x} className="px-2 py-0.5 rounded-full border border-slate-800 text-[10px] font-bold text-slate-500 bg-slate-950/40">
            {x}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-slate-600 justify-center pb-1">
        <Music className="w-3 h-3" />
        Audio engine starts after your first tap (browser autoplay rules).
      </div>
    </div>
  );
}

export { SettingsSection };
