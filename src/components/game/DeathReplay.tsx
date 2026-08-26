'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReplayFrame } from '@/lib/snake/replay';
import { renderReplayFrame, findCloseCollisions } from '@/lib/snake/replay';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, ZoomIn, ZoomOut, X, AlertTriangle } from 'lucide-react';

interface DeathReplayProps {
  getFrame: (index: number) => ReplayFrame | null;
  totalFrames: number;
  deathFrameIdx: number;
  frameToRelSeconds: (frameIdx: number) => number;
  onExit: () => void;
}

const SPEEDS = [
  { label: '1×', value: 1 },
  { label: '0.25×', value: 0.25 },
  { label: '0.1×', value: 0.1 },
  { label: '0.05×', value: 0.05 },
];

export default function DeathReplay({ getFrame, totalFrames, deathFrameIdx, frameToRelSeconds, onExit }: DeathReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef({ x: 0, y: 0, zoom: 1.5 });
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const accumRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(0);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, camX: 0, camY: 0 });

  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  // Center camera on player at death frame on mount
  useEffect(() => {
    const deathFrame = getFrame(deathFrameIdx);
    if (deathFrame) {
      const player = deathFrame.snakes.find(s => s.isPlayer);
      if (player && player.pathLen > 0) {
        camRef.current = { x: player.pathX[0], y: player.pathY[0], zoom: 1.5 };
      }
    }
    frameRef.current = Math.max(0, deathFrameIdx - 120); // start 2s before death
    setFrame(frameRef.current);
  }, []);

  const updateAlerts = useCallback((fi: number) => {
    const f = getFrame(fi);
    if (f) setAlerts(findCloseCollisions(f));
  }, [getFrame]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    };
    resize();
    window.addEventListener('resize', resize);

    let running = true;

    const loop = (timestamp: number) => {
      if (!running) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : canvas.width;
      const h = parent ? parent.clientHeight : canvas.height;

      // Advance frame if playing
      if (playingRef.current) {
        if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
        const dt = timestamp - lastTimeRef.current;
        lastTimeRef.current = timestamp;
        // 60fps base, scaled by speed
        accumRef.current += dt * speedRef.current / (1000 / 60);
        while (accumRef.current >= 1) {
          accumRef.current -= 1;
          if (frameRef.current < totalFrames - 1) {
            frameRef.current++;
            setFrame(frameRef.current);
          } else {
            playingRef.current = false;
            setPlaying(false);
            break;
          }
        }
      } else {
        lastTimeRef.current = 0;
        accumRef.current = 0;
      }

      // Render current frame
      const f = getFrame(frameRef.current);
      if (f) {
        renderReplayFrame(ctx, f, camRef.current, w, h);

        // Timeline overlay on canvas
        drawTimelineOnCanvas(ctx, w, h, frameRef.current, totalFrames, deathFrameIdx, frameToRelSeconds);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [totalFrames, deathFrameIdx, getFrame, frameToRelSeconds]);

  // Mouse: drag to pan
  const onMouseDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, camX: camRef.current.x, camY: camRef.current.y };
  }, []);
  const onMouseMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    camRef.current.x = dragRef.current.camX - dx / camRef.current.zoom;
    camRef.current.y = dragRef.current.camY - dy / camRef.current.zoom;
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current.active = false; }, []);

  // Scroll: zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    camRef.current.zoom = Math.max(0.2, Math.min(8, camRef.current.zoom * factor));
  }, []);

  const togglePlay = () => {
    playingRef.current = !playingRef.current;
    setPlaying(!playing);
  };

  const stepFrame = (dir: number) => {
    const next = Math.max(0, Math.min(totalFrames - 1, frameRef.current + dir));
    frameRef.current = next;
    setFrame(next);
    updateAlerts(next);
  };

  const goToFrame = (idx: number) => {
    frameRef.current = Math.max(0, Math.min(totalFrames - 1, idx));
    setFrame(frameRef.current);
    updateAlerts(frameRef.current);
  };

  const jumpToDeath = () => goToFrame(deathFrameIdx);
  const jumpToStart = () => goToFrame(0);

  const changeSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    speedRef.current = SPEEDS[next].value;
  };

  const zoomIn = () => { camRef.current.zoom = Math.min(8, camRef.current.zoom * 1.3); };
  const zoomOut = () => { camRef.current.zoom = Math.max(0.2, camRef.current.zoom / 1.3); };

  const progress = totalFrames > 1 ? (frame / (totalFrames - 1)) * 100 : 0;
  const relSec = frameToRelSeconds(frame);

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col">
      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden" style={{ cursor: 'grab' }}>
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          onPointerDown={onMouseDown}
          onPointerMove={onMouseMove}
          onPointerUp={onMouseUp}
          onPointerLeave={onMouseUp}
          onWheel={onWheel}
          style={{ touchAction: 'none' }}
        />

        {/* Collision alerts panel */}
        {showAlerts && (
          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-3 max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-bold font-mono">COLLISION CHECK</span>
            </div>
            {alerts.length === 0 ? (
              <p className="text-white/60 text-xs font-mono">No collisions at this frame</p>
            ) : (
              <ul className="space-y-1">
                {alerts.map((a, i) => (
                  <li key={i} className="text-red-400 text-xs font-mono">• {a}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Top bar: title + close */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5">
            <span className="text-white/70 text-xs font-mono">DEATH REPLAY</span>
          </div>
          <button
            onClick={onExit}
            className="w-9 h-9 rounded-lg bg-black/60 border border-white/10 hover:border-red-500/50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="bg-black/90 border-t border-white/10 px-3 py-2.5">
        {/* Timeline slider */}
        <div className="relative h-8 mb-2 flex items-center">
          {/* Death marker */}
          {deathFrameIdx >= 0 && (
            <div
              className="absolute w-0.5 h-full bg-red-500 z-10 pointer-events-none"
              style={{ left: `${(deathFrameIdx / Math.max(1, totalFrames - 1)) * 100}%` }}
            />
          )}
          <input
            type="range"
            min={0}
            max={Math.max(1, totalFrames - 1)}
            value={frame}
            onChange={(e) => goToFrame(parseInt(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-md"
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          {/* Left: transport */}
          <div className="flex items-center gap-1.5">
            <button onClick={jumpToStart} className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors" title="Jump to start">
              <SkipBack className="w-4 h-4 text-white/70" />
            </button>
            <button onClick={togglePlay} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors" title={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
            </button>
            <button onClick={() => stepFrame(1)} className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors" title="Next frame">
              <SkipForward className="w-4 h-4 text-white/70" />
            </button>
            <button onClick={() => stepFrame(-1)} className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors" title="Prev frame">
              <SkipBack className="w-4 h-4 text-white/70 rotate-180" />
            </button>
            <button onClick={jumpToDeath} className="w-8 h-8 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 flex items-center justify-center cursor-pointer transition-colors" title="Jump to death">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </button>
          </div>

          {/* Center: time info */}
          <div className="text-center">
            <div className="text-white font-mono text-sm">
              <span className={relSec < 0 ? 'text-green-400' : relSec === 0 ? 'text-red-400 font-bold' : 'text-orange-400'}>
                {relSec >= 0 ? '+' : ''}{relSec.toFixed(2)}s
              </span>
            </div>
            <div className="text-white/40 font-mono text-[10px]">
              Frame {frame} / {totalFrames - 1}
            </div>
          </div>

          {/* Right: speed + zoom + alerts */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={changeSpeed}
              className="px-2.5 h-8 rounded bg-white/10 hover:bg-white/20 text-white/80 text-xs font-mono font-bold cursor-pointer transition-colors"
              title="Change speed"
            >
              {SPEEDS[speedIdx].label}
            </button>
            <button onClick={zoomIn} className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors" title="Zoom in">
              <ZoomIn className="w-4 h-4 text-white/70" />
            </button>
            <button onClick={zoomOut} className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors" title="Zoom out">
              <ZoomOut className="w-4 h-4 text-white/70" />
            </button>
            <button
              onClick={() => { setShowAlerts(!showAlerts); updateAlerts(frame); }}
              className={`w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-colors border ${showAlerts ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
              title="Check collisions at this frame"
            >
              <AlertTriangle className={`w-4 h-4 ${showAlerts ? 'text-yellow-400' : 'text-white/70'}`} />
            </button>
            <button onClick={() => { camRef.current.zoom = 1.5; }} className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors" title="Reset zoom">
              <RotateCcw className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Draw the timeline bar directly on canvas (red death marker) */
function drawTimelineOnCanvas(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  currentFrame: number,
  totalFrames: number,
  deathFrameIdx: number,
  frameToRelSeconds: (i: number) => number,
): void {
  const barY = 8;
  const barH = 4;
  const barX = 10;
  const barW = w - 20;

  // Background bar
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(barX, barY, barW, barH);

  // Pre-death portion (green)
  if (deathFrameIdx >= 0) {
    const deathX = barX + (deathFrameIdx / Math.max(1, totalFrames - 1)) * barW;
    ctx.fillStyle = 'rgba(34,197,94,0.3)';
    ctx.fillRect(barX, barY, deathX - barX, barH);
  }

  // Post-death portion (orange)
  if (deathFrameIdx >= 0) {
    const deathX = barX + (deathFrameIdx / Math.max(1, totalFrames - 1)) * barW;
    ctx.fillStyle = 'rgba(249,115,22,0.3)';
    ctx.fillRect(deathX, barY, barX + barW - deathX, barH);
  }

  // Current position
  const curX = barX + (currentFrame / Math.max(1, totalFrames - 1)) * barW;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(curX, barY + barH / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Time label
  const relSec = frameToRelSeconds(currentFrame);
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = relSec < 0 ? '#22c55e' : relSec === 0 ? '#ef4444' : '#f97316';
  ctx.fillText(`${relSec >= 0 ? '+' : ''}${relSec.toFixed(1)}s`, w - 10, barY + barH + 4);
}
