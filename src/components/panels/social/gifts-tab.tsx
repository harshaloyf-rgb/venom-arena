'use client';

import { Clock } from 'lucide-react';
import { PanelSkeleton } from '../_panel-primitives';
import { timeAgo } from '@/lib/date-utils';
import type { GiftEntry } from './_types';

interface GiftsTabProps {
  giftHistory: GiftEntry[];
  giftHistoryLoading: boolean;
  giftHistoryFilter: 'all' | 'sent' | 'received';
  onFilterChange: (t: 'all' | 'sent' | 'received') => void;
}

export function GiftsTab({ giftHistory, giftHistoryLoading, giftHistoryFilter, onFilterChange }: GiftsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60">
        {(['all', 'sent', 'received'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onFilterChange(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition border ${giftHistoryFilter === t ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
          >
            {t === 'all' ? 'Show All' : t === 'sent' ? '📤 Sent' : '📥 Received'}
          </button>
        ))}
      </div>

      {giftHistoryLoading ? (
        <PanelSkeleton count={5} />
      ) : giftHistory.length === 0 ? (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-white">No Gift History</h4>
          <p className="text-xs text-slate-400 mt-1">
            Send gifts to your friends from the Friends tab. They will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll rounded-2xl border border-slate-800/60 bg-slate-950/80">
          {giftHistory.map((g) => (
            <li key={g.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-base shrink-0" aria-hidden>{g.direction === 'sent' ? '📤' : '📥'}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {g.direction === 'sent' ? 'To' : 'From'}: {g.player.name}
                    <span className="text-[10px] font-mono text-slate-500 ml-1.5">#{g.player.userTag}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">{timeAgo(g.createdAt)}</div>
                </div>
              </div>
              <span className={`text-xs font-bold font-mono shrink-0 ${g.direction === 'sent' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {g.direction === 'sent' ? '-' : '+'}{g.amount}c
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
