'use client';

import { useState } from 'react';
import { ScrollText, ChevronDown } from 'lucide-react';
import { PanelSkeleton } from '../_panel-primitives';
import { timeAgo } from '@/lib/date-utils';
import { ACTIVITY_ICONS } from './_types';
import type { ActivityEntry } from './_types';

interface ClanActivityProps {
  activities: ActivityEntry[];
  activitiesLoading: boolean;
}

export function ClanActivity({ activities, activitiesLoading }: ClanActivityProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4 lg:space-y-1">
      <div className="p-4 lg:p-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-2 mb-1 lg:mb-0"><ScrollText className="w-4 h-4 lg:w-3 lg:h-3 text-emerald-400" /><h4 className="text-sm lg:text-[11px] font-bold text-white">Syndicate Activity Log</h4></div>
        <p className="text-[11px] text-slate-400">Track all clan events — joins, leaves, deposits, promotions, and challenge completions.</p>
      </div>
      {activitiesLoading ? <PanelSkeleton count={5} height="h-10" /> : (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
          {activities.length === 0 ? (
            <div className="p-6 lg:p-3 text-center text-xs lg:text-[11px] text-slate-500"><ScrollText className="w-8 h-8 lg:w-5 lg:h-5 mx-auto mb-2 lg:mb-0.5 opacity-40" />No activity yet.</div>
          ) : (
            <div>
              {/* Desktop header row */}
              <div className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:px-1.5 lg:py-1 border-b border-slate-800 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <span className="lg:col-span-1"></span>
                <span className="lg:col-span-3">Actor</span>
                <span className="lg:col-span-6">Detail</span>
                <span className="lg:col-span-2 text-right">Time</span>
              </div>
              <ol className="divide-y divide-slate-900 max-h-[400px] lg:max-h-[200px] overflow-y-auto va-scroll">
                {activities.map((a) => {
                  const icon = ACTIVITY_ICONS[a.type] || '\u2022';
                  const isExpanded = expandedId === a.id;
                  return (
                    <li key={a.id}>
                      {/* Mobile accordion row */}
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className="lg:hidden w-full px-4 py-2.5 text-sm flex items-center gap-3 text-left"
                      >
                        <span className="text-base shrink-0" aria-hidden>{icon}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-white font-bold">{a.actorName}</span>
                          <span className="text-xs text-slate-500 font-mono ml-1">{a.actorTag}</span>
                          {a.detail && <span className="text-xs text-slate-400"> {a.detail}</span>}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">{timeAgo(new Date(a.createdAt))}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Mobile expanded detail */}
                      {isExpanded && a.detail && (
                        <div className="lg:hidden px-4 pb-2.5 text-xs text-slate-400 pl-12">
                          {a.detail}
                        </div>
                      )}

                      {/* Desktop grid row */}
                      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-1 lg:items-center lg:px-1.5 lg:py-1 lg:text-[11px] hover:bg-slate-900/40 transition-colors cursor-pointer">
                        <span className="lg:col-span-1 lg:text-[11px]" aria-hidden>{icon}</span>
                        <span className="lg:col-span-1 text-white font-bold">{a.actorName}</span>
                        <span className="lg:col-span-2 font-mono text-slate-500">{a.actorTag}</span>
                        <span className="lg:col-span-6 text-slate-400">{a.detail || ''}</span>
                        <span className="lg:col-span-2 text-right font-mono text-slate-500">{timeAgo(new Date(a.createdAt))}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
