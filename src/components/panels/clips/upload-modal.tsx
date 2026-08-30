'use client';

import { X, Send, Clock, Loader2 } from 'lucide-react';
import { MicroLabel } from '../_panel-primitives';

// ── Upload Modal ──

export function UploadModal({ uploadForm, setUploadForm, uploading, onUpload, onClose }: {
  uploadForm: { title: string; description: string; platform: string; chips: string; kills: string; arenaName: string; url: string };
  setUploadForm: React.Dispatch<React.SetStateAction<typeof uploadForm>>;
  uploading: boolean;
  onUpload: () => void;
  onClose: () => void;
}) {
  // Auto-detect YouTube Shorts from URL
  function handleUrlChange(url: string) {
    setUploadForm((f) => {
      let platform = f.platform;
      if (url.includes('/shorts/')) {
        platform = 'YouTube Shorts';
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        platform = 'YouTube';
      } else if (url.includes('instagram.com')) {
        platform = 'Instagram';
      }
      return { ...f, url, platform };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 z-10 flex items-center justify-between p-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-black text-white flex items-center gap-2"><Send className="w-5 h-5 text-red-400" /> Share Your Clip</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* How it works */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3">
            <p className="text-[11px] font-bold text-slate-300 mb-2">How to share your clip:</p>
            <ol className="text-[10px] text-slate-400 space-y-1 list-decimal list-inside">
              <li>Record your Venom Arena gameplay (phone screen record, OBS, etc.)</li>
              <li>Upload to <span className="text-red-400 font-bold">YouTube</span>, <span className="text-red-400 font-bold">YouTube Shorts</span>, or <span className="text-pink-400 font-bold">Instagram Reels</span></li>
              <li>Paste the video link below with a descriptive title</li>
              <li>Your clip appears after <span className="text-amber-400 font-bold">admin review</span></li>
            </ol>
          </div>

          {/* Guidelines */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[10px] font-bold text-emerald-400 mb-1.5">✅ What to share:</p>
            <div className="text-[9px] text-slate-400 space-y-0.5">
              <p>• Venom Arena gameplay — extractions, clutch plays, multi-kills</p>
              <p>• Arena strategies, snake builds, tournament highlights</p>
              <p>• <span className="text-slate-500">Good examples:</span> <span className="text-slate-300">&quot;INSANE 1v2 Extraction in Neon Grid!&quot; / &quot;5-Kill Streak Scrap Alley Run&quot;</span></p>
            </div>
            <p className="text-[10px] font-bold text-red-400 mt-2 mb-1.5">🚫 Do NOT share:</p>
            <div className="text-[9px] text-slate-400 space-y-0.5">
              <p>• Obscene, abusive, or discriminatory content</p>
              <p>• Non-gameplay content (unrelated videos, spam)</p>
              <p>• Clickbait titles that don't match the clip</p>
              <p>• Personal information of other players</p>
            </div>
          </div>

          {/* Title */}
          <div>
            <MicroLabel>Clip Title <span className="text-slate-600">(5-120 chars)</span></MicroLabel>
            <input type="text" value={uploadForm.title} onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))} maxLength={120} placeholder='e.g. "INSANE 1V2 EXTRACTION CLUTCH!"' className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50" />
            <div className="text-right mt-0.5"><span className={`text-[9px] font-mono ${uploadForm.title.length < 5 ? 'text-red-400' : 'text-slate-600'}`}>{uploadForm.title.length}/120</span></div>
          </div>

          {/* Description */}
          <div>
            <MicroLabel>Description <span className="text-slate-600">(optional, max 300)</span></MicroLabel>
            <input type="text" value={uploadForm.description} onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))} maxLength={300} placeholder="e.g. Down to 10 HP, grabbed extraction with 2 snakes chasing..." className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50" />
          </div>

          {/* Platform + Chips */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <MicroLabel>Platform</MicroLabel>
              <select value={uploadForm.platform} onChange={(e) => setUploadForm((f) => ({ ...f, platform: e.target.value }))} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50">
                <option value="YouTube">YouTube Video</option>
                <option value="YouTube Shorts">YouTube Shorts</option>
                <option value="Instagram">Instagram Reels</option>
              </select>
            </div>
            <div>
              <MicroLabel>Chips Extracted</MicroLabel>
              <input type="number" value={uploadForm.chips} onChange={(e) => setUploadForm((f) => ({ ...f, chips: e.target.value }))} placeholder="e.g. 2500000" className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500/50" />
            </div>
          </div>

          {/* Kills + Arena */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <MicroLabel>Kills</MicroLabel>
              <input type="number" value={uploadForm.kills} onChange={(e) => setUploadForm((f) => ({ ...f, kills: e.target.value }))} placeholder="e.g. 5" className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500/50" />
            </div>
            <div>
              <MicroLabel>Arena Name</MicroLabel>
              <input type="text" value={uploadForm.arenaName} onChange={(e) => setUploadForm((f) => ({ ...f, arenaName: e.target.value }))} placeholder="e.g. Scrap Alley" className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50" />
            </div>
          </div>

          {/* URL */}
          <div>
            <MicroLabel>Video URL <span className="text-red-400">*</span> <span className="text-slate-600">(auto-detects platform)</span></MicroLabel>
            <input type="url" value={uploadForm.url} onChange={(e) => handleUrlChange(e.target.value)} placeholder="https://youtube.com/watch?v=... or https://instagram.com/reel/..." className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500/50" />
          </div>

          {/* Review notice */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-950/60 rounded-lg px-3 py-2 border border-slate-800/60">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>All clips are reviewed before appearing publicly. Prohibited content will be rejected.</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition">Cancel</button>
            <button type="button" onClick={onUpload} disabled={uploading} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50">
              {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Submit for Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
