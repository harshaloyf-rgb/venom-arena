'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  createGameSocket, type GameSocketState, type GameSnapshot, type RemoteSnake,
} from '@/lib/game-socket';
import { drawGrid } from './renderer';

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
  const [socketState, setSocketState] = useState<GameSocketState>({
    status: 'disconnected', snapshot: null, error: null, matchEnd: null, killerName: null,
  });

  // ── Connect to game server ──
  useEffect(() => {
    if (!arenaId) return;

    let cancelled = false;

    (async () => {
      // Get game token
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

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Mouse tracking
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseX = e.clientX - rect.left;
      inputRef.current.mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', onMouseMove);

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) inputRef.current.boost = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) inputRef.current.boost = false;
    };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // Render loop
    const loop = () => {
      animRef.current = requestAnimationFrame(loop);

      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const snap = snapRef.current;
      if (!snap) {
        // Loading screen
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (socketState.status === 'connecting') {
          ctx.fillText('Connecting to server...', w / 2, h / 2);
        } else if (socketState.status === 'error') {
          ctx.fillStyle = '#ef4444';
          ctx.fillText(socketState.error || 'Connection failed', w / 2, h / 2);
        } else if (socketState.status === 'disconnected') {
          ctx.fillText('Disconnected', w / 2, h / 2);
        }
        return;
      }

      // ── Camera: follow player ──
      const zoom = 1.6;
      const camX = snap.playerX;
      const camY = snap.playerY;
      const toScreenX = (wx: number) => (wx - camX) * zoom + w / 2;
      const toScreenY = (wy: number) => (wy - camY) * zoom + h / 2;

      // ── Compute target angle from mouse ──
      const mx = inputRef.current.mouseX;
      const my = inputRef.current.mouseY;
      const targetAngle = Math.atan2(my - h / 2, mx - w / 2);
      inputRef.current.angle = targetAngle;
      sockRef.current?.sendInput(targetAngle, inputRef.current.boost);

      // ── Clear ──
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // ── Grid ──
      drawGrid(ctx, { x: camX, y: camY, zoom }, { left: camX - w / 2 / zoom, top: camY - h / 2 / zoom, right: camX + w / 2 / zoom, bottom: camY + h / 2 / zoom, width: w, height: h });

      // ── Boundary ring ──
      const bScreenR = snap.boundaryRadius * zoom;
      const bsx = w / 2 - camX * zoom;
      const bsy = h / 2 - camY * zoom;
      if (bsx + bScreenR > -100 && bsx - bScreenR < w + 100) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.lineWidth = 60 * zoom;
        ctx.beginPath(); ctx.arc(bsx, bsy, bScreenR, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.lineWidth = 20 * zoom;
        ctx.beginPath(); ctx.arc(bsx, bsy, bScreenR, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 3 * zoom;
        ctx.beginPath(); ctx.arc(bsx, bsy, bScreenR, 0, Math.PI * 2); ctx.stroke();
      }

      // ── Food ──
      for (const f of snap.foods) {
        const sx = toScreenX(f.x);
        const sy = toScreenY(f.y);
        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, f.r * zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Snakes ──
      for (const s of snap.snakes) {
        const sx = toScreenX(s.hx);
        const sy = toScreenY(s.hy);
        const sr = s.bodyRadius * zoom;
        if (sx < -200 || sx > w + 200 || sy < -200 || sy > h + 200) continue;

        // Body trail (simple line behind head)
        const trailLen = Math.min(s.bodyLen * 5, 400) * zoom;
        const tailX = sx - Math.cos(s.angle) * trailLen;
        const tailY = sy - Math.sin(s.angle) * trailLen;

        ctx.strokeStyle = s.color;
        ctx.lineWidth = sr * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // Head circle
        ctx.fillStyle = s.secondaryColor;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * 1.1, 0, Math.PI * 2);
        ctx.fill();

        // Eye dots
        const eyeOff = sr * 0.4;
        const eyeR = sr * 0.25;
        const perpAngle = s.angle + Math.PI / 2;
        for (const side of [-1, 1]) {
          const ex = sx + Math.cos(s.angle) * eyeOff * 0.5 + Math.cos(perpAngle) * eyeOff * side;
          const ey = sy + Math.sin(s.angle) * eyeOff * 0.5 + Math.sin(perpAngle) * eyeOff * side;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(ex + Math.cos(s.angle) * eyeR * 0.3, ey + Math.sin(s.angle) * eyeR * 0.3, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
        }

        // Name tag (only for real players)
        if (!s.isBot) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(s.name, sx, sy - sr * 1.3 - 4);
        }
      }

      // ── HUD: Score ──
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      const scoreText = `Score ${Math.floor(snap.playerScore).toLocaleString()}`;
      ctx.font = 'bold 12px monospace';
      const stw = ctx.measureText(scoreText).width;
      ctx.beginPath(); ctx.roundRect(w / 2 - stw / 2 - 14, h - 46, stw + 28, 32, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(scoreText, w / 2, h - 20);

      // Kills
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.roundRect(w - 112, h - 46, 100, 28, 6); ctx.fill();
      ctx.font = '9px monospace'; ctx.fillStyle = '#a0a0a0'; ctx.textAlign = 'right';
      ctx.fillText('Kills', w - 64, h - 28);
      ctx.fillStyle = '#f87171'; ctx.font = 'bold 10px monospace';
      ctx.fillText(String(snap.playerKills), w - 22, h - 28);

      // Online indicator
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.roundRect(12, h - 46, 80, 28, 6); ctx.fill();
      ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(26, h - 32, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#94a3b8'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
      ctx.fillText('ONLINE', 36, h - 28);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleRespawn = useCallback(() => {
    if (arenaId) window.location.reload();
  }, [arenaId]);

  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-4 left-4 z-10 w-9 h-9 rounded-lg bg-black/60 hover:bg-red-950/60 border border-white/10 hover:border-red-500/30 flex items-center justify-center cursor-pointer transition-colors"
      >
        <X className="w-4 h-4 text-white/60" />
      </button>

      {/* Boost hint */}
      {!socketState.matchEnd && (
        <div className="absolute bottom-6 right-4 z-10 pointer-events-none flex flex-col items-center gap-1.5">
          <button className="pointer-events-auto flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all duration-200 select-none touch-manipulation bg-orange-500/15 border-orange-500/30 text-orange-400">
            <Zap className="w-4 h-4" />
            <span className="text-[10px]">B / Click</span>
          </button>
        </div>
      )}

      {/* Death overlay */}
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
