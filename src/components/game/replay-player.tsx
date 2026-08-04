'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import type { GameSnapshot } from '@/lib/types';
import {
  drawFoodOrb,
  drawMapBoundary,
  drawSnake,
  drawStarCollectible,
  type FrameRenderCtx,
} from './render-helpers';

// ---------------------------------------------------------------------------
// ReplayPlayer sub-component — renders 15s pre-death + 15s post-death replay
// ---------------------------------------------------------------------------

interface ReplayPlayerProps {
  frames: GameSnapshot[];
  myId: string;
  deathFrameIdx?: number; // index where death occurs in frames
  onClose: () => void;
}

const REPLAY_SPEEDS = [0.25, 0.5, 1, 2] as const;

function ReplayPlayer({ frames, myId, deathFrameIdx, onClose }: ReplayPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameIdxRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const zoomRef = useRef(0.8);
  const lastTimeRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(0.8);
  const [frameIdx, setFrameIdx] = useState(0);
  const totalFrames = frames.length;

  // Spectator camera state (refs for use inside rAF)
  const deathCamPosRef = useRef<{ x: number; y: number } | null>(null);
  const spectatorFollowIdRef = useRef<string | null>(null);
  const prevFoodsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const deathFoodCollected = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalFrames === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Reset spectator state on mount
    deathCamPosRef.current = null;
    spectatorFollowIdRef.current = null;
    prevFoodsRef.current = new Map();
    deathFoodCollected.current = false;

    const render = (now: number) => {
      if (!playingRef.current) {
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      const dt = now - lastTimeRef.current;
      const frameInterval = 50 / speedRef.current; // 50ms per frame at 1x
      if (dt >= frameInterval) {
        frameIdxRef.current = (frameIdxRef.current + 1) % totalFrames;
        lastTimeRef.current = now;
        setFrameIdx(frameIdxRef.current);
      }

      const snap = frames[frameIdxRef.current];
      if (!snap) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      // Clear
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // --- Spectator Camera Logic ---
      const isAfterDeath = deathFrameIdx != null && frameIdxRef.current >= deathFrameIdx;
      let camX: number;
      let camY: number;
      const z = zoomRef.current;

      if (!isAfterDeath) {
        // Before death: follow player
        const me = snap.snakes.find((s) => s.id === myId);
        camX = me?.points?.[0]?.x ?? snap.mapCenterX ?? 4000;
        camY = me?.points?.[0]?.y ?? snap.mapCenterY ?? 4000;
      } else {
        // At/after death frame
        if (!deathCamPosRef.current) {
          // Record death position: center of body (where food drops), not head
          const deathFrame = frames[Math.min(deathFrameIdx!, frames.length - 1)];
          const me = deathFrame?.snakes.find((s) => s.id === myId);
          if (me?.points && me.points.length > 0) {
            // Center camera on midpoint of body so food spread is visible
            const midIdx = Math.floor(me.points.length / 2);
            const midPt = me.points[Math.min(midIdx, me.points.length - 1)];
            deathCamPosRef.current = {
              x: midPt.x,
              y: midPt.y,
            };
          } else {
            deathCamPosRef.current = {
              x: snap.mapCenterX ?? 4000,
              y: snap.mapCenterY ?? 4000,
            };
          }
          // Snapshot current food IDs near death for tracking
          const curFoods = new Map<string, { x: number; y: number }>();
          for (const f of deathFrame?.foods ?? []) {
            curFoods.set(f.id, { x: f.x, y: f.y });
          }
          prevFoodsRef.current = curFoods;
        }

        if (!deathFoodCollected.current && spectatorFollowIdRef.current === null) {
          // Check if any food near death position was collected
          const deathPos = deathCamPosRef.current;
          const curFoodIds = new Set<string>();
          const collectedNearDeath: Array<{ x: number; y: number }> = [];

          for (const f of snap.foods) {
            curFoodIds.add(f.id);
          }

          // Find foods from previous frame that are now gone
          for (const [foodId, fPos] of prevFoodsRef.current) {
            if (!curFoodIds.has(foodId)) {
              const dx = fPos.x - deathPos.x;
              const dy = fPos.y - deathPos.y;
              if (Math.sqrt(dx * dx + dy * dy) < 300) {
                collectedNearDeath.push(fPos);
              }
            }
          }

          if (collectedNearDeath.length > 0) {
            deathFoodCollected.current = true;
            // Find closest snake to the first collected food position
            const targetPos = collectedNearDeath[0];
            let closestSnake: { id: string; dist: number } | null = null;
            for (const s of snap.snakes) {
              if (!s.points || s.points.length === 0) continue;
              const head = s.points[0];
              const dx = head.x - targetPos.x;
              const dy = head.y - targetPos.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (!closestSnake || d < closestSnake.dist) {
                closestSnake = { id: s.id, dist: d };
              }
            }
            if (closestSnake) {
              spectatorFollowIdRef.current = closestSnake.id;
            }
          }

          // Update prev foods for next frame comparison
          const newFoods = new Map<string, { x: number; y: number }>();
          for (const f of snap.foods) {
            newFoods.set(f.id, { x: f.x, y: f.y });
          }
          prevFoodsRef.current = newFoods;
        }

        if (spectatorFollowIdRef.current) {
          // Follow the entity that collected death food
          const target = snap.snakes.find((s) => s.id === spectatorFollowIdRef.current);
          if (target?.points?.[0]) {
            camX = target.points[0].x;
            camY = target.points[0].y;
          } else {
            camX = deathCamPosRef.current.x;
            camY = deathCamPosRef.current.y;
          }
        } else {
          // No one collected food near death — stay at death position
          camX = deathCamPosRef.current.x;
          camY = deathCamPosRef.current.y;
          // Slow zoom out
          zoomRef.current = Math.max(0.3, zoomRef.current - 0.0003);
        }
      }

      // World transform
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(w / 2, h / 2);
      ctx.scale(z, z);
      ctx.translate(-camX, -camY);

      // Draw grid (minimal)
      const gridSize = 80;
      const viewL = camX - w / 2 / z - gridSize;
      const viewR = camX + w / 2 / z + gridSize;
      const viewT = camY - h / 2 / z - gridSize;
      const viewB = camY + h / 2 / z + gridSize;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const sX = Math.floor(viewL / gridSize) * gridSize;
      const eX = Math.ceil(viewR / gridSize) * gridSize;
      const sY = Math.floor(viewT / gridSize) * gridSize;
      const eY = Math.ceil(viewB / gridSize) * gridSize;
      for (let x = sX; x <= eX; x += gridSize) { ctx.moveTo(x, viewT); ctx.lineTo(x, viewB); }
      for (let y = sY; y <= eY; y += gridSize) { ctx.moveTo(viewL, y); ctx.lineTo(viewR, y); }
      ctx.stroke();

      // Draw food
      for (const f of snap.foods) {
        if (f.x < viewL || f.x > viewR || f.y < viewT || f.y > viewB) continue;
        if (f.isStarChip) {
          drawStarCollectible(ctx, f.x, f.y, Math.max(6, f.size + 4), now, false);
        } else {
          drawFoodOrb(ctx, f.x, f.y, f.size, f.value, f.color, f.glowColor ?? '', now, true);
        }
      }

      // Draw snakes
      for (const s of snap.snakes) {
        if (!s.points || s.points.length === 0) continue;
        const head = s.points[0];
        if (head.x < viewL - 100 || head.x > viewR + 100 || head.y < viewT - 100 || head.y > viewB + 100) continue;

        const rc: FrameRenderCtx = {
          ctx, w, h, camX, camY, zoom: z,
          worldSize: snap.worldSize, lowQuality: true,
          myId, now, metallicCache: new Map(), playerSkin: undefined, dpr,
        };
        drawSnake(rc, s);
      }

      // Draw map boundary
      if (snap.mapRadius && snap.mapRadius > 0) {
        drawMapBoundary(ctx, snap.mapCenterX ?? 4000, snap.mapCenterY ?? 4000, snap.mapRadius, now);
      }

      // Draw replay watermark
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('⏺ REPLAY', 10, 10);
      const isPostDeathFrame = deathFrameIdx != null && frameIdxRef.current >= deathFrameIdx;
      const preSec2 = deathFrameIdx != null ? Math.min(15, Math.floor(frameIdxRef.current / 20)) : Math.floor(frameIdxRef.current / 20);
      const postSec2 = deathFrameIdx != null && frameIdxRef.current > deathFrameIdx ? Math.min(15, Math.floor((frameIdxRef.current - deathFrameIdx) / 20)) : 0;
      const timeStr = isPostDeathFrame
        ? `⛔ DEATH +${postSec2}s | Frame ${frameIdxRef.current + 1}/${totalFrames}`
        : `Frame ${frameIdxRef.current + 1}/${totalFrames} | -${Math.max(0, 15 - preSec2)}s to death`;
      ctx.fillStyle = isPostDeathFrame ? 'rgba(244, 63, 94, 0.9)' : 'rgba(226, 232, 240, 0.6)';
      ctx.font = '10px monospace';
      ctx.fillText(timeStr, 10, 26);

      rafRef.current = requestAnimationFrame(render);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [frames, myId, totalFrames, deathFrameIdx]);

  const togglePlay = () => {
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  };

  const cycleSpeed = () => {
    const curIdx = REPLAY_SPEEDS.indexOf(speed as 0.25 | 0.5 | 1 | 2);
    const nextIdx = (curIdx + 1) % REPLAY_SPEEDS.length;
    const newSpeed = REPLAY_SPEEDS[nextIdx];
    speedRef.current = newSpeed;
    setSpeed(newSpeed);
  };

  const adjustZoom = (delta: number) => {
    zoomRef.current = Math.max(0.3, Math.min(2, zoomRef.current + delta));
    setZoom(zoomRef.current);
  };

  const restart = () => {
    frameIdxRef.current = 0;
    playingRef.current = true;
    setPlaying(true);
    setFrameIdx(0);
  };

  if (totalFrames === 0) return null;

  const progress = totalFrames > 0 ? (frameIdx / (totalFrames - 1)) * 100 : 0;
  const deathProgress = deathFrameIdx != null && totalFrames > 0 ? (deathFrameIdx / (totalFrames - 1)) * 100 : -1;

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
      {/* Replay canvas */}
      <canvas
        ref={canvasRef}
        className="w-full aspect-video cursor-crosshair"
        style={{ display: 'block' }}
      />

      {/* Progress bar with death marker */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
        <div className="h-full bg-rose-500 transition-all duration-75" style={{ width: `${progress}%` }} />
        {deathProgress >= 0 && (
          <div className="absolute top-0 h-full w-0.5 bg-yellow-400" style={{ left: `${deathProgress}%` }} title="💀 Death" />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={restart}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
          title="Restart"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={cycleSpeed}
          className="flex h-8 items-center justify-center rounded-md bg-slate-900/80 px-2.5 text-white text-xs font-mono font-bold hover:bg-slate-800 transition-colors"
        >
          {speed}x
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustZoom(-0.15)}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 font-mono w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => adjustZoom(0.15)}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReplayPlayer;
