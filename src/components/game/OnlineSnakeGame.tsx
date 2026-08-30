'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, CircleDot, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createGameSocket, type GameSnapshot, type ConnectionStatus } from '@/lib/game-socket';
import { RemoteSnakeManager } from '@/lib/remote-snake-manager';
import { createCamera, updateCameraInterpolated, getViewport } from '@/lib/snake/camera';
import { SkinAtlasManager, DEFAULT_SKINS } from '@/lib/snake/atlas';
import { getPlayerSkinAsset, registerSkinAsset } from '@/lib/snake/skin-registry';
import { getArenaConfig, SEGMENT_SPACING } from '@/lib/snake/config';
import { getArenaById } from '@/lib/game-config';
import type { Snake, Camera, Viewport } from '@/lib/snake/types';
import { renderSnakeAtlas, renderSnakeFallback, beginRenderFrameWithDpr } from './render-snake-atlas';
import { renderBackground, renderHUD, resetMinimapZoom, handleMinimapClick } from './hud';
import { drawDeathOverlay, drawEliminatedBanner, drawControlsHint } from './renderer';
import { makeCoiledPath } from './coil-path';
import { createExtractionState, updateExtractionProgress, drawExtractRing } from '@/lib/snake/extraction';
import { InputHandler } from './input';

// ─── Star Chip Renderer ─────────────────────────────────────────────────
// Draws a golden 5-pointed star that rotates and pulses.
// Size is based on the dead player's bodyRadius.
function drawStarChip(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  zoom: number,
  now: number,
  value: number,
  radius: number,
): void {
  if (value <= 0) return;
  // Star size based on body radius of dead player, clamped to min 8
  const size = Math.max(8, radius * zoom * 1.2);
  const pulse = 0.85 + 0.15 * Math.sin(now * 0.004);
  const rot = (now * 0.001) % (Math.PI * 2);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rot);
  ctx.scale(pulse, pulse);

  // Outer glow
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 18 * zoom;

  // Star shape
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  // Inner highlight
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size * 0.5 : size * 0.22;
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Value label below star (only if zoom is high enough)
  if (zoom >= 0.3) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.font = `bold ${Math.max(7, Math.floor(8 * zoom))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(formatChips(value) , sx, sy + size + 3);
  }
}

// ─── Chip Amount Formatter ───────────────────────────────────────────────
// 50 → "50c", 750000 → "750kc", 1500000 → "1.5Mc"
function formatChips(chips: number): string {
  if (chips >= 1_000_000) {
    const m = chips / 1_000_000;
    return (m === Math.floor(m) ? m : m.toFixed(1)) + 'Mc';
  }
  if (chips >= 1_000) {
    const k = chips / 1_000;
    return (k === Math.floor(k) ? k : k.toFixed(1)) + 'kc';
  }
  return chips + 'c';
}

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
  const { player: authPlayer } = useAuth();

  // ── Stabilized auth refs ──
  const authSkinRef = useRef(authPlayer?.currentSkin ?? 'skin-default');
  const authNameRef = useRef(authPlayer?.name || 'Player');
  useEffect(() => {
    if (authPlayer?.currentSkin) authSkinRef.current = authPlayer.currentSkin;
    if (authPlayer?.name) authNameRef.current = authPlayer.name;
  });

  // ── Canvas + rendering refs ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<InputHandler | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1.0 });
  const animRef = useRef(0);
  const atlasRef = useRef<SkinAtlasManager | null>(null);
  const externalBoostRef = useRef(false);
  const fpsRef = useRef({ frames: 0, lastTime: 0, fps: 60 });

  // ── Socket + server state (all refs for render loop) ──
  const sockRef = useRef<ReturnType<typeof createGameSocket> | null>(null);
  const snapRef = useRef<GameSnapshot | null>(null);
  const statusRef = useRef<ConnectionStatus>('disconnected');
  const errorRef = useRef<string | null>(null);
  const managerRef = useRef<RemoteSnakeManager | null>(null);
  const serverMapHalfRef = useRef<number | null>(null);

  // ── Game state refs ──
  const isDeadRef = useRef(false);
  const deathTimeRef = useRef<number>(0);
  const killerNameRef = useRef<string | null>(null);
  const highScoreRef = useRef(0);
  const playerScoreRef = useRef(0);
  const playerKillsRef = useRef(0);
  const showControlsRef = useRef(true);
  const controlsDismissedRef = useRef(false);
  const leaderboardTimerRef = useRef(0);
  const extractionRef = useRef(createExtractionState());

  // ── React state (ONLY for JSX) ──
  const [displayStatus, setDisplayStatus] = useState<ConnectionStatus>('disconnected');
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LBEntry[]>([]);
  const [displayHighScore, setDisplayHighScore] = useState(0);
  const [isDead, setIsDead] = useState(false);

  // ── Stable leaderboard callback ──
  const updateLeaderboardRef = useRef((snakes: Map<string, Snake>, player: Snake | null) => {
    const entries: LBEntry[] = [];
    for (const [, s] of snakes) {
      if (!s.alive) continue;
      entries.push({ name: s.name, score: Math.floor(s.score), isPlayer: !!s.isPlayer });
    }
    entries.sort((a, b) => b.score - a.score);
    setLeaderboard(entries.slice(0, 10));
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
        if (state.serverMapHalf) {
          serverMapHalfRef.current = state.serverMapHalf;
          const mh = state.serverMapHalf;
          if (managerRef.current && managerRef.current.getMapHalf() !== mh) {
            managerRef.current = new RemoteSnakeManager(mh);
          }
        }
        if (state.killerName && !killerNameRef.current) {
          killerNameRef.current = state.killerName;
        }
        // Death detection
        if (state.matchEnd && !isDeadRef.current) {
          isDeadRef.current = true;
          deathTimeRef.current = performance.now();
          setIsDead(true);
        }
        if (state.status === 'disconnected' || state.status === 'error') {
          if (!isDeadRef.current) {
            isDeadRef.current = true;
            deathTimeRef.current = performance.now();
            setIsDead(true);
          }
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

  // ── Respawn handler (online: reload the page) ──
  const handleRespawn = useCallback(() => {
    if (arenaId) window.location.reload();
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
      if (inputRef.current) inputRef.current.updateRect();
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Input handler (same as offline) ──
    const input = new InputHandler(canvas);
    inputRef.current = input;
    input.attach();

    // ── Build atlas manager ──
    const atlasManager = new SkinAtlasManager();
    atlasRef.current = atlasManager;
    for (const skin of DEFAULT_SKINS) {
      atlasManager.buildAtlas(skin);
    }
    const playerSkinAsset = getPlayerSkinAsset(authSkinRef.current);
    if (!atlasManager.getAtlas(playerSkinAsset.id)) {
      atlasManager.buildAtlas(playerSkinAsset);
      registerSkinAsset(playerSkinAsset);
    }

    // ── Init camera + remote snake manager ──
    const ac = getArenaConfig();
    const camera = createCamera(0, 0);
    cameraRef.current = camera;
    if (!managerRef.current) {
      const mapHalf = serverMapHalfRef.current ?? ac.mapHalf;
      managerRef.current = new RemoteSnakeManager(mapHalf);
    }
    resetMinimapZoom();

    // ── High score ──
    const highScoreKey = `venom-high-score-online-${arenaId || 'default'}`;
    try { highScoreRef.current = parseInt(localStorage.getItem(highScoreKey) || '0', 10); setDisplayHighScore(highScoreRef.current); } catch {}

    // ── Minimap click handler ──
    const onCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      handleMinimapClick(e.clientX - rect.left, e.clientY - rect.top);
      // Death overlay: click to respawn (after 5s)
      if (isDeadRef.current && performance.now() - deathTimeRef.current >= 5000) {
        handleRespawn();
      }
    };
    canvas.addEventListener('click', onCanvasClick);

    // ── Death overlay: Space/Enter to respawn (after 5s) ──
    const onRespawnKey = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && isDeadRef.current && performance.now() - deathTimeRef.current >= 5000) {
        e.preventDefault();
        handleRespawn();
      }
    };
    window.addEventListener('keydown', onRespawnKey);

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
      const now = performance.now();
      const inputState = input.getState();

      // ── External boost from UI button ──
      input.externalBoost = externalBoostRef.current;

      // ══════════════════════════════════════════════════════════════════
      // LOADING / ERROR / DISCONNECTED SCREENS
      // ══════════════════════════════════════════════════════════════════
      if (!snap) {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (status === 'connecting') {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText('Connecting to server...', w / 2, h / 2 - 20);
          ctx.fillStyle = '#ffffff40';
          ctx.font = '14px sans-serif';
          ctx.fillText('Joining arena', w / 2, h / 2 + 15);
          // Spinning loader
          ctx.save();
          ctx.translate(w / 2, h / 2 + 50);
          ctx.rotate((now / 800) % (Math.PI * 2));
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 1.5);
          ctx.stroke();
          ctx.restore();
        } else if (status === 'error') {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText(error || 'Connection failed', w / 2, h / 2);
          ctx.fillStyle = '#ffffff40';
          ctx.font = '13px sans-serif';
          ctx.fillText('Check your connection and try again', w / 2, h / 2 + 30);
        } else if (status === 'disconnected') {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText('Disconnected', w / 2, h / 2);
          ctx.fillStyle = '#ffffff40';
          ctx.font = '13px sans-serif';
          ctx.fillText('You will be returned to the arena', w / 2, h / 2 + 30);
        }
        return;
      }

      // ══════════════════════════════════════════════════════════════════
      // UPDATE REMOTE SNAKE MANAGER
      // ══════════════════════════════════════════════════════════════════
      const mgr = managerRef.current;
      if (!mgr) return;
      const didUpdate = mgr.updateSnapshot(snap);

      // ── Update cached player state from snapshot ──
      playerScoreRef.current = snap.playerScore;
      playerKillsRef.current = snap.playerKills;

      // Dismiss controls on first input
      if (!controlsDismissedRef.current &&
          (inputState.boosting || Math.abs(inputState.targetAngle) > 0.01)) {
        controlsDismissedRef.current = true;
        setTimeout(() => { showControlsRef.current = false; }, 3000);
      }

      // ── Send input to server ──
      const isBoosting = inputState.boosting;
      sockRef.current?.sendInput(inputState.targetAngle, isBoosting);

      // ── Extraction progress (client-side, same as offline) ──
      const frameElapsed = 16; // Approximate frame time
      updateExtractionProgress(
        extractionRef.current, input.isExtracting(), isDeadRef.current,
        inputState.targetAngle, frameElapsed, onExit,
      );

      // ── Build synthetic GameState for shared renderers ──
      const gameState = mgr.buildGameState(snap, ac);



      // ── Camera: follow player (same interpolation as offline) ──
      const playerSnake = gameState.player;
      if (playerSnake && playerSnake.alive) {
        // Use the server-based alpha (time since last snapshot)
        const alpha = mgr.getPlayerAlpha();
        // Set prevHeadX/Y for camera interpolation (same as offline pattern)
        if (Number.isFinite(playerSnake.path.headX) && Number.isFinite(playerSnake.path.headY)) {
          playerSnake.prevHeadX = Number.isFinite(playerSnake.prevHeadX)
            ? playerSnake.prevHeadX : playerSnake.path.headX;
          playerSnake.prevHeadY = Number.isFinite(playerSnake.prevHeadY)
            ? playerSnake.prevHeadY : playerSnake.path.headY;
          updateCameraInterpolated(camera, playerSnake, w, h, alpha);
        }
      }

      // Final NaN guard on camera
      if (!Number.isFinite(camera.x)) camera.x = 0;
      if (!Number.isFinite(camera.y)) camera.y = 0;

      const viewport: Viewport = getViewport(camera, w, h);

      // ══════════════════════════════════════════════════════════════════
      // RENDER (same pipeline as offline)
      // ══════════════════════════════════════════════════════════════════

      // FPS counter
      const fc = fpsRef.current;
      fc.frames++;
      if (now - fc.lastTime >= 1000) { fc.fps = fc.frames; fc.frames = 0; fc.lastTime = now; }

      beginRenderFrameWithDpr(dpr);
      renderBackground(ctx, gameState, camera, viewport, fc.fps, now);

      // ── Render star chips (golden stars from dead players) ──
      if (snap.stars?.length) {
        const zoom = camera.zoom;
        for (const star of snap.stars) {
          if (star.value <= 0) continue;
          const sx = (star.x - camera.x) * zoom + w / 2;
          const sy = (star.y - camera.y) * zoom + h / 2;
          // Cull off-screen
          if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;
          drawStarChip(ctx, sx, sy, zoom, now, star.value, star.radius || 6);
        }
      }

      // ── Render snakes: bots use fallback, player uses atlas (same as offline) ──
      // Also renders carried chips label above real players' heads.
      const baseMargin = 500;
      const camX = camera.x;
      const camY = camera.y;
      const zoom = camera.zoom;
      for (const [id, snake] of gameState.snakes) {
        if (!snake.alive) continue;
        if (snake.path.length < 2) continue;
        const headWx = snake.path.headX;
        const headWy = snake.path.headY;
        if (!Number.isFinite(headWx) || !Number.isFinite(headWy)) continue;
        const margin = snake.cachedBodyLength * SEGMENT_SPACING + baseMargin;
        if (headWx < viewport.left - margin || headWx > viewport.right + margin ||
            headWy < viewport.top - margin || headWy > viewport.bottom + margin) continue;
        if (snake.isPlayer) {
          // Player: atlas renderer with skin
          if (playerSkinAsset) {
            (snake as any).skinId = playerSkinAsset.id;
            (snake as any).rarity = playerSkinAsset.rarity;
            (snake as any).color = playerSkinAsset.bodyColor;
            (snake as any).headColor = playerSkinAsset.headColor;
          }
          (snake as any).boosting = isBoosting;
          const coiledPlayer = makeCoiledPath(snake.path);
          const mousePos = input.getMousePos();
          const alpha = mgr.getPlayerAlpha();
          try {
            renderSnakeAtlas(ctx, snake, camera, viewport, atlasManager, now, mousePos?.x, mousePos?.y, undefined, alpha, coiledPlayer);
          } catch (e: any) { console.error('[Online] player render:', e.message); }
        } else {
          // Bot: fallback renderer
          const dx = headWx - camX;
          const dy = headWy - camY;
          const lodFar = dx * dx + dy * dy > 1500 * 1500 ? 1 : 0;
          try {
            renderSnakeFallback(ctx, snake, camera, viewport, now, undefined, undefined, true, 1, undefined, lodFar);
          } catch (e: any) { console.error('[Online] bot render:', id, e.message); }
        }

        // ── Carried chips label above player head (real players only) ──
        const cc = (snake as any).carriedChips as number | undefined;
        if (cc && cc > 0 && !snake.isBot) {
          const headSx = (headWx - camX) * zoom + w / 2;
          const headSy = (headWy - camY) * zoom + h / 2;
          const fontSize = Math.max(9, Math.min(13, Math.floor(11 * zoom)));
          const label = formatChips(cc);
          ctx.save();
          ctx.font = `bold ${fontSize}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          // Dark background pill
          const tw = ctx.measureText(label).width;
          const px = 4;
          const py = 2;
          const pillY = headSy - snake.bodyRadius * zoom - 12;
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.beginPath();
          const pillR = 4;
          const pillL = headSx - tw / 2 - px;
          const pillT = pillY - fontSize - py;
          const pillW = tw + px * 2;
          const pillH = fontSize + py * 2;
          ctx.roundRect(pillL, pillT, pillW, pillH, pillR);
          ctx.fill();
          // Gold text
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(label, headSx, pillY);
          ctx.restore();
        }
      }

      // ── Extraction progress ring (same as offline) ──
      if (extractionRef.current.active && extractionRef.current.progress > 0 && gameState.player && gameState.player.alive) {
        drawExtractRing(ctx, gameState.player, camera, viewport, extractionRef.current.progress);
      }

      // ── HUD (same as offline) ──
      const hudState = {
        ...gameState,
        player: gameState.player ? { ...gameState.player, score: playerScoreRef.current } : null,
      };
      const buyIn = arenaId ? (getArenaById(arenaId)?.buyIn) : undefined;
      renderHUD(ctx, hudState, camera, viewport, fc.fps, now, playerKillsRef.current, highScoreRef.current, snap.minimapDots, buyIn, snap.playerCarriedChips);

      // ── Controls hint (same as offline) ──
      if (showControlsRef.current && gameState.player && gameState.player.alive) {
        drawControlsHint(ctx, viewport);
      }

      // ── Killer highlight: pulsing red glow (same as offline) ──
      if (isDeadRef.current && killerNameRef.current) {
        const deathElapsed = now - deathTimeRef.current;
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
            ctx.fillText(killerNameRef.current!, headSx, headSy - glowR - 8);
            ctx.restore();
            break;
          }
        }
      }

      // ── Death overlay (canvas-based, same as offline) ──
      if (isDeadRef.current) {
        const deathElapsed = now - deathTimeRef.current;
        if (deathElapsed < 5000) {
          drawEliminatedBanner(ctx, viewport, deathElapsed);
        } else {
          drawDeathOverlay(ctx, playerScoreRef.current, viewport);
        }
      }

      // ── Update leaderboard every ~0.5s ──
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
      input.detach();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('click', onCanvasClick);
      window.removeEventListener('keydown', onRespawnKey);
    };
  }, [arenaId, onExit, handleRespawn]);

  // ── Render (JSX) — NO stale death overlay, only UI controls ──
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

      {/* Connection status badge (online-only) */}
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

      {/* Right: Best Ever + Leaderboard */}
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

      {/* Bottom Left: Boost + Extract Buttons */}
      <div className="absolute bottom-6 left-5 z-10 flex flex-col gap-3 pointer-events-none">
        <button
          onPointerDown={(e) => { e.stopPropagation(); externalBoostRef.current = true; if (inputRef.current) inputRef.current.externalBoost = true; }}
          onPointerUp={(e) => { e.stopPropagation(); externalBoostRef.current = false; if (inputRef.current) inputRef.current.externalBoost = false; }}
          onPointerLeave={() => { externalBoostRef.current = false; if (inputRef.current) inputRef.current.externalBoost = false; }}
          onPointerCancel={() => { externalBoostRef.current = false; if (inputRef.current) inputRef.current.externalBoost = false; }}
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
