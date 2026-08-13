'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, CircleDot, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  createGameSocket, type GameSnapshot,
} from '@/lib/game-socket';
import { RemoteSnakeManager } from '@/lib/remote-snake-manager';
import { createCamera, updateCameraInterpolated, getViewport } from '@/lib/snake/camera';
import { SkinAtlasManager, DEFAULT_SKINS } from '@/lib/snake/atlas';
import { getPlayerSkinAsset, registerSkinAsset } from '@/lib/snake/skin-registry';
import { getArenaConfig, SEGMENT_SPACING, BASE_SPEED } from '@/lib/snake/config';
import type { Snake, Camera, Viewport } from '@/lib/snake';
import { renderSnakeAtlas, renderSnakeFallback, beginRenderFrameWithDpr } from './render-snake-atlas';
import { renderBackground, renderHUD, resetMinimapZoom, handleMinimapClick } from './hud';
import { drawEliminatedBanner, drawDeathOverlay, drawControlsHint } from './renderer';
import { makeCoiledPath } from './coil-path';

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

// ─── Client-Side Prediction ────────────────────────────────────────────────
// The server sends snapshots at 20Hz. Between snapshots, we predict the
// player's head position using the last known angle + speed.

interface PredictedState {
  x: number;
  y: number;
  angle: number;
  lastSnapTime: number;
  boosting: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnlineSnakeGame({ onExit, arenaId }: OnlineSnakeGameProps) {
  const { player } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sockRef = useRef<ReturnType<typeof createGameSocket> | null>(null);
  const snapRef = useRef<GameSnapshot | null>(null);
  const inputRef = useRef({ angle: 0, boost: false, mouseX: 0, mouseY: 0, keysActive: false, keyAngle: 0 });
  const animRef = useRef(0);
  const managerRef = useRef<RemoteSnakeManager | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const atlasRef = useRef<SkinAtlasManager | null>(null);
  const deathTimeRef = useRef<number | null>(null);
  const externalBoostRef = useRef(false);
  const controlsShownRef = useRef(true);
  const controlsTimerRef = useRef(0);
  const leaderboardTimerRef = useRef(0);
  const isDeadRef = useRef(false);
  const killerIdRef = useRef<string | null>(null);

  // Client-side prediction state
  const predictedRef = useRef<PredictedState | null>(null);
  const lastInputAngleRef = useRef(0);

  // ── ALL values the render loop reads MUST be refs ──
  const statusRef = useRef<string>('disconnected');
  const errorRef = useRef<string | null>(null);
  const killerNameRef = useRef<string | null>(null);
  const highScoreRef = useRef(0);
  const matchEndRef = useRef<{ outcome: string; score: number; kills: number } | null>(null);
  const playerScoreRef = useRef(0);
  const playerKillsRef = useRef(0);
  const playerAliveRef = useRef(true);
  const playerAngleRef = useRef(0);

  // ── React state ONLY for JSX display ──
  const [displayStatus, setDisplayStatus] = useState('disconnected');
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LBEntry[]>([]);
  const [displayHighScore, setDisplayHighScore] = useState(0);
  const [displayKiller, setDisplayKiller] = useState<string | null>(null);
  const [matchEnd, setMatchEnd] = useState<{ outcome: string; score: number; kills: number } | null>(null);
  const [isDead, setIsDead] = useState(false);

  // ── Stable callback for leaderboard updates (ref, never changes) ──
  const updateLeaderboardRef = useRef((snakes: Map<string, Snake>, player: Snake | null) => {
    const entries: LBEntry[] = [];
    for (const [, s] of snakes) {
      if (!s.alive) continue;
      entries.push({ name: s.name, score: s.score, isPlayer: !!s.isPlayer });
    }
    entries.sort((a, b) => b.score - a.score);
    const top10 = entries.slice(0, 10);
    setLeaderboard(top10);
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
        if (cancelled) return;
        snapRef.current = state.snapshot;
        statusRef.current = state.status;
        errorRef.current = state.error;
        if (state.killerName && !killerNameRef.current) {
          killerNameRef.current = state.killerName;
          setDisplayKiller(state.killerName);
        }
        if (state.matchEnd) {
          matchEndRef.current = state.matchEnd;
          setMatchEnd(state.matchEnd);
        }
        setDisplayStatus(state.status);
        setDisplayError(state.error);
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
    let _cachedW = 0;
    let _cachedH = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      _cachedW = parent.clientWidth;
      _cachedH = parent.clientHeight;
      canvas.width = _cachedW * dpr;
      canvas.height = _cachedH * dpr;
      canvas.style.width = _cachedW + 'px';
      canvas.style.height = _cachedH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Mouse tracking ──
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseX = e.clientX - rect.left;
      inputRef.current.mouseY = e.clientY - rect.top;
      inputRef.current.keysActive = false;
      if (controlsShownRef.current) {
        controlsShownRef.current = false;
        controlsTimerRef.current = performance.now();
      }
    };
    canvas.addEventListener('mousemove', onMouseMove);

    // Touch support
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseX = touch.clientX - rect.left;
      inputRef.current.mouseY = touch.clientY - rect.top;
      inputRef.current.keysActive = false;
      if (controlsShownRef.current) {
        controlsShownRef.current = false;
        controlsTimerRef.current = performance.now();
      }
    };
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseX = touch.clientX - rect.left;
      inputRef.current.mouseY = touch.clientY - rect.top;
      inputRef.current.keysActive = false;
    }, { passive: true });

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.boost = true;
        externalBoostRef.current = true;
      }
      if (controlsShownRef.current) {
        controlsShownRef.current = false;
        controlsTimerRef.current = performance.now();
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.boost = false;
        externalBoostRef.current = false;
      }
    };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // ── Keyboard (Boost + WASD/Arrow steering) ──
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyB' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        inputRef.current.boost = true;
        externalBoostRef.current = true;
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp' ||
          e.code === 'KeyS' || e.code === 'ArrowDown' ||
          e.code === 'KeyA' || e.code === 'ArrowLeft' ||
          e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        inputRef.current.keysActive = true;
        let dx = 0, dy = 0;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') dy -= 1;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') dy += 1;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') dx -= 1;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') dx += 1;
        if (dx !== 0 || dy !== 0) {
          inputRef.current.keyAngle = Math.atan2(dy, dx);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyB' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        inputRef.current.boost = false;
        externalBoostRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Minimap click handler ──
    const onCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      handleMinimapClick(e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener('click', onCanvasClick);

    // ── Init atlas + camera + manager (once per mount) ──
    const atlasManager = new SkinAtlasManager();
    atlasRef.current = atlasManager;
    for (const skin of DEFAULT_SKINS) {
      atlasManager.buildAtlas(skin);
    }
    const playerSkinAsset = getPlayerSkinAsset(player?.currentSkin || 'skin-default');
    if (playerSkinAsset) {
      if (!atlasManager.getAtlas(playerSkinAsset.id)) {
        atlasManager.buildAtlas(playerSkinAsset);
        registerSkinAsset(playerSkinAsset);
      }
    }

    const ac = getArenaConfig();
    const camera = createCamera(0, 0);
    cameraRef.current = camera;
    const manager = new RemoteSnakeManager(ac.mapHalf);
    managerRef.current = manager;
    resetMinimapZoom();

    // Load high score
    const highScoreKey = `venom-high-score-online-${arenaId || 'default'}`;
    try { highScoreRef.current = parseInt(localStorage.getItem(highScoreKey) || '0', 10); setDisplayHighScore(highScoreRef.current); } catch {}

    // ── Render loop ──
    const loop = () => {
      animRef.current = requestAnimationFrame(loop);

      const dpr = window.devicePixelRatio || 1;
      const w = _cachedW || parent.clientWidth;
      const h = _cachedH || parent.clientHeight;
      if (w === 0 || h === 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const snap = snapRef.current;
      const status = statusRef.current;
      const error = errorRef.current;

      // ── Track death ──
      if (snap && !playerAliveRef.current && !deathTimeRef.current) {
        deathTimeRef.current = performance.now();
        isDeadRef.current = true;
        setIsDead(true);
      }

      // ── Loading / error / disconnected screen ──
      if (!snap) {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (status === 'connecting') {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText('Connecting to server...', w / 2, h / 2 - 15);
          ctx.fillStyle = '#ffffff40';
          ctx.font = '14px sans-serif';
          ctx.fillText('Joining arena', w / 2, h / 2 + 15);
        } else if (status === 'error') {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText(error || 'Connection failed', w / 2, h / 2);
        } else if (status === 'disconnected') {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText('Disconnected', w / 2, h / 2);
        }
        return;
      }

      // ── Update snake manager ONLY when snapshot tick changes ──
      const didUpdate = manager.updateSnapshot(snap);

      // ── Update cached player state from snapshot ──
      if (snap) {
        playerScoreRef.current = snap.playerScore;
        playerKillsRef.current = snap.playerKills;
        playerAliveRef.current = true; // snapshots only sent while alive

        // Initialize or reset prediction on new snapshot
        if (didUpdate) {
          const playerSnakeId = manager.getPlayerSnakeId();
          if (playerSnakeId) {
            const ps = manager.buildSnakeAdapter(playerSnakeId);
            if (ps) {
              playerAngleRef.current = ps.angle;
              predictedRef.current = {
                x: ps.path.headX,
                y: ps.path.headY,
                angle: ps.angle,
                lastSnapTime: performance.now(),
                boosting: inputRef.current.boost,
              };
            }
          }
        }
      }

      // ── Update prediction state (for future client-side prediction) ──
      const now = performance.now();
      const pred = predictedRef.current;
      if (pred) {
        const elapsed = (now - pred.lastSnapTime) / 1000;
        const speed = pred.boosting ? 6 : BASE_SPEED;
        const moveDist = speed * elapsed;
        pred.x += Math.cos(pred.angle) * moveDist;
        pred.y += Math.sin(pred.angle) * moveDist;
      }

      // ── Compute target angle ──
      const mx = inputRef.current.mouseX;
      const my = inputRef.current.mouseY;
      let targetAngle: number;
      if (inputRef.current.keysActive) {
        targetAngle = inputRef.current.keyAngle;
      } else {
        targetAngle = Math.atan2(my - h / 2, mx - w / 2);
      }
      inputRef.current.angle = targetAngle;
      lastInputAngleRef.current = targetAngle;

      // ── Send input ──
      const isBoosting = inputRef.current.boost || externalBoostRef.current;
      sockRef.current?.sendInput(targetAngle, isBoosting);

      // ── Update prediction angle for next frame ──
      if (pred) {
        pred.angle = targetAngle;
        pred.boosting = isBoosting;
        pred.lastSnapTime = now;
      }

      // ── Update camera (use predicted position for smoothness) ──
      const alpha = manager.getPlayerAlpha();
      const playerSnakeId = manager.getPlayerSnakeId();
      const playerSnake = playerSnakeId
        ? manager.buildSnakeAdapter(playerSnakeId)
        : null;

      // Camera follows server-interpolated player position
      if (playerSnake) {
        updateCameraInterpolated(camera, playerSnake, w, h, alpha);
      }

      const viewport: Viewport = getViewport(camera, w, h);
      const camX = camera.x;
      const camY = camera.y;

      // ── Build synthetic GameState for shared renderers ──
      const gameState = manager.buildGameState(snap, ac);

      // ── Render ──
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

        const dx = headWx - camX;
        const dy = headWy - camY;
        const lodFar = dx * dx + dy * dy > 1500 * 1500 ? 1 : 0;

        try {
          renderSnakeFallback(ctx, snake, camera, viewport, now, undefined, undefined, true, 1, undefined, lodFar);
        } catch (e: any) { console.error('[Online] bot render:', id, e.message); }
      }

      // ── Player snake (with full skin/atlas rendering + prediction) ──
      if (gameState.player && gameState.player.alive && gameState.player.path.length >= 2) {
        const ps = gameState.player;
        if (playerSkinAsset) {
          ps.skinId = playerSkinAsset.id;
          ps.rarity = playerSkinAsset.rarity;
          ps.color = playerSkinAsset.bodyColor;
          ps.headColor = playerSkinAsset.headColor;
        }
        ps.boosting = isBoosting;

        const coiledPlayer = makeCoiledPath(ps.path);

        try {
          renderSnakeAtlas(ctx, ps, camera, viewport, atlasManager, now, mx, my, undefined, alpha, coiledPlayer);
        } catch (e: any) { console.error('[Online] player render:', e.message); }
      }

      // ── Killer highlight ──
      if (isDeadRef.current && killerNameRef.current) {
        const deathElapsed = now - (deathTimeRef.current || now);
        if (deathElapsed < 5000) {
          for (const [, s] of gameState.snakes) {
            if (!s.alive || s.name !== killerNameRef.current) continue;
            if (s.path.length < 2) continue;
            const cam = camera;
            const zoom = cam.zoom;
            const pulse = 0.4 + 0.6 * Math.abs(Math.sin(deathElapsed * 0.005));
            const glowR = (s.bodyRadius + 6) * zoom;
            const step = Math.max(1, Math.floor(8 / (s.bodyRadius * 2 + 1)));
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            for (let i = 0; i < s.path.length; i += step) {
              const wx = s.path.getX(i);
              const wy = s.path.getY(i);
              const sx = (wx - cam.x) * zoom + w / 2;
              const sy = (wy - cam.y) * zoom + h / 2;
              if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
            ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.shadowBlur = 15;
            for (let i = 0; i < s.path.length; i += step * 2) {
              const wx = s.path.getX(i);
              const wy = s.path.getY(i);
              const sx = (wx - cam.x) * zoom + w / 2;
              const sy = (wy - cam.y) * zoom + h / 2;
              ctx.beginPath();
              ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
              ctx.fill();
            }
            const headSx = (s.path.headX - cam.x) * zoom + w / 2;
            const headSy = (s.path.headY - cam.y) * zoom + h / 2;
            ctx.shadowBlur = 0;
            ctx.globalAlpha = Math.min(1, deathElapsed / 300);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(killerNameRef.current, headSx, headSy - glowR - 8);
            ctx.restore();
            break;
          }
        }
      }

      // ── HUD ──
      // Build a minimal gameState-like object for the HUD with player score/kills
      const hudState = {
        ...gameState,
        player: gameState.player ? {
          ...gameState.player,
          score: playerScoreRef.current,
        } : null,
      };
      renderHUD(ctx, hudState, camera, viewport, 60, now, playerKillsRef.current, highScoreRef.current);

      // ── Controls hint ──
      if (controlsTimerRef.current > 0) {
        const hintElapsed = now - controlsTimerRef.current;
        if (hintElapsed < 3000) {
          drawControlsHint(ctx, viewport);
        } else {
          controlsTimerRef.current = 0;
        }
      }

      // ── Connection quality indicator (top center) ──
      const isConnected = statusRef.current === 'connected';
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = isConnected ? '#22c55e' : '#ef4444';
      ctx.beginPath();
      ctx.arc(w / 2, 20, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── Mouse cursor ──
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
          drawDeathOverlay(ctx, snap.playerScore, viewport, killerNameRef.current);
        }
      }

      // ── Update leaderboard ──
      if (didUpdate) {
        leaderboardTimerRef.current++;
        if (leaderboardTimerRef.current >= 10) {
          leaderboardTimerRef.current = 0;
          updateLeaderboardRef.current(gameState.snakes, gameState.player);
          if (gameState.player) {
            try {
              const hs = Math.floor(gameState.player.score);
              if (hs > highScoreRef.current) {
                highScoreRef.current = hs;
                setDisplayHighScore(hs);
                localStorage.setItem(highScoreKey, String(hs));
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
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchstart', (e: Event) => {});
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, [arenaId, player?.currentSkin]);

  // ── Respawning ──
  const handleRespawn = useCallback(() => {
    if (arenaId) window.location.reload();
  }, [arenaId]);

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

      {/* Connection status badge */}
      <div className="absolute top-4 left-16 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm pointer-events-none select-none">
        {displayStatus === 'connected' ? (
          <Wifi className="w-3 h-3 text-green-400" />
        ) : (
          <WifiOff className="w-3 h-3 text-red-400" />
        )}
        <span className={`text-[10px] font-mono ${displayStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
          {displayStatus === 'connected' ? 'LIVE' : displayStatus.toUpperCase()}
        </span>
      </div>

      {/* Top Right: Best Ever + Leaderboard */}
      <div className="absolute top-4 right-4 w-44 pointer-events-none select-none flex flex-col gap-2">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1.5">
          <div className="text-[8px] text-amber-400/70 font-mono text-center">Best Ever</div>
          <div className="text-[9px] text-amber-400 font-bold font-mono text-center leading-tight">{displayHighScore.toLocaleString()} <span className="font-normal opacity-60">score</span></div>
        </div>
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
      </div>

      {/* Death overlay (React) */}
      {matchEnd && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-red-500">ELIMINATED</h2>
            {displayKiller && (
              <p className="text-white/60">Killed by <span className="text-white font-bold">{displayKiller}</span></p>
            )}
            <p className="text-white/80">Score: {Math.floor(matchEnd.score).toLocaleString()}</p>
            <p className="text-white/60">Kills: {matchEnd.kills}</p>
            <button
              onClick={handleRespawn}
              className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Return to Arena
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
