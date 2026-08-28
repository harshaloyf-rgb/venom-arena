'use client';

import { Loader2 } from 'lucide-react';
import { fmtChipsIndian as fmtChips } from '@/lib/format-chips';

interface HistoryEntry {
  id: string;
  type: string;
  reward: number;
  detail: string;
  createdAt: string;
}

interface HistoryTabProps {
  history: HistoryEntry[];
  historyTotal: number;
  historyLoading: boolean;
  historyPage: number;
  onFetchHistory: (page: number) => void;
}

export function HistoryTab({ history, historyTotal, historyLoading, historyPage, onFetchHistory }: HistoryTabProps) {
  return (
    <div className="space-y-4 lg:space-y-1">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:p-1 text-[11px] text-slate-300 leading-relaxed">
        <strong>UNIFIED CLAIM HISTORY</strong><br />
        All your rewards in one timeline — daily, hourly, spins, streak milestones, promos, and video ads.
      </div>

      {historyLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-slate-500 animate-spin" /></div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-xs text-slate-500">No claim history yet. Start claiming daily rewards!</div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 lg:px-1.5 lg:py-1 border-b border-slate-800 bg-slate-950 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-3">Type</div>
              <div className="col-span-4">Detail</div>
              <div className="col-span-2 text-right">Reward</div>
              <div className="col-span-2 text-right">Date</div>
            </div>
            <ol className="divide-y divide-slate-900 max-h-96 lg:max-h-48 overflow-y-auto va-scroll">
              {history.map((e, i) => {
                const typeIcon = e.type === 'daily' ? '📅' : e.type === 'hourly' ? '⏰' : e.type === 'spin' ? '🎰' : e.type === 'streak_milestone' ? '🏆' : e.type === 'promo' ? '🎟️' : '📺';
                return (
                  <li key={e.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 text-sm lg:px-1.5 lg:py-1 lg:text-[11px] hover:bg-slate-900/40 transition-colors">
                    <div className="col-span-1 text-slate-500 font-mono text-xs lg:text-[10px]">{historyPage * 30 + i + 1}</div>
                    <div className="col-span-3 flex items-center gap-1.5">
                      <span>{typeIcon}</span>
                      <span className="text-[11px] font-bold uppercase text-slate-300">{e.type.replace('_', ' ')}</span>
                    </div>
                    <div className="col-span-4 text-xs lg:text-[11px] text-slate-400">{e.detail}</div>
                    <div className="col-span-2 text-right font-mono font-bold text-emerald-400 text-xs lg:text-[11px]">+{fmtChips(e.reward)}c</div>
                    <div className="col-span-2 text-right text-[11px] font-mono text-slate-500">
                      {new Date(e.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          {historyTotal > 30 && (
            <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={() => onFetchHistory(Math.max(0, historyPage - 1))} disabled={historyPage === 0}
                className="px-3 py-1.5 lg:px-1.5 lg:py-0.5 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-lg text-xs lg:text-[11px] uppercase tracking-wider transition disabled:opacity-40">
                ← Prev
              </button>
              <span className="text-xs lg:text-[11px] text-slate-500 font-mono">Page {historyPage + 1} of {Math.ceil(historyTotal / 30)}</span>
              <button type="button" onClick={() => onFetchHistory(historyPage + 1)} disabled={(historyPage + 1) * 30 >= historyTotal}
                className="px-3 py-1.5 lg:px-1.5 lg:py-0.5 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-lg text-xs lg:text-[11px] uppercase tracking-wider transition disabled:opacity-40">
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
