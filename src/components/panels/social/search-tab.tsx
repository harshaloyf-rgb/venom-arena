'use client';

import { Search, Loader2, ArrowUpDown, Check, Clock, UserPlus, ExternalLink } from 'lucide-react';
import { countryFlag } from '@/lib/game-config';
import type { SearchPlayer, CountryOption } from './_types';

interface SearchTabProps {
  searchQuery: string;
  searchCountry: string;
  countries: CountryOption[];
  searchResults: SearchPlayer[];
  searchTotal: number;
  searchLoading: boolean;
  playerUserTag: string;
  onSearchQueryChange: (v: string) => void;
  onSearchCountryChange: (v: string) => void;
  onSendFriend: (p: SearchPlayer) => void;
  onInspect: (tag: string, name: string, country: string, level: number, chips: number, clanTag: string | null) => void;
  onLoadMore: () => void;
}

export function SearchTab({
  searchQuery, searchCountry, countries, searchResults, searchTotal,
  searchLoading, playerUserTag,
  onSearchQueryChange, onSearchCountryChange, onSendFriend, onInspect, onLoadMore,
}: SearchTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search by Name or Tag..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <select
          value={searchCountry}
          onChange={(e) => onSearchCountryChange(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500/50"
        >
          <option value="ALL">🌐 All Countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{countryFlag(c.code)} {c.name} ({c.count})</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
        {searchLoading && searchResults.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Searching players…
          </div>
        ) : (
          <ol className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
            {searchResults.length === 0 ? (
              <li className="p-6 text-center text-xs text-slate-500">
                {searchQuery.trim() || searchCountry !== 'ALL' ? 'No players match your search.' : 'Type a name or tag to search players.'}
              </li>
            ) : (
              searchResults.map((p) => {
                const isSelf = p.userTag === playerUserTag;
                const rel = p.relation || 'none';
                return (
                  <li key={p.userTag} className="px-4 py-3 text-sm flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 bg-slate-800/60 border border-slate-700/60" aria-hidden>
                        {countryFlag(p.country)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onInspect(p.userTag, p.name, p.country, p.level, p.bankedChips, p.clanTag); }}
                            className="hover:text-violet-300 transition-colors flex items-center gap-1"
                            title="Inspect profile"
                          >
                            {p.name}
                            <ExternalLink className="w-2.5 h-2.5 text-slate-500 hover:text-violet-400" />
                          </button>
                          {p.online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          <span className="text-[10px] font-mono text-slate-500">#{p.userTag}</span>
                          {p.clanTag && <span className="text-[9px] font-bold text-violet-300 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0 rounded-full">[{p.clanTag}]</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          🪙 {(p.bankedChips / 1000).toFixed(1)}k · Lvl {p.level}
                        </div>
                      </div>
                    </div>
                    {isSelf ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded-full">You</span>
                    ) : rel === 'friend' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-full">
                        <Check className="w-3 h-3" /> Connected
                      </span>
                    ) : rel === 'pending_sent' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" /> Sent
                      </span>
                    ) : rel === 'pending_received' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-1 rounded-full">
                        <UserPlus className="w-3 h-3" /> Accept
                      </span>
                    ) : (
                      <button type="button" onClick={() => onSendFriend(p)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600 hover:text-white transition flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> Connect
                      </button>
                    )}
                  </li>
                );
              })
            )}
            {searchResults.length < searchTotal && searchResults.length > 0 && (
              <li className="p-3 text-center">
                <button type="button" onClick={onLoadMore} disabled={searchLoading} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-violet-500/40 transition flex items-center gap-1.5 mx-auto disabled:opacity-50">
                  {searchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />} Load More
                </button>
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
