'use client';

import { useEffect, type RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { WORLD_SIZE } from '@/lib/game-config';
import { getCosmeticById } from '@/lib/game-config';
import type { GameSnapshot } from '@/lib/types';
import {
  drawChipLabel,
  drawExtractionRing,
  drawFood,
  drawFullMap,
  drawGrid,
  drawMapBoundary,
  drawMinimap,
  drawParticles,
  drawSnake,
  drawSnakeWithLayering,
  getArenaRadius,
  type FrameRenderCtx,
  type Particle,
} from './render-helpers';
import type { JoystickState } from './game-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PARTICLES = 200; // [FIXES C10] capped particle array
const FPS_LOW_THRESHOLD = 40;
const FPS_HIGH_THRESHOLD = 55;
const FPS_LOW_DURATION_MS = 2000;
const FPS_HIGH_DURATION_MS = 5000;
const PING_INTERVAL_MS = 2500;
const JOYSTICK_MAX_RADIUS_PX = 70;

// ---------------------------------------------------------------------------
// Hook parameters
// ---------------------------------------------------------------------------

export interface UseRenderLoopParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isOffline: boolean;
  isMountedRef: RefObject<boolean>;
  rafRef: RefObject<number | null>;
  resizeObserverRef: RefObject<ResizeObserver | null>;
  snapshotRef: RefObject<GameSnapshot | null>;
  mySnakeIdRef: RefObject<string | null>;
  camRef: RefObject<{ x: number; y: number; zoom: number }>;
  camInitRef: RefObject<boolean>;
  particlesRef: RefObject<Particle[]>;
  metallicCacheRef: RefObject<Map<string, CanvasGradient>>;
  lowQualityRef: RefObject<boolean>;
  fpsAccumRef: RefObject<{ frames: number; lastSecond: number; lowSince: number; highSince: number }>;
  socketRef: RefObject<Socket | null>;
  lastPingSentRef: RefObject<number>;
  pendingPingsRef: RefObject<Map<string, number>>;
  playerSkinRef: RefObject<string>;
  minimapVisibleRef: RefObject<boolean>;
  fullMapOpenRef: RefObject<boolean>;
  joystickRef: RefObject<JoystickState | null>;
  computeInputRef: RefObject<(() => { angle: number | null; boost: boolean }) | null>;
  maybeEmitInput: (now: number) => void;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  setLowQuality: React.Dispatch<React.SetStateAction<boolean>>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRenderLoop({
  canvasRef,
  isOffline,
  isMountedRef,
  rafRef,
  resizeObserverRef,
  snapshotRef,
  mySnakeIdRef,
  camRef,
  camInitRef,
  particlesRef,
  metallicCacheRef,
  lowQualityRef,
  fpsAccumRef,
  socketRef,
  lastPingSentRef,
  pendingPingsRef,
  playerSkinRef,
  minimapVisibleRef,
  fullMapOpenRef,
  joystickRef,
  computeInputRef,
  maybeEmitInput,
  setFps,
  setLowQuality,
}: UseRenderLoopParams) {
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
}
