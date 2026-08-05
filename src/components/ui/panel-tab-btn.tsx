'use client';

import type { LucideIcon } from 'lucide-react';

interface PanelTabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  /** Tailwind color name without slash — e.g. 'violet', 'amber', 'emerald', 'indigo', 'yellow'. Default: 'indigo' */
  color?: string;
}

// Tailwind color palette: {color}-300 for text, {color}-500 for bg/border
const COLOR_MAP: Record<string, { text: string; base: string }> = {
  red:     { text: '#fca5a5', base: '#ef4444' },
  orange:  { text: '#fdba74', base: '#f97316' },
  amber:   { text: '#fcd34d', base: '#f59e0b' },
  yellow:  { text: '#fde047', base: '#eab308' },
  lime:    { text: '#bef264', base: '#84cc16' },
  green:   { text: '#86efac', base: '#22c55e' },
  emerald: { text: '#6ee7b7', base: '#10b981' },
  teal:    { text: '#5eead4', base: '#14b8a6' },
  cyan:    { text: '#67e8f9', base: '#06b6d4' },
  sky:     { text: '#7dd3fc', base: '#0ea5e9' },
  blue:    { text: '#93c5fd', base: '#3b82f6' },
  indigo:  { text: '#a5b4fc', base: '#6366f1' },
  violet:  { text: '#c4b5fd', base: '#8b5cf6' },
  purple:  { text: '#d8b4fe', base: '#a855f7' },
  fuchsia: { text: '#f0abfc', base: '#d946ef' },
  pink:    { text: '#f9a8d4', base: '#ec4899' },
  rose:    { text: '#fda4af', base: '#f43f5e' },
};

/**
 * Shared panel tab button used across all panel components.
 * Replaces inline TabBtn / HoFTabBtn / SubTabBtn / ClanTabBtn.
 */
export function PanelTabBtn({
  active,
  onClick,
  icon: Icon,
  label,
  color = 'indigo',
}: PanelTabBtnProps) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.indigo;

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border whitespace-nowrap ' +
        (active
          ? ''
          : 'text-slate-500 hover:text-slate-300 border-transparent')
      }
      style={
        active
          ? {
              backgroundColor: c.base + '33',   /* ~20% opacity */
              borderColor: c.base + '66',        /* ~40% opacity */
              color: c.text,
              borderWidth: '1px',
            }
          : undefined
      }
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
