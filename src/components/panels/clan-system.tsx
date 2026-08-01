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
  Swords,
  ChevronUp,
  ChevronDown,
  ScrollText,
  Zap,
  UserCheck,
  UserMinus,
  Target,
} from 'lucide-react';

interface ClanSystemProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type Tab = 'mine' | 'browse' | 'form';
type MineSubTab = 'overview' | 'challenges' | 'activity';

interface ClanInfo {
  tag: string;
  name: string;
  emblem: string;
  description: string;
  level: number;
  xp: number;
  totalDeposited: number;
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
  lastSeenAt: string;
}

interface ChatMessage {
  id: string;
  senderTag: string;
  senderName: string;
  rank: string;
  message: string;
  createdAt: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  actorTag: string;
  actorName: string;
  detail: string | null;
  createdAt: string;
}

interface ClanChallenge {
  id: string;
  type: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
  claimedBy: string | null;
  weekStart: string;
}

const EMBLEM_OPTIONS = [
  { value: '\u0001f40d', label: '\u0001f40d Viper Snake' },
  { value: '\u0001f451', label: '\u0001f451 Royal Crown' },
  { value: '\u0001f977', label: '\u0001f977 Cyber Ninja' },
  { value: '\u0001f525', label: '\u0001f525 Phoenix Fire' },
  { value: '\u26a1', label: '\u26a1 Lightning Bolt' },
  { value: '\u0001f48e', label: '\u0001f48e Diamond Shield' },
];

const ACTIVITY_ICONS: Record<string, string> = {
  join: '\u2b06\ufe0f',
  leave: '\u2b07\ufe0f',
  deposit: '\u0001f4b0',
  create: '\u0001f3af',
  promote: '\u2b06\ufe0f',
  demote: '\u2b07\ufe0f',
  challenge_claim: '\u0001f3c6',
  level_up: '\u2b50',
};

const CHALLENGE_ICONS: Record<string, typeof Target> = {
  treasury_target: Coins,
  recruitment_drive: UserCheck,
  chat_activity: MessageSquare,
};

export function ClanSystem({ onToast, onInspectPlayer }: ClanSystemProps) {
  const { player, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('mine');
  const [mineSub, setMineSub] = useState<MineSubTab>('overview');
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
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [challenges, setChallenges] = useState<ClanChallenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState('');

  const playerClanTag = player?.clanTag || null;
  const isLeader = player?.clanRank === 'Leader';
  const isCoLeader = player?.clanRank === 'Co-Leader';
  const canManage = isLeader || isCoLeader;

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

  // Fetch members via proper API
  const fetchMembers = useCallback(async (tag: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/clans/members?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { members?: ClanMember[] };
        setMembers(data.members || []);
      } else {
        setMembers([]);
      }
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  // Fetch chat messages
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

  // Fetch activity log
  const fetchActivities = useCallback(async (tag: string) => {
    setActivitiesLoading(true);
    try {
      const res = await fetch(`/api/clans/activity?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { activities?: ActivityEntry[] };
        setActivities(data.activities || []);
      } else {
        setActivities([]);
      }
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  // Fetch challenges
  const fetchChallenges = useCallback(async (tag: string) => {
    setChallengesLoading(true);
    try {
      const res = await fetch(`/api/clans/challenges?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { challenges?: ClanChallenge[] };
        setChallenges(data.challenges || []);
      } else {
        setChallenges([]);
      }
    } catch {
      setChallenges([]);
    } finally {
      setChallengesLoading(false);
    }
  }, []);

  // Load data on mount and tab changes
  useEffect(() => {
    if (tab === 'browse') void fetchClans();
  }, [tab, fetchClans]);

  // Load data when in a clan
  useEffect(() => {
    if (!playerClanTag) return;
    void fetchChat(playerClanTag);
    void fetchMembers(playerClanTag);
    void fetchActivities(playerClanTag);
    void fetchChallenges(playerClanTag);
  }, [playerClanTag, fetchChat, fetchMembers, fetchActivities, fetchChallenges]);

  // Also refresh clans directory on mount
  useEffect(() => { void fetchClans(); }, [fetchClans]);

  // Player's clan info from the directory
  const myClanInfo = clans.find((c) => c.tag === playerClanTag);
  const xpNeeded = (myClanInfo?.level || 1) * 1000;
  const xpProgress = myClanInfo ? Math.min(100, Math.floor(((myClanInfo.xp || 0) / xpNeeded) * 100)) : 0;

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
      notify(`Welcome to ${clanName} [${tag}]!`, 'success', onToast);
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
      setActivities([]);
      setChallenges([]);
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
      void fetchChallenges(playerClanTag);
      void fetchActivities(playerClanTag);
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
      notify('Message sent to clan chat!', 'success', onToast);
      setBroadcast('');
      void fetchChat(playerClanTag);
      void fetchChallenges(playerClanTag);
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

  async function handleRoleAction(targetTag: string, action: 'promote' | 'demote', targetName: string) {
    if (!playerClanTag) return;
    setActionBusy(action);
    try {
      const res = await fetch('/api/clans/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTag, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        notify(data?.error || `Failed to ${action}.`, 'error', onToast);
        return;
      }
      const verb = action === 'promote' ? 'promoted' : 'demoted';
      notify(`${targetName} ${verb} successfully!`, 'success', onToast);
      void fetchMembers(playerClanTag);
      void fetchActivities(playerClanTag);
    } catch {
      notify(`Network error.`, 'error', onToast);
    } finally {
      setActionBusy('');
    }
  }

  async function handleClaimChallenge(challengeId: string) {
    if (!playerClanTag) return;
    setActionBusy('claim');
    try {
      const res = await fetch('/api/clans/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: playerClanTag, challengeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; newTreasury?: number };
      if (!res.ok) {
        notify(data?.error || 'Failed to claim reward.', 'error', onToast);
        return;
      }
      notify('Challenge reward claimed! Treasury funded.', 'success', onToast);
      void fetchChallenges(playerClanTag);
      void fetchClans();
      void fetchActivities(playerClanTag);
    } catch {
      notify('Network error claiming reward.', 'error', onToast);
    } finally {
      setActionBusy('');
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
            Form or join a player syndicate, pool chips into the Clan Treasury, complete weekly
            challenges, and dominate Clan Wars!
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
                Join an existing clan from the directory to participate in Clan Wars, complete
                weekly challenges, and earn extraction perks.
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
                  <span className="text-3xl" aria-hidden>{myClanInfo?.emblem || '\u0001f40d'}</span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                      {myClanInfo?.name || playerClanTag}
                      <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded">[{playerClanTag}]</span>
                      {player?.clanRank && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          isLeader
                            ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                            : isCoLeader
                            ? 'text-purple-300 bg-purple-500/10 border-purple-500/30'
                            : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
                        }` }>
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

              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>YOUR RANK</MicroLabel>
                  <div className="text-white mt-0.5 font-bold">{player?.clanRank || 'Viper'}</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>MEMBERS</MicroLabel>
                  <div className="text-white mt-0.5 font-bold">{myClanInfo?.memberCount || '?'} / 30</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>CLAN LEVEL</MicroLabel>
                  <div className="text-amber-400 mt-0.5 font-bold">Lvl {myClanInfo?.level || 1}</div>
                  {/* XP bar */}
                  <div className="mt-1.5 w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5 font-mono">{myClanInfo?.xp || 0} / {xpNeeded} XP</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>TOTAL DEPOSITED</MicroLabel>
                  <div className="text-emerald-400 mt-0.5 font-bold">{(myClanInfo?.totalDeposited || 0).toLocaleString()}c</div>
                </div>
              </div>

              {/* Sub-tabs for My Clan */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setMineSub('overview')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition border ${
                    mineSub === 'overview'
                      ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                      : 'text-slate-500 hover:text-slate-300 border-transparent'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setMineSub('challenges')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition border flex items-center gap-1 ${
                    mineSub === 'challenges'
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                      : 'text-slate-500 hover:text-slate-300 border-transparent'
                  }`}
                >
                  <Swords className="w-3 h-3" /> Challenges
                  {challenges.some((c) => c.progress >= c.target && !c.claimed) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMineSub('activity')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition border flex items-center gap-1 ${
                    mineSub === 'activity'
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                      : 'text-slate-500 hover:text-slate-300 border-transparent'
                  }`}
                >
                  <ScrollText className="w-3 h-3" /> Activity Log
                </button>
              </div>

              {/* OVERVIEW SUB-TAB */}
              {mineSub === 'overview' && (
                <div className="space-y-4">
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
                    <p className="text-[10px] text-slate-500 mt-1.5">+5% clan XP per deposit. Max 1,000,000c per transaction.</p>
                  </div>

                  {/* Quick Challenge Preview */}
                  {challenges.length > 0 && (
                    <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Swords className="w-4 h-4 text-amber-400" /> Weekly Challenges
                        </h4>
                        <button
                          type="button"
                          onClick={() => setMineSub('challenges')}
                          className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition"
                        >
                          View All &rarr;
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {challenges.slice(0, 3).map((ch) => {
                          const pct = Math.min(100, Math.floor((ch.progress / ch.target) * 100));
                          const done = ch.progress >= ch.target;
                          const Icon = CHALLENGE_ICONS[ch.type] || Target;
                          return (
                            <div key={ch.id} className={`p-2.5 rounded-xl border ${
                              ch.claimed ? 'border-emerald-500/30 bg-emerald-500/5' : done ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'
                            }`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Icon className="w-3 h-3 text-amber-400" />
                                <span className="text-[10px] font-bold text-white truncate">{ch.title}</span>
                                {ch.claimed && <Check className="w-3 h-3 text-emerald-400 ml-auto" />}
                              </div>
                              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${ch.claimed ? 'bg-emerald-500' : done ? 'bg-amber-400' : 'bg-amber-600/60'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="text-[9px] text-slate-500 mt-1 font-mono">{ch.progress}/{ch.target} &middot; +{ch.reward.toLocaleString()}c</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                            No members found.
                          </div>
                        ) : (
                          <ol className="divide-y divide-slate-900 max-h-72 overflow-y-auto va-scroll">
                            {members.map((m) => {
                              const canPromote = isLeader && m.clanRank === 'Viper';
                              const canDemote = isLeader && m.clanRank === 'Co-Leader';
                              const isSelf = m.userTag === player?.userTag;
                              return (
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
                                        {m.clanRank === 'Co-Leader' && (
                                          <span className="text-[9px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded">CO-LEADER</span>
                                        )}
                                        {isSelf && <span className="text-[9px] font-mono text-slate-600">(you)</span>}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-500">
                                        Level {m.level} &middot; {m.bankedChips.toLocaleString()}c
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {canPromote && (
                                      <button
                                        type="button"
                                        title="Promote to Co-Leader"
                                        disabled={actionBusy === 'promote' || actionBusy === 'demote'}
                                        onClick={() => void handleRoleAction(m.userTag, 'promote', m.name)}
                                        className="p-1.5 rounded text-[10px] font-bold bg-slate-900 hover:bg-purple-500/10 text-purple-300 border border-purple-500/20 transition disabled:opacity-50"
                                      >
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canDemote && (
                                      <button
                                        type="button"
                                        title="Demote to Viper"
                                        disabled={actionBusy === 'promote' || actionBusy === 'demote'}
                                        onClick={() => void handleRoleAction(m.userTag, 'demote', m.name)}
                                        className="p-1.5 rounded text-[10px] font-bold bg-slate-900 hover:bg-rose-500/10 text-rose-300 border border-rose-500/20 transition disabled:opacity-50"
                                      >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => inspectMember(m)}
                                      className="px-2 py-1 rounded text-[10px] font-bold bg-slate-900 hover:bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 transition"
                                    >
                                      Inspect
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Chat Feed */}
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
                                  {' \u00b7 '}{new Date(msg.createdAt).toLocaleTimeString()}
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

              {/* CHALLENGES SUB-TAB */}
              {mineSub === 'challenges' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Swords className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-white">Weekly Syndicate Challenges</h4>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Complete challenges with your clan to earn bonus treasury chips! Challenges reset every Monday.
                      {canManage ? ' Leaders and Co-Leaders can claim rewards.' : ' Ask a Leader or Co-Leader to claim rewards.'}
                    </p>
                  </div>

                  {challengesLoading ? <PanelSkeleton count={3} height="h-32" /> : (
                    <div className="space-y-3">
                      {challenges.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          <Swords className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          Challenges will appear when your clan is active.
                        </div>
                      ) : (
                        challenges.map((ch) => {
                          const pct = Math.min(100, Math.floor((ch.progress / ch.target) * 100));
                          const done = ch.progress >= ch.target;
                          const Icon = CHALLENGE_ICONS[ch.type] || Target;
                          return (
                            <div
                              key={ch.id}
                              className={`p-4 rounded-2xl border transition ${
                                ch.claimed
                                  ? 'border-emerald-500/30 bg-emerald-500/5'
                                  : done
                                  ? 'border-amber-500/40 bg-amber-500/10'
                                  : 'border-slate-800 bg-slate-950/60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    ch.claimed ? 'bg-emerald-500/20' : done ? 'bg-amber-500/20' : 'bg-slate-900'
                                  }`}>
                                    {ch.claimed ? (
                                      <Check className="w-4.5 h-4.5 text-emerald-400" />
                                    ) : (
                                      <Icon className={`w-4.5 h-4.5 ${done ? 'text-amber-400' : 'text-slate-500'}`} />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h5 className="text-xs font-bold text-white">{ch.title}</h5>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{ch.description}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                      <span className="text-[10px] font-mono text-slate-500">
                                        {ch.progress.toLocaleString()} / {ch.target.toLocaleString()}
                                      </span>
                                      <span className="text-[10px] font-mono text-emerald-400">
                                        +{ch.reward.toLocaleString()}c reward
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {done && !ch.claimed && canManage && (
                                  <button
                                    type="button"
                                    onClick={() => void handleClaimChallenge(ch.id)}
                                    disabled={actionBusy === 'claim'}
                                    className="shrink-0 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {actionBusy === 'claim' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Award className="w-3 h-3" />}
                                    Claim
                                  </button>
                                )}
                                {ch.claimed && (
                                  <span className="shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded">
                                    Claimed
                                  </span>
                                )}
                              </div>
                              {/* Progress bar */}
                              <div className="mt-3 w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${
                                    ch.claimed ? 'bg-emerald-500' : done ? 'bg-amber-400' : 'bg-amber-600/60'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              {ch.claimed && ch.claimedBy && (
                                <div className="text-[9px] text-slate-500 mt-1.5 font-mono">
                                  Claimed by {ch.claimedBy}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVITY LOG SUB-TAB */}
              {mineSub === 'activity' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-2 mb-1">
                      <ScrollText className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">Syndicate Activity Log</h4>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Track all clan events — joins, leaves, deposits, promotions, and challenge completions.
                    </p>
                  </div>

                  {activitiesLoading ? <PanelSkeleton count={5} height="h-10" /> : (
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
                      {activities.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          No activity yet. Start by depositing chips or inviting friends!
                        </div>
                      ) : (
                        <ol className="divide-y divide-slate-900 max-h-[400px] overflow-y-auto va-scroll">
                          {activities.map((a) => {
                            const icon = ACTIVITY_ICONS[a.type] || '\u2022';
                            const timeAgo = getTimeAgo(new Date(a.createdAt));
                            return (
                              <li key={a.id} className="px-4 py-2.5 text-sm flex items-center gap-3">
                                <span className="text-base shrink-0" aria-hidden>{icon}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs text-slate-200">
                                    <span className="font-bold text-white">{a.actorName}</span>
                                    <span className="text-slate-500 font-mono ml-1">{a.actorTag}</span>
                                    {a.detail && <span className="text-slate-400"> {a.detail}</span>}
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">{timeAgo}</span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              )}
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

function getTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
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
