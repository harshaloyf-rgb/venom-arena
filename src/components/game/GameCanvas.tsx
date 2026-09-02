'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, CircleDot } from 'lucide-react';
import { createExtractionState, updateExtractionProgress, drawExtractRing } from '@/lib/snake/extraction';
import { createInitialState, gameTick, respawnPlayer, seedInitialFood, queryVisibleFoods, type PlayerSkinOverride } from '@/lib/snake/engine';
import { createCamera, updateCameraInterpolated, getViewport } from '@/lib/snake/camera';
import { SkinAtlasManager, DEFAULT_SKINS } from '@/lib/snake/atlas';
import { getPlayerSkinAsset, registerSkinAsset, registerDefaultSkins } from '@/lib/snake/skin-registry';
import { type GameState, type Camera, type Viewport } from '@/lib/snake/types';
import { FIXED_DT } from '@/lib/snake/config';
import { drawDeathOverlay, drawEliminatedBanner, drawControlsHint } from './renderer';
import { renderSnakeAtlas, renderSnakeFallback, beginRenderFrameWithDpr } from './render-snake-atlas';
import { cleanupDeadSnakeParticles, renderBackground, renderHUD, handleMinimapClick, resetMinimapZoom } from './hud';
import { initSafeAreaTracking } from './safe-area';
import { InputHandler } from './input';
import { makeCoiledPath } from './coil-path';
import { SEGMENT_SPACING } from '@/lib/snake/config';
import { useAuth } from '@/components/providers/auth-provider';


// ─── Props ───────────────────────────────────────────────────────────────────

interface GameCanvasProps {
  onExit?: () => void;
  arenaId?: string;
  mode: 'offline' | 'online';
  playerName?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GameCanvas({
  onExit,
  arenaId,
  mode,
  playerName,
}: GameCanvasProps) {
  // ── Player skin (read from auth + localStorage) ──
  const { player: authPlayer } = useAuth();

  // P0 FIX: Stabilize auth values as refs so the game useEffect doesn't
  // re-initialize (resetting the entire game) when authPlayer reference changes.
  // Previously, any auth refresh during gameplay killed the game.
  const authSkinRef = useRef(authPlayer?.currentSkin ?? 'skin-viper-green');
  const authNameRef = useRef(authPlayer?.name || 'Player');
  // Note: ref sync moved to useEffect to avoid lint "ref-during-render" rule
  useEffect(() => {
    if (authPlayer?.currentSkin) authSkinRef.current = authPlayer.currentSkin;
    if (authPlayer?.name) authNameRef.current = authPlayer.name;
  });
  const gameStateRef = useRef<GameState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; isPlayer: boolean }[]>([]);
  const isDeadRef = useRef(false);
  const deathTimeRef = useRef(0);
  const showControlsRef = useRef(true);
  const controlsDismissedRef = useRef(false);
  const leaderboardTimerRef = useRef(0);
  const killsRef = useRef(0);
  const killedByRef = useRef('');
  const killerIdRef = useRef('');
  const highScoreRef = useRef(0);
  const [displayHighScore, setDisplayHighScore] = useState(0);

  // Atlas manager
  const atlasManagerRef = useRef<SkinAtlasManager | null>(null);

  // External boost state (from UI button)
  const externalBoostRef = useRef(false);

  // Extraction progress tracking (shared logic)
  const extractionRef = useRef(createExtractionState());


  // ── Leaderboard updater ──

  const playerSnakeIdRef = useRef('');

  // Pre-allocated leaderboard buffer — reuses objects across updates (Issue #12)
  const lbBuf = useRef<{ name: string; score: number; isPlayer: boolean }[]>([]);
  const updateLeaderboard = useCallback((state: GameState) => {
    playerSnakeIdRef.current = state.player?.id ?? '';
    const buf = lbBuf.current;
    let count = 0;
    for (const [, snake] of state.snakes) {
      if (!snake.alive) continue;
      if (count < buf.length) {
        buf[count].name = snake.name;
        buf[count].score = Math.floor(snake.score);
        buf[count].isPlayer = snake.isPlayer;
      } else {
        buf.push({ name: snake.name, score: Math.floor(snake.score), isPlayer: snake.isPlayer });
      }
      count++;
    }
    // Sort top entries (only need top 10, but partial sort is complex)
    buf.length = count;
    buf.sort((a, b) => b.score - a.score);
    setLeaderboard(buf.slice(0, 10));
  }, []);

  // ── Respawn handler ──

  const handleRespawn = useCallback(() => {
    if (!gameStateRef.current) return;
    respawnPlayer(gameStateRef.current);
    isDeadRef.current = false;
    deathTimeRef.current = 0;
    killedByRef.current = '';
    killerIdRef.current = '';
    setIsDead(false);
    setFinalScore(0);

  }, []);

  // ── Main effect: game loop ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cache the 2D context once — getContext('2d') returns the same object
    // for the same canvas + type, but the function call itself has overhead at 60fps.
    const ctx = canvas.getContext('2d');

    // PERF: Cache parent dimensions — reading clientWidth/clientHeight
    // every frame forces a synchronous layout reflow.
    let _cachedW = 0;
    let _cachedH = 0;
    // Size canvas to fill parent
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      // FIX (mobile perf): cap DPR at 2 — raw devicePixelRatio (3.0 on many
      // phones) quadruples fill-rate for marginal visual gain.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      _cachedW = parent.clientWidth;
      _cachedH = parent.clientHeight;
      canvas.width = _cachedW * dpr;
      canvas.height = _cachedH * dpr;
      canvas.style.width = _cachedW + 'px';
      canvas.style.height = _cachedH + 'px';
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
    // Register default skins in the skin registry so getSkinAsset() finds them
    registerDefaultSkins(DEFAULT_SKINS);

    // ── Resolve player's selected skin (from stabilized ref) ──
    const serverSkinId = authSkinRef.current;
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

    // ── Init game state with player skin + real profile name (from stabilized ref) ──
    const resolvedName = playerName || authNameRef.current || 'Player';
    gameStateRef.current = createInitialState(skinOverride, undefined, resolvedName, arenaId);
    // ── Enable bots (offline mode only — online will have its own bot system) ──
    // Bots are NOT spawned synchronously here (that blocked the main thread
    // for 500ms+ with 999 bots → blank screen). Instead, respawnDeadBots in
    // gameTick fills them in gradually at 8/tick ≈ 480/sec → full in ~2s.
    if (mode === 'offline') {
      gameStateRef.current.botsEnabled = true;
    }
    cameraRef.current = createCamera(0, 0);
    isDeadRef.current = false;
    deathTimeRef.current = 0;
    showControlsRef.current = true;
    controlsDismissedRef.current = false;
    leaderboardTimerRef.current = 0;
    killsRef.current = 0;
    extractionRef.current = createExtractionState();

    // Load highest ever score from localStorage (per arena, mode-specific key)
    const highScoreKey = `venom-high-score${mode === 'online' ? '-online' : ''}-${arenaId || 'default'}`;
    try {
      highScoreRef.current = parseInt(localStorage.getItem(highScoreKey) || '0', 10);
      setDisplayHighScore(highScoreRef.current);
    } catch { highScoreRef.current = 0; }

    // Input handler
    const input = new InputHandler(canvas);
    inputRef.current = input;
    input.attach();

    // Minimap zoom tap handler — FIX M4: 'click' never fires on touch because
    // input.ts preventDefault()s touchstart (kills the synthetic click).
    // 'pointerup' fires for BOTH mouse and touch.
    const onCanvasClick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      handleMinimapClick(x, y);
    };
    canvas.addEventListener('pointerup', onCanvasClick);

    // Reset minimap zoom on new game
    resetMinimapZoom();

    // T4-M5: track notch/home-indicator insets for the canvas HUD
    const cleanupSafeArea = initSafeAreaTracking();

    // ── Game loop ──
    let running = true;

    const loop = (timestamp: number) => {
      if (!running) return;

      try {
      // FPS counter
      const fc = fpsCounterRef.current;
      fc.frames++;
      if (timestamp - fc.lastTime >= 1000) {
        fc.fps = fc.frames;
        fc.frames = 0;
        fc.lastTime = timestamp;
      }

      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const w = _cachedW || (canvas.parentElement ? canvas.parentElement.clientWidth : canvas.width);
      const h = _cachedH || (canvas.parentElement ? canvas.parentElement.clientHeight : canvas.height);
      const now = performance.now();
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
      // GAME LOOP — full local simulation with P0 render interpolation
      // ────────────────────────────────────────────────────────────────────

      // PERF FIX: Raised max ticks from 2→6 and accumulator cap from 2→6.
      // The old cap of 2 directly coupled snake speed to framerate:
      // 45fps = 75% speed, 30fps = 50% speed. Now the snake catches up
      // after frame drops. 6 ticks max = 100ms of physics = 6px movement,
      // which is visually indistinguishable from normal (no noticeable jump).
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const elapsed = Math.min(timestamp - lastTimeRef.current, 100);
      lastTimeRef.current = timestamp;
      accumulatorRef.current += elapsed;

      const tickMs = FIXED_DT * 1000;
      const maxAccum = tickMs * 6;
      if (accumulatorRef.current > maxAccum) accumulatorRef.current = maxAccum;

      // FIX H3: Save prevHeadX/Y for ALL alive snakes (not just the player)
      // BEFORE any ticks run, once per FRAME (standard fixed-timestep interpolation).
      // Bots previously kept their spawn-position prevHead forever, which made
      // per-bot render interpolation impossible (alpha=1 was forced as a
      // workaround — that's what made the whole world step 3px/tick while the
      // camera glided → the "camera shake" shimmer).
      // Saving per FRAME (not per tick) keeps every snake's interpolation span
      // identical to the camera's span, even when 2+ ticks run in one frame.
      for (const [, s] of gameState.snakes) {
        if (!s.alive) continue;
        s.prevHeadX = s.path.headX;
        s.prevHeadY = s.path.headY;
        // Tier-2: same per-frame pattern for head ROTATION. moveSnake
        // overwrites prevAngle every tick, so with 2+ ticks per frame the
        // render lerp spanned only the LAST tick's turn — heads lagged
        // their position at low FPS. Saving per frame makes the rotation
        // span identical to the position/camera span.
        s.renderPrevAngle = s.angle;
      }

      let ticksThisFrame = 0;
      const maxTicks = 6;
      while (accumulatorRef.current >= tickMs && ticksThisFrame < maxTicks) {
        const killEvents = gameTick(gameState, inputState, FIXED_DT);
        accumulatorRef.current -= tickMs;

        // Track player kills + detect who killed the player
        if (gameState.player) {
          for (const ev of killEvents) {
            if (ev.killerId === gameState.player.id) killsRef.current++;
            if (ev.victimId === gameState.player.id) {
              killedByRef.current = ev.killerName;
              killerIdRef.current = ev.killerId;
            }
          }
          // Track high score (per arena, mode-specific key)
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
        ticksThisFrame++;
      }

      // P0 FIX: Incrementally seed food across the map.
      // Prevents initial food spawn from blocking the main thread.
      if (gameState.foods.length < gameState.arenaConfig.initialFoodTarget) {
        seedInitialFood(gameState);
      }

      // Camera interpolation — only valid when player is alive
      // alpha = how far we are toward the next tick (0 to 1).
      const alpha = Math.max(0, Math.min(accumulatorRef.current / tickMs, 1.0));
      const player = gameState.player;
      if (player && player.alive) {
        updateCameraInterpolated(cameraRef.current, player, w, h, alpha);
      }

      const viewport: Viewport = getViewport(cameraRef.current, w, h);

      // Mouse position for eye tracking
      const mousePos = input.getMousePos();
      const mouseSX = mousePos?.x;
      const mouseSY = mousePos?.y;

      // ── Render: background ──
      const dpr = window.devicePixelRatio || 1;
      beginRenderFrameWithDpr(dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // FIX G2: cull food via the spatial hash before drawing. The old path
      // iterated ALL food (up to 20K orbs) every frame with per-item bounds
      // checks — 1.2M+ iterations/sec of which ~400 were visible.
      const viewRadius = Math.hypot(w, h) / (2 * cameraRef.current.zoom) + 120;
      const visibleFoods = queryVisibleFoods(cameraRef.current.x, cameraRef.current.y, viewRadius);
      renderBackground(ctx, gameState, cameraRef.current, viewport, fc.fps, now, visibleFoods);

      // ── Render snakes: bots use fallback, player uses atlas ──
      // Culling: use body-aware margin so long snakes don't pop in/out.
      // The body extends BEHIND the head, so the cull box must cover head
      // (forward) + body length (behind). A fixed 500px head-only margin
      // caused long snakes to vanish when only the head left the viewport.
      const baseMargin = 500;
      const camX = cameraRef.current.x;
      const camY = cameraRef.current.y;
      for (const [, s] of gameState.snakes) {
        if (s.alive && !s.isPlayer) {
          const bodyLen = s.cachedBodyLength * SEGMENT_SPACING;
          const margin = bodyLen + baseMargin;
          // Body-aware cull: the snake is off-screen if BOTH its head (front)
          // and the end of its body (behind head) are outside the viewport.
          // We approximate: head must be within margin on the forward side,
          // and within bodyLen+margin on the trailing side. Since we don't
          // know heading per-axis, use the full margin in all directions.
          if (s.path.headX < viewport.left - margin || s.path.headX > viewport.right + margin ||
              s.path.headY < viewport.top - margin || s.path.headY > viewport.bottom + margin) continue;
          // FIX H3: bots get the SAME alpha as the camera. renderOff is applied
          // to head AND body identically inside the renderer (rigid shift), so
          // there is no head-body separation risk — but now bots glide in sync
          // with the camera instead of stepping 3px/tick against it.
          const dx = s.path.headX - camX;
          const dy = s.path.headY - camY;
          const lodFar = dx * dx + dy * dy > 1500 * 1500 ? 1 : 0;
          renderSnakeFallback(ctx, s, cameraRef.current, viewport, now, undefined, undefined, true, alpha, undefined, lodFar);
        }
      }
      if (gameState.player && gameState.player.alive) {
        const coiledPlayer = makeCoiledPath(gameState.player.path);
        renderSnakeAtlas(ctx, gameState.player, cameraRef.current, viewport, atlasManager, now, mouseSX, mouseSY, undefined, alpha, coiledPlayer);
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

      // ── Killer highlight: pulsing red glow on the bot that killed you ──
      // Renders for 5s after death so you can SEE what killed you.
      if (isDeadRef.current && killerIdRef.current) {
        const deathElapsed = performance.now() - deathTimeRef.current;
        if (deathElapsed < 5000) {
          const killerSnake = gameState.snakes.get(killerIdRef.current);
          if (killerSnake && killerSnake.alive && killerSnake.path.length >= 2) {
            const cam = cameraRef.current;
            const pulse = 0.4 + 0.6 * Math.abs(Math.sin(deathElapsed * 0.005));
            const glowR = (killerSnake.bodyRadius + 6) * cam.zoom;
            const step = Math.max(1, Math.floor(8 / (killerSnake.bodyRadius * 2 + 1)));
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            for (let i = 0; i < killerSnake.path.length; i += step) {
              const wx = killerSnake.path.getX(i);
              const wy = killerSnake.path.getY(i);
              const sx = (wx - cam.x) * cam.zoom + w / 2;
              const sy = (wy - cam.y) * cam.zoom + h / 2;
              if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
            // Red glow circles along body
            ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.shadowBlur = 15;
            for (let i = 0; i < killerSnake.path.length; i += step * 2) {
              const wx = killerSnake.path.getX(i);
              const wy = killerSnake.path.getY(i);
              const sx = (wx - cam.x) * cam.zoom + w / 2;
              const sy = (wy - cam.y) * cam.zoom + h / 2;
              ctx.beginPath();
              ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
              ctx.fill();
            }
            // Killer name label above head
            const headSx = (killerSnake.path.headX - cam.x) * cam.zoom + w / 2;
            const headSy = (killerSnake.path.headY - cam.y) * cam.zoom + h / 2;
            ctx.shadowBlur = 0;
            ctx.globalAlpha = Math.min(1, deathElapsed / 300);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(killedByRef.current, headSx, headSy - glowR - 8);
            ctx.restore();
          }
        }
      }

      if (isDeadRef.current) {
        const deathElapsed = performance.now() - deathTimeRef.current;
        if (deathElapsed < 5000) {
          drawEliminatedBanner(ctx, viewport, deathElapsed);
        } else {
          drawDeathOverlay(ctx, finalScore || gameState.player?.score || 0, viewport, killedByRef.current);
        }
      }

      // Update leaderboard every ~0.5s
      leaderboardTimerRef.current++;
      if (leaderboardTimerRef.current >= 30) {
        leaderboardTimerRef.current = 0;
        updateLeaderboard(gameState);
      }

      animFrameRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error('[GameCanvas] Game loop error:', err);
        // Try to continue the loop even after an error
        animFrameRef.current = requestAnimationFrame(loop);
      }
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
    // FIX M4: pointerup instead of click so tap-to-respawn works on touch
    const onRespawnClick = () => {
      if (canRespawn()) handleRespawn();
    };
    window.addEventListener('keydown', onRespawnKey);
    canvas.addEventListener('pointerup', onRespawnClick);

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      input.detach();
      cleanupSafeArea();
      canvas.removeEventListener('pointerup', onCanvasClick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onRespawnKey);
      canvas.removeEventListener('pointerup', onRespawnClick);
    };
  // NOTE: authPlayer is NOT in the dependency array — it's captured via refs.
  // Adding it here caused the game to reset every time auth refreshed.
  }, [arenaId, mode, handleRespawn, updateLeaderboard, onExit, playerName]);

  // ── Render ──


  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden">
      <canvas
          ref={canvasRef}
          className="block"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
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

      <div className="absolute top-4 right-4 w-44 pointer-events-none select-none flex flex-col gap-2">
        {/* Best Ever */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1.5">
          <div className="text-[8px] text-amber-400/70 font-mono text-center">Best Ever</div>
          <div className="text-[9px] text-amber-400 font-bold font-mono text-center leading-tight">{displayHighScore.toLocaleString()} <span className="font-normal opacity-60">score</span></div>
        </div>
        {/* Leaderboard */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 max-h-72 overflow-y-auto scrollbar-thin">
          <div className="text-[10px] text-white/60 font-mono mb-1 text-center">Leaderboard</div>
          {leaderboard.map((entry, i) => (
            <div
              key={i}
              className={`flex justify-between text-[10px] font-mono px-1 py-0.5 rounded ${
                entry.isPlayer ? 'text-green-400 bg-white/5' : 'text-white/70'
              }`}
            >
              <span>{i + 1}. {i === 0 && '\u{1F451}'}{entry.name}</span>
              <span>{Math.floor(entry.score)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Left: Boost + Extract Buttons ── */}
      <div className="absolute bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] left-[calc(1.25rem_+_env(safe-area-inset-left))] z-10 flex flex-col gap-3 pointer-events-none">
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
