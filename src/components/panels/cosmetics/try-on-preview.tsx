'use client';

import { useEffect, useRef } from 'react';
import type { BodyStyle, SegShape, TaperStyle } from './cosmetics-types';
import { resolveShapeStyle } from './cosmetics-utils';

// ---------------------------------------------------------------------------
// 2. INTERACTIVE TRY-ON PLAYGROUND (steer with mouse)
// ---------------------------------------------------------------------------
interface TryOnPreviewProps {
  colors: string[];
  shapeStyle: BodyStyle;
  taperStyle: TaperStyle;
  glow: boolean;
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
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
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

      if (dist > 3) {
        const speed = isHovered.current ? 4.8 : 3.4;
        const angle = Math.atan2(dy, dx);
        headX += Math.cos(angle) * speed;
        headY += Math.sin(angle) * speed;
      }

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
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.beginPath();
        ctx.arc(mousePos.current.x, mousePos.current.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Body segments
      for (let i = points.length - 1; i >= 1; i--) {
        const pt = points[i];
        const prevPt = points[i - 1] || pt;
        const segAngle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x);
        const perpAngle = segAngle + Math.PI / 2;

        const sizeRatio = 1 - (i / points.length) * 0.45;
        const color = colors[i % colors.length] || '#ffffff';

        const shape: SegShape = resolveShapeStyle(shapeStyle, i);

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

        const r = 10 * sizeRatio * sizeScale;

        ctx.save();
        if (glow) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = color;
        }
        ctx.fillStyle = color;

        ctx.beginPath();
        if (shape === 'circle') {
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (shape === 'square') {
          ctx.fillRect(pt.x - r, pt.y - r, r * 2, r * 2);
        } else if (shape === 'diamond') {
          ctx.moveTo(pt.x, pt.y - r);
          ctx.lineTo(pt.x + r, pt.y);
          ctx.lineTo(pt.x, pt.y + r);
          ctx.lineTo(pt.x - r, pt.y);
          ctx.closePath();
          ctx.fill();
        } else if (shape === 'spike') {
          const spikeAngle = segAngle + Math.PI;
          ctx.moveTo(
            pt.x + Math.cos(segAngle) * r * 1.35,
            pt.y + Math.sin(segAngle) * r * 1.35,
          );
          ctx.lineTo(
            pt.x + Math.cos(perpAngle) * r * 0.95,
            pt.y + Math.sin(perpAngle) * r * 0.95,
          );
          ctx.lineTo(
            pt.x + Math.cos(spikeAngle) * r * 0.4,
            pt.y + Math.sin(spikeAngle) * r * 0.4,
          );
          ctx.lineTo(
            pt.x + Math.cos(perpAngle - Math.PI) * r * 0.95,
            pt.y + Math.sin(perpAngle - Math.PI) * r * 0.95,
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Head
      const head = points[0];
      const headColor = colors[0] || '#ffffff';
      ctx.save();
      if (glow) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = headColor;
      }
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Forked tongue
      if (Math.sin(Date.now() * 0.012) > 0.45) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const nextPt = points[1] || head;
        const headAngle = Math.atan2(head.y - nextPt.y, head.x - nextPt.x);
        const startX = head.x + Math.cos(headAngle) * 12;
        const startY = head.y + Math.sin(headAngle) * 12;
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

      // Eyes
      const nextPt = points[1] || head;
      const headAngle = Math.atan2(head.y - nextPt.y, head.x - nextPt.x);
      const eyeL = {
        x: head.x + Math.cos(headAngle + 0.45) * 6,
        y: head.y + Math.sin(headAngle + 0.45) * 6,
      };
      const eyeR = {
        x: head.x + Math.cos(headAngle - 0.45) * 6,
        y: head.y + Math.sin(headAngle - 0.45) * 6,
      };

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeL.x, eyeL.y, 2.8, 0, Math.PI * 2);
      ctx.arc(eyeR.x, eyeR.y, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(
        eyeL.x + Math.cos(headAngle) * 0.8,
        eyeL.y + Math.sin(headAngle) * 0.8,
        1.4,
        0,
        Math.PI * 2,
      );
      ctx.arc(
        eyeR.x + Math.cos(headAngle) * 0.8,
        eyeR.y + Math.sin(headAngle) * 0.8,
        1.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();

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
