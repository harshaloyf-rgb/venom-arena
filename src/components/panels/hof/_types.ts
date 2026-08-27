'use client';

import { fmtChipsIndian as fmtChips } from '@/lib/format-chips';
import {
  HALL_OF_FAME_TIERS,
  countryFlag,
  type InspectedPlayer,
} from '@/lib/game-config';

// ── Types ───────────────────────────────────────────────────────────────────

export type Tab = 'my-hof' | 'champions' | 'milestones';

export interface HallOfFameProps {
  onToast?: import('../_panel-primitives').ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

export interface InducteeEntry {
  id: string;
  playerId: string;
  playerTag: string;
  playerName: string;
  country: string;
  level: number;
  clanTag: string;
  inductionType: string;
  milestoneTierId: string | null;
  championshipYear: number | null;
  championshipRank: number | null;
  hofBadge: string | null;
  title: string | null;
  chipsAtInduction: number;
  inductedAt: string;
}

export interface MyEntry {
  id: string;
  inductionType: string;
  milestoneTierId: string | null;
  championshipYear: number | null;
  championshipRank: number | null;
  hofBadge: string | null;
  title: string | null;
  chipsAtInduction: number;
  inductedAt: string;
}

export interface NextMilestone {
  name: string;
  badge: string;
  chips: number;
  chipsNeeded: number;
}

export interface HofStats {
  totalInductedPlayers: number;
  totalEntries: number;
  byType: { milestone?: number; championship?: number };
  milestoneFirstAchievers: Record<string, { playerName: string; userTag: string; country: string; inductedAt: string } | null>;
  milestoneCounts: Record<string, number>;
  championshipYears: { year: number; inducteeCount: number }[];
}

// ── Re-exported constants ────────────────────────────────────────────────────

export { HALL_OF_FAME_TIERS, countryFlag };

// ── Helpers ─────────────────────────────────────────────────────────────────

export function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function badgeIcon(badge: string | null | undefined) {
  if (!badge) return '🏅';
  switch (badge) {
    case 'crown': return '👑';
    case 'silver': return '🥈';
    case 'bronze': return '🥉';
    case 'contender': return '🛡️';
    default: return badge;
  }
}

export { fmtChips };
