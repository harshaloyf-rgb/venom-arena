'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { countryFlag, type InspectedPlayer } from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  PanelSkeleton,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Shield,
  Search,
  Plus,
  Trophy,
  Coins,
  Users,
  MessageSquare,
  Send,
  Award,
  Check,
  X,
  Loader2,
} from 'lucide-react';

interface ClanSystemProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type Tab = 'mine' | 'browse' | 'form';

interface ClanInfo {
  tag: string;
  name: string;
  emblem: string;
  description: string;
  level: number;
  bankedChips: number;
  memberCount: number;
}

interface ClanMember {
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips: number;
  clanRank: string | null;
  avatar: string | null;
}

interface ChatMessage {
  id: string;
  senderTag: string;
  senderName: string;
  rank: string;
  message: string;
  createdAt: string;
}

const EMBLEM_OPTIONS = [
  { value: '🐍', label: '🐍 Viper Snake' },
  { value: '👑', label: '👑 Royal Crown' },
  { value: '🥷', label: '🥷 Cyber Ninja' },
  { value: '🔥', label: '🔥 Phoenix Fire' },
  { value: '⚡', label: '⚡ Lightning Bolt' },
  { value: '💎', label: '💎 Diamond Shield' },
];

export function ClanSystem({ onToast, onInspectPlayer }: ClanSystemProps) {
  const { player, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('mine');
  const [search, setSearch] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [broadcast, setBroadcast] = useState('');
  const [formState, setFormState] = useState({
    name: '',
    tag: '',
    motto: '',
    emblem: EMBLEM_OPTIONS[0].value,
    description: '',
  });
  const [formBusy, setFormBusy] = useState(false);
  const [clans, setClans] = useState<ClanInfo[]>([]);
  const [clansLoading, setClansLoading] = useState(false);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState('');

  const playerClanTag = player?.clanTag || null;

  // Fetch clan directory for Browse tab
  const fetchClans = useCallback(async () => {
    setClansLoading(true);
    try {
      const res = await fetch('/api/clans/list', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { clans?: ClanInfo[] };
      setClans(data.clans || []);
    } catch {
      setClans([]);
    } finally {
      setClansLoading(false);
    }
  }, []);

  // Fetch members when player is in a clan
  const fetchMembers = useCallback(async (tag: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch('/api/clans/list', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { clans?: ClanInfo[] };
      const clan = (data.clans || []).find((c) => c.tag === tag);
      if (!clan) { setMembers([]); return; }
      // Fetch all clan members via a leaderboard-like approach
      // We'll use the chat members as a proxy, but better: fetch from player list
      const res2 = await fetch(`/api/leaderboard?type=chips&limit=100`, { cache: 'no-store' });
      const lbData = (await res2.json().catch(() => ({}))) as { entries?: LeaderboardEntry[] };
      // Filter players with this clanTag (this is approximate — we show the clan info from the clan itself)
      const clanMembers: ClanMember[] = (lbData.entries || [])
        .filter((e) => e.userTag.includes(tag))
        .slice(0, 30)
        .map((e) => ({
          userTag: e.userTag,
          name: e.name,
          country: e.country,
          level: e.level,
          bankedChips: e.bankedChips,
          clanRank: null,
          avatar: null,
        }));
      setMembers(clanMembers);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  // Fetch chat messages for My Clan tab
  const fetchChat = useCallback(async (tag: string) => {
    setChatLoading(true);
    try {
      const res = await fetch(`/api/clans/chat?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { messages?: ChatMessage[] };
      setChatMessages(data.messages || []);
    } catch {
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  // Load data on mount and tab changes
  useEffect(() => {
    if (tab === 'browse') void fetchClans();
  }, [tab, fetchClans]);

  useEffect(() => {
    if (tab === 'mine' && playerClanTag) {
      void fetchChat(playerClanTag);
    }
  }, [tab, playerClanTag, fetchChat]);

  // Also refresh when player data changes (e.g. after joining/leaving)
  useEffect(() => {
    if (playerClanTag && tab === 'mine') {
      void fetchChat(playerClanTag);
      void fetchMembers(playerClanTag);
    }
  }, [playerClanTag, tab, fetchChat, fetchMembers]);

  // Player's clan info from the directory
  const myClanInfo = clans.find((c) => c.tag === playerClanTag);

  const filteredClans = useMemo(() => {
    if (!search.trim()) return clans;
    const q = search.toLowerCase();
    return clans.filter((c) => c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q));
  }, [clans, search]);

  if (!player) return <NotSignedIn />;

  async function handleJoinClan(tag: string, clanName: string) {
    if (playerClanTag) {
      notify('You are already in a clan! Leave your current clan first.', 'error', onToast);
      return;
    }
    setActionBusy('join');
    try {
      const res = await fetch('/api/clans/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        notify(data?.error || 'Failed to join clan.', 'error', onToast);
        return;
      }
      notify(`Welcome to ${clanName} [${tag}]! 🛡️`, 'success', onToast);
      await refresh();
      void fetchClans();
    } catch {
      notify('Network error joining clan.', 'error', onToast);
    } finally {
      setActionBusy('');
    }
  }

  async function handleLeaveClan() {
    if (!playerClanTag) return;
    setActionBusy('leave');
    try {
      const res = await fetch('/api/clans/leave', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        notify(data?.error || 'Failed to leave clan.', 'error', onToast);
        return;
      }
      const clanName = myClanInfo?.name || playerClanTag;
      notify(`Left ${clanName} [${playerClanTag}].`, 'info', onToast);
      await refresh();
      void fetchClans();
      setChatMessages([]);
      setMembers([]);
    } catch {
      notify('Network error leaving clan.', 'error', onToast);
    } finally {
      setActionBusy('');
    }
  }

  async function handleDeposit() {
    const amt = parseInt(depositAmount, 10);
    if (!amt || amt <= 0) {
      notify('Enter a valid deposit amount.', 'error', onToast);
      return;
    }
    if (amt > player.bankedChips) {
      notify('Insufficient chips to deposit.', 'error', onToast);
      return;
    }
    if (!playerClanTag) {
      notify('You must be in a clan to deposit.', 'error', onToast);
      return;
    }
    setActionBusy('deposit');
    try {
      const res = await fetch('/api/clans/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: playerClanTag, amount: amt }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; newTreasury?: number };
      if (!res.ok) {
        notify(data?.error || 'Failed to deposit.', 'error', onToast);
        return;
      }
      notify(`Deposited ${amt.toLocaleString()}c to clan treasury!`, 'success', onToast);
      setDepositAmount('');
      await refresh();
      void fetchClans();
    } catch {
      notify('Network error depositing chips.', 'error', onToast);
    } finally {
      setActionBusy('');
    }
  }

  async function handleBroadcast() {
    if (!broadcast.trim() || !playerClanTag) return;
    setActionBusy('broadcast');
    try {
      const res = await fetch('/api/clans/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: playerClanTag, message: broadcast.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        notify(data?.error || 'Failed to send broadcast.', 'error', onToast);
        return;
      }
      notify('Broadcast posted to clan chat! 📢', 'success', onToast);
      setBroadcast('');
      void fetchChat(playerClanTag);
    } catch {
      notify('Network error sending broadcast.', 'error', onToast);
    } finally {
      setActionBusy('');
    }
  }

  async function handleFormSubmit() {
    if (!formState.name.trim() || !formState.tag.trim()) {
      notify('Syndicate Name and Clan Tag are required.', 'error', onToast);
      return;
    }
    if (playerClanTag) {
      notify('Leave your current clan before forming a new one.', 'error', onToast);
      return;
    }
    setFormBusy(true);
    try {
      const res = await fetch('/api/clans/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: formState.tag,
          name: formState.name,
          emblem: formState.emblem,
          description: formState.motto || formState.description,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; clanTag?: string };
      if (!res.ok) {
        notify(data?.error || 'Failed to create clan.', 'error', onToast);
        return;
      }
      notify(`Syndicate "${formState.name}" [${data.clanTag}] formed! You are the Leader.`, 'success', onToast);
      setFormState({ name: '', tag: '', motto: '', emblem: EMBLEM_OPTIONS[0].value, description: '' });
      setTab('mine');
      await refresh();
      void fetchClans();
    } catch {
      notify('Network error creating clan.', 'error', onToast);
    } finally {
      setFormBusy(false);
    }
  }

  function inspectMember(m: ClanMember) {
    if (!onInspectPlayer) return;
    onInspectPlayer({
      name: m.name,
      userTag: m.userTag,
      country: m.country,
      flag: countryFlag(m.country),
      bankedChips: m.bankedChips,
      level: m.level,
      clanTag: playerClanTag || undefined,
      clanName: myClanInfo?.name || undefined,
    });
  }

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-indigo-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-5.5 h-5.5 text-indigo-400" />
            Viper Clan &amp; Syndicate Guild HQ
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Form or join a player syndicate, pool chips into the Clan Treasury, level up for
            extraction perks, and dominate Clan Wars!
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-5">
        <ClanTabBtn active={tab === 'mine'} onClick={() => setTab('mine')} icon={Shield} label="My Clan" />
        <ClanTabBtn active={tab === 'browse'} onClick={() => setTab('browse')} icon={Search} label="Browse Clans" />
        <ClanTabBtn active={tab === 'form'} onClick={() => setTab('form')} icon={Plus} label="Form Syndicate" />
      </div>

      {/* MY CLAN TAB */}
      {tab === 'mine' && (
        <div>
          {!playerClanTag ? (
            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-950/60 text-center max-w-md mx-auto">
              <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">You are not in a Viper Clan</h3>
              <p className="text-xs text-slate-400 mt-2 mb-4">
                Join an existing clan from the directory to participate in Clan Wars and earn
                extraction perks, or form your own syndicate!
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab('browse')}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                >
                  Browse Clans
                </button>
                <button
                  type="button"
                  onClick={() => setTab('form')}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white text-xs font-bold transition"
                >
                  Form Syndicate
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 flex-wrap p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-3xl" aria-hidden>{myClanInfo?.emblem || '🐍'}</span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                      {myClanInfo?.name || playerClanTag}
                      <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded">[{playerClanTag}]</span>
                      {player?.clanRank && (
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          <Trophy className="w-2.5 h-2.5 inline mr-0.5" /> {player.clanRank}
                        </span>
                      )}
                    </h3>
                    {myClanInfo?.description && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5">&quot;{myClanInfo.description}&quot;</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleLeaveClan()}
                  disabled={actionBusy === 'leave'}
                  className="px-3 py-2 rounded-lg bg-slate-950 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionBusy === 'leave' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Leave Syndicate
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>YOUR RANK</MicroLabel>
                  <div className="text-white mt-0.5">{player?.clanRank || 'Viper'}</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>MEMBERS</MicroLabel>
                  <div className="text-white mt-0.5">{myClanInfo?.memberCount || '?'} / 30</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>CLAN LEVEL</MicroLabel>
                  <div className="text-white mt-0.5">Lvl {myClanInfo?.level || 1}</div>
                </div>
              </div>

              {/* Treasury */}
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" /> Clan Treasury Bank
                  </h4>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    {(myClanInfo?.bankedChips || 0).toLocaleString()} c
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Amt (e.g. 100)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDeposit()}
                    disabled={actionBusy === 'deposit'}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionBusy === 'deposit' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                    Deposit
                  </button>
                </div>
              </div>

              {/* Perks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { title: 'Self-Sponsored Arenas', desc: 'Host custom clan tournaments funded by Treasury' },
                  { title: 'Clan Tag Emblem', desc: `Displays [${playerClanTag}] badge in match leaderboards` },
                  { title: 'Syndicate Wars Access', desc: 'Qualified for weekly Clan vs Clan prize matches' },
                ].map((p) => (
                  <div key={p.title} className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                    <h5 className="text-xs font-bold text-white">{p.title}</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                  </div>
                ))}
              </div>

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" /> Member Roster ({myClanInfo?.memberCount || 0})
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">Max Capacity: 30</span>
                </div>
                {membersLoading ? <PanelSkeleton count={3} height="h-12" /> : (
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
                    {members.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Clan roster will populate as members play matches.
                      </div>
                    ) : (
                      <ol className="divide-y divide-slate-900 max-h-64 overflow-y-auto va-scroll">
                        {members.map((m) => (
                          <li key={m.userTag} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-base shrink-0" aria-hidden>
                                {countryFlag(m.country)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate flex items-center gap-1.5 flex-wrap">
                                  {m.name}
                                  <span className="text-[9px] font-mono text-slate-500">{m.userTag}</span>
                                  {m.clanRank === 'Leader' && (
                                    <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">LEADER</span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  Level {m.level}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono font-bold text-emerald-400">{m.bankedChips.toLocaleString()}c</span>
                              <button
                                type="button"
                                onClick={() => inspectMember(m)}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-slate-900 hover:bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 transition"
                              >
                                Inspect
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>

              {/* Broadcast Feed */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" /> Syndicate Chat Feed
                  </h4>
                </div>
                {chatLoading ? <PanelSkeleton count={3} height="h-10" /> : (
                  <>
                    <div className="p-4 space-y-2 max-h-[200px] overflow-y-auto va-scroll">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-xs text-slate-500 py-4">No messages yet. Be the first to post!</div>
                      ) : (
                        chatMessages.map((msg) => (
                          <div key={msg.id} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                            <div className="text-[10px] font-mono text-slate-500 mb-0.5">
                              <span className="text-indigo-300 font-bold">{msg.senderName}</span>
                              <span className="text-slate-600"> [{msg.rank}]</span>
                              {' · '}{new Date(msg.createdAt).toLocaleTimeString()}
                            </div>
                            <div className="text-xs text-slate-200">{msg.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-3 border-t border-slate-800 flex items-center gap-2">
                      <input
                        type="text"
                        value={broadcast}
                        onChange={(e) => setBroadcast(e.target.value)}
                        placeholder="Type a message for your clan..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => void handleBroadcast()}
                        disabled={actionBusy === 'broadcast' || !broadcast.trim()}
                        className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionBusy === 'broadcast' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BROWSE TAB */}
      {tab === 'browse' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clans by name or tag..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {clansLoading ? <PanelSkeleton count={6} height="h-52" /> : (
            <>
              {clans.length === 0 ? (
                <div className="p-8 rounded-2xl border border-slate-800 bg-slate-950/60 text-center max-w-md mx-auto">
                  <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white">No Clans Found</h3>
                  <p className="text-xs text-slate-400 mt-2 mb-4">
                    No syndicate clans have been formed yet. Be the first to create one!
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('form')}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                  >
                    Form the First Syndicate
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClans.map((clan) => {
                    const isJoined = playerClanTag === clan.tag;
                    return (
                      <div key={clan.tag} className="p-4 rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-3xl" aria-hidden>{clan.emblem}</span>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-white truncate">{clan.name}</h4>
                              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 rounded">[{clan.tag}]</span>
                            </div>
                          </div>
                        </div>
                        {clan.description && (
                          <p className="text-[11px] text-slate-400 italic">&quot;{clan.description}&quot;</p>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                          <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-center">
                            <MicroLabel>LEVEL</MicroLabel>
                            <div className="text-amber-400 mt-0.5">{clan.level}</div>
                          </div>
                          <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-center">
                            <MicroLabel>MEMBERS</MicroLabel>
                            <div className="text-white mt-0.5">{clan.memberCount}/30</div>
                          </div>
                          <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-center">
                            <MicroLabel>TREASURY</MicroLabel>
                            <div className="text-emerald-400 mt-0.5">{clan.bankedChips >= 1_000_000 ? `${(clan.bankedChips / 1_000_000).toFixed(1)}M` : `${clan.bankedChips.toLocaleString()}`}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleJoinClan(clan.tag, clan.name)}
                          disabled={isJoined || !!playerClanTag || actionBusy === 'join'}
                          className={`w-full py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${isJoined ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-default' : !!playerClanTag ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                        >
                          {actionBusy === 'join' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          {isJoined ? 'Already a Member' : 'Join Syndicate'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* FORM TAB */}
      {tab === 'form' && (
        <div className="max-w-xl mx-auto p-5 rounded-2xl border border-slate-800 bg-slate-950/60 shadow-md">
          <h3 className="text-base font-black text-white flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-indigo-400" /> Form a New Viper Syndicate Clan
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Syndicate Name</label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Omega Extractions"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Clan Tag (3-5 Chars, Letters/Numbers)</label>
              <input
                type="text"
                value={formState.tag}
                onChange={(e) => setFormState((f) => ({ ...f, tag: e.target.value.toUpperCase() }))}
                placeholder="e.g. OMG"
                maxLength={5}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Syndicate Description</label>
              <input
                type="text"
                value={formState.motto}
                onChange={(e) => setFormState((f) => ({ ...f, motto: e.target.value }))}
                placeholder="e.g. Extraction above all else."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Emblem Logo</label>
              <select
                value={formState.emblem}
                onChange={(e) => setFormState((f) => ({ ...f, emblem: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
              >
                {EMBLEM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="text-[11px] font-mono">
                <div className="text-slate-400">Formation: <span className="text-emerald-300 font-bold">Free</span></div>
              </div>
              <button
                type="button"
                onClick={() => void handleFormSubmit()}
                disabled={formBusy}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {formBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                Form Syndicate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Used for the leaderboard API response type
interface LeaderboardEntry {
  userTag: string;
  name: string;
  country: string;
  bankedChips: number;
  level: number;
  rank: number;
}

interface ClanTabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Shield;
  label: string;
}

function ClanTabBtn({ active, onClick, icon: Icon, label }: ClanTabBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${active ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

export default ClanSystem;
