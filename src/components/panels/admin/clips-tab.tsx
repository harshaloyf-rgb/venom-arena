'use client';

import { useState, useEffect } from 'react';
import { timeAgo } from '@/lib/date-utils';
import type { ToastFn } from '../_panel-primitives';
import {
  Film,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Star,
  Youtube,
  Instagram,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

// ── Types ──

interface AdminClip {
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
  matchData: any;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  player: { name: string; userTag: string; country: string; level: number };
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

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg: Record<string, { color: string; label: string }> = {
    pending: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', label: 'Pending' },
    approved: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', label: 'Approved' },
    rejected: { color: 'text-red-400 bg-red-500/10 border-red-500/30', label: 'Rejected' },
  };
  const c = cfg[status] || cfg.pending;
  return <span className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded ${c.color} ${size === 'md' ? 'text-[10px] lg:text-[11px]' : 'text-[8px] lg:text-[11px]'}`}>{c.label}</span>;
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/80 border border-slate-800/60 px-3 py-2.5 lg:px-2 lg:py-1.5">
      <p className="text-[10px] lg:text-[11px] text-slate-600 font-bold uppercase">{label}</p>
      <p className="text-sm lg:text-[11px] text-white font-medium mt-0.5">{value}</p>
    </div>
  );
}

// ── Clips Moderation Tab ──

export function ClipsTab({ onToast }: { onToast?: ToastFn }) {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [clips, setClips] = useState<AdminClip[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function fetchClips() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clips/admin?status=${tab}&limit=50`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClips(data.clips);
      setCounts(data.counts);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchClips(); }, [tab]);

  async function handleAction(clipId: string, action: 'approve' | 'reject' | 'feature' | 'unfeature') {
    setActing(clipId);
    try {
      const res = await fetch('/api/clips/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId, action }),
      });
      if (!res.ok) throw new Error();
      if (action === 'feature' || action === 'unfeature') {
        const isFeatured = action === 'feature';
        setClips((prev) => prev.map((c) => c.id === clipId ? { ...c, featured: isFeatured } : c));
        onToast?.(isFeatured ? '⭐ Clip featured!' : 'Clip unfeatured.', isFeatured ? 'success' : 'info');
      } else {
        setClips((prev) => prev.map((c) => c.id === clipId ? { ...c, status: action === 'approve' ? 'approved' : 'rejected', reviewedAt: new Date().toISOString() } : c));
        setCounts((prev) => ({
          ...prev,
          pending: prev.pending + (action === 'approve' ? -1 : 0),
          [action === 'approve' ? 'approved' : 'rejected']: prev[action === 'approve' ? 'approved' : 'rejected'] + 1,
        }));
        onToast?.(action === 'approve' ? '✅ Clip approved.' : '❌ Clip rejected.', action === 'approve' ? 'success' : 'error');
        if (selectedId === clipId) setSelectedId(null);
      }
    } catch {
      onToast?.('Action failed.', 'error');
    }
    setActing(null);
  }

  async function handleBulkAction(action: 'approve' | 'reject') {
    const ids = clips.filter((c) => c.status === 'pending').map((c) => c.id);
    if (ids.length === 0) return;
    setActing('bulk');
    try {
      const res = await fetch('/api/clips/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipIds: ids, action }),
      });
      if (!res.ok) throw new Error();
      onToast?.(`${action === 'approve' ? 'Approved' : 'Rejected'} ${ids.length} clips.`, action === 'approve' ? 'success' : 'error');
      fetchClips();
    } catch {
      onToast?.('Bulk action failed.', 'error');
    }
    setActing(null);
  }

  const selected = clips.find((c) => c.id === selectedId);
  const pendingInList = clips.filter((c) => c.status === 'pending').length;

  return (
    <div className="space-y-4 lg:space-y-1">
      {/* Section header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-1">
          <div className="flex h-10 w-10 lg:h-6 lg:w-6 items-center justify-center rounded-lg bg-red-500/10">
            <ShieldCheck className="h-5 w-5 lg:h-3.5 lg:w-3.5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base lg:text-[11px] font-bold text-slate-100">Clip Moderation</h3>
            <p className="text-xs lg:text-[11px] text-slate-500">Review and manage user-submitted highlights</p>
          </div>
        </div>
        {counts.pending > 0 && (
          <span className="px-3 py-1 lg:px-1.5 lg:py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs lg:text-[11px] font-bold animate-pulse">
            {counts.pending} pending
          </span>
        )}
      </div>

      {/* Status filter tabs + bulk actions */}
      <div className="flex items-center gap-1.5 lg:gap-0.5 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setTab(t); setSelectedId(null); }}
            className={`px-3 py-1.5 lg:px-2 lg:py-1 rounded-lg text-xs lg:text-[11px] font-bold uppercase tracking-wider transition border ${tab === t ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
          >
            {t} <span className="ml-1 text-[10px] lg:text-[11px] opacity-70">{counts[t as keyof typeof counts] ?? 0}</span>
          </button>
        ))}
        {tab === 'pending' && pendingInList > 1 && (
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => handleBulkAction('approve')} disabled={acting === 'bulk'} className="px-3 py-1.5 lg:px-2 lg:py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs lg:text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 disabled:opacity-50">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve All
            </button>
            <button type="button" onClick={() => handleBulkAction('reject')} disabled={acting === 'bulk'} className="px-3 py-1.5 lg:px-2 lg:py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs lg:text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 disabled:opacity-50">
              <XCircle className="w-3.5 h-3.5" /> Reject All
            </button>
          </div>
        )}
      </div>

      {/* Split panel: list + detail */}
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden min-h-[420px] lg:min-h-0">
        {/* Clip List */}
        <div className="w-full sm:w-2/5 border-r border-slate-800/60 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : clips.length === 0 ? (
            <div className="text-center py-16 px-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No {tab === 'all' ? '' : tab} clips</p>
              <p className="text-xs text-slate-600 mt-1">All clear! {tab === 'pending' ? 'No clips waiting for review.' : ''}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/40">
              {clips.map((clip) => (
                <button key={clip.id} type="button" onClick={() => setSelectedId(clip.id)} className={`w-full text-left px-4 py-3 lg:px-2 lg:py-1.5 hover:bg-slate-800/40 transition ${selectedId === clip.id ? 'bg-slate-800/60 border-l-2 border-emerald-500' : ''}`}>
                  <div className="flex items-start gap-3 lg:gap-1.5">
                    {clip.thumbnailUrl ? (
                      <img src={clip.thumbnailUrl} alt="" className="w-16 h-11 lg:w-12 lg:h-8 rounded-lg object-cover shrink-0 bg-slate-950" />
                    ) : (
                      <div className="w-16 h-11 rounded-lg bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center"><Film className="w-4 h-4 text-slate-700" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm lg:text-[11px] font-bold text-white leading-tight flex items-center gap-2">
                        {clip.title}
                        {clip.featured && <span className="inline-flex items-center gap-0.5 text-[9px] lg:text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">★ Featured</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs lg:text-[11px] text-slate-500">{clip.player.name}</span>
                        <StatusBadge status={clip.status} />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clip Detail */}
        <div className="hidden lg:flex flex-1 flex-col min-w-0">
          {selected ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-2 space-y-5 lg:space-y-2">
              {/* Preview */}
              {selected.cardType === 'match-card' ? (
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-5 lg:p-2 text-center">
                  <span className="text-xs lg:text-[11px] font-mono text-red-400 font-bold uppercase tracking-widest">Match Card (auto-generated)</span>
                  <p className="text-base lg:text-[11px] font-bold text-white mt-2">{selected.title}</p>
                </div>
              ) : (
                <a href={selected.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-slate-800 group/prev">
                  {selected.thumbnailUrl ? (
                    <img src={selected.thumbnailUrl} alt={selected.title} className="w-full aspect-video object-cover transition group-hover/prev:opacity-80" />
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-slate-900 via-slate-950 to-red-950/20 flex items-center justify-center">
                      <PlatformIcon platform={selected.platform.toLowerCase()} size="lg" />
                    </div>
                  )}
                </a>
              )}

              {/* Info */}
              <div>
                <h4 className="text-base lg:text-[11px] font-bold text-white">{selected.title}</h4>
                {selected.description && <p className="text-sm lg:text-[11px] text-slate-400 mt-1">{selected.description}</p>}
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 lg:gap-1">
                <MetaItem label="Player" value={`${selected.player.name} (${selected.player.userTag})`} />
                <MetaItem label="Platform" value={selected.platform} />
                {selected.arenaName && <MetaItem label="Arena" value={selected.arenaName} />}
                {selected.chipsExtracted > 0 && <MetaItem label="Chips" value={selected.chipsExtracted.toLocaleString('en-IN')} />}
                {selected.kills > 0 && <MetaItem label="Kills" value={String(selected.kills)} />}
                <MetaItem label="Submitted" value={timeAgo(selected.createdAt)} />
                {selected.reviewedAt && <MetaItem label="Reviewed" value={timeAgo(selected.reviewedAt)} />}
              </div>

              {/* URL */}
              {selected.url && (
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 lg:p-2">
                  <p className="text-[10px] lg:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Video URL</p>
                  <a href={selected.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-red-400 hover:text-red-300 break-all transition">{selected.url}</a>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 lg:gap-1 pt-4 lg:pt-1 border-t border-slate-800">
                {selected.status === 'pending' ? (
                  <>
                    <button type="button" onClick={() => handleAction(selected.id, 'approve')} disabled={acting === selected.id} className="flex-1 py-3 lg:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm lg:text-[11px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-50">
                      {acting === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
                    </button>
                    <button type="button" onClick={() => handleAction(selected.id, 'reject')} disabled={acting === selected.id} className="flex-1 py-3 lg:py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm lg:text-[11px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-50">
                      {acting === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Reject
                    </button>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-between py-3 lg:py-1.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={selected.status} size="md" />
                      <span className="text-xs lg:text-[11px] text-slate-500">{selected.reviewedAt ? `Reviewed ${timeAgo(selected.reviewedAt)}` : ''}</span>
                    </div>
                    {selected.status === 'approved' && (
                      <button type="button" onClick={() => handleAction(selected.id, selected.featured ? 'unfeature' : 'feature')} disabled={acting === selected.id} className={`px-4 py-2.5 lg:px-2 lg:py-1 rounded-xl text-xs lg:text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 disabled:opacity-50 border ${selected.featured ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/50'}`}>
                        {acting === selected.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className={`w-4 h-4 ${selected.featured ? 'fill-amber-400' : ''}`} />} {selected.featured ? 'Unfeature' : 'Feature'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-8">
                <Eye className="w-12 h-12 lg:w-8 lg:h-8 text-slate-700 mx-auto mb-4" />
                <p className="text-sm lg:text-[11px] text-slate-500">Select a clip to review</p>
                <p className="text-xs lg:text-[11px] text-slate-600 mt-1">Click any clip on the left to see its preview, details, and approve or reject it.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
