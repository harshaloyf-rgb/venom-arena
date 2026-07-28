'use client';

import { toast } from 'sonner';
import type { ReactNode } from 'react';

// ----------------------------------------------------------------------------
// Shared visual primitives used by all 8 panels in this directory.
// These reproduce the dark-slate / indigo-accent design language of the
// original Venom Arena panels.
// ----------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'info';
export type ToastFn = (msg: string, type?: ToastType) => void;

export function notify(
  msg: string,
  type: ToastType = 'success',
  onToast?: ToastFn,
): void {
  if (onToast) {
    onToast(msg, type);
    return;
  }
  if (type === 'error') toast.error(msg);
  else if (type === 'info') toast.info(msg);
  else toast.success(msg);
}

/** Outer container card for a whole panel. */
export function PanelShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

/** Decorative blurred color blob (for backgrounds). */
export function GlowBlob({
  className = '',
  color = 'bg-indigo-500/10',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full blur-3xl ${color} ${className}`}
    />
  );
}

/** Tiny mono label like "GLOBAL RANK" — matches original tracking-widest style. */
export function MicroLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`text-[10px] font-mono uppercase tracking-widest text-slate-500 ${className}`}
    >
      {children}
    </span>
  );
}

/** Panel heading: big white sans-black tracking-tight title. */
export function PanelTitle({
  icon,
  title,
  subtitle,
  right,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
          {icon}
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-400 font-sans mt-1 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

/** Primary button — indigo-600, hover indigo-500, mono-ish caps. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

/** Outline / ghost button — slate border, slate-300 text. */
export function GhostButton({
  children,
  onClick,
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-xl text-[11px] uppercase tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

/** Skeleton placeholder used during loading. */
export function PanelSkeleton({ count = 6, height = 'h-24' }: { count?: number; height?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} w-full rounded-2xl border border-slate-800/80 bg-slate-900/60 animate-pulse`}
        />
      ))}
    </div>
  );
}

/** Inline error card with retry button. */
export function ErrorCard({
  message,
  onRetry,
  retryLabel = 'Retry',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-center">
      <p className="text-sm text-rose-300 mb-3">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function NotSignedIn() {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 text-center max-w-md mx-auto">
      <p className="text-sm text-slate-400">Not signed in.</p>
    </div>
  );
}
