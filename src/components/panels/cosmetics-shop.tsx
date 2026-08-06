'use client';

/**
 * Snake Wardrobe — 4-corner layout.
 *
 * Main view: Scrollable skin list with 4 corner buttons.
 *   Top-left:    Background changer
 *   Top-right:   Select Cosmetics → sub-page
 *   Bottom-right: Build Your Venom → sub-page
 *   Bottom-left:  OK / Skin Applied
 *
 * Cosmetics view: Cosmetic grid + live preview + OK.
 * Venom view:     Interactive painter canvas + palette + save.
 */

import { useState, useCallback } from 'react';
import {
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Brush,
  ImageIcon,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';

import type {
  BodyStyle,
  CustomSkinState,
  TaperStyle,
  SlitherPreset,
} from './cosmetics/cosmetics-types';
import {
  PALETTE_COLORS,
  SLITHER_PRESETS,
} from './cosmetics/cosmetics-types';
import type { CosmeticsShopProps } from './cosmetics/cosmetics-types';
import {
  generateCustomSegments,
  readCustomSkinStateSafe,
  writeCustomSkinState,
} from './cosmetics/cosmetics-utils';
import { SkinsCanvasPreview } from './cosmetics/skins-canvas-preview';
import { CosmeticsSection } from './cosmetics/cosmetics-section';
import { VenomPainter } from './cosmetics/venom-painter';

type WardrobeView = 'main' | 'cosmetics' | 'venom';

// Background presets
const BG_PRESETS = [
  { id: 'default', bg: 'bg-slate-900' },
  { id: 'purple', bg: 'bg-purple-950' },
  { id: 'green', bg: 'bg-emerald-950' },
  { id: 'dark', bg: 'bg-gray-950' },
];

export function CosmeticsShop({ onToast }: CosmeticsShopProps) {
  const { player, loading, refresh } = useAuth();
  const [view, setView] = useState<WardrobeView>('main');
  const [bgId, setBgId] = useState('default');
  const [customState, setCustomState] = useState<CustomSkinState | null>(
    () => readCustomSkinStateSafe(),
  );

  const handleEquipPreset = useCallback(
    (preset: SlitherPreset) => {
      const segments = generateCustomSegments(
        preset.colors,
        preset.shape,
        preset.taper,
        preset.glow,
      );
      const next: CustomSkinState = {
        useCustomSkin: true,
        currentSkin: preset.id,
        customSkinSegments: segments,
      };
      writeCustomSkinState(next);
      setCustomState(next);
      notify(`${preset.emoji} ${preset.name} equipped!`, 'success', onToast);
    },
    [onToast],
  );

  const handleVenomSaved = useCallback(() => {
    setCustomState(readCustomSkinStateSafe());
  }, []);

  if (loading) return <PanelSkeleton count={6} height="h-44" />;
  if (!player) return <NotSignedIn />;

  const isPresetActive = (preset: SlitherPreset) =>
    customState?.useCustomSkin === true &&
    customState.currentSkin === preset.id;

  const isCustomLabActive =
    customState?.useCustomSkin === true &&
    customState.currentSkin === 'custom-lab-skin';

  const currentBg = BG_PRESETS.find((b) => b.id === bgId)?.bg ?? 'bg-slate-900';

  return (
    <div
      className={`${currentBg} border border-slate-800 rounded-2xl shadow-2xl flex flex-col`}
      style={{ maxHeight: '82vh' }}
    >
      {/* ═══════════════════════════════════════════════
          VIEW: MAIN — 4-corner wardrobe
          ═══════════════════════════════════════════════ */}
      {view === 'main' && (
        <div className="flex flex-col h-full relative">
          {/* TOP BAR — BG left, Cosmetics right */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0 z-10">
            {/* BG changer */}
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex gap-1">
                {BG_PRESETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBgId(b.id)}
                    className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                      bgId === b.id
                        ? 'border-white scale-110'
                        : 'border-slate-700 hover:border-slate-400'
                    } ${b.bg}`}
                    title={b.id}
                  />
                ))}
              </div>
            </div>

            {/* Cosmetics button */}
            <button
              type="button"
              onClick={() => setView('cosmetics')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600/15 border border-amber-500/20 text-amber-300 text-xs font-bold transition cursor-pointer hover:bg-amber-600/25"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Cosmetics
            </button>
          </div>

          {/* SCROLLABLE SKIN LIST */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 custom-scrollbar">
            <div className="flex flex-col gap-3">
              {/* Custom lab skin card (if exists) */}
              {customState?.currentSkin === 'custom-lab-skin' && customState.customSkinSegments.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const next: CustomSkinState = {
                      ...customState,
                      useCustomSkin: true,
                      currentSkin: 'custom-lab-skin',
                    };
                    writeCustomSkinState(next);
                    setCustomState(next);
                    notify('Custom venom equipped!', 'success', onToast);
                  }}
                  className={`w-full text-left rounded-2xl border p-3 transition-all cursor-pointer ${
                    isCustomLabActive
                      ? 'bg-purple-600/15 border-purple-500 shadow-lg shadow-purple-950/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🧪</span>
                    <span className={`text-xs font-bold ${isCustomLabActive ? 'text-purple-300' : 'text-slate-300'}`}>
                      My Custom Venom
                    </span>
                    {isCustomLabActive && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 ml-auto" />}
                  </div>
                  <SkinsCanvasPreview
                    colors={customState.customSkinSegments.map((s) => s.color)}
                    shapeStyle={(customState.customSkinSegments[1]?.shape === 'spike' ? 'dragon' : customState.customSkinSegments[1]?.shape === 'square' ? 'armored' : customState.customSkinSegments[1]?.shape === 'diamond' ? 'crystal' : 'smooth') as BodyStyle}
                    glow={customState.customSkinSegments[0]?.glow ?? true}
                  />
                </button>
              )}

              {/* Preset skin cards */}
              {SLITHER_PRESETS.map((preset) => {
                const active = isPresetActive(preset);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleEquipPreset(preset)}
                    className={`w-full text-left rounded-2xl border p-3 transition-all cursor-pointer ${
                      active
                        ? 'bg-purple-600/15 border-purple-500 shadow-lg shadow-purple-950/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{preset.emoji}</span>
                      <span className={`text-xs font-bold ${active ? 'text-purple-300' : 'text-slate-300'}`}>
                        {preset.name}
                      </span>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 ml-auto" />}
                    </div>
                    <SkinsCanvasPreview
                      colors={preset.colors}
                      shapeStyle={preset.shape}
                      glow={preset.glow}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* BOTTOM BAR — OK left, Build Venom right */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0 border-t border-slate-800/60 z-10">
            <button
              type="button"
              onClick={() => notify('Skin applied!', 'success', onToast)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Skin Applied
            </button>

            <button
              type="button"
              onClick={() => setView('venom')}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-2"
            >
              <Brush className="w-4 h-4" />
              Build Your Venom
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          VIEW: COSMETICS — select face items
          ═══════════════════════════════════════════════ */}
      {view === 'cosmetics' && (
        <div className="flex flex-col h-full">
          {/* Top bar with back */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b border-slate-800/60">
            <button
              type="button"
              onClick={() => setView('main')}
              className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white">Select Cosmetics</span>
          </div>

          {/* Scrollable cosmetics section */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4">
              <CosmeticsSection onToast={onToast} />
            </div>
          </div>

          {/* Bottom OK */}
          <div className="flex items-center justify-center px-4 py-3 shrink-0 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => setView('main')}
              className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              OK
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          VIEW: VENOM — build your own snake
          ═══════════════════════════════════════════════ */}
      {view === 'venom' && (
        <div className="flex flex-col h-full">
          {/* Top bar with back */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b border-slate-800/60">
            <button
              type="button"
              onClick={() => setView('main')}
              className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white">Build Your Venom</span>
          </div>

          {/* Scrollable venom painter */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4">
              <VenomPainter onToast={onToast} onSaved={handleVenomSaved} />
            </div>
          </div>

          {/* Bottom OK */}
          <div className="flex items-center justify-center px-4 py-3 shrink-0 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => {
                handleVenomSaved();
                setView('main');
              }}
              className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CosmeticsShop;
