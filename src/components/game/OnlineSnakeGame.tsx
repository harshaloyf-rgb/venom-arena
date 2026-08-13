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
import { renderBackground, renderHUD, resetMinimapZoom, handleMinimapClick } from './hud';
import { drawEliminatedBanner, drawDeathOverlay, drawControlsHint } from './renderer';

// ─── Props ───────────────────────────────────────────────────────────────────

interface OnlineSnakeGameProps {
  onExit?: () => void;
  arenaId?: string;
}

// ─── Leaderboard entry ───────────────────────────────────────────────────────

interface LBEntry {
  name: string;
  score: number;
  isPlayer: boolean;
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
  const deathTimeRef = useRef<number | null>(null);
  const killedByRef = useRef<string | null>(null);
  const externalBoostRef = useRef(false);
  const controlsShownRef = useRef(true);
  const controlsTimerRef = useRef(0);
  const leaderboardTimerRef = useRef(0);
  const leaderboardRef = useRef<LBEntry[]>([]);

  const [socketState, setSocketState] = useState<GameSocketState>({
    status: 'disconnected', snapshot: null, error: null, matchEnd: null, killerName: null,
  });
  const [leaderboard, setLeaderboard] = useState<LBEntry[]>([]);
  const [displayHighScore, setDisplayHighScore] = useState(0);

  // ── Update leaderboard from game state ──
  const updateLeaderboard = useCallback((snakes: Map<string, Snake>, player: Snake | null) => {
    const entries: LBEntry[] = [];
    for (const [, s] of snakes) {
      if (!s.alive) continue;
      entries.push({ name: s.name, score: s.score, isPlayer: !!s.isPlayer });
    }
    entries.sort((a, b) => b.score - a.score);
    const top10 = entries.slice(0, 10);
    leaderboardRef.current = top10;
    setLeaderboard(top10);
  }, []);

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

  // ── Load high score ──
  useEffect(() => {
    try {
      const key = `venom-high-score-online-${arenaId || 'default'}`;
      const saved = parseInt(localStorage.getItem(key) || '0', 10);
      setDisplayHighScore(saved);
    } catch { /* ignore */ }
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
      // Dismiss controls on first mouse move
      if (controlsShownRef.current) {
        controlsShownRef.current = false;
        controlsTimerRef.current = performance.now();
      }
    };
    canvas.addEventListener('mousemove', onMouseMove);
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { inputRef.current.boost = true; externalBoostRef.current = true; }
      // Dismiss controls on click
      if (controlsShownRef.current) {
        controlsShownRef.current = false;
        controlsTimerRef.current = performance.now();
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) { inputRef.current.boost = false; externalBoostRef.current = false; }
    };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // ── Keyboard ──
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); inputRef.current.boost = true; externalBoostRef.current = true; }
      if (e.code === 'KeyB') { inputRef.current.boost = true; externalBoostRef.current = true; }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyB') { inputRef.current.boost = false; externalBoostRef.current = false; }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Minimap click handler ──
    const onCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      handleMinimapClick(x, y);
    };
    canvas.addEventListener('click', onCanvasClick);

    // ── Init atlas + camera ──
    const atlasManager = new SkinAtlasManager();
    atlasRef.current = atlasManager;
    const playerSkinAsset = getPlayerSkinAsset(player?.currentSkin);
    if (playerSkinAsset) atlasManager.buildAtlas(playerSkinAsset);

    const ac = getArenaConfig();
    const camera = createCamera(0, 0);
    cameraRef.current = camera;
    const manager = new RemoteSnakeManager(ac.mapHalf);
    managerRef.current = manager;
    resetMinimapZoom();

    // ── Track death state ──
    const checkDeath = () => {
      const snap = snapRef.current;
      if (snap && !snap.playerAlive && !deathTimeRef.current) {
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

      // ── Update snake manager ONLY when snapshot tick changes ──
      const didUpdate = manager.updateSnapshot(snap);

      // ── Compute target angle from mouse ──
      const mx = inputRef.current.mouseX;
      const my = inputRef.current.mouseY;
      const targetAngle = Math.atan2(my - h / 2, mx - w / 2);
      inputRef.current.angle = targetAngle;

      // ── Send input (boost from canvas click OR keyboard, OR UI button) ──
      const isBoosting = inputRef.current.boost || externalBoostRef.current;
      sockRef.current?.sendInput(targetAngle, isBoosting);

      // ── Update camera with proper interpolation ──
      const alpha = manager.getPlayerAlpha();
      const playerSnake = manager.getPlayerSnakeId()
        ? manager.buildSnakeAdapter(manager.getPlayerSnakeId()!)
        : null;
      if (playerSnake) {
        // DO NOT override prevHeadX/Y — the manager already set them correctly
        // from the previous snapshot, enabling smooth interpolation.
        updateCameraInterpolated(camera, playerSnake, w, h, alpha);
      } else if (snap.playerAlive) {
        // Player snake not tracked yet but alive — smoothly move camera to snapshot position
        camera.x += (snap.playerX - camera.x) * 0.1;
        camera.y += (snap.playerY - camera.y) * 0.1;
      }

      const viewport: Viewport = getViewport(camera, w, h);
      const camX = camera.x;
      const camY = camera.y;

      // ── Build synthetic GameState for shared renderers ──
      const gameState = manager.buildGameState(snap, ac);

      // ── Render ──
      const now = performance.now();
      beginRenderFrameWithDpr(dpr);
      renderBackground(ctx, gameState, camera, viewport, 60, now);

      // ── Render snakes (bots first, then player on top) ──
      for (const [id, snake] of gameState.snakes) {
        if (snake.isPlayer) continue;
        if (!snake.alive) continue;
        if (snake.path.length < 2) continue;

        const headWx = snake.path.headX;
        const headWy = snake.path.headY;
        const margin = snake.cachedBodyLength * SEGMENT_SPACING + 500;
        if (headWx < viewport.left - margin || headWx > viewport.right + margin ||
            headWy < viewport.top - margin || headWy > viewport.bottom + margin) continue;

        // LOD: far bots get simplified rendering
        const dx = headWx - camX;
        const dy = headWy - camY;
        const lodFar = dx * dx + dy * dy > 1500 * 1500 ? 1 : 0;

        try {
          // Bots get alpha=1 (no interpolation — path already rebuilt for current position)
          renderSnakeFallback(ctx, snake, camera, viewport, now, undefined, undefined, true, 1, undefined, lodFar);
        } catch (e: any) { console.error('[Online] bot render:', id, e.message); }
      }

      // ── Player snake (with full skin/atlas rendering + interpolation) ──
      if (gameState.player && gameState.player.alive && gameState.player.path.length >= 2) {
        const ps = gameState.player;
        if (playerSkinAsset) {
          ps.skinId = playerSkinAsset.id;
          ps.rarity = playerSkinAsset.rarity;
        }
        ps.boosting = isBoosting;
        try {
          renderSnakeAtlas(ctx, ps, camera, viewport, atlasManager, now, mx, my, undefined, alpha);
        } catch (e: any) { console.error('[Online] player render:', e.message); }
      }

      // ── HUD (minimap, score, rank, kills) ──
      renderHUD(ctx, gameState, camera, viewport, 60, now, snap.playerKills, 0);

      // ── Controls hint (show for 3 seconds after game start or first interaction) ──
      if (controlsTimerRef.current > 0) {
        const hintElapsed = now - controlsTimerRef.current;
        if (hintElapsed < 3000) {
          drawControlsHint(ctx, viewport);
        } else {
          controlsTimerRef.current = 0;
        }
      }

      // ── Mouse cursor (slither.io style crosshair) ──
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // ── Death overlays ──
      if (deathTimeRef.current) {
        const elapsed = (now - deathTimeRef.current) / 1000;
        if (elapsed < 5) {
          drawEliminatedBanner(ctx, viewport, elapsed);
        } else {
          drawDeathOverlay(ctx, snap.playerScore, viewport);
        }
      }

      // ── Update leaderboard every ~30 frames (0.5s) ──
      if (didUpdate) {
        leaderboardTimerRef.current++;
        if (leaderboardTimerRef.current >= 10) {
          leaderboardTimerRef.current = 0;
          updateLeaderboard(gameState.snakes, gameState.player);
          // Track high score
          if (gameState.player) {
            try {
              const key = `venom-high-score-online-${arenaId || 'default'}`;
              const hs = Math.floor(gameState.player.score);
              if (hs > displayHighScore) {
                setDisplayHighScore(hs);
                localStorage.setItem(key, String(hs));
              }
            } catch { /* ignore */ }
          }
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
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, [player, arenaId, socketState.killerName, updateLeaderboard, displayHighScore]);

  // ── Respawning ──
  const handleRespawn = useCallback(() => {
    if (arenaId) window.location.reload();
  }, [arenaId]);

  const isDead = !!(deathTimeRef.current && (performance.now() - deathTimeRef.current) > 5000);

  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'none', touchAction: 'none' }} />

      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-4 left-4 z-10 w-9 h-9 rounded-lg bg-black/60 hover:bg-red-950/60 border border-white/10 hover:border-red-500/30 flex items-center justify-center cursor-pointer transition-colors"
      >
        <X className="w-4 h-4 text-white/60" />
      </button>

      {/* Top Right: Best Ever + Leaderboard */}
      <div className="absolute top-4 right-4 w-44 pointer-events-none select-none flex flex-col gap-2">
        {/* Best Ever */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1.5">
          <div className="text-[8px] text-amber-400/70 font-mono text-center">Best Ever</div>
          <div className="text-[9px] text-amber-400 font-bold font-mono text-center leading-tight">{displayHighScore.toLocaleString()} <span className="font-normal opacity-60">score</span></div>
        </div>
        {/* Leaderboard */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 max-h-72 overflow-y-auto scrollbar-thin">
          <div className="text-[10px] text-white/60 font-mono mb-1 text-center">Leaderboard</div>
          {leaderboard.length === 0 && (
            <div className="text-[9px] text-white/30 font-mono text-center py-2">Waiting...</div>
          )}
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

      {/* Bottom Left: Boost Button */}
      <div className="absolute bottom-6 left-5 z-10 pointer-events-none flex flex-col gap-3">
        <button
          onPointerDown={(e) => { e.stopPropagation(); externalBoostRef.current = true; inputRef.current.boost = true; }}
          onPointerUp={(e) => { e.stopPropagation(); externalBoostRef.current = false; inputRef.current.boost = false; }}
          onPointerLeave={() => { externalBoostRef.current = false; inputRef.current.boost = false; }}
          onPointerCancel={() => { externalBoostRef.current = false; inputRef.current.boost = false; }}
          className="pointer-events-auto flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all duration-200 select-none touch-manipulation bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25 hover:border-orange-500/50 active:scale-95"
        >
          <Zap className="w-5 h-5" />
          <span>Boost</span>
          <span className="text-[10px] font-normal opacity-60">B / Left Click</span>
        </button>
      </div>

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
