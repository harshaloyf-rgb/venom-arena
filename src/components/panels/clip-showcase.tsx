'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { countryFlag, type InspectedPlayer } from '@/lib/game-config';
import {
  GlowBlob,
  MicroLabel,
  PanelSkeleton,
  notify,
  type ToastFn,
} from './_panel-primitives';
import { MatchCardVisual } from '@/components/share/match-card-visual';
import {
  Film,
  Plus,
  Flame,
  ExternalLink,
  X,
  Youtube,
  Instagram,
  Twitch,
  Loader2,
  Star,
  Filter,
  TrendingUp,
  Users,
  Zap,
  Trophy,
  ChevronDown,
  Heart,
  MessageCircle,
  Send,
} from 'lucide-react';

// ── Types ──

interface ClipItem {
  id: string;
  title: string;
  description: string;
  platform: string;
  url: string;
  thumbnailUrl: string | null;
  chipsExtracted: number;
  kills: number;
  arenaName: string;
  tags: string[];
  upvotes: number;
  featured: boolean;
  cardType: string;
  matchData: {
    outcome: string;
    chipsLost: number;
    snakeLength: number;
    durationSec: number;
    isOnline: boolean;
  } | null;
  createdAt: string;
  player: { name: string; userTag: string; country: string; level: number; clanTag: string | null };
  myUpvote?: boolean;
}

interface LiveStats {
  today: {
    totalMatches: number;
    extractions: number;
    chipsEarned: number;
    kills: number;
  };
  totalPlayers: number;
}

interface ClipShowcaseProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

const PAGE_SIZE = 20;

function formatCompact(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

// ── Main Component ──

export function ClipShowcase({ onToast, onInspectPlayer }: ClipShowcaseProps) {
  const { player } = useAuth();
  const isLoggedIn = !!player;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [clips, setClips] = useState<ClipItem[]>([]);
  const [featured, setFeatured] = useState<ClipItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [myClipsOnly, setMyClipsOnly] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'match-card' | 'user-clip'>('all');

  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    platform: 'YouTube' as string,
    chips: '',
    kills: '',
    arenaName: '',
    url: '',
  });

  /* ── Fetch clips (no auth required for browsing) ── */
  const fetchClips = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset;
      const isLoadMore = !reset && clips.length > 0;

      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentOffset) });
        if (myClipsOnly && player) params.set('player', player.userTag);
        if (filterType !== 'all') params.set('type', filterType);

        const res = await fetch(`/api/clips?${params}`);
        if (!res.ok) throw new Error('Failed to load clips');
        const data = await res.json();

        setClips((prev) => (reset ? data.clips : [...prev, ...data.clips]));
        setTotal(data.total);
        setOffset(currentOffset + PAGE_SIZE);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load clips');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [offset, clips.length, myClipsOnly, player, filterType],
  );

  /* ── Fetch featured ── */
  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch('/api/clips/featured');
      if (!res.ok) return;
      const data = await res.json();
      setFeatured(data.clip);
    } catch {
      // silently ignore
    }
  }, []);

  /* ── Fetch live stats ── */
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/live');
      if (!res.ok) return;
      const data = await res.json();
      setLiveStats(data);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchClips(true);
    fetchFeatured();
    fetchStats();
  }, [myClipsOnly, filterType]);

  /* ── Reset list when filter changes ── */
  useEffect(() => {
    setClips([]);
    setOffset(0);
  }, [myClipsOnly, filterType]);

  /* ── Infinite scroll ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && clips.length < total) {
          fetchClips(false);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadingMore, clips.length, total, fetchClips]);

  /* ── Upvote ── */
  async function handleUpvote(clip: ClipItem) {
    if (!isLoggedIn || clip.myUpvote) return;

    setClips((prev) =>
      prev.map((c) => (c.id === clip.id ? { ...c, upvotes: c.upvotes + 1, myUpvote: true } : c)),
    );
    if (featured?.id === clip.id) {
      setFeatured((f) => (f ? { ...f, upvotes: f.upvotes + 1, myUpvote: true } : f));
    }

    try {
      const res = await fetch('/api/clips/upvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId: clip.id }),
      });
      if (!res.ok) throw new Error();
      if (onToast) notify(`Upvoted! 🔥`, 'success', onToast);
    } catch {
      setClips((prev) =>
        prev.map((c) => (c.id === clip.id ? { ...c, upvotes: c.upvotes - 1, myUpvote: false } : c)),
      );
      if (featured?.id === clip.id) {
        setFeatured((f) => (f ? { ...f, upvotes: f.upvotes - 1, myUpvote: false } : f));
      }
      if (onToast) notify('Failed to upvote.', 'error', onToast);
    }
  }

  /* ── Inspect creator ── */
  function handleInspectCreator(clip: ClipItem) {
    if (!onInspectPlayer) return;
    onInspectPlayer({
      name: clip.player.name,
      userTag: clip.player.userTag,
      country: clip.player.country,
      flag: countryFlag(clip.player.country),
      bankedChips: clip.chipsExtracted,
      level: clip.player.level,
    });
  }

  /* ── Upload ── */
  async function handleUpload() {
    if (!isLoggedIn) return;
    if (!uploadForm.title.trim() || !uploadForm.url.trim()) {
      if (onToast) notify('Title and Video URL are required.', 'error', onToast);
      return;
    }
    setUploading(true);
    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadForm.title,
          description: uploadForm.description,
          platform: uploadForm.platform,
          url: uploadForm.url,
          chipsExtracted: parseInt(uploadForm.chips, 10) || 0,
          kills: parseInt(uploadForm.kills, 10) || 0,
          arenaName: uploadForm.arenaName,
          tags: ['Community'],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to publish clip');
      }
      if (onToast) notify('Clip published to Highlights feed! 🎬', 'success', onToast);
      setUploadForm({ title: '', description: '', platform: 'YouTube', chips: '', kills: '', arenaName: '', url: '' });
      setShowUpload(false);
      setClips([]);
      setOffset(0);
      fetchClips(true);
      fetchFeatured();
    } catch (err: any) {
      if (onToast) notify(err.message || 'Failed to publish clip', 'error', onToast);
    } finally {
      setUploading(false);
    }
  }

  const hasMore = clips.length < total;
  const featuredId = featured?.id;
  const displayClips = clips.filter((c) => c.id !== featuredId);
  const isMatchCard = (c: ClipItem) => c.cardType === 'match-card';

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md overflow-hidden">
      <GlowBlob color="bg-red-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* ═══ Onboarding Banner (non-logged-in) ═══ */}
      {!isLoggedIn && (
        <div className="relative bg-gradient-to-r from-red-600/20 via-slate-900 to-red-600/20 border-b border-red-500/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl" aria-hidden>🐍</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Welcome to Venom Arena Highlights</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Watch the best plays from real players.{' '}
                <span className="text-red-400 font-bold">Sign in to share your own clips and vote!</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Header ═══ */}
      <div className="relative px-5 sm:px-6 pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
              <Flame className="w-5.5 h-5.5 text-red-400" />
              Highlights & Esports
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Top plays, clutch extractions &amp; community highlights — all in one feed.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => setMyClipsOnly((v) => !v)}
                className={`px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 border ${myClipsOnly ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}`}
              >
                <Filter className="w-3.5 h-3.5" /> {myClipsOnly ? 'All' : 'My Clips'}
              </button>
            )}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-red-500/50 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="match-card">Match Cards</option>
              <option value="user-clip">Video Clips</option>
            </select>
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Share Clip
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Live Stats Ticker ═══ */}
      {liveStats && (
        <div className="mx-5 sm:mx-6 mb-4">
          <div className="flex items-center gap-4 overflow-x-auto py-2.5 px-4 rounded-xl bg-slate-950/80 border border-slate-800/60 scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono text-slate-400">Today</span>
            </div>
            <StatChip icon="⚔️" value={String(liveStats.today.totalMatches)} label="Matches" />
            <StatChip icon="✅" value={String(liveStats.today.extractions)} label="Extracts" />
            <StatChip icon="💰" value={formatCompact(liveStats.today.chipsEarned)} label="Earned" />
            <StatChip icon="💀" value={String(liveStats.today.kills)} label="Kills" />
            <div className="ml-auto shrink-0 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-mono text-slate-500">
                <span className="text-blue-400 font-bold">{liveStats.totalPlayers}</span> Players
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Content Area (scrollable) ═══ */}
      <div className="px-5 sm:px-6 pb-6 max-h-[600px] overflow-y-auto custom-scrollbar">

        {/* Loading state */}
        {loading && <PanelSkeleton count={3} height="h-80" />}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-center">
            <p className="text-sm text-rose-300 mb-3">{error}</p>
            <button
              type="button"
              onClick={() => fetchClips(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && clips.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🐍</div>
            <p className="text-sm text-slate-500 mb-1">No highlights yet</p>
            <p className="text-xs text-slate-600">Great matches will auto-appear here. Be the first!</p>
          </div>
        )}

        {/* ═══ Featured Clip (hero card) ═══ */}
        {!loading && featured && !myClipsOnly && filterType === 'all' && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-widest">Top Play</span>
            </div>

            {isMatchCard(featured) ? (
              <MatchCardVisual
                title={featured.title}
                playerName={featured.player.name}
                userTag={featured.player.userTag}
                country={featured.player.country}
                level={featured.player.level}
                clanTag={featured.player.clanTag}
                arenaName={featured.arenaName}
                outcome={(featured.matchData?.outcome as 'extract' | 'death') || 'extract'}
                chipsEarned={featured.chipsExtracted}
                chipsLost={featured.matchData?.chipsLost || 0}
                kills={featured.kills}
                snakeLength={featured.matchData?.snakeLength || 0}
                durationSec={featured.matchData?.durationSec || 0}
                isOnline={featured.matchData?.isOnline || false}
                upvotes={featured.upvotes}
              />
            ) : (
              <VideoClipCard clip={featured} onUpvote={handleUpvote} onInspect={handleInspectCreator} canVote={isLoggedIn} />
            )}

            {/* Featured engagement bar */}
            <div className="flex items-center gap-4 mt-3 px-1">
              <button
                type="button"
                onClick={() => handleUpvote(featured)}
                disabled={!isLoggedIn || featured.myUpvote}
                className={`flex items-center gap-1.5 text-xs font-bold transition ${
                  featured.myUpvote ? 'text-red-400' : 'text-slate-400 hover:text-red-400'
                } disabled:opacity-40`}
              >
                <Flame className="w-4 h-4" /> {featured.upvotes}
              </button>
              <button
                type="button"
                onClick={() => handleInspectCreator(featured)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition"
              >
                <MessageCircle className="w-4 h-4" /> View Profile
              </button>
              {featured.url && (
                <a
                  href={featured.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition ml-auto"
                >
                  Watch <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ═══ Feed ─══ */}
        {!loading && displayClips.length > 0 && (
          <div className="space-y-4">
            {displayClips.map((clip, idx) => (
              <FeedItem
                key={clip.id}
                clip={clip}
                onUpvote={handleUpvote}
                onInspect={handleInspectCreator}
                canVote={isLoggedIn}
                showCTA={!isLoggedIn && idx === 0}
              />
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />

        {/* Load More fallback */}
        {loadingMore && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        )}
      </div>

      {/* ═══ Upload Modal ═══ */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-red-400" /> Share Your Clip
              </h3>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">
              Record your gameplay (phone, OBS, etc.), upload to YouTube/Instagram, then paste the link here.
              Your clip will appear in the Highlights feed for everyone to see!
            </p>
            <div className="space-y-3">
              <div>
                <MicroLabel>Clip Title</MicroLabel>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. INSANE 1V2 EXTRACTION CLUTCH!"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <MicroLabel>Description</MicroLabel>
                <input
                  type="text"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <MicroLabel>Platform</MicroLabel>
                  <select
                    value={uploadForm.platform}
                    onChange={(e) => setUploadForm((f) => ({ ...f, platform: e.target.value }))}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                  >
                    <option value="YouTube">YouTube</option>
                    <option value="Instagram">Instagram Reels</option>
                    <option value="Twitch">Twitch</option>
                  </select>
                </div>
                <div>
                  <MicroLabel>Extracted Chips (c)</MicroLabel>
                  <input
                    type="number"
                    value={uploadForm.chips}
                    onChange={(e) => setUploadForm((f) => ({ ...f, chips: e.target.value }))}
                    placeholder="e.g. 2500000"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <MicroLabel>Kills</MicroLabel>
                  <input
                    type="number"
                    value={uploadForm.kills}
                    onChange={(e) => setUploadForm((f) => ({ ...f, kills: e.target.value }))}
                    placeholder="e.g. 5"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500/50"
                  />
                </div>
                <div>
                  <MicroLabel>Arena Name</MicroLabel>
                  <input
                    type="text"
                    value={uploadForm.arenaName}
                    onChange={(e) => setUploadForm((f) => ({ ...f, arenaName: e.target.value }))}
                    placeholder="e.g. Scrap Alley"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
              <div>
                <MicroLabel>Video URL</MicroLabel>
                <input
                  type="url"
                  value={uploadForm.url}
                  onChange={(e) => setUploadForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=... or https://instagram.com/reel/..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function FeedItem({
  clip,
  onUpvote,
  onInspect,
  canVote,
  showCTA,
}: {
  clip: ClipItem;
  onUpvote: (c: ClipItem) => void;
  onInspect: (c: ClipItem) => void;
  canVote: boolean;
  showCTA?: boolean;
}) {
  const isMatch = clip.cardType === 'match-card';

  return (
    <div className="group">
      {/* Player header */}
      <div className="flex items-center gap-2.5 mb-2.5 px-1">
        <button
          type="button"
          onClick={() => onInspect(clip)}
          className="flex items-center gap-2 hover:opacity-80 transition text-left"
        >
          <span className="text-lg leading-none" aria-hidden>{countryFlag(clip.player.country)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate">{clip.player.name}</span>
              {clip.player.clanTag && (
                <span className="text-[9px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-1 py-0.5 rounded">
                  [{clip.player.clanTag}]
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              #{clip.player.userTag} · {timeAgo(clip.createdAt)}
            </div>
          </div>
        </button>

        {/* Tags */}
        <div className="ml-auto flex items-center gap-1.5">
          {clip.tags.slice(0, 2).map((t) => (
            <span key={t} className="text-[8px] font-mono text-red-300 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Card content */}
      {isMatch ? (
        <MatchCardVisual
          title={clip.title}
          playerName={clip.player.name}
          userTag={clip.player.userTag}
          country={clip.player.country}
          level={clip.player.level}
          clanTag={clip.player.clanTag}
          arenaName={clip.arenaName}
          outcome={(clip.matchData?.outcome as 'extract' | 'death') || 'extract'}
          chipsEarned={clip.chipsExtracted}
          chipsLost={clip.matchData?.chipsLost || 0}
          kills={clip.kills}
          snakeLength={clip.matchData?.snakeLength || 0}
          durationSec={clip.matchData?.durationSec || 0}
          isOnline={clip.matchData?.isOnline || false}
          upvotes={clip.upvotes}
          compact
        />
      ) : (
        <VideoClipCard clip={clip} onUpvote={onUpvote} onInspect={onInspect} canVote={canVote} />
      )}

      {/* "Can you beat this?" CTA for non-logged-in */}
      {showCTA && (
        <div className="mt-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-600/10 to-amber-600/10 border border-red-500/20 text-center">
          <p className="text-xs text-slate-300">
            <span className="text-white font-bold">Can you beat this?</span>{' '}
            <span className="text-slate-500">Sign in and play to get your highlight on the feed!</span>
          </p>
        </div>
      )}

      {/* Engagement bar */}
      <div className="flex items-center gap-4 mt-2.5 px-1">
        <button
          type="button"
          onClick={() => onUpvote(clip)}
          disabled={!canVote || clip.myUpvote}
          className={`flex items-center gap-1.5 text-xs font-bold transition ${
            clip.myUpvote ? 'text-red-400' : 'text-slate-500 hover:text-red-400'
          } disabled:opacity-40`}
        >
          <Flame className="w-4 h-4" /> {clip.upvotes}
        </button>
        <button
          type="button"
          onClick={() => onInspect(clip)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition"
        >
          <Heart className="w-4 h-4" /> Profile
        </button>
        {!isMatch && clip.url && (
          <a
            href={clip.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition ml-auto"
          >
            Watch <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Divider (except last) */}
      <div className="border-b border-slate-800/40 mt-4" />
    </div>
  );
}

function VideoClipCard({ clip, onUpvote, onInspect, canVote }: {
  clip: ClipItem;
  onUpvote: (c: ClipItem) => void;
  onInspect: (c: ClipItem) => void;
  canVote: boolean;
}) {
  const platform = clip.platform.toLowerCase();
  const hasThumbnail = !!clip.thumbnailUrl;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md overflow-hidden">
      {/* Thumbnail area */}
      <a
        href={clip.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-video bg-gradient-to-br from-slate-900 via-slate-950 to-red-950/20 overflow-hidden"
      >
        {hasThumbnail ? (
          <img
            src={clip.thumbnailUrl!}
            alt={clip.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Styled gradient instead of black */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f1623] to-slate-950" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />
            <div className="relative text-center">
              <PlatformIcon platform={platform} size="lg" />
              <p className="text-[10px] font-mono text-slate-500 mt-1.5">WATCH ON {platform.toUpperCase()}</p>
            </div>
          </div>
        )}

        {/* Platform badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="text-[9px] font-mono font-bold bg-slate-950/90 border border-slate-700 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
            <PlatformIcon platform={platform} size="sm" /> {clip.platform}
          </span>
        </div>

        {/* Stats badge */}
        {clip.chipsExtracted > 0 && (
          <div className="absolute top-2.5 right-2.5">
            <span className="text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded">
              💰 {clip.chipsExtracted.toLocaleString('en-IN')} c
            </span>
          </div>
        )}
      </a>

      {/* Body */}
      <div className="p-3">
        <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 mb-1">{clip.title}</h3>
        {clip.description && (
          <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">{clip.description}</p>
        )}
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600">
          {clip.arenaName && <span>{clip.arenaName}</span>}
          {clip.arenaName && <span>·</span>}
          <span>{timeAgo(clip.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function PlatformIcon({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'lg' }) {
  if (platform === 'youtube') {
    return size === 'lg' ? (
      <Youtube className="w-8 h-8 text-red-500 mx-auto" />
    ) : (
      <Youtube className="w-3 h-3 text-red-500" />
    );
  }
  if (platform === 'twitch') {
    return size === 'lg' ? (
      <Twitch className="w-8 h-8 text-violet-400 mx-auto" />
    ) : (
      <Twitch className="w-3 h-3 text-violet-400" />
    );
  }
  if (platform === 'instagram') {
    return size === 'lg' ? (
      <Instagram className="w-8 h-8 text-pink-400 mx-auto" />
    ) : (
      <Instagram className="w-3 h-3 text-pink-400" />
    );
  }
  return size === 'lg' ? (
    <Film className="w-8 h-8 text-slate-500 mx-auto" />
  ) : (
    <Film className="w-3 h-3 text-slate-400" />
  );
}

function StatChip({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs" aria-hidden>{icon}</span>
      <span className="text-[10px] font-mono text-slate-300 font-bold">{value}</span>
      <span className="text-[9px] font-mono text-slate-600 hidden sm:inline">{label}</span>
    </div>
  );
}

export default ClipShowcase;