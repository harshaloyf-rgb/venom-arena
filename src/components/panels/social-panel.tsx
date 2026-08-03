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
  Crosshair, UserMinus, UserCheck,
} from 'lucide-react';
import { PanelTabBtn } from '@/components/ui/panel-tab-btn';

// Sub-view components
import { FriendsTab } from './social/friends-tab';
import { FollowersTab } from './social/followers-tab';
import { FollowingTab } from './social/following-tab';
import { SearchTab } from './social/search-tab';
import { GiftsTab } from './social/gifts-tab';

// Types & helpers
import {
  deriveSkinColor,
  type SocialPanelProps,
  type SubTab,
  type FriendItem,
  type PendingRequestItem,
  type SearchPlayer,
  type BlockedPlayerItem,
  type GiftEntry,
  type FollowItem,
  type CountryOption,
  type RecentMatch,
} from './social/_types';

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

  /* ---- Followers / Following state ---- */
  const [followers, setFollowers] = useState<FollowItem[]>([]);
  const [following, setFollowing] = useState<FollowItem[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followedBackTags, setFollowedBackTags] = useState<Set<string>>(new Set());

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

  const fetchFollowers = useCallback(async () => {
    setFollowersLoading(true);
    try {
      const res = await fetch('/api/player/follow?type=followers');
      if (!res.ok) return;
      const data = await res.json();
      const items: FollowItem[] = (data.followers ?? []).map((f: Record<string, unknown>) => ({
        followerId: (f.followerId as string) || (f.id as string) || '',
        followerName: (f.followerName as string) || (f.name as string) || '',
        followerUserTag: (f.followerUserTag as string) || (f.userTag as string) || '',
        followerCountry: (f.followerCountry as string) || (f.country as string) || '',
        name: (f.followerName as string) || (f.name as string) || '',
        userTag: (f.followerUserTag as string) || (f.userTag as string) || '',
        country: (f.followerCountry as string) || (f.country as string) || '',
        isFollowingBack: (f.isFollowingBack as boolean) ?? false,
      }));
      setFollowers(items);
      // Pre-populate already-followed-back tags
      setFollowedBackTags(new Set(items.filter((i) => i.isFollowingBack).map((i) => i.userTag ?? i.followerUserTag ?? '')));
    } catch {
      /* silent */
    } finally {
      setFollowersLoading(false);
    }
  }, []);

  const fetchFollowing = useCallback(async () => {
    setFollowingLoading(true);
    try {
      const res = await fetch('/api/player/follow?type=following');
      if (!res.ok) return;
      const data = await res.json();
      const items: FollowItem[] = (data.following ?? []).map((f: Record<string, unknown>) => ({
        followingId: (f.followingId as string) || (f.id as string) || '',
        followingName: (f.followingName as string) || (f.name as string) || '',
        followingUserTag: (f.followingUserTag as string) || (f.userTag as string) || '',
        followingCountry: (f.followingCountry as string) || (f.country as string) || '',
        name: (f.followingName as string) || (f.name as string) || '',
        userTag: (f.followingUserTag as string) || (f.userTag as string) || '',
        country: (f.followingCountry as string) || (f.country as string) || '',
      }));
      setFollowing(items);
    } catch {
      /* silent */
    } finally {
      setFollowingLoading(false);
    }
  }, []);

  /* ---- Effects ---- */

  useEffect(() => { fetchFriends(); fetchRecentMatches(); }, [fetchFriends, fetchRecentMatches]);

  useEffect(() => { if (sub === 'search') fetchCountries(); }, [sub, fetchCountries]);

  useEffect(() => {
    if (sub !== 'gifts') return;
    fetchGiftHistory(giftHistoryFilter);
  }, [sub, giftHistoryFilter, fetchGiftHistory]);

  useEffect(() => { if (sub === 'followers') fetchFollowers(); }, [sub, fetchFollowers]);

  useEffect(() => { if (sub === 'following') fetchFollowing(); }, [sub, fetchFollowing]);

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

  async function handleFollowBack(tag: string, name: string) {
    try {
      const res = await fetch('/api/player/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserTag: tag }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Failed to follow back.', 'error', onToast); return; }
      setFollowedBackTags((prev) => new Set(prev).add(tag));
      notify(`Now following ${name}! 🤝`, 'success', onToast);
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    }
  }

  async function handleUnfollow(tag: string, name: string) {
    try {
      const res = await fetch('/api/player/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserTag: tag, action: 'unfollow' }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Failed to unfollow.', 'error', onToast); return; }
      setFollowing((prev) => prev.filter((f) => (f.userTag ?? f.followingUserTag) !== tag));
      notify(`Unfollowed ${name}.`, 'info', onToast);
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    }
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
        <PanelTabBtn active={sub === 'friends'} onClick={() => setSub('friends')} icon={Users} label={`My Friends (${friends.length})`} color="violet" />
        <PanelTabBtn active={sub === 'followers'} onClick={() => setSub('followers')} icon={UserCheck} label={`Followers (${followers.length})`} color="violet" />
        <PanelTabBtn active={sub === 'following'} onClick={() => setSub('following')} icon={UserMinus} label={`Following (${following.length})`} color="violet" />
        <PanelTabBtn active={sub === 'rivals'} onClick={() => setSub('rivals')} icon={Crosshair} label="Rivals" color="violet" />
        <PanelTabBtn active={sub === 'search'} onClick={() => setSub('search')} icon={Globe} label="Search Players" color="violet" />
        <PanelTabBtn active={sub === 'gifts'} onClick={() => setSub('gifts')} icon={Gift} label="Gift History" color="violet" />
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
        <FriendsTab
          friends={friends}
          pendingReceived={pendingReceived}
          pendingSent={pendingSent}
          blockedPlayers={blockedPlayers}
          recentMatches={recentMatches}
          friendsLoading={friendsLoading}
          giftCooldowns={giftCooldowns}
          onAccept={handleAcceptFriend}
          onDecline={handleDeclineFriend}
          onRemove={handleRemoveFriend}
          onGift={handleSendGift}
          onBlock={handleBlockFriend}
          onUnblock={handleUnblock}
          onInspect={inspect}
        />
      )}

      {/* ==================== FOLLOWERS TAB ==================== */}
      {sub === 'followers' && (
        <FollowersTab
          followers={followers}
          followersLoading={followersLoading}
          followedBackTags={followedBackTags}
          onFollowBack={handleFollowBack}
        />
      )}

      {/* ==================== FOLLOWING TAB ==================== */}
      {sub === 'following' && (
        <FollowingTab
          following={following}
          followingLoading={followingLoading}
          onUnfollow={handleUnfollow}
        />
      )}

      {/* ==================== SEARCH TAB ==================== */}
      {sub === 'search' && (
        <SearchTab
          searchQuery={searchQuery}
          searchCountry={searchCountry}
          countries={countries}
          searchResults={searchResults}
          searchTotal={searchTotal}
          searchLoading={searchLoading}
          playerUserTag={player.userTag}
          onSearchQueryChange={setSearchQuery}
          onSearchCountryChange={setSearchCountry}
          onSendFriend={handleConnectSearch}
          onInspect={inspect}
          onLoadMore={handleLoadMoreSearch}
        />
      )}

      {/* ==================== RIVALS TAB ==================== */}
      {sub === 'rivals' && (
        <div className="space-y-3">
          <RivalsTab onToast={onToast} onInspectPlayer={onInspectPlayer} />
        </div>
      )}

      {/* ==================== GIFT HISTORY TAB ==================== */}
      {sub === 'gifts' && (
        <GiftsTab
          giftHistory={giftHistory}
          giftHistoryLoading={giftHistoryLoading}
          giftHistoryFilter={giftHistoryFilter}
          onFilterChange={setGiftHistoryFilter}
        />
      )}
    </div>
  );
}

function RivalsTab({ onToast, onInspectPlayer }: { onToast?: ToastFn; onInspectPlayer?: (p: InspectedPlayer) => void }) {
  const [rivals, setRivals] = useState<Array<{ id: string; rivalTag: string; rivalName: string; timesKilledBy: number; timesKilledYou: number; lastEncounterAt: string | null; createdAt: string; country?: string; bankedChips?: number; level?: number }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchRivals = useCallback(() => {
    let cancelled = false;
    fetch('/api/rivals')
      .then(r => r.json())
      .then(d => { if (!cancelled) { setRivals(d.rivals ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { const cleanup = fetchRivals(); return cleanup; }, [fetchRivals]);

  async function handleRemove(rival: { rivalTag: string; rivalName: string }) {
    const res = await fetch('/api/rivals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: rival.rivalTag, action: 'remove' }),
    });
    const data = await res.json();
    if (data.isRival === false) {
      setRivals(prev => prev.filter(r => r.rivalTag !== rival.rivalTag));
      notify(`${rival.rivalName} removed from rivals.`, 'success', onToast);
    }
  }

  async function handleRivalFollowBack(rival: { rivalTag: string; rivalName: string }) {
    try {
      const res = await fetch('/api/player/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserTag: rival.rivalTag }),
      });
      const data = await res.json();
      if (data.isFollowing) {
        notify(`Now following ${rival.rivalName}!`, 'success', onToast);
      }
    } catch {
      notify('Failed to follow player.', 'error', onToast);
    }
  }

  if (loading) return <PanelSkeleton count={3} />;

  if (rivals.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
        <Crosshair className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-white">No Rivals Yet</h4>
        <p className="text-xs text-slate-400 mt-1">
          Inspect any player and click &quot;Add Rival&quot; to track your nemesis!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-orange-300 uppercase tracking-wider flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5" /> Your Rivals ({rivals.length})
        </h3>
      </div>
      <ul className="space-y-2">
        {rivals.map((r) => {
          const totalEncounters = r.timesKilledBy + r.timesKilledYou;
          const winRate = totalEncounters > 0 ? Math.round((r.timesKilledBy / totalEncounters) * 100) : 0;
          return (
            <li key={r.id} className="p-3 rounded-xl border border-orange-500/15 bg-orange-500/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0 bg-orange-500/10 border border-orange-500/30">
                  ⚔️
                </div>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onInspectPlayer?.({ name: r.rivalName || r.rivalTag, userTag: r.rivalTag, country: r.country || 'US', flag: '', bankedChips: r.bankedChips || 0, level: r.level || 0 })}
                    className="font-bold text-orange-200 text-sm truncate hover:text-orange-100 transition flex items-center gap-1"
                  >
                    {r.rivalName || r.rivalTag}
                    <ExternalLink className="w-2.5 h-2.5 text-orange-400/50" />
                  </button>
                  <div className="text-[10px] font-mono text-slate-500">#{r.rivalTag}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-emerald-400">W:{r.timesKilledBy}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-rose-400">L:{r.timesKilledYou}</span>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${winRate >= 50 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{winRate}% WR</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRivalFollowBack(r)}
                    className="text-[9px] text-violet-400 hover:text-violet-300 transition flex items-center gap-0.5"
                  >+Friend</button>
                  <button
                    type="button"
                    onClick={() => handleRemove(r)}
                    className="text-[9px] text-slate-500 hover:text-rose-400 transition"
                  >Remove</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SocialPanel;
