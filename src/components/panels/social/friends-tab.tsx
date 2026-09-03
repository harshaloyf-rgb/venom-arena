'use client';

import { Users, UserPlus, Send, X, Check, Ban, Unlock, ExternalLink, Activity, Swords, Skull } from 'lucide-react';
import { PanelSkeleton } from '../_panel-primitives';
import { timeAgo } from '@/lib/date-utils';
import type { FriendItem, PendingRequestItem, BlockedPlayerItem, RecentMatch } from './_types';

interface FriendsTabProps {
  friends: FriendItem[];
  pendingReceived: PendingRequestItem[];
  pendingSent: PendingRequestItem[];
  blockedPlayers: BlockedPlayerItem[];
  recentMatches: RecentMatch[];
  friendsLoading: boolean;
  giftCooldowns: Set<string>;
  // FIX KILL-1: actions for the "Killed by" rows in Recent Matches
  killedByTags: Set<string>;          // tags with a pending/outgoing friend state
  addedRivalTags: Set<string>;        // tags already added as rival this session
  onAddFriendFromMatch: (m: RecentMatch) => void;
  onAddRivalFromMatch: (m: RecentMatch) => void;
  onAccept: (req: PendingRequestItem) => void;
  onDecline: (req: PendingRequestItem) => void;
  onRemove: (f: FriendItem) => void;
  onGift: (f: FriendItem) => void;
  onBlock: (f: FriendItem) => void;
  onUnblock: (b: BlockedPlayerItem) => void;
  onInspect: (tag: string, name: string, country: string, level: number, chips: number, clanTag: string | null) => void;
}

export function FriendsTab({
  friends, pendingReceived, pendingSent, blockedPlayers, recentMatches,
  friendsLoading, giftCooldowns, killedByTags, addedRivalTags,
  onAddFriendFromMatch, onAddRivalFromMatch,
  onAccept, onDecline, onRemove, onGift, onBlock, onUnblock, onInspect,
}: FriendsTabProps) {
  return (
    <div className="space-y-3">
      {/* Incoming requests */}
      {pendingReceived.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Incoming Requests ({pendingReceived.length})
          </h3>
          <ul className="space-y-2">
            {pendingReceived.map((req) => (
              <li key={req.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${req.skinColor}20`, border: `1px solid ${req.skinColor}40` }} aria-hidden>
                    🐍
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm truncate">{req.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">#{req.userTag} · Lvl {req.level}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => onAccept(req)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1">
                    <Check className="w-3 h-3" /> Accept
                  </button>
                  <button type="button" onClick={() => onDecline(req)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition flex items-center gap-1">
                    <X className="w-3 h-3" /> Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Outgoing requests */}
      {pendingSent.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outgoing Requests ({pendingSent.length})</h3>
          <ul className="space-y-1.5">
            {pendingSent.map((req) => (
              <li key={req.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40">
                <div className="w-6 h-6 rounded flex items-center justify-center text-xs shrink-0" style={{ background: `${req.skinColor}20`, border: `1px solid ${req.skinColor}40` }} aria-hidden>🐍</div>
                <span className="text-xs font-bold text-white truncate">{req.name}</span>
                <span className="text-[10px] font-mono text-slate-500">#{req.userTag}</span>
                <span className="ml-auto text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">Pending</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocked players */}
      {blockedPlayers.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider hover:text-rose-300 transition select-none">
            <Ban className="w-3.5 h-3.5" /> Blocked Players ({blockedPlayers.length})
            <span className="text-[10px] text-slate-500 font-normal normal-case ml-1">— click to expand</span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {blockedPlayers.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-rose-500/15 bg-rose-500/5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0" style={{ background: `${b.skinColor}20`, border: `1px solid ${b.skinColor}40` }} aria-hidden>
                    🚫
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-rose-300 text-xs truncate">{b.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">#{b.userTag} · Lvl {b.level}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUnblock(b)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600 hover:text-white transition flex items-center gap-1 shrink-0"
                >
                  <Unlock className="w-3 h-3" /> Unblock
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Friends list */}
      {friendsLoading ? (
        <PanelSkeleton count={4} />
      ) : friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 ? (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
          <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-white">Your Friends List is Empty</h4>
          <p className="text-xs text-slate-400 mt-1">
            Use &quot;Search Players&quot; or enter a player tag above to send a friend request!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto va-scroll">
          {friends.map((f) => (
            <div key={f.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: `${f.skinColor}20`, border: `1px solid ${f.skinColor}40` }} aria-hidden>🐍</div>
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onInspect(f.userTag, f.name, f.country, f.level, f.bankedChips, f.clanTag)}
                        className="hover:text-violet-300 transition-colors flex items-center gap-1"
                        title="Inspect profile"
                      >
                        {f.name}
                        <ExternalLink className="w-2.5 h-2.5 text-slate-500 hover:text-violet-400" />
                      </button>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">
                      #{f.userTag}{f.clanTag ? ` · [${f.clanTag}]` : ''}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => onRemove(f)} className="p-1 rounded text-slate-500 hover:text-rose-400 transition" title="Remove Friend">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className={`inline-flex items-center gap-1 ${f.online ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${f.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  {f.online ? 'Online' : 'Offline'}
                </span>
                <span className="text-amber-400">Lvl {f.level}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onGift(f)}
                  disabled={giftCooldowns.has(f.userTag)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${giftCooldowns.has(f.userTag) ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed' : 'bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600 hover:text-white'}`}
                >
                  <Send className="w-3 h-3" /> {giftCooldowns.has(f.userTag) ? 'Cooldown…' : 'Gift +25c'}
                </button>
                <button
                  type="button"
                  onClick={() => onBlock(f)}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-600/10 border border-rose-500/30 text-rose-300 hover:bg-rose-600 hover:text-white transition flex items-center gap-1"
                >
                  <Ban className="w-3 h-3" /> Block
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      {recentMatches.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Your Recent Matches
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Last {recentMatches.length}</span>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            <ol className="divide-y divide-slate-900 max-h-72 overflow-y-auto va-scroll">
              {recentMatches.map((m, i) => {
                // FIX KILL-1: real-player killer → show name + Friend/Rival
                // actions so the player can hunt a rematch socially. Bot and
                // boundary deaths just note the killer name (no actions).
                const realKiller = m.status === 'COLLIDED'
                  && m.killerTag && m.killerIsBot === false;
                const botKiller = m.status === 'COLLIDED'
                  && m.killerName && !realKiller;
                const friendPending = realKiller ? killedByTags.has(m.killerTag!) : false;
                const rivalAdded = realKiller ? addedRivalTags.has(m.killerTag!) : false;
                return (
                  <li key={i} className="px-3 py-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.status === 'EXTRACTED' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="text-white font-bold truncate">{m.arenaName}</span>
                        <span className="text-slate-500 font-mono text-[10px]">{m.isOnline ? 'Online' : 'Practice'}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        {m.status === 'EXTRACTED' ? (
                          <span className="text-emerald-400">+{m.chipsEarned}c</span>
                        ) : (
                          <span className="text-rose-400">-{m.chipsLost}c</span>
                        )}
                        <span className="text-slate-500 text-[10px]">{m.kills}💀</span>
                        <span className="text-slate-600 text-[10px]">{timeAgo(m.createdAt)}</span>
                      </div>
                    </div>
                    {(realKiller || botKiller) && (
                      <div className="mt-1.5 ml-3.5 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Skull className="w-3 h-3 text-rose-500/70 shrink-0" />
                          <span className="text-slate-400">Killed by</span>
                          {realKiller ? (
                            <button
                              type="button"
                              onClick={() => onInspect(m.killerTag!, m.killerName || '', '', 0, 0, null)}
                              className="text-violet-300 hover:text-violet-200 font-bold truncate hover:underline"
                              title="Inspect profile"
                            >
                              {m.killerName}
                            </button>
                          ) : (
                            <span className="text-slate-500 font-bold truncate">{m.killerName} <span className="text-[9px] text-slate-600">(bot)</span></span>
                          )}
                        </div>
                        {realKiller && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onAddFriendFromMatch(m)}
                              disabled={friendPending}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition flex items-center gap-1 ${
                                friendPending
                                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-default'
                                  : 'bg-emerald-600/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-600 hover:text-white'
                              }`}>
                              <UserPlus className="w-2.5 h-2.5" />{friendPending ? 'Sent' : 'Friend'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onAddRivalFromMatch(m)}
                              disabled={rivalAdded}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition flex items-center gap-1 ${
                                rivalAdded
                                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 cursor-default'
                                  : 'bg-rose-600/15 border border-rose-500/25 text-rose-300 hover:bg-rose-600 hover:text-white'
                              }`}>
                              <Swords className="w-2.5 h-2.5" />{rivalAdded ? 'Rival ✓' : 'Rival'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
