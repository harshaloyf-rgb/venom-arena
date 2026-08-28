'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { countryFlag, type InspectedPlayer } from '@/lib/game-config';
import { timeAgo } from '@/lib/date-utils';
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
  Filter,
  Users,
  Zap,
  Trophy,
  Heart,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Video,
  Upload,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { AdminModerationModal } from './clips/admin-moderation-modal';
import { UploadModal } from './clips/upload-modal';

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
  today: { totalMatches: number; extractions: number; chipsEarned: number; kills: number };
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



// ── Empty State Component ──

function EmptyState({ isLoggedIn, onOpenUpload }: { isLoggedIn: boolean; onOpenUpload: () => void }) {
  return (
    <div className="text-center py-6 sm:py-8 lg:py-2">
      {/* Hero icon */}
      <div className="relative inline-flex items-center justify-center mb-5 lg:mb-1">
        <div className="w-16 h-16 lg:w-8 lg:h-8 rounded-2xl bg-gradient-to-br from-red-600/20 to-amber-600/20 border border-red-500/20 flex items-center justify-center">
          <Flame className="w-7 h-7 lg:w-3 lg:h-3 text-red-400" />
        </div>
      </div>
      <h3 className="text-base sm:text-lg font-black text-white mb-1.5 lg:text-[11px] lg:mb-0.5">Highlights Feed</h3>
      <p className="text-[11px] sm:text-xs text-slate-400 mb-6 lg:mb-1 max-w-md mx-auto leading-relaxed">
        The best Venom Arena plays, clutch extractions, and community clips all in one place.
        Scroll through top plays, upvote your favorites, and share your own legendary moments!
      </p>

      {/* How it works steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-1 mb-5 lg:mb-1 max-w-sm mx-auto">
        <StepCard icon={<Video className="w-5 h-5 lg:w-3 lg:h-3 text-red-400" />} step="1" title="Play Matches" desc="Impressive games (5K+ chips or 3+ kills) auto-generate highlight cards" />
        <StepCard icon={<Upload className="w-5 h-5 lg:w-3 lg:h-3 text-amber-400" />} step="2" title="Record & Upload" desc="Record gameplay, upload to YouTube/Instagram, paste the link here" />
        <StepCard icon={<Trophy className="w-5 h-5 lg:w-3 lg:h-3 text-emerald-400" />} step="3" title="Get Featured" desc="Most upvoted clips hit the Top Play spotlight at the top of the feed" />
      </div>

      {/* What appears here */}
      <div className="max-w-sm mx-auto mb-5 lg:mb-1 space-y-2 lg:space-y-1">
        <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 lg:p-1.5 text-left">
          <p className="text-[11px] font-bold text-slate-300 mb-2 lg:mb-0.5 flex items-center gap-1.5"><Film className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-red-400" /> What appears in Highlights?</p>
          <ul className="text-[11px] text-slate-400 space-y-1">
            <li className="flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">✓</span> <span><strong className="text-slate-300">Match Cards</strong> — Auto-generated stat cards from impressive matches (big extractions, multi-kills)</span></li>
            <li className="flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">✓</span> <span><strong className="text-slate-300">Video Clips</strong> — Community-submitted gameplay from YouTube, Instagram Reels, and Twitch</span></li>
            <li className="flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">✓</span> <span><strong className="text-slate-300">Top Play</strong> — The most upvoted clip gets the featured trophy spotlight</span></li>
          </ul>
        </div>

        {/* Content rules summary */}
        <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 lg:p-1.5 text-left">
          <p className="text-[11px] font-bold text-slate-300 mb-1.5 lg:mb-0.5 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-emerald-400" /> Community Guidelines</p>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-slate-400">All user-submitted clips are reviewed by admins before going live</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[11px] text-slate-400">Only Venom Arena gameplay — no obscene, abusive, or off-topic content</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-500">Match Cards appear instantly (auto-generated), video clips need review</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      {isLoggedIn ? (
        <button type="button" onClick={onOpenUpload} className="inline-flex items-center gap-2 lg:gap-1 px-6 lg:px-3 py-3 lg:py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-red-600/20">
          <Plus className="w-4 h-4 lg:w-3 lg:h-3" /> Share Your First Clip
        </button>
      ) : (
        <p className="text-[11px] text-slate-500 italic">Sign in to submit your own gameplay highlights</p>
      )}
    </div>
  );
}

function StepCard({ icon, step, title, desc }: { icon: React.ReactNode; step: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 lg:p-1.5 text-center">
      <div className="flex justify-center mb-1.5">{icon}</div>
      <div className="text-[11px] font-mono text-red-400 font-bold mb-0.5">STEP {step}</div>
      <div className="text-xs font-bold text-white mb-0.5">{title}</div>
      <div className="text-[11px] text-slate-500 leading-tight">{desc}</div>
    </div>
  );
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
  const [showAdmin, setShowAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const isAdmin = player?.role === 'admin';

  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    platform: 'YouTube' as string,
    chips: '',
    kills: '',
    arenaName: '',
    url: '',
  });

  /* ── Fetch clips (no auth required) ── */
  const fetchClips = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset;
      const isLoadMore = !reset && clips.length > 0;

      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentOffset) });
        if (myClipsOnly && player) {
          params.set('player', player.userTag);
          params.set('pending', 'true'); // see own pending clips
        }
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

  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch('/api/clips/featured');
      if (!res.ok) return;
      const data = await res.json();
      setFeatured(data.clip);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/live');
      if (!res.ok) return;
      const data = await res.json();
      setLiveStats(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchClips(true);
    fetchFeatured();
    fetchStats();
  }, [myClipsOnly, filterType]);

  /* ── Admin: fetch pending count ── */
  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      try {
        const res = await fetch('/api/clips/admin?status=pending&limit=1');
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.counts?.pending ?? 0);
        }
      } catch {}
    }
    load();
  }, [isAdmin, showAdmin]);

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
        if (entries[0].isIntersecting && !loadingMore && clips.length < total) fetchClips(false);
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadingMore, clips.length, total, fetchClips]);

  /* ── Upvote ── */
  async function handleUpvote(clip: ClipItem) {
    if (!isLoggedIn || clip.myUpvote) return;
    setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, upvotes: c.upvotes + 1, myUpvote: true } : c)));
    if (featured?.id === clip.id) setFeatured((f) => (f ? { ...f, upvotes: f.upvotes + 1, myUpvote: true } : f));
    try {
      const res = await fetch('/api/clips/upvote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clipId: clip.id }) });
      if (!res.ok) throw new Error();
      if (onToast) notify('Upvoted! 🔥', 'success', onToast);
    } catch {
      setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, upvotes: c.upvotes - 1, myUpvote: false } : c)));
      if (featured?.id === clip.id) setFeatured((f) => (f ? { ...f, upvotes: f.upvotes - 1, myUpvote: false } : f));
      if (onToast) notify('Failed to upvote.', 'error', onToast);
    }
  }

  /* ── Inspect creator ── */
  function handleInspectCreator(clip: ClipItem) {
    if (!onInspectPlayer) return;
    onInspectPlayer({ name: clip.player.name, userTag: clip.player.userTag, country: clip.player.country, flag: countryFlag(clip.player.country), bankedChips: 0, level: clip.player.level });
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
          title: uploadForm.title, description: uploadForm.description, platform: uploadForm.platform, url: uploadForm.url,
          chipsExtracted: parseInt(uploadForm.chips, 10) || 0, kills: parseInt(uploadForm.kills, 10) || 0,
          arenaName: uploadForm.arenaName, tags: ['Community'],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to submit clip');
      }
      const data = await res.json();
      const msg = data.message || (data.status === 'pending' ? 'Clip submitted for review! It will appear after admin approval. ⏳' : 'Clip published! 🎬');
      if (onToast) notify(msg, 'success', onToast);
      setUploadForm({ title: '', description: '', platform: 'YouTube', chips: '', kills: '', arenaName: '', url: '' });
      setShowUpload(false);
      setClips([]); setOffset(0);
      fetchClips(true);
      fetchFeatured();
    } catch (err: any) {
      if (onToast) notify(err.message || 'Failed to submit clip', 'error', onToast);
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

      {/* Onboarding Banner */}
      {!isLoggedIn && (
        <div className="relative bg-gradient-to-r from-red-600/20 via-slate-900 to-red-600/20 border-b border-red-500/20 px-5 py-4 lg:px-2 lg:py-1">
          <div className="flex items-center gap-3 lg:gap-1">
            <div className="text-2xl lg:text-sm" aria-hidden>🐍</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white lg:text-[11px]">Welcome to Venom Arena Highlights</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 lg:mt-0">Watch the best plays. <span className="text-red-400 font-bold">Sign in to share your own clips!</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative px-5 sm:px-6 pt-5 pb-4 lg:px-2 lg:pt-1 lg:pb-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-1">
          <div>
            <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5 lg:gap-1 lg:text-[11px]">
              <Flame className="w-5.5 h-5.5 text-red-400 lg:w-3 lg:h-3" /> Highlights & Esports
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl lg:text-[11px] lg:mt-0">Top plays, clutch extractions &amp; community highlights.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 lg:gap-1">
            {isLoggedIn && (
              <button type="button" onClick={() => setMyClipsOnly((v) => !v)} className={`px-3 py-2 lg:px-1.5 lg:py-1 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 lg:gap-1 border ${myClipsOnly ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}`}>
                <Filter className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> {myClipsOnly ? 'All' : 'My Clips'}
              </button>
            )}
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="px-3 py-2 lg:px-1.5 lg:py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-red-500/50 cursor-pointer">
              <option value="all">All</option>
              <option value="match-card">Match Cards</option>
              <option value="user-clip">Video Clips</option>
            </select>
            {isAdmin && (
              <button type="button" onClick={() => setShowAdmin(true)} className="px-3 py-2 lg:px-1.5 lg:py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 lg:gap-1 relative">
                <Shield className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> Moderate
                {pendingCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 lg:w-4 lg:h-4 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-slate-900">{pendingCount > 9 ? '9+' : pendingCount}</span>}
              </button>
            )}
            {isLoggedIn && (
              <button type="button" onClick={() => setShowUpload(true)} className="px-3 py-2 lg:px-1.5 lg:py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 lg:gap-1">
                <Plus className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> Share Clip
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Stats Ticker */}
      {liveStats && (
        <div className="mx-5 sm:mx-6 mb-4 lg:mx-2 lg:mb-1">
          <div className="flex items-center gap-4 lg:gap-2 overflow-x-auto py-2.5 px-4 lg:py-1 lg:px-1.5 rounded-xl bg-slate-950/80 border border-slate-800/60 scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0"><Zap className="w-3.5 h-3.5 text-amber-400 lg:w-3 lg:h-3" /><span className="text-[11px] font-mono text-slate-400">Today</span></div>
            <StatChip icon="⚔️" value={String(liveStats.today.totalMatches)} label="Matches" />
            <StatChip icon="✅" value={String(liveStats.today.extractions)} label="Extracts" />
            <StatChip icon="💰" value={formatCompact(liveStats.today.chipsEarned)} label="Earned" />
            <StatChip icon="💀" value={String(liveStats.today.kills)} label="Kills" />
            <div className="ml-auto shrink-0 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400 lg:w-3 lg:h-3" />
              <span className="text-[11px] font-mono text-slate-500"><span className="text-blue-400 font-bold">{liveStats.totalPlayers}</span> Players</span>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="px-5 sm:px-6 pb-6 lg:px-2 lg:pb-2 max-h-[600px] lg:max-h-[540px] overflow-y-auto custom-scrollbar">
        {loading && <PanelSkeleton count={3} height="h-80" />}

        {error && !loading && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 lg:p-2 text-center">
            <p className="text-sm text-rose-300 mb-3">{error}</p>
            <button type="button" onClick={() => fetchClips(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition">Retry</button>
          </div>
        )}

        {!loading && !error && clips.length === 0 && <EmptyState isLoggedIn={isLoggedIn} onOpenUpload={() => setShowUpload(true)} />}

        {/* Featured Clip */}
        {!loading && featured && !myClipsOnly && filterType === 'all' && (
          <div className="mb-6 lg:mb-1">
            <div className="flex items-center gap-2 lg:gap-1 mb-3 lg:mb-0.5">
              <Trophy className="w-4 h-4 text-amber-400 lg:w-3 lg:h-3" />
              <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-widest lg:text-[11px]">Top Play</span>
            </div>
            {isMatchCard(featured) ? (
              <MatchCardVisual title={featured.title} playerName={featured.player.name} userTag={featured.player.userTag} country={featured.player.country} level={featured.player.level} clanTag={featured.player.clanTag} arenaName={featured.arenaName} outcome={(featured.matchData?.outcome as 'extract' | 'death') || 'extract'} chipsEarned={featured.chipsExtracted} chipsLost={featured.matchData?.chipsLost || 0} kills={featured.kills} snakeLength={featured.matchData?.snakeLength || 0} durationSec={featured.matchData?.durationSec || 0} isOnline={featured.matchData?.isOnline || false} upvotes={featured.upvotes} />
            ) : (
              <VideoClipCard clip={featured} onUpvote={handleUpvote} onInspect={handleInspectCreator} canVote={isLoggedIn} />
            )}
            <div className="flex items-center gap-4 lg:gap-2 mt-3 lg:mt-0.5 px-1">
              <button type="button" onClick={() => handleUpvote(featured)} disabled={!isLoggedIn || featured.myUpvote} className={`flex items-center gap-1.5 lg:gap-1 text-xs lg:text-[11px] font-bold transition ${featured.myUpvote ? 'text-red-400' : 'text-slate-400 hover:text-red-400'} disabled:opacity-40`}>
                <Flame className="w-4 h-4 lg:w-3 lg:h-3" /> {featured.upvotes}
              </button>
              <button type="button" onClick={() => handleInspectCreator(featured)} className="flex items-center gap-1.5 lg:gap-1 text-xs lg:text-[11px] text-slate-500 hover:text-white transition">
                <Heart className="w-4 h-4 lg:w-3 lg:h-3" /> Profile
              </button>
              {featured.url && (
                <a href={featured.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 lg:gap-1 text-xs lg:text-[11px] text-slate-500 hover:text-white transition ml-auto">Watch <ExternalLink className="w-3.5 h-3.5 lg:w-3 lg:h-3" /></a>
              )}
            </div>
          </div>
        )}

        {/* Feed */}
        {!loading && displayClips.length > 0 && (
          <div className="space-y-4 lg:space-y-1">
            {displayClips.map((clip, idx) => (
              <FeedItem key={clip.id} clip={clip} onUpvote={handleUpvote} onInspect={handleInspectCreator} canVote={isLoggedIn} showCTA={!isLoggedIn && idx === 0} />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-4 lg:h-1" />
        {loadingMore && <div className="flex justify-center py-6 lg:py-2"><Loader2 className="w-5 h-5 lg:w-3 lg:h-3 animate-spin text-slate-500" /></div>}
      </div>

      {/* Upload Modal */}
      {showUpload && <UploadModal uploadForm={uploadForm} setUploadForm={setUploadForm} uploading={uploading} onUpload={handleUpload} onClose={() => setShowUpload(false)} />}

      {/* Admin Moderation Modal */}
      {showAdmin && <AdminModerationModal onClose={() => { setShowAdmin(false); fetchClips(true); fetchFeatured(); }} />}
    </div>
  );
}

// ── Feed Item ──

function FeedItem({ clip, onUpvote, onInspect, canVote, showCTA }: { clip: ClipItem; onUpvote: (c: ClipItem) => void; onInspect: (c: ClipItem) => void; canVote: boolean; showCTA?: boolean }) {
  const isMatch = clip.cardType === 'match-card';
  return (
    <div className="group">
      <div className="flex items-center gap-2.5 lg:gap-1 mb-2.5 lg:mb-1 px-1">
        <button type="button" onClick={() => onInspect(clip)} className="flex items-center gap-2 hover:opacity-80 transition text-left">
          <span className="text-lg lg:text-sm leading-none" aria-hidden>{countryFlag(clip.player.country)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white lg:text-[11px]">{clip.player.name}</span>
              {clip.player.clanTag && <span className="text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-1 py-0.5 rounded">[{clip.player.clanTag}]</span>}
            </div>
            <div className="text-[11px] font-mono text-slate-500">#{clip.player.userTag} · {timeAgo(clip.createdAt)}</div>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          {clip.tags.slice(0, 2).map((t) => (
            <span key={t} className="text-[11px] font-mono text-red-300 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">#{t}</span>
          ))}
        </div>
      </div>
      {isMatch ? (
        <MatchCardVisual title={clip.title} playerName={clip.player.name} userTag={clip.player.userTag} country={clip.player.country} level={clip.player.level} clanTag={clip.player.clanTag} arenaName={clip.arenaName} outcome={(clip.matchData?.outcome as 'extract' | 'death') || 'extract'} chipsEarned={clip.chipsExtracted} chipsLost={clip.matchData?.chipsLost || 0} kills={clip.kills} snakeLength={clip.matchData?.snakeLength || 0} durationSec={clip.matchData?.durationSec || 0} isOnline={clip.matchData?.isOnline || false} upvotes={clip.upvotes} compact />
      ) : (
        <VideoClipCard clip={clip} onUpvote={onUpvote} onInspect={onInspect} canVote={canVote} />
      )}
      {showCTA && (
        <div className="mt-3 lg:mt-1 px-4 lg:px-2 py-3 lg:py-1 rounded-xl bg-gradient-to-r from-red-600/10 to-amber-600/10 border border-red-500/20 text-center">
          <p className="text-xs lg:text-[11px] text-slate-300"><span className="text-white font-bold">Can you beat this?</span> <span className="text-slate-500">Sign in and play to get your highlight on the feed!</span></p>
        </div>
      )}
      <div className="flex items-center gap-4 lg:gap-2 mt-2.5 lg:mt-0.5 px-1">
        <button type="button" onClick={() => onUpvote(clip)} disabled={!canVote || clip.myUpvote} className={`flex items-center gap-1.5 lg:gap-1 text-xs lg:text-[11px] font-bold transition ${clip.myUpvote ? 'text-red-400' : 'text-slate-500 hover:text-red-400'} disabled:opacity-40`}>
          <Flame className="w-4 h-4 lg:w-3 lg:h-3" /> {clip.upvotes}
        </button>
        <button type="button" onClick={() => onInspect(clip)} className="flex items-center gap-1.5 lg:gap-1 text-xs lg:text-[11px] text-slate-500 hover:text-white transition"><Heart className="w-4 h-4 lg:w-3 lg:h-3" /> Profile</button>
        {!isMatch && clip.url && <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 lg:gap-1 text-xs lg:text-[11px] text-slate-500 hover:text-white transition ml-auto">Watch <ExternalLink className="w-3.5 h-3.5 lg:w-3 lg:h-3" /></a>}
      </div>
      <div className="border-b border-slate-800/40 mt-4 lg:mt-1" />
    </div>
  );
}

// ── Video Clip Card ──

function VideoClipCard({ clip, onUpvote, onInspect, canVote }: { clip: ClipItem; onUpvote: (c: ClipItem) => void; onInspect: (c: ClipItem) => void; canVote: boolean }) {
  const platform = clip.platform.toLowerCase();
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md overflow-hidden">
      <a href={clip.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-gradient-to-br from-slate-900 via-slate-950 to-red-950/20 overflow-hidden">
        {clip.thumbnailUrl ? (
          <img src={clip.thumbnailUrl!} alt={clip.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f1623] to-slate-950" />
            <div className="relative text-center">
              <PlatformIcon platform={platform} size="lg" />
              <p className="text-[11px] font-mono text-slate-500 mt-1.5 lg:mt-0.5">WATCH ON {platform.toUpperCase()}</p>
            </div>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5"><span className="text-[11px] font-mono font-bold bg-slate-950/90 border border-slate-700 text-white px-2 lg:px-1 py-0.5 rounded-md flex items-center gap-1"><PlatformIcon platform={platform} /> {clip.platform}</span></div>
        {clip.chipsExtracted > 0 && <div className="absolute top-2.5 right-2.5"><span className="text-[11px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded">💰 {clip.chipsExtracted.toLocaleString('en-IN')} c</span></div>}
      </a>
      <div className="p-3 lg:p-1.5">
        <h3 className="text-sm lg:text-[11px] font-bold text-white leading-tight mb-1 lg:mb-0.5">{clip.title}</h3>
        {clip.description && <p className="text-[11px] text-slate-500 mb-2 lg:mb-0.5">{clip.description}</p>}
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600">{clip.arenaName && <span>{clip.arenaName}</span>}{clip.arenaName && <span>·</span>}<span>{timeAgo(clip.createdAt)}</span></div>
      </div>
    </div>
  );
}

function PlatformIcon({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'lg' }) {
  if (platform === 'youtube') return size === 'lg' ? <Youtube className="w-8 h-8 text-red-500 mx-auto" /> : <Youtube className="w-3 h-3 text-red-500" />;
  if (platform === 'twitch') return size === 'lg' ? <Twitch className="w-8 h-8 text-violet-400 mx-auto" /> : <Twitch className="w-3 h-3 text-violet-400" />;
  if (platform === 'instagram') return size === 'lg' ? <Instagram className="w-8 h-8 text-pink-400 mx-auto" /> : <Instagram className="w-3 h-3 text-pink-400" />;
  return size === 'lg' ? <Film className="w-8 h-8 text-slate-500 mx-auto" /> : <Film className="w-3 h-3 text-slate-400" />;
}

function StatChip({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs" aria-hidden>{icon}</span>
      <span className="text-[11px] font-mono text-slate-300 font-bold">{value}</span>
      <span className="text-[11px] font-mono text-slate-600 hidden sm:inline">{label}</span>
    </div>
  );
}

export default ClipShowcase;
