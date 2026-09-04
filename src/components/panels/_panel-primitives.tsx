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

export function NotSignedIn() {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 text-center max-w-md mx-auto">
      <p className="text-sm text-slate-400">Not signed in.</p>
    </div>
  );
}
