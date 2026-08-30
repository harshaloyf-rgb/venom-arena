'use client';

import { useState } from 'react';
import {
  Shield,
  Users,
  Film,
  Coins,
  ShieldAlert,
  Crown,
  Settings,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Lock,
  Server,
  Trophy,
} from 'lucide-react';

import type { GuideSection } from './guide/_helpers';
import { SectionHeader } from './guide/_helpers';
import { SectionAccessAuth } from './guide/section-access-auth';
import { SectionPlayerManagement } from './guide/section-player-mgmt';
import { SectionContentModeration } from './guide/section-moderation';
import { SectionEconomyOverview } from './guide/section-economy';
import { SectionClanGovernance } from './guide/section-clan-governance';
import { SectionChampionships } from './guide/section-championships';
import { SectionConfiguration } from './guide/section-configuration';
import { SectionSecurityProtocols } from './guide/section-security';
import { SectionIncidentResponse } from './guide/section-incident-response';

// ── Section Definitions ─────────────────────────────────────────────────────

const SECTIONS: GuideSection[] = [
  {
    id: 'access-auth',
    icon: <Shield className="h-4.5 w-4.5" />,
    title: 'Access & Authentication',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    content: <SectionAccessAuth />,
  },
  {
    id: 'player-management',
    icon: <Users className="h-4.5 w-4.5" />,
    title: 'Player Management',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    content: <SectionPlayerManagement />,
  },
  {
    id: 'content-moderation',
    icon: <Film className="h-4.5 w-4.5" />,
    title: 'Content Moderation',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    content: <SectionContentModeration />,
  },
  {
    id: 'economy-overview',
    icon: <Coins className="h-4.5 w-4.5" />,
    title: 'Economy Overview',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    content: <SectionEconomyOverview />,
  },
  {
    id: 'clan-governance',
    icon: <Crown className="h-4.5 w-4.5" />,
    title: 'Clan Governance',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    content: <SectionClanGovernance />,
  },
  {
    id: 'championships',
    icon: <Trophy className="h-4.5 w-4.5" />,
    title: 'Championships',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    content: <SectionChampionships />,
  },
  {
    id: 'configuration',
    icon: <Settings className="h-4.5 w-4.5" />,
    title: 'Configuration',
    iconColor: 'text-slate-300',
    iconBg: 'bg-slate-700/30',
    borderColor: 'border-slate-600/30',
    content: <SectionConfiguration />,
  },
  {
    id: 'security-protocols',
    icon: <Lock className="h-4.5 w-4.5" />,
    title: 'Security Protocols',
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    content: <SectionSecurityProtocols />,
  },
  {
    id: 'incident-response',
    icon: <ShieldAlert className="h-4.5 w-4.5" />,
    title: 'Incident Response',
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    content: <SectionIncidentResponse />,
  },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function GuideTab() {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(['access-auth']),
  );

  const toggle = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(SECTIONS.map((s) => s.id)));
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  return (
    <div className="space-y-4 lg:space-y-1">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-1">
        <div className="flex items-center gap-2.5 lg:gap-1">
          <span className="flex items-center justify-center h-9 w-9 lg:h-6 lg:w-6 rounded-lg bg-slate-800 border border-slate-700/50">
            <BookOpen className="h-4.5 w-4.5 lg:h-3 lg:w-3 text-slate-300" />
          </span>
          <div>
            <h2 className="text-sm lg:text-[11px] font-bold text-white tracking-tight">
              Admin Operations Guide
            </h2>
            <p className="text-[11px] text-slate-500">
              Reference manual for all admin tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-1 sm:ml-auto">
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronDown className="h-3 w-3" />
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-3 w-3" />
            Collapse All
          </button>
        </div>
      </div>

      {/* ── Sections ──────────────────────────────────────────────────────── */}
      <div className="max-h-[600px] lg:max-h-[400px] overflow-y-auto space-y-2 lg:space-y-1 custom-scrollbar-guide pr-1">
        {SECTIONS.map((section) => {
          const isOpen = openSections.has(section.id);
          return (
            <div
              key={section.id}
              className={`rounded-2xl border transition-colors duration-200 ${
                isOpen
                  ? `${section.borderColor} bg-slate-900/60`
                  : 'border-slate-800/60 bg-slate-900/30'
              }`}
            >
              <SectionHeader
                icon={section.icon}
                title={section.title}
                iconColor={section.iconColor}
                iconBg={section.iconBg}
                open={isOpen}
                onClick={() => toggle(section.id)}
              />

              {isOpen && (
                <div className="px-5 lg:px-2 pb-5 lg:pb-2 pt-0 border-t border-slate-800/40">
                  <div className="pt-4 lg:pt-1">{section.content}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[10px] lg:text-[11px] text-slate-600 pt-1">
        <span className="flex items-center gap-1.5">
          <Server className="h-3 w-3" />
          Venom Arena Admin v1.0
        </span>
        <span>
          {SECTIONS.length} sections · All content is static — no server requests
        </span>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar-guide::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar-guide::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-guide::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.3);
          border-radius: 999px;
        }
        .custom-scrollbar-guide::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.5);
        }
      `}</style>
    </div>
  );
}
