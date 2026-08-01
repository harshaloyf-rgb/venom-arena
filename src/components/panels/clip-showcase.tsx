'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Film,
  Plus,
  Flame,
  ExternalLink,
  X,
  Youtube,
  Twitch,
  Loader2,
  Star,
  Filter,
} from 'lucide-react';

interface ClipItem {
  id: string;
  title: string;
  description: string;
  platform: string;
  url: string;
  chipsExtracted: number;
  kills: number;
  arenaName: string;
  tags: string[];
  upvotes: number;
  featured: boolean;
  createdAt: string;
  player: { name: string; userTag: string; country: string; level: number };
  myUpvote: boolean;
}

interface ClipShowcaseProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

const PAGE_SIZE = 30;

export function ClipShowcase({ onToast, onInspectPlayer }: ClipShowcaseProps) {
  const { player } = useAuth();

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

  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    platform: 'YouTube' as string,
    chips: '',
    kills: '',
    arenaName: '',
    url: '',
  });

  /* ── Fetch clips ────────────────────────────────────────────────── */
  const fetchClips = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset;
      const isLoadMore = !reset && clips.length > 0;

      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentOffset) });
        if (myClipsOnly && player) params.set('player', player.userTag);

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
    [offset, clips.length, myClipsOnly, player],
  );

  /* ── Fetch featured ─────────────────────────────────────────────── */
  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch('/api/clips/featured');
      if (!res.ok) return;
      const data = await res.json();
      setFeatured(data.clip);
    } catch {
      // silently ignore featured fetch errors
    }
  }, []);

  useEffect(() => {
    if (!player) return;
    fetchClips(true);
    fetchFeatured();
  }, [myClipsOnly, player]);

  /* ── Reset list when filter changes ─────────────────────────────── */
  useEffect(() => {
    setClips([]);
    setOffset(0);
  }, [myClipsOnly]);

  /* ── Upvote ─────────────────────────────────────────────────────── */
  async function handleUpvote(clip: ClipItem) {
    if (clip.myUpvote) return;

    // Optimistic update
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
      notify(`Upvoted "${clip.title}"! 🔥`, 'success', onToast);
    } catch {
      // Revert on failure
      setClips((prev) =>
        prev.map((c) => (c.id === clip.id ? { ...c, upvotes: c.upvotes - 1, myUpvote: false } : c)),
      );
      if (featured?.id === clip.id) {
        setFeatured((f) => (f ? { ...f, upvotes: f.upvotes - 1, myUpvote: false } : f));
      }
      notify('Failed to upvote clip.', 'error', onToast);
    }
  }

  /* ── Inspect creator ─────────────────────────────────────────────── */
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

  /* ── Upload ─────────────────────────────────────────────────────── */
  async function handleUpload() {
    if (!uploadForm.title.trim() || !uploadForm.url.trim()) {
      notify('Clip Title and Video URL are required.', 'error', onToast);
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
      notify('Game Clip published to Esports Highlights feed! 🎬', 'success', onToast);
      setUploadForm({ title: '', description: '', platform: 'YouTube', chips: '', kills: '', arenaName: '', url: '' });
      setShowUpload(false);
      // Refetch
      setClips([]);
      setOffset(0);
      fetchClips(true);
      fetchFeatured();
    } catch (err: any) {
      notify(err.message || 'Failed to publish clip', 'error', onToast);
    } finally {
      setUploading(false);
    }
  }

  if (!player) return <NotSignedIn />;

  /* ── Helpers ─────────────────────────────────────────────────────── */
  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  }

  function PlatformIcon({ platform }: { platform: string }) {
    if (platform.toLowerCase() === 'youtube') return <Youtube className="w-3 h-3 text-red-500" />;
    if (platform.toLowerCase() === 'twitch') return <Twitch className="w-3 h-3 text-violet-400" />;
    return <Film className="w-3 h-3 text-slate-400" />;
  }

  const hasMore = clips.length < total;
  const featuredId = featured?.id;
  const displayClips = clips.filter((c) => c.id !== featuredId);

  return (
    <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-md p-5 sm:p-6 overflow-hidden">
      <GlowBlob color="bg-red-500/10" className="-top-12 -right-12 w-56 h-56" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight flex items-center gap-2.5">
            <Film className="w-5.5 h-5.5 text-red-400" />
            Esports Clip Showcase &amp; Highlights
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Watch community clutch extractions, vote on top plays of the week, and share your
            own YouTube &amp; Twitch clips!
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMyClipsOnly((v) => !v)}
            className={`px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 border ${myClipsOnly ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}`}
          >
            <Filter className="w-3.5 h-3.5" /> {myClipsOnly ? 'All Clips' : 'My Clips'}
          </button>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Share Game Clip
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && <PanelSkeleton count={6} height="h-72" />}

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
        <div className="text-center py-12">
          <Film className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No clips yet. Be the first to share your gameplay highlight!</p>
        </div>
      )}

      {/* Featured clip banner */}
      {!loading && featured && !myClipsOnly && (
        <div className="mb-5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-slate-950/80 to-red-500/10 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-widest">
              🔥 Featured Clip
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white leading-tight line-clamp-2 mb-2">{featured.title}</h3>
              <button
                type="button"
                onClick={() => handleInspectCreator(featured)}
                className="flex items-center gap-2 text-left hover:opacity-80 transition mb-2"
              >
                <span className="text-base" aria-hidden>{countryFlag(featured.player.country)}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{featured.player.name}</div>
                  <div className="text-[10px] font-mono text-slate-500">{featured.player.userTag} · {formatDate(featured.createdAt)}</div>
                </div>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleUpvote(featured)}
                  disabled={featured.myUpvote}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${featured.myUpvote ? 'bg-red-600 text-white cursor-default' : 'bg-slate-900 hover:bg-red-600/20 text-red-300 border border-red-500/30 hover:border-red-500/50'}`}
                >
                  <Flame className="w-3.5 h-3.5" /> {featured.upvotes.toLocaleString()}
                </button>
                <a
                  href={featured.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                >
                  Watch <ExternalLink className="w-3 h-3" />
                </a>
                {featured.chipsExtracted > 0 && (
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded">
                    💰 {featured.chipsExtracted.toLocaleString('en-IN')} c
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clips grid */}
      {!loading && displayClips.length > 0 && (
        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayClips.map((clip) => (
            <div key={clip.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md overflow-hidden flex flex-col">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-slate-950 to-red-950/30 flex items-center justify-center border-b border-slate-800">
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="text-[9px] font-mono font-bold bg-slate-950/80 border border-slate-800 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                    <PlatformIcon platform={clip.platform} />
                    {clip.platform}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded">
                    💰 {clip.chipsExtracted.toLocaleString('en-IN')} c Extracted
                  </span>
                </div>
                <div className="text-center px-3">
                  <div className="text-3xl mb-1" aria-hidden>
                    {clip.platform.toLowerCase() === 'youtube' ? '▶️' : '🎮'}
                  </div>
                  <p className="text-[10px] font-mono text-slate-500">CLICK TO PLAY</p>
                </div>
              </div>

              {/* Body */}
              <div className="p-3 flex flex-col gap-2 flex-1">
                <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{clip.title}</h3>

                <button
                  type="button"
                  onClick={() => handleInspectCreator(clip)}
                  className="flex items-center gap-2 text-left hover:opacity-80 transition"
                >
                  <span className="text-base" aria-hidden>{countryFlag(clip.player.country)}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{clip.player.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {clip.player.userTag} · {formatDate(clip.createdAt)}
                    </div>
                  </div>
                </button>

                <div className="flex flex-wrap gap-1">
                  {clip.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono text-red-300 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full"
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleUpvote(clip)}
                    disabled={clip.myUpvote}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${clip.myUpvote ? 'bg-red-600 text-white cursor-default' : 'bg-slate-900 hover:bg-red-600/20 text-red-300 border border-red-500/30 hover:border-red-500/50'}`}
                  >
                    <Flame className="w-3.5 h-3.5" /> {clip.upvotes.toLocaleString()}
                  </button>
                  <a
                    href={clip.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    Watch <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {!loading && hasMore && (
        <div className="flex justify-center mt-5">
          <button
            type="button"
            onClick={() => fetchClips(false)}
            disabled={loadingMore}
            className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? 'Loading...' : 'Load More Clips'}
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-red-400" /> Share Game Clip to Community Feed
              </h3>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
                  placeholder="Brief description of the clip..."
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
                  placeholder="https://youtube.com/watch?v=..."
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
                  Publish Clip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClipShowcase;
