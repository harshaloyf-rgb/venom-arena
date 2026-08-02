'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { countryFlag, type InspectedPlayer } from '@/lib/game-config';
import { timeAgo } from '@/lib/date-utils';
import {
  GlowBlob,
  NotSignedIn,
  PanelSkeleton,
  notify,
  type ToastFn,
} from './_panel-primitives';
import {
  Users, Globe, UserPlus, Gift, Send, X, Check, Search, Loader2,
  Ban, ArrowUpDown, Clock, Activity, ExternalLink, Unlock,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SocialPanelProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type SubTab = 'friends' | 'search' | 'gifts';

interface FriendItem {
  id: string;
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips: number;
  online: boolean;
  skinColor: string;
  clanTag: string | null;
}

interface PendingRequestItem {
  id: string;
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips: number;
  online: boolean;
  skinColor: string;
}

interface SearchPlayer {
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips: number;
  clanTag: string | null;
  online: boolean;
  avatar: string | null;
  relation: 'none' | 'friend' | 'pending_sent' | 'pending_received';
}

interface BlockedPlayerItem {
  id: string;
  userTag: string;
  name: string;
  country: string;
  level: number;
  skinColor: string;
}

interface GiftEntry {
  id: string;
  amount: number;
  createdAt: string;
  direction: 'sent' | 'received';
  player: { name: string; userTag: string };
}

interface CountryOption {
  code: string;
  name: string;
  count: number;
}

interface RecentMatch {
  arenaName: string;
  status: string;
  chipsEarned: number;
  chipsLost: number;
  kills: number;
  snakeLength: number;
  durationSec: number;
  createdAt: string;
  isOnline: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function deriveSkinColor(tag: string): string {
  const palette = ['#10b981', '#a855f7', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#8b5cf6'];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}



/* ------------------------------------------------------------------ */
/*  Sub-tab button                                                     */
/* ------------------------------------------------------------------ */

function SubTabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Users; label: string }) {
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

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function SocialPanel({ onToast, onInspectPlayer }: SocialPanelProps) {
  const { player, refresh } = useAuth();
  const [sub, setSub] = useState<SubTab>('friends');

  /* ---- Friends state ---- */
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingRequestItem[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingRequestItem[]>([]);
  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayerItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [giftCooldowns, setGiftCooldowns] = useState<Set<string>>(new Set());

  /* ---- Search state ---- */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCountry, setSearchCountry] = useState('ALL');
  const [searchResults, setSearchResults] = useState<SearchPlayer[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  /* ---- Gift history state ---- */
  const [giftHistory, setGiftHistory] = useState<GiftEntry[]>([]);
  const [giftHistoryLoading, setGiftHistoryLoading] = useState(false);
  const [giftHistoryFilter, setGiftHistoryFilter] = useState<'all' | 'sent' | 'received'>('all');

  /* ---- Recent matches state ---- */
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);

  /* ================================================================ */
  /*  Data fetchers                                                     */
  /* ================================================================ */

  const fetchFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const res = await fetch('/api/friends/list');
      if (!res.ok) return;
      const data = await res.json();
      setFriends((data.friends ?? []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        userTag: f.userTag as string,
        name: f.name as string,
        country: (f.country as string) || '',
        level: f.level as number,
        bankedChips: (f.bankedChips as number) ?? 0,
        online: f.online as boolean,
        skinColor: deriveSkinColor(f.userTag as string),
        clanTag: (f.clanTag as string) || null,
      })));
      setPendingReceived((data.pendingReceived ?? []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        userTag: f.userTag as string,
        name: f.name as string,
        country: (f.country as string) || '',
        level: f.level as number,
        bankedChips: (f.bankedChips as number) ?? 0,
        online: f.online as boolean,
        skinColor: deriveSkinColor(f.userTag as string),
      })));
      setPendingSent((data.pendingSent ?? []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        userTag: f.userTag as string,
        name: f.name as string,
        country: (f.country as string) || '',
        level: f.level as number,
        bankedChips: (f.bankedChips as number) ?? 0,
        online: f.online as boolean,
        skinColor: deriveSkinColor(f.userTag as string),
      })));
      setBlockedPlayers((data.blocked ?? []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        userTag: f.userTag as string,
        name: f.name as string,
        country: (f.country as string) || '',
        level: f.level as number,
        skinColor: deriveSkinColor(f.userTag as string),
      })));
    } catch {
      /* silent */
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch('/api/players/countries');
      if (!res.ok) return;
      const data = await res.json();
      setCountries(data.countries ?? []);
    } catch {
      /* silent */
    }
  }, []);

  const fetchSearch = useCallback(async (query: string, country: string, offset: number, append = false) => {
    if (!query.trim() && country === 'ALL') {
      setSearchResults([]);
      setSearchTotal(0);
      setSearchOffset(0);
      return;
    }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({ query, country, limit: '20' });
      if (offset > 0) params.set('offset', String(offset));
      const res = await fetch(`/api/players/search?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.players ?? []) as SearchPlayer[];
      setSearchResults((prev) => append ? [...prev, ...items] : items);
      setSearchTotal(data.total ?? items.length);
      setSearchOffset(offset + items.length);
    } catch {
      /* silent */
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const fetchGiftHistory = useCallback(async (type: 'all' | 'sent' | 'received') => {
    setGiftHistoryLoading(true);
    try {
      const res = await fetch(`/api/friends/history?type=${type}&limit=30`);
      if (!res.ok) return;
      const data = await res.json();
      setGiftHistory(data.entries ?? []);
    } catch {
      /* silent */
    } finally {
      setGiftHistoryLoading(false);
    }
  }, []);

  const fetchRecentMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/players/recent?limit=5');
      if (res.ok) { const data = await res.json(); setRecentMatches(data.matches ?? []); }
    } catch { /* ignore */ }
  }, []);

  /* ---- Effects ---- */

  useEffect(() => { fetchFriends(); fetchRecentMatches(); }, [fetchFriends, fetchRecentMatches]);

  useEffect(() => { if (sub === 'search') fetchCountries(); }, [sub, fetchCountries]);

  useEffect(() => {
    if (sub !== 'gifts') return;
    fetchGiftHistory(giftHistoryFilter);
  }, [sub, giftHistoryFilter, fetchGiftHistory]);

  /* ---- Debounced search ---- */
  useEffect(() => {
    if (sub !== 'search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSearch(searchQuery, searchCountry, 0);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, searchCountry, sub, fetchSearch]);

  if (!player) return <NotSignedIn />;

  /* ================================================================ */
  /*  Handlers                                                          */
  /* ================================================================ */

  async function handleAddFriend() {
    const tag = addFriendInput.trim().toUpperCase();
    if (!tag) { notify('Please enter a player tag or name.', 'error', onToast); return; }
    setAddFriendLoading(true);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: tag }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Failed to send request.', 'error', onToast); return; }
      setAddFriendInput('');
      notify(`Friend request sent to ${tag}! 🤝`, 'success', onToast);
      await fetchFriends();
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    } finally {
      setAddFriendLoading(false);
    }
  }

  async function handleRemoveFriend(f: FriendItem) {
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: f.userTag }),
      });
      if (!res.ok) {
        const data = await res.json();
        notify(data.error || 'Failed to remove friend.', 'error', onToast);
        return;
      }
      setFriends((prev) => prev.filter((x) => x.id !== f.id));
      notify(`Removed ${f.name} from friends list.`, 'info', onToast);
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    }
  }

  async function handleAcceptFriend(req: PendingRequestItem) {
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: req.userTag }),
      });
      if (!res.ok) {
        const data = await res.json();
        notify(data.error || 'Failed to accept request.', 'error', onToast);
        return;
      }
      notify(`Accepted friend request from ${req.name}! 🤝`, 'success', onToast);
      await fetchFriends();
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    }
  }

  async function handleDeclineFriend(req: PendingRequestItem) {
    try {
      await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: req.userTag }),
      });
      setPendingReceived((prev) => prev.filter((x) => x.id !== req.id));
      notify(`Declined friend request from ${req.name}.`, 'info', onToast);
    } catch {
      /* silent */
    }
  }

  async function handleSendGift(f: FriendItem) {
    if (giftCooldowns.has(f.userTag)) return;
    try {
      const res = await fetch('/api/friends/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: f.userTag, amount: 25 }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Failed to send gift.', 'error', onToast); return; }
      notify(`Sent 25c gift to ${f.name}! 🎁`, 'success', onToast);
      void refresh();
      setGiftCooldowns((prev) => new Set(prev).add(f.userTag));
      setTimeout(() => {
        setGiftCooldowns((prev) => {
          const next = new Set(prev);
          next.delete(f.userTag);
          return next;
        });
      }, 30_000);
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    }
  }

  async function handleBlockFriend(f: FriendItem) {
    try {
      const res = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: f.userTag }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Failed to block player.', 'error', onToast); return; }
      setFriends((prev) => prev.filter((x) => x.id !== f.id));
      notify(`Blocked ${f.name}.`, 'info', onToast);
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    }
  }

  async function handleConnectSearch(p: SearchPlayer) {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTag: p.userTag }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Failed to send request.', 'error', onToast); return; }
      notify(`Connected with ${p.name}! 🤝`, 'success', onToast);
      await fetchFriends();
      // Re-fetch search so the relation badge updates (Connect → Sent)
      setSearchOffset(0);
      await fetchSearch(searchQuery, searchCountry, 0);
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    }
  }

  async function handleUnblock(b: BlockedPlayerItem) {
    try {
      const res = await fetch(`/api/friends/block?userTag=${encodeURIComponent(b.userTag)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify((data as Record<string, string>).error || 'Failed to unblock.', 'error', onToast);
        return;
      }
      setBlockedPlayers((prev) => prev.filter((x) => x.id !== b.id));
      notify(`Unblocked ${b.name}. They can send you requests again.`, 'success', onToast);
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    }
  }

  function handleLoadMoreSearch() {
    fetchSearch(searchQuery, searchCountry, searchOffset, true);
  }

  function inspect(tag: string, name: string, country: string, level: number, chips: number, clanTag: string | null) {
    if (!onInspectPlayer) return;
    onInspectPlayer({
      userTag: tag,
      name,
      country,
      flag: countryFlag(country),
      level,
      bankedChips: chips,
      clanTag: clanTag || undefined,
    });
  }

  /* ================================================================ */
  /*  JSX                                                               */
  /* ================================================================ */

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-violet-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 mb-5">
        <SubTabBtn active={sub === 'friends'} onClick={() => setSub('friends')} icon={Users} label={`My Friends (${friends.length})`} />
        <SubTabBtn active={sub === 'search'} onClick={() => setSub('search')} icon={Globe} label="Search Players" />
        <SubTabBtn active={sub === 'gifts'} onClick={() => setSub('gifts')} icon={Gift} label="Gift History" />
      </div>

      {/* Add friend bar */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={addFriendInput}
          onChange={(e) => setAddFriendInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddFriend(); }}
          placeholder="Enter Player Tag (e.g. COBRA-4231)..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
        />
        <button
          type="button"
          onClick={handleAddFriend}
          disabled={addFriendLoading}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addFriendLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Add Friend
        </button>
      </div>

      {/* ==================== FRIENDS TAB ==================== */}
      {sub === 'friends' && (
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
                      <button type="button" onClick={() => handleAcceptFriend(req)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1">
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button type="button" onClick={() => handleDeclineFriend(req)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition flex items-center gap-1">
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
                      onClick={() => handleUnblock(b)}
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
                            onClick={() => inspect(f.userTag, f.name, f.country, f.level, f.bankedChips, f.clanTag)}
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
                    <button type="button" onClick={() => handleRemoveFriend(f)} className="p-1 rounded text-slate-500 hover:text-rose-400 transition" title="Remove Friend">
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
                      onClick={() => handleSendGift(f)}
                      disabled={giftCooldowns.has(f.userTag)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${giftCooldowns.has(f.userTag) ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed' : 'bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600 hover:text-white'}`}
                    >
                      <Send className="w-3 h-3" /> {giftCooldowns.has(f.userTag) ? 'Cooldown…' : 'Gift +25c'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBlockFriend(f)}
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
                <ol className="divide-y divide-slate-900 max-h-48 overflow-y-auto va-scroll">
                  {recentMatches.map((m, i) => (
                    <li key={i} className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
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
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== SEARCH TAB ==================== */}
      {sub === 'search' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name or Tag..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <select
              value={searchCountry}
              onChange={(e) => setSearchCountry(e.target.value)}
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
                    const isSelf = p.userTag === player.userTag;
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
                                onClick={(e) => { e.stopPropagation(); inspect(p.userTag, p.name, p.country, p.level, p.bankedChips, p.clanTag); }}
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
                          <button type="button" onClick={() => handleConnectSearch(p)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600 hover:text-white transition flex items-center gap-1">
                            <UserPlus className="w-3 h-3" /> Connect
                          </button>
                        )}
                      </li>
                    );
                  })
                )}
                {searchResults.length < searchTotal && searchResults.length > 0 && (
                  <li className="p-3 text-center">
                    <button type="button" onClick={handleLoadMoreSearch} disabled={searchLoading} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-violet-500/40 transition flex items-center gap-1.5 mx-auto disabled:opacity-50">
                      {searchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />} Load More
                    </button>
                  </li>
                )}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* ==================== GIFT HISTORY TAB ==================== */}
      {sub === 'gifts' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60">
            {(['all', 'sent', 'received'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setGiftHistoryFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition border ${giftHistoryFilter === t ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
              >
                {t === 'all' ? 'Show All' : t === 'sent' ? '📤 Sent' : '📥 Received'}
              </button>
            ))}
          </div>

          {giftHistoryLoading ? (
            <PanelSkeleton count={5} />
          ) : giftHistory.length === 0 ? (
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">No Gift History</h4>
              <p className="text-xs text-slate-400 mt-1">
                Send gifts to your friends from the Friends tab. They will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-900 max-h-[55vh] overflow-y-auto va-scroll rounded-2xl border border-slate-800/60 bg-slate-950/80">
              {giftHistory.map((g) => (
                <li key={g.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0" aria-hidden>{g.direction === 'sent' ? '📤' : '📥'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {g.direction === 'sent' ? 'To' : 'From'}: {g.player.name}
                        <span className="text-[10px] font-mono text-slate-500 ml-1.5">#{g.player.userTag}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">{timeAgo(g.createdAt)}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold font-mono shrink-0 ${g.direction === 'sent' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {g.direction === 'sent' ? '-' : '+'}{g.amount}c
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default SocialPanel;
