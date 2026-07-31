'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { KillFeedEntry, GameSnapshot, PlayerInput } from '@/lib/game-types';
import { DEFAULT_CONFIG } from '@/lib/game-config';

interface OnlineGameProps {
  playerName: string;
  userTag?: string;
  onExit: () => void;
}

// ─── Draw Star Shape Helper ───────────────────────────────

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    const x = cx + Math.cos(rot) * outerR;
    const y = cy + Math.sin(rot) * outerR;
    ctx.lineTo(x, y);
    rot += step;
    const ix = cx + Math.cos(rot) * innerR;
    const iy = cy + Math.sin(rot) * innerR;
    ctx.lineTo(ix, iy);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
}

// ─── Component ─────────────────────────────────────────────

export default function OnlineGame({ playerName, userTag, onExit }: OnlineGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hudScore, setHudScore] = useState(0);
  const [hudKills, setHudKills] = useState(0);
  const [hudRank, setHudRank] = useState(1);
  const [hudKillFeed, setHudKillFeed] = useState<KillFeedEntry[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalKills, setFinalKills] = useState(0);
  const [killerName, setKillerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  // All mutable game state in refs
  const gs = useRef({
    snapshot: null as GameSnapshot | null,
    camera: { x: 2500, y: 2500, zoom: 1 },
    mousePos: { x: 0, y: 0 },
    boosting: false,
    extracting: false,
    worldSize: DEFAULT_CONFIG.worldSize,
    animFrame: 0,
    hudTimer: 0,
    killFeedTimer: 0,
    tick: 0,
    playerId: '',
    socket: null as Socket | null,
    connected: false,
  });

  // Stable ref for onExit
  const onExitRef = useRef(onExit);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  // ─── Event Handlers ──────────────────────────────────────

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      gs.current.boosting = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      gs.current.boosting = false;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    gs.current.mousePos = { x, y };
  }, []);

  const handleMouseDown = useCallback(() => {
    gs.current.boosting = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    gs.current.boosting = false;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ─── Render (identical style to offline) ─────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const minimapCanvas = minimapRef.current;
    if (!canvas || !minimapCanvas) return;
    const g = gs.current;
    const snap = g.snapshot;
    if (!snap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const mctx = minimapCanvas.getContext('2d');
    if (!mctx) return;

    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    const cam = g.camera;
    const ws = snap.worldSize;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // Grid
    const gridSize = 100;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    const sx = Math.max(0, Math.floor((cam.x - W / 2 / cam.zoom) / gridSize) * gridSize);
    const ex = Math.min(ws, Math.ceil((cam.x + W / 2 / cam.zoom) / gridSize) * gridSize);
    const sy = Math.max(0, Math.floor((cam.y - H / 2 / cam.zoom) / gridSize) * gridSize);
    const ey = Math.min(ws, Math.ceil((cam.y + H / 2 / cam.zoom) / gridSize) * gridSize);
    ctx.beginPath();
    for (let x = sx; x <= ex; x += gridSize) { ctx.moveTo(x, sy); ctx.lineTo(x, ey); }
    for (let y = sy; y <= ey; y += gridSize) { ctx.moveTo(sx, y); ctx.lineTo(ex, y); }
    ctx.stroke();

    // World boundary
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, ws, ws);

    // Food — render ALL foods including death drops
    const time = g.tick * 0.05;
    for (const food of snap.foods) {
      const fscX = (food.x - cam.x) * cam.zoom + W / 2;
      const fscY = (food.y - cam.y) * cam.zoom + H / 2;
      if (fscX < -50 || fscX > W + 50 || fscY < -50 || fscY > H + 50) continue;

      if (food.isStarChip) {
        const pulse = 1 + Math.sin(time * 3 + food.x) * 0.3;
        const glowSize = food.size * 3 * pulse;
        const grad = ctx.createRadialGradient(food.x, food.y, 0, food.x, food.y, glowSize);
        grad.addColorStop(0, food.glowColor ?? '#fde68a');
        grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.3)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(food.x, food.y, glowSize, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = food.color;
        drawStar(ctx, food.x, food.y, 5, food.size * pulse, food.size * 0.5 * pulse);
        ctx.fill();
      } else {
        const glowSize = food.size * 2.5;
        const grad = ctx.createRadialGradient(food.x, food.y, 0, food.x, food.y, glowSize);
        grad.addColorStop(0, food.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(food.x, food.y, glowSize, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = food.color;
        ctx.beginPath(); ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Snakes
    const segSpacing = DEFAULT_CONFIG.segmentSpacing;
    for (const snake of snap.snakes) {
      if (snake.isDead || snake.points.length < 2) continue;
      const head = snake.points[0];
      const snkX = (head.x - cam.x) * cam.zoom + W / 2;
      const snkY = (head.y - cam.y) * cam.zoom + H / 2;
      const bodyLen = snake.points.length * segSpacing;
      if (snkX < -bodyLen || snkX > W + bodyLen || snkY < -bodyLen || snkY > H + bodyLen) continue;

      const segCount = snake.points.length;
      // Body segments (back to front for gradient)
      for (let i = segCount - 1; i >= 1; i--) {
        const p = snake.points[i];
        const t = 1 - i / segCount;
        const radius = snake.size * (0.4 + 0.6 * t);
        ctx.globalAlpha = 0.3 + 0.7 * t;
        ctx.fillStyle = snake.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Head
      const hr = snake.size;
      ctx.fillStyle = snake.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Eyes
      const eo = hr * 0.4;
      const es = hr * 0.3;
      const perp = snake.angle + Math.PI / 2;
      for (const side of [-1, 1]) {
        const eX = head.x + Math.cos(snake.angle) * eo * 0.5 + Math.cos(perp) * eo * side;
        const eY = head.y + Math.sin(snake.angle) * eo * 0.5 + Math.sin(perp) * eo * side;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(eX, eY, es, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(eX + Math.cos(snake.angle) * es * 0.3, eY + Math.sin(snake.angle) * es * 0.3, es * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Name tag
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(snake.name, head.x, head.y - hr - 10);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(`[${Math.floor(snake.score)}]`, head.x, head.y - hr - 24);

      // Spawn protection ring
      if (snake.spawnProtected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(head.x, head.y, hr + 8, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();

    // Minimap
    const mW = minimapCanvas.width;
    const mH = minimapCanvas.height;
    const ms = mW / ws;
    mctx.fillStyle = 'rgba(0,0,0,0.7)';
    mctx.fillRect(0, 0, mW, mH);
    mctx.strokeStyle = '#333'; mctx.lineWidth = 1;
    mctx.strokeRect(0, 0, mW, mH);
    mctx.fillStyle = 'rgba(255,200,50,0.3)';
    for (let i = 0; i < snap.foods.length; i += 5) {
      const f = snap.foods[i];
      mctx.fillRect(f.x * ms, f.y * ms, 1, 1);
    }
    for (const snake of snap.snakes) {
      if (snake.isDead || snake.points.length === 0) continue;
      const sh = snake.points[0];
      mctx.fillStyle = snake.isPlayer ? '#22c55e' : snake.color;
      mctx.beginPath();
      mctx.arc(sh.x * ms, sh.y * ms, snake.isPlayer ? 4 : 2, 0, Math.PI * 2);
      mctx.fill();
    }
    const vpL = (cam.x - W / 2 / cam.zoom) * ms;
    const vpT = (cam.y - H / 2 / cam.zoom) * ms;
    mctx.strokeStyle = 'rgba(255,255,255,0.4)'; mctx.lineWidth = 1;
    mctx.strokeRect(vpL, vpT, (W / cam.zoom) * ms, (H / cam.zoom) * ms);
  }, []);

  // ─── Stable ref for render ───────────────────────────────

  const renderRef = useRef(render);
  useEffect(() => { renderRef.current = render; }, [render]);

  // ─── Connection setup (ref-based to avoid setState in effect) ──

  const connectSocket = useCallback((name: string, tag: string | undefined) => {
    const g = gs.current;

    // Clean up previous socket
    if (g.socket) {
      g.socket.disconnect();
      g.socket = null;
    }

    g.snapshot = null;
    g.boosting = false;
    g.extracting = false;
    g.connected = false;
    g.tick = 0;
    g.hudTimer = 0;
    g.killFeedTimer = 0;
    g.camera = { x: DEFAULT_CONFIG.worldSize / 2, y: DEFAULT_CONFIG.worldSize / 2, zoom: 1 };

    // Reset UI state
    setIsDead(false);
    setKillerName('');
    setHudScore(0);
    setHudKills(0);
    setHudRank(1);
    setHudKillFeed([]);
    setConnectionStatus('connecting');

    const socket = io('/?XTransformPort=3001', {
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 10000,
    });
    g.socket = socket;

    socket.on('connect', () => {
      g.connected = true;
      setConnectionStatus('connected');
      socket.emit('join', { name, userTag: tag });
    });

    socket.on('joined', (data: { id: string }) => {
      g.playerId = data.id;
      setPlayerId(data.id);
    });

    socket.on('snapshot', (snap: GameSnapshot) => {
      g.snapshot = snap;
      g.worldSize = snap.worldSize;
      g.tick = snap.tick;

      // Find player snake for camera + HUD
      const player = snap.snakes.find(s => s.id === g.playerId);
      if (player && !player.isDead) {
        const head = player.points[0];
        if (head) {
          g.camera.x += (head.x - g.camera.x) * 0.08;
          g.camera.y += (head.y - g.camera.y) * 0.08;
          const tz = Math.max(0.4, 1 - player.score * 0.002);
          g.camera.zoom += (tz - g.camera.zoom) * 0.02;
        }

        // Throttled HUD updates
        g.hudTimer++;
        if (g.hudTimer % 6 === 0) {
          setHudScore(Math.floor(player.score));
          setHudKills(player.kills);
          const aliveScores = snap.snakes.filter(s => !s.isDead).map(s => s.score).sort((a, b) => b - a);
          const rank = aliveScores.indexOf(player.score) + 1;
          setHudRank(rank > 0 ? rank : aliveScores.length + 1);
        }
      }

      // Throttled kill feed updates
      g.killFeedTimer++;
      if (g.killFeedTimer % 10 === 0) {
        setHudKillFeed([...snap.killFeed]);
      }
    });

    socket.on('you_died', (data: { killerName?: string; score: number; kills: number }) => {
      setIsDead(true);
      setFinalScore(data.score);
      setFinalKills(data.kills);
      setKillerName(data.killerName ?? 'the wall');
    });

    socket.on('disconnect', () => {
      g.connected = false;
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      g.connected = false;
      setConnectionStatus('error');
    });
  }, []);

  // Store in ref so play-again and main effect can use it without deps
  const connectSocketRef = useRef(connectSocket);
  useEffect(() => { connectSocketRef.current = connectSocket; }, [connectSocket]);

  // ─── Resize ──────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, []);

  // ─── Main Effect: connect, game loop, input, cleanup ────

  useEffect(() => {
    let running = true;
    const g = gs.current;

    // Connect via ref (setState calls happen inside the callback, not directly in effect)
    connectSocketRef.current(playerName, userTag);

    // Game loop — render + send input
    const loop = () => {
      if (!running) return;

      const g2 = gs.current;

      // Send input to server
      if (g2.connected && g2.socket) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const mx = g2.mousePos.x - rect.width / 2;
          const my = g2.mousePos.y - rect.height / 2;
          const targetAngle = Math.atan2(my, mx);

          const input: PlayerInput = {
            targetAngle,
            boosting: g2.boosting,
            extracting: g2.extracting,
          };
          g2.socket.emit('input', input);
        }
      }

      renderRef.current();
      g2.animFrame = requestAnimationFrame(loop);
    };

    g.animFrame = requestAnimationFrame(loop);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      running = false;
      cancelAnimationFrame(gs.current.animFrame);
      if (gs.current.socket) {
        gs.current.socket.disconnect();
        gs.current.socket = null;
      }
      gs.current.connected = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [playerName, userTag, handleKeyDown, handleKeyUp]);

  // ─── Play Again handler ──────────────────────────────────

  const handlePlayAgain = useCallback(() => {
    const g = gs.current;
    cancelAnimationFrame(g.animFrame);
    if (g.socket) {
      g.socket.disconnect();
      g.socket = null;
    }

    // Reconnect (connectSocket handles UI state reset)
    connectSocketRef.current(playerName, userTag);

    // Restart loop
    let loopRunning = true;
    const loop = () => {
      if (!loopRunning) return;
      const g2 = gs.current;
      if (g2.connected && g2.socket) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const mx = g2.mousePos.x - rect.width / 2;
          const my = g2.mousePos.y - rect.height / 2;
          const targetAngle = Math.atan2(my, mx);
          g2.socket.emit('input', { targetAngle, boosting: g2.boosting, extracting: g2.extracting } as PlayerInput);
        }
      }
      renderRef.current();
      g2.animFrame = requestAnimationFrame(loop);
    };
    gs.current.animFrame = requestAnimationFrame(loop);
  }, [playerName, userTag]);

  // ─── Render JSX ──────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Venom Arena online game canvas"
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onPointerLeave={handleMouseUp}
      />

      {/* Connection Status Overlay */}
      {connectionStatus === 'connecting' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-xl font-semibold">Connecting to server...</p>
          </div>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-4">
            <p className="text-red-400 text-xl font-semibold">Connection failed</p>
            <p className="text-gray-400 text-sm">Could not connect to the game server.</p>
            <button
              onClick={() => onExitRef.current()}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-xl transition-colors cursor-pointer"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {connectionStatus === 'disconnected' && !isDead && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-4">
            <p className="text-amber-400 text-xl font-semibold">Connection lost</p>
            <p className="text-gray-400 text-sm">The server connection was interrupted.</p>
            <button
              onClick={() => onExitRef.current()}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-xl transition-colors cursor-pointer"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {/* HUD - Score / Kills / Rank */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
          <div className="text-white text-2xl font-bold">{hudScore}</div>
          <div className="text-gray-400 text-sm">Score</div>
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
          <div className="text-white text-lg font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2L13 8H7L10 2Z" />
            </svg>
            {hudKills}
          </div>
          <div className="text-gray-400 text-sm">Kills</div>
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
          <div className="text-white text-lg font-semibold">#{hudRank}</div>
          <div className="text-gray-400 text-sm">Rank</div>
        </div>
      </div>

      {/* Leave button */}
      <button
        onClick={() => {
          const g = gs.current;
          if (g.socket) g.socket.disconnect();
          onExitRef.current();
        }}
        className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm hover:bg-red-600/80 text-white rounded-lg px-4 py-2 border border-white/10 transition-colors cursor-pointer pointer-events-auto"
      >
        ✕ Leave
      </button>

      {/* Boost hint */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 text-gray-300 text-xs">
          Boost: <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">SPACE</kbd> or <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono">CLICK</kbd>
        </div>
      </div>

      {/* Quick Chat */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
        {['GG', 'Target', 'Flee', 'Ripped', 'Extracting'].map((msg) => (
          <button
            key={msg}
            className="bg-black/60 backdrop-blur-sm hover:bg-white/10 text-gray-300 hover:text-white rounded-lg px-3 py-1.5 border border-white/10 text-xs transition-colors cursor-pointer"
          >
            {msg}
          </button>
        ))}
      </div>

      {/* Kill Feed */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
        {hudKillFeed.map((entry) => (
          <div
            key={`${entry.killerId}-${entry.victimId}-${entry.tick}`}
            className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1 border border-white/10 text-sm text-white"
          >
            <span className={entry.killerId === playerId ? 'text-green-400 font-bold' : 'text-red-400'}>
              {entry.killerName}
            </span>
            <span className="text-gray-500 mx-1">killed</span>
            <span className={entry.victimId === playerId ? 'text-red-400 font-bold' : 'text-gray-300'}>
              {entry.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* Minimap */}
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <canvas
          ref={minimapRef}
          width={150}
          height={150}
          className="rounded-lg border border-white/10"
          style={{ width: 150, height: 150 }}
        />
      </div>

      {/* Death Screen */}
      {isDead && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/90 rounded-2xl p-8 border border-white/10 flex flex-col items-center gap-6 min-w-[320px]">
            <h2 className="text-3xl font-bold text-white">You Died!</h2>
            <p className="text-gray-400 text-sm">
              Killed by <span className="text-red-400 font-semibold">{killerName}</span>
            </p>
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-400">{finalScore}</div>
                <div className="text-gray-400 text-sm mt-1">Score</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-400">{finalKills}</div>
                <div className="text-gray-400 text-sm mt-1">Kills</div>
              </div>
            </div>
            <button
              onClick={handlePlayAgain}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-xl transition-colors cursor-pointer text-lg"
            >
              Play Again
            </button>
            <button
              onClick={() => onExitRef.current()}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer text-sm"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
