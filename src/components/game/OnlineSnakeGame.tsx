'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  createGameSocket, type GameSocketState, type GameSnapshot,
} from '@/lib/game-socket';
import { RemoteSnakeManager } from '@/lib/remote-snake-manager';
import { createCamera, updateCameraInterpolated, getViewport } from '@/lib/snake/camera';
import { SkinAtlasManager } from '@/lib/snake/atlas';
import { getPlayerSkinAsset } from '@/lib/snake/skin-registry';
import { getArenaConfig, SEGMENT_SPACING } from '@/lib/snake/config';
import type { Snake, Camera, Viewport } from '@/lib/snake';
import { renderSnakeAtlas, renderSnakeFallback, beginRenderFrameWithDpr } from './render-snake-atlas';
import { renderBackground, renderHUD, resetMinimapZoom } from './hud';
import { drawEliminatedBanner, drawDeathOverlay } from './renderer';

// ─── Props ───────────────────────────────────────────────────────────────────

interface OnlineSnakeGameProps {
  onExit?: () => void;
  arenaId?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnlineSnakeGame({ onExit, arenaId }: OnlineSnakeGameProps) {
  const { player } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sockRef = useRef<ReturnType<typeof createGameSocket> | null>(null);
  const snapRef = useRef<GameSnapshot | null>(null);
  const inputRef = useRef({ angle: 0, boost: false, mouseX: 0, mouseY: 0 });
  const animRef = useRef(0);
  const managerRef = useRef<RemoteSnakeManager | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const atlasRef = useRef<SkinAtlasManager | null>(null);
  const mapHalfRef = useRef(10000);
  const deathTimeRef = useRef<number | null>(null);
  const killedByRef = useRef<string | null>(null);

  const [socketState, setSocketState] = useState<GameSocketState>({
    status: 'disconnected', snapshot: null, error: null, matchEnd: null, killerName: null,
  });

  // ── Connect to game server ──
  useEffect(() => {
    if (!arenaId) return;
    let cancelled = false;

    (async () => {
      const tokenRes = await fetch('/api/auth/game-token');
      if (!tokenRes.ok || cancelled) return;
      const { token } = await tokenRes.json();
      if (!token || cancelled) return;

      const sock = createGameSocket((state) => {
        if (!cancelled) {
          setSocketState(state);
          snapRef.current = state.snapshot;
        }
      });
      sockRef.current = sock;
      sock.connect(token, arenaId);
    })();

    return () => {
      cancelled = true;
      sockRef.current?.disconnect();
    };
  }, [arenaId]);

  // ── Canvas setup + render loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Sizing ──
    let cw = 0, ch = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cw = parent.clientWidth;
      ch = parent.clientHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Mouse tracking ──
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseX = e.clientX - rect.left;
      inputRef.current.mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', onMouseMove);
    const onMouseDown = () => { inputRef.current.boost = true; };
    const onMouseUp = () => { inputRef.current.boost = false; };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // ── Keyboard ──
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); inputRef.current.boost = true; }
      if (e.code === 'KeyB') inputRef.current.boost = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyB') inputRef.current.boost = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Init atlas + camera ──
    const atlasManager = new SkinAtlasManager();
    atlasRef.current = atlasManager;
    const playerSkinAsset = getPlayerSkinAsset(player?.currentSkin);
    if (playerSkinAsset) atlasManager.buildAtlas(playerSkinAsset);

    const ac = getArenaConfig();
    mapHalfRef.current = ac.mapHalf;
    const camera = createCamera(0, 0);
    cameraRef.current = camera;
    const manager = new RemoteSnakeManager(ac.mapHalf);
    managerRef.current = manager;
    resetMinimapZoom();

    // ── Track death state ──
    const checkDeath = () => {
      if (snapRef.current && !snapRef.current.playerAlive && !deathTimeRef.current) {
        deathTimeRef.current = performance.now();
      }
      if (socketState.killerName && !killedByRef.current) {
        killedByRef.current = socketState.killerName;
      }
    };

    // ── Render loop ──
    const loop = () => {
      animRef.current = requestAnimationFrame(loop);

      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w === 0 || h === 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const snap = snapRef.current;
      checkDeath();

      // ── Loading / error / disconnected screen ──
      if (!snap) {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (socketState.status === 'connecting')
          ctx.fillText('Connecting to server...', w / 2, h / 2);
        else if (socketState.status === 'error') {
          ctx.fillStyle = '#ef4444';
          ctx.fillText(socketState.error || 'Connection failed', w / 2, h / 2);
        } else if (socketState.status === 'disconnected')
          ctx.fillText('Disconnected', w / 2, h / 2);
        return;
      }

      // ── Update snake manager with new snapshot ──
      manager.updateSnapshot(snap);

      // ── Compute target angle from mouse ──
      const mx = inputRef.current.mouseX;
      const my = inputRef.current.mouseY;
      const targetAngle = Math.atan2(my - h / 2, mx - w / 2);
      inputRef.current.angle = targetAngle;
      sockRef.current?.sendInput(targetAngle, inputRef.current.boost);

      // ── Update camera ──
      const alpha = manager.getInterpAlpha();
      const playerSnake = manager.getPlayerSnakeId()
        ? manager.buildSnakeAdapter(manager.getPlayerSnakeId()!)
        : null;
      if (playerSnake) {
        playerSnake.prevHeadX = playerSnake.path.headX;
        playerSnake.prevHeadY = playerSnake.path.headY;
        updateCameraInterpolated(camera, playerSnake, w, h, alpha);
      } else {
        // Smoothly move camera to player position from snapshot
        camera.x += (snap.playerX - camera.x) * 0.1;
        camera.y += (snap.playerY - camera.y) * 0.1;
      }

      const viewport: Viewport = getViewport(camera, w, h);

      // ── Build synthetic GameState for shared renderers ──
      const gameState = manager.buildGameState(snap, ac);

      // ── Render ──
      beginRenderFrameWithDpr(dpr);
      renderBackground(ctx, gameState, camera, viewport, 60, performance.now());

      // Render snakes (bots first, then player on top)
      const now = performance.now();
      const mouseSX = mx;
      const mouseSY = my;

      for (const [id, snake] of gameState.snakes) {
        if (snake.isPlayer) continue;
        if (snake.path.length < 2) continue;
        const headWx = snake.path.headX;
        const headWy = snake.path.headY;
        const margin = snake.cachedBodyLength * SEGMENT_SPACING + 500;
        if (headWx < viewport.left - margin || headWx > viewport.right + margin ||
            headWy < viewport.top - margin || headWy > viewport.bottom + margin) continue;
        try {
          renderSnakeFallback(ctx, snake, camera, viewport, now, undefined, undefined, true, 1, undefined, 1);
        } catch (e: any) { console.error('[Online] bot render:', id, e.message); }
      }

      // Player snake (with full skin/atlas rendering)
      if (gameState.player && gameState.player.alive && gameState.player.path.length >= 2) {
        const ps = gameState.player;
        if (playerSkinAsset) {
          ps.skinId = playerSkinAsset.id;
          ps.rarity = playerSkinAsset.rarity;
        }
        ps.boosting = snap.playerBoosting;
        try {
          renderSnakeAtlas(ctx, ps, camera, viewport, atlasManager, now, mouseSX, mouseSY, undefined, alpha);
        } catch (e: any) { console.error('[Online] player render:', e.message); }
      }

      // HUD
      renderHUD(ctx, gameState, camera, viewport, 60, now, snap.playerKills, 0);

      // Death overlays
      if (deathTimeRef.current) {
        const elapsed = (performance.now() - deathTimeRef.current) / 1000;
        if (elapsed < 5) {
          drawEliminatedBanner(ctx, viewport, elapsed);
        } else {
          drawDeathOverlay(ctx, snap.playerScore, viewport, killedByRef.current || undefined);
        }
      }
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [player, socketState.status, socketState.killerName]);

  // ── Respawning ──
  const handleRespawn = useCallback(() => {
    if (arenaId) window.location.reload();
  }, [arenaId]);

  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'crosshair' }} />

      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-4 left-4 z-10 w-9 h-9 rounded-lg bg-black/60 hover:bg-red-950/60 border border-white/10 hover:border-red-500/30 flex items-center justify-center cursor-pointer transition-colors"
      >
        <X className="w-4 h-4 text-white/60" />
      </button>

      {/* Boost button */}
      {!socketState.matchEnd && (
        <div className="absolute bottom-6 right-4 z-10 pointer-events-none flex flex-col items-center gap-1.5">
          <button className="pointer-events-auto flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all duration-200 select-none touch-manipulation bg-orange-500/15 border-orange-500/30 text-orange-400">
            <Zap className="w-4 h-4" />
            <span className="text-[10px]">B / Click</span>
          </button>
        </div>
      )}

      {/* Death overlay (React) — shown after 5s as fallback */}
      {socketState.matchEnd && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-red-500">ELIMINATED</h2>
            {socketState.killerName && (
              <p className="text-white/60">Killed by <span className="text-white font-bold">{socketState.killerName}</span></p>
            )}
            <p className="text-white/80">Score: {Math.floor(socketState.matchEnd.score).toLocaleString()}</p>
            <p className="text-white/60">Kills: {socketState.matchEnd.kills}</p>
            <button
              onClick={handleRespawn}
              className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
            >
              Return to Arena
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
