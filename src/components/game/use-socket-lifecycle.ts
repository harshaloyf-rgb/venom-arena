'use client';

import { useEffect, type RefObject } from 'react';
import { io, type Socket } from 'socket.io-client';
import { playExtractStart, playExtractSuccess, playExtractRestart, playDeath, playFoodCollect, playKill, playBoost, playWallHit, initGameAudio } from '@/lib/game-audio';
import type { ArenaLeaderboardEntry, GameSnapshot, MatchResult, SnakeSnapshot } from '@/lib/types';
import type { Phase, KillerInfo, EndScreenState } from './game-types';
import type { Particle } from './render-helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCKET_PORT = 3001;
const MAX_PARTICLES = 200; // [FIXES C10] capped particle array

// ---------------------------------------------------------------------------
// Socket event payload types (strictly typed — no `any`).
// ---------------------------------------------------------------------------

interface JoinedPayload {
  arenaId: string;
  worldSize: number;
  yourId: string;
}

type JoinErrorReason =
  | 'insufficient_chips'
  | 'banned'
  | 'invalid_arena'
  | 'already_in_match';

interface JoinErrorPayload {
  reason: JoinErrorReason;
}

interface MatchResultPayload {
  outcome: 'extract' | 'death';
  arenaId: string;
  arenaName: string;
  chipsExtracted: number;
  kills: number;
  score: number;
  xpGained: number;
  newLevel: number;
  newBankedChips: number;
  durationSeconds: number;
  killerName?: string;
  killerTag?: string;
  commission?: number;
  bankedAmount?: number;
}

interface ExtractStartPayload {
  durationMs: number;
}

interface ExtractProgressPayload {
  progress: number; // 0..1
}

interface ExtractFailPayload {
  reason: string;
}

interface DeathPayload {
  killerId?: string;
  killerName?: string;
  killerTag?: string;
  killerColor?: string;
  killerIsBot?: boolean;
}

interface ChatPayload {
  senderId: string;
  senderName: string;
  senderTag: string;
  message: string;
}

interface KickedPayload {
  reason: string;
}

interface ServerErrorPayload {
  message: string;
}

interface PongPayload {
  t: number;
  id: string;
}

// ---------------------------------------------------------------------------
// Hook parameters
// ---------------------------------------------------------------------------

export interface UseSocketLifecycleParams {
  arenaId: string;
  isOffline: boolean;
  playerLevel: number;
  isMountedRef: RefObject<boolean>;
  socketRef: RefObject<Socket | null>;
  rafRef: RefObject<number | null>;
  snapshotRef: RefObject<GameSnapshot | null>;
  mySnakeIdRef: RefObject<string | null>;
  phaseRef: RefObject<Phase>;
  matchEndedRef: RefObject<boolean>;
  killsRef: RefObject<number>;
  prevSnakesRef: RefObject<SnakeSnapshot[]>;
  carriedRef: RefObject<number>;
  scoreRef: RefObject<number>;
  wasBoostingRef: RefObject<boolean>;
  lastPingSentRef: RefObject<number>;
  pendingPingsRef: RefObject<Map<string, number>>;
  timersRef: RefObject<Set<ReturnType<typeof setTimeout>>>;
  chatTimeoutsRef: RefObject<Map<string, ReturnType<typeof setTimeout>>>;
  startTimeRef: RefObject<number>;
  pingRef: RefObject<number>;
  isPostDeathRef: RefObject<boolean>;
  postDeathRecordRef: RefObject<number>;
  onExitRef: RefObject<() => void>;
  playerNameRef: RefObject<string>;
  isOfflineModeRef: RefObject<boolean>;
  extractActiveRef: RefObject<boolean>;
  touchBoostRef: RefObject<boolean>;
  boostHoldRef: RefObject<boolean>;
  keysRef: RefObject<Set<string>>;
  killFeedIdRef: RefObject<number>;
  particlesRef: RefObject<Particle[]>;
  setPhase: React.Dispatch<React.SetStateAction<Phase>>;
  setConnectingMsg: React.Dispatch<React.SetStateAction<string>>;
  setConnectionError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsReconnecting: React.Dispatch<React.SetStateAction<boolean>>;
  setEndScreen: React.Dispatch<React.SetStateAction<EndScreenState | null>>;
  setHudCarried: React.Dispatch<React.SetStateAction<number>>;
  setHudKills: React.Dispatch<React.SetStateAction<number>>;
  setHudScore: React.Dispatch<React.SetStateAction<number>>;
  setHudRank: React.Dispatch<React.SetStateAction<number>>;
  setHudCommissionRate: React.Dispatch<React.SetStateAction<number>>;
  setHudLeaderboard: React.Dispatch<React.SetStateAction<ArenaLeaderboardEntry[]>>;
  setHudYourRank: React.Dispatch<React.SetStateAction<number>>;
  setHudRealPlayerCount: React.Dispatch<React.SetStateAction<number>>;
  setHudRealPlayers: React.Dispatch<React.SetStateAction<number>>;
  setHudBots: React.Dispatch<React.SetStateAction<number>>;
  setExtracting: React.Dispatch<React.SetStateAction<boolean>>;
  setExtractProgress: React.Dispatch<React.SetStateAction<number>>;
  setShowDeathVignette: React.Dispatch<React.SetStateAction<boolean>>;
  setPing: React.Dispatch<React.SetStateAction<number>>;
  setKillFeed: React.Dispatch<React.SetStateAction<Array<{ victimName: string; victimIsBot: boolean; killerName: string | null; killerIsBot: boolean; cause: string; id: number }>>>;
  recordReplayFrame: (snap: GameSnapshot) => void;
  getReplayFrames: () => { frames: GameSnapshot[]; deathFrameIdx: number };
  safeTimeout: (fn: () => void, ms: number) => void;
  toast: (opts: { title: string; description?: string; variant?: 'destructive' | 'default' }) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSocketLifecycle({
  arenaId,
  isOffline,
  playerLevel,
  isMountedRef,
  socketRef,
  rafRef,
  snapshotRef,
  mySnakeIdRef,
  phaseRef,
  matchEndedRef,
  killsRef,
  prevSnakesRef,
  carriedRef,
  scoreRef,
  wasBoostingRef,
  lastPingSentRef,
  pendingPingsRef,
  timersRef,
  chatTimeoutsRef,
  startTimeRef,
  pingRef,
  isPostDeathRef,
  postDeathRecordRef,
  onExitRef,
  playerNameRef,
  isOfflineModeRef,
  extractActiveRef,
  touchBoostRef,
  boostHoldRef,
  keysRef,
  killFeedIdRef,
  particlesRef,
  setPhase,
  setConnectingMsg,
  setConnectionError,
  setIsReconnecting,
  setEndScreen,
  setHudCarried,
  setHudKills,
  setHudScore,
  setHudRank,
  setHudCommissionRate,
  setHudLeaderboard,
  setHudYourRank,
  setHudRealPlayerCount,
  setHudRealPlayers,
  setHudBots,
  setExtracting,
  setExtractProgress,
  setShowDeathVignette,
  setPing,
  setKillFeed,
  recordReplayFrame,
  getReplayFrames,
  safeTimeout,
  toast,
}: UseSocketLifecycleParams) {
  // =========================================================================
  // SOCKET LIFECYCLE EFFECT (mount-once per arenaId).
  // Wires every server event with a paired `.off(...)` cleanup, re-emits
  // `join_arena` on every `connect`/`reconnect`, and disconnects on unmount.
  // [FIXES C7, C8, S1, S2, S3]
  // =========================================================================
  useEffect(() => {
    // --- Offline mode: skip Socket.IO entirely. The OfflineGameEngine
    // (instantiated in a separate effect below) owns the game loop, rendering,
    // (instantiated in a separate effect below) owns the game loop, rendering,
    // input, and HUD. ---
    if (isOffline) {
      setPhase('playing');
      setConnectingMsg('');
      return;
    }

    isMountedRef.current = true;
    let cancelled = false;
    let localSocket: Socket | null = null;

    (async () => {
      // --- Fetch a short-lived JWT for socket auth (cookie is httpOnly) ---
      let token: string | null = null;
      try {
        const res = await fetch('/api/auth/token', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { token: string | null };
          token = data.token;
        }
      } catch {
        /* network error — token stays null */
      }
      if (cancelled || !isMountedRef.current) return;

      if (!token) {
        setConnectionError('Not authenticated. Please sign in again.');
        setConnectingMsg('');
        return;
      }

      // --- Connect socket.io ---
      // Path MUST be `/`, XTransformPort MUST be in query (per Caddy gateway).
      // Use websocket transport only to avoid polling-fallback lag.
      const socket = io('/', {
        transports: ['websocket'],
        query: { XTransformPort: SOCKET_PORT },
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });
      localSocket = socket;
      socketRef.current = socket;

      // ----- Helpers -----
      const emitJoin = () => {
        socket.emit('join_arena', { arenaId });
      };

      // ----- Connection lifecycle handlers -----
      const onConnect = () => {
        setIsReconnecting(false);
        setConnectionError(null);
        initGameAudio(); // Initialize Web Audio on first interaction
        // [FIXES S1] emit join_arena on EVERY connect (including reconnects)
        emitJoin();
        // Reset the ping clock.
        lastPingSentRef.current = Date.now();
      };

      const onDisconnect = () => {
        setIsReconnecting(true);
        // Clear stuck keys/inputs so the snake doesn't keep steering.
        keysRef.current.clear();
        touchBoostRef.current = false;
        boostHoldRef.current = false;
      };

      const onConnectError = (err: Error) => {
        // [FIXES S2] surface the error to the user instead of a black screen
        setIsReconnecting(true);
        setConnectionError(err?.message || 'Connection failed');
      };

      const onReconnectAttempt = (attempt: number) => {
        setIsReconnecting(true);
        setConnectingMsg(`Reconnecting (attempt ${attempt})…`);
      };

      // ----- Game event handlers -----
      const onJoined = (payload: unknown) => {
        const data = payload as JoinedPayload;
        if (!data || typeof data.yourId !== 'string') return;
        mySnakeIdRef.current = data.yourId;
        startTimeRef.current = Date.now();
        matchEndedRef.current = false;
        killsRef.current = 0;
        prevSnakesRef.current = [];
        carriedRef.current = 0;
        scoreRef.current = 0;
        wasBoostingRef.current = false;
        setPhase('playing');
        setEndScreen(null);
        setHudKills(0);
        setHudCarried(0);
        setHudScore(0);
        setHudRank(1);
        // BUILD-13: reset arena-leaderboard HUD state on (re)join.
        setHudCommissionRate(0);
        setHudLeaderboard([]);
        setHudYourRank(0);
        setHudRealPlayerCount(isOfflineModeRef.current ? 0 : 1);
        setConnectingMsg('');
        toast({
          title: isOffline ? 'Practice Mode' : 'Connected',
          description: isOffline
            ? 'Offline training arena loaded.'
            : 'Connected to real-time multiplayer shard!',
        });
      };

      const onJoinError = (payload: unknown) => {
        const data = payload as JoinErrorPayload;
        const messages: Record<JoinErrorReason, string> = {
          insufficient_chips: 'Not enough chips to enter this arena.',
          banned: 'Your account has been banned.',
          invalid_arena: 'This arena does not exist.',
          already_in_match: 'You are already in a match.',
        };
        const reason = data?.reason ?? 'invalid_arena';
        const msg = messages[reason] || 'Could not join arena.';
        setConnectionError(msg);
        setConnectingMsg('');
        toast({
          title: 'Cannot join arena',
          description: msg,
          variant: 'destructive',
        });
        // Auto-exit after a short delay so the user sees the toast.
        safeTimeout(() => {
          if (isMountedRef.current) onExitRef.current();
        }, 1800);
      };

      const onSnapshot = (payload: unknown) => {
        const data = payload as GameSnapshot;
        if (!data || !Array.isArray(data.snakes) || !Array.isArray(data.foods)) return;
        snapshotRef.current = data;
        // Record frame for replay: while playing OR during post-death 15s window
        if (phaseRef.current === 'playing' || postDeathRecordRef.current > 0) {
          recordReplayFrame(data);
          if (postDeathRecordRef.current > 0) {
            postDeathRecordRef.current--;
            if (postDeathRecordRef.current === 0) {
              isPostDeathRef.current = false;
            }
          }
        }

        // --- BUILD-13: server-provided arena-wide fields (online mode) ---
        // In offline mode these are 0 / empty — the HUD falls back to
        // client-computed values (rank by score vs bots, leaderboard
        // built from snakes, etc.).
        const realPlayerCount =
          typeof data.realPlayerCount === 'number' ? data.realPlayerCount : 0;
        const yourRank = typeof data.yourRank === 'number' ? data.yourRank : 0;
        const commissionRate =
          typeof data.commissionRate === 'number' ? data.commissionRate : 0;
        const serverLeaderboard = Array.isArray(data.arenaLeaderboard)
          ? data.arenaLeaderboard
          : [];
        setHudRealPlayerCount(realPlayerCount);
        setHudYourRank(yourRank);
        setHudCommissionRate(commissionRate);

        // --- Update HUD carried chips, score, rank, counts ---
        const myId = mySnakeIdRef.current;
        const me = myId ? data.snakes.find((s) => s.id === myId) : undefined;
        if (me) {
          // [FIXES S10] throttle setState — only when value changes
          let starCollected = false;
          if (me.carriedChips !== carriedRef.current) {
            const chipGain = me.carriedChips - carriedRef.current;
            if (chipGain > 0 && !isOfflineModeRef.current) {
              // Star chip collected — play the golden star sound
              playFoodCollect('star');
              starCollected = true;
            }
            carriedRef.current = me.carriedChips;
            setHudCarried(me.carriedChips);
          }
          if (me.score !== scoreRef.current) {
            const scoreGain = me.score - scoreRef.current;
            if (scoreGain > 0 && !starCollected) {
              // Food orb collected — determine size from gain amount
              // Skip sound if star was already collected this frame (star also adds score)
              const orbSize = scoreGain >= 5 ? 'large' : scoreGain >= 3 ? 'medium' : 'small';
              playFoodCollect(orbSize);
            }
            scoreRef.current = me.score;
            setHudScore(me.score);
          }
          // Boost activation sound
          if (me.isBoosting && !wasBoostingRef.current) {
            playBoost();
          }
          wasBoostingRef.current = !!me.isBoosting;

          // BUILD-13: rank computation differs by mode:
          //  - Online (realPlayerCount > 0): server-provided yourRank
          //    (rank by carriedChips among real players). Falls back to
          //    score-sort if the server didn't send it.
          //  - Offline: rank by score vs all snakes (you + bots).
          if (realPlayerCount > 0 && yourRank > 0) {
            setHudRank(yourRank);
          } else {
            const sorted = [...data.snakes].sort((a, b) => b.score - a.score);
            const idx = sorted.findIndex((s) => s.id === myId);
            setHudRank(idx >= 0 ? idx + 1 : 1);
          }

          // Heuristic kill detection: a snake near us last tick that vanished.
          // Not authoritative — server's match_result.kills is the source of truth.
          const currentIds = new Set(data.snakes.map((s) => s.id));
          const head = me.points?.[0];
          if (head) {
            const prev = prevSnakesRef.current;
            for (const s of prev) {
              if (currentIds.has(s.id) || s.id === myId) continue;
              const h = s.points?.[0];
              if (!h) continue;
              const dx = h.x - head.x;
              const dy = h.y - head.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 220) {
                killsRef.current += 1;
                setHudKills(killsRef.current);
              }
            }
          }
          prevSnakesRef.current = data.snakes.slice();
        }

        // --- BUILD-13: arena leaderboard ---
        // Online: use server-provided top-10 real players by carriedChips.
        // Offline: build a top-10 by score from all snakes (you + bots).
        if (realPlayerCount > 0) {
          setHudLeaderboard(serverLeaderboard);
        } else {
          const offlineBoard: ArenaLeaderboardEntry[] = [...data.snakes]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((s) => ({
              id: s.id,
              name: s.name,
              userTag: s.userTag,
              carriedChips: s.carriedChips,
              score: s.score,
              kills: 0,
              isPlayer: s.id === myId,
              country: s.country,
            }));
          setHudLeaderboard(offlineBoard);
        }

        // --- Active competitor counts ---
        // BUILD-13: prefer server-reported realPlayerCount (authoritative —
        // includes humans not currently visible). Bots counted from snapshot.
        const realPlayers =
          realPlayerCount > 0
            ? realPlayerCount
            : data.snakes.filter((s) => s.isPlayer && !s.isBot).length;
        const bots = data.snakes.filter((s) => s.isBot).length;
        setHudRealPlayers(realPlayers);
        setHudBots(bots);
      };

      const onMatchResult = (payload: unknown) => {
        const data = payload as MatchResultPayload;
        if (!data || !data.outcome) return;
        // [FIXES C3] idempotency guard — ignore duplicate match_result
        if (matchEndedRef.current && matchEndedRef.current === true) {
          // Still update the end screen with the authoritative numbers if we
          // previously got a `death` event with placeholder stats.
          setEndScreen((prev) => {
            if (!prev) return prev;
            const result: MatchResult = {
              outcome: data.outcome,
              arenaId: data.arenaId,
              arenaName: data.arenaName,
              chipsExtracted: data.chipsExtracted,
              commission: data.commission ?? 0,
              bankedAmount: data.bankedAmount ?? 0,
              kills: data.kills,
              score: data.score,
              deaths: data.outcome === 'death' ? 1 : 0,
              xpGained: data.xpGained,
              newLevel: data.newLevel,
              newBankedChips: data.newBankedChips,
              durationSeconds: data.durationSeconds,
              killerName: data.killerName,
              killerTag: data.killerTag,
            };
            return {
              ...prev,
              result,
              durationSeconds: data.durationSeconds,
              carriedChips: prev.carriedChips,
              score: data.score || prev.score,
            };
          });
          return;
        }
        matchEndedRef.current = true;

        // Defensive: if onDeath hasn't fired yet (e.g. event reordering),
        // set up post-death recording here so the replay still captures 15 s
        // after death.  The server now emits death before match_result, but
        // we guard against edge-cases.
        if (data.outcome === 'death' && postDeathRecordRef.current === 0) {
          isPostDeathRef.current = true;
          postDeathRecordRef.current = 300;
          safeTimeout(() => {
            const { frames: finalFrames, deathFrameIdx: finalDeathIdx } = getReplayFrames();
            setEndScreen(prev => prev?.outcome === 'death' ? {
              ...prev,
              replayFrames: finalFrames,
              replayDeathFrameIdx: finalDeathIdx,
            } : prev);
          }, 15500);
        }

        const result: MatchResult = {
          outcome: data.outcome,
          arenaId: data.arenaId,
          arenaName: data.arenaName,
          chipsExtracted: data.chipsExtracted,
          commission: data.commission ?? 0,
          bankedAmount: data.bankedAmount ?? 0,
          kills: data.kills,
          score: data.score,
          deaths: data.outcome === 'death' ? 1 : 0,
          xpGained: data.xpGained,
          newLevel: data.newLevel,
          newBankedChips: data.newBankedChips,
          durationSeconds: data.durationSeconds,
          killerName: data.killerName,
          killerTag: data.killerTag,
        };
        setPhase('ended');
        setHudKills(data.kills);
        if (data.outcome === 'extract') playExtractSuccess();
        setEndScreen({
          outcome: data.outcome,
          result,
          durationSeconds: data.durationSeconds,
          carriedChips: carriedRef.current,
          score: data.score || scoreRef.current,
          killer:
            data.outcome === 'death' && data.killerName
              ? { name: data.killerName, tag: data.killerTag }
              : undefined,
          // Attach replay frames for death
          ...(data.outcome === 'death' ? {
            replayFrames: getReplayFrames().frames,
            replayMyId: mySnakeIdRef.current ?? undefined,
            replayDeathFrameIdx: getReplayFrames().deathFrameIdx,
          } : {}),
        });
        // Show level-up toast if applicable.
        if (data.newLevel > playerLevel) {
          toast({
            title: 'Level Up!',
            description: `LEVEL UP! You reached Level ${data.newLevel}!`,
          });
        }
      };

      const onExtractStart = (payload: unknown) => {
        const data = payload as ExtractStartPayload;
        extractActiveRef.current = true;
        setExtracting(true);
        setExtractProgress(0);
        playExtractStart();
        // Server's durationMs is informational — progress events drive the bar.
        void data;
      };

      const onExtractProgress = (payload: unknown) => {
        const data = payload as ExtractProgressPayload;
        if (typeof data?.progress === 'number') {
          setExtractProgress(Math.max(0, Math.min(1, data.progress)));
        }
      };

      const onExtractFail = (payload: unknown) => {
        const data = payload as ExtractFailPayload;
        extractActiveRef.current = false;
        setExtracting(false);
        setExtractProgress(0);
        toast({
          title: 'Extraction failed',
          description: data?.reason || 'You moved or took damage.',
          variant: 'destructive',
        });
      };

      const onDeath = (payload: unknown) => {
        const data = payload as DeathPayload;
        // [FIXES C3] idempotency — if match already ended, ignore.
        if (matchEndedRef.current) return;
        matchEndedRef.current = true;
        // Wall death (no killer) gets wall-hit thud; collision death gets dramatic crash
        if (!data?.killerName) {
          playWallHit();
        } else {
          playDeath();
        }
        const killer: KillerInfo | undefined = data?.killerName
          ? {
              name: data.killerName,
              tag: data.killerTag,
              color: data.killerColor,
              isBot: data?.killerIsBot ?? true,
            }
          : undefined;
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        // Start post-death recording: 300 frames = 15 seconds at 20Hz
        isPostDeathRef.current = true;
        postDeathRecordRef.current = 300;

        // Show death vignette for 3 seconds BEFORE showing the end screen
        setShowDeathVignette(true);
        if (!isOffline) {
          toast({
            title: 'Eliminated',
            description: `ELIMINATED: You collided with ${data?.killerName || 'another player'}! 💀`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Crashed',
            description: 'CRASH! (Offline Practice Mode - No chips lost!)',
          });
        }

        // Prepare end screen data (but don't show it yet)
        const { frames: initFrames, deathFrameIdx: initDeathIdx } = getReplayFrames();
        setEndScreen({
          outcome: 'death',
          killer,
          durationSeconds: duration,
          carriedChips: carriedRef.current,
          score: scoreRef.current,
          replayFrames: initFrames,
          replayMyId: mySnakeIdRef.current ?? undefined,
          replayDeathFrameIdx: initDeathIdx,
        });

        // After 3-second death vignette, show the end overlay
        const DEATH_VIGNETTE_DELAY_MS = 3000;
        safeTimeout(() => {
          setShowDeathVignette(false);
          setPhase('ended');
        }, DEATH_VIGNETTE_DELAY_MS);

        // After 15s post-death recording completes, update endScreen with final frames.
        // Use safeTimeout so the callback is skipped if the component unmounts.
        safeTimeout(() => {
          const { frames: finalFrames, deathFrameIdx: finalDeathIdx } = getReplayFrames();
          setEndScreen(prev => prev?.outcome === 'death' ? {
            ...prev,
            replayFrames: finalFrames,
            replayDeathFrameIdx: finalDeathIdx,
          } : prev);
        }, 15500); // slightly more than 15s to ensure all 300 frames captured
      };

      const onChat = (payload: unknown) => {
        const data = payload as ChatPayload;
        if (!data || typeof data.message !== 'string') return;
        // Mention detection — toast if message contains player's name (case-insensitive).
        const myName = playerNameRef.current.toLowerCase();
        if (myName && data.message.toLowerCase().includes(myName)) {
          toast({
            title: `${data.senderName} mentioned you`,
            description: data.message.slice(0, 120),
          });
        }
      };

      const onKicked = (payload: unknown) => {
        const data = payload as KickedPayload;
        toast({
          title: 'Kicked',
          description: data?.reason || 'You were removed by an admin.',
          variant: 'destructive',
        });
        safeTimeout(() => {
          if (isMountedRef.current) onExitRef.current();
        }, 1500);
      };

      const onServerShutdown = () => {
        toast({
          title: 'Server restarting',
          description: 'The game server is going down for maintenance.',
          variant: 'destructive',
        });
        safeTimeout(() => {
          if (isMountedRef.current) onExitRef.current();
        }, 1500);
      };

      const onError = (payload: unknown) => {
        const data = payload as ServerErrorPayload;
        toast({
          title: 'Server error',
          description: data?.message || 'An error occurred.',
          variant: 'destructive',
        });
      };

      const onPong = (payload: unknown) => {
        const data = payload as PongPayload;
        if (!data || typeof data.id !== 'string') return;
        const sentAt = pendingPingsRef.current.get(data.id);
        if (sentAt === undefined) return;
        pendingPingsRef.current.delete(data.id);
        const rtt = Date.now() - sentAt;
        pingRef.current = rtt;
        setPing(rtt);
      };

      // ----- Register all listeners -----
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on('reconnect_attempt', onReconnectAttempt);
      socket.on('joined', onJoined);
      socket.on('join_error', onJoinError);
      socket.on('snapshot', onSnapshot);
      socket.on('match_result', onMatchResult);
      socket.on('extract_start', onExtractStart);
      socket.on('extract_progress', onExtractProgress);
      socket.on('extract_fail', onExtractFail);
      socket.on('extract_cancelled_by_steer', () => {
        // Steering detected during extraction — progress resets to 0% but extraction continues
        playExtractRestart();
        toast({
          title: '⚠ Steering Detected',
          description: 'Extraction progress restarted! Keep moving straight.',
          variant: 'destructive',
        });
      });
      socket.on('kill_feed', (payload: unknown) => {
        const data = payload as { victimName?: string; victimIsBot?: boolean; killerName?: string | null; killerIsBot?: boolean; cause?: string };
        if (!data?.victimName) return;
        const id = ++killFeedIdRef.current;
        // Play kill sound if the player is involved (killer or victim)
        if (data.killerName && !data.killerIsBot) {
          playKill();
        }
        setKillFeed(prev => {
          const next = [...prev, {
            victimName: data.victimName ?? '',
            victimIsBot: data.victimIsBot ?? false,
            killerName: data.killerName ?? null,
            killerIsBot: data.killerIsBot ?? false,
            cause: data.cause ?? 'unknown',
            id,
          }];
          return next.slice(-8); // Keep last 8 entries max
        });
        // Auto-remove after 5 seconds
        setTimeout(() => {
          setKillFeed(prev => prev.filter(e => e.id !== id));
        }, 5000);
      });
      socket.on('death_food_drop', (payload: unknown) => {
        const data = payload as {
          x?: number; y?: number; score?: number;
          bodyPoints?: Array<{ x: number; y: number }>;
          color?: string; droppedStars?: number;
        };
        if (!data?.bodyPoints || data.bodyPoints.length === 0) return;
        const arr = particlesRef.current;
        const foodColors = ['#34d399', '#38bdf8', '#f472b6', '#fbbf24'];
        const step = Math.max(1, Math.floor(data.bodyPoints.length / 12));
        for (let i = 0; i < data.bodyPoints.length; i += step) {
          const pt = data.bodyPoints[i];
          const count = 2 + Math.floor(Math.random() * 2);
          for (let j = 0; j < count; j++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 40 + Math.random() * 100;
            arr.push({
              x: pt.x, y: pt.y,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              life: 500 + Math.random() * 400,
              maxLife: 900,
              color: foodColors[Math.floor(Math.random() * foodColors.length)],
              size: 2 + Math.random() * 3,
            });
          }
        }
        // Cap particles
        if (arr.length > MAX_PARTICLES) arr.splice(0, arr.length - MAX_PARTICLES);
      });
      socket.on('death', onDeath);
      socket.on('chat', onChat);
      socket.on('kicked', onKicked);
      socket.on('server_shutdown', onServerShutdown);
      socket.on('error', onError);
      socket.on('pong', onPong);
    })();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      const s = localSocket || socketRef.current;
      if (s) {
        // Best-effort leave emit, then disconnect.
        try {
          s.emit('leave', {});
        } catch {
          /* ignore */
        }
        // [FIXES C7] explicitly remove every listener we registered
        s.off('connect');
        s.off('disconnect');
        s.off('connect_error');
        s.off('reconnect_attempt');
        s.off('joined');
        s.off('join_error');
        s.off('snapshot');
        s.off('match_result');
        s.off('extract_start');
        s.off('extract_progress');
        s.off('extract_fail');
        s.off('extract_cancelled_by_steer');
        s.off('kill_feed');
        s.off('death_food_drop');
        s.off('death');
        s.off('chat');
        s.off('kicked');
        s.off('server_shutdown');
        s.off('error');
        s.off('pong');
        s.disconnect();
      }
      socketRef.current = null;
      // Clear all tracked timers.
      for (const id of timersRef.current) clearTimeout(id);
      timersRef.current.clear();
      for (const id of chatTimeoutsRef.current.values()) clearTimeout(id);
      chatTimeoutsRef.current.clear();
      // Cancel any pending rAF (defensive — also handled by the canvas effect).
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [arenaId, isOffline, playerLevel, safeTimeout, toast]);
}
