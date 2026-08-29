'use client';

import { useRef, useState } from 'react';
import {
  Check,
  Compass,
  Copy,
  Download,
  Film,
  Loader2,
  Share2,
  Skull,
  Swords,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { renderMatchCard, downloadBlob, shareBlob, copyBlobToClipboard, type MatchCardData } from '@/lib/share-card';
import { OnlineReplayPlayer } from './online-replay-player';
import ReplayPlayer from './replay-player';
import type { EndScreenState } from './game-canvas';

// ---------------------------------------------------------------------------
// EndOverlay sub-component (death or extract) — matches AUDIT-A Sections B+C
// ---------------------------------------------------------------------------

interface EndOverlayProps {
  endScreen: EndScreenState;
  arena: { name: string; buyIn: number };
  isOffline: boolean;
  previousLevel: number;
  previousBankedChips: number;
  player: { name: string; userTag: string; country: string; level: number; clanTag?: string | null };
  onPlayAgain: () => void;
  onExit: () => void;
  onAddRival: () => void;
  onAddFriend: () => void;
  onViewProfile: () => void;
}

function EndOverlay({
  endScreen,
  arena,
  isOffline,
  previousLevel,
  previousBankedChips,
  player,
  onPlayAgain,
  onExit,
  onAddRival,
  onAddFriend,
  onViewProfile,
}: EndOverlayProps) {

  // Share card state
  const { toast } = useToast();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const shareBlobRef = useRef<Blob | null>(null);

  async function handleGenerateShareCard() {
    setShareLoading(true);
    try {
      const data: MatchCardData = {
        playerName: player.name,
        userTag: player.userTag,
        country: player.country,
        level: player.level,
        clanTag: player.clanTag || null,
        arenaName: arena.name,
        outcome: isExtract ? 'extract' : 'death',
        chipsEarned: isExtract ? (result?.bankedAmount ?? carriedChips) : 0,
        chipsLost: isExtract ? 0 : carriedChips,
        kills: result?.kills ?? 0,
        snakeLength: score,
        durationSec: durationSeconds,
        isOnline: !isOffline,
      };
      const blob = await renderMatchCard(data);
      shareBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setSharePreview(url);
      setShareModalOpen(true);
    } catch (e) {
      console.error('[share-card] render error', e);
      toast({ title: 'Share Card Error', description: 'Failed to generate highlight card.', variant: 'destructive' });
    } finally {
      setShareLoading(false);
    }
  }

  async function handleDownload() {
    if (!shareBlobRef.current) return;
    const outcome = isExtract ? 'extraction' : 'elimination';
    downloadBlob(shareBlobRef.current, `venom-arena-${outcome}-${Date.now()}.png`);
  }

  async function handleShare() {
    if (!shareBlobRef.current) return;
    const result = await shareBlob(shareBlobRef.current, `Venom Arena ${isExtract ? 'Extraction' : 'Match'} Highlight`);
    if (result.method === 'cancelled') return;
    if (result.method === 'not-supported') {
      // Fallback: copy to clipboard
      const ok = await copyBlobToClipboard(shareBlobRef.current);
      if (ok) {
        setShareCopied(true);
        toast({ title: 'Copied to Clipboard!', description: 'Image copied. Paste it anywhere to share.' });
        setTimeout(() => setShareCopied(false), 3000);
      } else {
        toast({ title: 'Share not available', description: 'Use the Download button to save the image.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Shared!', description: 'Highlight shared successfully! 🎬' });
    }
  }

  async function handleCopy() {
    if (!shareBlobRef.current) return;
    const ok = await copyBlobToClipboard(shareBlobRef.current);
    if (ok) {
      setShareCopied(true);
      toast({ title: 'Copied!', description: 'Image copied to clipboard. Paste it anywhere! 📋' });
      setTimeout(() => setShareCopied(false), 3000);
    } else {
      toast({ title: 'Copy failed', description: 'Your browser does not support clipboard image copy. Try Download instead.', variant: 'destructive' });
    }
  }
  const { outcome, killer, result, durationSeconds, carriedChips, score, replayFrames, replayMyId, replayDeathFrameIdx } = endScreen;
  const isExtract = outcome === 'extract';
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const snakeLength = score;
  const kills = result?.kills ?? 0;
  const leveledUp = result && result.newLevel > previousLevel;

  // Replay toggle (death only)
  const [showReplay, setShowReplay] = useState(false);
  const hasReplay = !isExtract && replayFrames && replayFrames.length > 10;

  // Online extract: banked chips after graduated commission (0% if <=3 players, 35% if >=4).
  // The server computes the actual commission and reports it in result.commission.
  const commission = result?.commission ?? 0;
  const bankedAmount = result?.bankedAmount ?? (isExtract && !isOffline ? carriedChips : 0);
  const finalBankedChips = result?.newBankedChips ?? previousBankedChips;

  // Title logic — AUDIT-A Section C
  const extractTitle = isOffline
    ? 'Practice Run Completed!'
    : carriedChips > 0
      ? 'Extraction Completed!'
      : 'Secure Extraction!';

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={isExtract ? 'Extraction successful' : 'You died'}
    >
      <div className="w-[min(94vw,520px)] rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Top accent bar */}
        <div
          className={`h-1.5 w-full rounded-t-2xl ${
            isExtract
              ? 'bg-gradient-to-r from-yellow-500 to-amber-500'
              : 'bg-red-600'
          }`}
        />

        <div className="p-6">
          {/* Icon */}
          <div
            className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border ${
              isExtract
                ? 'border-yellow-500/20 bg-yellow-500/10'
                : 'border-red-500/20 bg-red-500/10'
            }`}
          >
            {isExtract ? (
              <Compass className={`h-9 w-9 text-yellow-400 ${extractTitle === 'Practice Run Completed!' ? '' : 'animate-spin'}`} style={{ animationDuration: '6s' }} />
            ) : (
              <Skull className="h-9 w-9 text-red-500" />
            )}
          </div>

          {/* Title */}
          <h3 className="text-center text-2xl font-bold text-white">
            {isExtract ? extractTitle : 'Arena Disintegration!'}
          </h3>

          {/* Subtitle */}
          {isExtract ? (
            <p className="mt-1 text-center text-xs text-slate-400">
              {isOffline
                ? `Practice run finished! You eliminated ${kills} training bots, reached a max size of ${snakeLength}, and survived for ${mins}m ${secs}s.`
                : carriedChips > 0
                  ? `Tactical extraction successful! You secured ${carriedChips.toLocaleString()} star chips, eliminated ${kills} rivals, reached a max size of ${snakeLength}, and survived for ${mins}m ${secs}s.`
                  : `Tactical extraction successful! You exited safely after surviving for ${mins}m ${secs}s, eliminating ${kills} rivals, with a final snake size of ${snakeLength}.`}
            </p>
          ) : (
            <p className="mt-1 text-center text-xs text-slate-400">
              {isOffline
                ? 'Offline Training — No chips lost.'
                : 'Your snake head collided with a rival. All unbanked carried chips were lost in-match.'}
            </p>
          )}

          {/* Death stats panel — AUDIT-A Section B */}
          {!isExtract && !isOffline && (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Stakes Buy-In Cost:</span>
                <span className="text-red-400">-{arena.buyIn.toLocaleString()} chips</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-400">Match Carried Value Forfeited:</span>
                <span className="text-slate-500">-{carriedChips.toLocaleString()} c</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-400">Opponents Eliminated:</span>
                <span className="text-white">{kills} Kills</span>
              </div>
            </div>
          )}
          {!isExtract && isOffline && (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Opponents Eliminated:</span>
                <span className="text-white">{kills} Kills</span>
              </div>
            </div>
          )}

          {/* Killer card (death only) — AUDIT-A Section B */}
          {!isExtract && killer && (
            <div className="mt-3 rounded-lg border border-rose-900/50 bg-slate-900/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-rose-400 font-mono">
                <Skull className="h-3 w-3" />
                <span>Collided With / Eliminated By</span>
              </div>
              {killer.tag && (
                <div className="mt-1 inline-block rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                  {killer.tag}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: killer.color ?? '#f43f5e' }}
                >
                  {killer.name ? killer.name.substring(0, 2).toUpperCase() : '??'}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{killer.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {killer.isBot === false ? 'Online Rival Player' : 'Arena AI Combatant'}
                  </div>
                </div>
              </div>
              {/* Social buttons: only for real players (not bots) */}
              {killer.isBot === false && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={onViewProfile}
                    className="flex items-center gap-1 rounded-md bg-slate-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-600"
                  >
                    <User className="h-3 w-3" /> View Profile
                  </button>
                  <button
                    type="button"
                    onClick={onAddRival}
                    className="flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700"
                  >
                    <Swords className="h-3 w-3" /> Add Rival
                  </button>
                  <button
                    type="button"
                    onClick={onAddFriend}
                    className="flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-700"
                  >
                    <UserPlus className="h-3 w-3" /> Add Friend
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Replay viewer (death only) */}
          {hasReplay && !showReplay && (
            <button
              type="button"
              onClick={() => setShowReplay(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 py-2.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
            >
              📺 Watch Death Replay
            </button>
          )}
          {hasReplay && showReplay && (
            <div className="mt-3">
              {!isOffline ? (
                // Online mode: use the new full-screen OnlineReplayPlayer
                <OnlineReplayPlayer
                  replay={{
                    frames: replayFrames!.map(s => ({
                      snakes: s.snakes,
                      foods: s.foods,
                      worldSize: s.worldSize,
                      mapRadius: s.mapRadius,
                      mapCenterX: s.mapCenterX,
                      mapCenterY: s.mapCenterY,
                    })),
                    deathFrameIdx: replayDeathFrameIdx ?? 0,
                    myId: replayMyId ?? '',
                    worldSize: replayFrames![0]?.worldSize ?? 8000,
                    mapRadius: replayFrames![0]?.mapRadius ?? 3800,
                    mapCenterX: replayFrames![0]?.mapCenterX ?? 0,
                    mapCenterY: replayFrames![0]?.mapCenterY ?? 0,
                  }}
                  onClose={() => setShowReplay(false)}
                />
              ) : (
                // Offline mode: use the existing embedded ReplayPlayer
                <ReplayPlayer
                  frames={replayFrames!}
                  myId={replayMyId ?? ''}
                  deathFrameIdx={replayDeathFrameIdx}
                  onClose={() => setShowReplay(false)}
                />
              )}
              {!isOffline && (
                <button
                  type="button"
                  onClick={() => setShowReplay(false)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-slate-800 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Hide Replay
                </button>
              )}
            </div>
          )}

          {/* Extract performance stats — AUDIT-A Section C */}
          {isExtract && (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Kills</div>
                  <div className="text-lg font-bold text-rose-400">{kills}</div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Max Length</div>
                  <div className="text-lg font-bold text-indigo-400">{snakeLength}</div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Survival Time</div>
                  <div className="text-lg font-bold text-sky-400">{durationStr}</div>
                </div>
              </div>

              {/* Online results table — AUDIT-A Section C */}
              {!isOffline && (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Carried Value:</span>
                    <span className="text-white">{carriedChips.toLocaleString()} chips</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-slate-400">System Commission{commission > 0 ? ` (${Math.round((commission / Math.max(1, carriedChips)) * 100)}%)` : ' (0% — Low Density)'}:</span>
                    <span className="text-yellow-500">-{commission.toLocaleString()} chips</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-slate-300">BANKED TO ACCOUNT:</span>
                    <span className="font-bold text-emerald-400">+{bankedAmount.toLocaleString()} c</span>
                  </div>
                </div>
              )}

              {/* Offline results — AUDIT-A Section C */}
              {isOffline && (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
                  <div className="text-xs font-mono uppercase tracking-wider text-amber-400/95">
                    Offline Training Complete
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    No buy-in or banking fees. Great job sharpening your skills and maneuvers!
                  </div>
                </div>
              )}

              {/* Pass XP + Tier info */}
              {result && result.passXpGained > 0 && (
                <div className="mt-2 rounded-lg border border-pink-500/20 bg-pink-500/5 p-3 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-pink-400">Pass XP Earned:</span>
                    <span className="font-semibold text-pink-300">+{result.passXpGained.toLocaleString()} XP</span>
                  </div>
                  {result.newPassTier > 0 && (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-pink-400">Pass Tier:</span>
                      <span className="font-semibold text-white">
                        {result.newPassTier}/20
                        {leveledUp ? '' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Final banked chips + level (if server reported) */}
              {result && (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Banked:</span>
                    <span className="font-semibold text-amber-300">{finalBankedChips.toLocaleString()}c</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-slate-400">Level:</span>
                    <span className="font-semibold text-white">
                      {result.newLevel}
                      {leveledUp && (
                        <span className="ml-1 rounded bg-emerald-500/20 px-1 text-emerald-300">
                          ↑ Level Up!
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {!result && (
            <p className="mt-3 text-center text-xs text-slate-400">
              Final tally pending from server…
            </p>
          )}

          {/* Share Highlight button — MARKETING: every match = potential social post */}
          <button
            type="button"
            onClick={handleGenerateShareCard}
            disabled={shareLoading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-bold text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            {shareLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
            {shareLoading ? 'Generating Card…' : '🎬 Share Highlight Card'}
          </button>

          {/* Action buttons — AUDIT-A Sections B+C */}
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              id={isExtract ? 'btn-success-play-again' : 'btn-defeat-play-again'}
              onClick={onPlayAgain}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.98] ${
                isExtract
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-gradient-to-r from-red-600 to-rose-600'
              }`}
            >
              <Compass className="h-4 w-4" /> PLAY AGAIN
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
            >
              📺 Watch Video (Get +50 Chips)
            </button>
            <button
              type="button"
              id={isExtract ? 'btn-success-close' : 'btn-defeat-close'}
              onClick={onExit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              {isExtract
                ? (isOffline ? 'RETURN TO LOBBY' : 'SECURE CHIPS & RETURN TO LOBBY')
                : 'RETURN TO LOBBY'}
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] text-slate-500">
            Press ESC to exit
          </p>
        </div>
      </div>

      {/* Share Card Modal */}
      {shareModalOpen && sharePreview && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-5">
            <button
              type="button"
              onClick={() => { setShareModalOpen(false); if (sharePreview) URL.revokeObjectURL(sharePreview); setSharePreview(null); }}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Film className="h-5 w-5 text-red-400" /> Your Match Highlight Card
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">Share on Instagram, WhatsApp, Twitter, or anywhere to flex your gameplay!</p>
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <img src={sharePreview} alt="Match Highlight Card" className="w-full h-auto" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-bold text-white transition"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={shareCopied}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${shareCopied ? 'bg-emerald-900 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'}`}
              >
                {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {shareCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EndOverlay;
