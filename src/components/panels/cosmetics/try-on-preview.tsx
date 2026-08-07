'use client';

import { useEffect, useRef } from 'react';
import type { BodyStyle, TaperStyle } from './cosmetics-types';
import { drawSegmentShape, resolveShapeStyle, lightenHex, darkenHex } from './cosmetics-utils';

// ---------------------------------------------------------------------------
// INTERACTIVE TRY-ON PLAYGROUND (steer with mouse)
// Uses the SAME 3D gradient circles and eyes as the in-game renderer.
// Circular pupil tracking + asymmetric lerp + smooth turning (matching game).
// ---------------------------------------------------------------------------
interface TryOnPreviewProps {
  colors: string[];
  shapeStyle: BodyStyle;
  taperStyle: TaperStyle;
  glow: boolean;
}

// Smooth pupil state
interface PupilSmooth {
  shiftX: number;
  shiftY: number;
}

export function TryOnPreview({
  colors,
  shapeStyle,
  taperStyle,
  glow,
}: TryOnPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePos = useRef({ x: 220, y: 100 });
  const isHovered = useRef(false);
  const pupilRef = useRef<PupilSmooth | null>(null);
  const prevAngleRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let time = 0;

    const numPoints = 26;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < numPoints; i++) points.push({ x: 220, y: 100 });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = 450 / rect.width;
      const scaleY = 180 / rect.height;
      mousePos.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };
    const handleMouseEnter = () => {
      isHovered.current = true;
    };
    const handleMouseLeave = () => {
      isHovered.current = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let headX = 220;
    let headY = 100;
    let headAngle = 0;
    prevAngleRef.current = 0;
    pupilRef.current = null;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.045;

      let targetX = canvas.width / 2 + Math.cos(time * 0.9) * 120;
      let targetY = canvas.height / 2 + Math.sin(time * 1.6) * 45;

      if (isHovered.current) {
        targetX = mousePos.current.x;
        targetY = mousePos.current.y;
      }

      const dx = targetX - headX;
      const dy = targetY - headY;
      const dist = Math.hypot(dx, dy);

      // Smooth turning with clamped turn rate (matching game feel)
      const maxTurn = Math.PI * 0.025;
      if (dist > 3) {
        const speed = isHovered.current ? 4.8 : 3.4;
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - headAngle;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        if (Math.abs(diff) <= maxTurn) headAngle = targetAngle;
        else headAngle += Math.sign(diff) * maxTurn;
        headX += Math.cos(headAngle) * speed;
        headY += Math.sin(headAngle) * speed;
      }

      // Angular velocity for pupil tracking
      const angVel = headAngle - prevAngleRef.current;
      prevAngleRef.current = headAngle;

      points.unshift({ x: headX, y: headY });
      if (points.length > numPoints) points.pop();

      // Grid scanlines
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Mouse radar ring
      if (isHovered.current) {
        const scaleX = canvas.width / canvas.getBoundingClientRect().width;
        const scaleY = canvas.height / canvas.getBoundingClientRect().height;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.beginPath();
        ctx.arc(mousePos.current.x, mousePos.current.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Body segments — GAME-ACCURATE 3D gradient with shapes/taper/glow
      for (let i = points.length - 1; i >= 1; i--) {
        const pt = points[i];
        const prevPt = points[i - 1] || pt;
        const segAngle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x);

        const color = colors[i % colors.length] || '#ffffff';

        let sizeScale = 1.0;
        if (taperStyle === 'uniform') {
          sizeScale = 1.0;
        } else if (taperStyle === 'natural') {
          sizeScale = Math.max(0.65, 1.25 - (i / points.length) * 0.55);
        } else if (taperStyle === 'wave') {
          sizeScale = 1.0 + Math.sin(i * 0.95) * 0.22;
        } else if (taperStyle === 'heavy') {
          sizeScale = Math.max(0.55, 1.35 - (i / points.length) * 0.8);
        }

        const r = 10 * sizeScale;

        drawSegmentShape(ctx, pt.x, pt.y, r, segAngle, resolveShapeStyle(shapeStyle, i), color, glow);
      }

      // Head — GAME-ACCURATE with 3D gradient and 1.3x scale
      const head = points[0];
      const nextPt = points[1] || head;
      const headCol = colors[0] || '#ffffff';
      const headR = 12;

      ctx.save();
      if (glow) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = headCol;
      }

      // 3D head gradient (same as atlas head rendering)
      const headGrad = ctx.createRadialGradient(
        head.x - headR * 0.3, head.y - headR * 0.3, headR * 0.1,
        head.x, head.y, headR,
      );
      headGrad.addColorStop(0, lightenHex(headCol, 0.35));
      headGrad.addColorStop(0.6, headCol);
      headGrad.addColorStop(1, darkenHex(headCol, 0.3));
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Forked tongue
      if (Math.sin(Date.now() * 0.012) > 0.45) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const startX = head.x + Math.cos(headAngle) * headR;
        const startY = head.y + Math.sin(headAngle) * headR;
        const endX = startX + Math.cos(headAngle) * 8;
        const endY = startY + Math.sin(headAngle) * 8;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(
          endX + Math.cos(headAngle + 0.45) * 5,
          endY + Math.sin(headAngle + 0.45) * 5,
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX + Math.cos(headAngle - 0.45) * 5,
          endY + Math.sin(headAngle - 0.45) * 5,
        );
        ctx.stroke();
        ctx.restore();
      }

      // Eyes — circular pupil tracking with asymmetric lerp
      const eyeForward = headR * 0.3;
      const eyeOffset = headR * 0.45;
      const eyeR = headR * 0.28;
      const pupilR = eyeR * 0.55;
      const maxShift = eyeR * 0.7;
      const perpAngle = headAngle + Math.PI / 2;

      // Compute target pupil shift (circular 360°)
      let targetShiftX = 0, targetShiftY = 0;
      if (isHovered.current) {
        const mdx = mousePos.current.x - head.x;
        const mdy = mousePos.current.y - head.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist > 5) {
          const rawLook = Math.atan2(mdy, mdx);
          let deltaA = rawLook - headAngle;
          while (deltaA > Math.PI) deltaA -= 2 * Math.PI;
          while (deltaA < -Math.PI) deltaA += 2 * Math.PI;
          const absD = Math.abs(deltaA);
          const DZ = 0.12, FZ = 0.45;
          const sr = absD < DZ ? 0 : absD < FZ ? (absD - DZ) / (FZ - DZ) : 1;
          // Combine with angular velocity
          const angVelC = Math.min(1, Math.abs(angVel) / 0.018);
          const combined = Math.min(1, Math.max(sr, angVelC * 0.75));
          const lookDir = Math.abs(deltaA) < 0.06 ? headAngle : rawLook;
          targetShiftX = Math.cos(lookDir) * maxShift * combined;
          targetShiftY = Math.sin(lookDir) * maxShift * combined;
        }
      }
      // Angular velocity shift during turns (auto-pilot or steering)
      if (!isHovered.current || Math.abs(angVel) > 0.005) {
        // Use movement direction as targetAngle proxy
        const moveDir = dist > 3 ? Math.atan2(targetY - headY, targetX - headX) : headAngle;
        const angVelC = Math.min(1, Math.abs(angVel) / 0.018);
        const turnShiftX = Math.cos(moveDir) * maxShift * angVelC * 0.75;
        const turnShiftY = Math.sin(moveDir) * maxShift * angVelC * 0.75;
        const curDist = Math.sqrt(targetShiftX * targetShiftX + targetShiftY * targetShiftY);
        const turnDist = Math.sqrt(turnShiftX * turnShiftX + turnShiftY * turnShiftY);
        if (turnDist > curDist) { targetShiftX = turnShiftX; targetShiftY = turnShiftY; }
      }

      // Asymmetric lerp
      if (!pupilRef.current) pupilRef.current = { shiftX: 0, shiftY: 0 };
      const ps = pupilRef.current;
      const targetDist = Math.sqrt(targetShiftX * targetShiftX + targetShiftY * targetShiftY);
      const currentDist = Math.sqrt(ps.shiftX * ps.shiftX + ps.shiftY * ps.shiftY);
      const isReturning = targetDist < currentDist;
      const LERP_OUT = 0.10, LERP_BACK = 0.03;
      const lerpSpeed = isReturning ? LERP_BACK : LERP_OUT;
      if (targetDist < 0.1 && currentDist < 0.1) {
        ps.shiftX *= 0.97;
        ps.shiftY *= 0.97;
      } else {
        ps.shiftX += (targetShiftX - ps.shiftX) * lerpSpeed;
        ps.shiftY += (targetShiftY - ps.shiftY) * lerpSpeed;
      }

      for (const side of [-1, 1]) {
        const ex = head.x + Math.cos(headAngle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
        const ey = head.y + Math.sin(headAngle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;

        // Eye white with border (same as in-game)
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pupil (smooth shift)
        const ppx = ex + ps.shiftX;
        const ppy = ey + ps.shiftY;
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(ppx, ppy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Tiny highlight (same as in-game)
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(ppx - pupilR * 0.3, ppy - pupilR * 0.35, pupilR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [colors, shapeStyle, taperStyle, glow]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-slate-950 p-1 shadow-2xl">
      <div className="absolute top-2 left-3 flex items-center gap-1.5 z-10 bg-slate-900/90 px-2 py-0.5 rounded border border-indigo-500/20 pointer-events-none select-none">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="text-[9px] text-indigo-300 font-mono font-bold uppercase tracking-wider">
          LAB HOLO-PREVIEW (STEER TO TEST)
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={450}
        height={180}
        className="block max-w-full h-[180px] w-full bg-slate-950/90 rounded-xl cursor-crosshair border border-slate-900 shadow-inner"
      />
    </div>
  );
}
