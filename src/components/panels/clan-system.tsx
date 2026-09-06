'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { countryFlag } from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  PanelSkeleton,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Shield, Search, Plus, Trophy, LogOut, Loader2, Swords, ScrollText, Skull, TrendingUp, Circle, Settings, X, Check, AlertTriangle, Mail, UserPlus,
} from 'lucide-react';

// Sub-view components
import { ClanOverview } from './clan/clan-overview';
import { ClanWars } from './clan/clan-wars';
import { ClanChallenges } from './clan/clan-challenges';
import { ClanStatsView } from './clan/clan-stats';
import { ClanActivity } from './clan/clan-activity';
import { ClanBrowse } from './clan/clan-browse';

// Types & constants
import {
  EMBLEM_OPTIONS, RANK_BG,
  type Tab, type MineSubTab, type ClanSystemProps,
  type ClanInfo, type ClanMember, type ChatMessage, type ActivityEntry,
  type ClanChallenge, type ClanStats, type WarInfo, type ClanInviteRow,
} from './clan/_types';

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
  const [clanStats, setClanStats] = useState<ClanStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeWar, setActiveWar] = useState<WarInfo | null>(null);
  const [warLoading, setWarLoading] = useState(false);
  const [warWager, setWarWager] = useState('');
  const [warSearch, setWarSearch] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '', emblem: '' });
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [invites, setInvites] = useState<ClanInviteRow[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const playerClanTag = player?.clanTag || null;
  const isLeader = player?.clanRank === 'Leader';
  const isCoLeader = player?.clanRank === 'Co-Leader';
  const canManage = isLeader || isCoLeader;

  // ─── Fetch functions ───────────────────────────────────────

  const fetchClans = useCallback(async () => {
    setClansLoading(true);
    try {
      const res = await fetch('/api/clans/list', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { clans?: ClanInfo[] };
      setClans(data.clans || []);
    } catch { setClans([]); } finally { setClansLoading(false); }
  }, []);

  const fetchMembers = useCallback(async (tag: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/clans/members?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { members?: ClanMember[] };
        setMembers(data.members || []);
      } else { setMembers([]); }
    } catch { setMembers([]); } finally { setMembersLoading(false); }
  }, []);

  const fetchChat = useCallback(async (tag: string) => {
    setChatLoading(true);
    try {
      const res = await fetch(`/api/clans/chat?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { messages?: ChatMessage[] };
      setChatMessages(data.messages || []);
    } catch { setChatMessages([]); } finally { setChatLoading(false); }
  }, []);

  const fetchActivities = useCallback(async (tag: string) => {
    setActivitiesLoading(true);
    try {
      const res = await fetch(`/api/clans/activity?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { activities?: ActivityEntry[] };
        setActivities(data.activities || []);
      } else { setActivities([]); }
    } catch { setActivities([]); } finally { setActivitiesLoading(false); }
  }, []);

  const fetchChallenges = useCallback(async (tag: string) => {
    setChallengesLoading(true);
    try {
      const res = await fetch(`/api/clans/challenges?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { challenges?: ClanChallenge[] };
        setChallenges(data.challenges || []);
      } else { setChallenges([]); }
    } catch { setChallenges([]); } finally { setChallengesLoading(false); }
  }, []);

  const fetchStats = useCallback(async (tag: string) => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/clans/stats?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as ClanStats;
        setClanStats(data);
      }
    } catch {} finally { setStatsLoading(false); }
  }, []);

  const fetchWar = useCallback(async (tag: string) => {
    setWarLoading(true);
    try {
      const res = await fetch(`/api/clans/war?tag=${encodeURIComponent(tag)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { war: WarInfo | null };
        setActiveWar(data.war);
      }
    } catch { setActiveWar(null); } finally { setWarLoading(false); }
  }, []);

  const fetchInvites = useCallback(async () => {
    setInvitesLoading(true);
    try {
      const res = await fetch('/api/clans/invites', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { invites?: ClanInviteRow[] };
      setInvites(data.invites || []);
    } catch { setInvites([]); } finally { setInvitesLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'browse') void fetchClans();
  }, [tab, fetchClans]);

  useEffect(() => {
    if (!playerClanTag) return;
    void fetchChat(playerClanTag);
    void fetchMembers(playerClanTag);
    void fetchActivities(playerClanTag);
    void fetchChallenges(playerClanTag);
    void fetchStats(playerClanTag);
    void fetchWar(playerClanTag);
  }, [playerClanTag, fetchChat, fetchMembers, fetchActivities, fetchChallenges, fetchStats, fetchWar]);

  useEffect(() => { void fetchClans(); }, [fetchClans]);

  // Pending syndicate invites matter while clanless — clear once you join one
  useEffect(() => {
    if (!player) return;
    if (!playerClanTag) void fetchInvites();
    else setInvites([]);
  }, [player, playerClanTag, fetchInvites]);

  const myClanInfo = clans.find((c) => c.tag === playerClanTag);
  const xpNeeded = (myClanInfo?.level || 1) * 1000;
  const xpProgress = myClanInfo ? Math.min(100, Math.floor(((myClanInfo.xp || 0) / xpNeeded) * 100)) : 0;

  const filteredClans = useMemo(() => {
    if (!search.trim()) return clans;
    const q = search.toLowerCase();
    return clans.filter((c) => c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q));
  }, [clans, search]);

  const quickDeposits = useMemo(() => {
    const bal = player?.bankedChips || 0;
    return [
      { label: '10%', value: Math.floor(bal * 0.1) },
      { label: '25%', value: Math.floor(bal * 0.25) },
      { label: '50%', value: Math.floor(bal * 0.5) },
      { label: 'MAX', value: bal },
    ];
  }, [player?.bankedChips]);

  if (!player) return <NotSignedIn />;

  // ─── Handlers ─────────────────────────────────────────────

  async function handleJoinClan(tag: string, clanName: string) {
    if (playerClanTag) { notify('Already in a clan!', 'error', onToast); return; }
    setActionBusy('join');
    try {
      const res = await fetch('/api/clans/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed to join.', 'error', onToast); return; }
      notify(`Welcome to ${clanName} [${tag}]!`, 'success', onToast);
      await refresh(); void fetchClans();
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleLeaveClan() {
    if (!playerClanTag) return;
    setActionBusy('leave');
    try {
      const res = await fetch('/api/clans/leave', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed to leave.', 'error', onToast); return; }
      notify(`Left ${myClanInfo?.name || playerClanTag}.`, 'info', onToast);
      await refresh(); void fetchClans(); setChatMessages([]); setMembers([]); setActivities([]); setChallenges([]);
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleDeposit(amt?: number) {
    const val = amt ?? parseInt(depositAmount, 10);
    if (!val || val <= 0) { notify('Enter a valid amount.', 'error', onToast); return; }
    if (!player || val > player.bankedChips) { notify('Insufficient chips.', 'error', onToast); return; }
    if (!playerClanTag) { notify('Join a clan first.', 'error', onToast); return; }
    setActionBusy('deposit');
    try {
      const res = await fetch('/api/clans/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: playerClanTag, amount: val }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed to deposit.', 'error', onToast); return; }
      notify(`Deposited ${val.toLocaleString()}c!`, 'success', onToast);
      setDepositAmount('');
      await refresh(); void fetchClans(); void fetchChallenges(playerClanTag); void fetchActivities(playerClanTag); void fetchStats(playerClanTag);
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleWithdraw() {
    const val = parseInt(depositAmount, 10);
    if (!val || val <= 0) { notify('Enter a valid amount.', 'error', onToast); return; }
    if (!playerClanTag) return;
    setActionBusy('withdraw');
    try {
      const res = await fetch('/api/clans/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: playerClanTag, amount: val }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed to withdraw.', 'error', onToast); return; }
      notify(`Withdrew ${val.toLocaleString()}c!`, 'success', onToast);
      setDepositAmount('');
      await refresh(); void fetchClans(); void fetchMembers(playerClanTag); void fetchActivities(playerClanTag); void fetchStats(playerClanTag);
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handlePayout(targetUserTag: string) {
    const val = parseInt(depositAmount, 10);
    if (!val || val <= 0) { notify('Enter a valid amount.', 'error', onToast); return; }
    if (!playerClanTag) return;
    setActionBusy('payout');
    try {
      const res = await fetch('/api/clans/payout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: playerClanTag, targetUserTag, amount: val }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Payout failed.', 'error', onToast); return; }
      notify(`Distributed ${val.toLocaleString()}c!`, 'success', onToast);
      setDepositAmount('');
      await refresh(); void fetchClans(); void fetchMembers(playerClanTag); void fetchActivities(playerClanTag); void fetchStats(playerClanTag);
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleShopPurchase(itemId: string) {
    if (!playerClanTag) return;
    setActionBusy('shop');
    try {
      const res = await fetch('/api/clans/shop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: playerClanTag, itemId }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; effect?: string };
      if (!res.ok) { notify(data?.error || 'Purchase failed.', 'error', onToast); return; }
      notify(data?.effect || 'Purchased!', 'success', onToast);
      await refresh(); void fetchClans(); void fetchMembers(playerClanTag);
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleDeclareWar(targetTag: string) {
    if (!playerClanTag) return;
    const wager = Math.floor(Number(warWager) || 0);
    if (wager < 1000) { notify('Minimum wager is 1,000c.', 'error', onToast); return; }
    setActionBusy('war');
    try {
      const res = await fetch('/api/clans/war/declare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: playerClanTag, targetTag, wager }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; totalPot?: number };
      if (!res.ok) {
        const msg = data?.error || 'War declaration failed.';
        if (msg === 'TARGET_SHIELDED') notify('Target clan has an active War Shield!', 'error', onToast);
        else notify(msg, 'error', onToast);
        return;
      }
      notify(`War declared! Pot: ${data.totalPot?.toLocaleString()}c`, 'success', onToast);
      setWarWager(''); setWarSearch('');
      await refresh(); void fetchClans(); void fetchWar(playerClanTag); void fetchActivities(playerClanTag);
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleBroadcast() {
    if (!broadcast.trim() || !playerClanTag) return;
    setActionBusy('broadcast');
    try {
      const res = await fetch('/api/clans/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: playerClanTag, message: broadcast.trim() }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed.', 'error', onToast); return; }
      notify('Message sent!', 'success', onToast); setBroadcast('');
      void fetchChat(playerClanTag); void fetchChallenges(playerClanTag);
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleFormSubmit() {
    if (!formState.name.trim() || !formState.tag.trim()) { notify('Name and Tag required.', 'error', onToast); return; }
    if (playerClanTag) { notify('Leave your clan first.', 'error', onToast); return; }
    setFormBusy(true);
    try {
      const res = await fetch('/api/clans/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: formState.tag, name: formState.name, emblem: formState.emblem, description: formState.motto || formState.description }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; clanTag?: string };
      if (!res.ok) { notify(data?.error || 'Failed.', 'error', onToast); return; }
      notify(`Syndicate "${formState.name}" [${data.clanTag}] formed!`, 'success', onToast);
      setFormState({ name: '', tag: '', motto: '', emblem: EMBLEM_OPTIONS[0].value, description: '' });
      setTab('mine'); await refresh(); void fetchClans();
    } catch { notify('Network error.', 'error', onToast); } finally { setFormBusy(false); }
  }

  async function handleRoleAction(targetTag: string, action: 'promote' | 'demote', targetName: string) {
    if (!playerClanTag) return;
    setActionBusy(action);
    try {
      const res = await fetch('/api/clans/role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetTag, action }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || `Failed to ${action}.`, 'error', onToast); return; }
      notify(`${targetName} ${action}d!`, 'success', onToast);
      void fetchMembers(playerClanTag); void fetchActivities(playerClanTag);
    } catch {} finally { setActionBusy(''); }
  }

  async function handleKickMember(targetTag: string, targetName: string) {
    if (!playerClanTag) return;
    setActionBusy('kick');
    try {
      const res = await fetch('/api/clans/kick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetTag }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed to kick.', 'error', onToast); return; }
      notify(`${targetName} was kicked.`, 'info', onToast);
      void fetchMembers(playerClanTag); void fetchActivities(playerClanTag); void fetchClans(); void fetchStats(playerClanTag);
    } catch {} finally { setActionBusy(''); }
  }

  async function handleClaimChallenge(challengeId: string) {
    if (!playerClanTag) return;
    setActionBusy('claim');
    try {
      const res = await fetch('/api/clans/challenges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: playerClanTag, challengeId }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed.', 'error', onToast); return; }
      notify('Challenge reward claimed!', 'success', onToast);
      void fetchChallenges(playerClanTag); void fetchClans(); void fetchActivities(playerClanTag); void fetchStats(playerClanTag);
    } catch {} finally { setActionBusy(''); }
  }

  function openSettings() {
    setSettingsForm({ name: myClanInfo?.name || '', description: myClanInfo?.description || '', emblem: myClanInfo?.emblem || EMBLEM_OPTIONS[0].value });
    setShowSettings(true);
  }

  async function handleDisbandClan() {
    if (!playerClanTag) return;
    if (!confirm('Are you ABSOLUTELY sure you want to disband this syndicate? This action CANNOT be undone. All members, activity, challenges, and chat messages will be permanently deleted.')) return;
    setActionBusy('disband');
    try {
      const res = await fetch('/api/clans/disband', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed to disband.', 'error', onToast); return; }
      notify(`Syndicate [${playerClanTag}] has been disbanded.`, 'info', onToast);
      setShowSettings(false);
      await refresh(); void fetchClans(); setChatMessages([]); setMembers([]); setActivities([]); setChallenges([]); setClanStats(null);
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleTransferLeadership(targetTag: string, targetName: string) {
    if (!playerClanTag) return;
    if (!confirm(`Transfer leadership to ${targetName}? You will become a Co-Leader.`)) return;
    setActionBusy('transfer');
    try {
      const res = await fetch('/api/clans/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetTag }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed to transfer.', 'error', onToast); return; }
      notify(`Leadership transferred to ${targetName}!`, 'success', onToast);
      await refresh(); void fetchMembers(playerClanTag); void fetchActivities(playerClanTag); void fetchClans();
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  async function handleSaveSettings() {
    if (!playerClanTag) return;
    setSettingsBusy(true);
    try {
      const body: Record<string, string> = { tag: playerClanTag };
      if (settingsForm.name.trim().length >= 3) body.name = settingsForm.name.trim();
      body.description = settingsForm.description;
      body.emblem = settingsForm.emblem;
      const res = await fetch('/api/clans/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) { notify(data?.error || 'Failed.', 'error', onToast); return; }
      notify('Clan settings updated!', 'success', onToast);
      setShowSettings(false); await refresh(); void fetchClans(); void fetchActivities(playerClanTag);
    } catch {} finally { setSettingsBusy(false); }
  }

  async function handleInvitePlayer(userTag: string): Promise<boolean> {
    if (!playerClanTag) return false;
    setActionBusy('invite');
    try {
      const res = await fetch('/api/clans/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userTag }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; inviteeName?: string };
      if (!res.ok) { notify(data?.error || 'Failed to send invite.', 'error', onToast); return false; }
      notify(`Invite sent to ${data.inviteeName || userTag}!`, 'success', onToast);
      void fetchActivities(playerClanTag);
      return true;
    } catch { notify('Network error.', 'error', onToast); return false; } finally { setActionBusy(''); }
  }

  async function handleRespondInvite(invite: ClanInviteRow, action: 'accept' | 'decline') {
    setActionBusy(`invite-${invite.id}`);
    try {
      const res = await fetch('/api/clans/invites/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteId: invite.id, action }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; clanName?: string };
      if (!res.ok) { notify(data?.error || 'Failed to respond.', 'error', onToast); void fetchInvites(); return; }
      if (action === 'accept') {
        notify(`Welcome to ${data.clanName || invite.clanName} [${invite.clanTag}]!`, 'success', onToast);
        await refresh(); // player.clanTag updates → clan data effect takes over
        void fetchClans(); // refresh cached clan list (member count / treasury in header)
      } else {
        notify(`Declined the invite from ${invite.clanName}.`, 'info', onToast);
        void fetchInvites();
      }
    } catch { notify('Network error.', 'error', onToast); } finally { setActionBusy(''); }
  }

  function inspectMember(m: ClanMember) {
    if (!onInspectPlayer) return;
    onInspectPlayer({ name: m.name, userTag: m.userTag, country: m.country, flag: countryFlag(m.country), bankedChips: m.bankedChips, level: m.level, clanTag: playerClanTag || undefined, clanName: myClanInfo?.name || undefined });
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 lg:p-1.5 overflow-hidden">
      <GlowBlob color="bg-indigo-500/10" className="-top-12 -right-12 w-56 h-56 lg:w-24 lg:h-24" />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-1 mb-5 lg:mb-1 pb-5 lg:pb-1 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-[11px] font-sans font-black text-white tracking-tight flex items-center gap-2.5 lg:gap-1">
            <Shield className="w-5.5 h-5.5 lg:w-3 lg:h-3 text-indigo-400" />
            Viper Clan &amp; Syndicate Guild HQ
          </h2>
          <p className="text-xs lg:text-[11px] text-slate-400 mt-1 lg:mt-0 max-w-3xl">
            Form or join a syndicate, pool chips into the Treasury, complete weekly challenges, manage your crew, and dominate!
          </p>
        </div>
      </div>

      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-5 lg:mb-1">
        <ClanTabBtn active={tab === 'mine'} onClick={() => setTab('mine')} icon={Shield} label="My Clan" />
        <ClanTabBtn active={tab === 'browse'} onClick={() => setTab('browse')} icon={Search} label="Browse Clans" />
        <ClanTabBtn active={tab === 'form'} onClick={() => setTab('form')} icon={Plus} label="Form Syndicate" />
      </div>

      {/* =================== MY CLAN TAB =================== */}
      {tab === 'mine' && (
        <div>
          {!playerClanTag ? (
            <div>
              {/* Pending syndicate invites */}
              {invitesLoading ? (
                <PanelSkeleton count={1} height="h-16" />
              ) : invites.length > 0 ? (
                <div className="max-w-md mx-auto mb-4 p-4 rounded-2xl border border-violet-500/30 bg-violet-500/5 space-y-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-violet-400" /> Syndicate Invites ({invites.length})
                  </h3>
                  {invites.map((inv) => (
                    <div key={inv.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0" aria-hidden>{inv.clanEmblem}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                            {inv.clanName}
                            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 rounded">[{inv.clanTag}]</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Lvl {inv.clanLevel} · {inv.memberCount}/{inv.maxMembers} members · invited by {inv.invitedByName}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => void handleRespondInvite(inv, 'accept')} disabled={actionBusy !== ''} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50">
                          {actionBusy === `invite-${inv.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Accept
                        </button>
                        <button type="button" onClick={() => void handleRespondInvite(inv, 'decline')} disabled={actionBusy !== ''} className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-[11px] font-bold transition disabled:opacity-50">
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="p-8 lg:p-3 rounded-2xl border border-slate-800 bg-slate-950/60 text-center max-w-md mx-auto">
                <Shield className="w-12 h-12 lg:w-5 lg:h-5 text-slate-600 mx-auto mb-3 lg:mb-0.5" />
                <h3 className="text-base lg:text-[11px] font-bold text-white">You are not in a Viper Clan</h3>
                <p className="text-xs lg:text-[11px] text-slate-400 mt-2 lg:mt-0 mb-4 lg:mb-1">Join an existing clan or form your own syndicate — Leader invites will appear here!</p>
                <div className="flex items-center justify-center gap-2">
                  <button type="button" onClick={() => setTab('browse')} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">Browse Clans</button>
                  <button type="button" onClick={() => setTab('form')} className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white text-xs font-bold transition">Form Syndicate</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 lg:space-y-1">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 lg:gap-1 flex-wrap p-4 lg:p-1.5 rounded-2xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-3 lg:gap-1 min-w-0">
                  <span className="text-3xl lg:text-[11px]" aria-hidden>{myClanInfo?.emblem || '\u{1F40D}'}</span>
                  <div className="min-w-0">
                    <h3 className="text-base lg:text-[11px] font-bold text-white flex items-center gap-2 lg:gap-1 flex-wrap">
                      {myClanInfo?.name || playerClanTag}
                      <span className="text-[10px] lg:text-[11px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 lg:px-1.5 py-0.5 rounded">[{playerClanTag}]</span>
                      {player?.clanRank && (
                        <span className={`text-[9px] lg:text-[11px] font-bold px-2 lg:px-1.5 py-0.5 rounded-full border ${RANK_BG[player.clanRank] || RANK_BG.Viper}`}>
                          <Trophy className="w-2.5 h-2.5 lg:w-2.5 lg:h-2.5 inline mr-0.5" /> {player.clanRank}
                        </span>
                      )}
                    </h3>
                    {myClanInfo?.description && <p className="text-[11px] lg:text-[11px] text-slate-400 italic mt-0.5 lg:mt-0">&quot;{myClanInfo.description}&quot;</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 lg:gap-1">
                  {isLeader && (
                    <button type="button" onClick={openSettings} className="px-3 lg:px-1.5 py-2 lg:py-0.5 rounded-lg bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 text-xs lg:text-[11px] font-bold transition flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> Settings
                    </button>
                  )}
                  <button type="button" onClick={() => void handleLeaveClan()} disabled={actionBusy === 'leave'} className="px-3 lg:px-1.5 py-2 lg:py-0.5 rounded-lg bg-slate-950 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs lg:text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-50">
                    {actionBusy === 'leave' ? <Loader2 className="w-3.5 h-3.5 lg:w-3 lg:h-3 animate-spin" /> : <LogOut className="w-3.5 h-3.5 lg:w-3 lg:h-3" />} Leave
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 lg:gap-1 text-[11px]">
                <div className="p-3 lg:p-1.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>YOUR RANK</MicroLabel>
                  <div className="text-white mt-0.5 font-bold">{player?.clanRank || 'Viper'}</div>
                </div>
                <div className="p-3 lg:p-1.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>MEMBERS</MicroLabel>
                  <div className="text-white mt-0.5 font-bold">{myClanInfo?.memberCount || '?'} / {myClanInfo?.maxMembers || 30}</div>
                  {clanStats && clanStats.onlineCount > 0 && (
                    <div className="text-[9px] lg:text-[11px] text-emerald-400 mt-0.5 lg:mt-0 flex items-center gap-1"><Circle className="w-1.5 h-1.5 fill-emerald-400" /> {clanStats.onlineCount} online</div>
                  )}
                </div>
                <div className="p-3 lg:p-1.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>CLAN LEVEL</MicroLabel>
                  <div className="text-amber-400 mt-0.5 font-bold">Lvl {myClanInfo?.level || 1}</div>
                  <div className="mt-1.5 lg:mt-0.5 w-full h-1.5 lg:h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500" style={{ width: `${xpProgress}%` }} />
                  </div>
                  <div className="text-[9px] lg:text-[11px] text-slate-500 mt-0.5 lg:mt-0 font-mono">{myClanInfo?.xp || 0}/{xpNeeded} XP</div>
                </div>
                <div className="p-3 lg:p-1.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>TREASURY</MicroLabel>
                  <div className="text-emerald-400 mt-0.5 font-bold">{(myClanInfo?.bankedChips || 0).toLocaleString()}c</div>
                </div>
                <div className="p-3 lg:p-1.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>TOTAL DEPOSITED</MicroLabel>
                  <div className="text-emerald-400/70 mt-0.5 font-bold">{(myClanInfo?.totalDeposited || 0).toLocaleString()}c</div>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/60 overflow-x-auto">
                {(
                  [
                    { key: 'overview' as const, Icon: Shield, label: 'Overview' },
                    { key: 'challenges' as const, Icon: Swords, label: 'Challenges' },
                    { key: 'wars' as const, Icon: Skull, label: 'Wars' },
                    { key: 'stats' as const, Icon: TrendingUp, label: 'Stats' },
                    { key: 'activity' as const, Icon: ScrollText, label: 'Activity Log' },
                  ]
                ).map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMineSub(key)}
                    className={
                      `px-3 py-1.5 rounded-md text-[11px] font-bold transition border whitespace-nowrap flex items-center gap-1 ${
                        mineSub === key
                          ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                          : 'text-slate-500 hover:text-slate-300 border-transparent'
                      }`
                    }
                  >
                    <Icon className="w-3 h-3" /> {label}
                    {key === 'challenges' && challenges.some((c) => c.progress >= c.target && !c.claimed) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>

              {/* ========= Sub-views ========= */}
              {mineSub === 'overview' && (
                <ClanOverview
                  playerClanTag={playerClanTag}
                  isLeader={isLeader}
                  isCoLeader={isCoLeader}
                  canManage={canManage}
                  myClanInfo={myClanInfo}
                  clanStats={clanStats}
                  xpProgress={xpProgress}
                  xpNeeded={xpNeeded}
                  members={members}
                  membersLoading={membersLoading}
                  chatMessages={chatMessages}
                  chatLoading={chatLoading}
                  challenges={challenges}
                  depositAmount={depositAmount}
                  broadcast={broadcast}
                  quickDeposits={quickDeposits}
                  actionBusy={actionBusy}
                  onDepositAmountChange={setDepositAmount}
                  onBroadcastChange={setBroadcast}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                  onBroadcast={handleBroadcast}
                  onShopPurchase={handleShopPurchase}
                  onPromote={(t, n) => void handleRoleAction(t, 'promote', n)}
                  onDemote={(t, n) => void handleRoleAction(t, 'demote', n)}
                  onKick={handleKickMember}
                  onTransfer={handleTransferLeadership}
                  onPayout={handlePayout}
                  onInspect={inspectMember}
                  onInvite={handleInvitePlayer}
                  onOpenSettings={openSettings}
                  onLeave={handleLeaveClan}
                  onSetMineSub={setMineSub}
                  playerUserTag={player.userTag}
                  playerClanRank={player.clanRank ?? undefined}
                  playerBankedChips={player.bankedChips}
                />
              )}

              {mineSub === 'challenges' && (
                <ClanChallenges
                  challenges={challenges}
                  challengesLoading={challengesLoading}
                  canManage={canManage}
                  actionBusy={actionBusy}
                  onClaim={handleClaimChallenge}
                />
              )}

              {mineSub === 'wars' && (
                <ClanWars
                  playerClanTag={playerClanTag}
                  isLeader={isLeader}
                  clans={clans}
                  activeWar={activeWar}
                  warLoading={warLoading}
                  warSearch={warSearch}
                  warWager={warWager}
                  actionBusy={actionBusy}
                  onWarSearchChange={setWarSearch}
                  onWarWagerChange={setWarWager}
                  onDeclareWar={handleDeclareWar}
                />
              )}

              {mineSub === 'stats' && (
                <ClanStatsView
                  clanStats={clanStats}
                  statsLoading={statsLoading}
                />
              )}

              {mineSub === 'activity' && (
                <ClanActivity
                  activities={activities}
                  activitiesLoading={activitiesLoading}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* =================== BROWSE / FORM TAB =================== */}
      {(tab === 'browse' || tab === 'form') && (
        <ClanBrowse
          tab={tab}
          clans={clans}
          clansLoading={clansLoading}
          filteredClans={filteredClans}
          search={search}
          playerClanTag={playerClanTag}
          actionBusy={actionBusy}
          formState={formState}
          formBusy={formBusy}
          onSearchChange={setSearch}
          onSetTab={setTab}
          onJoinClan={handleJoinClan}
          onFormStateChange={setFormState}
          onFormSubmit={handleFormSubmit}
        />
      )}

      {/* =================== SETTINGS MODAL =================== */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2"><Settings className="w-4 h-4 text-indigo-400" /> Clan Settings</h3>
              <button type="button" onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Syndicate Name</label><input type="text" value={settingsForm.name} onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50" /></div>
              <div><label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Description</label><input type="text" value={settingsForm.description} onChange={(e) => setSettingsForm((f) => ({ ...f, description: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50" /></div>
              <div><label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Emblem</label><select value={settingsForm.emblem} onChange={(e) => setSettingsForm((f) => ({ ...f, emblem: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50">{EMBLEM_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowSettings(false)} className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition">Cancel</button>
              <button type="button" onClick={() => void handleSaveSettings()} disabled={settingsBusy} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50">
                {settingsBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save Changes
              </button>
            </div>
            <div className="pt-3 border-t border-rose-500/20">
              <button type="button" onClick={() => void handleDisbandClan()} disabled={actionBusy === 'disband'} className="w-full px-4 py-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-bold transition flex items-center justify-center gap-2 border border-rose-500/30 hover:border-rose-500/50 disabled:opacity-50">
                {actionBusy === 'disband' ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />} Disband Syndicate
              </button>
              <p className="text-[9px] lg:text-[11px] text-rose-400/60 text-center mt-1.5 font-mono">Permanently deletes the syndicate, all data, and removes all members.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClanTabBtnProps { active: boolean; onClick: () => void; icon: typeof Shield; label: string; }
function ClanTabBtn({ active, onClick, icon: Icon, label }: ClanTabBtnProps) {
  return (
    <button type="button" onClick={onClick} className={`px-3 lg:px-1.5 py-1.5 lg:py-0.5 rounded-lg text-xs lg:text-[11px] font-bold flex items-center gap-1.5 transition border ${active ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}>
      <Icon className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> {label}
    </button>
  );
}

export default ClanSystem;
