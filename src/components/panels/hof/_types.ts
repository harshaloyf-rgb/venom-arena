'use client';

import { fmtChipsIndian as fmtChips } from '@/lib/format-chips';
import {
  HALL_OF_FAME_TIERS,
  INITIAL_COMMENTARY,
  COMMENTARY_NAMES,
  countryFlag,
  type InspectedPlayer,
} from '@/lib/game-config';

// ── Types ───────────────────────────────────────────────────────────────────

export type Tab = 'my-hof' | 'champions' | 'milestones' | 'ticker';
export type CommentaryFilter = 'all' | 'extractions' | 'eliminations' | 'milestones';

export interface HallOfFameProps {
  onToast?: import('./_panel-primitives').ToastFn;
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

export { HALL_OF_FAME_TIERS, INITIAL_COMMENTARY, COMMENTARY_NAMES, countryFlag };

// ── Demo data ───────────────────────────────────────────────────────────────

export const DEMO_MILESTONES: InducteeEntry[] = [
  // 1 Lakh tier
  { id: 'dm-1', playerId: 'dm-1', playerTag: '#IND-104', playerName: 'Rookie_Striker', country: 'IN', level: 12, clanTag: 'VIPER', inductionType: 'milestone', milestoneTierId: 't-1lakh', championshipYear: null, championshipRank: null, hofBadge: 'bronze_elite', title: '🥉 Bronze Elite', chipsAtInduction: 1_12_500, inductedAt: '2026-01-02T09:15:00Z' },
  { id: 'dm-2', playerId: 'dm-2', playerTag: '#BRA-217', playerName: 'Cobra_Brasil', country: 'BR', level: 10, clanTag: 'FANG', inductionType: 'milestone', milestoneTierId: 't-1lakh', championshipYear: null, championshipRank: null, hofBadge: 'bronze_elite', title: '🥉 Bronze Elite', chipsAtInduction: 1_05_200, inductedAt: '2026-01-02T14:30:00Z' },
  { id: 'dm-3', playerId: 'dm-3', playerTag: '#JPN-456', playerName: 'Sakura_Viper', country: 'JP', level: 9, clanTag: '', inductionType: 'milestone', milestoneTierId: 't-1lakh', championshipYear: null, championshipRank: null, hofBadge: 'bronze_elite', title: '🥉 Bronze Elite', chipsAtInduction: 1_01_800, inductedAt: '2026-01-03T08:00:00Z' },
  // 5 Lakh tier
  { id: 'dm-4', playerId: 'dm-4', playerTag: '#USA-402', playerName: 'Viper_Zero', country: 'US', level: 22, clanTag: 'APEX', inductionType: 'milestone', milestoneTierId: 't-5lakh', championshipYear: null, championshipRank: null, hofBadge: 'silver_commander', title: '🥈 Silver Commander', chipsAtInduction: 5_25_000, inductedAt: '2026-01-07T14:40:00Z' },
  { id: 'dm-5', playerId: 'dm-5', playerTag: '#IND-055', playerName: 'Delhi_King', country: 'IN', level: 19, clanTag: 'NAGA', inductionType: 'milestone', milestoneTierId: 't-5lakh', championshipYear: null, championshipRank: null, hofBadge: 'silver_commander', title: '🥈 Silver Commander', chipsAtInduction: 5_10_300, inductedAt: '2026-01-08T11:20:00Z' },
  // 10 Lakh tier
  { id: 'dm-6', playerId: 'dm-6', playerTag: '#KOR-114', playerName: 'K-Snake_Master', country: 'KR', level: 28, clanTag: 'DRAGON', inductionType: 'milestone', milestoneTierId: 't-10lakh', championshipYear: null, championshipRank: null, hofBadge: 'gold_apex_vanguard', title: '🥇 Gold Apex Vanguard', chipsAtInduction: 10_50_000, inductedAt: '2026-01-11T06:30:00Z' },
  { id: 'dm-7', playerId: 'dm-7', playerTag: '#GB-387', playerName: 'SidewinderAlpha', country: 'GB', level: 25, clanTag: 'COBRA', inductionType: 'milestone', milestoneTierId: 't-10lakh', championshipYear: null, championshipRank: null, hofBadge: 'gold_apex_vanguard', title: '🥇 Gold Apex Vanguard', chipsAtInduction: 10_12_000, inductedAt: '2026-01-12T16:45:00Z' },
  // 25 Lakh tier
  { id: 'dm-8', playerId: 'dm-8', playerTag: '#USA-882', playerName: 'Apex_Viper', country: 'US', level: 35, clanTag: 'VIPER', inductionType: 'milestone', milestoneTierId: 't-25lakh', championshipYear: null, championshipRank: null, hofBadge: 'platinum_sovereign', title: '💎 Platinum Sovereign', chipsAtInduction: 25_80_000, inductedAt: '2026-01-16T23:10:00Z' },
  // 50 Lakh tier
  { id: 'dm-9', playerId: 'dm-9', playerTag: '#JPN-309', playerName: 'Shadow_Ninja', country: 'JP', level: 42, clanTag: '', inductionType: 'milestone', milestoneTierId: 't-50lakh', championshipYear: null, championshipRank: null, hofBadge: 'diamond_warlord', title: '🔮 Diamond Warlord', chipsAtInduction: 52_00_000, inductedAt: '2026-01-19T11:22:00Z' },
  // 1 Crore tier
  { id: 'dm-10', playerId: 'dm-10', playerTag: '#IND-001', playerName: 'Hari', country: 'IN', level: 55, clanTag: 'OMEGA', inductionType: 'milestone', milestoneTierId: 't-1crore', championshipYear: null, championshipRank: null, hofBadge: 'omega_immortal_god', title: '👑 OMEGA IMMORTAL GOD', chipsAtInduction: 10_200_000, inductedAt: '2026-01-23T17:00:00Z' },
];

export const DEMO_CHAMPIONS = [
  { rank: 1, name: 'Hari', userTag: '#IND-001', country: 'IN', badge: 'crown', title: '👑 2026 WORLD VENOM CHAMPION', chips: 10_000_000, date: '01 Jan 2026' },
  { rank: 2, name: 'Apex_Viper', userTag: '#USA-882', country: 'US', badge: 'silver', title: '🥈 2026 VENOM ARENA OVERLORD', chips: 9_400_000, date: '01 Jan 2026' },
  { rank: 3, name: 'K-Snake_Master', userTag: '#KOR-114', country: 'KR', badge: 'bronze', title: '🥉 2026 ARENA ELITE MASTER', chips: 8_900_000, date: '01 Jan 2026' },
  { rank: 4, name: 'Shadow_Ninja', userTag: '#JPN-309', country: 'JP', badge: 'silver', title: '🥈 VENOM ARENA OVERLORD', chips: 8_200_000, date: '01 Jan 2026' },
  { rank: 5, name: 'Elysium_God', userTag: '#DEU-901', country: 'DE', badge: 'silver', title: '🥈 VENOM ARENA OVERLORD', chips: 6_900_000, date: '01 Jan 2026' },
  { rank: 11, name: 'Delhi_King', userTag: '#IND-003', country: 'IN', badge: 'bronze', title: '🥉 ARENA ELITE MASTER', chips: 4_500_000, date: '01 Jan 2026' },
  { rank: 52, name: 'Challenger_Viper', userTag: '#IND-902', country: 'IN', badge: 'contender', title: '🛡️ CHAMPIONSHIP CONTENDER', chips: 1_200_000, date: '01 Jan 2026' },
];

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
