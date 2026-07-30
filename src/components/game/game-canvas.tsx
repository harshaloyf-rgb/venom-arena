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
import { io, type Socket } from 'socket.io-client';
import { playExtractStart, playExtractSuccess, playExtractRestart, playDeath, playFoodCollect, playKill, playBoost, playWallHit, initGameAudio, setGameAudioMuted } from '@/lib/game-audio';
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
  Pause,
  Play,
  RotateCcw,
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
  ZoomIn,
  ZoomOut,
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
  getCosmeticById,
} from '@/lib/game-config';
import type {
  ArenaLeaderboardEntry,
  GameSnapshot,
  MatchResult,
  PlayerProfile,
  SnakeSnapshot,
} from '@/lib/types';

import {
  drawChipLabel,
  drawExtractionRing,
  drawFood,
  drawFoodOrb,
  drawFullMap,
  drawGrid,
  drawMapBoundary,
  drawMinimap,
  drawParticles,
  drawSnake,
  drawSnakeWithLayering,
  drawStarCollectible,
  getArenaRadius,
  type FrameRenderCtx,
  type Particle,
} from './render-helpers';
import { OfflineGameEngine, type OfflineExitResult, type OfflineState } from './offline-engine';
import { OnlineReplayPlayer, type OnlineReplayData } from './online-replay-player';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GameCanvasProps {
  arenaId: string;
  player: PlayerProfile;
  onExit: (result?: MatchResult) => void;
}

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

interface InputPayload {
  angle: number;
  wantsBoost: boolean;
}

// ---------------------------------------------------------------------------
// Internal helper types
// ---------------------------------------------------------------------------

type Phase = 'connecting' | 'playing' | 'ended';

interface KillerInfo {
  name?: string;
  tag?: string;
  color?: string;
  isBot?: boolean;
}

interface JoystickState {
  active: boolean;
  pointerId: number;
  originX: number;
  originY: number;
  curX: number;
  curY: number;
}

interface EndScreenState {
  outcome: 'extract' | 'death';
  killer?: KillerInfo;
  result?: MatchResult;
  durationSeconds: number;
  carriedChips: number;
  score: number;
  /** Combined replay frames: 15s pre-death + 15s post-death. */
  replayFrames?: GameSnapshot[];
  /** The player's snake id — used to follow them in replay. */
  replayMyId?: string;
  /** Index in replayFrames array where the death occurs. */
  replayDeathFrameIdx?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCKET_PORT = 3001;
const MAX_PARTICLES = 200; // [FIXES C10] capped particle array
const INPUT_HEARTBEAT_MS = 200;
const PING_INTERVAL_MS = 2500;
const FPS_LOW_THRESHOLD = 40;
const FPS_HIGH_THRESHOLD = 55;
const FPS_LOW_DURATION_MS = 2000;
const FPS_HIGH_DURATION_MS = 5000;
const MOUSE_DEADZONE_PX = 15; // [FIXES I2] old was 5px → jittery
const JOYSTICK_DEADZONE = 0.18;
const JOYSTICK_MAX_RADIUS_PX = 70;
const JOYSTICK_BOOST_MAGNITUDE = 0.6; // >60% deflection = boost

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

  const particlesRef = useRef<Particle[]>([]);
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
  // SOCKET LIFECYCLE EFFECT (mount-once per arenaId).
  // Wires every server event with a paired `.off(...)` cleanup, re-emits
  // `join_arena` on every `connect`/`reconnect`, and disconnects on unmount.
  // [FIXES C7, C8, S1, S2, S3]
  // =========================================================================
  useEffect(() => {
    // --- Offline mode: skip Socket.IO entirely. The OfflineGameEngine
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
        if (data.newLevel > player.level) {
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
  }, [arenaId, isOffline, player.level, safeTimeout, toast]);

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

  // =========================================================================
  // CANVAS + RENDER LOOP EFFECT (mount-once).
  // =========================================================================
  useEffect(() => {
    // Offline mode: the OfflineGameEngine owns the canvas + rAF loop.
    if (isOffline) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // ----- DPR-aware sizing -----
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR at 2 for perf
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      // Invalidate the metallic gradient cache (gradients are device-pixel bound).
      metallicCacheRef.current.clear();
    };
    resize();
    resizeObserverRef.current = new ResizeObserver(resize);
    resizeObserverRef.current.observe(canvas);

    // ----- FPS tracking with adaptive quality -----
    const updateFps = (now: number) => {
      const acc = fpsAccumRef.current;
      acc.frames += 1;
      if (acc.lastSecond === 0) acc.lastSecond = now;
      const dt = now - acc.lastSecond;
      if (dt >= 1000) {
        const measured = (acc.frames * 1000) / dt;
        setFps(Math.round(measured));
        if (measured < FPS_LOW_THRESHOLD) {
          if (acc.lowSince === 0) acc.lowSince = now;
          if (acc.highSince !== 0) acc.highSince = 0;
          if (now - acc.lowSince >= FPS_LOW_DURATION_MS && !lowQualityRef.current) {
            setLowQuality(true);
          }
        } else if (measured > FPS_HIGH_THRESHOLD) {
          if (acc.highSince === 0) acc.highSince = now;
          if (acc.lowSince !== 0) acc.lowSince = 0;
          if (now - acc.highSince >= FPS_HIGH_DURATION_MS && lowQualityRef.current) {
            setLowQuality(false);
          }
        } else {
          // Hysteresis band — don't flap.
          acc.lowSince = 0;
          acc.highSince = 0;
        }
        acc.frames = 0;
        acc.lastSecond = now;
      }
    };

    // ----- Particle update -----
    const updateParticles = (dtMs: number) => {
      const arr = particlesRef.current;
      const dt = dtMs / 1000;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life -= dtMs;
        if (p.life <= 0) {
          arr.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      // Hard cap (defensive — spawns are already throttled).
      if (arr.length > MAX_PARTICLES) {
        arr.splice(0, arr.length - MAX_PARTICLES);
      }
    };

    // ----- Main loop -----
    let lastFrameTime = performance.now();
    const frame = (now: number) => {
      if (!isMountedRef.current) return;
      rafRef.current = requestAnimationFrame(frame);

      const dt = now - lastFrameTime;
      lastFrameTime = now;

      updateFps(now);
      updateParticles(dt);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW === 0 || cssH === 0) return;

      // --- Clear ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = '#020617'; // Deep Slate (matches arena bg)
      ctx.fillRect(0, 0, cssW, cssH);

      // --- BUILD-13: full-screen arena map overlay (M key) ---
      // Replaces the regular scene while open. Still emits input + ping
      // so the snake keeps moving in the background.
      if (fullMapOpenRef.current) {
        const fmSnap = snapshotRef.current;
        if (fmSnap) {
          drawFullMap({
            ctx,
            w: cssW,
            h: cssH,
            worldSize: fmSnap.worldSize ?? WORLD_SIZE,
            // Use dynamic mapRadius from server snapshot, fallback to breathing formula
            arenaRadius: (fmSnap.mapRadius && fmSnap.mapRadius > 0) ? fmSnap.mapRadius : getArenaRadius(now),
            snakes: fmSnap.snakes,
            myId: mySnakeIdRef.current ?? '',
          });
          maybeEmitInput(now);
          if (now - lastPingSentRef.current >= PING_INTERVAL_MS) {
            lastPingSentRef.current = now;
            const s = socketRef.current;
            if (s && s.connected) {
              const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
              pendingPingsRef.current.set(id, now);
              s.emit('ping', { t: now, id });
            }
          }
          return;
        }
      }

      // --- Camera follow ---
      const snap = snapshotRef.current;
      const myId = mySnakeIdRef.current;
      const mySnake = snap && myId ? snap.snakes.find((s) => s.id === myId) : undefined;
      const head = mySnake?.points?.[0];
      const cam = camRef.current;
      if (head) {
        if (!camInitRef.current) {
          cam.x = head.x;
          cam.y = head.y;
          camInitRef.current = true;
        } else {
          // Smooth lerp
          cam.x += (head.x - cam.x) * 0.18;
          cam.y += (head.y - cam.y) * 0.18;
        }
        // Zoom based on body length: bigger snake → zoom out.
        const len = mySnake.points.length;
        const targetZoom = Math.max(0.6, Math.min(1.4, 1.4 - (len - 12) * 0.008));
        cam.zoom += (targetZoom - cam.zoom) * 0.05;
      }

      // --- Build per-frame render context ---
      const playerSkin = getCosmeticById(playerSkinRef.current);
      const rc: FrameRenderCtx = {
        ctx,
        w: cssW,
        h: cssH,
        camX: cam.x,
        camY: cam.y,
        zoom: cam.zoom,
        worldSize: snap?.worldSize ?? WORLD_SIZE,
        lowQuality: lowQualityRef.current,
        myId: myId ?? '',
        now,
        metallicCache: metallicCacheRef.current,
        playerSkin,
        dpr,
      };

      // --- World transform ---
      ctx.translate(cssW / 2, cssH / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // --- Draw world (dynamic arena boundary + grid) ---
      // Use the server-provided dynamic mapRadius for online arenas
      const dynamicMapRadius = snap?.mapRadius && snap.mapRadius > 0 ? snap.mapRadius : undefined;
      const mapCenterX = snap?.mapCenterX ?? rc.worldSize / 2;
      const mapCenterY = snap?.mapCenterY ?? rc.worldSize / 2;

      if (dynamicMapRadius) {
        // Online mode: draw grid + dynamic map boundary
        drawGrid(rc);
        drawMapBoundary(ctx, mapCenterX, mapCenterY, dynamicMapRadius, now);
      } else {
        // Fallback: fixed breathing arena
        drawGrid(rc);
      }

      // --- Draw food ---
      if (snap) {
        drawFood(rc, snap.foods);
      }

      // --- Draw snakes with opacity layering (player last, on top) ---
      if (snap) {
        // Use drawSnakeWithLayering for opacity system:
        // larger snakes fade to 75% when a smaller snake passes underneath
        for (const s of snap.snakes) {
          if (s.id !== myId) drawSnakeWithLayering(rc, s, snap.snakes);
        }
        if (mySnake) drawSnake(rc, mySnake);

        // Draw chip labels above real player heads (NOT bots)
        for (const s of snap.snakes) {
          if (s.isPlayer && s.carriedChips > 0 && s.points && s.points.length > 0) {
            const head = s.points[0];
            drawChipLabel(ctx, head.x, head.y, s.carriedChips, s.visualRadius ?? s.size, cam.zoom);
          }
        }

        // Draw extraction progress rings — ONLY visible to the extracting player themselves
        for (const s of snap.snakes) {
          if (s.isExtracting && s.extractionProgress > 0 && s.points && s.points.length > 0 && s.id === myId) {
            const head = s.points[0];
            drawExtractionRing(ctx, head.x, head.y, s.visualRadius ?? s.size, s.extractionProgress, cam.zoom);
          }
        }
      }

      // --- Draw particles ---
      drawParticles(rc, particlesRef.current);

      // --- Reset transform for screen-space drawing ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // --- Minimap (bottom-right per AUDIT-A radar) ---
      // BUILD-13: hidden when the user toggles it off via the top-right
      // "Collapse" button. Range clamped to 1800 so only nearby snakes
      // render (per BUILD-13 spec). Offline mode never reaches this code
      // path (the OfflineGameEngine owns the canvas in practice arenas).
      if (snap && minimapVisibleRef.current) {
        const mmSize = 96;
        const mmX = cssW - mmSize - 12;
        const mmY = cssH - mmSize - 12;
        // Use dynamic mapRadius from server snapshot, fallback to breathing formula
        const mmArenaRadius = dynamicMapRadius ?? getArenaRadius(now);
        drawMinimap({
          ctx,
          x: mmX,
          y: mmY,
          size: mmSize,
          worldSize: rc.worldSize,
          arenaRadius: mmArenaRadius,
          snakes: snap.snakes,
          myId: myId ?? '',
          range: 1800,
        });
      }

      // --- Joystick (touch) ---
      const js = joystickRef.current;
      if (js && js.active) {
        const dx = js.curX - js.originX;
        const dy = js.curY - js.originY;
        const dist = Math.min(JOYSTICK_MAX_RADIUS_PX, Math.hypot(dx, dy));
        const ang = Math.atan2(dy, dx);
        const stickX = js.originX + Math.cos(ang) * dist;
        const stickY = js.originY + Math.sin(ang) * dist;
        // Outer ring
        ctx.beginPath();
        ctx.arc(js.originX, js.originY, JOYSTICK_MAX_RADIUS_PX, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(129, 140, 248, 0.12)'; // indigo-400 alpha
        ctx.fill();
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Inner stick
        ctx.beginPath();
        ctx.arc(stickX, stickY, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(129, 140, 248, 0.85)';
        ctx.fill();
      }

      // --- Emit input (throttled) ---
      maybeEmitInput(now);

      // --- Send periodic ping ---
      if (now - lastPingSentRef.current >= PING_INTERVAL_MS) {
        lastPingSentRef.current = now;
        const s = socketRef.current;
        if (s && s.connected) {
          const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
          pendingPingsRef.current.set(id, now);
          s.emit('ping', { t: now, id });
        }
      }
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [isOffline, maybeEmitInput]);

  // =========================================================================
  // INPUT effect — mouse + keyboard + touch joystick + pointer buttons.
  // [FIXES I1, I2, I4, I6, I9, I11, C19]
  // =========================================================================
  useEffect(() => {
    // Offline mode: the OfflineGameEngine attaches its own input listeners.
    if (isOffline) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ----- Compute input angle + boost from current sources -----
    // Priority: touch joystick > keyboard > mouse.
    // Boost fires when SPACE held OR boost button held OR joystick magnitude
    // > 0.6 (matches original AUDIT-A boost logic + mobile joystick convention).
    const computeAngleAndBoost = (): { angle: number | null; boost: boolean } => {
      const spaceHeld = keysRef.current.has(' ') || keysRef.current.has('space') || boostHoldRef.current;
      // Touch joystick
      if (touchAngleRef.current !== null) {
        return { angle: touchAngleRef.current, boost: touchBoostRef.current || spaceHeld };
      }
      // Keyboard
      const k = keysRef.current;
      let kx = 0;
      let ky = 0;
      if (k.has('w') || k.has('arrowup')) ky -= 1;
      if (k.has('s') || k.has('arrowdown')) ky += 1;
      if (k.has('a') || k.has('arrowleft')) kx -= 1;
      if (k.has('d') || k.has('arrowright')) kx += 1;
      if (kx !== 0 || ky !== 0) {
        return { angle: Math.atan2(ky, kx), boost: spaceHeld };
      }
      // Mouse
      if (mouseActiveRef.current) {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = mousePosRef.current.x - cx;
        const dy = mousePosRef.current.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > MOUSE_DEADZONE_PX) {
          return { angle: Math.atan2(dy, dx), boost: spaceHeld || mouseLeftDownRef.current };
        }
      }
      return { angle: null, boost: false };
    };

    // Expose computeAngleAndBoost to the rAF loop via a ref.
    computeInputRef.current = computeAngleAndBoost;

    // ----- Mouse -----
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      mouseActiveRef.current = true;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseLeftDownRef.current = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseLeftDownRef.current = false;
    };
    const onMouseLeave = () => {
      mouseLeftDownRef.current = false;
      // Keep last position but mark inactive so we don't keep steering if
      // the user moves off the canvas (e.g., onto the HUD).
    };

    // ----- Keyboard -----
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // [FIXES I4] prevent default for arrows/space so the page doesn't scroll
      if (
        k === 'arrowup' ||
        k === 'arrowdown' ||
        k === 'arrowleft' ||
        k === 'arrowright' ||
        k === ' ' ||
        k === 'spacebar'
      ) {
        e.preventDefault();
      }
      if (k === 'escape') {
        if (phaseRef.current === 'ended') {
          onExitRef.current();
        }
        return;
      }
      // Hold E to extract
      if (k === 'e' && phaseRef.current === 'playing' && !matchEndedRef.current && !extractActiveRef.current) {
        socketRef.current?.emit('extract', {});
        extractActiveRef.current = true;
      }
      // BUILD-13: M key toggles the full-screen arena map overlay.
      if (k === 'm' && phaseRef.current === 'playing') {
        setFullMapOpen((prev) => !prev);
      }
      // Quick chat emote keys 1-5
      if (phaseRef.current === 'playing' && ['1', '2', '3', '4', '5'].includes(k)) {
        const emotes = [
          'GG! 🏆',
          'Target Spot! 🎯',
          'Fleeing! 🏃💨',
          'Get Ripped! 💪',
          'Extracting soon! ⚡',
        ];
        const idx = parseInt(k, 10) - 1;
        if (idx >= 0 && idx < emotes.length) {
          socketRef.current?.emit('chat', { message: emotes[idx] });
        }
      }
      // Normalize space
      const normalized = k === 'spacebar' ? ' ' : k;
      keysRef.current.add(normalized);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Release E cancels extract
      if (k === 'e' && extractActiveRef.current) {
        socketRef.current?.emit('cancel_extract', {});
        extractActiveRef.current = false;
      }
      const normalized = k === 'spacebar' ? ' ' : k;
      keysRef.current.delete(normalized);
    };
    // [FIXES I9] clear keys on blur so they don't stick
    const onBlur = () => {
      keysRef.current.clear();
      mouseActiveRef.current = false;
      boostHoldRef.current = false;
    };

    // ----- Touch joystick (bottom-left quadrant of canvas) -----
    const findJoystickTouch = (touches: TouchList): Touch | null => {
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        // Bottom-left quadrant
        if (x < rect.width / 2 && y > rect.height / 2) {
          return t;
        }
      }
      return null;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (joystickRef.current) return;
      const t = findJoystickTouch(e.touches);
      if (!t) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      joystickRef.current = {
        active: true,
        pointerId: t.identifier,
        originX: t.clientX - rect.left,
        originY: t.clientY - rect.top,
        curX: t.clientX - rect.left,
        curY: t.clientY - rect.top,
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      const js = joystickRef.current;
      if (!js) return;
      let t: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === js.pointerId) {
          t = e.touches[i];
          break;
        }
      }
      if (!t) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      js.curX = t.clientX - rect.left;
      js.curY = t.clientY - rect.top;
      const dx = js.curX - js.originX;
      const dy = js.curY - js.originY;
      const dist = Math.hypot(dx, dy);
      const magnitude = Math.min(1, dist / JOYSTICK_MAX_RADIUS_PX);
      if (magnitude > JOYSTICK_DEADZONE) {
        touchAngleRef.current = Math.atan2(dy, dx);
        // Boost when magnitude > 0.6 (BUILD-10 spec)
        touchBoostRef.current = magnitude > JOYSTICK_BOOST_MAGNITUDE;
      } else {
        touchAngleRef.current = null;
        touchBoostRef.current = false;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      const js = joystickRef.current;
      if (!js) return;
      let stillActive = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === js.pointerId) {
          stillActive = true;
          break;
        }
      }
      if (!stillActive) {
        joystickRef.current = null;
        touchAngleRef.current = null;
        touchBoostRef.current = false;
      }
    };
    const onTouchCancel = (e: TouchEvent) => onTouchEnd(e);

    // Wire up
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchCancel);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isOffline]);

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

// ---------------------------------------------------------------------------
// ReplayPlayer sub-component — renders 15s pre-death + 15s post-death replay
// ---------------------------------------------------------------------------

interface ReplayPlayerProps {
  frames: GameSnapshot[];
  myId: string;
  deathFrameIdx?: number; // index where death occurs in frames
  onClose: () => void;
}

const REPLAY_SPEEDS = [0.25, 0.5, 1, 2] as const;

function ReplayPlayer({ frames, myId, deathFrameIdx, onClose }: ReplayPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameIdxRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const zoomRef = useRef(0.8);
  const lastTimeRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(0.8);
  const [frameIdx, setFrameIdx] = useState(0);
  const totalFrames = frames.length;

  // Spectator camera state (refs for use inside rAF)
  const deathCamPosRef = useRef<{ x: number; y: number } | null>(null);
  const spectatorFollowIdRef = useRef<string | null>(null);
  const prevFoodsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const deathFoodCollected = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalFrames === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Reset spectator state on mount
    deathCamPosRef.current = null;
    spectatorFollowIdRef.current = null;
    prevFoodsRef.current = new Map();
    deathFoodCollected.current = false;

    const render = (now: number) => {
      if (!playingRef.current) {
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      const dt = now - lastTimeRef.current;
      const frameInterval = 50 / speedRef.current; // 50ms per frame at 1x
      if (dt >= frameInterval) {
        frameIdxRef.current = (frameIdxRef.current + 1) % totalFrames;
        lastTimeRef.current = now;
        setFrameIdx(frameIdxRef.current);
      }

      const snap = frames[frameIdxRef.current];
      if (!snap) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      // Clear
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // --- Spectator Camera Logic ---
      const isAfterDeath = deathFrameIdx != null && frameIdxRef.current >= deathFrameIdx;
      let camX: number;
      let camY: number;
      const z = zoomRef.current;

      if (!isAfterDeath) {
        // Before death: follow player
        const me = snap.snakes.find((s) => s.id === myId);
        camX = me?.points?.[0]?.x ?? snap.mapCenterX ?? 4000;
        camY = me?.points?.[0]?.y ?? snap.mapCenterY ?? 4000;
      } else {
        // At/after death frame
        if (!deathCamPosRef.current) {
          // Record death position: center of body (where food drops), not head
          const deathFrame = frames[Math.min(deathFrameIdx!, frames.length - 1)];
          const me = deathFrame?.snakes.find((s) => s.id === myId);
          if (me?.points && me.points.length > 0) {
            // Center camera on midpoint of body so food spread is visible
            const midIdx = Math.floor(me.points.length / 2);
            const midPt = me.points[Math.min(midIdx, me.points.length - 1)];
            deathCamPosRef.current = {
              x: midPt.x,
              y: midPt.y,
            };
          } else {
            deathCamPosRef.current = {
              x: snap.mapCenterX ?? 4000,
              y: snap.mapCenterY ?? 4000,
            };
          }
          // Snapshot current food IDs near death for tracking
          const curFoods = new Map<string, { x: number; y: number }>();
          for (const f of deathFrame?.foods ?? []) {
            curFoods.set(f.id, { x: f.x, y: f.y });
          }
          prevFoodsRef.current = curFoods;
        }

        if (!deathFoodCollected.current && spectatorFollowIdRef.current === null) {
          // Check if any food near death position was collected
          const deathPos = deathCamPosRef.current;
          const curFoodIds = new Set<string>();
          const collectedNearDeath: Array<{ x: number; y: number }> = [];

          for (const f of snap.foods) {
            curFoodIds.add(f.id);
          }

          // Find foods from previous frame that are now gone
          for (const [foodId, fPos] of prevFoodsRef.current) {
            if (!curFoodIds.has(foodId)) {
              const dx = fPos.x - deathPos.x;
              const dy = fPos.y - deathPos.y;
              if (Math.sqrt(dx * dx + dy * dy) < 300) {
                collectedNearDeath.push(fPos);
              }
            }
          }

          if (collectedNearDeath.length > 0) {
            deathFoodCollected.current = true;
            // Find closest snake to the first collected food position
            const targetPos = collectedNearDeath[0];
            let closestSnake: { id: string; dist: number } | null = null;
            for (const s of snap.snakes) {
              if (!s.points || s.points.length === 0) continue;
              const head = s.points[0];
              const dx = head.x - targetPos.x;
              const dy = head.y - targetPos.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (!closestSnake || d < closestSnake.dist) {
                closestSnake = { id: s.id, dist: d };
              }
            }
            if (closestSnake) {
              spectatorFollowIdRef.current = closestSnake.id;
            }
          }

          // Update prev foods for next frame comparison
          const newFoods = new Map<string, { x: number; y: number }>();
          for (const f of snap.foods) {
            newFoods.set(f.id, { x: f.x, y: f.y });
          }
          prevFoodsRef.current = newFoods;
        }

        if (spectatorFollowIdRef.current) {
          // Follow the entity that collected death food
          const target = snap.snakes.find((s) => s.id === spectatorFollowIdRef.current);
          if (target?.points?.[0]) {
            camX = target.points[0].x;
            camY = target.points[0].y;
          } else {
            camX = deathCamPosRef.current.x;
            camY = deathCamPosRef.current.y;
          }
        } else {
          // No one collected food near death — stay at death position
          camX = deathCamPosRef.current.x;
          camY = deathCamPosRef.current.y;
          // Slow zoom out
          zoomRef.current = Math.max(0.3, zoomRef.current - 0.0003);
        }
      }

      // World transform
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(w / 2, h / 2);
      ctx.scale(z, z);
      ctx.translate(-camX, -camY);

      // Draw grid (minimal)
      const gridSize = 80;
      const viewL = camX - w / 2 / z - gridSize;
      const viewR = camX + w / 2 / z + gridSize;
      const viewT = camY - h / 2 / z - gridSize;
      const viewB = camY + h / 2 / z + gridSize;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const sX = Math.floor(viewL / gridSize) * gridSize;
      const eX = Math.ceil(viewR / gridSize) * gridSize;
      const sY = Math.floor(viewT / gridSize) * gridSize;
      const eY = Math.ceil(viewB / gridSize) * gridSize;
      for (let x = sX; x <= eX; x += gridSize) { ctx.moveTo(x, viewT); ctx.lineTo(x, viewB); }
      for (let y = sY; y <= eY; y += gridSize) { ctx.moveTo(viewL, y); ctx.lineTo(viewR, y); }
      ctx.stroke();

      // Draw food
      for (const f of snap.foods) {
        if (f.x < viewL || f.x > viewR || f.y < viewT || f.y > viewB) continue;
        if (f.isStarChip) {
          drawStarCollectible(ctx, f.x, f.y, Math.max(6, f.size + 4), now, false);
        } else {
          drawFoodOrb(ctx, f.x, f.y, f.size, f.value, f.color, f.glowColor ?? '', now, true);
        }
      }

      // Draw snakes
      for (const s of snap.snakes) {
        if (!s.points || s.points.length === 0) continue;
        const head = s.points[0];
        if (head.x < viewL - 100 || head.x > viewR + 100 || head.y < viewT - 100 || head.y > viewB + 100) continue;

        const rc: FrameRenderCtx = {
          ctx, w, h, camX, camY, zoom: z,
          worldSize: snap.worldSize, lowQuality: true,
          myId, now, metallicCache: new Map(), playerSkin: undefined, dpr,
        };
        drawSnake(rc, s);
      }

      // Draw map boundary
      if (snap.mapRadius && snap.mapRadius > 0) {
        drawMapBoundary(ctx, snap.mapCenterX ?? 4000, snap.mapCenterY ?? 4000, snap.mapRadius, now);
      }

      // Draw replay watermark
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('⏺ REPLAY', 10, 10);
      const isPostDeathFrame = deathFrameIdx != null && frameIdxRef.current >= deathFrameIdx;
      const preSec2 = deathFrameIdx != null ? Math.min(15, Math.floor(frameIdxRef.current / 20)) : Math.floor(frameIdxRef.current / 20);
      const postSec2 = deathFrameIdx != null && frameIdxRef.current > deathFrameIdx ? Math.min(15, Math.floor((frameIdxRef.current - deathFrameIdx) / 20)) : 0;
      const timeStr = isPostDeathFrame
        ? `⛔ DEATH +${postSec2}s | Frame ${frameIdxRef.current + 1}/${totalFrames}`
        : `Frame ${frameIdxRef.current + 1}/${totalFrames} | -${Math.max(0, 15 - preSec2)}s to death`;
      ctx.fillStyle = isPostDeathFrame ? 'rgba(244, 63, 94, 0.9)' : 'rgba(226, 232, 240, 0.6)';
      ctx.font = '10px monospace';
      ctx.fillText(timeStr, 10, 26);

      rafRef.current = requestAnimationFrame(render);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [frames, myId, totalFrames, deathFrameIdx]);

  const togglePlay = () => {
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  };

  const cycleSpeed = () => {
    const curIdx = REPLAY_SPEEDS.indexOf(speed as 0.25 | 0.5 | 1 | 2);
    const nextIdx = (curIdx + 1) % REPLAY_SPEEDS.length;
    const newSpeed = REPLAY_SPEEDS[nextIdx];
    speedRef.current = newSpeed;
    setSpeed(newSpeed);
  };

  const adjustZoom = (delta: number) => {
    zoomRef.current = Math.max(0.3, Math.min(2, zoomRef.current + delta));
    setZoom(zoomRef.current);
  };

  const restart = () => {
    frameIdxRef.current = 0;
    playingRef.current = true;
    setPlaying(true);
    setFrameIdx(0);
  };

  if (totalFrames === 0) return null;

  const progress = totalFrames > 0 ? (frameIdx / (totalFrames - 1)) * 100 : 0;
  const deathProgress = deathFrameIdx != null && totalFrames > 0 ? (deathFrameIdx / (totalFrames - 1)) * 100 : -1;

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
      {/* Replay canvas */}
      <canvas
        ref={canvasRef}
        className="w-full aspect-video cursor-crosshair"
        style={{ display: 'block' }}
      />

      {/* Progress bar with death marker */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
        <div className="h-full bg-rose-500 transition-all duration-75" style={{ width: `${progress}%` }} />
        {deathProgress >= 0 && (
          <div className="absolute top-0 h-full w-0.5 bg-yellow-400" style={{ left: `${deathProgress}%` }} title="💀 Death" />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={restart}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
          title="Restart"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={cycleSpeed}
          className="flex h-8 items-center justify-center rounded-md bg-slate-900/80 px-2.5 text-white text-xs font-mono font-bold hover:bg-slate-800 transition-colors"
        >
          {speed}x
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustZoom(-0.15)}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 font-mono w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => adjustZoom(0.15)}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EndOverlay sub-component (death or extract) — matches AUDIT-A Sections B+C
// ---------------------------------------------------------------------------

interface EndOverlayProps {
  endScreen: EndScreenState;
  arena: { name: string; buyIn: number };
  isOffline: boolean;
  previousLevel: number;
  previousBankedChips: number;
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
  onPlayAgain,
  onExit,
  onAddRival,
  onAddFriend,
  onViewProfile,
}: EndOverlayProps) {
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
    </div>
  );
}
