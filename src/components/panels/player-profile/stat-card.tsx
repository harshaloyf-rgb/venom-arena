'use client';

export function StatCard({
  label,
  subLabel,
  value,
  icon,
  valueClass,
}: {
  label: string;
  subLabel: string;
  value: string;
  icon: React.ReactNode;
  valueClass: string;
}) {
  return (
    <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 lg:p-2.5 flex flex-col justify-between hover:border-slate-800 transition shadow">
      <div className="flex items-center justify-between text-slate-400 mb-2 lg:mb-1">
        <span className="text-xs lg:text-[11px] font-sans">{label}</span>
        {icon}
      </div>
      <div>
        <span
          className={`text-xl lg:text-sm font-bold font-mono tracking-tight block ${valueClass}`}
        >
          {value}
        </span>
        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">
          {subLabel}
        </span>
      </div>
    </div>
  );
}

export function CapCard({
  icon,
  label,
  value,
  barClass,
  pct,
  leftLabel,
  rightLabel,
  rightClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  barClass: string;
  pct: number;
  leftLabel: string;
  rightLabel: string;
  rightClass: string;
}) {
  return (
    <div className="bg-slate-900/80 p-4 lg:p-2.5 rounded-xl border border-slate-800 space-y-2 lg:space-y-1">
      <div className="flex justify-between items-center text-xs lg:text-[11px]">
        <span className="text-slate-400 font-bold uppercase font-sans flex items-center gap-1">
          {icon} {label}
        </span>
        <span className="font-mono font-bold text-slate-300">{value}</span>
      </div>
      <div className="w-full h-2.5 lg:h-1.5 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barClass} rounded-full`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
        <span>{leftLabel}</span>
        <span className={rightClass}>{rightLabel}</span>
      </div>
    </div>
  );
}
