'use client';

import { useEffect, useRef } from 'react';
import type { BodyStyle, SegShape } from './cosmetics-types';
import { resolveShapeStyle } from './cosmetics-utils';

// ---------------------------------------------------------------------------
// 1. REUSABLE REAL-TIME 60FPS SLITHERING SKIN PREVIEW
// ---------------------------------------------------------------------------
interface SkinsCanvasPreviewProps {
  colors: string[];
  pattern?: string;
  shapeStyle?: BodyStyle;
  glow?: boolean;
}

export function SkinsCanvasPreview({
  colors,
  pattern,
  shapeStyle = 'smooth',
  glow = false,
}: SkinsCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let time = Math.random() * 100;

    const numSegments = 10;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < numSegments; i++) points.push({ x: 0, y: 0 });

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.07;

      // Grid background
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 15; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let i = 0; i < numSegments; i++) {
        const x = canvas.width - 24 - (i * (canvas.width - 48)) / (numSegments - 1);
        const wiggleVal = Math.sin(time - i * 0.42) * 9;
        const y = canvas.height / 2 + wiggleVal;
        points[i] = { x, y };
      }

      // ── Body spine line (fills gaps between segments) ──
      if (points.length > 1) {
        ctx.save();
        ctx.strokeStyle = colors[0] || '#ffffff';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
        for (let i = points.length - 2; i >= 0; i--) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw trailing segment shadows & nodes from tail to head
      for (let i = points.length - 1; i >= 1; i--) {
        const pt = points[i];
        const nextPt = points[i - 1] || pt;
        const segAngle = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x);

        let fillColor = colors[i % colors.length] || '#ffffff';
        // Glow disabled in preview — glow only renders in-game while boosting
        let segmentGlow = false;

        if (pattern === 'rainbow') {
          const hue = (Date.now() * 0.06 + i * 36) % 360;
          fillColor = `hsl(${hue}, 85%, 55%)`;
        } else if (pattern === 'neon') {
          fillColor = i % 2 === 0 ? '#06b6d4' : '#a855f7';
        } else if (pattern === 'metallic') {
          fillColor = i % 2 === 0 ? '#cbd5e1' : '#475569';
        } else if (pattern === 'camo') {
          fillColor = i % 2 === 0 ? '#15803d' : '#854d0e';
        }

        const sizeRatio = 1 - (i / points.length) * 0.42;
        const r = 6 * sizeRatio;

        ctx.save();
        if (segmentGlow) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = fillColor;
        }
        ctx.fillStyle = fillColor;

        const segmentShape: SegShape = resolveShapeStyle(shapeStyle, i);

        ctx.beginPath();
        if (segmentShape === 'circle') {
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (segmentShape === 'square') {
          ctx.fillRect(pt.x - r, pt.y - r, r * 2, r * 2);
        } else if (segmentShape === 'diamond') {
          ctx.moveTo(pt.x, pt.y - r);
          ctx.lineTo(pt.x + r, pt.y);
          ctx.lineTo(pt.x, pt.y + r);
          ctx.lineTo(pt.x - r, pt.y);
          ctx.closePath();
          ctx.fill();
        } else if (segmentShape === 'spike') {
          const perpAngle = segAngle + Math.PI / 2;
          ctx.moveTo(
            pt.x + Math.cos(segAngle) * r * 1.3,
            pt.y + Math.sin(segAngle) * r * 1.3,
          );
          ctx.lineTo(
            pt.x + Math.cos(perpAngle) * r * 0.8,
            pt.y + Math.sin(perpAngle) * r * 0.8,
          );
          ctx.lineTo(
            pt.x - Math.cos(segAngle) * r * 0.3,
            pt.y - Math.sin(segAngle) * r * 0.3,
          );
          ctx.lineTo(
            pt.x - Math.cos(perpAngle) * r * 0.8,
            pt.y - Math.sin(perpAngle) * r * 0.8,
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Head
      const head = points[0];
      const prevPt = points[1] || head;
      const headAngle = Math.atan2(head.y - prevPt.y, head.x - prevPt.x);

      let headColor = colors[0] || '#ffffff';
      if (pattern === 'rainbow') {
        const hue = (Date.now() * 0.06) % 360;
        headColor = `hsl(${hue}, 85%, 55%)`;
      } else if (pattern === 'neon') {
        headColor = '#06b6d4';
      }

      ctx.save();
      ctx.fillStyle = headColor;
      // Glow disabled in preview — glow only renders in-game while boosting
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Eyes
      const eyeL_Angle = headAngle + 0.52;
      const eyeR_Angle = headAngle - 0.52;
      const eyeL_Pos = {
        x: head.x + Math.cos(eyeL_Angle) * 3.8,
        y: head.y + Math.sin(eyeL_Angle) * 3.8,
      };
      const eyeR_Pos = {
        x: head.x + Math.cos(eyeR_Angle) * 3.8,
        y: head.y + Math.sin(eyeR_Angle) * 3.8,
      };

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeL_Pos.x, eyeL_Pos.y, 2, 0, Math.PI * 2);
      ctx.arc(eyeR_Pos.x, eyeR_Pos.y, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(
        eyeL_Pos.x + Math.cos(headAngle) * 0.6,
        eyeL_Pos.y + Math.sin(headAngle) * 0.6,
        1,
        0,
        Math.PI * 2,
      );
      ctx.arc(
        eyeR_Pos.x + Math.cos(headAngle) * 0.6,
        eyeR_Pos.y + Math.sin(headAngle) * 0.6,
        1,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [colors, pattern, shapeStyle, glow]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 p-1 group">
      <canvas
        ref={canvasRef}
        width={180}
        height={80}
        className="block max-w-full h-[80px] w-full"
      />
    </div>
  );
}
