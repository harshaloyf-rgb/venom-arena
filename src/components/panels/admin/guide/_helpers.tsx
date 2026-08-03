'use client';

import { type ReactNode } from 'react';
import { AlertTriangle, Shield, ChevronDown, ChevronRight } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GuideSection {
  id: string;
  icon: ReactNode;
  title: string;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  content: ReactNode;
}

// ── Sub-components ────────────────────────────────────────────────────────────

export function SectionHeader({
  icon,
  title,
  iconColor,
  iconBg,
  open,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  iconColor: string;
  iconBg: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-slate-800/60 transition-colors duration-150 group cursor-pointer"
    >
      <span
        className={`flex items-center justify-center h-9 w-9 rounded-lg ${iconBg} flex-shrink-0`}
      >
        <span className={iconColor}>{icon}</span>
      </span>
      <span className="flex-1 text-left text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
        {title}
      </span>
      {open ? (
        <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
      )}
    </button>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mt-5 mb-2 first:mt-0">
      {children}
    </h4>
  );
}

export function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
      <span className="text-slate-600 mt-1.5 flex-shrink-0">
        <span className="inline-block h-1 w-1 rounded-full bg-slate-600" />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-300/80 leading-relaxed">{children}</p>
    </div>
  );
}

export function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5">
      <Shield className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-emerald-300/80 leading-relaxed">{children}</p>
    </div>
  );
}

export function EndpointTable({
  rows,
}: {
  rows: { method: string; path: string; desc: string }[];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800/80">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-800/80 bg-slate-900/80">
            <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Method
            </th>
            <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Endpoint
            </th>
            <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-800/40 last:border-0"
            >
              <td className="px-3 py-2">
                <MethodBadge method={row.method} />
              </td>
              <td className="px-3 py-2">
                <code className="text-[11px] font-mono text-slate-300">
                  {row.path}
                </code>
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-400">
                {row.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    POST: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
    PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
    PUT: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold ${colors[method] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}
    >
      {method}
    </span>
  );
}

export function TwoColumnTable({
  rows,
}: {
  rows: { label: string; value: string; note?: string; icon?: ReactNode }[];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800/80">
      <table className="w-full text-left">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-800/40 last:border-0"
            >
              <td className="px-3 py-2 text-[11px] font-medium text-slate-300 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {row.icon}
                  {row.label}
                </span>
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-400">
                {row.value}
                {row.note && (
                  <span className="ml-1.5 text-[10px] text-slate-600">
                    {row.note}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}