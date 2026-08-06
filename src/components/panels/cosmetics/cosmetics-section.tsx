'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import { SNAKE_RADIUS, CAMERA_BASE_ZOOM } from '@/lib/snake/config';
import { getSkinAsset } from '@/lib/snake/skin-registry';
import {
  FACE_COSMETICS,
  getCosmeticsBySlot,
  getCosmeticById,
  SLOT_INFO,
  readEquippedCosmetics,
  renderEquippedCosmetics,
  writeEquippedCosmetics,
  type CosmeticSlot,
  type EquippedCosmetics,
  type CosmeticRarity,
} from '@/lib/snake/face-cosmetics';

// Slots that have actual equippable face cosmetics (flag & banner are server-side)
const EQUIPPABLE_SLOTS: CosmeticSlot[] = ['eyes', 'mouth', 'ears', 'wings', 'nose', 'hat', 'goggles', 'flag'];
const ALL_SLOTS: CosmeticSlot[] = ['eyes', 'mouth', 'ears', 'wings', 'nose', 'hat', 'goggles', 'flag', 'banner'];

const RARITY_STYLES: Record<CosmeticRarity, string> = {
  common: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  rare: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  epic: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  legendary: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

// ─── Color helpers (exact copy from snake-face-tester.tsx) ────────────

function lightenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `#${Math.round(r + (255 - r) * factor).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * factor).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * factor).toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `#${Math.round(r * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(g * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(b * (1 - factor)).toString(16).padStart(2, '0')}`;
}

// ─── Game rendering params (exact copy from snake-face-tester.tsx) ────

const GAME = {
  segRadius: SNAKE_RADIUS * CAMERA_BASE_ZOOM,
  headScale: 1.3,
  segStep: 14,
  lightenFactor: 0.35,
  lightenStop: 0.55,
  darkenFactor: 0.35,
  eyeRadiusRatio: 0.38,
  eyeOffsetRatio: 0.42,
  eyeForwardRatio: 0.32,
  pupilRadiusRatio: 0.52,
  pupilShiftRatio: 0.7,
  eyeBorderWidth: 1.5,
  eyeBorderColor: 'rgba(0,0,0,0.5)',
  highlightOpacity: 0.8,
  shadowBlurRatio: 0.8,
  shadowOffsetYRatio: 0.3,
};

// ─── Canvas preview — exact same code as SnakeFaceTester ─────────────

function TesterCanvas({ skinId }: { skinId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  const W = 580;
  const H = 260;
  const SEGMENTS = 24;
  const SPEED = 1.8;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    // Mouse tracking on canvas
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
    };
    const onLeave = () => { mouseRef.current = null; };
    c.addEventListener('mousemove', onMove);
    c.addEventListener('mouseleave', onLeave);

    // Snake state
    let headX = W * 0.5;
    let headY = H * 0.5;
    let angle = 0;
    let targetAngle = 0;
    let turnTimer = 0;
    let nextTurn = 2000;

    // Position buffer
    const bufLen = SEGMENTS * 6;
    const px = new Float64Array(bufLen);
    const py = new Float64Array(bufLen);
    let bufCount = 0;

    let running = true;
    const loop = () => {
      if (!running) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ── Update movement ──
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

      headX += Math.cos(angle) * SPEED;
      headY += Math.sin(angle) * SPEED;

      // Bounce off walls
      const wallM = 70;
      if (headX < wallM) { targetAngle = 0; headX = wallM; }
      if (headX > W - wallM) { targetAngle = Math.PI; headX = W - wallM; }
      if (headY < wallM) { targetAngle = Math.PI / 2; headY = wallM; }
      if (headY > H - wallM) { targetAngle = -Math.PI / 2; headY = H - wallM; }

      // Prepend to buffer
      for (let i = Math.min(bufCount, bufLen - 1); i > 0; i--) {
        px[i] = px[i - 1];
        py[i] = py[i - 1];
      }
      px[0] = headX;
      py[0] = headY;
      bufCount = Math.min(bufCount + 1, bufLen);

      // ── Build segment positions from buffer ──
      const segs: { x: number; y: number; a: number }[] = [];
      let cx = headX, cy = headY;
      let srcIdx = 0;
      segs.push({ x: cx, y: cy, a: angle });

      for (let s = 1; s < SEGMENTS && srcIdx < bufCount - 1; s++) {
        let remaining = GAME.segStep;
        while (remaining > 0 && srcIdx < bufCount - 1) {
          const dx = px[srcIdx + 1] - px[srcIdx];
          const dy = py[srcIdx + 1] - py[srcIdx];
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) { srcIdx++; continue; }
          if (len >= remaining) {
            cx = px[srcIdx] + (dx / len) * remaining;
            cy = py[srcIdx] + (dy / len) * remaining;
            px[srcIdx] = cx;
            py[srcIdx] = cy;
            remaining = 0;
          } else {
            cx = px[srcIdx + 1];
            cy = py[srcIdx + 1];
            remaining -= len;
            srcIdx++;
          }
        }
        const prev = segs[segs.length - 1];
        segs.push({ x: cx, y: cy, a: Math.atan2(cy - prev.y, cx - prev.x) });
      }

      // ── Draw ──
      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
      bg.addColorStop(0, '#111118');
      bg.addColorStop(1, '#0a0a0f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // Get skin
      let headColor = '#22c55e';
      let bodyColor = '#16a34a';
      try {
        const asset = getSkinAsset(skinId);
        headColor = asset.headColor;
        bodyColor = asset.bodyColor;
      } catch { /* defaults */ }

      const segR = GAME.segRadius;
      const hr = segR * GAME.headScale;

      // Body shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = segR * GAME.shadowBlurRatio;
      ctx.shadowOffsetY = segR * GAME.shadowOffsetYRatio;

      for (let i = segs.length - 1; i >= 1; i--) {
        const p = segs[i];
        const grad = ctx.createRadialGradient(
          p.x - segR * 0.3, p.y - segR * 0.3, segR * 0.1,
          p.x, p.y, segR,
        );
        grad.addColorStop(0, lightenHex(bodyColor, GAME.lightenFactor));
        grad.addColorStop(GAME.lightenStop, bodyColor);
        grad.addColorStop(1, darkenHex(bodyColor, GAME.darkenFactor));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, segR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Head shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = hr * GAME.shadowBlurRatio;
      ctx.shadowOffsetY = hr * GAME.shadowOffsetYRatio;

      const hg = ctx.createRadialGradient(
        headX - hr * 0.3, headY - hr * 0.3, hr * 0.05,
        headX, headY, hr,
      );
      hg.addColorStop(0, lightenHex(headColor, GAME.lightenFactor));
      hg.addColorStop(GAME.lightenStop, headColor);
      hg.addColorStop(1, darkenHex(headColor, GAME.darkenFactor));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(headX, headY, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Responsive eyes (always drawn — cosmetic eyes paint over if equipped)
      const eyeOff = hr * GAME.eyeOffsetRatio;
      const eyeR = hr * GAME.eyeRadiusRatio;
      const pupilR = eyeR * GAME.pupilRadiusRatio;
      const fwd = hr * GAME.eyeForwardRatio;
      const perp = angle + Math.PI / 2;

      let lookA = angle;
      const m = mouseRef.current;
      if (m) {
        const dx = m.x - headX;
        const dy = m.y - headY;
        if (Math.sqrt(dx * dx + dy * dy) > 5) lookA = Math.atan2(dy, dx);
      }

      for (const side of [-1, 1]) {
        const ex = headX + Math.cos(angle) * fwd + Math.cos(perp) * eyeOff * side;
        const ey = headY + Math.sin(angle) * fwd + Math.sin(perp) * eyeOff * side;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = GAME.eyeBorderColor;
        ctx.lineWidth = GAME.eyeBorderWidth;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        const shift = eyeR * GAME.pupilShiftRatio;
        const ppx = ex + Math.cos(lookA) * shift;
        const ppy = ey + Math.sin(lookA) * shift;
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(ppx, ppy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${GAME.highlightOpacity})`;
        ctx.beginPath();
        ctx.arc(ppx - pupilR * 0.3, ppy - pupilR * 0.35, pupilR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Other face cosmetics (mouth, ears, hat, goggles, wings, etc.)
      // Eyes slot is 'none' by default so no double-draw
      renderEquippedCosmetics(ctx, {
        hx: headX, hy: headY, hr, angle,
        time: performance.now(), boosting: false,
      });

      // Direction pointer
      const ptrS = hr * 1.1;
      const ptrL = hr * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
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
  }, [skinId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${W}px`, height: `${H}px` }}
      className="rounded-lg cursor-crosshair border border-white/10 w-full max-w-full"
    />
  );
}

// ─── Cosmetics Section ────────────────────────────────────────────────

export function CosmeticsSection({
  onToast,
  activeSkinId = 'skin-default',
}: {
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  activeSkinId?: string;
}) {
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>('eyes');
  const [equipped, setEquipped] = useState<EquippedCosmetics>(
    readEquippedCosmetics(),
  );

  const handleEquip = useCallback(
    (cosmeticId: string, slot: CosmeticSlot) => {
      if (equipped[slot as keyof EquippedCosmetics] === cosmeticId) {
        onToast?.('Already equipped!', 'info');
        return;
      }

      const cosmetic = getCosmeticById(cosmeticId);
      if (!cosmetic) return;

      if (cosmetic.cost === 0) {
        const next: EquippedCosmetics = {
          ...equipped,
          [slot]: cosmeticId,
        };
        writeEquippedCosmetics(next);
        setEquipped(next);
        onToast?.(`\u2705 ${cosmetic.name} equipped!`, 'success');
      } else {
        onToast?.(
          'Available in future update \u2014 coming soon!',
          'info',
        );
      }
    },
    [equipped, onToast],
  );

  const slotCosmetics = getCosmeticsBySlot(activeSlot);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <TesterCanvas key={activeSkinId} skinId={activeSkinId} />
      </div>

      {/* Slot sub-tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {ALL_SLOTS.map((slot) => {
          const info = SLOT_INFO[slot];
          const isActive = activeSlot === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => setActiveSlot(slot)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {info.emoji} {info.label}
            </button>
          );
        })}
      </div>

      {/* Cosmetics card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slotCosmetics.map((cosmetic) => {
            const isEquipped =
              equipped[activeSlot as keyof EquippedCosmetics] === cosmetic.id;
            const isFree = cosmetic.cost === 0;

            return (
              <button
                key={cosmetic.id}
                type="button"
                onClick={() => handleEquip(cosmetic.id, cosmetic.slot)}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-left transition-all cursor-pointer hover:border-slate-600/60 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-black/20 group"
              >
                <div className="flex items-center justify-center text-4xl mb-3 group-hover:scale-110 transition-transform">
                  {cosmetic.emoji}
                </div>

                <h4 className="text-xs font-bold text-white font-sans mb-1.5">
                  {cosmetic.name}
                </h4>

                <span
                  className={`inline-block text-[9px] font-semibold border rounded-full px-2 py-0.5 mb-2 font-sans uppercase tracking-wide ${RARITY_STYLES[cosmetic.rarity]}`}
                >
                  {cosmetic.rarity}
                </span>

                <p className="text-[10px] text-slate-400 font-sans leading-relaxed mb-3">
                  {cosmetic.description}
                </p>

                <div className="mt-auto">
                  {isEquipped ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                      <Check className="w-3 h-3" /> Equipped
                    </span>
                  ) : isFree ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-200 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 group-hover:bg-slate-700 transition-colors">
                      <Sparkles className="w-3 h-3" /> Free
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1">
                      <Lock className="w-3 h-3" /> {cosmetic.cost} Chips
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
    </div>
  );
}
