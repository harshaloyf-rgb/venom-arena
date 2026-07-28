'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  SAMPLE_CLANS,
  countryFlag,
  type SampleClan,
  type SampleClanMember,
  type InspectedPlayer,
} from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
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
} from 'lucide-react';

interface ClanSystemProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type Tab = 'mine' | 'browse' | 'form';

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
  const [joinedClanId, setJoinedClanId] = useState<string | null>(
    player?.clanTag ? 'clan-1' : null,
  );
  const [search, setSearch] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [broadcast, setBroadcast] = useState('');
  const [formState, setFormState] = useState({
    name: '',
    tag: '',
    motto: '',
    emblem: EMBLEM_OPTIONS[0].value,
    minLevelReq: 1,
  });

  const filteredClans = useMemo(() => {
    if (!search.trim()) return SAMPLE_CLANS;
    const q = search.toLowerCase();
    return SAMPLE_CLANS.filter((c) => c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q));
  }, [search]);

  if (!player) return <NotSignedIn />;

  const joinedClan = joinedClanId ? SAMPLE_CLANS.find((c) => c.id === joinedClanId) : null;

  function handleJoinClan(clan: SampleClan) {
    if (joinedClanId) {
      notify('You are already in a clan! Leave your current clan first.', 'error', onToast);
      return;
    }
    if (player.level < clan.minLevelReq) {
      notify(`Level ${clan.minLevelReq} required to join ${clan.name}!`, 'error', onToast);
      return;
    }
    setJoinedClanId(clan.id);
    notify(`Welcome to ${clan.name} [${clan.tag}]! 🛡️`, 'success', onToast);
  }

  function handleLeaveClan() {
    if (!joinedClan) return;
    notify(`Left ${joinedClan.name} [${joinedClan.tag}].`, 'info', onToast);
    setJoinedClanId(null);
  }

  function handleDeposit() {
    const amt = parseInt(depositAmount, 10);
    if (!amt || amt <= 0) {
      notify('Enter a valid deposit amount.', 'error', onToast);
      return;
    }
    if (amt > player.bankedChips) {
      notify('Insufficient chips to deposit.', 'error', onToast);
      return;
    }
    notify(`Deposited ${amt}c to clan treasury! (+${Math.floor(amt * 0.1)} Clan XP)`, 'success', onToast);
    setDepositAmount('');
    void refresh();
  }

  function handleBroadcast() {
    if (!broadcast.trim()) return;
    notify('Broadcast announcement posted to all members! 📢', 'success', onToast);
    setBroadcast('');
  }

  function handleFormSubmit() {
    if (!formState.name.trim() || !formState.tag.trim()) {
      notify('Syndicate Name and Clan Tag are required.', 'error', onToast);
      return;
    }
    if (player.bankedChips < 50_000) {
      notify('50,000 Banked Chips required to form a new Syndicate Clan!', 'error', onToast);
      return;
    }
    notify(`Syndicate "${formState.name}" [${formState.tag.toUpperCase()}] formed! Treasury initialized.`, 'success', onToast);
    setFormState({ name: '', tag: '', motto: '', emblem: EMBLEM_OPTIONS[0].value, minLevelReq: 1 });
    setTab('mine');
  }

  function inspectMember(m: SampleClanMember) {
    if (!onInspectPlayer) return;
    onInspectPlayer({
      name: m.name,
      userTag: m.userTag,
      country: m.country,
      flag: countryFlag(m.country),
      bankedChips: m.chips,
      level: m.level,
      clanTag: joinedClan?.tag,
      clanName: joinedClan?.name,
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
          {!joinedClan ? (
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
                  <span className="text-3xl" aria-hidden>{joinedClan.logoEmoji}</span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                      {joinedClan.name}
                      <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded">[{joinedClan.tag}]</span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        <Trophy className="w-2.5 h-2.5" /> Clan Rank #{joinedClan.clanRank}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 italic mt-0.5">&quot;{joinedClan.motto}&quot;</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLeaveClan}
                  className="px-3 py-2 rounded-lg bg-slate-950 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5"
                >
                  Leave Syndicate
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>LEADER</MicroLabel>
                  <div className="text-white mt-0.5">{joinedClan.leaderName} ({joinedClan.leaderTag})</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>MEMBERS</MicroLabel>
                  <div className="text-white mt-0.5">{joinedClan.members.length}/{joinedClan.maxMembers}</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <MicroLabel>CLAN LEVEL</MicroLabel>
                  <div className="text-white mt-0.5">Lvl {joinedClan.level}</div>
                </div>
              </div>

              {/* Treasury */}
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" /> Clan Treasury Bank
                  </h4>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    {joinedClan.treasuryChips.toLocaleString()} c
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
                    onClick={handleDeposit}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Coins className="w-3.5 h-3.5" /> Deposit
                  </button>
                </div>
              </div>

              {/* Perks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { title: 'Self-Sponsored Arenas', desc: 'Host custom clan tournaments funded by Treasury' },
                  { title: 'Clan Tag Emblem', desc: `Displays [${joinedClan.tag}] badge in match leaderboards` },
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
                    <Users className="w-4 h-4 text-indigo-400" /> Member Roster ({joinedClan.members.length})
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">Max Capacity: {joinedClan.maxMembers}</span>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
                  <ol className="divide-y divide-slate-900">
                    {joinedClan.members.map((m) => (
                      <li key={m.userTag} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-base shrink-0" aria-hidden>
                            {countryFlag(m.country)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate flex items-center gap-1.5 flex-wrap">
                              {m.name}
                              <span className="text-[9px] font-mono text-slate-500">{m.userTag}</span>
                              {m.role === 'Leader' && (
                                <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">LEADER</span>
                              )}
                              {m.role === 'Officer' && (
                                <span className="text-[9px] font-bold text-violet-300 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.5 rounded">OFFICER</span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              Joined: {m.joinedDate} • Level {m.level}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-bold text-emerald-400">{m.chips.toLocaleString()}c</span>
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
                </div>
              </div>

              {/* Broadcast Feed */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" /> Syndicate Broadcast Feed
                  </h4>
                </div>
                <div className="p-4 space-y-2 max-h-[200px] overflow-y-auto va-scroll">
                  {joinedClan.announcements.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-4">No announcements yet.</div>
                  ) : (
                    joinedClan.announcements.map((a, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <div className="text-[10px] font-mono text-slate-500 mb-0.5">{a.author} · 🕒 {a.dateStr}</div>
                        <div className="text-xs text-slate-200">{a.text}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={broadcast}
                    onChange={(e) => setBroadcast(e.target.value)}
                    placeholder="Publish broadcast announcement to all members..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleBroadcast}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Post Announcement
                  </button>
                </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClans.map((clan) => {
              const isJoined = joinedClanId === clan.id;
              const levelLocked = player.level < clan.minLevelReq;
              return (
                <div key={clan.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-3xl" aria-hidden>{clan.logoEmoji}</span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{clan.name}</h4>
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 rounded">[{clan.tag}]</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">&quot;{clan.motto}&quot;</p>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                    <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-center">
                      <MicroLabel>LEVEL</MicroLabel>
                      <div className="text-amber-400 mt-0.5">{clan.level}</div>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-center">
                      <MicroLabel>MEMBERS</MicroLabel>
                      <div className="text-white mt-0.5">{clan.members.length}/{clan.maxMembers}</div>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded border border-slate-800 text-center">
                      <MicroLabel>TREASURY</MicroLabel>
                      <div className="text-emerald-400 mt-0.5">{clan.treasuryChips >= 1_000_000 ? `${(clan.treasuryChips / 1_000_000).toFixed(1)}M` : `${clan.treasuryChips.toLocaleString()}`}</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    Leader: <span className="text-white">{clan.leaderName}</span> ({clan.leaderTag})
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJoinClan(clan)}
                    disabled={isJoined || !!joinedClanId || levelLocked}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition ${isJoined ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-default' : levelLocked ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                  >
                    {isJoined ? 'Already a Member' : `Join Syndicate (Req Lvl ${clan.minLevelReq})`}
                  </button>
                </div>
              );
            })}
          </div>
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
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Clan Tag (3-4 Chars)</label>
              <input
                type="text"
                value={formState.tag}
                onChange={(e) => setFormState((f) => ({ ...f, tag: e.target.value.toUpperCase() }))}
                placeholder="e.g. OMG"
                maxLength={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Syndicate Motto</label>
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
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Minimum Level Req.</label>
              <input
                type="number"
                value={formState.minLevelReq}
                onChange={(e) => setFormState((f) => ({ ...f, minLevelReq: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                min={1}
                max={50}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="text-[11px] font-mono">
                <div className="text-slate-400">Formation Fee: <span className="text-amber-300 font-bold">50,000 Banked Chips</span></div>
                <div className="text-slate-500">Balance: <span className="text-emerald-400">{player.bankedChips.toLocaleString()} c</span></div>
              </div>
              <button
                type="button"
                onClick={handleFormSubmit}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" /> Form Syndicate &amp; Initialize Treasury
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
