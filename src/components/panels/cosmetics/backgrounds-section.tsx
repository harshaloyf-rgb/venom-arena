'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  BACKGROUND_THEMES,
  drawBackgroundSample,
  type BackgroundTheme,
} from '@/lib/snake/backgrounds';

// ---------------------------------------------------------------------------
// Backgrounds — arena background theme picker (Identity Workshop tab row)
// All 8 themes are free and fully static (zero per-frame animation).
// Swatches render through the SAME painters as gameplay → true WYSIWYG.
// ---------------------------------------------------------------------------

interface BackgroundsSectionProps {
  activeBackground: string;
  onEquip: (backgroundId: string) => void;
}

function BackgroundSwatch({ theme }: { theme: BackgroundTheme }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // Draw once on mount — themes are fully static, no redraws needed.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackgroundSample(ctx, theme, w, h);
  }, [theme]);

  return <canvas ref={ref} className="w-full h-20 lg:h-14 rounded-lg block" style={{ backgroundColor: '#0a0a0f' }} />;
}

export function BackgroundsSection({ activeBackground, onEquip }: BackgroundsSectionProps) {
  return (
    <div className="animate-fade-in">
      {/* Header note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 lg:mb-1">
        <div>
          <h3 className="text-sm lg:text-xs font-bold font-sans text-white flex items-center gap-2">
            Arena Backgrounds
            <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 border border-teal-500/30 rounded px-1.5 py-0.5">
              FREE
            </span>
          </h3>
          <p className="text-xs lg:text-[11px] text-slate-400 font-sans mt-0.5">
            Fully static themes — zero performance cost. Tint the arena floor, boundary ring and minimap accent.
          </p>
        </div>
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-1">
        {BACKGROUND_THEMES.map((theme) => {
          const active = theme.id === activeBackground;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onEquip(theme.id)}
              className={`group relative text-left rounded-xl border p-2 lg:p-1 transition-all cursor-pointer ${
                active
                  ? 'border-teal-500 bg-teal-500/5 shadow-md'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900'
              }`}
            >
              <div className="overflow-hidden rounded-lg border border-slate-950/60">
                <BackgroundSwatch theme={theme} />
              </div>
              <div className="flex items-center justify-between mt-2 lg:mt-1 px-0.5">
                <span className="text-xs lg:text-[11px] font-bold font-sans text-slate-200 truncate">
                  {theme.name}
                </span>
                {active && (
                  <CheckCircle2 className="w-4 h-4 lg:w-3 lg:h-3 text-teal-400 shrink-0" />
                )}
              </div>
              {/* Accent chip — mirrors the theme's boundary/minimap tint */}
              <span
                className="absolute top-3 right-3 lg:top-2 lg:right-2 w-3 h-3 lg:w-2 lg:h-2 rounded-full border border-slate-950/50"
                style={{ backgroundColor: `rgb(${theme.accentRgb})` }}
                title="Boundary ring tint"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
