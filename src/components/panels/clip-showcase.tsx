'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  SAMPLE_CLIPS,
  countryFlag,
  type ShowcaseClip,
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
  Film,
  Plus,
  Flame,
  ExternalLink,
  X,
  Youtube,
  Twitch,
} from 'lucide-react';

interface ClipShowcaseProps {
  onToast?: ToastFn;
  onInspectPlayer?: (p: InspectedPlayer) => void;
}

export function ClipShowcase({ onToast, onInspectPlayer }: ClipShowcaseProps) {
  const { player } = useAuth();
  const [clips, setClips] = useState<ShowcaseClip[]>(SAMPLE_CLIPS);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    platform: 'YouTube' as 'YouTube' | 'Twitch',
    chips: '',
    url: '',
  });

  if (!player) return <NotSignedIn />;

  function handleUpvote(clip: ShowcaseClip) {
    if (upvoted.has(clip.id)) return;
    setUpvoted((prev) => new Set(prev).add(clip.id));
    setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, upvotes: c.upvotes + 1 } : c)));
    notify(`Upvoted "${clip.title}"! 🔥`, 'success', onToast);
  }

  function handleInspectCreator(clip: ShowcaseClip) {
    if (!onInspectPlayer) return;
    onInspectPlayer({
      name: clip.creator,
      userTag: clip.tag,
      country: clip.country,
      flag: countryFlag(clip.country),
      bankedChips: clip.extractedChips,
      level: 50,
      clanTag: 'APEX',
      clanName: 'Viper Apex Syndicate',
    });
  }

  function handleUpload() {
    if (!uploadForm.title.trim() || !uploadForm.url.trim()) {
      notify('Clip Title and Video URL are required.', 'error', onToast);
      return;
    }
    const newClip: ShowcaseClip = {
      id: `clip-${Date.now()}`,
      title: uploadForm.title,
      creator: player.name,
      tag: `#${player.userTag}`,
      country: player.country,
      platform: uploadForm.platform,
      url: uploadForm.url,
      extractedChips: parseInt(uploadForm.chips, 10) || 0,
      upvotes: 0,
      dateStr: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      tags: ['Community'],
    };
    setClips((prev) => [newClip, ...prev]);
    notify('Game Clip published to Esports Highlights feed! 🎬', 'success', onToast);
    setUploadForm({ title: '', platform: 'YouTube', chips: '', url: '' });
    setShowUpload(false);
  }

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
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Share Game Clip
        </button>
      </div>

      {/* Clips grid */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clips.map((clip) => (
          <div key={clip.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-md overflow-hidden flex flex-col">
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-slate-950 to-red-950/30 flex items-center justify-center border-b border-slate-800">
              <div className="absolute top-2 left-2 flex items-center gap-1">
                <span className="text-[9px] font-mono font-bold bg-slate-950/80 border border-slate-800 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                  {clip.platform === 'YouTube' ? <Youtube className="w-3 h-3 text-red-500" /> : <Twitch className="w-3 h-3 text-violet-400" />}
                  {clip.platform}
                </span>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded">
                  💰 {clip.extractedChips.toLocaleString('en-IN')} c Extracted
                </span>
              </div>
              <div className="text-center px-3">
                <div className="text-3xl mb-1" aria-hidden>{clip.platform === 'YouTube' ? '▶️' : '🎮'}</div>
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
                <span className="text-base" aria-hidden>{countryFlag(clip.country)}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{clip.creator}</div>
                  <div className="text-[10px] font-mono text-slate-500">{clip.tag} · {clip.dateStr}</div>
                </div>
              </button>

              <div className="flex flex-wrap gap-1">
                {clip.tags.map((t) => (
                  <span key={t} className="text-[9px] font-mono text-red-300 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                    #{t}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleUpvote(clip)}
                  disabled={upvoted.has(clip.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${upvoted.has(clip.id) ? 'bg-red-600 text-white cursor-default' : 'bg-slate-900 hover:bg-red-600/20 text-red-300 border border-red-500/30 hover:border-red-500/50'}`}
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
                <MicroLabel>Platform</MicroLabel>
                <select
                  value={uploadForm.platform}
                  onChange={(e) => setUploadForm((f) => ({ ...f, platform: e.target.value as 'YouTube' | 'Twitch' }))}
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
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition"
                >
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
