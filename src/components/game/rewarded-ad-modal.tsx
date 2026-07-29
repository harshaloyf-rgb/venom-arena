'use client';

/**
 * RewardedAdModal — fullscreen overlay simulating a rewarded video ad.
 *
 * Flow:
 *  1. Modal opens with a 5-second countdown (simulating ad playback).
 *  2. During countdown, the user cannot skip (disabled state).
 *  3. After countdown, a "Claim +50 Chips" button appears.
 *  4. Clicking it calls POST /api/player/video-reward and credits chips.
 *  5. On success, shows a confirmation toast and auto-closes.
 *  6. On cooldown (429), shows "Ad on cooldown" message.
 *
 * The ad content area is a placeholder — in production, a real ad SDK
 * (Google AdMob, Unity Ads, ironSource, etc.) would render here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Tv, X, Gift, CheckCircle, Clock } from 'lucide-react';

interface RewardedAdModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful reward so the parent can refresh state */
  onRewardClaimed?: (chipsGranted: number) => void;
  /** Optional toast function — if not provided, uses default inline feedback */
  onToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AD_DURATION_SECONDS = 5;
const REWARD_AMOUNT = 50;

type Phase = 'watching' | 'claimable' | 'claiming' | 'success' | 'error';

export function RewardedAdModal({ open, onClose, onRewardClaimed, onToast }: RewardedAdModalProps) {
  // Use a key counter driven by the parent to force fresh state on each open.
  // State is initialized directly in useState — no effect-based reset needed.
  const [countdown, setCountdown] = useState(AD_DURATION_SECONDS);
  const [phase, setPhase] = useState<Phase>('watching');
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!open || phase !== 'watching') return;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setPhase('claimable');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, phase]);

  const handleClaim = useCallback(async () => {
    setPhase('claiming');
    setErrorMsg('');

    try {
      const res = await fetch('/api/player/video-reward', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setPhase('error');
        setErrorMsg(data.error || 'Failed to claim reward.');
        if (onToast) onToast(data.error || 'Failed to claim reward.', 'error');
        return;
      }

      setPhase('success');
      if (onToast) onToast(`+${data.reward} chips credited from video reward!`, 'success');
      onRewardClaimed?.(data.reward);

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      setPhase('error');
      setErrorMsg('Network error. Try again.');
      if (onToast) onToast('Network error.', 'error');
    }
  }, [onClose, onRewardClaimed, onToast]);

  if (!open) return null;

  const progressPercent = ((AD_DURATION_SECONDS - countdown) / AD_DURATION_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-[min(92vw,480px)] rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

        {/* Close button */}
        {phase !== 'watching' && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="p-6 flex flex-col items-center text-center">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Tv className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Rewarded Ad</h3>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Watch the ad to earn <span className="text-emerald-400 font-bold">+{REWARD_AMOUNT} free chips</span>
          </p>

          {/* Ad Content Area */}
          <div className="w-full rounded-xl border border-slate-800 bg-slate-900/50 mb-5 overflow-hidden">
            {phase === 'watching' && (
              <div className="relative aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                {/* Simulated ad content placeholder */}
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-pulse flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <Gift className="h-8 w-8 text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-300">Sponsored Content</p>
                  <p className="text-[10px] text-slate-500">Ad playing...</p>
                </div>

                {/* Countdown overlay */}
                <div className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 border border-amber-500/40">
                  <span className="text-sm font-bold text-amber-400 font-mono">{countdown}</span>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {phase === 'claimable' && (
              <div className="aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950/30 to-slate-900">
                <CheckCircle className="h-10 w-10 text-emerald-400 mb-2" />
                <p className="text-sm font-bold text-emerald-300">Ad Complete!</p>
                <p className="text-xs text-slate-400 mt-1">You can now claim your reward</p>
              </div>
            )}

            {phase === 'claiming' && (
              <div className="aspect-video flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-amber-400 animate-spin" />
                <p className="text-sm text-slate-300 mt-3">Claiming reward...</p>
              </div>
            )}

            {phase === 'success' && (
              <div className="aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950/40 to-slate-900">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 mb-2">
                  <Gift className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-emerald-300">+{REWARD_AMOUNT} Chips!</p>
                <p className="text-xs text-slate-400 mt-1">Reward credited to your account</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-rose-950/30 to-slate-900">
                <Clock className="h-10 w-10 text-rose-400 mb-2" />
                <p className="text-sm font-bold text-rose-300">Oops!</p>
                <p className="text-xs text-slate-400 mt-1 px-4">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {phase === 'watching' && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Please wait... {countdown}s remaining
            </p>
          )}

          {phase === 'claimable' && (
            <button
              type="button"
              onClick={handleClaim}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <Gift className="h-4 w-4" />
              CLAIM +{REWARD_AMOUNT} CHIPS
            </button>
          )}

          {phase === 'error' && (
            <button
              type="button"
              onClick={() => {
                setPhase('watching');
                setCountdown(AD_DURATION_SECONDS);
              }}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              TRY AGAIN
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RewardedAdModal;
