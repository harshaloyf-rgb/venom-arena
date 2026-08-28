'use client';

import { Swords, Award, Check, Loader2, Target } from 'lucide-react';
import { PanelSkeleton } from '../_panel-primitives';
import type { ClanChallenge } from './_types';
import { CHALLENGE_ICONS } from './_types';

interface ClanChallengesProps {
  challenges: ClanChallenge[];
  challengesLoading: boolean;
  canManage: boolean;
  actionBusy: string;
  onClaim: (challengeId: string) => void;
}

export function ClanChallenges({
  challenges, challengesLoading, canManage, actionBusy, onClaim,
}: ClanChallengesProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 lg:p-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-2 mb-1 lg:mb-0"><Swords className="w-4 h-4 lg:w-3 lg:h-3 text-amber-400" /><h4 className="text-sm lg:text-[11px] font-bold text-white">Weekly Syndicate Challenges</h4></div>
        <p className="text-[11px] text-slate-400">Complete challenges to earn bonus treasury chips! Resets every Monday. {canManage ? 'Leaders/Co-Leaders can claim rewards.' : 'Ask a Leader to claim.'}</p>
      </div>
      {challengesLoading ? <PanelSkeleton count={3} height="h-32" /> : (
        <div className="space-y-3 lg:space-y-1">
          {challenges.length === 0 ? (
            <div className="p-6 lg:p-3 text-center text-xs lg:text-[11px] text-slate-500"><Swords className="w-8 h-8 lg:w-5 lg:h-5 mx-auto mb-2 lg:mb-0.5 opacity-40" />Challenges will appear when your clan is active.</div>
          ) : challenges.map((ch) => {
            const pct = Math.min(100, Math.floor((ch.progress / ch.target) * 100));
            const done = ch.progress >= ch.target;
            const Icon = CHALLENGE_ICONS[ch.type] || Target;
            return (
              <div key={ch.id} className={`p-4 lg:p-1.5 rounded-2xl border transition ${ch.claimed ? 'border-emerald-500/30 bg-emerald-500/5' : done ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 lg:w-5 lg:h-5 rounded-xl flex items-center justify-center shrink-0 ${ch.claimed ? 'bg-emerald-500/20' : done ? 'bg-amber-500/20' : 'bg-slate-900'}`}>
                      {ch.claimed ? <Check className="w-4.5 h-4.5 lg:w-3 lg:h-3 text-emerald-400" /> : <Icon className={`w-4.5 h-4.5 lg:w-3 lg:h-3 ${done ? 'text-amber-400' : 'text-slate-500'}`} />}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs lg:text-[11px] font-bold text-white">{ch.title}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ch.description}</p>
                      <div className="flex items-center gap-3 lg:gap-1 mt-2 lg:mt-1">
                        <span className="text-[10px] lg:text-[11px] font-mono text-slate-500">{ch.progress.toLocaleString()} / {ch.target.toLocaleString()}</span>
                        <span className="text-[10px] lg:text-[11px] font-mono text-emerald-400">+{ch.reward.toLocaleString()}c</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {done && !ch.claimed && canManage && (
                      <button type="button" onClick={() => onClaim(ch.id)} disabled={actionBusy === 'claim'} className="px-3 lg:px-1.5 py-2 lg:py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-50">
                        {actionBusy === 'claim' ? <Loader2 className="w-3 h-3 lg:w-2.5 lg:h-2.5 animate-spin" /> : <Award className="w-3 h-3 lg:w-2.5 lg:h-2.5" />} Claim
                      </button>
                    )}
                    {ch.claimed && <span className="text-[10px] lg:text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 lg:px-1.5 py-1 lg:py-0.5 rounded">Claimed</span>}
                  </div>
                </div>
                <div className="mt-3 lg:mt-1 w-full h-2 lg:h-1 bg-slate-900 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${ch.claimed ? 'bg-emerald-500' : done ? 'bg-amber-400' : 'bg-amber-600/60'}`} style={{ width: `${pct}%` }} />
                </div>
                {ch.claimed && ch.claimedBy && <div className="text-[9px] lg:text-[11px] text-slate-500 mt-1.5 lg:mt-0 font-mono">Claimed by {ch.claimedBy}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
