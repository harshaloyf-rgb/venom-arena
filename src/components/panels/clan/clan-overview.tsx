'use client';

import {
  Trophy, Coins, Users, MessageSquare, Send, Loader2,
  Star, Lock, Swords, Target, ShoppingCart, LogOut, Check,
  Crown, ChevronUp, ChevronDown, UserMinus, UserPlus, X, Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { countryFlag } from '@/lib/game-config';
import { isOnline } from '@/lib/date-utils';
import { PanelSkeleton } from '../_panel-primitives';
import type { ClanMember, ChatMessage, ClanChallenge, ClanStats, MineSubTab, JoinRequestIncomingRow } from './_types';
import { CHALLENGE_ICONS, RANK_BG, PERK_ROADMAP } from './_types';

interface ClanOverviewProps {
  playerClanTag: string;
  isLeader: boolean;
  isCoLeader: boolean;
  canManage: boolean;
  myClanInfo: { name: string; emblem: string; description: string; level: number; xp: number; memberCount: number; maxMembers: number; bankedChips: number; totalDeposited: number } | undefined;
  clanStats: ClanStats | null;
  xpProgress: number;
  xpNeeded: number;
  members: ClanMember[];
  membersLoading: boolean;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  challenges: ClanChallenge[];
  depositAmount: string;
  broadcast: string;
  quickDeposits: { label: string; value: number }[];
  actionBusy: string;
  onDepositAmountChange: (v: string) => void;
  onBroadcastChange: (v: string) => void;
  onDeposit: (amt?: number) => void;
  onWithdraw: () => void;
  onBroadcast: () => void;
  onShopPurchase: (itemId: string) => void;
  onPromote: (userTag: string, name: string) => void;
  onDemote: (userTag: string, name: string) => void;
  onKick: (userTag: string, name: string) => void;
  onTransfer: (userTag: string, name: string) => void;
  onPayout: (userTag: string) => void;
  onInvite: (userTag: string) => Promise<boolean>;
  joinRequests: JoinRequestIncomingRow[];
  onRespondJoinRequest: (requestId: string, action: 'accept' | 'decline', requesterName: string) => void;
  onInspect: (m: ClanMember) => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  onSetMineSub: (tab: MineSubTab) => void;
  playerUserTag: string | undefined;
  playerClanRank: string | undefined;
  playerBankedChips: number;
}

export function ClanOverview({
  playerClanTag, isLeader, isCoLeader, canManage, myClanInfo, clanStats,
  xpProgress, xpNeeded, members, membersLoading, chatMessages, chatLoading,
  challenges, depositAmount, broadcast, quickDeposits, actionBusy,
  onDepositAmountChange, onBroadcastChange, onDeposit, onWithdraw, onBroadcast,
  onShopPurchase, onPromote, onDemote, onKick, onTransfer, onPayout, onInvite,
  joinRequests = [], onRespondJoinRequest, onInspect, onOpenSettings, onLeave, onSetMineSub,
  playerUserTag, playerClanRank, playerBankedChips,
}: ClanOverviewProps) {
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteTag, setInviteTag] = useState('');
  // T50: invite by NAME search (suggested players) or by pasting a VM tag.
  // Previously the box only accepted a typed VM tag — useless when you don't
  // know someone's tag. Powered by the existing /api/players/search endpoint.
  const [inviteResults, setInviteResults] = useState<{ userTag: string; name: string; country: string; level: number; clanTag: string | null }[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchSeq = useRef(0);

  const inviteQueryLooksLikeTag = /^vm-[a-z0-9]{3,10}$/i.test(inviteTag.trim());

  // Debounced live search while typing a name (skipped when it's already a tag)
  useEffect(() => {
    const q = inviteTag.trim();
    if (q.length < 2 || /^vm-/i.test(q)) {
      setInviteResults([]);
      setInviteSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setInviteSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?query=${encodeURIComponent(q)}&limit=6`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as { players?: { userTag: string; name: string; country: string; level: number; clanTag: string | null }[] };
        if (seq === searchSeq.current) {
          setInviteResults(data.players || []);
          setShowResults(true);
        }
      } catch {
        if (seq === searchSeq.current) setInviteResults([]);
      } finally {
        if (seq === searchSeq.current) setInviteSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [inviteTag]);

  function pickInvitePlayer(p: { userTag: string; name: string }) {
    setInviteTag(p.userTag);
    setShowResults(false);
    setInviteResults([]);
  }

  async function submitInvite() {
    const tag = inviteTag.trim();
    if (!tag) return;
    if (!inviteQueryLooksLikeTag) return; // must be a full VM tag (typed or picked)
    const ok = await onInvite(tag);
    if (ok) { setInviteTag(''); setShowInviteInput(false); setShowResults(false); setInviteResults([]); }
  }

  const RANK_COLORS: Record<string, string> = {
    Leader: 'text-amber-300',
    'Co-Leader': 'text-purple-300',
    Viper: 'text-indigo-300',
  };

  return (
    <div className="space-y-4">
      {/* Join Requests (Leader/Co-Leader approval) */}
      {canManage && joinRequests.length > 0 && (
        <div className="p-4 lg:p-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/5">
          <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2 mb-3 lg:mb-1"><UserPlus className="w-4 h-4 lg:w-3 lg:h-3 text-rose-400" /> Join Requests ({joinRequests.length}) <span className="text-[10px] lg:text-[11px] font-normal text-slate-500">— players waiting for your approval</span></h4>
          <div className="space-y-2 lg:space-y-0.5">
            {joinRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-2 lg:p-1 rounded-lg bg-slate-950/60 border border-slate-800 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base lg:text-[11px] shrink-0" aria-hidden>{countryFlag(r.country)}</span>
                  <div className="min-w-0">
                    <div className="text-xs lg:text-[11px] font-bold text-white flex items-center gap-1.5 flex-wrap">
                      {r.name} <span className="text-[9px] lg:text-[11px] font-mono text-slate-500">{r.userTag}</span>
                    </div>
                    <div className="text-[10px] lg:text-[11px] font-mono text-slate-500">Lvl {r.level} · {r.bankedChips.toLocaleString()}c</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => onRespondJoinRequest(r.id, 'accept', r.name)} disabled={actionBusy === `joinreq-${r.id}`} className="px-2.5 lg:px-1 py-1 lg:py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] lg:text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50">
                    {actionBusy === `joinreq-${r.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Accept
                  </button>
                  <button type="button" onClick={() => onRespondJoinRequest(r.id, 'decline', r.name)} disabled={actionBusy === `joinreq-${r.id}`} className="px-2.5 lg:px-1 py-1 lg:py-0.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-[10px] lg:text-[11px] font-bold transition disabled:opacity-50">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Perks Roadmap */}
      <div className="p-4 lg:p-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
        <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2 mb-3 lg:mb-1"><Star className="w-4 h-4 lg:w-3 lg:h-3 text-amber-400" /> Perks Roadmap</h4>
        <div className="relative pl-6 lg:pl-4 space-y-3 lg:space-y-0.5">
          <div className="absolute left-2 lg:left-1.5 top-1 bottom-1 w-px bg-slate-700" />
          {PERK_ROADMAP.map((perk) => {
            const unlocked = (myClanInfo?.level || 1) >= perk.level;
            return (
              <div key={perk.level} className="relative flex items-start gap-3 lg:gap-1">
                <div className={`absolute -left-4 lg:-left-3 top-0.5 w-3 h-3 lg:w-2 lg:h-2 rounded-full border-2 ${unlocked ? 'bg-amber-400 border-amber-300' : 'bg-slate-800 border-slate-600'}`} />
                <div className={`flex-1 p-2.5 lg:p-1 rounded-xl border ${unlocked ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-950/60 opacity-60'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] lg:text-[11px] font-mono font-bold ${unlocked ? 'text-amber-300' : 'text-slate-500'}`}>LVL {perk.level}</span>
                    <span className={`text-xs lg:text-[11px] font-bold ${unlocked ? 'text-white' : 'text-slate-500'}`}>{perk.title}</span>
                    {!unlocked && <Lock className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-slate-600" />}
                  </div>
                  <p className={`text-[10px] lg:text-[11px] mt-0.5 ${unlocked ? 'text-slate-300' : 'text-slate-600'}`}>{perk.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Depositors */}
      {members.length > 0 && (() => {
        const top3 = [...members].sort((a, b) => b.bankedChips - a.bankedChips).slice(0, 3);
        const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
        return (
          <div className="p-4 lg:p-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
            <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2 mb-3 lg:mb-1"><Trophy className="w-4 h-4 lg:w-3 lg:h-3 text-emerald-400" /> Top Richest Members</h4>
            <div className="space-y-2 lg:space-y-0.5">
              {top3.map((m, i) => (
                <div key={m.userTag} className="flex items-center justify-between p-2 lg:p-1 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2 lg:gap-1 min-w-0">
                    <span className="text-base lg:text-[11px]" aria-hidden>{medals[i]}</span>
                    <span className="text-xs text-white font-bold">{m.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold shrink-0">{m.bankedChips.toLocaleString()}c</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Treasury */}
      <div className="p-4 lg:p-1.5 rounded-2xl border border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between mb-2 lg:mb-1 flex-wrap gap-2">
          <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2"><Coins className="w-4 h-4 lg:w-3 lg:h-3 text-emerald-400" /> Clan Treasury Bank</h4>
          <span className="text-sm lg:text-[11px] font-mono font-bold text-emerald-400">{(myClanInfo?.bankedChips || 0).toLocaleString()}c</span>
        </div>
        <div className="flex items-center gap-2 mb-2 lg:mb-1">
          <input type="number" value={depositAmount} onChange={(e) => onDepositAmountChange(e.target.value)} placeholder="Amount..." className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 lg:px-1.5 py-2 lg:py-0.5 text-xs lg:text-[11px] text-white font-mono focus:outline-none focus:border-emerald-500/50" />
          <button type="button" onClick={() => onDeposit()} disabled={actionBusy === 'deposit'} className="px-3 lg:px-1.5 py-2 lg:py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs lg:text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-50">
            {actionBusy === 'deposit' ? <Loader2 className="w-3.5 h-3.5 lg:w-3 lg:h-3 animate-spin" /> : <Coins className="w-3.5 h-3.5 lg:w-3 lg:h-3" />} Deposit
          </button>
        </div>
        {/* Quick deposit buttons */}
        <div className="flex items-center gap-1.5 lg:gap-0.5 flex-wrap">
          {quickDeposits.map((qd) => (
            <button key={qd.label} type="button" onClick={() => onDeposit(qd.value)} disabled={qd.value <= 0 || actionBusy === 'deposit'} className="px-2 lg:px-1 py-1 lg:py-0.5 rounded text-[10px] lg:text-[11px] font-bold bg-slate-900 hover:bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 hover:border-emerald-500/40 transition disabled:opacity-30">
              {qd.label} ({qd.value.toLocaleString()}c)
            </button>
          ))}
          <button type="button" onClick={() => onWithdraw()} disabled={actionBusy === 'withdraw' || !depositAmount} className="ml-auto px-2 lg:px-1 py-1 lg:py-0.5 rounded text-[10px] lg:text-[11px] font-bold bg-slate-900 hover:bg-rose-500/10 text-rose-400/80 border border-rose-500/20 hover:border-rose-500/40 transition disabled:opacity-30 flex items-center gap-1">
            {actionBusy === 'withdraw' ? <Loader2 className="w-3 h-3 lg:w-2.5 lg:h-2.5 animate-spin" /> : <LogOut className="w-3 h-3 lg:w-2.5 lg:h-2.5" />} Withdraw
          </button>
        </div>
      </div>

      {/* Treasury Actions: Shop */}
      {isLeader && (
        <div className="p-4 lg:p-1.5 rounded-2xl border border-violet-500/20 bg-violet-500/5">
          <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2 mb-3 lg:mb-1"><ShoppingCart className="w-4 h-4 lg:w-3 lg:h-3 text-violet-400" /> Clan Shop <span className="text-[10px] lg:text-[11px] font-mono text-slate-500 font-normal">— spend treasury chips on perks</span></h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-1">
            {[{ id: 'member_expansion', name: 'Member Expansion', cost: 15000, desc: '+5 max member slots', emoji: '👥' },
              { id: 'xp_windfall', name: 'XP Windfall', cost: 8000, desc: 'Instant Level × 500 XP', emoji: '⚡' },
              { id: 'war_shield', name: 'War Shield', cost: 5000, desc: 'Block war declarations 7 days', emoji: '🛡️' },
            ].map((item) => (
              <button key={item.id} type="button" onClick={() => onShopPurchase(item.id)} disabled={actionBusy === 'shop' || (myClanInfo?.bankedChips || 0) < item.cost} className="p-3 lg:p-1.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-violet-500/40 transition text-left disabled:opacity-40 group">
                <div className="flex items-center justify-between mb-1 lg:mb-0">
                  <span className="text-base lg:text-[11px]">{item.emoji}</span>
                  <span className="text-xs lg:text-[11px] font-mono font-bold text-violet-400">{item.cost.toLocaleString()}c</span>
                </div>
                <p className="text-[11px] font-bold text-white">{item.name}</p>
                <p className="text-[10px] lg:text-[11px] text-slate-500">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Challenge Preview */}
      {challenges.length > 0 && (
        <div className="p-4 lg:p-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between mb-3 lg:mb-1">
            <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2"><Swords className="w-4 h-4 lg:w-3 lg:h-3 text-amber-400" /> Weekly Challenges</h4>
            <button type="button" onClick={() => onSetMineSub('challenges')} className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition">View All &rarr;</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-1">
            {challenges.slice(0, 3).map((ch) => {
              const pct = Math.min(100, Math.floor((ch.progress / ch.target) * 100));
              const done = ch.progress >= ch.target;
              const Icon = CHALLENGE_ICONS[ch.type] || Target;
              return (
                <div key={ch.id} className={`p-2.5 lg:p-1 rounded-xl border ${ch.claimed ? 'border-emerald-500/30 bg-emerald-500/5' : done ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] lg:text-[11px] font-bold text-white">{ch.title}</span>
                    {ch.claimed && <Check className="w-3 h-3 text-emerald-400 ml-auto" />}
                  </div>
                  <div className="w-full h-1.5 lg:h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${ch.claimed ? 'bg-emerald-500' : done ? 'bg-amber-400' : 'bg-amber-600/60'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[9px] lg:text-[11px] text-slate-500 mt-1 font-mono">{ch.progress}/{ch.target} &middot; +{ch.reward.toLocaleString()}c</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Members */}
      <div>
        <div className="flex items-center justify-between mb-2 lg:mb-0.5 gap-2 flex-wrap">
          <h4 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" /> Member Roster ({myClanInfo?.memberCount || 0})</h4>
          <div className="flex items-center gap-2">
            <span className="text-[10px] lg:text-[11px] font-mono text-slate-500">Max: {myClanInfo?.maxMembers || 30}</span>
            {(myClanInfo?.memberCount || 0) < (myClanInfo?.maxMembers || 30) && (
              <button type="button" onClick={() => setShowInviteInput((v) => !v)} className="px-2 lg:px-1 py-1 lg:py-0.5 rounded text-[10px] lg:text-[11px] font-bold bg-slate-900 hover:bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 transition flex items-center gap-1">
                <UserPlus className="w-3 h-3 lg:w-2.5 lg:h-2.5" /> Invite Player
              </button>
            )}
          </div>
        </div>
        {/* T50: roles legend — ranks were a common source of confusion */}
        <p className="text-[9px] lg:text-[11px] text-slate-500 mb-2 lg:mb-0.5 -mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span><strong className="text-amber-300">Leader</strong> — full control</span>
          <span><strong className="text-purple-300">Co-Leader</strong> — kicks Vipers &amp; claims rewards (max 2)</span>
          <span><strong className="text-indigo-300">Viper</strong> — member: deposit, chat, invite</span>
        </p>
        {showInviteInput && (
          <div className="mb-2 lg:mb-1 p-2 lg:p-1 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-slate-500 absolute left-3 lg:left-1.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inviteTag}
                  onChange={(e) => { setInviteTag(e.target.value); setShowResults(true); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && inviteQueryLooksLikeTag) void submitInvite(); if (e.key === 'Escape') { setShowResults(false); } }}
                  placeholder="Search player name, or paste a VM tag…"
                  maxLength={20}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 lg:pl-7 pr-3 lg:pr-1.5 py-2 lg:py-0.5 text-xs lg:text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <button type="button" onClick={() => void submitInvite()} disabled={actionBusy === 'invite' || !inviteQueryLooksLikeTag} title={inviteQueryLooksLikeTag ? 'Send invite' : 'Pick a search result or type a full VM tag (VM-…)'} className="px-3 lg:px-1.5 py-2 lg:py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs lg:text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-50">
                {actionBusy === 'invite' ? <Loader2 className="w-3 h-3 lg:w-2.5 lg:h-2.5 animate-spin" /> : <Send className="w-3 h-3 lg:w-2.5 lg:h-2.5" />} Send Invite
              </button>
              <button type="button" onClick={() => { setShowInviteInput(false); setInviteTag(''); setShowResults(false); setInviteResults([]); }} className="p-1.5 lg:p-0.5 rounded text-slate-500 hover:text-white transition" aria-label="Cancel invite">
                <X className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5" />
              </button>
            </div>
            {/* Live name-search results */}
            {showResults && inviteTag.trim().length >= 2 && !inviteQueryLooksLikeTag && (
              <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/90 overflow-hidden">
                {inviteSearching && inviteResults.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Searching players…</div>
                ) : inviteResults.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-slate-500">No players found — check the spelling, or paste their VM tag.</div>
                ) : (
                  inviteResults.map((p) => {
                    const inClan = members.some((m) => m.userTag === p.userTag);
                    return (
                      <button
                        key={p.userTag}
                        type="button"
                        disabled={inClan}
                        onClick={() => pickInvitePlayer(p)}
                        className={`w-full px-3 lg:px-1.5 py-2 lg:py-0.5 flex items-center justify-between gap-2 text-left transition border-b border-slate-900 last:border-0 ${inClan ? 'opacity-40 cursor-not-allowed' : 'hover:bg-indigo-500/10'}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span aria-hidden>{countryFlag(p.country)}</span>
                          <span className="text-xs lg:text-[11px] font-bold text-white truncate">{p.name}</span>
                          <span className="text-[10px] font-mono text-slate-500">#{p.userTag}</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">{inClan ? 'Already here' : `Lvl ${p.level}${p.clanTag ? ` · [${p.clanTag}]` : ''}`}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
            <p className="text-[9px] lg:text-[11px] text-slate-500 mt-1.5 lg:mt-0.5 px-0.5">Start typing a <strong className="text-slate-400">name</strong> and tap a result, or paste a full <strong className="text-slate-400">VM tag</strong> for manual entry.</p>
          </div>
        )}
        {membersLoading ? <PanelSkeleton count={3} height="h-12" /> : (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
            {members.length === 0 ? (
              <div className="p-6 lg:p-3 text-center text-xs text-slate-500"><Users className="w-8 h-8 lg:w-5 lg:h-5 mx-auto mb-2 lg:mb-0.5 opacity-40" />No members.</div>
            ) : (
              <>
              {/* Desktop header */}
              <div className="hidden lg:block lg:col-span-12 lg:grid lg:grid-cols-12 lg:px-1.5 lg:py-1 text-slate-500 border-b border-slate-800">
                <div className="col-span-1"></div>
                <div className="col-span-3 lg:text-[11px]">Member</div>
                <div className="col-span-1 lg:text-[11px]">Lvl</div>
                <div className="col-span-2 lg:text-[11px]">Chips</div>
                <div className="col-span-2 lg:text-[11px]">Status</div>
                <div className="col-span-3 lg:text-[11px]">Actions</div>
              </div>
              <div className="max-h-72 lg:max-h-[200px] overflow-y-auto va-scroll lg:grid lg:grid-cols-12">
                <ol className="divide-y divide-slate-900 lg:contents">
                  {members.map((m) => {
                    const canPromote = isLeader && m.clanRank === 'Viper';
                    const canDemote = isLeader && m.clanRank === 'Co-Leader';
                    const canTransfer = isLeader && m.clanRank === 'Co-Leader';
                    // Co-Leaders can only kick Vipers (the API rejects the rest)
                    const canKick = canManage && m.clanRank !== 'Leader' && (isLeader || m.clanRank === 'Viper') && m.userTag !== playerUserTag;
                    const online = isOnline(m.lastSeenAt);
                    const isSelf = m.userTag === playerUserTag;
                    const actionButtons = (
                      <>
                        {canTransfer && (
                          <button type="button" title="Transfer Leader" disabled={actionBusy !== ''} onClick={() => onTransfer(m.userTag, m.name)} className="p-1.5 lg:p-0.5 rounded text-[10px] lg:text-[11px] bg-slate-900 hover:bg-amber-500/10 text-amber-300 border border-amber-500/20 transition disabled:opacity-50"><Crown className="w-3.5 lg:w-2.5 lg:h-2.5" /></button>
                        )}
                        {canPromote && (
                          <button type="button" title="Promote" disabled={actionBusy !== ''} onClick={() => onPromote(m.userTag, m.name)} className="p-1.5 lg:p-0.5 rounded text-[10px] lg:text-[11px] bg-slate-900 hover:bg-purple-500/10 text-purple-300 border border-purple-500/20 transition disabled:opacity-50"><ChevronUp className="w-3.5 lg:w-2.5 lg:h-2.5" /></button>
                        )}
                        {canDemote && (
                          <button type="button" title="Demote" disabled={actionBusy !== ''} onClick={() => onDemote(m.userTag, m.name)} className="p-1.5 lg:p-0.5 rounded text-[10px] lg:text-[11px] bg-slate-900 hover:bg-rose-500/10 text-rose-300 border border-rose-500/20 transition disabled:opacity-50"><ChevronDown className="w-3.5 lg:w-2.5 lg:h-2.5" /></button>
                        )}
                        {canKick && (
                          <button type="button" title="Kick" disabled={actionBusy !== ''} onClick={() => onKick(m.userTag, m.name)} className="p-1.5 lg:p-0.5 rounded text-[10px] lg:text-[11px] bg-slate-900 hover:bg-rose-500/10 text-rose-400 border border-rose-500/20 transition disabled:opacity-50"><UserMinus className="w-3.5 lg:w-2.5 lg:h-2.5" /></button>
                        )}
                        {canManage && !isSelf && (
                          <button type="button" title="Payout chips" disabled={actionBusy !== ''} onClick={() => onPayout(m.userTag)} className="p-1.5 lg:p-0.5 rounded text-[10px] lg:text-[11px] bg-slate-900 hover:bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 transition disabled:opacity-50"><Coins className="w-3.5 lg:w-2.5 lg:h-2.5" /></button>
                        )}
                        <button type="button" onClick={() => onInspect(m)} className="px-2 py-1 lg:px-1 lg:py-0.5 rounded text-[10px] lg:text-[11px] font-bold bg-slate-900 hover:bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 transition">Inspect</button>
                      </>
                    );
                    return (
                      <li key={m.userTag} className="lg:contents">
                        {/* Mobile card */}
                        <div className="flex lg:hidden lg:w-full px-4 py-3 text-sm items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-base" aria-hidden>{countryFlag(m.country)}</div>
                              {online ? (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
                              ) : (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-slate-600 border-2 border-slate-950" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                {m.name} <span className="text-[9px] lg:text-[11px] font-mono text-slate-500">{m.userTag}</span>
                                {m.clanRank && <span className={`text-[9px] lg:text-[11px] font-bold px-1.5 py-0.5 rounded border ${RANK_BG[m.clanRank] || RANK_BG.Viper}`}>{m.clanRank.toUpperCase()}</span>}
                                {isSelf && <span className="text-[9px] lg:text-[11px] font-mono text-slate-600">(you)</span>}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">Lvl {m.level} &middot; {m.bankedChips.toLocaleString()}c {online ? <span className="text-emerald-400">&middot; online</span> : <span className="text-slate-600">&middot; offline</span>}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {actionButtons}
                          </div>
                        </div>
                        {/* Desktop grid columns */}
                        <div className="hidden lg:contents">
                          <div className="col-span-1 flex items-center justify-center lg:py-1">
                            <div className="relative shrink-0">
                              <div className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center lg:text-[11px]" aria-hidden>{countryFlag(m.country)}</div>
                              {online ? (
                                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-slate-950" />
                              ) : (
                                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-950" />
                              )}
                            </div>
                          </div>
                          <div className="col-span-3 flex items-center lg:px-1.5 lg:py-1 min-w-0">
                            <div className="min-w-0 flex items-center gap-1 flex-wrap">
                              <span className="lg:text-[11px] font-bold text-white">{m.name}</span>
                              <span className="lg:text-[11px] font-mono text-slate-500">{m.userTag}</span>
                              {m.clanRank && <span className={`lg:text-[11px] font-bold px-1 py-0.5 rounded border ${RANK_BG[m.clanRank] || RANK_BG.Viper}`}>{m.clanRank.toUpperCase()}</span>}
                              {isSelf && <span className="lg:text-[11px] font-mono text-slate-600">(you)</span>}
                            </div>
                          </div>
                          <div className="col-span-1 flex items-center lg:text-[11px] lg:py-1 text-slate-300 font-mono">{m.level}</div>
                          <div className="col-span-2 flex items-center lg:text-[11px] lg:py-1 font-mono text-emerald-400">{m.bankedChips.toLocaleString()}c</div>
                          <div className="col-span-2 flex items-center lg:text-[11px] lg:py-1">{online ? <span className="text-emerald-400">online</span> : <span className="text-slate-600">offline</span>}</div>
                          <div className="col-span-3 flex items-center gap-0.5 lg:py-1">
                            {actionButtons}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Chat Feed */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div className="px-4 lg:px-1.5 py-2.5 lg:py-1 border-b border-slate-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" />
          <h4 className="text-sm lg:text-[11px] font-bold text-white">Syndicate Chat Feed</h4>
        </div>
        {chatLoading ? <PanelSkeleton count={3} height="h-10" /> : (
          <>
            <div className="p-4 lg:p-1.5 space-y-2 lg:space-y-0.5 max-h-[200px] lg:max-h-[100px] overflow-y-auto va-scroll">
              {chatMessages.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-4">No messages yet. Be the first to post!</div>
              ) : (
                chatMessages.map((msg) => {
                  const rankColor = RANK_COLORS[msg.rank] || 'text-indigo-300';
                  return (
                    <div key={msg.id} className="p-2 lg:p-1 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] lg:text-[11px] font-mono text-slate-500 mb-0.5">
                        <span className={`font-bold ${rankColor}`}>{msg.senderName}</span>
                        <span className="text-slate-600"> [{msg.rank}]</span>
                        {' \u00b7 '}{new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="text-xs lg:text-[11px] text-slate-200">{msg.message}</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-3 lg:p-1.5 border-t border-slate-800 flex items-center gap-2">
              <input type="text" value={broadcast} onChange={(e) => onBroadcastChange(e.target.value)} maxLength={300} placeholder="Type a message..." className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 lg:px-1.5 py-2 lg:py-0.5 text-xs lg:text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50" />
              <button type="button" onClick={() => onBroadcast()} disabled={actionBusy === 'broadcast' || !broadcast.trim()} className="px-3 lg:px-1.5 py-2 lg:py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs lg:text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-50">
                {actionBusy === 'broadcast' ? <Loader2 className="w-3.5 h-3.5 lg:w-3 lg:h-3 animate-spin" /> : <Send className="w-3.5 h-3.5 lg:w-3 lg:h-3" />} Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
