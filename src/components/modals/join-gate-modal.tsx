'use client';

// JoinGateModal — the ONLY ad surface in Venom Arena (locked spec 2026-09-04).
//
// HARD RULE: ads never appear mid-gameplay. This gate is shown exclusively
// between "player picked an online arena" and "join request is sent". A live
// match is never interrupted: window expiry is only evaluated at join time.
//
// States:
//   passActive   → Time Pass valid — no ads anywhere; straight to Join.
//   windowActive → one ad already watched — free joins until the countdown
//                  ends; straight to Join (remaining time shown).
//   needsAd      → watch a rewarded ad (real AdMob on native, labeled TEST
//                  screen on web/preview) to unlock a 10-minute window.
//   Jade Corridor only → "Join with Ticket (N)": completely free entry
//                  (no buyIn, no ad) by redeeming a Virtual Ticket.

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Ticket, Play, ShieldCheck, Timer, Loader2, MonitorPlay } from 'lucide-react';
import { getArenaById } from '@/lib/game-config';
import { rewardedAdsAvailable, showRewardedAd } from '@/lib/ads';

interface GateStatus {
  passActive: boolean;
  adFreeUntil: string | null;
  windowActive: boolean;
  adUnlockUntil: string | null;
  windowMs: number;
  needsAd: boolean;
  tickets: number;
  ticketArenaId: string;
  mockAds: boolean;
}

interface JoinGateModalProps {
  arenaId: string;
  onClose: () => void;
  /** Called ONCE when the player commits to the join. useTicket = redeem a Virtual Ticket. */
  onJoin: (useTicket: boolean) => void;
  /** Optional: send the player to the Ad-Free panel (purchase path from the gate). */
  onGoAdFree?: () => void;
}

function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtExpiry(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function JoinGateModal({ arenaId, onClose, onJoin, onGoAdFree }: JoinGateModalProps) {
  const [gate, setGate] = useState<GateStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adPhase, setAdPhase] = useState<'idle' | 'playing' | 'verifying'>('idle');
  const [adError, setAdError] = useState<string | null>(null);
  const [mockProgress, setMockProgress] = useState(0); // 0..100 for the TEST AD screen
  const [nowTs, setNowTs] = useState(() => Date.now());
  const mountedRef = useRef(true);

  const arena = getArenaById(arenaId);
  const isJade = arena?.id === 'tier-8';

  const fetchGate = useCallback(async (): Promise<GateStatus | null> => {
    try {
      const res = await fetch('/api/ads/gate');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GateStatus;
      if (mountedRef.current) {
        setGate(data);
        setLoadError(null);
      }
      return data;
    } catch (e) {
      if (mountedRef.current) setLoadError(e instanceof Error ? e.message : 'Failed to check gate status.');
      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchGate();
    // 1s ticker for the window countdown
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(t);
    };
  }, [fetchGate]);

  const pollUnlock = useCallback(async (nonce: string): Promise<boolean> => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      if (!mountedRef.current) return false;
      try {
        const res = await fetch(`/api/ads/session?nonce=${encodeURIComponent(nonce)}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.purpose === 'join' && data.credited) {
          await fetchGate();
          return true;
        }
      } catch { /* keep polling */ }
    }
    return false;
  }, [fetchGate]);

  const watchAd = useCallback(async () => {
    if (!gate) return;
    setAdError(null);
    // ── Web/preview: labeled TEST AD simulation (server-side unlock) ─────
    if (gate.mockAds && !rewardedAdsAvailable()) {
      setAdPhase('playing');
      for (let p = 0; p <= 100; p += 2) {
        setMockProgress(p);
        await new Promise((r) => setTimeout(r, 100)); // 5s total
        if (!mountedRef.current) return;
      }
      setAdPhase('verifying');
      try {
        const res = await fetch('/api/ads/mock-complete', { method: 'POST' });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Mock unlock failed.');
        }
        await fetchGate();
      } catch (e) {
        if (mountedRef.current) setAdError(e instanceof Error ? e.message : 'Mock unlock failed.');
      } finally {
        if (mountedRef.current) {
          setAdPhase('idle');
          setMockProgress(0);
        }
      }
      return;
    }

    // ── Native: real AdMob rewarded ad with server-side SSV verification ──
    if (!rewardedAdsAvailable()) {
      setAdError('Rewarded ads are only available in the mobile app. On web, join with a Time Pass (no ads at all) or a Jade Corridor ticket — open the Ad-Free tab to get one.');
      return;
    }
    setAdPhase('verifying');
    try {
      const res = await fetch('/api/ads/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'join' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not start the ad session.');
      }
      const { nonce } = (await res.json()) as { nonce: string };
      setAdPhase('playing');
      await showRewardedAd(nonce); // resolves when the ad flow closes
      setAdPhase('verifying');
      const ok = await pollUnlock(nonce); // credit arrives via the signed SSV callback
      if (!ok && mountedRef.current) {
        setAdError('Ad reward is still being verified — try joining again in a moment.');
      }
    } catch (e) {
      if (mountedRef.current) setAdError(e instanceof Error ? e.message : 'Ad failed. Try again.');
    } finally {
      if (mountedRef.current) setAdPhase('idle');
    }
  }, [gate, fetchGate, pollUnlock]);

  const commit = useCallback((useTicket: boolean) => {
    onJoin(useTicket);
  }, [onJoin]);

  const windowRemaining = gate?.windowActive && gate.adUnlockUntil
    ? new Date(gate.adUnlockUntil).getTime() - nowTs
    : 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 font-sans">
              {arena ? `Enter ${arena.name}` : 'Enter Arena'}
            </h3>
            {arena && (
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Online · Buy-in {arena.buyIn.toLocaleString()}c
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadError && (
          <p className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300 font-sans">
            {loadError}
          </p>
        )}

        {!gate && !loadError && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400 font-sans">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking entry requirements…
          </div>
        )}

        {gate && (
          <div className="mt-4 space-y-3">
            {gate.passActive && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-300 font-sans">
                  Ad-Free Pass active until {fmtExpiry(gate.adFreeUntil)} — no ads, straight in.
                </p>
              </div>
            )}

            {!gate.passActive && gate.windowActive && (
              <div className="flex items-center gap-2 rounded-lg bg-sky-500/10 border border-sky-500/30 px-3 py-2">
                <Timer className="w-4 h-4 text-sky-400 shrink-0" />
                <p className="text-xs text-sky-300 font-sans">
                  Ad window active — free joins for <span className="font-bold">{fmtRemaining(windowRemaining)}</span>.
                </p>
              </div>
            )}

            {gate.needsAd && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-3">
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  Watch a short ad to unlock <span className="font-bold text-slate-100">10 minutes</span> of arena
                  entries. Ads only ever appear here — never during gameplay. Prefer zero ads? Go Ad-Free —
                  passes also include <span className="font-bold text-sky-300">free Jade Corridor tickets</span>.
                </p>
                {adPhase === 'playing' && gate.mockAds && (
                  <div className="mt-2">
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-6">
                      <MonitorPlay className="w-5 h-5 text-amber-400" />
                      <p className="text-sm font-bold text-amber-300 font-sans">TEST AD — {100 - Math.round(mockProgress) > 0 ? `${Math.ceil((100 - mockProgress) / 20)}s` : 'done'}</p>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-amber-400 transition-all duration-100" style={{ width: `${mockProgress}%` }} />
                    </div>
                  </div>
                )}
                {adPhase === 'playing' && !gate.mockAds && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-400 font-sans">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ad playing…
                  </p>
                )}
                {adPhase === 'verifying' && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-400 font-sans">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying reward…
                  </p>
                )}
                {adError && (
                  <p className="mt-2 text-xs text-rose-300 font-sans">{adError}</p>
                )}
                {adPhase === 'idle' && (
                  <>
                    <button
                      onClick={watchAd}
                      className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 px-4 py-2.5 text-sm font-bold text-white font-sans transition-colors"
                    >
                      <Play className="w-4 h-4" /> Watch Ad to Unlock 10 min
                    </button>
                    {onGoAdFree && (
                      <button
                        onClick={onGoAdFree}
                        className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-300 font-sans transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" /> Go Ad-Free — passes from $1.19 + free tickets
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Join is possible when: pass active, window active, or the ad just unlocked */}
            {(!gate.needsAd || adPhase === 'idle') && (
              <button
                onClick={() => commit(false)}
                disabled={gate.needsAd}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 font-sans transition-colors"
              >
                {gate.needsAd ? 'Watch the ad to unlock joining' : 'Join Arena'}
              </button>
            )}

            {isJade && (
              <button
                onClick={() => commit(true)}
                disabled={gate.tickets < 1 || adPhase !== 'idle'}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 px-4 py-2.5 text-sm font-bold text-amber-300 font-sans transition-colors"
                title="Completely free entry: no buy-in, no ad"
              >
                <Ticket className="w-4 h-4" />
                Join with Ticket ({gate.tickets}) — free entry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
