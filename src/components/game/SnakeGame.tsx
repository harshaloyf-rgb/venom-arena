'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Wifi, WifiOff, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { InputHandler } from './input';
import {
  renderFrame,
  drawDeathOverlay,
  drawControlsHint,
  drawMinimap,
} from './renderer';
import { renderSnakeAtlas, renderSnakeFallback } from './render-snake-atlas';
import { cleanupSnakeParticles } from './render-snake-atlas';
import {
  type GameState,
  type Camera,
  type Viewport,
  type Snake,
  type FoodOrb,
  type StarChip,
  FIXED_DT,
  SNAKE_RADIUS,
  SPAWN_PROTECTION_MS,
} from '@/lib/snake';
import { createInitialState, gameTick, respawnPlayer } from '@/lib/snake/engine';
import { createCamera, updateCamera, getViewport, worldToScreen } from '@/lib/snake/camera';
import { SkinAtlasManager, DEFAULT_SKINS } from '@/lib/snake/atlas';
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
  const showControlsRef = useRef(true);
  const controlsDismissedRef = useRef(false);
  const leaderboardTimerRef = useRef(0);

  // Online state
  const onlineEngineRef = useRef<OnlineEngine | null>(null);
  const extrapolationRef = useRef<ExtrapolationEngine | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const isDeadOnlineRef = useRef(false);

  // Atlas manager (shared across modes)
  const atlasManagerRef = useRef<SkinAtlasManager | null>(null);

  // ── Leaderboard updater (offline) ──

  const updateLeaderboard = useCallback((state: GameState) => {
    const entries: { name: string; score: number }[] = [];
    for (const [, snake] of state.snakes) {
      if (snake.alive) {
        entries.push({ name: snake.name, score: snake.score });
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
        entries.push({ name: s.name, score: s.score });
      }
    }
    entries.sort((a, b) => b.score - a.score);
    setLeaderboard(entries.slice(0, 5));
  }, []);

  // ── Respawn handler (offline) ──

  const handleRespawn = useCallback(() => {
    if (mode === 'online') {
      onlineEngineRef.current?.requestRespawn();
      isDeadOnlineRef.current = false;
      setIsDead(false);
      setFinalScore(0);
      return;
    }
    if (!gameStateRef.current) return;
    respawnPlayer(gameStateRef.current);
    isDeadRef.current = false;
    setIsDead(false);
    setFinalScore(0);
  }, [mode]);

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

    // ── Init offline game state ──
    gameStateRef.current = createInitialState();
    cameraRef.current = createCamera(0, 0);
    isDeadRef.current = false;
    showControlsRef.current = true;
    controlsDismissedRef.current = false;
    leaderboardTimerRef.current = 0;
    isDeadOnlineRef.current = false;

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

      // Connect with default skin
      onlineEngine.connect(arenaId, authToken, 'skin-viper-green');
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

      // Dismiss controls on first input (both modes)
      if (!controlsDismissedRef.current &&
          (inputState.boosting || Math.abs(inputState.targetAngle) > 0.01)) {
        controlsDismissedRef.current = true;
        setTimeout(() => { showControlsRef.current = false; }, 3000);
      }

      // ────────────────────────────────────────────────────────────────────
      // OFFLINE MODE — full local simulation
      // ────────────────────────────────────────────────────────────────────
      if (mode === 'offline') {
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

        // Run fixed ticks
        const tickMs = FIXED_DT * 1000;
        while (accumulatorRef.current >= tickMs) {
          gameTick(state, inputState, FIXED_DT);
          accumulatorRef.current -= tickMs;

          // Check player death
          if (state.player && !state.player.alive && !isDeadRef.current) {
            isDeadRef.current = true;
            setIsDead(true);
            setFinalScore(state.player.score);
          }
        }

        // Camera
        if (state.player && state.player.alive) {
          updateCamera(cameraRef.current, state.player, w, h);
        }

        const viewport: Viewport = getViewport(cameraRef.current, w, h);

        // ── Render: grid, food, star chips, extraction zone ──
        renderOfflineBackground(ctx, state, cameraRef.current, viewport, fc.fps, now);

        // ── Render snakes: bots use fallback, player uses atlas ──
        for (const [, s] of state.snakes) {
          if (s.alive && !s.isPlayer) {
            renderSnakeFallback(ctx, s, cameraRef.current, viewport);
          }
        }
        if (state.player && state.player.alive) {
          renderSnakeAtlas(ctx, state.player, cameraRef.current, viewport, atlasManager, now);
        }

        // HUD, controls, minimap, death overlay
        renderOfflineHUD(ctx, state, cameraRef.current, viewport, fc.fps);
        if (showControlsRef.current && state.player && state.player.alive) {
          drawControlsHint(ctx, viewport);
        }
        drawMinimap(ctx, state.snakes, state.player);
        if (isDeadRef.current) {
          drawDeathOverlay(ctx, finalScore || state.player?.score || 0, viewport);
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
      else if (mode === 'online' && extrapolation && onlineEngine) {
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
          // Update camera using extrapolated head position
          cameraRef.current.x += (playerSnake.headX - cameraRef.current.x) * 0.08;
          cameraRef.current.y += (playerSnake.headY - cameraRef.current.y) * 0.08;
        }

        const viewport: Viewport = getViewport(cameraRef.current, w, h);
        const camera = cameraRef.current;

        // ── Clear + grid ──
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);
        drawGrid(ctx, camera, viewport);

        // ── Extraction zone ──
        if (extraction.active) {
          drawExtractionZone(ctx, extraction, camera, viewport);
        }

        // ── Food ──
        drawOnlineFood(ctx, renderableFoods, camera, viewport);

        // ── Star chips ──
        drawOnlineStarChips(ctx, renderableStarChips, camera, viewport, now);

        // ── Snakes: all bots use fallback, player uses atlas ──
        let isFirst = true;
        for (const [, rs] of renderableSnakes) {
          if (!rs.alive) continue;
          if (isFirst) {
            // Player's snake — use atlas renderer
            const adapted = renderableToSnake(rs, true, now);
            renderSnakeAtlas(ctx, adapted, camera, viewport, atlasManager, now);
            isFirst = false;
          } else {
            // Bot snakes — fallback renderer for performance
            const adapted = renderableToSnake(rs, false, now);
            renderSnakeFallback(ctx, adapted, camera, viewport);
          }
        }

        // ── HUD ──
        if (playerSnake) {
          drawOnlineHUD(ctx, playerSnake, fc.fps, viewport);
        }

        // ── Minimap (online) ──
        drawOnlineMinimap(ctx, renderableSnakes, playerSnake ?? null);

        // ── Death overlay ──
        if (isDeadOnlineRef.current) {
          drawDeathOverlay(ctx, finalScore, viewport);
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

    const onDeathAction = () => {
      handleRespawn();
    };
    window.addEventListener('keydown', onDeathAction);
    canvas.addEventListener('click', onDeathAction);

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      input.detach();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onDeathAction);
      canvas.removeEventListener('click', onDeathAction);

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
        style={{ touchAction: 'none' }}
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
      {mode === 'online' && (
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
      {mode === 'online' && onlineError && (
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
            <span>{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Helper: Render offline background (grid, food, star chips, extraction)
// ============================================================================

function renderOfflineBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  fps: number,
  now: number,
): void {
  const { width, height } = viewport;

  // Clear
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, width, height);

  // Grid
  drawGrid(ctx, camera, viewport);

  // Extraction zone
  if (state.extractionZone.active) {
    drawExtractionZone(ctx, state.extractionZone, camera, viewport);
  }

  // Food
  drawOfflineFood(ctx, state.foods, camera, viewport);

  // Star chips
  if (state.starChips.length > 0) {
    drawOfflineStarChips(ctx, state.starChips, camera, viewport, now);
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
    drawHUDBase(ctx, state.player.score, state.player.path.length, fps, viewport);
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
  ctx.roundRect(p, p, 180, lh * 2 + p * 2, 8);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`Score: ${score}`, p + 12, p + 10);

  ctx.font = '13px monospace';
  ctx.fillStyle = '#a0a0a0';
  ctx.fillText(`Length: ${length}`, p + 12, p + 10 + lh);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '12px monospace';
  ctx.fillText(`${fps} FPS`, viewport.width - p, p);
}

// ============================================================================
// Helper: Convert RenderableSnake to Snake for atlas/fallback renderers
// ============================================================================

function renderableToSnake(rs: RenderableSnake, isPlayer: boolean, now: number): Snake {
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
    targetAngle: rs.angle,
    spiral: { active: false, startAngle: 0, theta: 0, ticksElapsed: 0, a: 1, b: 0.05, direction: 1 },
    bodyRadius: rs.bodyRadius,
    boosting: rs.boosting,
    skinId: rs.skinId,
    rarity: rs.rarity,
  };
}

// ============================================================================
// Online food renderer (from RenderableFood[])
// ============================================================================

const FOOD_COLORS: Record<string, { color: string; glow: string; radius: number }> = {
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
    const style = FOOD_COLORS[f.size] ?? FOOD_COLORS.small;
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
// Offline food renderer (delegates to renderer.ts style)
// ============================================================================

function drawOfflineFood(
  ctx: CanvasRenderingContext2D,
  foods: FoodOrb[],
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
    const r = f.radius * zoom;
    if (r < 1) continue;

    if (r > 2) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = f.glowColor;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// Offline star chips renderer
// ============================================================================

function drawOfflineStarChips(
  ctx: CanvasRenderingContext2D,
  chips: StarChip[],
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
    const r = c.radius * zoom;
    if (r < 1) continue;

    const pulse = 0.7 + 0.3 * Math.sin((now - c.spawnTime) * 0.004);

    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = c.glowColor;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.2 * pulse;
    ctx.strokeStyle = c.glowColor;
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;

    ctx.fillStyle = c.color;
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
// Grid renderer (shared)
// ============================================================================

const GRID_SIZE = 80;
const GRID_COLOR = 'rgba(255, 255, 255, 0.04)';

function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera, viewport: Viewport): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  const zoomedGrid = GRID_SIZE * camera.zoom;
  if (zoomedGrid < 4) return;

  const offsetX = (-camera.x * camera.zoom + viewport.width / 2) % zoomedGrid;
  const offsetY = (-camera.y * camera.zoom + viewport.height / 2) % zoomedGrid;

  ctx.beginPath();
  for (let x = offsetX; x < viewport.width; x += zoomedGrid) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, viewport.height);
  }
  for (let y = offsetY; y < viewport.height; y += zoomedGrid) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(viewport.width, Math.round(y) + 0.5);
  }
  ctx.stroke();
}

// ============================================================================
// Extraction zone renderer (shared)
// ============================================================================

function drawExtractionZone(
  ctx: CanvasRenderingContext2D,
  zone: { x: number; y: number; radius: number; active: boolean },
  camera: Camera,
  viewport: Viewport,
): void {
  const cw = viewport.width;
  const ch = viewport.height;
  const { x: sx, y: sy } = worldToScreen(zone.x, zone.y, camera, cw, ch);
  const sr = zone.radius * camera.zoom;

  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2 * camera.zoom;
  ctx.setLineDash([8 * camera.zoom, 6 * camera.zoom]);
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;
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
