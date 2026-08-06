'use client';

/**
 * Snake Wardrobe — Simple, clean customization interface.
 *
 * Two tabs: Body (presets + custom creator) and Face (cosmetics).
 * Live preview always visible at top.
 */

import { useState } from 'react';
import { CheckCircle2, Palette, Plus, Trash2, Wand2, ArrowLeftRight } from 'lucide-react';
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
  BODY_STYLE_OPTIONS,
  TAPER_OPTIONS,
} from './cosmetics/cosmetics-types';
import type { CosmeticsShopProps } from './cosmetics/cosmetics-types';
import {
  generateCustomSegments,
  readCustomSkinStateSafe,
  writeCustomSkinState,
} from './cosmetics/cosmetics-utils';
import { TryOnPreview } from './cosmetics/try-on-preview';
import { CosmeticsSection } from './cosmetics/cosmetics-section';

type WardrobeTab = 'body' | 'face';

export function CosmeticsShop({ onToast }: CosmeticsShopProps) {
  const { player, loading, refresh } = useAuth();
  const [tab, setTab] = useState<WardrobeTab>('body');
  const [showCustom, setShowCustom] = useState(false);

  // Custom skin state
  const [customState, setCustomState] = useState<CustomSkinState | null>(
    () => readCustomSkinStateSafe(),
  );
  const [colorSequence, setColorSequence] = useState<string[]>(() => {
    const stored = readCustomSkinStateSafe();
    if (stored?.customSkinSegments?.length) {
      return stored.customSkinSegments.map((s) => s.color);
    }
    return ['#06b6d4', '#a855f7', '#06b6d4', '#a855f7'];
  });
  const [bodyStyle, setBodyStyle] = useState<BodyStyle>(() => {
    const stored = readCustomSkinStateSafe();
    const segs = stored?.customSkinSegments;
    if (segs && segs.length > 0) {
      if (segs.every((s) => s.shape === 'circle')) return 'smooth';
      if (segs.every((s) => s.shape === 'spike')) return 'obsidian';
      if (segs.every((s) => s.shape === 'diamond')) return 'basilisk';
      if (segs.some((s) => s.shape === 'spike')) return 'dragon';
      if (segs.some((s) => s.shape === 'square')) return 'armored';
      if (segs.some((s) => s.shape === 'diamond')) return 'crystal';
    }
    return 'smooth';
  });
  const [taperStyle, setTaperStyle] = useState<TaperStyle>('natural');
  const [glowEnabled, setGlowEnabled] = useState<boolean>(() => {
    const stored = readCustomSkinStateSafe();
    if (stored?.customSkinSegments?.length) {
      return stored.customSkinSegments.some((s) => s.glow);
    }
    return true;
  });

  if (loading) return <PanelSkeleton count={6} height="h-44" />;
  if (!player) return <NotSignedIn />;
  const p = player;

  // ── Helpers ──
  const isPresetActive = (preset: SlitherPreset) =>
    customState?.useCustomSkin === true &&
    customState.currentSkin === preset.id;

  const isCustomLabDeployed =
    customState?.useCustomSkin === true &&
    customState.currentSkin === 'custom-lab-skin';

  // ── Handlers ──
  function handleEquipPreset(preset: SlitherPreset) {
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
  }

  function handleDeployCustomSkin() {
    if (colorSequence.length === 0) {
      notify('Pick at least 1 color first!', 'error', onToast);
      return;
    }
    const segments = generateCustomSegments(
      colorSequence,
      bodyStyle,
      taperStyle,
      glowEnabled,
    );
    const next: CustomSkinState = {
      useCustomSkin: true,
      currentSkin: 'custom-lab-skin',
      customSkinSegments: segments,
    };
    writeCustomSkinState(next);
    setCustomState(next);
    notify('Custom skin deployed to arena!', 'success', onToast);
  }

  function handleAppendColor(hex: string) {
    if (colorSequence.length >= 24) {
      notify('Max 24 colors!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, hex]);
  }

  function handleRemoveColorAt(index: number) {
    if (colorSequence.length <= 1) {
      notify('Need at least 1 color!', 'error', onToast);
      return;
    }
    setColorSequence(colorSequence.filter((_, idx) => idx !== index));
  }

  function handleClearSequence() {
    setColorSequence(['#ffffff']);
    notify('Colors reset.', 'info', onToast);
  }

  function handleDoublePattern() {
    if (colorSequence.length >= 12) {
      notify('Too long to double!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, ...colorSequence]);
  }

  function handleMirrorPattern() {
    if (colorSequence.length >= 12) {
      notify('Too long to mirror!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, ...[...colorSequence].reverse()]);
  }

  function handleRandomizePattern() {
    const styles: BodyStyle[] = ['smooth', 'dragon', 'armored', 'crystal', 'obsidian', 'basilisk'];
    const tapers: TaperStyle[] = ['natural', 'uniform', 'wave', 'heavy'];
    const count = Math.floor(Math.random() * 3) + 2;
    const seq: string[] = [];
    for (let i = 0; i < count; i++) {
      seq.push(PALETTE_COLORS[Math.floor(Math.random() * PALETTE_COLORS.length)].hex);
    }
    setColorSequence(seq);
    setBodyStyle(styles[Math.floor(Math.random() * styles.length)]);
    setTaperStyle(tapers[Math.floor(Math.random() * tapers.length)]);
    setGlowEnabled(Math.random() > 0.4);
    notify('Randomized!', 'success', onToast);
  }

  return (
    <div
      id="cosmetics-shop"
      className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-h-[82vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-5 py-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-400" />
          My Wardrobe
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Customize your snake&apos;s look — changes apply instantly in-game.
        </p>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* ── LIVE PREVIEW ── */}
        <TryOnPreview
          colors={colorSequence.length > 0 ? colorSequence : ['#ffffff']}
          shapeStyle={bodyStyle}
          taperStyle={taperStyle}
          glow={glowEnabled}
        />

        {/* TABS */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setTab('body')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'body'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Body Skin
          </button>
          <button
            type="button"
            onClick={() => setTab('face')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'face'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Face Cosmetics
          </button>
        </div>

        {/* BODY TAB */}
        {tab === 'body' && (
          <div className="animate-fade-in flex flex-col gap-5">
            {/* Quick Pick — horizontal scrollable presets */}
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Quick Pick — Tap to Equip
              </h3>
              <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
                {SLITHER_PRESETS.map((preset) => {
                  const active = isPresetActive(preset);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleEquipPreset(preset)}
                      title={preset.description}
                      className={`shrink-0 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all cursor-pointer min-w-[72px] ${
                        active
                          ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-950/50'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-2xl">{preset.emoji}</span>
                      <span className={`text-[9px] font-bold leading-tight text-center ${active ? 'text-purple-300' : 'text-slate-400'}`}>
                        {preset.name}
                      </span>
                      {active && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-800" />
              <button
                type="button"
                onClick={() => setShowCustom(!showCustom)}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest transition cursor-pointer flex items-center gap-1.5"
              >
                <Wand2 className="w-3 h-3" />
                {showCustom ? 'Hide' : 'Create'} Your Own
              </button>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Custom Creator */}
            {showCustom && (
              <div className="animate-fade-in flex flex-col gap-4">
                {/* Colors */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Colors
                  </label>
                  <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 mb-3">
                    {PALETTE_COLORS.map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => handleAppendColor(col.hex)}
                        title={`Add ${col.name}`}
                        className="aspect-square rounded-full border border-slate-800 hover:border-white hover:scale-110 active:scale-95 transition-all shadow cursor-pointer flex items-center justify-center group relative"
                        style={{ backgroundColor: col.hex }}
                      >
                        <Plus
                          className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition ${
                            col.hex === '#ffffff' || col.hex === '#f59e0b'
                              ? 'text-slate-950'
                              : 'text-white'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Active sequence strip */}
                  <div className="bg-slate-950 border border-slate-800/60 p-2.5 rounded-xl flex items-center gap-1.5 overflow-x-auto min-h-[48px]">
                    {colorSequence.map((col, idx) => (
                      <button
                        key={`${idx}-${col}`}
                        type="button"
                        onClick={() => handleRemoveColorAt(idx)}
                        title="Click to remove"
                        className="w-7 h-7 rounded-full border border-slate-950/40 shrink-0 flex items-center justify-center cursor-pointer hover:border-red-500 hover:scale-110 active:scale-95 group transition"
                        style={{
                          backgroundColor: col,
                          boxShadow: `0 0 6px ${col}44`,
                        }}
                      >
                        <span className="absolute inset-0 bg-red-600/90 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                          <Trash2 className="w-3 h-3 text-white" />
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Sequence helpers */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDoublePattern}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold text-[10px] rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Double
                    </button>
                    <button
                      type="button"
                      onClick={handleMirrorPattern}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold text-[10px] rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <ArrowLeftRight className="w-3 h-3" /> Mirror
                    </button>
                    <button
                      type="button"
                      onClick={handleRandomizePattern}
                      className="px-2.5 py-1 bg-purple-950/20 hover:bg-purple-950/30 border border-purple-800/20 text-purple-300 font-bold text-[10px] rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Wand2 className="w-3 h-3" /> Random
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSequence}
                      className="px-2.5 py-1 bg-rose-950/10 hover:bg-rose-950/25 border border-rose-800/20 text-rose-400 font-bold text-[10px] rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Reset
                    </button>
                  </div>
                </div>

                {/* Shape + Taper + Glow — inline row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Shape */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Segment Shape
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BODY_STYLE_OPTIONS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setBodyStyle(s.id)}
                          className={`py-1.5 px-2 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                            bodyStyle === s.id
                              ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Taper */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Body Thickness
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {TAPER_OPTIONS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTaperStyle(t.id)}
                          className={`py-1.5 px-2 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                            taperStyle === t.id
                              ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Glow */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Neon Glow
                    </label>
                    <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400">Emit light</span>
                      <button
                        type="button"
                        onClick={() => setGlowEnabled(!glowEnabled)}
                        aria-pressed={glowEnabled}
                        className={`w-10 h-5 rounded-full transition-all relative flex items-center p-0.5 cursor-pointer ${
                          glowEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 bg-white rounded-full shadow transition-all ${
                            glowEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Deploy button */}
                <button
                  type="button"
                  onClick={handleDeployCustomSkin}
                  className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    isCustomLabDeployed
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950'
                      : 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500'
                  }`}
                >
                  {isCustomLabDeployed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Custom Skin Active
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" /> Deploy to Arena
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* FACE TAB */}
        {tab === 'face' && (
          <div className="animate-fade-in">
            <CosmeticsSection onToast={onToast} />
          </div>
        )}
      </div>
    </div>
  );
}

export default CosmeticsShop;
