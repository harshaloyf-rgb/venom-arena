'use client';

import { Shield, Search, Plus, Award, Loader2 } from 'lucide-react';
import { MicroLabel, PanelSkeleton } from '../_panel-primitives';
import type { ClanInfo, Tab } from './_types';
import { EMBLEM_OPTIONS } from './_types';

interface ClanBrowseProps {
  tab: Tab;
  clans: ClanInfo[];
  clansLoading: boolean;
  filteredClans: ClanInfo[];
  search: string;
  playerClanTag: string | null;
  actionBusy: string;
  formState: { name: string; tag: string; motto: string; emblem: string; description: string };
  formBusy: boolean;
  onSearchChange: (v: string) => void;
  onSetTab: (tab: Tab) => void;
  onJoinClan: (tag: string, name: string) => void;
  onFormStateChange: (updater: (f: { name: string; tag: string; motto: string; emblem: string; description: string }) => { name: string; tag: string; motto: string; emblem: string; description: string }) => void;
  onFormSubmit: () => void;
}

export function ClanBrowse({
  tab, clans, clansLoading, filteredClans, search,
  playerClanTag, actionBusy, formState, formBusy,
  onSearchChange, onSetTab, onJoinClan, onFormStateChange, onFormSubmit,
}: ClanBrowseProps) {
  if (tab === 'browse') {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search clans by name or tag..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 lg:pl-8 pr-3 lg:pr-1.5 py-2 lg:py-1 text-xs lg:text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50" />
        </div>
        {clansLoading ? <PanelSkeleton count={6} height="h-52" /> : (
          <>
            {clans.length === 0 ? (
              <div className="p-8 lg:p-3 rounded-2xl border border-slate-800 bg-slate-950/60 text-center max-w-md mx-auto">
                <Shield className="w-12 h-12 lg:w-5 lg:h-5 text-slate-600 mx-auto mb-3 lg:mb-0.5" /><h3 className="text-base font-bold text-white">No Clans Found</h3>
                <p className="text-xs text-slate-400 mt-2 mb-4">No syndicates yet. Be the first!</p>
                <button type="button" onClick={() => onSetTab('form')} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">Form the First Syndicate</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-1">
                {filteredClans.map((clan) => {
                  const isJoined = playerClanTag === clan.tag;
                  return (
                    <div key={clan.tag} className="p-4 lg:p-1.5 rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md flex flex-col gap-3 lg:gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 lg:gap-1 min-w-0">
                          <span className="text-3xl lg:text-[11px]" aria-hidden>{clan.emblem}</span>
                          <div className="min-w-0">
                            <h4 className="text-sm lg:text-[11px] font-bold text-white">{clan.name}</h4>
                            <span className="text-[10px] lg:text-[11px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-1.5 lg:px-1 py-0.5 rounded">[{clan.tag}]</span>
                          </div>
                        </div>
                      </div>
                      {clan.description && <p className="text-[11px] text-slate-400 italic">&quot;{clan.description}&quot;</p>}
                      <div className="grid grid-cols-3 gap-2 lg:gap-0.5 text-[10px] font-mono">
                        <div className="p-2 lg:p-1 bg-slate-900/60 rounded border border-slate-800 text-center"><MicroLabel>LEVEL</MicroLabel><div className="text-amber-400 mt-0.5">{clan.level}</div></div>
                        <div className="p-2 lg:p-1 bg-slate-900/60 rounded border border-slate-800 text-center"><MicroLabel>MEMBERS</MicroLabel><div className="text-white mt-0.5">{clan.memberCount}/30</div></div>
                        <div className="p-2 lg:p-1 bg-slate-900/60 rounded border border-slate-800 text-center"><MicroLabel>TREASURY</MicroLabel><div className="text-emerald-400 mt-0.5">{clan.bankedChips >= 1_000_000 ? `${(clan.bankedChips / 1_000_000).toFixed(1)}M` : clan.bankedChips.toLocaleString()}</div></div>
                      </div>
                      <button type="button" onClick={() => onJoinClan(clan.tag, clan.name)} disabled={isJoined || !!playerClanTag || actionBusy === 'join'} className={`w-full py-2 lg:py-1 rounded-lg text-xs lg:text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${isJoined ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-default' : !!playerClanTag ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                        {actionBusy === 'join' ? <Loader2 className="w-3.5 h-3.5 lg:w-3 lg:h-3 animate-spin" /> : null}{isJoined ? 'Already a Member' : 'Join Syndicate'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // tab === 'form'
  return (
    <div className="max-w-xl mx-auto p-5 lg:p-2 rounded-2xl border border-slate-800 bg-slate-950/60 shadow-md">
      <h3 className="text-base lg:text-[11px] font-black text-white flex items-center gap-2 mb-4 lg:mb-1"><Plus className="w-5 h-5 lg:w-3 lg:h-3 text-indigo-400" /> Form a New Viper Syndicate Clan</h3>
      <div className="space-y-3">
        <div><label className="text-[10px] lg:text-[11px] font-mono uppercase tracking-widest text-slate-500 block mb-1 lg:mb-0">Syndicate Name</label><input type="text" value={formState.name} onChange={(e) => onFormStateChange((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Omega Extractions" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 lg:px-1.5 py-2 lg:py-0.5 text-xs lg:text-[11px] text-white focus:outline-none focus:border-indigo-500/50" /></div>
        <div><label className="text-[10px] lg:text-[11px] font-mono uppercase tracking-widest text-slate-500 block mb-1 lg:mb-0">Clan Tag (3-5 Chars)</label><input type="text" value={formState.tag} onChange={(e) => onFormStateChange((f) => ({ ...f, tag: e.target.value.toUpperCase() }))} placeholder="e.g. OMG" maxLength={5} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 lg:px-1.5 py-2 lg:py-0.5 text-xs lg:text-[11px] text-white font-mono focus:outline-none focus:border-indigo-500/50" /></div>
        <div><label className="text-[10px] lg:text-[11px] font-mono uppercase tracking-widest text-slate-500 block mb-1 lg:mb-0">Description</label><input type="text" value={formState.motto} onChange={(e) => onFormStateChange((f) => ({ ...f, motto: e.target.value }))} placeholder="e.g. Extraction above all else." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 lg:px-1.5 py-2 lg:py-0.5 text-xs lg:text-[11px] text-white focus:outline-none focus:border-indigo-500/50" /></div>
        <div><label className="text-[10px] lg:text-[11px] font-mono uppercase tracking-widest text-slate-500 block mb-1 lg:mb-0">Emblem Logo</label><select value={formState.emblem} onChange={(e) => onFormStateChange((f) => ({ ...f, emblem: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 lg:px-1.5 py-2 lg:py-0.5 text-xs lg:text-[11px] text-white focus:outline-none focus:border-indigo-500/50">{EMBLEM_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></div>
        <div className="pt-3 lg:pt-1 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono">Formation: <span className="text-emerald-300 font-bold">Free</span></div>
          <button type="button" onClick={() => onFormSubmit()} disabled={formBusy} className="px-4 lg:px-2 py-2.5 lg:py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs lg:text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-50">
            {formBusy ? <Loader2 className="w-3.5 h-3.5 lg:w-3 lg:h-3 animate-spin" /> : <Award className="w-3.5 h-3.5 lg:w-3 lg:h-3" />} Form Syndicate
          </button>
        </div>
      </div>
    </div>
  );
}
