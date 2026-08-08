'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Wifi, WifiOff, Loader2, AlertTriangle, RefreshCw, Zap, CircleDot } from 'lucide-react';
import { InputHandler } from './input';
import {
  drawDeathOverlay,
  drawEliminatedBanner,
  drawControlsHint,
  drawMinimap,
  drawGrid as drawGridFromRenderer,
  drawFood as drawFoodFromRenderer,
  drawStarChips as drawStarChipsFromRenderer,
  drawExtractionZone as drawExtractionZoneFromRenderer,
} from './renderer';
import { renderSnakeAtlas, renderSnakeFallback, cleanupSnakeParticles, clearSmoothedSegs } from './render-snake-atlas';
import {
  type GameState,
  type Camera,
  type Viewport,
  type Snake,
  FIXED_DT,
  SEGMENT_SPACING,
  BASE_SPEED,
  computeBodyLength,
  computeBodyRadius,
} from '@/lib/snake';
import { createInitialState, gameTick, respawnPlayer, type PlayerSkinOverride } from '@/lib/snake/engine';
import { createCamera, updateCamera, getViewport, worldToScreen } from '@/lib/snake/camera';
import { SkinAtlasManager, DEFAULT_SKINS } from '@/lib/snake/atlas';
import { getPlayerSkinAsset, getPlayerSkinId, registerSkinAsset } from '@/lib/snake/skin-registry';
import { useAuth } from '@/components/providers/auth-provider';
import { ExtrapolationEngine, type RenderableSnake, type RenderableFood, type RenderableStarChip } from '@/lib/snake/extrapolation';
import { OnlineEngine, type ConnectionState } from './online-engine';

// ─── Props ───────────────────────────────────────────────────────────────────

interface SnakeGameProps {
  onExit?: () => void;
  mode?: 'offline' | 'online';
  arenaId?: string;
  arenaConfig?: {
    id: string;
    name: string;
    maxPlayers?: number;
  };
  authToken?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SnakeGame({
  onExit,
  mode = 'offline',
  arenaId,
  arenaConfig,
  authToken,
}: SnakeGameProps) {
  // If mode is 'online' but no authToken is provided, fall back to offline
  const effectiveMode = mode === 'online' && !authToken ? 'offline' : mode;

  // ── Player skin (read from auth + localStorage) ──
  const { player: authPlayer } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1.0 });
  const inputRef = useRef<InputHandler | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number; fps: number }>({
    frames: 0,
    lastTime: 0,
    fps: 60,
  });

  // Offline state
  const [isDead, setIsDead] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const isDeadRef = useRef(false);
  const deathTimeRef = useRef(0); // timestamp when player died
  const showControlsRef = useRef(true);
  const controlsDismissedRef = useRef(false);
  const leaderboardTimerRef = useRef(0);

  // Online state
  const onlineEngineRef = useRef<OnlineEngine | null>(null);
  const extrapolationRef = useRef<ExtrapolationEngine | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const isDeadOnlineRef = useRef(false);
  const onlineDeathTimeRef = useRef(0);

  // Atlas manager (shared across modes)
  const atlasManagerRef = useRef<SkinAtlasManager | null>(null);

  

  // External boost state (from UI button)
  const externalBoostRef = useRef(false);

  // Extraction progress tracking
  const extractProgressRef = useRef(0);
  const extractLastAngleRef = useRef(0);
  const extractActiveRef = useRef(false);

  // ── Leaderboard updater (offline) ──

  

  const updateLeaderboard = useCallback((state: GameState) => {
    const entries: { name: string; score: number }[] = [];
    for (const [, snake] of state.snakes) {
      if (snake.alive) {
        entries.push({ name: snake.name, score: Math.floor(snake.score) });
      }
    }
    entries.sort((a, b) => b.score - a.score);
    setLeaderboard(entries.slice(0, 5));
  }, []);

  // ── Leaderboard updater (online — from extrapolation) ──

  const updateOnlineLeaderboard = useCallback((snakes: Map<string, RenderableSnake>) => {
    const entries: { name: string; score: number }[] = [];
    for (const [, s] of snakes) {
      if (s.alive) {
        entries.push({ name: s.name, score: Math.floor(s.score) });
      }
    }
    entries.sort((a, b) => b.score - a.score);
    setLeaderboard(entries.slice(0, 5));
  }, []);

  // ── Respawn handler (offline) ──

  const handleRespawn = useCallback(() => {
    if (effectiveMode === 'online') {
      onlineEngineRef.current?.requestRespawn();
      isDeadOnlineRef.current = false;
      onlineDeathTimeRef.current = 0;
      setIsDead(false);
      setFinalScore(0);
      return;
    }
    if (!gameStateRef.current) return;
    respawnPlayer(gameStateRef.current);
    isDeadRef.current = false;
    deathTimeRef.current = 0;
    setIsDead(false);
    setFinalScore(0);
  }, [effectiveMode]);

  // ── Retry online connection ──

  const handleRetry = useCallback(() => {
    setOnlineError(null);
    // The useEffect will re-trigger connect on state change
  }, []);

  // ── Main effect: game loop + online/offline setup ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size canvas to fill parent
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (inputRef.current) inputRef.current.updateRect();
    };

    resize();
    window.addEventListener('resize', resize);

    // ── Build atlas manager & pre-build default skins ──
    const atlasManager = new SkinAtlasManager();
    atlasManagerRef.current = atlasManager;
    for (const skin of DEFAULT_SKINS) {
      atlasManager.buildAtlas(skin);
    }

    // ── Resolve player's selected skin ──
    const serverSkinId = authPlayer?.currentSkin ?? 'skin-default';
    const playerSkinAsset = getPlayerSkinAsset(serverSkinId);
    const playerSkinId = getPlayerSkinId(serverSkinId);

    // Build atlas for player's skin if it's not already a DEFAULT_SKIN
    if (!atlasManager.getAtlas(playerSkinAsset.id)) {
      atlasManager.buildAtlas(playerSkinAsset);
      registerSkinAsset(playerSkinAsset);
    }

    const skinOverride: PlayerSkinOverride = {
      skinId: playerSkinAsset.id,
      bodyColor: playerSkinAsset.bodyColor,
      headColor: playerSkinAsset.headColor,
      accentColor: playerSkinAsset.accentColor ?? '',
      pattern: playerSkinAsset.pattern,
      animation: playerSkinAsset.animation,
      rarity: playerSkinAsset.rarity,
    };

    // ── Init offline game state with player skin ──
    gameStateRef.current = createInitialState(skinOverride);
    cameraRef.current = createCamera(0, 0);
    isDeadRef.current = false;
    deathTimeRef.current = 0;
    showControlsRef.current = true;
    controlsDismissedRef.current = false;
    leaderboardTimerRef.current = 0;
    isDeadOnlineRef.current = false;
    onlineDeathTimeRef.current = 0;

    // Input handler
    const input = new InputHandler(canvas);
    inputRef.current = input;
    input.attach();

    // ── Online engine setup ──
    let onlineEngine: OnlineEngine | null = null;
    let extrapolation: ExtrapolationEngine | null = null;

    if (mode === 'online' && arenaId && authToken) {
      onlineEngine = new OnlineEngine();
      extrapolation = new ExtrapolationEngine();
      onlineEngineRef.current = onlineEngine;
      extrapolationRef.current = extrapolation;

      onlineEngine.onConnectionChange = (state) => {
        setConnectionState(state);
        if (state === 'connected') {
          setOnlineError(null);
        }
      };

      onlineEngine.onSnapshot = (snapshot) => {
        extrapolation!.update(snapshot, performance.now());
      };

      onlineEngine.onError = (msg) => {
        setOnlineError(msg);
      };

      onlineEngine.onPlayerDied = () => {
        isDeadOnlineRef.current = true;
        onlineDeathTimeRef.current = performance.now();
        setIsDead(true);
        // Get score from last extrapolated state
        const snakes = extrapolation!.getRenderableSnakes();
        // Find player snake (first one or use stored ID)
        let maxScore = 0;
        for (const [, s] of snakes) {
          if (s.score > maxScore) maxScore = s.score;
        }
        setFinalScore(maxScore);
      };

      // Connect with player's selected skin
      onlineEngine.connect(arenaId, authToken, playerSkinId);
    }

    // ── Game loop ──
    let running = true;

    const loop = (timestamp: number) => {
      if (!running) return;

      // FPS counter
      const fc = fpsCounterRef.current;
      fc.frames++;
      if (timestamp - fc.lastTime >= 1000) {
        fc.fps = fc.frames;
        fc.frames = 0;
        fc.lastTime = timestamp;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : canvas.width;
      const h = parent ? parent.clientHeight : canvas.height;
      const now = Date.now();
      const inputState = input.getState();

      // ── Frame elapsed (for extraction progress, both modes) ──
      const prevFrameTimeRef = lastTimeRef.current || timestamp;
      const frameElapsed = Math.min(timestamp - prevFrameTimeRef, 100);

      // ── External boost: wire UI button into input handler ──
      input.externalBoost = externalBoostRef.current;

      // ── Extraction progress tracking (both modes) ──
      const isExtracting = input.isExtracting();
      if (isExtracting && !isDeadRef.current && !isDeadOnlineRef.current) {
        if (!extractActiveRef.current) {
          // Just started extracting — lock the current angle
          extractActiveRef.current = true;
          extractProgressRef.current = 0;
          extractLastAngleRef.current = inputState.targetAngle;
        }
        // Check direction change (any angle difference resets progress)
        const angleDelta = Math.abs(inputState.targetAngle - extractLastAngleRef.current);
        const wrappedDelta = Math.min(angleDelta, Math.PI * 2 - angleDelta);
        if (wrappedDelta > 0.05) {
          // Direction changed — reset progress, lock new angle
          extractProgressRef.current = 0;
          extractLastAngleRef.current = inputState.targetAngle;
        } else {
          // Accumulate progress: 3000ms = 1.0
          extractProgressRef.current += frameElapsed / 3000;
          if (extractProgressRef.current >= 1.0) {
            extractProgressRef.current = 0;
            extractActiveRef.current = false;
            // Successful extraction — exit to arena screen
            if (onExit) onExit();
          }
        }
      } else {
        extractActiveRef.current = false;
        extractProgressRef.current = 0;
      }

      // Dismiss controls on first input (both modes)
      if (!controlsDismissedRef.current &&
          (inputState.boosting || Math.abs(inputState.targetAngle) > 0.01)) {
        controlsDismissedRef.current = true;
        setTimeout(() => { showControlsRef.current = false; }, 3000);
      }

      // ────────────────────────────────────────────────────────────────────
      // OFFLINE MODE — full local simulation
      // ────────────────────────────────────────────────────────────────────
      if (effectiveMode === 'offline') {
        const state = gameStateRef.current;
        if (!state) {
          animFrameRef.current = requestAnimationFrame(loop);
          return;
        }

        // Fixed timestep
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = timestamp;
        }
        const elapsed = Math.min(timestamp - lastTimeRef.current, 100);
        lastTimeRef.current = timestamp;
        accumulatorRef.current += elapsed;

        // Fixed timestep — cap at 1 tick per frame to prevent stutter.
        // Running 2 ticks in one frame makes the snake jump 6px then freeze
        // the next frame. Capping ensures consistent 1-tick-per-frame motion.
        const tickMs = FIXED_DT * 1000;
        if (accumulatorRef.current >= tickMs) {
          gameTick(state, inputState, FIXED_DT);
          accumulatorRef.current -= tickMs;
          // Cap accumulator to prevent spiral-of-death catch-up frames
          if (accumulatorRef.current > tickMs) accumulatorRef.current = tickMs * 0.5;

          // Check player death
          if (state.player && !state.player.alive && !isDeadRef.current) {
            isDeadRef.current = true;
            deathTimeRef.current = performance.now();
            setIsDead(true);
            setFinalScore(state.player.score);
            // Cleanup particles for dead snakes
            for (const [sid, s] of state.snakes) {
              if (!s.alive) cleanupDeadSnakeParticles(sid);
            }
          }
        }

        // Camera
        if (state.player && state.player.alive) {
          updateCamera(cameraRef.current, state.player, w, h);
        }

        const viewport: Viewport = getViewport(cameraRef.current, w, h);

        // Get raw mouse screen position for ultra-responsive eye tracking
        const mousePos = input.getMousePos();
        const mouseSX = mousePos?.x;
        const mouseSY = mousePos?.y;

        // ── Render: grid, food, star chips, extraction zone ──
        renderOfflineBackground(ctx, state, cameraRef.current, viewport, fc.fps, now);

        // ── Render snakes: bots use fallback, player uses atlas ──
        for (const [, s] of state.snakes) {
          if (s.alive && !s.isPlayer) {
            renderSnakeFallback(ctx, s, cameraRef.current, viewport, now);
          }
        }
        if (state.player && state.player.alive) {
          renderSnakeAtlas(ctx, state.player, cameraRef.current, viewport, atlasManager, now, mouseSX, mouseSY);
        }

        // Extraction progress ring on snake head
        if (extractActiveRef.current && extractProgressRef.current > 0 && state.player && state.player.alive) {
          drawExtractRing(ctx, state.player, cameraRef.current, viewport, extractProgressRef.current);
        }

        // HUD, controls, minimap, death overlay
        renderOfflineHUD(ctx, state, cameraRef.current, viewport, fc.fps);
        if (showControlsRef.current && state.player && state.player.alive) {
          drawControlsHint(ctx, viewport);
        }
        drawMinimap(ctx, state.snakes, state.player);

        // Mouse cursor indicator (slither.io style crosshair)
        drawMouseCursor(ctx, input);

        if (isDeadRef.current) {
          const deathElapsed = performance.now() - deathTimeRef.current;
          if (deathElapsed < 5000) {
            // First 5s: game visible behind, show elimination banner
            drawEliminatedBanner(ctx, viewport, deathElapsed);
          } else {
            // After 5s: full death overlay with respawn prompt
            drawDeathOverlay(ctx, finalScore || state.player?.score || 0, viewport);
          }
        }

        // Update leaderboard every ~0.5s
        leaderboardTimerRef.current++;
        if (leaderboardTimerRef.current >= 30) {
          leaderboardTimerRef.current = 0;
          updateLeaderboard(state);
        }

      }

      // ────────────────────────────────────────────────────────────────────
      // ONLINE MODE — server snapshots + extrapolation
      // ────────────────────────────────────────────────────────────────────
      else if (effectiveMode === 'online' && extrapolation && onlineEngine) {
        // Forward input to server
        if (onlineEngine.isConnected) {
          onlineEngine.setInput(inputState.targetAngle, inputState.boosting);
        }

        // Extrapolate between snapshots
        const dt = 1 / 60;
        extrapolation.extrapolate(dt);

        const renderableSnakes = extrapolation.getRenderableSnakes();
        const renderableFoods = extrapolation.getRenderableFoods();
        const renderableStarChips = extrapolation.getRenderableStarChips();
        const extraction = extrapolation.extraction;

        // Camera: follow the first snake (player)
        let playerSnake: RenderableSnake | undefined;
        for (const [, s] of renderableSnakes) {
          playerSnake = s;
          break;
        }
        if (playerSnake) {
          // Direct lock — head at dead center, zero jitter.
          cameraRef.current.x = playerSnake.headX;
          cameraRef.current.y = playerSnake.headY;
        }

        const viewport: Viewport = getViewport(cameraRef.current, w, h);
        const camera = cameraRef.current;

        // ── Clear + grid ──
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);
        drawGridFromRenderer(ctx, camera, viewport);

        // ── Extraction zone ──
        if (extraction.active) {
          drawExtractionZoneFromRenderer(ctx, extraction, camera, viewport);
        }

        // ── Food ──
        drawOnlineFood(ctx, renderableFoods, camera, viewport);

        // ── Star chips ──
        drawOnlineStarChips(ctx, renderableStarChips, camera, viewport, now);

        // ── Snakes: all bots use fallback, player uses atlas ──
        let isFirst = true;
        const localTargetAngle = inputState.targetAngle;
        const onlineMousePos = input.getMousePos();
        const onlineMouseSX = onlineMousePos?.x;
        const onlineMouseSY = onlineMousePos?.y;
        for (const [, rs] of renderableSnakes) {
          if (!rs.alive) continue;
          if (isFirst) {
            // Player's snake — use atlas renderer
            const adapted = renderableToSnake(rs, true, now, localTargetAngle);
            renderSnakeAtlas(ctx, adapted, camera, viewport, atlasManager, now, onlineMouseSX, onlineMouseSY);
            isFirst = false;
          } else {
            // Bot snakes — fallback renderer for performance
            const adapted = renderableToSnake(rs, false, now);
            renderSnakeFallback(ctx, adapted, camera, viewport, now);
          }
        }

        // Extraction progress ring on snake head (online)
        if (extractActiveRef.current && extractProgressRef.current > 0 && playerSnake?.alive) {
          const adapted = renderableToSnake(playerSnake, true, now, localTargetAngle);
          drawExtractRing(ctx, adapted, camera, viewport, extractProgressRef.current);
        }

        // ── HUD ──
        if (playerSnake) {
          drawOnlineHUD(ctx, playerSnake, fc.fps, viewport);
        }

        // ── Minimap (online) ──
        drawOnlineMinimap(ctx, renderableSnakes, playerSnake ?? null);

        // Mouse cursor indicator (slither.io style crosshair)
        drawMouseCursor(ctx, input);

        // ── Death overlay ──
        if (isDeadOnlineRef.current) {
          const deathElapsed = performance.now() - onlineDeathTimeRef.current;
          if (deathElapsed < 5000) {
            drawEliminatedBanner(ctx, viewport, deathElapsed);
          } else {
            drawDeathOverlay(ctx, finalScore, viewport);
          }
        }

        // ── Connection status on canvas ──
        if (!onlineEngine.isConnected) {
          drawConnectionOverlay(ctx, viewport, onlineEngine.connectionState);
        }

        // ── Update leaderboard ──
        leaderboardTimerRef.current++;
        if (leaderboardTimerRef.current >= 30) {
          leaderboardTimerRef.current = 0;
          updateOnlineLeaderboard(renderableSnakes);
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    // ── Death overlay: Space/click to respawn (only after 5s elimination) ──
    const canRespawn = () => {
      if (isDeadOnlineRef.current) return performance.now() - onlineDeathTimeRef.current >= 5000;
      if (isDeadRef.current) return performance.now() - deathTimeRef.current >= 5000;
      return false;
    };
    const onRespawnKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (canRespawn()) handleRespawn();
      }
    };
    const onRespawnClick = () => {
      if (canRespawn()) handleRespawn();
    };
    window.addEventListener('keydown', onRespawnKey);
    canvas.addEventListener('click', onRespawnClick);

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      input.detach();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onRespawnKey);
      canvas.removeEventListener('click', onRespawnClick);

      // Cleanup online connections
      if (onlineEngine) {
        onlineEngine.disconnect();
      }
      onlineEngineRef.current = null;
      extrapolationRef.current = null;
    };
  }, [mode, arenaId, authToken, handleRespawn, updateLeaderboard, updateOnlineLeaderboard]);

  // ── Render ──

  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ touchAction: 'none', cursor: 'none' }}
      />

      {/* Exit button */}
      {onExit && (
        <button
          onClick={(e) => { e.stopPropagation(); onExit(); }}
          className="absolute top-4 left-4 z-10 w-9 h-9 rounded-lg bg-black/60 hover:bg-red-950/60 border border-white/10 hover:border-red-500/30 flex items-center justify-center cursor-pointer transition-colors"
          title="Exit to Lobby"
        >
          <X className="w-4 h-4 text-white/70 hover:text-red-400" />
        </button>
      )}

      {/* Online connection indicator */}
      {effectiveMode === 'online' && (
        <div className="absolute top-4 left-16 z-10 flex items-center gap-2 pointer-events-none">
          {connectionState === 'connected' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-mono text-emerald-400">LIVE</span>
            </div>
          )}
          {connectionState === 'connecting' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-xs font-mono text-amber-400">CONNECTING</span>
            </div>
          )}
          {(connectionState === 'disconnected' || connectionState === 'error' || connectionState === 'reconnecting') && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/30">
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-mono text-red-400">
                {connectionState === 'error' ? 'ERROR' : connectionState === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Online error panel */}
      {effectiveMode === 'online' && onlineError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 max-w-sm mx-4 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Connection Error</h3>
            <p className="text-sm text-slate-400 mb-4">{onlineError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={onExit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="absolute top-4 right-4 w-44 bg-black/50 backdrop-blur-sm rounded-lg p-2 pointer-events-none select-none">
        <div className="text-xs text-white/60 font-mono mb-1 text-center">Leaderboard</div>
        {leaderboard.map((entry, i) => (
          <div
            key={i}
            className={`flex justify-between text-xs font-mono px-1 py-0.5 rounded ${
              entry.name === 'You' ? 'text-green-400 bg-white/5' : 'text-white/70'
            }`}
          >
            <span>{i + 1}. {entry.name}</span>
            <span>{Math.floor(entry.score)}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom Action Buttons (stacked left) ── */}
      <div className="absolute bottom-6 left-5 z-10 flex flex-col gap-3 pointer-events-none">
        {/* Boost Button (hold to boost) */}
        <button
          onPointerDown={(e) => { e.stopPropagation(); externalBoostRef.current = true; }}
          onPointerUp={(e) => { e.stopPropagation(); externalBoostRef.current = false; }}
          onPointerLeave={() => { externalBoostRef.current = false; }}
          onPointerCancel={() => { externalBoostRef.current = false; }}
          disabled={isDead}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl border font-bold text-sm transition-all duration-200 select-none touch-manipulation
            ${isDead
              ? 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'
              : 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25 hover:border-orange-500/50 active:scale-95'
            }`}
        >
          <Zap className="w-5 h-5" />
          <span>Boost</span>
        </button>

        {/* Extract Button (hold to extract) */}
        <button
          onPointerDown={(e) => { e.stopPropagation(); inputRef.current?.setExternalExtract(true); }}
          onPointerUp={(e) => { e.stopPropagation(); inputRef.current?.setExternalExtract(false); }}
          onPointerLeave={() => { inputRef.current?.setExternalExtract(false); }}
          onPointerCancel={() => { inputRef.current?.setExternalExtract(false); }}
          disabled={isDead}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl border font-bold text-sm transition-all duration-200 select-none touch-manipulation
            ${isDead
              ? 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25 hover:border-amber-500/50 active:scale-95'
            }`}
        >
          <CircleDot className="w-5 h-5" />
          <span>Extract</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Helper: Cleanup dead snake particles
// ============================================================================

function cleanupDeadSnakeParticles(snakeId: string): void {
  cleanupSnakeParticles(snakeId);
  clearSmoothedSegs(snakeId);
}

// ============================================================================
// Helper: Render offline background (grid, food, star chips, extraction)
// ============================================================================

function renderOfflineBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  _fps: number,
  now: number,
): void {
  const { width, height } = viewport;

  // Clear
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, width, height);

  // Grid
  drawGridFromRenderer(ctx, camera, viewport);

  // Extraction zone
  if (state.extractionZone.active) {
    drawExtractionZoneFromRenderer(ctx, state.extractionZone, camera, viewport);
  }

  // Food
  drawFoodFromRenderer(ctx, state.foods, camera, viewport);

  // Star chips
  if (state.starChips.length > 0) {
    drawStarChipsFromRenderer(ctx, state.starChips, camera, viewport, now);
  }
}

// ============================================================================
// Helper: Render offline HUD
// ============================================================================

function renderOfflineHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  fps: number,
): void {
  if (state.player) {
    const logicalLen = computeBodyLength(state.player.score);
    const spacingRatio = SEGMENT_SPACING / BASE_SPEED;
    const pathBasedLen = Math.floor(state.player.path.length / spacingRatio);
    const displayLen = Math.min(logicalLen, pathBasedLen);
    drawHUDBase(ctx, state.player.score, displayLen, fps, viewport);
  }
}

// ============================================================================
// Helper: Render online HUD
// ============================================================================

function drawOnlineHUD(
  ctx: CanvasRenderingContext2D,
  player: RenderableSnake,
  fps: number,
  viewport: Viewport,
): void {
  drawHUDBase(ctx, player.score, player.path.length, fps, viewport);
}

// ============================================================================
// Helper: Shared HUD drawing
// ============================================================================

function drawHUDBase(
  ctx: CanvasRenderingContext2D,
  score: number,
  length: number,
  fps: number,
  viewport: Viewport,
): void {
  const p = 16;
  const lh = 22;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(p, p, 180, lh * 3 + p * 2 - 4, 8);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`Score: ${Math.floor(score)}`, p + 12, p + 10);

  ctx.font = '13px monospace';
  ctx.fillStyle = '#a0a0a0';
  ctx.fillText(`Length: ${length}`, p + 12, p + 10 + lh);

  ctx.font = '11px monospace';
  ctx.fillStyle = '#888888';
  ctx.fillText(`Radius: ${computeBodyRadius(score).toFixed(1)}px`, p + 12, p + 10 + lh * 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '12px monospace';
  ctx.fillText(`${fps} FPS`, viewport.width - p, p);


}

// ============================================================================
// Helper: Convert RenderableSnake to Snake for atlas/fallback renderers
// ============================================================================

function renderableToSnake(rs: RenderableSnake, isPlayer: boolean, now: number, targetAngle?: number): Snake {
  return {
    id: rs.id,
    name: rs.name,
    path: rs.path,
    angle: rs.angle,
    prevAngle: rs.angle,
    speed: 0,
    score: rs.score,
    alive: rs.alive,
    isBot: !isPlayer,
    isPlayer,
    spawnTime: now - 5000, // Assume no spawn protection for online snakes
    color: rs.color,
    headColor: rs.headColor,
    lastBoostDrop: 0,
    targetAngle: targetAngle ?? rs.angle,
    spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
    bodyRadius: rs.bodyRadius,
    boosting: rs.boosting,
    skinId: rs.skinId,
    rarity: rs.rarity,
  };
}

// ============================================================================
// Online food renderer (from RenderableFood[])
// ============================================================================

const ONLINE_FOOD_STYLES: Record<string, { color: string; glow: string; radius: number }> = {
  small:  { color: '#34d399', glow: '#10b981', radius: 3 },
  medium: { color: '#38bdf8', glow: '#0ea5e9', radius: 5 },
  large:  { color: '#f472b6', glow: '#ec4899', radius: 8 },
};

function drawOnlineFood(
  ctx: CanvasRenderingContext2D,
  foods: RenderableFood[],
  camera: Camera,
  viewport: Viewport,
): void {
  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;

  for (const f of foods) {
    if (f.x < viewport.left - 20 || f.x > viewport.right + 20) continue;
    if (f.y < viewport.top - 20 || f.y > viewport.bottom + 20) continue;

    const { x: sx, y: sy } = worldToScreen(f.x, f.y, camera, cw, ch);
    const style = ONLINE_FOOD_STYLES[f.size] ?? ONLINE_FOOD_STYLES.small;
    const r = style.radius * zoom;
    if (r < 1) continue;

    // Glow
    if (r > 2) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = style.glow;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// Online star chips renderer
// ============================================================================

function drawOnlineStarChips(
  ctx: CanvasRenderingContext2D,
  chips: RenderableStarChip[],
  camera: Camera,
  viewport: Viewport,
  now: number,
): void {
  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;

  for (const c of chips) {
    if (c.x < viewport.left - 30 || c.x > viewport.right + 30) continue;
    if (c.y < viewport.top - 30 || c.y > viewport.bottom + 30) continue;

    const { x: sx, y: sy } = worldToScreen(c.x, c.y, camera, cw, ch);
    const r = 12 * zoom;
    if (r < 1) continue;

    const pulse = 0.7 + 0.3 * Math.sin(now * 0.004);

    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.2 * pulse;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    if (r > 3) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(sx - r * 0.15, sy - r * 0.2, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// Online minimap
// ============================================================================

function drawOnlineMinimap(
  ctx: CanvasRenderingContext2D,
  snakes: Map<string, RenderableSnake>,
  player: RenderableSnake | null,
): void {
  const size = 120;
  const pad = 12;

  const cw = ctx.canvas.width / (window.devicePixelRatio || 1);
  const ch = ctx.canvas.height / (window.devicePixelRatio || 1);
  const mx = cw - size - pad;
  const my = ch - size - pad;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(mx, my, size, size, 6);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (!player || !player.alive || player.path.length === 0) return;

  const scale = 0.02;
  const cx = mx + size / 2;
  const cy = my + size / 2;
  const px = player.headX;
  const py = player.headY;
  const halfSize = size / 2 - 4;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  for (const [, snake] of snakes) {
    if (!snake.alive || snake === player) continue;
    const dx = (snake.headX - px) * scale;
    const dy = (snake.headY - py) * scale;
    if (Math.abs(dx) > halfSize || Math.abs(dy) > halfSize) continue;
    ctx.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
  }

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// Connection overlay (drawn on canvas when disconnected)
// ============================================================================

function drawConnectionOverlay(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  state: ConnectionState,
): void {
  const { width, height } = viewport;

  // Subtle vignette
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, width, height);

  // Status text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state === 'connecting' || state === 'reconnecting') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '18px sans-serif';
    ctx.fillText('Connecting to server...', width / 2, height / 2);
  } else if (state === 'error') {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.font = '18px sans-serif';
    ctx.fillText('Connection error — see panel for details', width / 2, height / 2);
  }
}

// ============================================================================
// Extraction progress ring — drawn on snake head (white → green)
// ============================================================================

function drawExtractRing(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  camera: Camera,
  viewport: Viewport,
  progress: number,
): void {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const { x: sx, y: sy } = worldToScreen(hx, hy, camera, viewport.width, viewport.height);
  const zoom = camera.zoom;
  const ringRadius = (snake.bodyRadius + 10) * zoom;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  // Background ring (dim track)
  ctx.beginPath();
  ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 3 * zoom;
  ctx.stroke();

  // Progress arc: white → green
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + clampedProgress * Math.PI * 2;
  const r = Math.round(255 - clampedProgress * 150);   // 255 → 105
  const g = Math.round(255 * clampedProgress + 200 * (1 - clampedProgress)); // 200 → 255
  const b = Math.round(255 * (1 - clampedProgress));   // 255 → 0

  ctx.beginPath();
  ctx.arc(sx, sy, ringRadius, startAngle, endAngle);
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.lineWidth = 3 * zoom;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Percentage text
  const pct = Math.floor(clampedProgress * 100);
  ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
  ctx.font = `bold ${Math.round(11 * zoom)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${pct}%`, sx, sy - ringRadius - 10 * zoom);
}

// ============================================================================
// Mouse cursor indicator (slither.io style — subtle crosshair)
// ============================================================================

function drawMouseCursor(
  ctx: CanvasRenderingContext2D,
  input: InputHandler,
): void {
  const pos = input.getMousePos();
  if (!pos) return;

  const r = 6;
  const alpha = 0.5;

  // Outer ring
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.2})`;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
  ctx.fill();
}
