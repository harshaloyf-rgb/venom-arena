'use client';

/**
 * Reusable game-accurate roaming snake preview.
 * Exact same rendering as the admin Snake Test — dark arena, grid,
 * shadow, 3D gradient, big eyes (0.38), mouse-tracking pupils.
 */

import { useEffect, useRef } from 'react';
import { SNAKE_RADIUS, CAMERA_BASE_ZOOM } from '@/lib/snake/config';
import { getSkinAsset } from '@/lib/snake/skin-registry';

// ─── Color helpers ─────────────────────────────────────────────────────

function lightenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `#${Math.round(r + (255 - r) * factor).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * factor).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * factor).toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `#${Math.round(r * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(g * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(b * (1 - factor)).toString(16).padStart(2, '0')}`;
}

// ─── Game rendering constants (exact match to render-snake-atlas.tsx) ──

const G = {
  segR: SNAKE_RADIUS * CAMERA_BASE_ZOOM,  // 16.2
  headScale: 1.3,
  step: 14,
  lighten: 0.35,
  lightenStop: 0.55,
  darken: 0.35,
  eyeR: 0.38,
  eyeOff: 0.42,
  eyeFwd: 0.32,
  pupR: 0.52,
  pupShift: 0.7,
  eyeBorderW: 1.5,
  eyeBorder: 'rgba(0,0,0,0.5)',
  highlight: 0.8,
  shadowBlur: 0.8,
  shadowOffY: 0.3,
};

// ─── Component ─────────────────────────────────────────────────────────

export function GameSnakePreview({
  skinId,
  headColor: headColorProp,
  bodyColor: bodyColorProp,
  width = 480,
  height = 220,
  segments = 24,
  speed = 1.8,
  scale = 1,
  showLabel = false,
}: {
  skinId?: string;
  headColor?: string;
  bodyColor?: string;
  width?: number;
  height?: number;
  segments?: number;
  speed?: number;
  scale?: number;
  showLabel?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    // Mouse tracking
    const onMove = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) * (width / rect.width),
        y: (e.clientY - rect.top) * (height / rect.height),
      };
    };
    const onLeave = () => { mouseRef.current = null; };
    c.addEventListener('mousemove', onMove);
    c.addEventListener('mouseleave', onLeave);

    // Snake state
    let headX = width * 0.5;
    let headY = height * 0.5;
    let angle = 0;
    let targetAngle = 0;
    let turnTimer = 0;
    let nextTurn = 2000;

    const bufLen = segments * 6;
    const bx = new Float64Array(bufLen);
    const by = new Float64Array(bufLen);
    let bufCount = 0;

    // Get skin colors — prefer direct props, fallback to registry
    let headColor = headColorProp ?? '#22c55e';
    let bodyColor = bodyColorProp ?? '#16a34a';
    if (!headColorProp && !bodyColorProp && skinId) {
      try {
        const asset = getSkinAsset(skinId);
        headColor = asset.headColor;
        bodyColor = asset.bodyColor;
      } catch { /* defaults */ }
    }

    const segR = G.segR * scale;
    const hr = segR * G.headScale;
    const wallM = Math.max(segR + 5, Math.min(width, height) * 0.3);

    let running = true;
    const loop = () => {
      if (!running) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ── Movement ──
      turnTimer += 16;
      if (turnTimer > nextTurn) {
        targetAngle = angle + (Math.random() - 0.5) * 1.8;
        turnTimer = 0;
        nextTurn = 1500 + Math.random() * 2000;
      }
      let diff = targetAngle - angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      angle += diff * 0.04;

      headX += Math.cos(angle) * speed;
      headY += Math.sin(angle) * speed;

      // Bounce
      if (headX < wallM) { targetAngle = 0; headX = wallM; }
      if (headX > width - wallM) { targetAngle = Math.PI; headX = width - wallM; }
      if (headY < wallM) { targetAngle = Math.PI / 2; headY = wallM; }
      if (headY > height - wallM) { targetAngle = -Math.PI / 2; headY = height - wallM; }

      // Buffer
      for (let i = Math.min(bufCount, bufLen - 1); i > 0; i--) {
        bx[i] = bx[i - 1];
        by[i] = by[i - 1];
      }
      bx[0] = headX;
      by[0] = headY;
      bufCount = Math.min(bufCount + 1, bufLen);

      // Build segments
      const segs: { x: number; y: number; a: number }[] = [];
      let cx = headX, cy = headY, srcIdx = 0;
      segs.push({ x: cx, y: cy, a: angle });

      for (let s = 1; s < segments && srcIdx < bufCount - 1; s++) {
        let rem = G.step;
        while (rem > 0 && srcIdx < bufCount - 1) {
          const dx = bx[srcIdx + 1] - bx[srcIdx];
          const dy = by[srcIdx + 1] - by[srcIdx];
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) { srcIdx++; continue; }
          if (len >= rem) {
            cx = bx[srcIdx] + (dx / len) * rem;
            cy = by[srcIdx] + (dy / len) * rem;
            bx[srcIdx] = cx; by[srcIdx] = cy;
            rem = 0;
          } else {
            cx = bx[srcIdx + 1]; cy = by[srcIdx + 1];
            rem -= len; srcIdx++;
          }
        }
        const prev = segs[segs.length - 1];
        segs.push({ x: cx, y: cy, a: Math.atan2(cy - prev.y, cx - prev.x) });
      }

      // ── Draw ──
      ctx.clearRect(0, 0, width, height);

      // Background
      const bg = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.6);
      bg.addColorStop(0, '#111118');
      bg.addColorStop(1, '#0a0a0f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
      }

      // Body
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = segR * G.shadowBlur;
      ctx.shadowOffsetY = segR * G.shadowOffY;
      for (let i = segs.length - 1; i >= 1; i--) {
        const p = segs[i];
        const grad = ctx.createRadialGradient(p.x - segR * 0.3, p.y - segR * 0.3, segR * 0.1, p.x, p.y, segR);
        grad.addColorStop(0, lightenHex(bodyColor, G.lighten));
        grad.addColorStop(G.lightenStop, bodyColor);
        grad.addColorStop(1, darkenHex(bodyColor, G.darken));
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(p.x, p.y, segR, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Head
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = hr * G.shadowBlur;
      ctx.shadowOffsetY = hr * G.shadowOffY;
      const hg = ctx.createRadialGradient(headX - hr * 0.3, headY - hr * 0.3, hr * 0.05, headX, headY, hr);
      hg.addColorStop(0, lightenHex(headColor, G.lighten));
      hg.addColorStop(G.lightenStop, headColor);
      hg.addColorStop(1, darkenHex(headColor, G.darken));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(headX, headY, hr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Eyes
      const eyeOff = hr * G.eyeOff;
      const eyeR = hr * G.eyeR;
      const pupR = eyeR * G.pupR;
      const fwd = hr * G.eyeFwd;
      const perp = angle + Math.PI / 2;

      let lookA = angle;
      const m = mouseRef.current;
      if (m) {
        const dx = m.x - headX, dy = m.y - headY;
        if (Math.sqrt(dx * dx + dy * dy) > 5) lookA = Math.atan2(dy, dx);
      }

      for (const side of [-1, 1]) {
        const ex = headX + Math.cos(angle) * fwd + Math.cos(perp) * eyeOff * side;
        const ey = headY + Math.sin(angle) * fwd + Math.sin(perp) * eyeOff * side;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = G.eyeBorder;
        ctx.lineWidth = G.eyeBorderW;
        ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        const shift = eyeR * G.pupShift;
        const ppx = ex + Math.cos(lookA) * shift;
        const ppy = ey + Math.sin(lookA) * shift;
        ctx.fillStyle = '#111111';
        ctx.beginPath(); ctx.arc(ppx, ppy, pupR, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${G.highlight})`;
        ctx.beginPath(); ctx.arc(ppx - pupR * 0.3, ppy - pupR * 0.35, pupR * 0.3, 0, Math.PI * 2); ctx.fill();
      }

      // Direction pointer
      const ptrS = hr * 1.1, ptrL = hr * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(headX + Math.cos(angle) * ptrS, headY + Math.sin(angle) * ptrS);
      ctx.lineTo(headX + Math.cos(angle) * (ptrS + ptrL), headY + Math.sin(angle) * (ptrS + ptrL));
      ctx.stroke();

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      c.removeEventListener('mousemove', onMove);
      c.removeEventListener('mouseleave', onLeave);
    };
  }, [skinId, headColorProp, bodyColorProp, width, height, segments, speed, scale]);

  // Get skin name for label
  let skinName = '';
  if (showLabel && skinId) {
    try {
      const asset = getSkinAsset(skinId);
      skinName = asset.name;
    } catch { /* no name */ }
  }

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded-lg border border-white/10 w-full max-w-full"
      />
      {showLabel && skinName && (
        <span className="text-[9px] text-slate-500 mt-1 truncate max-w-full text-center leading-tight">
          {skinName}
        </span>
      )}
    </div>
  );
}
