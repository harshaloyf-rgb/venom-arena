'use client';

import { ScrollText } from 'lucide-react';
import { PanelSkeleton } from '../_panel-primitives';
import { timeAgo } from '@/lib/date-utils';
import { ACTIVITY_ICONS } from './_types';
import type { ActivityEntry } from './_types';

interface ClanActivityProps {
  activities: ActivityEntry[];
  activitiesLoading: boolean;
}

export function ClanActivity({ activities, activitiesLoading }: ClanActivityProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-2 mb-1"><ScrollText className="w-4 h-4 text-emerald-400" /><h4 className="text-sm font-bold text-white">Syndicate Activity Log</h4></div>
        <p className="text-[11px] text-slate-400">Track all clan events — joins, leaves, deposits, promotions, and challenge completions.</p>
      </div>
      {activitiesLoading ? <PanelSkeleton count={5} height="h-10" /> : (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
          {activities.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500"><ScrollText className="w-8 h-8 mx-auto mb-2 opacity-40" />No activity yet.</div>
          ) : (
            <ol className="divide-y divide-slate-900 max-h-[400px] overflow-y-auto va-scroll">
              {activities.map((a) => {
                const icon = ACTIVITY_ICONS[a.type] || '\u2022';
                return (
                  <li key={a.id} className="px-4 py-2.5 text-sm flex items-center gap-3">
                    <span className="text-base shrink-0" aria-hidden>{icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-white font-bold">{a.actorName}</span>
                      <span className="text-xs text-slate-500 font-mono ml-1">{a.actorTag}</span>
                      {a.detail && <span className="text-xs text-slate-400"> {a.detail}</span>}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{timeAgo(new Date(a.createdAt))}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
