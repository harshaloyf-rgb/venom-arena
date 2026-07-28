'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  INITIAL_FRIENDS,
  INITIAL_RIVALS,
  GLOBAL_COMMUNITY_PLAYERS,
  SOCIAL_COUNTRY_FILTER,
  PUBLIC_CLANS,
  PRESET_EMBLEMS,
  BOT_REPLIES,
  countryFlag,
  countryName,
  ARENA_TIERS,
  type MockFriend,
  type MockRival,
  type GlobalPlayer,
} from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Users,
  Shield,
  Swords,
  Globe,
  UserPlus,
  Gift,
  Eye,
  Send,
  X,
  Check,
  Coins,
  MessageSquare,
  Search,
  Plus,
  LogOut,
  Award,
} from 'lucide-react';

interface SocialPanelProps {
  onToast?: ToastFn;
  onSpectateFriend?: (name: string, color: string) => void;
  onJoinArena?: (arenaId: string) => void;
}

type TopTab = 'friends' | 'syndicate';
type FriendsSubTab = 'friends' | 'rivals' | 'search';

const FRIEND_CHIPS: Record<string, number> = {
  ApexViper: 1200,
  ShadowSlinker: 150,
  CoinGobbler: 40,
  VenomKing: 250000,
};

function friendChips(name: string, level: number): number {
  if (FRIEND_CHIPS[name] !== undefined) return FRIEND_CHIPS[name];
  return level * 45;
}

const STATUS_LABELS: Record<MockFriend['status'] | MockRival['status'], string> = {
  online: 'Lobby',
  idle: 'Idle',
  'in-match': 'In-Arena',
  offline: 'Offline',
};

const STATUS_BADGES: Record<MockRival['status'], string> = {
  'in-match': '⚔️ Playing Arena',
  online: '🟢 Online',
  idle: '🟢 Online',
  offline: '⚪ Offline',
};

export function SocialPanel({ onToast, onSpectateFriend, onJoinArena }: SocialPanelProps) {
  const { player, refresh } = useAuth();
  const [topTab, setTopTab] = useState<TopTab>('friends');
  const [friendsSub, setFriendsSub] = useState<FriendsSubTab>('friends');
  const [friends, setFriends] = useState<MockFriend[]>(INITIAL_FRIENDS);
  const [rivals, setRivals] = useState<MockRival[]>(INITIAL_RIVALS);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [joinedClanId, setJoinedClanId] = useState<string | null>(null);
  const [showCreateClan, setShowCreateClan] = useState(false);
  const [clanForm, setClanForm] = useState({ name: '', tag: '', emblem: PRESET_EMBLEMS[0], description: '' });
  const [clanChat, setClanChat] = useState<{ author: string; text: string; ts: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [coOpFriend, setCoOpFriend] = useState<MockFriend | null>(null);

  const filteredGlobalPlayers = useMemo(() => {
    return GLOBAL_COMMUNITY_PLAYERS.filter((p) => {
      if (countryFilter !== 'ALL' && p.country !== countryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.userTag.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, countryFilter]);

  if (!player) return <NotSignedIn />;

  const joinedClan = joinedClanId ? PUBLIC_CLANS.find((c) => c.id === joinedClanId) : null;

  function handleAddFriend() {
    const name = addFriendInput.trim();
    if (!name) {
      notify('Please enter a player tag or name.', 'error', onToast);
      return;
    }
    const tagNum = Math.floor(1000 + Math.random() * 9000);
    const finalTag = name.substring(0, 4).toUpperCase() + '-' + tagNum;
    const newFriend: MockFriend = {
      id: `f-${Date.now()}`,
      name,
      userTag: finalTag,
      status: 'offline',
      level: 5 + Math.floor(Math.random() * 30),
      skinColor: '#22d3ee',
      giftSent: false,
      giftReceived: false,
    };
    setFriends((prev) => [...prev, newFriend]);
    setAddFriendInput('');
    notify(`Friend request sent to ${name} (${finalTag})! 🤝`, 'success', onToast);
  }

  function handleSendGift(f: MockFriend) {
    setFriends((prev) => prev.map((x) => (x.id === f.id ? { ...x, giftSent: true } : x)));
    notify(`Sent 25 Daily Chips Gift to ${f.name}! 🎁`, 'success', onToast);
  }

  function handleClaimGift(f: MockFriend) {
    setFriends((prev) => prev.map((x) => (x.id === f.id ? { ...x, giftReceived: false } : x)));
    notify(`Claimed 25 chips gift from ${f.name}! 🪙`, 'success', onToast);
    void refresh();
  }

  function handleSpectate(f: MockFriend) {
    if (f.status !== 'in-match') return;
    if (onSpectateFriend) onSpectateFriend(f.name, f.skinColor);
    else notify(`Joining spectating server for ${f.name}... 👁️`, 'info', onToast);
  }

  function handleInviteFriend(f: MockFriend) {
    if (f.status === 'offline') return;
    setCoOpFriend(f);
  }

  function handleRemoveFriend(f: MockFriend) {
    setFriends((prev) => prev.filter((x) => x.id !== f.id));
    notify(`Removed ${f.name} from friends list.`, 'info', onToast);
  }

  function handleHuntRival(r: MockRival) {
    notify(`⚔️ HUNT INITIATED: Entering ${r.currentArenaName} to take down ${r.name}!`, 'info', onToast);
    if (onJoinArena) onJoinArena('tier-2');
  }

  function handleConvertRival(r: MockRival) {
    setFriends((prev) => [...prev, {
      id: `f-${Date.now()}`,
      name: r.name,
      userTag: r.userTag,
      status: r.status,
      currentArenaName: r.currentArenaName,
      level: r.level,
      skinColor: '#22d3ee',
      giftSent: false,
      giftReceived: false,
    }]);
    setRivals((prev) => prev.filter((x) => x.id !== r.id));
    notify(`${r.name} converted from rival to friend!`, 'success', onToast);
  }

  function handleRemoveRival(r: MockRival) {
    setRivals((prev) => prev.filter((x) => x.id !== r.id));
    notify(`Removed ${r.name} from rivals list.`, 'info', onToast);
  }

  function handleJoinClan(clanId: string) {
    const clan = PUBLIC_CLANS.find((c) => c.id === clanId);
    if (!clan) return;
    if (joinedClanId) {
      notify('You are already in a clan! Leave your current clan first.', 'error', onToast);
      return;
    }
    setJoinedClanId(clanId);
    setClanChat([
      { author: clan.members[0]?.name || 'Leader', text: BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)], ts: 'just now' },
    ]);
    notify(`Welcome to ${clan.name} [${clan.tag}]! 🛡️`, 'success', onToast);
  }

  function handleLeaveClan() {
    if (!joinedClan) return;
    notify(`Left ${joinedClan.name} [${joinedClan.tag}].`, 'info', onToast);
    setJoinedClanId(null);
    setClanChat([]);
  }

  function handleCreateClan() {
    if (clanForm.name.length < 4) {
      notify('Syndicate Name must be at least 4 characters.', 'error', onToast);
      return;
    }
    if (clanForm.tag.length < 3 || clanForm.tag.length > 4) {
      notify('Clan Tag must be 3-4 characters.', 'error', onToast);
      return;
    }
    if (player.bankedChips < 500) {
      notify('You need at least 500 chips to register a Syndicate.', 'error', onToast);
      return;
    }
    notify(`Syndicate "${clanForm.name}" [${clanForm.tag.toUpperCase()}] established!`, 'success', onToast);
    setShowCreateClan(false);
    setClanForm({ name: '', tag: '', emblem: PRESET_EMBLEMS[0], description: '' });
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
    notify(`Deposited ${amt}c to syndicate vault (+${Math.floor(amt * 0.1)} Clan XP)!`, 'success', onToast);
    setDepositAmount('');
    void refresh();
  }

  function handleSendChat() {
    if (!chatInput.trim() || !joinedClan) return;
    const msg = { author: player.name, text: chatInput.trim(), ts: 'just now' };
    setClanChat((prev) => [...prev, msg]);
    setChatInput('');
    // Bot reply
    setTimeout(() => {
      const botMsg = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
      const botAuthor = joinedClan.members[Math.floor(Math.random() * joinedClan.members.length)]?.name || 'Member';
      setClanChat((prev) => [...prev, { author: botAuthor, text: botMsg, ts: 'just now' }]);
    }, 1500);
  }

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-violet-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* TOP TABS */}
      <div className="relative flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-5">
        <button
          type="button"
          onClick={() => setTopTab('friends')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${topTab === 'friends' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
        >
          <Users className="w-3.5 h-3.5" /> Friends &amp; Global Search ({friends.length})
        </button>
        <button
          type="button"
          onClick={() => setTopTab('syndicate')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${topTab === 'syndicate' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
        >
          <Shield className="w-3.5 h-3.5" /> Competitive Syndicate {joinedClan ? `[${joinedClan.tag}]` : ''}
        </button>
      </div>

      {/* FRIENDS TAB */}
      {topTab === 'friends' && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60">
            <SubTabBtn active={friendsSub === 'friends'} onClick={() => setFriendsSub('friends')} icon={Users} label={`My Friends (${friends.length})`} />
            <SubTabBtn active={friendsSub === 'rivals'} onClick={() => setFriendsSub('rivals')} icon={Swords} label={`My Rivals (${rivals.length})`} />
            <SubTabBtn active={friendsSub === 'search'} onClick={() => setFriendsSub('search')} icon={Globe} label="Search Global Players" />
          </div>

          {/* Add friend bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={addFriendInput}
              onChange={(e) => setAddFriendInput(e.target.value)}
              placeholder="Enter Player Tag or Name (e.g. Cobra-4231)..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
            />
            <button
              type="button"
              onClick={handleAddFriend}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Friend
            </button>
          </div>

          {/* My Friends */}
          {friendsSub === 'friends' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {friends.length === 0 ? (
                <div className="md:col-span-2 p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">Your Friends List is Empty</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Use &quot;Search Global Players&quot; above or enter rival tags to connect,
                    gift daily free chips, and play!
                  </p>
                </div>
              ) : (
                friends.map((f) => (
                  <FriendCard
                    key={f.id}
                    f={f}
                    onSendGift={() => handleSendGift(f)}
                    onClaimGift={() => handleClaimGift(f)}
                    onSpectate={() => handleSpectate(f)}
                    onInvite={() => handleInviteFriend(f)}
                    onRemove={() => handleRemoveFriend(f)}
                  />
                ))
              )}
            </div>
          )}

          {/* My Rivals */}
          {friendsSub === 'rivals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">RIVALRY &amp; REVENGE TRACKER</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    Players who eliminated you or collided with you in arena matches.
                    Track their online status and join their exact arena to seek revenge!
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-rose-500/10 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-full">
                  {rivals.length} Active Rivals
                </span>
              </div>
              {rivals.length === 0 ? (
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
                  <Swords className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">No Rivals in Your List</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    When you get eliminated or collide with players in matches,
                    click &quot;ADD RIVAL&quot; on the game-over screen to track them here!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rivals.map((r) => (
                    <RivalCard
                      key={r.id}
                      r={r}
                      onHunt={() => handleHuntRival(r)}
                      onConvert={() => handleConvertRival(r)}
                      onRemove={() => handleRemoveRival(r)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Global Search */}
          {friendsSub === 'search' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search players globally by Name or Tag (e.g. Cobra, #IND-8821)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500/50"
                >
                  {SOCIAL_COUNTRY_FILTER.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/80 overflow-hidden">
                <ol className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll">
                  {filteredGlobalPlayers.length === 0 ? (
                    <li className="p-6 text-center text-xs text-slate-500">No players match your search.</li>
                  ) : (
                    filteredGlobalPlayers.map((p) => {
                      const connected = friends.some((f) => f.userTag === p.userTag);
                      return (
                        <li key={p.userTag} className="px-4 py-3 text-sm flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: `${p.skinColor}20`, border: `1px solid ${p.skinColor}40` }} aria-hidden>
                              {countryFlag(p.country)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white truncate flex items-center gap-1.5">
                                {p.name}
                                <span className="text-[10px] font-mono text-slate-500">#{p.userTag}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                🪙 {(p.chips / 1000).toFixed(0)}k · Lvl {p.level} · {STATUS_LABELS[p.status]}
                              </div>
                            </div>
                          </div>
                          {connected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-full">
                              <Check className="w-3 h-3" /> Connected
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setFriends((prev) => [...prev, {
                                  id: `f-${Date.now()}`,
                                  name: p.name,
                                  userTag: p.userTag,
                                  status: p.status,
                                  level: p.level,
                                  skinColor: p.skinColor,
                                  giftSent: false,
                                  giftReceived: false,
                                }]);
                                notify(`Connected with ${p.name}! 🤝`, 'success', onToast);
                              }}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600 hover:text-white transition flex items-center gap-1"
                            >
                              <UserPlus className="w-3 h-3" /> Connect
                            </button>
                          )}
                        </li>
                      );
                    })
                  )}
                  {/* Custom tag not in presets */}
                  {search.trim() && filteredGlobalPlayers.length === 0 && (
                    <li className="p-4 text-center text-xs text-slate-400">
                      <p className="font-bold text-white">Custom Player Tag: &quot;{search}&quot;</p>
                      <p className="mt-1">Found on Global Server. Connect &amp; send invite request.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFriends((prev) => [...prev, {
                            id: `f-${Date.now()}`,
                            name: search.trim(),
                            userTag: search.trim().toUpperCase(),
                            status: 'offline',
                            level: 1,
                            skinColor: '#22d3ee',
                            giftSent: false,
                            giftReceived: false,
                          }]);
                          notify(`Connected with ${search}! 🤝`, 'success', onToast);
                        }}
                        className="mt-3 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-violet-600 hover:bg-violet-500 text-white transition inline-flex items-center gap-1"
                      >
                        <UserPlus className="w-3 h-3" /> Connect
                      </button>
                    </li>
                  )}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SYNDICATE TAB */}
      {topTab === 'syndicate' && (
        <div className="space-y-4">
          {!joinedClan ? (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-violet-400" /> Choose Your Combat Syndicate
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    Syndicates are competitive teams of Venom Arena players. Work cooperatively,
                    pool chip assets to unlock level-based buffs, compete on Clan Leaderboards,
                    and chat in private feeds!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateClan(true)}
                  className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Register Syndicate (500c)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search public Syndicates..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PUBLIC_CLANS.map((clan) => (
                  <div key={clan.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl" aria-hidden>{clan.emblem}</span>
                        <div>
                          <h4 className="text-sm font-bold text-white">{clan.name}</h4>
                          <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded">[{clan.tag}]</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">Lvl {clan.level}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 italic mb-3">&quot;{clan.description}&quot;</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                        <MicroLabel>Members</MicroLabel>
                        <div className="text-white text-xs mt-0.5">{clan.members.length}</div>
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                        <MicroLabel>Clan Bank</MicroLabel>
                        <div className="text-emerald-400 text-xs mt-0.5">{clan.bankedChips.toLocaleString()}c</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleJoinClan(clan.id)}
                      className="mt-3 w-full py-2 rounded-lg bg-slate-900 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 text-xs font-bold transition"
                    >
                      Join Syndicate
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>{joinedClan.emblem}</span>
                    {joinedClan.name}
                    <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded">[{joinedClan.tag}]</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Level {joinedClan.level} · {joinedClan.members.length} Members</p>
                </div>
                <button
                  type="button"
                  onClick={handleLeaveClan}
                  className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Leave Syndicate
                </button>
              </div>

              {/* Level bar */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                    <Award className="w-3.5 h-3.5" /> Syndicate level {joinedClan.level}
                  </span>
                  <span className="font-mono text-slate-400 text-[10px]">{joinedClan.level * 800} / {joinedClan.level * 1000} XP</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-amber-500 rounded-full" style={{ width: `${(joinedClan.level * 800 / (joinedClan.level * 1000)) * 100}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Vault + members */}
                <div className="lg:col-span-1 space-y-3">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-bold text-white">Co-Op Syndicate Vault</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                      Deposit excess banked chips to grow the vault balance. Deposits earn 10% value
                      in Clan XP! Current Vault: <span className="font-mono font-bold text-emerald-400">{player.bankedChips.toLocaleString()} c</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Amt (e.g. 100)"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50"
                      />
                      <button
                        type="button"
                        onClick={handleDeposit}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1"
                      >
                        <Coins className="w-3 h-3" /> Deposit
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                    <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-violet-400" /> Active Members ({joinedClan.members.length}/30)
                    </h4>
                    <div className="text-[10px] text-slate-500 mb-2">Leader: 👑 {joinedClan.members.find((m) => m.role === 'Leader')?.name || 'None'}</div>
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto va-scroll">
                      {joinedClan.members.map((m) => (
                        <li key={m.name} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-900/60">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{m.name}</span>
                            <span className="text-[9px] font-mono text-slate-500">{m.role}</span>
                          </div>
                          <span className="font-mono text-amber-400">Lvl {m.level}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Chat */}
                <div className="lg:col-span-2 flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-violet-400" /> Syndicate HQ Feed
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Active conversation channel</span>
                  </div>
                  <div className="flex-1 overflow-y-auto va-scroll p-3 space-y-2 max-h-[300px] min-h-[200px]">
                    {clanChat.length === 0 ? (
                      <div className="text-center text-xs text-slate-500 py-8">No messages yet. Say hi to your syndicate!</div>
                    ) : (
                      clanChat.map((m, i) => (
                        <div key={i} className={`flex flex-col ${m.author === player.name ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] font-mono text-slate-500">{m.author} · {m.ts}</span>
                          <div className={`px-3 py-1.5 rounded-xl text-xs ${m.author === player.name ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-200 border border-slate-800'}`}>
                            {m.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-slate-800 flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                      placeholder="Type message to Syndicate..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleSendChat}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" /> Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CREATE CLAN MODAL */}
          {showCreateClan && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-black text-white">Syndicate Charter Registration</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateClan(false)}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Syndicate Name</label>
                    <input
                      type="text"
                      value={clanForm.name}
                      onChange={(e) => setClanForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Poison Fangs"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Clan Tag (3-4 Chars)</label>
                    <input
                      type="text"
                      value={clanForm.tag}
                      onChange={(e) => setClanForm((f) => ({ ...f, tag: e.target.value.toUpperCase() }))}
                      placeholder="e.g. FANG"
                      maxLength={4}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Select Emblem Symbol</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_EMBLEMS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setClanForm((f) => ({ ...f, emblem: em }))}
                          className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition ${clanForm.emblem === em ? 'bg-violet-500/20 border-violet-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">Description / Manifesto</label>
                    <textarea
                      value={clanForm.description}
                      onChange={(e) => setClanForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Write your squad's focus, rules or motto..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400">Cost: <span className="text-emerald-400 font-bold">500 c</span></span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateClan(false)}
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateClan}
                        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Establish Charter
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CO-OP INVITE MODAL */}
      {coOpFriend && (
        <CoOpInviteModal
          friend={coOpFriend}
          playerChips={player.bankedChips}
          onClose={() => setCoOpFriend(null)}
          onSend={(tierId) => {
            notify(`Co-Op invite sent to ${coOpFriend.name} for ${ARENA_TIERS.find((t) => t.id === tierId)?.name || 'arena'}! 🤝`, 'success', onToast);
            setCoOpFriend(null);
          }}
        />
      )}
    </div>
  );
}

interface SubTabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
}

function SubTabBtn({ active, onClick, icon: Icon, label }: SubTabBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${active ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

interface FriendCardProps {
  f: MockFriend;
  onSendGift: () => void;
  onClaimGift: () => void;
  onSpectate: () => void;
  onInvite: () => void;
  onRemove: () => void;
}

function FriendCard({ f, onSendGift, onClaimGift, onSpectate, onInvite, onRemove }: FriendCardProps) {
  return (
    <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: `${f.skinColor}20`, border: `1px solid ${f.skinColor}40` }} aria-hidden>
            🐍
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white truncate">{f.name}</div>
            <div className="text-[10px] font-mono text-slate-500 truncate">#{f.userTag}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
          title="Remove Friend"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className={`inline-flex items-center gap-1 ${f.status === 'online' ? 'text-emerald-400' : f.status === 'in-match' ? 'text-rose-400' : f.status === 'idle' ? 'text-amber-400' : 'text-slate-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${f.status === 'online' ? 'bg-emerald-400' : f.status === 'in-match' ? 'bg-rose-400' : f.status === 'idle' ? 'bg-amber-400' : 'bg-slate-600'}`} />
          {STATUS_LABELS[f.status]}
        </span>
        <span className="text-amber-400">Lvl {f.level}</span>
      </div>

      {f.currentArenaName && (
        <div className="text-[10px] text-slate-400 truncate">
          📍 {f.currentArenaName}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {f.giftReceived ? (
          <button
            type="button"
            onClick={onClaimGift}
            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1"
          >
            <Gift className="w-3 h-3" /> Claim +25c
          </button>
        ) : (
          <span className="px-2 py-1 rounded-lg text-[10px] text-slate-500 bg-slate-900 border border-slate-800">No pending gift</span>
        )}
        {f.status === 'in-match' && (
          <button
            type="button"
            onClick={onSpectate}
            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600 hover:text-white transition flex items-center gap-1"
          >
            <Eye className="w-3 h-3" /> Spectate
          </button>
        )}
        <button
          type="button"
          onClick={onInvite}
          disabled={f.status === 'offline'}
          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600 hover:text-white transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Swords className="w-3 h-3" /> Invite
        </button>
        <button
          type="button"
          onClick={onSendGift}
          disabled={f.giftSent}
          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${f.giftSent ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed' : 'bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600 hover:text-white'}`}
        >
          <Send className="w-3 h-3" /> {f.giftSent ? 'Sent Today' : 'Send Gift'}
        </button>
      </div>
    </div>
  );
}

interface RivalCardProps {
  r: MockRival;
  onHunt: () => void;
  onConvert: () => void;
  onRemove: () => void;
}

function RivalCard({ r, onHunt, onConvert, onRemove }: RivalCardProps) {
  return (
    <div className="p-4 rounded-2xl border border-rose-500/30 bg-slate-950/70 shadow-md flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0 bg-rose-500/10 border border-rose-500/30" aria-hidden>
            ⚔️
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white truncate">{r.name}</div>
            <div className="text-[10px] font-mono text-slate-500 truncate">#{r.userTag} · Lvl {r.level}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onConvert}
            className="p-1 rounded text-slate-500 hover:text-emerald-400 transition"
            title="Convert to Friend"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
            title="Remove Rival"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className={`inline-flex items-center gap-1 ${r.status === 'in-match' ? 'text-rose-400' : r.status === 'online' ? 'text-emerald-400' : 'text-slate-500'}`}>
          {STATUS_BADGES[r.status]}
        </span>
        <span className="text-slate-500">🕒 {r.lastEncounterDate}</span>
      </div>

      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]">
        <MicroLabel>Head-To-Head Record:</MicroLabel>
        <div className="flex items-center gap-3 mt-0.5 font-mono">
          <span className="text-emerald-400">You: {r.timesKilledByYou}</span>
          <span className="text-slate-500">-</span>
          <span className="text-rose-400">Rival: {r.timesKilledYou}</span>
        </div>
      </div>

      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]">
        <MicroLabel>CURRENT ARENA TABLE:</MicroLabel>
        <div className="text-amber-300 mt-0.5 truncate">{r.currentArenaName}</div>
      </div>

      <button
        type="button"
        onClick={onHunt}
        className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
      >
        <Swords className="w-3.5 h-3.5" /> HUNT / JOIN ARENA
      </button>
    </div>
  );
}

interface CoOpInviteModalProps {
  friend: MockFriend;
  playerChips: number;
  onClose: () => void;
  onSend: (tierId: string) => void;
}

function CoOpInviteModal({ friend, playerChips, onClose, onSend }: CoOpInviteModalProps) {
  const [selectedTier, setSelectedTier] = useState(ARENA_TIERS[0].id);
  const friendChipsAmt = friendChips(friend.name, friend.level);
  const tier = ARENA_TIERS.find((t) => t.id === selectedTier) || ARENA_TIERS[0];
  const youCanAfford = playerChips >= tier.buyIn;
  const friendCanAfford = friendChipsAmt >= tier.buyIn;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-black text-white">Co-Op Lobby Invite</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Assemble a squad with your allies</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
            <MicroLabel>Your Balance</MicroLabel>
            <div className="text-emerald-400 font-mono font-bold mt-1">{playerChips.toLocaleString()}c</div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
            <MicroLabel>{friend.name}</MicroLabel>
            <div className="text-emerald-400 font-mono font-bold mt-1">{friendChipsAmt.toLocaleString()}c</div>
          </div>
        </div>

        <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-2">Select Arena Stakes</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto va-scroll mb-3">
          {ARENA_TIERS.map((t) => {
            const sel = selectedTier === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTier(t.id)}
                className={`p-2.5 rounded-xl border text-left transition ${sel ? 'bg-violet-500/20 border-violet-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
              >
                <div className="text-xs font-bold text-white">{t.name}</div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">Buy-In: {t.buyIn} c</div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          {!youCanAfford && (
            <span className="text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-full">You can&apos;t afford</span>
          )}
          {!friendCanAfford && (
            <span className="text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-full">They can&apos;t afford</span>
          )}
          {youCanAfford && friendCanAfford && (
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-full">Eligible 🤝</span>
          )}
        </div>

        {!youCanAfford && (
          <div className="mb-3 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
            Sorry! I don&apos;t have enough chips for {tier.name} (need {tier.buyIn} c, only have {playerChips} c).
            Let&apos;s join the &quot;{ARENA_TIERS[0].name}&quot; (Buy-In: {ARENA_TIERS[0].buyIn} c) instead! Re-invite me?
            <button
              type="button"
              onClick={() => setSelectedTier(ARENA_TIERS[0].id)}
              className="ml-2 px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold"
            >
              🤝 Accept Proposal &amp; Invite
            </button>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSend(selectedTier)}
            disabled={!youCanAfford || !friendCanAfford}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send Co-Op Invite
          </button>
        </div>
      </div>
    </div>
  );
}

export default SocialPanel;
