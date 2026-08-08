'use client';

/**
 * OnlineSnakeGame — ONLINE-MODE ONLY game component.
 *
 * This file is a 100 % independent copy of SnakeGame.tsx (offline mode).
 * Editing this file will NEVER touch offline game code, and vice-versa.
 *
 * Currently uses the same local engine as offline (server-side networking
 * will be wired in later). The separation exists so the two code-paths
 * can diverge freely when online infrastructure is rebuilt.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, CircleDot } from 'lucide-react';
import { InputHandler } from './input';
import {
  drawDeathOverlay,
  drawEliminatedBanner,
  drawControlsHint,
  drawGrid as drawGridFromRenderer,
  drawFood as drawFoodFromRenderer,
} from './renderer-online';
import { renderSnakeAtlas, renderSnakeFallback, cleanupSnakeParticles, clearSmoothedSegs } from './render-snake-atlas-online';
import {
  type GameState,
  type Camera,
  type Viewport,
  type Snake,
  FIXED_DT,
} from '@/lib/snake';
import { createExtractionState, updateExtractionProgress, drawExtractRing } from '@/lib/snake/extraction';
import { createInitialState, gameTick, respawnPlayer, type PlayerSkinOverride } from '@/lib/snake/engine-online';
import { createCamera, updateCamera, getViewport } from '@/lib/snake/camera-online';
import { SkinAtlasManager, DEFAULT_SKINS } from '@/lib/snake/atlas-online';
import { getPlayerSkinAsset, registerSkinAsset } from '@/lib/snake/skin-registry-online';
import { useAuth } from '@/components/providers/auth-provider';

// ─── Props ───────────────────────────────────────────────────────────────────

interface OnlineSnakeGameProps {
  onExit?: () => void;
  arenaId?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnlineSnakeGame({
  onExit,
  arenaId,
}: OnlineSnakeGameProps) {
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

  // State
  const [isDead, setIsDead] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const isDeadRef = useRef(false);
  const deathTimeRef = useRef(0);
  const showControlsRef = useRef(true);
  const controlsDismissedRef = useRef(false);
  const leaderboardTimerRef = useRef(0);
  const killsRef = useRef(0);
  const highScoreRef = useRef(0);
  const [displayHighScore, setDisplayHighScore] = useState(0);

  // Atlas manager
  const atlasManagerRef = useRef<SkinAtlasManager | null>(null);

  // External boost state (from UI button)
  const externalBoostRef = useRef(false);

  // Extraction progress tracking (shared logic)
  const extractionRef = useRef(createExtractionState());

  // ── Leaderboard updater ──

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

  // ── Respawn handler ──

  const handleRespawn = useCallback(() => {
    if (!gameStateRef.current) return;
    respawnPlayer(gameStateRef.current);
    isDeadRef.current = false;
    deathTimeRef.current = 0;
    setIsDead(false);
    setFinalScore(0);
  }, []);

  // ── Main effect: game loop ──

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

    // ── Init game state with player skin ──
    gameStateRef.current = createInitialState(skinOverride);
    cameraRef.current = createCamera(0, 0);
    isDeadRef.current = false;
    deathTimeRef.current = 0;
    showControlsRef.current = true;
    controlsDismissedRef.current = false;
    leaderboardTimerRef.current = 0;
    killsRef.current = 0;
    extractionRef.current = createExtractionState();
    // Load highest ever score from localStorage (per arena, separate key for online)
    const highScoreKey = `venom-high-score-online-${arenaId || 'default'}`;
    try {
      highScoreRef.current = parseInt(localStorage.getItem(highScoreKey) || '0', 10);
      setDisplayHighScore(highScoreRef.current);
    } catch { highScoreRef.current = 0; }

    // Input handler
    const input = new InputHandler(canvas);
    inputRef.current = input;
    input.attach();

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

      // ── Frame elapsed (for extraction progress) ──
      const prevFrameTime = lastTimeRef.current || timestamp;
      const frameElapsed = Math.min(timestamp - prevFrameTime, 100);

      // ── External boost: wire UI button into input handler ──
      input.externalBoost = externalBoostRef.current;

      // ── Guard: game state must exist ──
      const gameState = gameStateRef.current;
      if (!gameState) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── Extraction progress tracking (shared) ──
      updateExtractionProgress(
        extractionRef.current, input.isExtracting(), isDeadRef.current,
        inputState.targetAngle, frameElapsed, onExit,
      );

      // Dismiss controls on first input
      if (!controlsDismissedRef.current &&
          (inputState.boosting || Math.abs(inputState.targetAngle) > 0.01)) {
        controlsDismissedRef.current = true;
        setTimeout(() => { showControlsRef.current = false; }, 3000);
      }

      // ────────────────────────────────────────────────────────────────────
      // GAME LOOP — full local simulation (online engine placeholder)
      // ────────────────────────────────────────────────────────────────────

      // Fixed timestep
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const elapsed = Math.min(timestamp - lastTimeRef.current, 100);
      lastTimeRef.current = timestamp;
      accumulatorRef.current += elapsed;

      const tickMs = FIXED_DT * 1000;
      if (accumulatorRef.current >= tickMs) {
        const killEvents = gameTick(gameState, inputState, FIXED_DT);
        accumulatorRef.current -= tickMs;
        if (accumulatorRef.current > tickMs) accumulatorRef.current = tickMs * 0.5;

        // Track player kills
        if (gameState.player) {
          for (const ev of killEvents) {
            if (ev.killerId === gameState.player.id) killsRef.current++;
          }
          // Track high score (per arena, separate key for online)
          if (gameState.player.score > highScoreRef.current) {
            highScoreRef.current = Math.floor(gameState.player.score);
            try { localStorage.setItem(highScoreKey, String(highScoreRef.current)); } catch { /* ignore */ }
            setDisplayHighScore(highScoreRef.current);
          }
        }

        // Check player death
        if (gameState.player && !gameState.player.alive && !isDeadRef.current) {
          isDeadRef.current = true;
          deathTimeRef.current = performance.now();
          setIsDead(true);
          setFinalScore(gameState.player.score);
          for (const [sid, s] of gameState.snakes) {
            if (!s.alive) cleanupDeadSnakeParticles(sid);
          }
        }
      }

      // Camera
      if (gameState.player && gameState.player.alive) {
        updateCamera(cameraRef.current, gameState.player, w, h);
      }

      const viewport: Viewport = getViewport(cameraRef.current, w, h);

      // Mouse position for eye tracking
      const mousePos = input.getMousePos();
      const mouseSX = mousePos?.x;
      const mouseSY = mousePos?.y;

      // ── Render: background ──
      renderBackground(ctx, gameState, cameraRef.current, viewport, fc.fps, now);

      // ── Render snakes: bots use fallback, player uses atlas ──
      for (const [, s] of gameState.snakes) {
        if (s.alive && !s.isPlayer) {
          renderSnakeFallback(ctx, s, cameraRef.current, viewport, now);
        }
      }
      if (gameState.player && gameState.player.alive) {
        renderSnakeAtlas(ctx, gameState.player, cameraRef.current, viewport, atlasManager, now, mouseSX, mouseSY);
      }

      // Extraction progress ring on snake head (shared)
      if (extractionRef.current.active && extractionRef.current.progress > 0 && gameState.player && gameState.player.alive) {
        drawExtractRing(ctx, gameState.player, cameraRef.current, viewport, extractionRef.current.progress);
      }

      // HUD
      renderHUD(ctx, gameState, cameraRef.current, viewport, fc.fps, now, killsRef.current, highScoreRef.current);
      if (showControlsRef.current && gameState.player && gameState.player.alive) {
        drawControlsHint(ctx, viewport);
      }

      // Mouse cursor
      drawMouseCursor(ctx, input);

      if (isDeadRef.current) {
        const deathElapsed = performance.now() - deathTimeRef.current;
        if (deathElapsed < 5000) {
          drawEliminatedBanner(ctx, viewport, deathElapsed);
        } else {
          drawDeathOverlay(ctx, finalScore || gameState.player?.score || 0, viewport);
        }
      }

      // Update leaderboard every ~0.5s
      leaderboardTimerRef.current++;
      if (leaderboardTimerRef.current >= 30) {
        leaderboardTimerRef.current = 0;
        updateLeaderboard(gameState);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    // ── Death overlay: Space/click to respawn (only after 5s elimination) ──
    const canRespawn = () => {
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
    };
  }, [arenaId, handleRespawn, updateLeaderboard, authPlayer, onExit]);

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
          title="Exit to Arena"
        >
          <X className="w-4 h-4 text-white/70 hover:text-red-400" />
        </button>
      )}

      {/* Leaderboard */}
      <div className="absolute top-4 right-4 w-44 pointer-events-none select-none flex flex-col gap-2">
        {/* Best Ever */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2">
          <div className="text-xs text-amber-400/70 font-mono mb-0.5 text-center">Best Ever</div>
          <div className="text-sm text-amber-400 font-bold font-mono text-center">{displayHighScore.toLocaleString()}</div>
        </div>
        {/* Leaderboard */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2">
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
      </div>

      {/* ── Bottom Left: Boost + Extract Buttons ── */}
      <div className="absolute bottom-6 left-5 z-10 flex flex-col gap-3 pointer-events-none">
        {/* Boost Button */}
        <button
          onPointerDown={(e) => { e.stopPropagation(); externalBoostRef.current = true; }}
          onPointerUp={(e) => { e.stopPropagation(); externalBoostRef.current = false; }}
          onPointerLeave={() => { externalBoostRef.current = false; }}
          onPointerCancel={() => { externalBoostRef.current = false; }}
          disabled={isDead}
          className={`pointer-events-auto flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all duration-200 select-none touch-manipulation
            ${isDead
              ? 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'
              : 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25 hover:border-orange-500/50 active:scale-95'
            }`}
        >
          <Zap className="w-5 h-5" />
          <span>Boost</span>
          <span className="text-[10px] font-normal opacity-60">B / Left Click</span>
        </button>

        {/* Extract Button */}
        <button
          onPointerDown={(e) => { e.stopPropagation(); inputRef.current?.setExternalExtract(true); }}
          onPointerUp={(e) => { e.stopPropagation(); inputRef.current?.setExternalExtract(false); }}
          onPointerLeave={() => { inputRef.current?.setExternalExtract(false); }}
          onPointerCancel={() => { inputRef.current?.setExternalExtract(false); }}
          disabled={isDead}
          className={`pointer-events-auto flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all duration-200 select-none touch-manipulation
            ${isDead
              ? 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25 hover:border-amber-500/50 active:scale-95'
            }`}
        >
          <CircleDot className="w-5 h-5" />
          <span>Extract</span>
          <span className="text-[10px] font-normal opacity-60">E / Right Click</span>
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
// Helper: Render background (grid, food)
// ============================================================================

function renderBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  _fps: number,
  _now: number,
): void {
  const { width, height } = viewport;

  // Clear
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, width, height);

  // Grid
  drawGridFromRenderer(ctx, camera, viewport);

  // Food
  drawFoodFromRenderer(ctx, state.foods, camera, viewport);
}

// ============================================================================
// Helper: Render HUD (minimap top-left, score bottom-center, kills bottom-right)
// ============================================================================

function renderHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  _fps: number,
  _now: number,
  kills: number,
  _highScore: number,
): void {
  if (!state.player) return;
  const cw = viewport.width;
  const ch = viewport.height;

  // ── Minimap: top-left ──
  drawMinimapTopLeft(ctx, state.snakes, state.player, cw, ch);

  // ── Rank below minimap ──
  const aliveSnakes = state.snakes.size;
  let rank = 1;
  for (const [, s] of state.snakes) {
    if (s.alive && s.score > state.player.score) rank++;
  }
  const mapPad = 12;
  const mapSize = 120;
  const rankY = mapPad + mapSize + 6;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(mapPad, rankY, mapSize, 24, 6);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '11px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Rank ${rank} / ${aliveSnakes}`, mapPad + mapSize / 2, rankY + 12);

  // ── Score: bottom-center ──
  const scoreVal = Math.floor(state.player.score);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.roundRect(cw / 2 - 80, ch - 56, 160, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(scoreVal.toLocaleString(), cw / 2, ch - 18);

  // ── Kills: bottom-right ──
  const krPad = 12;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(cw - krPad - 100, ch - krPad - 34, 100, 28, 6);
  ctx.fill();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '11px monospace';
  ctx.fillStyle = '#a0a0a0';
  ctx.fillText('Kills', cw - krPad - 52, ch - krPad - 20);
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(String(kills), cw - krPad - 10, ch - krPad - 20);
}

// ============================================================================
// Minimap: top-left position
// ============================================================================

const MAP_SIZE = 120;
const MAP_PAD = 12;

function drawMinimapTopLeft(
  ctx: CanvasRenderingContext2D,
  snakes: Map<string, Snake>,
  player: Snake | null,
  cw: number,
  _ch: number,
): void {
  const size = MAP_SIZE;
  const pad = MAP_PAD;
  const mx = pad;
  const my = pad;

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
  const px = player.path.headX;
  const py = player.path.headY;
  const halfSize = size / 2 - 4;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  for (const [, snake] of snakes) {
    if (!snake.alive || snake.isPlayer) continue;
    if (snake.path.length === 0) continue;
    const dx = (snake.path.headX - px) * scale;
    const dy = (snake.path.headY - py) * scale;
    if (Math.abs(dx) > halfSize || Math.abs(dy) > halfSize) continue;
    ctx.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
  }

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
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
