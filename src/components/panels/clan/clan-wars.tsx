'use client';

import { Skull, Swords, Search, Lock, Loader2, X } from 'lucide-react';
import { timeAgo } from '@/lib/date-utils';
import { PanelSkeleton } from '../_panel-primitives';
import type { ClanInfo, WarInfo } from './_types';

interface ClanWarsProps {
  playerClanTag: string;
  isLeader: boolean;
  clans: ClanInfo[];
  activeWar: WarInfo | null;
  warLoading: boolean;
  warSearch: string;
  warWager: string;
  actionBusy: string;
  onWarSearchChange: (v: string) => void;
  onWarWagerChange: (v: string) => void;
  onDeclareWar: (targetTag: string) => void;
}

export function ClanWars({
  playerClanTag, isLeader, clans, activeWar, warLoading,
  warSearch, warWager, actionBusy,
  onWarSearchChange, onWarWagerChange, onDeclareWar,
}: ClanWarsProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 lg:p-1.5 rounded-2xl border border-rose-500/20 bg-rose-500/5">
        <div className="flex items-center gap-2 mb-1 lg:mb-0"><Skull className="w-4 h-4 lg:w-3 lg:h-3 text-rose-400" /><h4 className="text-sm lg:text-[11px] font-bold text-white">Clan Wars</h4></div>
        <p className="text-[11px] text-slate-400">Wager treasury chips against rival clans. First to 50 real-player kills wins the pot (bot kills don&apos;t count). Declaring is <strong className="text-rose-300">instant</strong> — the target clan does not get to accept or refuse. {isLeader ? 'You can declare war on other clans.' : 'Only the Leader can declare wars.'}</p>
      </div>
      {/* T50: war lifecycle strip — escrow confused players most */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="p-2.5 lg:p-1 rounded-xl border border-rose-500/20 bg-slate-950/60">
          <p className="text-[10px] lg:text-[11px] font-bold text-rose-300 mb-0.5">1 · Declare &amp; Escrow</p>
          <p className="text-[10px] lg:text-[11px] text-slate-400 leading-relaxed">Leader picks a rival and a wager (min 1,000c). Both treasuries pay in immediately — winner takes the whole pot.</p>
        </div>
        <div className="p-2.5 lg:p-1 rounded-xl border border-rose-500/20 bg-slate-950/60">
          <p className="text-[10px] lg:text-[11px] font-bold text-rose-300 mb-0.5">2 · Fight in Normal Matches</p>
          <p className="text-[10px] lg:text-[11px] text-slate-400 leading-relaxed">No special lobby. Every <strong className="text-slate-200">real-player kill</strong> by any member of either clan scores 1 point (bots don&apos;t count).</p>
        </div>
        <div className="p-2.5 lg:p-1 rounded-xl border border-rose-500/20 bg-slate-950/60">
          <p className="text-[10px] lg:text-[11px] font-bold text-rose-300 mb-0.5">3 · First to 50 Wins</p>
          <p className="text-[10px] lg:text-[11px] text-slate-400 leading-relaxed">The war ends automatically and the winning clan&apos;s treasury receives the entire pot (wager × 2). Buy a <strong className="text-slate-200">War Shield</strong> to block declarations for 7 days.</p>
        </div>
      </div>
      {warLoading ? <PanelSkeleton count={2} height="h-48" /> : activeWar ? (
        <div className="p-4 lg:p-1.5 rounded-2xl border border-rose-500/40 bg-rose-500/5 space-y-4 lg:space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm lg:text-[11px] font-bold text-rose-300 flex items-center gap-2"><Skull className="w-4 h-4 lg:w-3 lg:h-3" /> ACTIVE WAR</h4>
            <span className="text-[10px] lg:text-[11px] font-mono text-slate-500">Started {timeAgo(new Date(activeWar.startedAt))}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-center flex-1 min-w-0">
              <p className={`text-xs lg:text-[11px] font-bold ${activeWar.declarerTag === playerClanTag ? 'text-emerald-400' : 'text-rose-400'}`}>{activeWar.declarerName}</p>
              <p className="text-[10px] lg:text-[11px] font-mono text-slate-500">[{activeWar.declarerTag}]</p>
            </div>
            <div className="text-rose-400 font-black text-lg lg:text-[11px]">VS</div>
            <div className="text-center flex-1 min-w-0">
              <p className={`text-xs lg:text-[11px] font-bold ${activeWar.targetTag === playerClanTag ? 'text-emerald-400' : 'text-rose-400'}`}>{activeWar.targetName}</p>
              <p className="text-[10px] lg:text-[11px] font-mono text-slate-500">[{activeWar.targetTag}]</p>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1 lg:mb-0">
                <span className="text-[10px] lg:text-[11px] font-bold text-white">{activeWar.declarerName}</span>
                <span className="text-[10px] lg:text-[11px] font-mono text-amber-400">{activeWar.declarerScore} / 50</span>
              </div>
              <div className="w-full h-3 lg:h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (activeWar.declarerScore / 50) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1 lg:mb-0">
                <span className="text-[10px] lg:text-[11px] font-bold text-white">{activeWar.targetName}</span>
                <span className="text-[10px] lg:text-[11px] font-mono text-amber-400">{activeWar.targetScore} / 50</span>
              </div>
              <div className="w-full h-3 lg:h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (activeWar.targetScore / 50) * 100)}%` }} />
              </div>
            </div>
          </div>
          <div className="p-3 lg:p-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center">
            <p className="text-[10px] lg:text-[11px] font-mono text-amber-300/70 uppercase tracking-widest">Total Pot</p>
            <p className="text-xl lg:text-[11px] font-mono font-black text-amber-300">{activeWar.totalPot.toLocaleString()}c</p>
            <p className="text-[10px] lg:text-[11px] text-slate-500 mt-1 lg:mt-0">Each clan wagered {activeWar.wager.toLocaleString()}c - Winner takes all</p>
          </div>
          <div className="p-3 lg:p-1.5 rounded-xl border border-slate-800 bg-slate-950/60">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-white">How it works:</strong> Play matches normally. Every <strong className="text-amber-300">real-player kill</strong> by any clan member counts toward your side score (bot eliminations don&apos;t count). First clan to reach <strong className="text-amber-400">50 kills</strong> wins the entire pot. The war ends automatically.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="p-6 lg:p-3 rounded-2xl border border-slate-800 bg-slate-950/60 text-center">
            <Skull className="w-10 h-10 lg:w-5 lg:h-5 text-slate-600 mx-auto mb-2 lg:mb-0.5" />
            <h5 className="text-sm lg:text-[11px] font-bold text-white">No Active War</h5>
            <p className="text-[11px] text-slate-500 mt-1">Your clan is not currently at war. Declare one below!</p>
          </div>
          {isLeader ? (
            <div className="p-4 lg:p-1.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-3 lg:space-y-1">
              <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2"><Swords className="w-4 h-4 lg:w-3 lg:h-3 text-rose-400" /> Declare War</h4>
              <div>
                <label className="text-[10px] lg:text-[11px] font-mono uppercase tracking-widest text-slate-500 block mb-1 lg:mb-0">Target Clan</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" value={warSearch} onChange={(e) => onWarSearchChange(e.target.value.toUpperCase())} placeholder="Search by name or tag..." className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 lg:pl-8 pr-3 lg:pr-1.5 py-2 lg:py-0.5 text-xs lg:text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50" />
                </div>
              </div>
              {warSearch ? (
                <div className="max-h-48 lg:max-h-32 overflow-y-auto va-scroll rounded-xl border border-slate-800 bg-slate-950/80">
                  {clans.filter(c => c.tag !== playerClanTag && (c.name.toLowerCase().includes(warSearch.toLowerCase()) || c.tag.includes(warSearch))).length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-slate-500">No clans found.</div>
                  ) : clans.filter(c => c.tag !== playerClanTag && (c.name.toLowerCase().includes(warSearch.toLowerCase()) || c.tag.includes(warSearch))).map(c => (
                    <button key={c.tag} type="button" onClick={() => onWarSearchChange(c.tag)} className={`w-full px-4 py-2.5 lg:px-1.5 lg:py-1 text-left flex items-center justify-between hover:bg-rose-500/10 transition border-b border-slate-900 last:border-0 ${warSearch === c.tag ? 'bg-rose-500/10' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg lg:text-[11px]" aria-hidden>{c.emblem}</span>
                        <div className="min-w-0">
                          <p className="text-xs lg:text-[11px] text-white font-bold">{c.name}</p>
                          <p className="text-[10px] lg:text-[11px] font-mono text-slate-500">[{c.tag}] - Lvl {c.level} - {c.memberCount} members</p>
                        </div>
                      </div>
                      <span className="text-[10px] lg:text-[11px] font-mono text-emerald-400 shrink-0">{c.bankedChips.toLocaleString()}c</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {clans.find(c => c.tag === warSearch) ? (
                <div className="p-3 lg:p-1.5 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg lg:text-[11px]" aria-hidden>{clans.find(c => c.tag === warSearch)?.emblem}</span>
                    <div className="min-w-0">
                      <p className="text-xs lg:text-[11px] text-white font-bold">{clans.find(c => c.tag === warSearch)?.name} [{warSearch}]</p>
                      <p className="text-[10px] lg:text-[11px] text-slate-500">Treasury: {clans.find(c => c.tag === warSearch)?.bankedChips.toLocaleString()}c - {clans.find(c => c.tag === warSearch)?.memberCount} members</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => onWarSearchChange('')} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition"><X className="w-3.5 h-3.5 lg:w-3 lg:h-3" /></button>
                </div>
              ) : null}
              <div>
                <label className="text-[10px] lg:text-[11px] font-mono uppercase tracking-widest text-slate-500 block mb-1 lg:mb-0">Wager (min 1,000c per clan)</label>
                <input type="number" value={warWager} onChange={(e) => onWarWagerChange(e.target.value)} placeholder="Enter wager amount..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 lg:px-1.5 lg:py-0.5 text-xs lg:text-[11px] text-white font-mono focus:outline-none focus:border-rose-500/50" />
                <p className="text-[9px] lg:text-[11px] text-slate-500 mt-1 lg:mt-0">Both clans must have this amount in treasury. Total pot = wager x 2.</p>
              </div>
              <button type="button" onClick={() => onDeclareWar(warSearch)} disabled={actionBusy === 'war' || !warSearch || !clans.find(c => c.tag === warSearch) || (Math.floor(Number(warWager) || 0) < 1000)} className="w-full py-2.5 lg:py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs lg:text-[11px] font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-40 border border-rose-500/30">
                {actionBusy === 'war' ? <Loader2 className="w-3.5 h-3.5 lg:w-3 lg:h-3 animate-spin" /> : <Swords className="w-3.5 h-3.5 lg:w-3 lg:h-3" />} Declare War
              </button>
            </div>
          ) : (
            <div className="p-4 lg:p-1.5 rounded-2xl border border-slate-800 bg-slate-950/60 text-center">
              <Lock className="w-6 h-6 lg:w-4 lg:h-4 text-slate-600 mx-auto mb-2 lg:mb-0.5" />
              <p className="text-xs lg:text-[11px] text-slate-500">Only the <strong className="text-amber-300">Leader</strong> can declare clan wars.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}