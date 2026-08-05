'use client';

import React from 'react';

// ── Short-form chip formatter for tier tables ──
export function fmtShort(n: number): string {
  if (n === 0) return 'FREE';
  const full = `${n.toLocaleString()}c`;
  if (n >= 1_000_000_000) return `${full} (${(n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Bc)`;
  if (n >= 1_000_000) return `${full} (${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Mc)`;
  if (n >= 1_000) return `${full} (${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}Kc)`;
  return full;
}

export function Section({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
      <h3 className={`flex items-center gap-2 font-bold text-sm ${accent}`}>
        {icon} {title}
      </h3>
      <div className="text-slate-300 text-xs leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export function InfoCard({ title, accent, className, children }: { title: React.ReactNode; accent: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 ${className ?? ''}`}>
      <span className={`font-bold ${accent} block text-xs mb-1`}>{title}</span>
      <div className="text-slate-400 text-[11px] leading-relaxed">{children}</div>
    </div>
  );
}

export function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
      <h4 className="text-xs font-bold text-white">
        <span className="text-emerald-400 font-mono mr-1.5">Q.</span>{q}
      </h4>
      <p className="text-[11.5px] text-slate-400 mt-1.5 leading-relaxed pl-5">{a}</p>
    </div>
  );
}
