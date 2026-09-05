'use client';

import {
  Search,
  Coins,
  Loader2,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { countryFlag } from '@/lib/game-config';
import { timeAgo } from '@/lib/date-utils';
import { formatChipsShort as formatChips } from '@/lib/format-chips';
import { RoleBadge, BannedBadge } from './player-detail';

// ── Types ──

export interface AdminPlayer {
  id: string;
  userTag: string;
  name: string;
  country: string;
  avatar: string | null;
  role: string;
  banned: boolean;
  bankedChips: number;
  level: number;
  clanTag: string | null;
  clanRank: string | null;
  lastSeenAt: string;
  createdAt: string;
  // Auth-support info (presence booleans only — no secrets):
  email?: string | null;
  emailVerified?: boolean;
  oauthProvider?: string | null;
  hasPassword?: boolean;
  hasPin?: boolean;
}

/** Auth badge: Guest / Email (✓ verified) / social provider name. */
function AuthBadge({ p }: { p: AdminPlayer }) {
  const base = 'text-[9px] lg:text-[10px] font-bold px-1.5 py-0.5 rounded border';
  if (p.oauthProvider) {
    const label = p.oauthProvider.charAt(0).toUpperCase() + p.oauthProvider.slice(1);
    return <span title={`Social sign-in: ${label}`} className={`${base} bg-violet-500/10 border-violet-500/20 text-violet-400`}>{label}</span>;
  }
  if (p.email) {
    return (
      <span
        title={p.emailVerified ? 'Registered + email verified' : 'Registered — email NOT verified'}
        className={`${base} ${p.emailVerified ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}
      >
        Email{p.emailVerified ? ' ✓' : ' ⚠'}
      </span>
    );
  }
  return <span title="Guest account — no email/password" className={`${base} bg-slate-500/10 border-slate-500/20 text-slate-400`}>Guest</span>;
}

// ── Player List Component ──

interface PlayerListProps {
  players: AdminPlayer[];
  loading: boolean;
  selectedTag: string | null;
  search: string;
  showBannedOnly: boolean;
  onSearchChange: (s: string) => void;
  onBannedOnlyChange: (v: boolean) => void;
  onSelectPlayer: (userTag: string) => void;
}

export function PlayerList({
  players, loading, selectedTag, search, showBannedOnly,
  onSearchChange, onBannedOnlyChange, onSelectPlayer,
}: PlayerListProps) {
  return (
    <div className="flex-1 min-w-0">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:gap-1 mb-4 lg:mb-1">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-3 lg:h-3 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or tag…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 lg:pl-7 pr-4 py-2.5 lg:py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Banned-only toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[10px] lg:text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Banned Only
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showBannedOnly}
              onClick={() => onBannedOnlyChange(!showBannedOnly)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${showBannedOnly ? 'bg-red-600' : 'bg-slate-700'}`}
            >
              <span
                aria-hidden
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${showBannedOnly ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </label>

          {/* Result count */}
          <span className="text-[10px] lg:text-[11px] font-mono text-slate-500 whitespace-nowrap">
            {loading ? '…' : `${players.length} result${players.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Player list */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
        <div className="max-h-[400px] lg:max-h-[350px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            </div>
          ) : players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Search className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-xs">No players found</p>
              <p className="text-[10px] lg:text-[11px] text-slate-600 mt-1">
                Try a different search query
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {players.map((p) => {
                const isSelected = selectedTag === p.userTag;
                return (
                  <button
                    key={p.userTag}
                    type="button"
                    onClick={() => onSelectPlayer(p.userTag)}
                    className={`w-full text-left px-4 py-3 lg:px-2 lg:py-1.5 flex items-center gap-3 lg:gap-1.5 transition-all duration-150 group ${isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : 'hover:bg-slate-800/40 border-l-2 border-transparent'}`}
                  >
                    {/* Avatar / Flag */}
                    <div className="shrink-0">
                      {p.avatar ? (
                        <img
                          src={p.avatar}
                          alt=""
                          className="w-9 h-9 lg:w-6 lg:h-6 rounded-lg object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-base">
                          {countryFlag(p.country)}
                        </div>
                      )}
                    </div>

                    {/* Name + tag */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs lg:text-[11px] font-bold text-white">
                          {p.name}
                        </span>
                        <span className="text-[9px] lg:text-[11px] font-mono text-slate-500 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded">
                          #{p.userTag}
                        </span>
                        {p.clanTag && (
                          <span className="text-[9px] lg:text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                            [{p.clanTag}]
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] lg:text-[11px] text-amber-400 font-bold flex items-center gap-0.5">
                          <Coins className="w-2.5 h-2.5" />
                          {formatChips(p.bankedChips)}
                        </span>
                        <span className="text-[10px] lg:text-[11px] text-slate-500">
                          Lvl {p.level}
                        </span>
                        <span className="text-[10px] lg:text-[11px] text-slate-600 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(p.lastSeenAt)}
                        </span>
                      </div>
                    </div>

                    {/* Right side: badges + chevron */}
                    <div className="flex items-center gap-1.5 lg:gap-1 shrink-0">
                      <AuthBadge p={p} />
                      {p.hasPin && (
                        <span title="Security PIN set (password recovery possible)" className="text-[9px] lg:text-[10px] font-bold px-1.5 py-0.5 rounded border bg-sky-500/10 border-sky-500/20 text-sky-400">PIN</span>
                      )}
                      {p.banned && <BannedBadge />}
                      {p.role === 'admin' && <RoleBadge role="admin" />}
                      {p.role !== 'admin' && !p.banned && <RoleBadge role="player" />}
                      <ChevronRight className={`w-4 h-4 lg:w-3 lg:h-3 transition-transform ${isSelected ? 'text-emerald-400 -rotate-90' : 'text-slate-600 group-hover:text-slate-400'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
