// ============================================================================
// offline-replay.ts — Replay recording and playback for offline mode.
// ============================================================================
// All functions are standalone helpers that receive the engine instance via
// an OfflineEngineRef.  The main engine delegates replay methods here.
// ============================================================================

import type { OfflineEngineRef, ReplayFrame, Vec2, SnakeBase } from './offline-types';
import { INITIAL_SPAWN_SCORE } from '@/lib/game-config';
import { REPLAY_PRE_MAX, REPLAY_POST_MAX, REPLAY_VISIBLE_RADIUS, REPLAY_MAX_SNAKE_POINTS } from './offline-constants';

// ============================================================================
// Math helper (duplicated locally to keep this module self-contained)
// ============================================================================

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

// ============================================================================
// Replay recording — post-death entry
// ============================================================================

export function enterPostDeathRecording(e: OfflineEngineRef): void {
  e.isPostDeathRecording = true;
  e.postDeathTicksRemaining = REPLAY_POST_MAX;
  e.deathCamX = e.cam.x;
  e.deathCamY = e.cam.y;
  // Record death particles at head
  if (e.player && e.player.points.length > 0) {
    e.spawnDeathParticles(e.player.points[0].x, e.player.points[0].y, e.player.color);
  }
}

// ============================================================================
// Replay recording — snapshot capture
// ============================================================================

export function captureReplaySnapshot(e: OfflineEngineRef): void {
  const camX = e.isPostDeathRecording ? e.deathCamX : e.cam.x;
  const camY = e.isPostDeathRecording ? e.deathCamY : e.cam.y;
  const camZoom = e.cam.zoom;

  const snakes: { id: string; name: string; points: Vec2[]; angle: number; size: number; color: string; secondaryColor?: string; isDead: boolean; score: number; isBoosting: boolean; isPlayer: boolean }[] = [];
  const allSnakes: SnakeBase[] = [];
  for (const bot of e.bots.values()) {
    if (!bot.isDead) allSnakes.push(bot);
  }
  if (e.player && !e.player.isDead) allSnakes.push(e.player);
  if (e.player && e.player.isDead && e.postDeathTicksRemaining > REPLAY_POST_MAX - 30) {
    allSnakes.push(e.player);
  }

  for (const snake of allSnakes) {
    if (snake.points.length === 0) continue;
    const head = snake.points[0];
    const d = dist(head.x, head.y, camX, camY);
    if (d > REPLAY_VISIBLE_RADIUS) continue;

    let pts = snake.points;
    if (pts.length > REPLAY_MAX_SNAKE_POINTS) {
      const step = pts.length / REPLAY_MAX_SNAKE_POINTS;
      const downsampled: Vec2[] = [];
      for (let i = 0; i < REPLAY_MAX_SNAKE_POINTS; i++) {
        downsampled.push(pts[Math.floor(i * step)]);
      }
      pts = downsampled;
    }

    snakes.push({
      id: snake.id,
      name: snake.name,
      points: pts.map(p => ({ x: p.x, y: p.y })),
      angle: snake.angle,
      size: snake.size,
      color: snake.color,
      secondaryColor: snake.secondaryColor,
      isDead: snake.isDead,
      score: snake.score,
      isBoosting: snake.isBoosting,
      isPlayer: snake.isPlayer,
    });
  }

  const foods: { x: number; y: number; size: number; value: number; color: string; glowColor: string; orbSize: string }[] = [];
  for (const f of e.foods) {
    if (f.value <= 0) continue;
    const d = dist(f.x, f.y, camX, camY);
    if (d > REPLAY_VISIBLE_RADIUS) continue;
    foods.push({
      x: f.x, y: f.y, size: f.size, value: f.value,
      color: f.color, glowColor: f.glowColor, orbSize: f.orbSize,
    });
  }

  const frame: ReplayFrame = {
    snakes,
    foods,
    camX,
    camY,
    camZoom,
  };

  if (e.isPostDeathRecording) {
    if (e.replayPostBuffer.length < REPLAY_POST_MAX) {
      e.replayPostBuffer.push(frame);
    }
  } else {
    const buf = e.replayPreBuffer;
    if (buf.length < REPLAY_PRE_MAX) {
      buf.push(frame);
    } else {
      buf[e.replayPreWriteIdx % REPLAY_PRE_MAX] = frame;
    }
    e.replayPreWriteIdx++;
  }
}

// ============================================================================
// Replay recording — finish
// ============================================================================

export function getPreDeathFrames(e: OfflineEngineRef): ReplayFrame[] {
  const buf = e.replayPreBuffer;
  const len = buf.length;
  if (len === 0) return [];
  if (len < REPLAY_PRE_MAX) return [...buf];
  const start = e.replayPreWriteIdx % REPLAY_PRE_MAX;
  const result: ReplayFrame[] = [];
  for (let i = 0; i < REPLAY_PRE_MAX; i++) {
    result.push(buf[(start + i) % REPLAY_PRE_MAX]);
  }
  return result;
}

export function finishPostDeathRecording(e: OfflineEngineRef): void {
  e.isPostDeathRecording = false;
  e.finalScore = INITIAL_SPAWN_SCORE + (e.player?.score ?? 0);
  e.finalKills = e.player?.kills ?? 0;
  e.finalDurationSeconds = Math.floor((performance.now() - e.startTime) / 1000);

  const preFrames = getPreDeathFrames(e);
  e.replayDeathFrameIdx = preFrames.length;
  e.replayFrames = [...preFrames, ...e.replayPostBuffer];

  e.setState('dead');
  e.showEndScreen('death');
}

// ============================================================================
// Replay playback — enter
// ============================================================================

export function enterReplayMode(e: OfflineEngineRef): void {
  if (e.replayFrames.length === 0) return;
  e.isReplayMode = true;
  e.replayPlaybackIdx = 0;
  e.replayPlaying = true;
  e.replaySpeed = 1;
  e.replayZoom = 0.8;

  // Hide end screen, show replay canvas
  if (e.endOverlay) {
    e.endOverlay.style.display = 'none';
  }

  // Create replay canvas + controls overlay
  const parent = e.canvas.parentElement;
  if (!parent) return;

  const replayWrap = document.createElement('div');
  replayWrap.id = 'oe-replay-wrap';
  replayWrap.style.cssText = 'position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(2,6,23,0.95);';

  // Replay canvas
  const replayCanvas = document.createElement('canvas');
  replayCanvas.id = 'oe-replay-canvas';
  replayCanvas.style.cssText = 'width:min(90vw,800px);aspect-ratio:16/9;border:1px solid #1e293b;border-radius:12px;background:#020617;display:block;';
  replayWrap.appendChild(replayCanvas);

  // Controls
  const controls = document.createElement('div');
  controls.id = 'oe-replay-controls';
  controls.style.cssText = 'margin-top:12px;display:flex;align-items:center;gap:8px;';
  controls.innerHTML = `
      <button id="oe-replay-restart" type="button" style="width:32px;height:32px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;cursor:pointer;font-size:14px;">↺</button>
      <button id="oe-replay-toggle" type="button" style="width:36px;height:36px;border-radius:8px;border:none;background:#e11d48;color:#fff;cursor:pointer;font-size:16px;">⏸</button>
      <button id="oe-replay-speed" type="button" style="height:32px;padding:0 8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;cursor:pointer;font-size:11px;font-weight:bold;font-family:monospace;">1x</button>
      <div style="display:flex;align-items:center;gap:4px;">
        <button id="oe-replay-zout" type="button" style="width:32px;height:32px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;cursor:pointer;font-size:12px;">−</button>
        <span id="oe-replay-zoom-label" style="width:32px;text-align:center;font-size:10px;color:#94a3b8;font-family:monospace;">80%</span>
        <button id="oe-replay-zin" type="button" style="width:32px;height:32px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;cursor:pointer;font-size:12px;">+</button>
      </div>
      <button id="oe-replay-exit" type="button" style="height:32px;padding:0 12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#94a3b8;cursor:pointer;font-size:11px;font-weight:bold;">EXIT REPLAY</button>
    `;
  replayWrap.appendChild(controls);

  // Progress bar
  const progressWrap = document.createElement('div');
  progressWrap.id = 'oe-replay-progress-wrap';
  progressWrap.style.cssText = 'width:min(90vw,800px);height:6px;background:#1e293b;border-radius:3px;margin-top:8px;position:relative;';
  const progressBar = document.createElement('div');
  progressBar.id = 'oe-replay-progress-bar';
  progressBar.style.cssText = 'height:100%;background:#e11d48;border-radius:3px;width:0%;transition:width 50ms;';
  progressWrap.appendChild(progressBar);
  // Death marker
  if (e.replayDeathFrameIdx > 0 && e.replayFrames.length > 0) {
    const deathPct = (e.replayDeathFrameIdx / (e.replayFrames.length - 1)) * 100;
    const marker = document.createElement('div');
    marker.style.cssText = `position:absolute;top:0;height:100%;width:2px;background:#fbbf24;left:${deathPct}%;`;
    progressWrap.appendChild(marker);
  }
  replayWrap.appendChild(progressWrap);

  // Frame counter
  const counter = document.createElement('div');
  counter.id = 'oe-replay-counter';
  counter.style.cssText = 'margin-top:4px;font-size:11px;color:#94a3b8;font-family:monospace;';
  counter.textContent = `Frame 1/${e.replayFrames.length}`;
  replayWrap.appendChild(counter);

  parent.appendChild(replayWrap);

  // Setup canvas
  e.replayCanvas = replayCanvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  replayCanvas.width = replayCanvas.clientWidth * dpr;
  replayCanvas.height = replayCanvas.clientHeight * dpr;
  e.replayCtx = replayCanvas.getContext('2d', { alpha: false });

  // Event listeners
  const toggleBtn = controls.querySelector('#oe-replay-toggle') as HTMLButtonElement;
  const restartBtn = controls.querySelector('#oe-replay-restart') as HTMLButtonElement;
  const speedBtn = controls.querySelector('#oe-replay-speed') as HTMLButtonElement;
  const zinBtn = controls.querySelector('#oe-replay-zin') as HTMLButtonElement;
  const zoutBtn = controls.querySelector('#oe-replay-zout') as HTMLButtonElement;
  const exitBtn = controls.querySelector('#oe-replay-exit') as HTMLButtonElement;
  const zoomLabel = controls.querySelector('#oe-replay-zoom-label') as HTMLSpanElement;

  toggleBtn.onclick = () => {
    e.replayPlaying = !e.replayPlaying;
    toggleBtn.textContent = e.replayPlaying ? '⏸' : '▶';
  };
  restartBtn.onclick = () => {
    e.replayPlaybackIdx = 0;
    e.replayPlaying = true;
    toggleBtn.textContent = '⏸';
  };
  const speeds = [0.25, 0.5, 1, 2];
  speedBtn.onclick = () => {
    const ci = speeds.indexOf(e.replaySpeed);
    e.replaySpeed = speeds[(ci + 1) % speeds.length];
    speedBtn.textContent = `${e.replaySpeed}x`;
  };
  zinBtn.onclick = () => {
    e.replayZoom = Math.min(2, e.replayZoom + 0.15);
    zoomLabel.textContent = `${Math.round(e.replayZoom * 100)}%`;
  };
  zoutBtn.onclick = () => {
    e.replayZoom = Math.max(0.3, e.replayZoom - 0.15);
    zoomLabel.textContent = `${Math.round(e.replayZoom * 100)}%`;
  };
  exitBtn.onclick = () => {
    e.exitReplayMode();
  };

  // Start replay animation
  e.replayLastTime = performance.now();
  e.replayRafId = requestAnimationFrame((now) => replayFrame(e, now));
}

// ============================================================================
// Replay playback — per-frame rendering
// ============================================================================

export function replayFrame(e: OfflineEngineRef, now: number): void {
  if (!e.isReplayMode || e.stopped) return;
  e.replayRafId = requestAnimationFrame((nextNow) => replayFrame(e, nextNow));

  const ctx = e.replayCtx;
  const canvas = e.replayCanvas;
  if (!ctx || !canvas) return;

  // Advance frame
  if (e.replayPlaying) {
    const frameInterval = (1000 / 30) / e.replaySpeed;
    const dt = now - e.replayLastTime;
    if (dt >= frameInterval) {
      e.replayPlaybackIdx = (e.replayPlaybackIdx + 1) % e.replayFrames.length;
      e.replayLastTime = now;
    }
  } else {
    e.replayLastTime = now;
  }

  const frame = e.replayFrames[e.replayPlaybackIdx];
  if (!frame) return;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const z = e.replayZoom;
  const camX = frame.camX;
  const camY = frame.camY;

  // World transform
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(w / 2, h / 2);
  ctx.scale(z, z);
  ctx.translate(-camX, -camY);

  // Grid
  const gridSize = 60;
  const viewL = camX - w / 2 / z - gridSize;
  const viewR = camX + w / 2 / z + gridSize;
  const viewT = camY - h / 2 / z - gridSize;
  const viewB = camY + h / 2 / z + gridSize;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1 / z;
  ctx.beginPath();
  const sX = Math.floor(viewL / gridSize) * gridSize;
  const eX = Math.ceil(viewR / gridSize) * gridSize;
  const sY = Math.floor(viewT / gridSize) * gridSize;
  const eY = Math.ceil(viewB / gridSize) * gridSize;
  for (let x = sX; x <= eX; x += gridSize) { ctx.moveTo(x, viewT); ctx.lineTo(x, viewB); }
  for (let y = sY; y <= eY; y += gridSize) { ctx.moveTo(viewL, y); ctx.lineTo(viewR, y); }
  ctx.stroke();

  // Draw food
  for (const f of frame.foods) {
    if (f.x < viewL || f.x > viewR || f.y < viewT || f.y > viewB) continue;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw snakes
  for (const s of frame.snakes) {
    if (s.points.length === 0) continue;
    const head = s.points[0];
    if (head.x < viewL - 100 || head.x > viewR + 100 || head.y < viewT - 100 || head.y > viewB + 100) continue;

    if (s.points.length >= 2) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();

      // Head
      ctx.fillStyle = s.secondaryColor ?? s.color;
      ctx.beginPath();
      ctx.arc(s.points[0].x, s.points[0].y, s.size * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Player highlight
      if (s.isPlayer && !s.isDead) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
        ctx.lineWidth = s.size * 2.5;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      }

      // Name tag
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = s.isPlayer ? '#fcd34d' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const screenX = w / 2 + (head.x - camX) * z;
      const screenY = h / 2 + (head.y - camY) * z - s.size * z * 1.5;
      ctx.fillText(s.name, screenX, screenY);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(w / 2, h / 2);
      ctx.scale(z, z);
      ctx.translate(-camX, -camY);
    }
  }

  // Reset transform for overlays
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Death indicator
  const isPostDeathFrame = e.replayDeathFrameIdx > 0 && e.replayPlaybackIdx >= e.replayDeathFrameIdx;
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('⏺ REPLAY', 8, 8);

  if (e.replayDeathFrameIdx > 0) {
    const preSec = Math.min(15, Math.floor(e.replayPlaybackIdx / 30));
    const postSec = e.replayPlaybackIdx > e.replayDeathFrameIdx
      ? Math.min(15, Math.floor((e.replayPlaybackIdx - e.replayDeathFrameIdx) / 30))
      : 0;
    ctx.font = '10px monospace';
    ctx.fillStyle = isPostDeathFrame ? 'rgba(244, 63, 94, 0.9)' : 'rgba(226, 232, 240, 0.6)';
    const label = isPostDeathFrame
      ? `⛔ DEATH +${postSec}s | Frame ${e.replayPlaybackIdx + 1}/${e.replayFrames.length}`
      : `Frame ${e.replayPlaybackIdx + 1}/${e.replayFrames.length} | -${Math.max(0, 15 - preSec)}s to death`;
    ctx.fillText(label, 8, 24);
  }

  // Update progress bar
  const progressEl = document.getElementById('oe-replay-progress-bar');
  if (progressEl) {
    const pct = e.replayFrames.length > 1 ? (e.replayPlaybackIdx / (e.replayFrames.length - 1)) * 100 : 0;
    progressEl.style.width = `${pct}%`;
  }
  const counterEl = document.getElementById('oe-replay-counter');
  if (counterEl) {
    counterEl.textContent = `Frame ${e.replayPlaybackIdx + 1}/${e.replayFrames.length}`;
  }
}

// ============================================================================
// Replay playback — exit
// ============================================================================

export function exitReplayMode(e: OfflineEngineRef): void {
  e.isReplayMode = false;
  if (e.replayRafId !== null) {
    cancelAnimationFrame(e.replayRafId);
    e.replayRafId = null;
  }
  e.replayCanvas = null;
  e.replayCtx = null;

  // Remove replay overlay
  const wrap = document.getElementById('oe-replay-wrap');
  if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);

  // Show end screen again
  if (e.endOverlay) {
    e.endOverlay.style.display = '';
  }
}
