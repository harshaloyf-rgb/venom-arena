'use client';

/**
 * Venom Arena — Online Replay Player.
 *
 * A canvas-based replay viewer for online arena death recordings.
 * Unlike the offline replay system, this player:
 *  - Records lightweight frames from game snapshots during play
 *  - Stores death frame index + post-death frames for "death cam"
 *  - Renders with full render-helpers (food, snakes, minimap, boundary)
 *  - Supports play/pause, scrub, speed controls
 *  - Auto-focuses camera on the dead player with smooth following
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SnakeSnapshot, FoodSnapshot, GameSnapshot } from '@/lib/types';
import {
  drawFood,
  drawMinimap,
  drawSnake,
  drawGrid,
  drawParticles,
} from '@/components/game/render-helpers';
import type { FrameRenderCtx } from '@/components/game/render-helpers';

// ── Types ──

export interface ReplayFrame {
  snakes: SnakeSnapshot[];
  foods: FoodSnapshot[];
  worldSize: number;
  mapRadius: number;
  mapCenterX: number;
  mapCenterY: number;
}

export interface OnlineReplayData {
  frames: ReplayFrame[];
  deathFrameIdx: number;
  myId: string;
  worldSize: number;
  mapRadius: number;
  mapCenterX: number;
  mapCenterY: number;
}

interface OnlineReplayPlayerProps {
  replay: OnlineReplayData;
  onClose: () => void;
}

type PlaybackSpeed = 0.25 | 0.5 | 1 | 2;

export function OnlineReplayPlayer({ replay, onClose }: OnlineReplayPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [zoom, setZoom] = useState(1);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const frameAccumRef = useRef(0);
  const lastTimeRef = useRef(0);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }>>([]);

  const totalFrames = replay.frames.length;
  const fps = 20; // Replay is recorded at 20Hz (broadcast rate)

  // Auto-hide controls after 3s of inactivity
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Advance frames based on speed
      if (playing) {
        frameAccumRef.current += dt * speed;
        const frameTime = 1000 / fps;
        while (frameAccumRef.current >= frameTime) {
          frameAccumRef.current -= frameTime;
          const next = Math.min(currentFrame + 1, totalFrames - 1);
          setCurrentFrame(next);
          if (next >= totalFrames - 1) setPlaying(false);
        }
      }

      // Render
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;

      const frame = replay.frames[currentFrame];
      if (!frame) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      // Find my snake for camera tracking
      const mySnake = frame.snakes.find(s => s.id === replay.myId);
      const camX = mySnake?.points?.[0]?.x ?? replay.worldSize / 2;
      const camY = mySnake?.points?.[0]?.y ?? replay.worldSize / 2;
      const zoomVal = zoom;

      // Clear
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, cssW, cssH);

      // World-space transform
      ctx.setTransform(dpr, 0, 0, dpr, cssW / 2, cssH / 2);
      ctx.scale(zoomVal, zoomVal);
      ctx.translate(-camX, -camY);

      const rc: FrameRenderCtx = {
        ctx,
        w: cssW,
        h: cssH,
        camX,
        camY,
        zoom,
        worldSize: frame.worldSize,
        myId: replay.myId,
        playerSkin: undefined,
        now: timestamp,
        lowQuality: false,
      };

      // Draw grid/boundary
      drawGrid(rc, frame.mapRadius, replay.mapCenterX, replay.mapCenterY, timestamp);

      // Draw food
      drawFood(rc, frame.foods);

      // Draw snakes (my snake last for top-layer rendering)
      for (const s of frame.snakes) {
        if (s.id !== replay.myId) drawSnake(rc, s);
      }
      if (mySnake) drawSnake(rc, mySnake);

      // Draw death flash at death frame
      if (currentFrame >= replay.deathFrameIdx && currentFrame < replay.deathFrameIdx + 20) {
        const alpha = 1 - (currentFrame - replay.deathFrameIdx) / 20;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.3})`;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      // Reset transform for HUD
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw minimap
      drawMinimap({
        ctx,
        x: cssW - 108,
        y: cssH - 108,
        size: 96,
        worldSize: frame.worldSize,
        arenaRadius: frame.mapRadius,
        snakes: frame.snakes,
        myId: replay.myId,
        range: 1800,
      });

      // Frame counter
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Frame ${currentFrame + 1}/${totalFrames}  |  ${(currentFrame / fps).toFixed(1)}s`, 12, cssH - 12);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [currentFrame, playing, speed, zoom, replay, totalFrames, fps]);

  // Scrub on click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const frame = Math.floor(ratio * totalFrames);
    setCurrentFrame(Math.max(0, Math.min(frame, totalFrames - 1)));
    frameAccumRef.current = 0;
    resetControlsTimer();
  };

  const togglePlay = () => {
    if (currentFrame >= totalFrames - 1) {
      setCurrentFrame(0);
      setPlaying(true);
    } else {
      setPlaying(p => !p);
    }
    resetControlsTimer();
  };

  const cycleSpeed = () => {
    const speeds: PlaybackSpeed[] = [0.25, 0.5, 1, 2];
    const idx = speeds.indexOf(speed);
    setSpeed(speeds[(idx + 1) % speeds.length]);
    resetControlsTimer();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 cursor-crosshair"
        onClick={handleCanvasClick}
      />

      {/* Death replay label */}
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
        <div className="rounded-lg border border-red-500/30 bg-red-950/80 px-4 py-2 text-center backdrop-blur-sm">
          <p className="text-sm font-bold text-red-400">DEATH REPLAY</p>
          <p className="text-[10px] text-red-300/70">Click anywhere on the timeline to scrub</p>
        </div>
      </div>

      {/* Controls overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress bar with death marker */}
        <div className="relative mb-3 h-1.5 cursor-pointer rounded-full bg-slate-800" onClick={handleCanvasClick}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-500 transition-[width] duration-75"
            style={{ width: `${((currentFrame + 1) / totalFrames) * 100}%` }}
          />
          {/* Death marker — yellow vertical line */}
          {replay.deathFrameIdx > 0 && replay.deathFrameIdx < totalFrames && (
            <div
              className="absolute top-0 h-full w-0.5 bg-yellow-400"
              style={{ left: `${(replay.deathFrameIdx / (totalFrames - 1)) * 100}%` }}
            />
          )}
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCurrentFrame(0); frameAccumRef.current = 0; }}
            className="rounded-full bg-slate-800/80 p-2 text-white transition hover:bg-slate-700"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            {playing ? (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCurrentFrame(totalFrames - 1); setPlaying(false); }}
            className="rounded-full bg-slate-800/80 p-2 text-white transition hover:bg-slate-700"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cycleSpeed(); }}
            className="rounded-lg bg-slate-800/80 px-3 py-1.5 font-mono text-xs text-white transition hover:bg-slate-700"
          >
            {speed}x
          </button>

          {/* Zoom controls */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.25)); resetControlsTimer(); }}
            className="rounded-lg bg-slate-800/80 px-2 py-1.5 font-mono text-xs text-white transition hover:bg-slate-700"
          >
            ZOOM +
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.25, z - 0.25)); resetControlsTimer(); }}
            className="rounded-lg bg-slate-800/80 px-2 py-1.5 font-mono text-xs text-white transition hover:bg-slate-700"
          >
            ZOOM −
          </button>

          {/* Restart */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCurrentFrame(0); setPlaying(true); frameAccumRef.current = 0; setZoom(1); resetControlsTimer(); }}
            className="rounded-lg bg-slate-800/80 px-3 py-1.5 font-mono text-xs text-white transition hover:bg-slate-700"
          >
            ↻ RESTART
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="ml-4 rounded-lg bg-slate-800/80 px-4 py-1.5 font-mono text-xs text-white transition hover:bg-slate-700"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
