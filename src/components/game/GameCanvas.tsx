'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, CircleDot } from 'lucide-react';
import { createExtractionState, updateExtractionProgress, drawExtractRing } from '@/lib/snake/extraction';
import { createInitialState, gameTick, respawnPlayer, initBots, type PlayerSkinOverride } from '@/lib/snake/engine';
import { createCamera, updateCamera, getViewport } from '@/lib/snake/camera';
import { SkinAtlasManager, DEFAULT_SKINS } from '@/lib/snake/atlas';
import { getPlayerSkinAsset, registerSkinAsset } from '@/lib/snake/skin-registry';
import { type GameState, type Camera, type Viewport, FIXED_DT } from '@/lib/snake';
import { drawDeathOverlay, drawEliminatedBanner, drawControlsHint } from './renderer';
import { renderSnakeAtlas, renderSnakeFallback, beginRenderFrame, setCachedDpr } from './render-snake-atlas';
import { cleanupDeadSnakeParticles, renderBackground, renderHUD, drawMouseCursor } from './hud';
import { InputHandler } from './input';
import { makeCoiledPath } from './coil-path';
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
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; isPlayer: boolean }[]>([]);
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

  const playerSnakeIdRef = useRef('');

  const updateLeaderboard = useCallback((state: GameState) => {
    playerSnakeIdRef.current = state.player?.id ?? '';
    const entries: { name: string; score: number; isPlayer: boolean }[] = [];
    for (const [, snake] of state.snakes) {
      if (snake.alive) {
        entries.push({ name: snake.name, score: Math.floor(snake.score), isPlayer: snake.isPlayer });
      }
    }
    entries.sort((a, b) => b.score - a.score);
    setLeaderboard(entries.slice(0, 10));
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

    // ── Init game state with player skin + real profile name ──
    const resolvedName = playerName || authPlayer?.name || 'Player';
    gameStateRef.current = createInitialState(skinOverride, undefined, resolvedName);
    // ── Spawn bots (offline mode only — online will have its own bot system) ──
    if (mode === 'offline') {
      gameStateRef.current.botsEnabled = true;
      initBots(gameStateRef.current);
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
      // GAME LOOP — full local simulation
      // ────────────────────────────────────────────────────────────────────

      // Fixed timestep
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const elapsed = Math.min(timestamp - lastTimeRef.current, 100);
      lastTimeRef.current = timestamp;
      accumulatorRef.current += elapsed;

      const tickMs = FIXED_DT * 1000;
      let maxTicks = 10;
      while (accumulatorRef.current >= tickMs && maxTicks-- > 0) {
        const killEvents = gameTick(gameState, inputState, FIXED_DT);
        accumulatorRef.current -= tickMs;


        // Track player kills
        if (gameState.player) {
          for (const ev of killEvents) {
            if (ev.killerId === gameState.player.id) killsRef.current++;
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
      beginRenderFrame();
      const dpr = window.devicePixelRatio || 1;
      setCachedDpr(dpr);
      renderBackground(ctx, gameState, cameraRef.current, viewport, fc.fps, now);

      // ── Render snakes: bots use fallback, player uses atlas ──
      // Cull bots BEFORE makeCoiledPath + renderSnakeFallback to skip
      // expensive walkPathFixedStep for off-screen bots entirely.
      const bvl = viewport.left - 500;
      const bvr = viewport.right + 500;
      const bvt = viewport.top - 500;
      const bvb = viewport.bottom + 500;
      for (const [, s] of gameState.snakes) {
        if (s.alive && !s.isPlayer) {
          // Early cull: skip if head is far off-screen (500px margin)
          if (s.path.headX < bvl || s.path.headX > bvr ||
              s.path.headY < bvt || s.path.headY > bvb) continue;
          const coiled = makeCoiledPath(s.path);
          renderSnakeFallback(ctx, s, cameraRef.current, viewport, now, undefined, undefined, true, coiled);
        }
      }
      if (gameState.player && gameState.player.alive) {
        const coiledPlayer = makeCoiledPath(gameState.player.path);
        renderSnakeAtlas(ctx, gameState.player, cameraRef.current, viewport, atlasManager, now, mouseSX, mouseSY, undefined, coiledPlayer);
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
  }, [arenaId, mode, handleRespawn, updateLeaderboard, authPlayer, onExit, playerName]);

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
