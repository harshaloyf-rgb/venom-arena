'use client';

/**
 * Venom Arena — clean GameCanvas (BUILD-10 game-canvas fix).
 *
 * Every UI string and visual element in this file has been reconciled against
 * AUDIT-A (the exhaustive audit of the original 4110-line GameCanvas.tsx).
 * The HUD text, death screen, extraction screen, hold-to-extract popup, and
 * quick-chat emotes bar all match the original strings character-for-character.
 *
 * Adapted to the BUILD-6a game-server changes:
 *  - `GameSnapshot` no longer has `extractZoneRadius`. Extraction is button-
 *    based (hold E or the bottom-right EXTRACT button anywhere in the arena).
 *  - `SnakeSnapshot` now has `score` (body-length score). The HUD "Score:"
 *    reads this directly (the snake length, not chips).
 *  - Food: regular food = +1 score (grows body), NO chips. Star chips
 *    (golden 5-point star) = +chips to carriedChips. The HUD "Carried Chips"
 *    only goes up from star chips.
 *  - Boost costs body length, not chips. Client sends `wantsBoost: true`
 *    when SPACE is held OR the BOOST button is held OR the touch joystick
 *    magnitude > 0.6. The server enforces the BOOST_MIN_LENGTH=8 gate and
 *    drops 1 tail segment every 40 frames.
 *  - Wall = death. The map has a breathing circular boundary
 *    (radius 3800 ± 40, cycle 10 s). Rendered in render-helpers as a neon
 *    rose circle. Hitting it kills you.
 *  - World is 8000×8000, centered at (4000, 4000).
 *
 * High-level architecture:
 *  - One socket effect (mount-once per arenaId) wires every server event with
 *    a paired `.off(...)` cleanup. On `connect`/`reconnect` we re-emit
 *    `join_arena` (the old canvas never did, leaving the player a ghost after
 *    a blip). [FIXES C7, C8, S1, S2, S3]
 *  - One canvas effect (mount-once) sets up the rAF loop, ResizeObserver, and
 *    DPR-aware sizing. The loop reads purely from refs (no closures over
 *    stale state). rAF is cancelled on unmount.
 *  - One input effect (mount-once) wires mouse / keyboard / touch joystick
 *    with `preventDefault` for arrows/space, blur-reset for stuck keys,
 *    pointer-capture on the extract & boost buttons, and a virtual joystick
 *    on the bottom-left quadrant of the canvas.
 *  - Rendering math lives in `./render-helpers.ts` (pure functions, no React).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { type Socket } from 'socket.io-client';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Compass,
  Landmark,
  Loader2,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  Play,
  Send,
  Shield,
  Signal,
  Skull,
  Star,
  Swords,
  Trophy,
  User,
  UserPlus,
  Users,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

import {
  ARENA_TIERS,
  WORLD_SIZE,
  countryFlag,
  getArenaById,
} from '@/lib/game-config';
import type {
  ArenaLeaderboardEntry,
  GameSnapshot,
  MatchResult,
  PlayerProfile,
  SnakeSnapshot,
} from '@/lib/types';

import { OfflineGameEngine, type OfflineExitResult, type OfflineState } from './offline-engine';
import EndOverlay from './end-overlay';
import type { Phase, JoystickState, EndScreenState } from './game-types';
import { useSocketLifecycle } from './use-socket-lifecycle';
import { useRenderLoop } from './use-render-loop';
import { useGameInput } from './use-game-input';

// Re-export EndScreenState so existing consumers (e.g. end-overlay.tsx) still work.
export type { EndScreenState } from './game-types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GameCanvasProps {
  arenaId: string;
  player: PlayerProfile;
  onExit: (result?: MatchResult) => void;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface InputPayload {
  angle: number;
  wantsBoost: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INPUT_HEARTBEAT_MS = 200;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GameCanvas({ arenaId, player, onExit }: GameCanvasProps) {
  const { toast } = useToast();
  const arena = getArenaById(arenaId) ?? ARENA_TIERS[0];
  const isOffline = !!arena.isPractice;

  // --- React state (triggers re-render; used only for HUD / overlays) ---
  const [phase, setPhase] = useState<Phase>('connecting');
  const [connectingMsg, setConnectingMsg] = useState('Authenticating…');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [endScreen, setEndScreen] = useState<EndScreenState | null>(null);
  const [hudCarried, setHudCarried] = useState(0);
  const [hudKills, setHudKills] = useState(0);
  const [hudScore, setHudScore] = useState(0);
  const [hudRank, setHudRank] = useState(1);
  const [hudRealPlayers, setHudRealPlayers] = useState(1);
  const [hudBots, setHudBots] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [showDeathVignette, setShowDeathVignette] = useState(false);
  const [fps, setFps] = useState(60);
  const [ping, setPing] = useState<number>(-1);
  const [lowQuality, setLowQuality] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // --- Kill feed state ---
  const [killFeed, setKillFeed] = useState<Array<{ victimName: string; victimIsBot: boolean; killerName: string | null; killerIsBot: boolean; cause: string; id: number }>>([]);
  const killFeedIdRef = useRef(0);

  // --- BUILD-13: arena leaderboard / minimap / full-map HUD state ---
  // Server-provided fields (online mode only). Zero/empty in offline.
  const [hudCommissionRate, setHudCommissionRate] = useState(0);
  const [hudLeaderboard, setHudLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
  const [hudYourRank, setHudYourRank] = useState(0);
  // realPlayerCount defaults to 1 for non-practice arenas so the HUD
  // doesn't briefly flash "offline mode" before the first snapshot.
  const [hudRealPlayerCount, setHudRealPlayerCount] = useState<number>(isOffline ? 0 : 1);
  // UI panel visibility (HTML overlays — not canvas-drawn).
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [fullMapOpen, setFullMapOpen] = useState(false);

  // --- Refs (mutable; read by rAF / event handlers; do NOT trigger re-render) ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const snapshotRef = useRef<GameSnapshot | null>(null);
  const mySnakeIdRef = useRef<string | null>(null);
  const phaseRef = useRef<Phase>('connecting');

  // --- Replay buffer: records last 15s pre-death + 15s post-death ---
  const REPLAY_PRE_MAX = 300; // 15s at 20Hz before death (circular)
  const REPLAY_POST_MAX = 300; // 15s at 20Hz after death (linear)
  const replayPreBufferRef = useRef<GameSnapshot[]>([]);
  const replayWriteIdxRef = useRef<number>(0);
  const replayPostBufferRef = useRef<GameSnapshot[]>([]);
  const isPostDeathRef = useRef<boolean>(false);
  const postDeathRecordRef = useRef<number>(0);
  const deathFrameIdxRef = useRef<number>(0); // index in final combined array where death occurs
  const hasStartedRecordingRef = useRef<boolean>(false); // skip pre-spawn frames

  const recordReplayFrame = useCallback((snap: GameSnapshot) => {
    // Skip pre-spawn frames: only start recording once the player's snake exists
    if (!hasStartedRecordingRef.current) {
      const myId = mySnakeIdRef.current;
      if (myId && snap.snakes.some((s) => s.id === myId)) {
        hasStartedRecordingRef.current = true;
      } else {
        return; // Don't record until player has spawned
      }
    }

    if (isPostDeathRef.current) {
      // Post-death: append linearly
      if (replayPostBufferRef.current.length < REPLAY_POST_MAX) {
        replayPostBufferRef.current.push(snap);
      }
    } else {
      // Pre-death: circular buffer
      const buf = replayPreBufferRef.current;
      if (buf.length < REPLAY_PRE_MAX) {
        buf.push(snap);
      } else {
        buf[replayWriteIdxRef.current % REPLAY_PRE_MAX] = snap;
      }
      replayWriteIdxRef.current++;
    }
  }, []);

  /** Extract combined replay frames: 15s pre-death + 15s post-death. */
  const getReplayFrames = useCallback((): { frames: GameSnapshot[]; deathFrameIdx: number } => {
    const preBuf = replayPreBufferRef.current;
    const postBuf = replayPostBufferRef.current;
    const len = preBuf.length;
    const preFrames: GameSnapshot[] = [];
    if (len === 0) return { frames: [...postBuf], deathFrameIdx: 0 };
    if (len < REPLAY_PRE_MAX) {
      // Buffer not full yet, just take all frames in order
      preFrames.push(...preBuf);
    } else {
      // Circular buffer: oldest is at writeIdx % maxFrames
      const start = replayWriteIdxRef.current % REPLAY_PRE_MAX;
      for (let i = 0; i < REPLAY_PRE_MAX; i++) {
        preFrames.push(preBuf[(start + i) % REPLAY_PRE_MAX]);
      }
    }
    deathFrameIdxRef.current = preFrames.length;
    return { frames: [...preFrames, ...postBuf], deathFrameIdx: preFrames.length };
  }, []);

  const keysRef = useRef<Set<string>>(new Set());
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseActiveRef = useRef<boolean>(false);
  const mouseLeftDownRef = useRef<boolean>(false); // left-click boost
  const touchAngleRef = useRef<number | null>(null);
  const touchBoostRef = useRef<boolean>(false);
  const joystickRef = useRef<JoystickState | null>(null);

  const camRef = useRef<{ x: number; y: number; zoom: number }>({
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2,
    zoom: 1.0,
  });
  const camInitRef = useRef<boolean>(false);

  const particlesRef = useRef<import('./render-helpers').Particle[]>([]);
  const metallicCacheRef = useRef<Map<string, CanvasGradient>>(new Map());

  const lowQualityRef = useRef<boolean>(false);
  const fpsAccumRef = useRef<{ frames: number; lastSecond: number; lowSince: number; highSince: number }>({
    frames: 0,
    lastSecond: 0,
    lowSince: 0,
    highSince: 0,
  });

  const pingRef = useRef<number>(-1);
  const pendingPingsRef = useRef<Map<string, number>>(new Map());
  const lastPingSentRef = useRef<number>(0);

  const matchEndedRef = useRef<boolean>(false); // [FIXES C3] idempotency guard
  const startTimeRef = useRef<number>(Date.now());
  const killsRef = useRef<number>(0); // heuristic — refined by match_result
  const prevSnakesRef = useRef<SnakeSnapshot[]>([]); // for kill detection
  const carriedRef = useRef<number>(0); // last known carried chips
  const scoreRef = useRef<number>(0); // last known body-length score
  const wasBoostingRef = useRef<boolean>(false); // for boost sound trigger

  const lastInputEmitRef = useRef<number>(0);
  const lastEmittedAngleRef = useRef<number>(0);
  const lastEmittedBoostRef = useRef<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const chatTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const extractActiveRef = useRef<boolean>(false);
  const boostHoldRef = useRef<boolean>(false);

  // BUILD-13: refs mirroring minimap / full-map / offline-mode state so the
  // rAF loop (which reads only refs) can react without a stale closure.
  const minimapVisibleRef = useRef<boolean>(true);
  const fullMapOpenRef = useRef<boolean>(false);
  const isOfflineModeRef = useRef<boolean>(isOffline);

  const playerSkinRef = useRef(player.currentSkin);
  playerSkinRef.current = player.currentSkin;

  const arenaIdRef = useRef(arenaId);
  arenaIdRef.current = arenaId;

  const playerNameRef = useRef(player.name);
  playerNameRef.current = player.name;

  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // --- Offline engine refs (BUILD-14) ---
  // When `arenaId` starts with `practice-`, we run the entire game client-side
  // via `OfflineGameEngine` instead of connecting to Socket.IO.
  const offlineEngineRef = useRef<OfflineGameEngine | null>(null);
  const offlineFinalStateRef = useRef<OfflineState | null>(null);

  // Keep phaseRef in sync.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Keep lowQualityRef in sync.
  useEffect(() => {
    lowQualityRef.current = lowQuality;
  }, [lowQuality]);

  // BUILD-13: keep minimap / full-map / offline-mode refs in sync with state.
  useEffect(() => {
    minimapVisibleRef.current = minimapVisible;
  }, [minimapVisible]);
  useEffect(() => {
    fullMapOpenRef.current = fullMapOpen;
  }, [fullMapOpen]);
  useEffect(() => {
    isOfflineModeRef.current = isOffline;
  }, [isOffline]);
  // Auto-hide minimap in offline mode (mapless practice arena).
  useEffect(() => {
    if (isOffline) setMinimapVisible(false);
  }, [isOffline]);
  // Default-collapse the leaderboard on small screens (mobile).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setLeaderboardOpen(false);
    }
  }, []);

  // ----- Timer helper that's tracked for cleanup (fixes C5/C18/U8) -----
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      if (isMountedRef.current) fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  // =========================================================================
  // Extracted hooks
  // =========================================================================

  useSocketLifecycle({
    arenaId,
    isOffline,
    playerLevel: player.level,
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
  });

  // =========================================================================
  // OFFLINE ENGINE EFFECT (BUILD-14) — practice-* arenas run entirely
  // client-side. No Socket.IO, no minimap, no chips. The engine owns the
  // game loop, rendering, input, and HUD overlays (built as DOM children
  // of `canvas.parentElement`). On unmount we stop the engine and tear down
  // every listener / DOM node it created.
  // =========================================================================
  useEffect(() => {
    if (!isOffline) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    offlineFinalStateRef.current = null;
    const engine = new OfflineGameEngine(arena, player, canvas);
    offlineEngineRef.current = engine;

    engine.onStateChange = (s) => {
      if (s === 'dead' || s === 'extracted') {
        offlineFinalStateRef.current = s;
      }
    };
    engine.onExit = (r: OfflineExitResult) => {
      const outcome: 'extract' | 'death' =
        offlineFinalStateRef.current === 'dead' ? 'death' : 'extract';
      const result: MatchResult = {
        outcome,
        arenaId: arena.id,
        arenaName: arena.name,
        chipsExtracted: 0, // chip-less offline mode
        commission: 0,
        bankedAmount: 0,
        kills: r.kills,
        score: r.score,
        deaths: outcome === 'death' ? 1 : 0,
        xpGained: 0, // offline = no XP
        newLevel: player.level,
        newBankedChips: player.bankedChips,
        durationSeconds: r.durationSeconds,
      };
      onExitRef.current(result);
    };

    engine.start();

    return () => {
      engine.stop();
      offlineEngineRef.current = null;
    };
  }, [arena, isOffline, player]);

  // Ref holding the input-compute function (set by the input effect, read by rAF).
  const computeInputRef = useRef<(() => { angle: number | null; boost: boolean }) | null>(null);

  // =========================================================================
  // Input emit (called from rAF loop).
  // [FIXES P13, S4] single emit site, throttled to MAX_SNAPSHOTS_PER_SECOND.
  // Declared BEFORE the canvas effect so the rAF closure can reference it
  // without a temporal-dead-zone violation.
  // =========================================================================
  const maybeEmitInput = useCallback((now: number) => {
    const s = socketRef.current;
    if (!s || !s.connected) return;
    if (phaseRef.current !== 'playing') return;
    if (matchEndedRef.current) return;
    const compute = computeInputRef.current;
    if (!compute) return;
    const { angle, boost } = compute();
    if (angle === null) return;

    const sinceLast = now - lastInputEmitRef.current;
    const angleChanged = Math.abs(angle - lastEmittedAngleRef.current) > 0.015;
    const boostChanged = boost !== lastEmittedBoostRef.current;
    const heartbeat = sinceLast > INPUT_HEARTBEAT_MS;

    if (sinceLast < 50 && !angleChanged && !boostChanged) return;
    if (!angleChanged && !boostChanged && !heartbeat) return;

    const payload: InputPayload = { angle, wantsBoost: boost };
    s.emit('input', payload);
    lastInputEmitRef.current = now;
    lastEmittedAngleRef.current = angle;
    lastEmittedBoostRef.current = boost;
  }, []);

  useRenderLoop({
    canvasRef,
    isOffline,
    isMountedRef,
    rafRef,
    resizeObserverRef,
    snapshotRef,
    mySnakeIdRef,
    camRef,
    camInitRef,
    particlesRef,
    metallicCacheRef,
    lowQualityRef,
    fpsAccumRef,
    socketRef,
    lastPingSentRef,
    pendingPingsRef,
    playerSkinRef,
    minimapVisibleRef,
    fullMapOpenRef,
    joystickRef,
    computeInputRef,
    maybeEmitInput,
    setFps,
    setLowQuality,
  });

  useGameInput({
    canvasRef,
    isOffline,
    keysRef,
    mousePosRef,
    mouseActiveRef,
    mouseLeftDownRef,
    touchAngleRef,
    touchBoostRef,
    joystickRef,
    phaseRef,
    matchEndedRef,
    extractActiveRef,
    boostHoldRef,
    socketRef,
    onExitRef,
    computeInputRef,
    setFullMapOpen,
  });

  // =========================================================================
  // Extract / boost button handlers (pointer events with capture).
  // [FIXES C19, I6, I11] pointer capture prevents stuck-hold.
  // =========================================================================
  const onExtractPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'playing' || matchEndedRef.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    socketRef.current?.emit('extract', {});
    extractActiveRef.current = true;
  };
  const onExtractPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!extractActiveRef.current) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    socketRef.current?.emit('cancel_extract', {});
    extractActiveRef.current = false;
  };

  const onBoostPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    boostHoldRef.current = true;
    keysRef.current.add(' '); // reuse keyboard-boost path
  };
  const onBoostPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!boostHoldRef.current) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    boostHoldRef.current = false;
    keysRef.current.delete(' ');
  };

  // =========================================================================
  // Chat submit
  // =========================================================================
  const submitChat = () => {
    const msg = chatInput.trim();
    if (!msg) {
      setChatOpen(false);
      return;
    }
    socketRef.current?.emit('chat', { message: msg.slice(0, 200) });
    setChatInput('');
    setChatOpen(false);
  };

  // Quick chat emote bar (AUDIT-A Section H)
  const triggerEmote = (msg: string) => {
    socketRef.current?.emit('chat', { message: msg });
  };

  // =========================================================================
  // Play Again — re-emit join_arena, reset local state.
  // =========================================================================
  const playAgain = () => {
    if (!socketRef.current) return;
    matchEndedRef.current = false;
    killsRef.current = 0;
    setHudKills(0);
    setHudCarried(0);
    setHudScore(0);
    setHudRank(1);
    // BUILD-13: reset arena-leaderboard HUD state on re-join.
    setHudCommissionRate(0);
    setHudLeaderboard([]);
    setHudYourRank(0);
    setHudRealPlayerCount(1);
    setFullMapOpen(false);
    setEndScreen(null);
    setExtracting(false);
    setExtractProgress(0);
    setPhase('connecting');
    setConnectingMsg('Rejoining arena…');
    snapshotRef.current = null;
    // Clear replay buffer on reset
    replayPreBufferRef.current = [];
    replayPostBufferRef.current = [];
    replayWriteIdxRef.current = 0;
    isPostDeathRef.current = false;
    postDeathRecordRef.current = 0;
    hasStartedRecordingRef.current = false;
    camInitRef.current = false;
    particlesRef.current = [];
    socketRef.current.emit('join_arena', { arenaId: arenaIdRef.current });
  };

  const exitNow = () => {
    const result = endScreen?.result;
    onExitRef.current(result);
  };

  // =========================================================================
  // Derived display values
  // =========================================================================
  const pingColor =
    ping < 0
      ? 'text-muted-foreground'
      : ping < 80
        ? 'text-emerald-400'
        : ping < 160
          ? 'text-amber-400'
          : 'text-rose-400';
  const snakeLength = hudScore; // Score = body length

  // BUILD-13: offline-mode flag (practice arena OR server reports 0 real
  // players). Drives chips-display hiding + rank/leaderboard formatting.
  // (Offline practice arenas return early before this point, so this only
  //  matters for the online-mode edge case where realPlayerCount === 0.)
  const isOfflineMode = isOffline;
  const starsInArena = (snapshotRef.current?.foods ?? []).filter(f => f.isStarChip).length;
  // Rank display:
  //  - Online (realPlayerCount > 1): "#X of Y" using server yourRank.
  //  - Online with <= 1 real player: "#1 of 1".
  //  - Offline: "#X" (computed from score vs bots).
  const rankDisplay = isOfflineMode
    ? `#${hudRank}`
    : hudRealPlayerCount <= 1
      ? '#1 of 1'
      : `#${hudYourRank || hudRank} of ${hudRealPlayerCount}`;

  // =========================================================================
  // JSX
  // =========================================================================
  // OFFLINE MODE (BUILD-14): the OfflineGameEngine owns the game loop,
  // rendering, input, HUD, death screen, and extract screen. React only
  // renders the bare <canvas>; all overlays are DOM nodes the engine
  // appends to the canvas's parent element.
  if (isOffline) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-background select-none">
        <canvas
          ref={canvasRef}
          className="va-game-canvas absolute inset-0 h-full w-full"
          aria-label="Venom Arena offline practice canvas"
          style={{ touchAction: 'none' }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background select-none">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="va-game-canvas absolute inset-0 h-full w-full"
        aria-label="Venom Arena game canvas"
        style={{ touchAction: 'none' }}
      />

      {/* Connecting / error overlay */}
      {phase === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
          {connectionError ? (
            <>
              <AlertTriangle className="h-12 w-12 text-rose-500" />
              <p className="max-w-sm text-center text-lg font-semibold text-foreground">
                {connectionError}
              </p>
              <Button variant="outline" onClick={exitNow}>
                <LogOut className="mr-2 h-4 w-4" /> Back to lobby
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{connectingMsg || 'Connecting…'}</p>
            </>
          )}
        </div>
      )}

      {/* Reconnecting banner */}
      {isReconnecting && phase === 'playing' && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-300 backdrop-blur-sm">
          <WifiOff className="h-3.5 w-3.5" />
          Reconnecting…
        </div>
      )}

      {/* HUD: top-left (Carried Chips + Rank/Score/Kills/Boost + Real Players/Bots) — AUDIT-A Section A */}
      {phase !== 'connecting' && (
        <div className="pointer-events-none absolute left-3 top-3 z-40 flex max-w-sm flex-col gap-2 font-mono">
          {/* Carried Chips card — BUILD-13: hidden when isOfflineMode (no chips in offline). */}
          {!isOfflineMode && (
            <div className="rounded-lg border border-emerald-500/30 bg-slate-950/80 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                <Landmark className="h-3 w-3 text-emerald-400" />
                <span>Carried Chips</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                {hudCarried.toLocaleString()}<span className="ml-0.5 text-base">c</span>
              </div>
            </div>
          )}

          {/* Stars Earned card (online only) — shows extra chips collected from star chips */}
          {!isOfflineMode && hudCarried > (arena?.buyIn ?? 0) && (
            <div className="rounded-lg border border-amber-500/30 bg-slate-950/80 px-3 py-1.5 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                <Star className="h-3 w-3 text-amber-400" />
                <span>Stars Earned</span>
              </div>
              <div className="text-sm font-bold text-amber-400 tabular-nums">
                +{Math.max(0, hudCarried - (arena?.buyIn ?? 0)).toLocaleString()}<span className="ml-0.5 text-xs">c</span>
              </div>
            </div>
          )}

          {/* Stars in Arena card (online only) — shows how many golden star collectibles are on the floor */}
          {!isOfflineMode && starsInArena > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-slate-950/80 px-3 py-1.5 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                <Star className="h-3 w-3 text-yellow-400" />
                <span>Stars in Arena</span>
              </div>
              <div className="text-sm font-bold text-yellow-300 tabular-nums">
                {starsInArena}
              </div>
            </div>
          )}

          {/* Rank / Score / Kills / Boost card */}
          <div className="rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs">
              <Trophy className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-slate-400">Rank:</span>
              <span className="font-bold text-yellow-400">{rankDisplay}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-slate-400">Score:</span>
              <span className="font-bold text-white">{snakeLength.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <Skull className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-slate-400">Kills:</span>
              <span className="font-bold text-rose-400">{hudKills}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-slate-400">Boost:</span>
              <span className="font-bold text-amber-400">SPACE</span>
            </div>
          </div>

          {/* Active competitors card */}
          <div className="rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 backdrop-blur-sm text-xs">
            {isOfflineMode ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Offline Mode:</span>
                <span className="font-bold text-amber-400">1 Player</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Real Players:</span>
                <span className="font-bold text-indigo-400 animate-pulse">
                  {hudRealPlayerCount || hudRealPlayers} Active
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400">Bots:</span>
              <span className="font-bold text-slate-300">{hudBots}</span>
            </div>
          </div>
        </div>
      )}

      {/* HUD: top-right (Banked / FPS / Ping) — AUDIT-A Section A */}
      {phase !== 'connecting' && (
        <div className="pointer-events-none absolute right-3 top-3 z-40 flex flex-col items-end gap-1.5 font-mono">
          <div className="rounded-md border border-amber-500/30 bg-slate-950/80 px-2.5 py-1 text-right backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">BANKED</div>
            <div className="text-sm font-bold text-amber-300 tabular-nums">
              {player.bankedChips.toLocaleString()}c
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-950/80 px-2 py-1 text-[11px] backdrop-blur-sm">
            <span className="text-slate-400">{fps} fps</span>
            <span className={pingColor}>
              <Signal className="inline h-3 w-3" /> {ping < 0 ? '—' : `${ping}ms`}
            </span>
            {lowQuality && (
              <span className="rounded bg-amber-500/20 px-1 text-amber-300" title="Low quality mode (adaptive)">
                🎨 LQ
              </span>
            )}
          </div>
        </div>
      )}

      {/* BUILD-13: Chat + Minimap-toggle row (top-right, below BANKED/FPS). */}
      {phase === 'playing' && (
        <div className="absolute right-3 top-[92px] z-20 flex items-center gap-2 font-mono">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-primary/40 bg-card/80 backdrop-blur-sm"
            onClick={() => setChatOpen(true)}
            aria-label="Open chat"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-primary/40 bg-card/80 px-3 text-[10px] uppercase tracking-wider backdrop-blur-sm"
            onClick={() => setMinimapVisible((v) => !v)}
            aria-label={minimapVisible ? 'Collapse minimap' : 'Show minimap'}
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{minimapVisible ? 'Collapse' : 'Show Minimap'}</span>
          </Button>
        </div>
      )}

      {/* BUILD-13: Arena Leaderboard panel (top-right, below chat/minimap row).
          Online mode: top 10 real players by carriedChips (server-provided).
          Offline-mode edge case (realPlayerCount === 0): top 10 by score
          (you + bots). Collapsible — collapsed state renders a small icon
          button (mobile-friendly). */}
      {phase !== 'connecting' && (
        <div className="absolute right-3 top-[140px] z-20 max-h-[60vh] font-mono">
          {leaderboardOpen ? (
            <div className="w-[240px] max-w-[80vw] overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/90 backdrop-blur-md">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                  <Trophy className="h-3 w-3 text-yellow-500" />
                  <span>Arena Leaders</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLeaderboardOpen(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Collapse leaderboard"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* List */}
              <div className="max-h-72 overflow-y-auto p-1.5 va-scroll">
                {hudLeaderboard.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[10px] text-slate-500">
                    No real players yet.
                  </div>
                ) : (
                  hudLeaderboard.map((entry, i) => (
                    <div
                      key={entry.id || i}
                      className={`mb-0.5 flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${
                        entry.isPlayer
                          ? 'border border-indigo-500/30 bg-indigo-500/15'
                          : ''
                      }`}
                    >
                      <span className="w-5 shrink-0 text-right text-slate-500 tabular-nums">{i + 1}</span>
                      {entry.country && (
                        <span className="shrink-0 text-xs leading-none">
                          {countryFlag(entry.country)}
                        </span>
                      )}
                      <span
                        className={`flex-1 truncate ${
                          entry.isPlayer ? 'font-bold text-indigo-300' : 'text-slate-300'
                        }`}
                        title={entry.name}
                      >
                        {entry.name || 'Unknown'}
                      </span>
                      {entry.isPlayer && (
                        <span className={`shrink-0 rounded px-1 text-[9px] font-bold ${isOfflineMode ? 'bg-emerald-500/30 text-emerald-200' : 'bg-indigo-500/30 text-indigo-200'}`}>
                          YOU
                        </span>
                      )}
                      {isOfflineMode ? (
                        <span className="shrink-0 text-indigo-300 tabular-nums">
                          {entry.score.toLocaleString()}
                        </span>
                      ) : (
                        <span className="shrink-0 text-emerald-400 tabular-nums">
                          {entry.carriedChips.toLocaleString()}c
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLeaderboardOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/85 px-3 text-[10px] uppercase tracking-wider text-slate-400 backdrop-blur-sm hover:text-white"
              aria-label="Show leaderboard"
            >
              <ChevronDown className="h-3.5 w-3.5 text-yellow-500" />
              <span className="hidden sm:inline">Show Leaderboard</span>
            </button>
          )}
        </div>
      )}

      {/* BUILD-13: Full-screen arena map overlay close button (M key toggle).
          The map itself is canvas-drawn; this is the HTML close affordance. */}
      {fullMapOpen && phase === 'playing' && (
        <button
          type="button"
          onClick={() => setFullMapOpen(false)}
          className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 backdrop-blur-sm hover:text-white"
          aria-label="Close full map"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Death vignette: 3-second red radial fade after death, before end screen. z-30 (above canvas, below HUD z-40, below EndOverlay z-50). */}
      {showDeathVignette && (
        <div
          className="absolute inset-0 z-30 pointer-events-none animate-[fadeIn_300ms_ease-out]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(220, 38, 38, 0.6) 100%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Quick Chat Emotes Bar (bottom-left) — AUDIT-A Section H */}
      {phase === 'playing' && (
        <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-20 w-[min(60vw,280px)] rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 backdrop-blur-md">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <MessageSquare className="h-3 w-3 text-indigo-400" />
            <span>Emotes (Keys 1-5)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => triggerEmote('GG! 🏆')}
              className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-800"
            >
              GG! 🏆
            </button>
            <button
              type="button"
              onClick={() => triggerEmote('Target Spot! 🎯')}
              className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-800"
            >
              Target! 🎯
            </button>
            <button
              type="button"
              onClick={() => triggerEmote('Fleeing! 🏃💨')}
              className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-800"
            >
              Flee! 🏃💨
            </button>
            <button
              type="button"
              onClick={() => triggerEmote('Get Ripped! 💪')}
              className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-800"
            >
              Ripped! 💪
            </button>
            <button
              type="button"
              onClick={() => triggerEmote('Extracting soon! ⚡')}
              className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-800"
            >
              Extracting! ⚡
            </button>
          </div>
        </div>
      )}

      {/* Kill Feed (top-left, below HUD stats) — online arena event log */}
      {killFeed.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-28 z-20 flex w-64 max-w-[70vw] flex-col gap-0.5 font-mono">
          {killFeed.map(entry => (
            <div
              key={entry.id}
              className="animate-in fade-in slide-in-from-left-2 flex items-center gap-1 rounded bg-slate-950/75 px-2 py-1 text-[10px] backdrop-blur-sm"
            >
              {entry.cause === 'wall' ? (
                <span className="text-slate-400">
                  <span className={entry.victimIsBot ? 'text-orange-400' : 'text-slate-200'}>{entry.victimName}</span>
                  <span className="text-red-400"> hit the wall</span>
                </span>
              ) : (
                <span className="text-slate-400">
                  <span className={entry.killerIsBot ? 'text-orange-400' : 'text-emerald-400'}>{entry.killerName}</span>
                  <span className="text-slate-500"> eliminated </span>
                  <span className={entry.victimIsBot ? 'text-orange-400' : 'text-red-400'}>{entry.victimName}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hold-to-Extract popup (top-center) — AUDIT-A hold-to-extract HUD */}
      {phase === 'playing' && !endScreen && (
        <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 flex flex-col items-center gap-1 text-center">
          <p className="text-[11px] font-mono text-slate-400">
            Hold <kbd className="rounded border border-slate-600 bg-slate-800 px-1 text-[10px] text-slate-200">E</kbd> or press the button below to cash out safely!
          </p>
          {extracting ? (
            <div className="rounded-lg border border-amber-500/40 bg-slate-950/85 px-4 py-2 backdrop-blur-sm">
              <div className="text-xs font-bold text-amber-400">
                EXTRACTING CHIPS ({Math.round(extractProgress * 100)}%)
              </div>
              <div className="mt-1 h-2 w-48 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-[width] duration-100"
                  style={{ width: `${extractProgress * 100}%` }}
                />
              </div>
              {/* BUILD-13: dynamic commission display. */}
              {!isOfflineMode && (
                <div className="mt-1.5 text-[10px] font-mono">
                  {hudCommissionRate > 0 ? (
                    <span className="text-yellow-500">
                      FEE: {Math.round(hudCommissionRate * 100)}%
                    </span>
                  ) : (
                    <span className="text-emerald-400">
                      FEE: 0% (LOW POPULATION)
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] font-bold text-emerald-400">
              {isOffline ? 'HOLD TO LEAVE PRACTICE ARENA' : 'HOLD TO EXTRACT SUCCESSFUL!'}
            </div>
          )}
        </div>
      )}

      {/* Mobile controls: BOOST + EXTRACT (bottom-right) — AUDIT-A Section G */}
      {phase === 'playing' && (
        <div className="absolute bottom-6 right-6 flex items-end gap-3">
          <button
            type="button"
            aria-label="Boost"
            onPointerDown={onBoostPointerDown}
            onPointerUp={onBoostPointerUp}
            onPointerCancel={onBoostPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            className="flex h-16 w-16 touch-none select-none flex-col items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/20 text-amber-300 shadow-lg transition-transform active:scale-95"
          >
            <Zap className="h-6 w-6" />
            <span className="text-[10px] font-bold">BOOST</span>
          </button>
          <button
            type="button"
            aria-label="Extract chips"
            onPointerDown={onExtractPointerDown}
            onPointerUp={onExtractPointerUp}
            onPointerCancel={onExtractPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            className={`flex h-20 w-20 touch-none select-none flex-col items-center justify-center rounded-full border shadow-lg transition-transform active:scale-95 ${
              extracting
                ? 'border-emerald-400 bg-emerald-500/40 text-white'
                : 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
            }`}
          >
            <Trophy className="h-6 w-6" />
            <span className="text-[10px] font-bold">
              {extracting ? `${Math.round(extractProgress * 100)}%` : 'EXTRACT'}
            </span>
          </button>
        </div>
      )}

      {/* Exit button (always visible bottom-left of controls area) */}
      {phase === 'playing' && (
        <button
          type="button"
          onClick={exitNow}
          className="absolute bottom-6 left-3 sm:left-28 flex h-10 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/80 px-3 text-xs font-medium text-slate-400 backdrop-blur-sm hover:text-foreground"
          aria-label="Leave arena"
        >
          <LogOut className="h-3.5 w-3.5" /> Leave
        </button>
      )}

      {/* End screen: death or extract */}
      {phase === 'ended' && endScreen && (
        <EndOverlay
          endScreen={endScreen}
          arena={arena}
          isOffline={isOffline}
          previousLevel={player.level}
          previousBankedChips={player.bankedChips}
          player={{ name: player.name, userTag: player.userTag, country: player.country, level: player.level, clanTag: player.clanTag }}
          onPlayAgain={playAgain}
          onExit={exitNow}
          onAddRival={() => {
            if (endScreen.killer?.name) {
              toast({
                title: 'Rival Added',
                description: `⚔️ ${endScreen.killer.name} added to your Rival List! Hunt them in future lobbies!`,
              });
            }
          }}
          onAddFriend={() => {
            if (endScreen.killer?.name) {
              toast({
                title: 'Friend Added',
                description: `🤝 Added ${endScreen.killer.name} (${endScreen.killer.tag ?? '?'}) to your Friends list!`,
              });
            }
          }}
          onViewProfile={() => {
            if (endScreen.killer?.tag) {
              toast({
                title: 'Viewing Profile',
                description: `👁️ Viewing ${endScreen.killer.name}'s profile (${endScreen.killer.tag})`,
              });
            }
          }}
        />
      )}

      {/* Chat dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Send a message</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              autoFocus
              maxLength={200}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitChat();
                }
              }}
              placeholder="Type a message…"
            />
            <Button onClick={submitChat} disabled={!chatInput.trim()}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChatOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
