'use client';

import {
  ShieldBan,
  Ban,
  Loader2,
  X,
  ShieldAlert,
  UserCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Eye,
  Coins,
} from 'lucide-react';
import { countryFlag } from '@/lib/game-config';
import { timeAgo } from '@/lib/date-utils';
import { formatChipsShort as formatChips } from '@/lib/format-chips';

// ── Types ──

export interface PlayerDetail {
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
  email: string | null;
  totalEarned: number;
  totalLost: number;
  lifetimeKills: number;
  lifetimeDeaths: number;
  lifetimeExtracts: number;
  bestStreak: number;
  biggestExtract: number;
  dailyStreak: number;
  streakFreezes: number;
  referralCode: string | null;
  unlockedSkins: string;
  currentSkin: string;
  currentTrail: string;
  currentDeath: string;
  instagram: string | null;
  youtube: string | null;
  twitch: string | null;
  matchCount: number;
  giftsSent: number;
  giftsReceived: number;
  friendsCount: number;
  clipCount: number;
  clanMembers: { clanName: string; memberCount: number } | null;
}

// ── Shared Badge Components ──

export function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded text-amber-400 bg-amber-500/10 border-amber-500/30">
        <ShieldAlert className="w-2.5 h-2.5" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
      <UserCheck className="w-2.5 h-2.5" /> Player
    </span>
  );
}

export function BannedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded text-red-400 bg-red-500/10 border-red-500/30">
      <Ban className="w-2.5 h-2.5" /> Banned
    </span>
  );
}

// ── Stat Card ──

function StatCard({
  label,
  value,
  icon,
  color = 'text-white',
  sub,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
          {label}
        </span>
        {icon}
      </div>
      <span className={`text-sm font-black ${color}`}>{value}</span>
      {sub && <span className="text-[9px] text-slate-600 font-mono">{sub}</span>}
    </div>
  );
}

// ── Player Detail Component ──

interface PlayerDetailPanelProps {
  selectedTag: string | null;
  playerDetail: PlayerDetail | null;
  detailLoading: boolean;
  chipAmount: string;
  busy: boolean;
  onChipAmountChange: (v: string) => void;
  onClose: () => void;
  onModifyChips: (type: 'add' | 'remove') => void;
  onBanToggle: () => void;
}

export function PlayerDetailPanel({
  selectedTag, playerDetail, detailLoading, chipAmount, busy,
  onChipAmountChange, onClose, onModifyChips, onBanToggle,
}: PlayerDetailPanelProps) {
  const kd = playerDetail
    ? playerDetail.lifetimeDeaths > 0
      ? (playerDetail.lifetimeKills / playerDetail.lifetimeDeaths).toFixed(2)
      : playerDetail.lifetimeKills.toFixed(0)
    : '—';

  return (
    <div
      className={`w-full lg:w-[440px] shrink-0 transition-all duration-300 ${selectedTag ? 'opacity-100 translate-x-0' : 'opacity-0 lg:translate-x-4 pointer-events-none lg:pointer-events-auto lg:opacity-0'}`}
      aria-hidden={!selectedTag}
    >
      {selectedTag ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-lg overflow-hidden sticky top-4">
          {/* Detail header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Player Details
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            </div>
          ) : playerDetail ? (
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* ── Player identity ── */}
              <div className="flex items-start gap-3">
                {playerDetail.avatar ? (
                  <img
                    src={playerDetail.avatar}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shrink-0">
                    {countryFlag(playerDetail.country)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-white truncate">
                      {playerDetail.name}
                    </h3>
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800/60 px-1.5 py-0.5 rounded">
                      #{playerDetail.userTag}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-sm">{countryFlag(playerDetail.country)}</span>
                    <RoleBadge role={playerDetail.role} />
                    {playerDetail.banned && <BannedBadge />}
                    {playerDetail.clanTag && (
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                        [{playerDetail.clanTag}]
                        {playerDetail.clanRank && ` ${playerDetail.clanRank}`}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 font-mono flex items-center gap-3 flex-wrap">
                    {playerDetail.email && (
                      <span className="truncate max-w-[200px]">{playerDetail.email}</span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      Seen {timeAgo(playerDetail.lastSeenAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Stats grid ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <StatCard
                  label="Banked Chips"
                  value={formatChips(playerDetail.bankedChips)}
                  icon={<Coins className="w-3.5 h-3.5 text-amber-400" />}
                  color="text-amber-400"
                />
                <StatCard
                  label="Total Earned"
                  value={formatChips(playerDetail.totalEarned)}
                  icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                  color="text-emerald-400"
                />
                <StatCard
                  label="Total Lost"
                  value={formatChips(playerDetail.totalLost)}
                  icon={<TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                  color="text-red-400"
                />
                <StatCard
                  label="Kills"
                  value={playerDetail.lifetimeKills.toLocaleString()}
                  icon={<TrendingUp className="w-3.5 h-3.5 text-orange-400" />}
                  color="text-orange-400"
                />
                <StatCard
                  label="Deaths"
                  value={playerDetail.lifetimeDeaths.toLocaleString()}
                  icon={<TrendingDown className="w-3.5 h-3.5 text-slate-400" />}
                  color="text-slate-300"
                />
                <StatCard
                  label="K/D Ratio"
                  value={kd}
                  color={Number(kd) >= 2 ? 'text-emerald-400' : Number(kd) >= 1 ? 'text-amber-400' : 'text-red-400'}
                />
                <StatCard
                  label="Extracts"
                  value={playerDetail.lifetimeExtracts.toLocaleString()}
                  icon={<Eye className="w-3.5 h-3.5 text-cyan-400" />}
                  color="text-cyan-400"
                />
                <StatCard
                  label="Best Streak"
                  value={playerDetail.bestStreak.toLocaleString()}
                  icon={<TrendingUp className="w-3.5 h-3.5 text-yellow-400" />}
                  color="text-yellow-400"
                />
                <StatCard
                  label="Biggest Extract"
                  value={formatChips(playerDetail.biggestExtract)}
                  icon={<Coins className="w-3.5 h-3.5 text-emerald-400" />}
                  color="text-emerald-400"
                />
                <StatCard
                  label="Matches"
                  value={playerDetail.matchCount.toLocaleString()}
                />
                <StatCard
                  label="Friends"
                  value={playerDetail.friendsCount.toLocaleString()}
                />
                <StatCard
                  label="Clips"
                  value={playerDetail.clipCount.toLocaleString()}
                />
              </div>

              {/* Extra stats row */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label="Daily Streak"
                  value={playerDetail.dailyStreak}
                  sub={`${playerDetail.streakFreezes} freeze${playerDetail.streakFreezes !== 1 ? 's' : ''} remaining`}
                />
                <StatCard
                  label="Gifts"
                  value={`${playerDetail.giftsSent} / ${playerDetail.giftsReceived}`}
                  sub="sent / received"
                />
              </div>

              {/* ── Clan info ── */}
              {playerDetail.clanMembers && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500/70 block mb-1">
                    Clan
                  </span>
                  <p className="text-xs font-bold text-amber-300">
                    {playerDetail.clanMembers.clanName}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {playerDetail.clanMembers.memberCount} members
                  </p>
                </div>
              )}

              {/* ── Social links ── */}
              {(playerDetail.instagram || playerDetail.youtube || playerDetail.twitch) && (
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
                    Social Links
                  </span>
                  <div className="space-y-1.5">
                    {playerDetail.youtube && (
                      <a
                        href={playerDetail.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[10px] text-red-400 hover:text-red-300 transition truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        YouTube
                      </a>
                    )}
                    {playerDetail.twitch && (
                      <a
                        href={playerDetail.twitch}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[10px] text-violet-400 hover:text-violet-300 transition truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        Twitch
                      </a>
                    )}
                    {playerDetail.instagram && (
                      <a
                        href={playerDetail.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[10px] text-pink-400 hover:text-pink-300 transition truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        Instagram
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ── Cosmetics info ── */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
                  Equipped Cosmetics
                </span>
                <div className="space-y-1 text-[10px] font-mono text-slate-400">
                  {playerDetail.currentSkin && (
                    <p>Skin: <span className="text-white">{playerDetail.currentSkin}</span></p>
                  )}
                  {playerDetail.currentTrail && (
                    <p>Trail: <span className="text-white">{playerDetail.currentTrail}</span></p>
                  )}
                  {playerDetail.currentDeath && (
                    <p>Death FX: <span className="text-white">{playerDetail.currentDeath}</span></p>
                  )}
                  {playerDetail.unlockedSkins && (
                    <p className="text-slate-500">
                      {playerDetail.unlockedSkins.split(',').length} skin{playerDetail.unlockedSkins.split(',').length !== 1 ? 's' : ''} unlocked
                    </p>
                  )}
                </div>
              </div>

              {/* ── Referral code ── */}
              {playerDetail.referralCode && (
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">
                    Referral Code
                  </span>
                  <p className="text-xs font-mono font-bold text-emerald-400">
                    {playerDetail.referralCode}
                  </p>
                </div>
              )}

              {/* ── Account dates ── */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-0.5">
                      Joined
                    </span>
                    <span className="text-[10px] text-slate-300 font-mono">
                      {timeAgo(playerDetail.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-0.5">
                      Last Seen
                    </span>
                    <span className="text-[10px] text-slate-300 font-mono">
                      {timeAgo(playerDetail.lastSeenAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                {/* Chip modification */}
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
                    Chip Modification
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Amount"
                      value={chipAmount}
                      onChange={(e) => onChipAmountChange(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50 transition"
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={() => void onModifyChips('add')}
                      disabled={busy || !chipAmount.trim()}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <TrendingUp className="w-3 h-3" />
                      )}
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => void onModifyChips('remove')}
                      disabled={busy || !chipAmount.trim()}
                      className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      Remove
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-600 font-mono mt-1.5">
                    Current balance: <span className="text-amber-400 font-bold">{formatChips(playerDetail.bankedChips)}</span> chips
                  </p>
                </div>

                {/* Ban / Unban */}
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
                    Account Action
                  </span>
                  <button
                    type="button"
                    onClick={() => void onBanToggle()}
                    disabled={busy}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${playerDetail.banned ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : playerDetail.banned ? (
                      <>
                        <ShieldBan className="w-4 h-4" />
                        Unban Player
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4" />
                        Ban Player
                      </>
                    )}
                  </button>
                  {playerDetail.banned && (
                    <p className="text-[9px] text-red-400/70 font-mono mt-1.5 text-center">
                      This player is currently banned from the game
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <ShieldAlert className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-xs">Failed to load player details</p>
            </div>
          )}
        </div>
      ) : (
        /* Empty state when no player selected */
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 border-dashed flex flex-col items-center justify-center py-20 text-slate-500">
          <Eye className="w-8 h-8 text-slate-700 mb-2" />
          <p className="text-xs">Select a player to view details</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Click on any row in the list
          </p>
        </div>
      )}
    </div>
  );
}
