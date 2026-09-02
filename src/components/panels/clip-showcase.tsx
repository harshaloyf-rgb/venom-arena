'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Loader2,
  Users,
  Zap,
  Trophy,
  ThumbsUp,
  ThumbsDown,
  User,
  Clock,
  AlertTriangle,
  Video,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowLeft,
  Grid3X3,
  ChevronDown,
} from 'lucide-react';
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
  likes: number;
  dislikes: number;
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
  myVote: 'like' | 'dislike' | null;
}

interface LiveStats {
  today: { totalMatches: number; extractions: number; chipsEarned: number; kills: number };
  totalPlayers: number;
}

interface ClipShowcaseProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

type SortOption = 'newest' | 'oldest' | 'upvotes';
type ExpandableSection = 'youtube' | 'youtube-shorts' | 'instagram' | 'match-card';

const PAGE_SIZE = 40;
const PREVIEW_LIMIT = 12;
const EXPANDED_PER_PAGE = 20;

function formatCompact(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const SECTION_META: Record<ExpandableSection, { label: string; icon: React.ReactNode; isVertical: boolean; isMatch: boolean }> = {
  'youtube':        { label: 'YouTube Videos', icon: <Youtube className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-red-500" />, isVertical: false, isMatch: false },
  'youtube-shorts': { label: 'YouTube Shorts', icon: <Smartphone className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-red-400" />, isVertical: true, isMatch: false },
  'instagram':      { label: 'Instagram Reels', icon: <Instagram className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-pink-400" />, isVertical: true, isMatch: false },
  'match-card':     { label: 'Match Cards', icon: <Trophy className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-amber-400" />, isVertical: false, isMatch: true },
};


// ── Horizontal Scroll Row with arrow buttons + View All ──

function ScrollRow({ title, icon, children, onViewAll, showViewAll }: { title: string; icon: React.ReactNode; children: React.ReactNode; onViewAll?: () => void; showViewAll?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollL, setCanScrollL] = useState(false);
  const [canScrollR, setCanScrollR] = useState(false);

  const childArray = useMemo(() => {
    const arr = React.Children.toArray(children);
    return showViewAll ? arr.slice(0, PREVIEW_LIMIT) : arr;
  }, [children, showViewAll]);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollL(el.scrollLeft > 4);
    setCanScrollR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => { checkScroll(); }, [childArray]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function scrollBy(dir: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  }

  return (
    <div className="mb-3 lg:mb-1">
      <div className="flex items-center gap-1.5 mb-2 lg:mb-1 px-1">
        {icon}
        <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest lg:text-[11px]">{title}</span>
        {onViewAll && showViewAll && (
          <button type="button" onClick={onViewAll} className="ml-auto flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 transition uppercase tracking-wider">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="relative group/row">
        {canScrollL && (
          <button
            type="button"
            onClick={() => scrollBy('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-7 lg:w-5 flex items-center justify-center bg-gradient-to-r from-slate-900/95 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 lg:gap-2 overflow-x-auto scrollbar-none scroll-smooth"
        >
          {childArray}
          {onViewAll && showViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="shrink-0 w-40 lg:w-32 h-full min-h-[120px] rounded-xl border border-dashed border-slate-700 bg-slate-950/40 hover:bg-slate-800/40 hover:border-red-500/50 flex flex-col items-center justify-center gap-2 transition group/va cursor-pointer"
            >
              <Grid3X3 className="w-5 h-5 lg:w-4 lg:h-4 text-slate-500 group-hover/va:text-red-400 transition" />
              <span className="text-[11px] font-bold text-slate-500 group-hover/va:text-red-300 uppercase tracking-wider">View All</span>
              <ChevronRight className="w-3 h-3 text-slate-600 group-hover/va:text-red-400 transition" />
            </button>
          )}
        </div>
        {canScrollR && (
          <button
            type="button"
            onClick={() => scrollBy('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-7 lg:w-5 flex items-center justify-center bg-gradient-to-l from-slate-900/95 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}


// ── Expanded Grid View ──

function ExpandedView({
  section,
  onBack,
  clips,
  total,
  page,
  loading,
  search,
  sort,
  onSearchChange,
  onSortChange,
  onPageChange,
  onVote,
  onInspect,
  canVote,
}: {
  section: ExpandableSection;
  onBack: () => void;
  clips: ClipItem[];
  total: number;
  page: number;
  loading: boolean;
  search: string;
  sort: SortOption;
  onSearchChange: (v: string) => void;
  onSortChange: (v: SortOption) => void;
  onPageChange: (p: number) => void;
  onVote: (c: ClipItem, vote: 'like' | 'dislike') => void;
  onInspect: (c: ClipItem) => void;
  canVote: boolean;
}) {
  const meta = SECTION_META[section];
  const totalPages = Math.max(1, Math.ceil(total / EXPANDED_PER_PAGE));
  const searchRef = useRef<HTMLInputElement>(null);

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      onSearchChange((e.target as HTMLInputElement).value);
    }
  }

  function handleSearchClear() {
    onSearchChange('');
    searchRef.current?.focus();
  }

  // Build page numbers to show
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 2) pages.push('...');
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 3) pages.push('...');
      pages.push(totalPages - 1);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="space-y-4 lg:space-y-1.5">
      {/* Header row: Back + Title + Count */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-2.5 py-1.5 lg:px-1.5 lg:py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="flex items-center gap-1.5">
          {meta.icon}
          <span className="text-sm font-bold text-white lg:text-xs">{meta.label}</span>
        </div>
        <span className="text-[11px] font-mono text-slate-500">{total.toLocaleString()} clips</span>
      </div>

      {/* Search + Sort bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            ref={searchRef}
            type="text"
            defaultValue={search}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by title or player name..."
            className="w-full pl-8 pr-8 py-2 lg:py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition"
          />
          {search && (
            <button type="button" onClick={handleSearchClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="appearance-none pl-2.5 pr-7 py-2 lg:py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-bold focus:outline-none focus:border-red-500/50 transition cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="upvotes">Most Upvoted</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Grid / Feed */}
      {loading ? (
        <div className="flex justify-center py-12 lg:py-6">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : clips.length === 0 ? (
        <div className="text-center py-12 lg:py-6">
          <Search className="w-6 h-6 text-slate-700 mx-auto mb-2" />
          <p className="text-[11px] text-slate-500">No clips found{search ? ` for "${search}"` : ''}</p>
        </div>
      ) : meta.isMatch ? (
        /* Match Cards: vertical feed */
        <div className="space-y-4 lg:space-y-1">
          {clips.map((clip) => (
            <FeedItem key={clip.id} clip={clip} onVote={onVote} onInspect={onInspect} canVote={canVote} />
          ))}
        </div>
      ) : meta.isVertical ? (
        /* Vertical cards (Shorts/Reels): responsive grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-2">
          {clips.map((clip) => (
            <VideoCardVertical key={clip.id} clip={clip} onVote={onVote} onInspect={onInspect} canVote={canVote} />
          ))}
        </div>
      ) : (
        /* Horizontal cards (YouTube): 1-2 col grid */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 lg:gap-2">
          {clips.map((clip) => (
            <VideoCardHorizontal key={clip.id} clip={clip} onVote={onVote} onInspect={onInspect} canVote={canVote} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && clips.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageNumbers.map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="px-1 text-slate-600 text-xs">...</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 rounded-lg text-xs font-bold transition ${p === page ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                {p + 1}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Result info */}
      {!loading && clips.length > 0 && (
        <div className="text-center text-[11px] font-mono text-slate-600">
          Showing {page * EXPANDED_PER_PAGE + 1}-{Math.min((page + 1) * EXPANDED_PER_PAGE, total)} of {total.toLocaleString()}
        </div>
      )}
    </div>
  );
}


// ── Empty State Component ──

function EmptyState({ isLoggedIn, onOpenUpload }: { isLoggedIn: boolean; onOpenUpload: () => void }) {
  return (
    <div className="text-center py-6 sm:py-8 lg:py-2">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-1 mb-5 lg:mb-1 max-w-sm mx-auto">
        <StepCard icon={<Video className="w-5 h-5 lg:w-3 lg:h-3 text-red-400" />} step="1" title="Play Matches" desc="Impressive games (5K+ chips or 3+ kills) auto-generate highlight cards" />
        <StepCard icon={<Upload className="w-5 h-5 lg:w-3 lg:h-3 text-amber-400" />} step="2" title="Record & Upload" desc="Record gameplay, upload to YouTube/Instagram, paste the link here" />
        <StepCard icon={<Trophy className="w-5 h-5 lg:w-3 lg:h-3 text-emerald-400" />} step="3" title="Get Featured" desc="Most upvoted clips hit the Top Play spotlight at the top of the feed" />
      </div>

      <div className="max-w-sm mx-auto mb-5 lg:mb-1 space-y-2 lg:space-y-1">
        <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 lg:p-1.5 text-left">
          <p className="text-[11px] font-bold text-slate-300 mb-2 lg:mb-0.5 flex items-center gap-1.5"><Film className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-red-400" /> What appears in Highlights?</p>
          <ul className="text-[11px] text-slate-400 space-y-1">
            <li className="flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">✓</span> <span><strong className="text-slate-300">Match Cards</strong> — Auto-generated stat cards from impressive matches</span></li>
            <li className="flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">✓</span> <span><strong className="text-slate-300">Video Clips</strong> — Community-submitted gameplay from YouTube, YouTube Shorts, and Instagram Reels</span></li>
            <li className="flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">✓</span> <span><strong className="text-slate-300">Top Play</strong> — The most upvoted clip gets the featured trophy spotlight</span></li>
          </ul>
        </div>
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
              <span className="text-[11px] text-slate-500">Match Cards appear instantly, video clips need review</span>
            </div>
          </div>
        </div>
      </div>

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

// ── Main Component ─

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
  const [filterType, setFilterType] = useState<'all' | 'match-card' | 'youtube' | 'youtube-shorts' | 'instagram'>('all');

  // Expanded view state
  const [expandedSection, setExpandedSection] = useState<ExpandableSection | null>(null);
  const [expandedClips, setExpandedClips] = useState<ClipItem[]>([]);
  const [expandedTotal, setExpandedTotal] = useState(0);
  const [expandedPage, setExpandedPage] = useState(0);
  const [expandedSearch, setExpandedSearch] = useState('');
  const [expandedSort, setExpandedSort] = useState<SortOption>('newest');
  const [expandedLoading, setExpandedLoading] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    title: '', description: '', platform: 'YouTube' as string,
    chips: '', kills: '', arenaName: '', url: '',
  });

  const fetchClips = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset;
      const isLoadMore = !reset && clips.length > 0;
      if (isLoadMore) setLoadingMore(true); else setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentOffset) });
        if (myClipsOnly && player) { params.set('player', player.userTag); params.set('pending', 'true'); }
        if (filterType === 'match-card') {
          params.set('type', 'match-card');
        } else if (filterType === 'youtube' || filterType === 'youtube-shorts' || filterType === 'instagram') {
          params.set('type', 'user-clip');
          params.set('platform', filterType);
        }
        const res = await fetch(`/api/clips?${params}`);
        if (!res.ok) throw new Error('Failed to load clips');
        const data = await res.json();
        setClips((prev) => (reset ? data.clips : [...prev, ...data.clips]));
        setTotal(data.total);
        setOffset(currentOffset + PAGE_SIZE);
        setError(null);
      } catch (err: any) { setError(err.message || 'Failed to load clips'); }
      finally { setLoading(false); setLoadingMore(false); }
    },
    [offset, clips.length, myClipsOnly, player, filterType],
  );

  const fetchFeatured = useCallback(async () => {
    try { const res = await fetch('/api/clips/featured'); if (!res.ok) return; const data = await res.json(); setFeatured(data.clip); } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try { const res = await fetch('/api/stats/live'); if (!res.ok) return; const data = await res.json(); setLiveStats(data); } catch {}
  }, []);

  useEffect(() => { fetchClips(true); fetchFeatured(); fetchStats(); }, [myClipsOnly, filterType]);
  useEffect(() => { setClips([]); setOffset(0); }, [myClipsOnly, filterType]);

  useEffect(() => {
    const el = sentinelRef.current; if (!el) return;
    const obs = new IntersectionObserver((e) => { if (e[0].isIntersecting && !loadingMore && clips.length < total) fetchClips(false); }, { rootMargin: '200px' });
    obs.observe(el); return () => obs.disconnect();
  }, [loadingMore, clips.length, total, fetchClips]);

  // ── Expanded view fetch ──
  const fetchExpanded = useCallback(async (section: ExpandableSection, page: number, search: string, sort: SortOption) => {
    setExpandedLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(EXPANDED_PER_PAGE),
        offset: String(page * EXPANDED_PER_PAGE),
        sort,
      });
      if (section === 'match-card') {
        params.set('type', 'match-card');
      } else {
        params.set('type', 'user-clip');
        params.set('platform', section);
      }
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/clips?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setExpandedClips(data.clips);
      setExpandedTotal(data.total);
    } catch {
      setExpandedClips([]);
      setExpandedTotal(0);
    } finally {
      setExpandedLoading(false);
    }
  }, []);

  function handleViewAll(section: ExpandableSection) {
    setExpandedSection(section);
    setExpandedPage(0);
    setExpandedSearch('');
    setExpandedSort('newest');
    fetchExpanded(section, 0, '', 'newest');
  }

  function handleBackFromExpanded() {
    setExpandedSection(null);
    setExpandedClips([]);
  }

  function handleExpandedSearch(value: string) {
    setExpandedSearch(value);
    setExpandedPage(0);
    if (expandedSection) fetchExpanded(expandedSection, 0, value, expandedSort);
  }

  function handleExpandedSort(value: SortOption) {
    setExpandedSort(value);
    setExpandedPage(0);
    if (expandedSection) fetchExpanded(expandedSection, 0, expandedSearch, value);
  }

  function handleExpandedPage(page: number) {
    setExpandedPage(page);
    if (expandedSection) fetchExpanded(expandedSection, page, expandedSearch, expandedSort);
    // Scroll to top of content area
    const contentEl = document.getElementById('clip-content-area');
    if (contentEl) contentEl.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Close expanded view when tab changes
  useEffect(() => { setExpandedSection(null); }, [filterType, myClipsOnly]);

  async function handleVote(clip: ClipItem, vote: 'like' | 'dislike') {
    if (!isLoggedIn) return;
    const optimistic = (c: ClipItem): ClipItem => {
      if (c.myVote === vote) {
        // undo
        return { ...c, myVote: null, likes: vote === 'like' ? c.likes - 1 : c.likes, dislikes: vote === 'dislike' ? c.dislikes - 1 : c.dislikes };
      } else if (c.myVote) {
        // switch
        const likes = vote === 'like' ? c.likes + 1 : c.likes - 1;
        const dislikes = vote === 'dislike' ? c.dislikes + 1 : c.dislikes - 1;
        return { ...c, myVote: vote, likes, dislikes };
      } else {
        // new vote
        return { ...c, myVote: vote, likes: vote === 'like' ? c.likes + 1 : c.likes, dislikes: vote === 'dislike' ? c.dislikes + 1 : c.dislikes };
      }
    };
    setClips(prev => prev.map(c => c.id === clip.id ? optimistic(c) : c));
    if (featured?.id === clip.id) setFeatured(f => f ? optimistic({ ...f, likes: (f as any).likes ?? (f as any).upvotes ?? 0, dislikes: (f as any).dislikes ?? 0, myVote: (f as any).myVote ?? null }) : f);
    setExpandedClips(prev => prev.map(c => c.id === clip.id ? optimistic(c) : c));
    try {
      const r = await fetch('/api/clips/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clipId: clip.id, vote }) });
      if (!r.ok) throw new Error();
    } catch {
      // rollback
      setClips(prev => prev.map(c => c.id === clip.id ? clip : c));
      setExpandedClips(prev => prev.map(c => c.id === clip.id ? clip : c));
      if (onToast) notify('Failed to vote.', 'error', onToast);
    }
  }

  function handleInspectCreator(clip: ClipItem) {
    if (!onInspectPlayer) return;
    onInspectPlayer({ name: clip.player.name, userTag: clip.player.userTag, country: clip.player.country, flag: countryFlag(clip.player.country), bankedChips: 0, level: clip.player.level });
  }

  async function handleUpload() {
    if (!isLoggedIn) return;
    if (!uploadForm.title.trim() || !uploadForm.url.trim()) { if (onToast) notify('Title and Video URL are required.', 'error', onToast); return; }
    setUploading(true);
    try {
      const res = await fetch('/api/clips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: uploadForm.title, description: uploadForm.description, platform: uploadForm.platform, url: uploadForm.url, chipsExtracted: parseInt(uploadForm.chips, 10) || 0, kills: parseInt(uploadForm.kills, 10) || 0, arenaName: uploadForm.arenaName, tags: ['Community'] }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to submit clip'); }
      const data = await res.json();
      if (onToast) notify(data.message || 'Clip submitted! ⏳', 'success', onToast);
      setUploadForm({ title: '', description: '', platform: 'YouTube', chips: '', kills: '', arenaName: '', url: '' });
      setShowUpload(false); setClips([]); setOffset(0); fetchClips(true); fetchFeatured();
    } catch (err: any) { if (onToast) notify(err.message || 'Failed to submit clip', 'error', onToast); }
    finally { setUploading(false); }
  }

  const isMatchCard = (c: ClipItem) => c.cardType === 'match-card';
  const featuredId = featured?.id;
  const isPlatformTab = filterType !== 'all' && filterType !== 'match-card';
  // On platform-specific tabs, show ALL clips (don't hide featured)
  const displayClips = isPlatformTab ? clips : clips.filter((c) => c.id !== featuredId);
  const hasMore = clips.length < total;

  // Separate clips by platform for scroll rows
  const ytVideos = displayClips.filter((c) => !isMatchCard(c) && c.platform === 'YouTube');
  const ytShorts = displayClips.filter((c) => !isMatchCard(c) && c.platform === 'YouTube Shorts');
  const igReels = displayClips.filter((c) => !isMatchCard(c) && c.platform === 'Instagram');
  const matchCards = displayClips.filter((c) => isMatchCard(c));

  // Whether to show View All for each row in "All" tab
  // Show View All if the row has >= PREVIEW_LIMIT items (likely more exist)
  const showViewAllYt = ytVideos.length >= PREVIEW_LIMIT;
  const showViewAllShorts = ytShorts.length >= PREVIEW_LIMIT;
  const showViewAllIg = igReels.length >= PREVIEW_LIMIT;
  const showViewAllMatches = matchCards.length >= PREVIEW_LIMIT;

  // Whether to show View All for platform tabs
  const showViewAllTab = total > PREVIEW_LIMIT;

  // Check if a specific section should be shown as expanded
  const isExpanded = expandedSection !== null;

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
                {myClipsOnly ? '✕' : '👤'} {myClipsOnly ? 'All' : 'My Clips'}
              </button>
            )}
            <div className="flex items-center gap-0.5 bg-slate-950 rounded-xl border border-slate-800 p-0.5">
              {(['all', 'match-card', 'youtube', 'youtube-shorts', 'instagram'] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setFilterType(tab)} className={`px-2.5 lg:px-1 lg:py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1 lg:gap-0.5 whitespace-nowrap ${filterType === tab ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                  {tab === 'all' && 'All'}
                  {tab === 'match-card' && 'Matches'}
                  {tab === 'youtube' && <><Youtube className="w-3 h-3" /><span className="hidden xl:inline">Videos</span></>}
                  {tab === 'youtube-shorts' && <><Smartphone className="w-3 h-3" /><span className="hidden xl:inline">Shorts</span></>}
                  {tab === 'instagram' && <><Instagram className="w-3 h-3" /><span className="hidden xl:inline">Reels</span></>}
                </button>
              ))}
            </div>

            {isLoggedIn && (
              <button type="button" onClick={() => setShowUpload(true)} className="px-3 py-2 lg:px-1.5 lg:py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 lg:gap-1">
                <Plus className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> Share Clip
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Stats Ticker */}
      {liveStats && !isPlatformTab && !isExpanded && (
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
      <div id="clip-content-area" className="px-5 sm:px-6 pb-6 lg:px-2 lg:pb-2">
        {loading && <PanelSkeleton count={3} height="h-80" />}

        {error && !loading && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 lg:p-2 text-center">
            <p className="text-sm text-rose-300 mb-3">{error}</p>
            <button type="button" onClick={() => fetchClips(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition">Retry</button>
          </div>
        )}

        {!loading && !error && clips.length === 0 && !isExpanded && <EmptyState isLoggedIn={isLoggedIn} onOpenUpload={() => setShowUpload(true)} />}

        {/* ═══ EXPANDED VIEW ═══ */}
        {isExpanded && (
          <ExpandedView
            section={expandedSection!}
            onBack={handleBackFromExpanded}
            clips={expandedClips}
            total={expandedTotal}
            page={expandedPage}
            loading={expandedLoading}
            search={expandedSearch}
            sort={expandedSort}
            onSearchChange={handleExpandedSearch}
            onSortChange={handleExpandedSort}
            onPageChange={handleExpandedPage}
            onVote={handleVote}
            onInspect={handleInspectCreator}
            canVote={isLoggedIn}
          />
        )}

        {/* ═══ PLATFORM TAB: Horizontal scroll rows (only when NOT expanded) ═══ */}
        {!loading && !isExpanded && isPlatformTab && (
          <>
            {/* YouTube Videos Tab */}
            {filterType === 'youtube' && (
              ytVideos.length > 0
                ? <ScrollRow title="YouTube Videos" icon={<Youtube className="w-4 h-4 lg:w-3 lg:h-3 text-red-500" />} onViewAll={() => handleViewAll('youtube')} showViewAll={showViewAllTab}>{ytVideos.map((c) => <VideoCardHorizontal key={c.id} clip={c} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />)}</ScrollRow>
                : <PlatformEmpty label="YouTube Videos" />
            )}
            {/* Shorts Tab */}
            {filterType === 'youtube-shorts' && (
              ytShorts.length > 0
                ? <ScrollRow title="YouTube Shorts" icon={<Smartphone className="w-4 h-4 lg:w-3 lg:h-3 text-red-400" />} onViewAll={() => handleViewAll('youtube-shorts')} showViewAll={showViewAllTab}>{ytShorts.map((c) => <VideoCardVertical key={c.id} clip={c} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />)}</ScrollRow>
                : <PlatformEmpty label="YouTube Shorts" />
            )}
            {/* Instagram Reels Tab */}
            {filterType === 'instagram' && (
              igReels.length > 0
                ? <ScrollRow title="Instagram Reels" icon={<Instagram className="w-4 h-4 lg:w-3 lg:h-3 text-pink-400" />} onViewAll={() => handleViewAll('instagram')} showViewAll={showViewAllTab}>{igReels.map((c) => <VideoCardVertical key={c.id} clip={c} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />)}</ScrollRow>
                : <PlatformEmpty label="Instagram Reels" />
            )}
          </>
        )}

        {/* Matches Tab — T3: moved OUT of the isPlatformTab gate (TS-aliased narrowing
            proved it unreachable there — match-card can never be a platform tab) */}
        {!loading && !isExpanded && filterType === 'match-card' && (
          <>
          {filterType === 'match-card' && (
              matchCards.length > 0
                ? <>
                    <ScrollRow title="Match Cards" icon={<Trophy className="w-4 h-4 lg:w-3 lg:h-3 text-amber-400" />} onViewAll={() => handleViewAll('match-card')} showViewAll={showViewAllTab}>
                      {matchCards.slice(0, PREVIEW_LIMIT).map((clip) => <FeedItem key={clip.id} clip={clip} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />)}
                    </ScrollRow>
                    {showViewAllTab && matchCards.length > PREVIEW_LIMIT && (
                      <div className="text-center mt-2">
                        <button type="button" onClick={() => handleViewAll('match-card')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500/50 text-xs font-bold text-slate-400 hover:text-red-300 uppercase tracking-wider transition">
                          <Grid3X3 className="w-3.5 h-3.5" /> View All {total} Match Cards
                        </button>
                      </div>
                    )}
                  </>
                : <PlatformEmpty label="Match Cards" />
            )}
          </>
        )}

        {/* ═══ ALL TAB: Featured + horizontal scroll rows (only when NOT expanded) ═══ */}
        {!loading && !isExpanded && filterType === 'all' && !myClipsOnly && (
          <>
            {/* Featured Clip */}
            {featured && (
              <div className="mb-4 lg:mb-1">
                <div className="flex items-center gap-2 lg:gap-1 mb-3 lg:mb-0.5">
                  <Trophy className="w-4 h-4 text-amber-400 lg:w-3 lg:h-3" />
                  <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-widest lg:text-[11px]">Top Play</span>
                </div>
                <div className="flex overflow-hidden">
                {isMatchCard(featured) ? (
                  <MatchCardVisual title={featured.title} playerName={featured.player.name} userTag={featured.player.userTag} country={featured.player.country} level={featured.player.level} clanTag={featured.player.clanTag} arenaName={featured.arenaName} outcome={(featured.matchData?.outcome as 'extract' | 'death') || 'extract'} chipsEarned={featured.chipsExtracted} chipsLost={featured.matchData?.chipsLost || 0} kills={featured.kills} snakeLength={featured.matchData?.snakeLength || 0} durationSec={featured.matchData?.durationSec || 0} isOnline={featured.matchData?.isOnline || false} upvotes={featured.likes} />
                ) : featured.platform.toLowerCase().includes('shorts') || featured.platform.toLowerCase().includes('instagram') ? (
                  <VideoCardVertical clip={featured} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />
                ) : (
                  <VideoCardHorizontal clip={featured} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />
                )}
                </div>

              </div>
            )}

            {/* YouTube Videos row */}
            {ytVideos.length > 0 && (
              <ScrollRow title="YouTube Videos" icon={<Youtube className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-red-500" />} onViewAll={() => handleViewAll('youtube')} showViewAll={showViewAllYt}>
                {ytVideos.map((c) => <VideoCardHorizontal key={c.id} clip={c} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />)}
              </ScrollRow>
            )}

            {/* Shorts row */}
            {ytShorts.length > 0 && (
              <ScrollRow title="Shorts" icon={<Smartphone className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-red-400" />} onViewAll={() => handleViewAll('youtube-shorts')} showViewAll={showViewAllShorts}>
                {ytShorts.map((c) => <VideoCardVertical key={c.id} clip={c} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />)}
              </ScrollRow>
            )}

            {/* Instagram Reels row */}
            {igReels.length > 0 && (
              <ScrollRow title="Instagram Reels" icon={<Instagram className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-pink-400" />} onViewAll={() => handleViewAll('instagram')} showViewAll={showViewAllIg}>
                {igReels.map((c) => <VideoCardVertical key={c.id} clip={c} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />)}
              </ScrollRow>
            )}

            {/* Match Cards — vertical feed */}
            {matchCards.length > 0 && (
              <div className="mt-3 lg:mt-1">
                <div className="flex items-center justify-between mb-2 lg:mb-1 px-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 lg:w-3 lg:h-3 text-amber-400" />
                    <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest lg:text-[11px]">Match Cards</span>
                  </div>
                  {showViewAllMatches && (
                    <button type="button" onClick={() => handleViewAll('match-card')} className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 transition uppercase tracking-wider">
                      View All <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="space-y-4 lg:space-y-1">
                  {matchCards.slice(0, PREVIEW_LIMIT).map((clip) => <FeedItem key={clip.id} clip={clip} onVote={handleVote} onInspect={handleInspectCreator} canVote={isLoggedIn} />)}
                </div>
              </div>
            )}
          </>
        )}

        <div ref={sentinelRef} className="h-4 lg:h-1" />
        {loadingMore && <div className="flex justify-center py-6 lg:py-2"><Loader2 className="w-5 h-5 lg:w-3 lg:h-3 animate-spin text-slate-500" /></div>}
      </div>

      {showUpload && <UploadModal uploadForm={uploadForm} setUploadForm={setUploadForm} uploading={uploading} onUpload={handleUpload} onClose={() => setShowUpload(false)} />}

    </div>
  );
}

// ── Feed Item (vertical, for match cards) ──

function FeedItem({ clip, onVote, onInspect, canVote, showCTA }: { clip: ClipItem; onVote: (c: ClipItem, vote: 'like' | 'dislike') => void; onInspect: (c: ClipItem) => void; canVote: boolean; showCTA?: boolean }) {
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
      <MatchCardVisual title={clip.title} playerName={clip.player.name} userTag={clip.player.userTag} country={clip.player.country} level={clip.player.level} clanTag={clip.player.clanTag} arenaName={clip.arenaName} outcome={(clip.matchData?.outcome as 'extract' | 'death') || 'extract'} chipsEarned={clip.chipsExtracted} chipsLost={clip.matchData?.chipsLost || 0} kills={clip.kills} snakeLength={clip.matchData?.snakeLength || 0} durationSec={clip.matchData?.durationSec || 0} isOnline={clip.matchData?.isOnline || false} upvotes={clip.likes} compact />
      {showCTA && (
        <div className="mt-3 lg:mt-1 px-4 lg:px-2 py-3 lg:py-1 rounded-xl bg-gradient-to-r from-red-600/10 to-amber-600/10 border border-red-500/20 text-center">
          <p className="text-xs lg:text-[11px] text-slate-300"><span className="text-white font-bold">Can you beat this?</span> <span className="text-slate-500">Sign in and play to get your highlight on the feed!</span></p>
        </div>
      )}
      <div className="flex items-center gap-3 lg:gap-2 mt-2.5 lg:mt-0.5 px-1">
        <button type="button" onClick={() => onVote(clip, 'like')} disabled={!canVote} className={`flex items-center gap-1 lg:gap-0.5 text-xs lg:text-[11px] font-bold transition ${clip.myVote === 'like' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'} disabled:opacity-40`}>
          <ThumbsUp className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> {clip.likes}
        </button>
        <button type="button" onClick={() => onVote(clip, 'dislike')} disabled={!canVote} className={`flex items-center gap-1 lg:gap-0.5 text-xs lg:text-[11px] font-bold transition ${clip.myVote === 'dislike' ? 'text-red-400' : 'text-slate-500 hover:text-red-400'} disabled:opacity-40`}>
          <ThumbsDown className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> {clip.dislikes}
        </button>
        <button type="button" onClick={() => onInspect(clip)} className="flex items-center gap-1 lg:gap-0.5 text-xs lg:text-[11px] text-slate-500 hover:text-white transition"><User className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> Profile</button>
      </div>
      <div className="border-b border-slate-800/40 mt-4 lg:mt-1" />
    </div>
  );
}

// ── Video Card: Horizontal (YouTube Videos) — thumbnail left, info right ──

function VideoCardHorizontal({ clip, onVote, onInspect, canVote }: { clip: ClipItem; onVote?: (c: ClipItem, vote: 'like' | 'dislike') => void; onInspect?: (c: ClipItem) => void; canVote?: boolean }) {
  const platform = clip.platform.toLowerCase();
  return (
    <div className="shrink-0 w-[440px] lg:w-[420px] rounded-xl border border-slate-800 bg-slate-950/70 shadow-md overflow-hidden flex flex-col hover:border-slate-700 transition group/card">
      <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex flex-row flex-1">
      {/* Thumbnail */}
      <div className="relative w-56 lg:w-56 h-[160px] lg:h-[150px] shrink-0 bg-gradient-to-br from-slate-900 via-slate-950 to-red-950/20 overflow-hidden">
        {clip.thumbnailUrl ? (
          <img src={clip.thumbnailUrl!} alt={clip.title} className="w-full h-full object-cover transition group-hover/card:scale-105" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f1623] to-slate-950" />
            <PlatformIcon platform={platform} size="sm" />
          </div>
        )}
        <div className="absolute top-1 left-1">
          <span className="text-[9px] font-mono font-bold bg-slate-950/90 border border-slate-700 text-white px-1 py-0.5 rounded flex items-center gap-0.5">
            <PlatformIcon platform={platform} /> {clip.platform}
          </span>
        </div>
        {clip.chipsExtracted > 0 && (
          <div className="absolute bottom-1 right-1">
            <span className="text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1 py-0.5 rounded">💰{clip.chipsExtracted.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center">
        <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{clip.title}</h3>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[11px] font-mono text-slate-500">{clip.player.name}</span>
          <span className="text-[11px] text-slate-700">·</span>
          <span className="text-[11px] font-mono text-slate-600">{timeAgo(clip.createdAt)}</span>
        </div>
      </div>
      </a>
      {onVote && onInspect && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-slate-800/60">
          <button type="button" onClick={() => onVote(clip, 'like')} disabled={!canVote} className={`flex items-center gap-0.5 text-[11px] font-bold transition ${clip.myVote === 'like' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'} disabled:opacity-40`}>
            <ThumbsUp className="w-3 h-3" /> {clip.likes}
          </button>
          <button type="button" onClick={() => onVote(clip, 'dislike')} disabled={!canVote} className={`flex items-center gap-0.5 text-[11px] font-bold transition ${clip.myVote === 'dislike' ? 'text-red-400' : 'text-slate-500 hover:text-red-400'} disabled:opacity-40`}>
            <ThumbsDown className="w-3 h-3" /> {clip.dislikes}
          </button>
          <button type="button" onClick={() => onInspect(clip)} className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-white transition ml-auto"><User className="w-3 h-3" /> Profile</button>
        </div>
      )}
    </div>
  );
}

// ── Video Card: Vertical (Shorts & Reels) — 9:16 portrait ──

function VideoCardVertical({ clip, onVote, onInspect, canVote }: { clip: ClipItem; onVote?: (c: ClipItem, vote: 'like' | 'dislike') => void; onInspect?: (c: ClipItem) => void; canVote?: boolean }) {
  const platform = clip.platform.toLowerCase();
  const isShort = platform.includes('shorts');
  return (
    <div className="shrink-0 w-52 lg:w-48 rounded-xl border border-slate-800 bg-slate-950/70 shadow-md overflow-hidden hover:border-slate-700 transition group/card">
      <a href={clip.url} target="_blank" rel="noopener noreferrer">
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-gradient-to-br from-slate-900 via-slate-950 to-pink-950/20 overflow-hidden">
        {clip.thumbnailUrl ? (
          <img src={clip.thumbnailUrl!} alt={clip.title} className="w-full h-full object-cover transition group-hover/card:scale-105" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f1623] to-slate-950" />
            <PlatformIcon platform={platform} size="lg" />
          </div>
        )}
        <div className="absolute top-1 left-1">
          <span className="text-[9px] font-mono font-bold bg-slate-950/90 border border-slate-700 text-white px-1 py-0.5 rounded flex items-center gap-0.5">
            <PlatformIcon platform={platform} /> {isShort ? 'Shorts' : 'Reels'}
          </span>
        </div>
        {clip.chipsExtracted > 0 && (
          <div className="absolute bottom-1 right-1">
            <span className="text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1 py-0.5 rounded">💰{clip.chipsExtracted.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>
      </a>
      {/* Info */}
      <div className="p-2.5">
        <h3 className="text-xs font-bold text-white leading-tight line-clamp-2">{clip.title}</h3>
        <div className="text-[11px] font-mono text-slate-500 mt-0.5">{timeAgo(clip.createdAt)}</div>
      </div>
      {onVote && onInspect && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-slate-800/60">
          <button type="button" onClick={() => onVote(clip, 'like')} disabled={!canVote} className={`flex items-center gap-0.5 text-[11px] font-bold transition ${clip.myVote === 'like' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'} disabled:opacity-40`}>
            <ThumbsUp className="w-3 h-3" /> {clip.likes}
          </button>
          <button type="button" onClick={() => onVote(clip, 'dislike')} disabled={!canVote} className={`flex items-center gap-0.5 text-[11px] font-bold transition ${clip.myVote === 'dislike' ? 'text-red-400' : 'text-slate-500 hover:text-red-400'} disabled:opacity-40`}>
            <ThumbsDown className="w-3 h-3" /> {clip.dislikes}
          </button>
          <button type="button" onClick={() => onInspect(clip)} className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-white transition ml-auto"><User className="w-3 h-3" /> Profile</button>
        </div>
      )}
    </div>
  );
}

// ── Empty state for platform tabs ──

function PlatformEmpty({ label }: { label: string }) {
  return (
    <div className="text-center py-8 lg:py-3">
      <Film className="w-6 h-6 text-slate-700 mx-auto mb-2" />
      <p className="text-[11px] text-slate-500">No {label} yet</p>
    </div>
  );
}

function PlatformIcon({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'lg' }) {
  const p = platform.toLowerCase();
  const isShort = p.includes('shorts');
  if (p.includes('youtube')) return size === 'lg'
    ? <Youtube className={`mx-auto ${isShort ? 'w-7 h-7' : 'w-8 h-8'} text-red-500`} />
    : <Youtube className={`w-3 h-3 ${isShort ? 'text-red-400' : 'text-red-500'}`} />;
  if (p.includes('instagram')) return size === 'lg' ? <Instagram className="w-8 h-8 text-pink-400 mx-auto" /> : <Instagram className="w-3 h-3 text-pink-400" />;
  if (isShort) return size === 'lg' ? <Smartphone className="w-7 h-7 text-red-400 mx-auto" /> : <Smartphone className="w-3 h-3 text-red-400" />;
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
