'use client';

import { useState } from 'react';
import {
  ArrowLeftRight,
  Backpack,
  CheckCircle2,
  Palette,
  Plus,
  Save,
  ShoppingBag,
  Sliders,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ALL_COSMETICS, PASS_FREE_COSMETICS, PASS_ELITE_COSMETICS, type Skin } from '@/lib/game-config';
import {
  PanelSkeleton,
  NotSignedIn,
  notify,
  type ToastFn,
} from './_panel-primitives';

// Sub-module imports
import type {
  BodyStyle,
  CategoryFilter,
  CustomSkinState,
  ShopView,
  SkinPreset,
  TaperStyle,
} from './cosmetics/cosmetics-types';
import {
  PALETTE_COLORS,
  SKIN_PRESETS,
  BODY_STYLE_OPTIONS,
  TAPER_OPTIONS,
  CATEGORY_TABS,
  resolveLegacySkinId,
} from './cosmetics/cosmetics-types';
import type { CosmeticsShopProps } from './cosmetics/cosmetics-types';
import {
  generateCustomSegments,
  readCustomSkinStateSafe,
  writeCustomSkinState,
} from './cosmetics/cosmetics-utils';
import {
  PresetCard,
  SkinCard,
} from './cosmetics/cosmetics-cards';
import { GameSnakePreview } from './cosmetics/game-snake-preview';
import { CosmeticsSection } from './cosmetics/cosmetics-section';
import type { CustomSkinEntry } from '@/lib/player-helpers';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CosmeticsShop({ onToast }: CosmeticsShopProps) {
  const { player, loading, refresh } = useAuth();
  const [shopView, setShopView] = useState<ShopView>('presets');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  // Lab save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  // DNA Lab custom states
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

  if (loading) return <PanelSkeleton count={6} height="h-44" />;
  if (!player) return <NotSignedIn />;

  const p = player;

  // -- helpers --------------------------------------------------------------
  const isSkinActive = (item: Skin) =>
    !customState?.useCustomSkin && p.currentSkin === item.id;

  const isPresetActive = (preset: SkinPreset) =>
    customState?.useCustomSkin === true &&
    customState.currentSkin === preset.id;

  const isCustomSkinActive = (entry: CustomSkinEntry) =>
    customState?.useCustomSkin === true &&
    customState.currentSkin === entry.id;

  // -- active skin ID (used by CosmeticsSection) ----------------------------
  const activeSkinId = customState?.useCustomSkin
    ? customState.currentSkin
    : p.currentSkin;

  async function postCosmetic(action: 'buy' | 'equip', skinId: string) {
    try {
      const res = await fetch('/api/player/cosmetic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, skinId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify(data?.error || 'Action failed.', 'error', onToast);
        return false;
      }
      await refresh();
      return true;
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
      return false;
    }
  }

  // -- action handlers ------------------------------------------------------
  async function handleEquipManufacturedSkin(item: Skin) {
    const owned = p.unlockedSkins.includes(item.id);
    if (owned) {
      if (await postCosmetic('equip', item.id)) {
        if (customState?.useCustomSkin) {
          const next: CustomSkinState = { ...customState, useCustomSkin: false };
          writeCustomSkinState(next);
          setCustomState(next);
        }
        // NOTE: postCosmetic already refresh()es — a second refresh here caused
        // two app-wide re-renders per equip (page-wide canvas flash).
        notify(`Equipped Body Skin: ${item.name}`, 'success', onToast);
      }
    } else {
      if (p.bankedChips < item.cost) {
        notify(
          `You need ${item.cost} chips to unlock ${item.name}! Play matches to earn chips.`,
          'error',
          onToast,
        );
        return;
      }
      if (await postCosmetic('buy', item.id)) {
        if (customState?.useCustomSkin) {
          const next: CustomSkinState = { ...customState, useCustomSkin: false };
          writeCustomSkinState(next);
          setCustomState(next);
        }
        // NOTE: postCosmetic already refresh()es — see equip branch above.
        notify(
          `Unlocked & Equipped ${item.name}! -${item.cost} CHIPS`,
          'success',
          onToast,
        );
      }
    }
  }

  async function handleEquipSkinPreset(preset: SkinPreset) {
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
    try {
      await fetch('/api/player/current-skin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId: preset.id }),
      });
      await refresh();
    } catch { /* non-critical */ }
    notify(
      `Injected DNA: ${preset.name}! Equipped in Battle Arena.`,
      'success',
      onToast,
    );
  }

  async function handleEquipInventorySkin(skinId: string) {
    // Check if it's a pass/premium manufactured skin
    const allCosmetic = [...ALL_COSMETICS, ...PASS_FREE_COSMETICS, ...PASS_ELITE_COSMETICS];
    const cosmetic = allCosmetic.find((c) => c.id === skinId);
    if (cosmetic) {
      if (customState?.useCustomSkin) {
        const next: CustomSkinState = { ...customState, useCustomSkin: false };
        writeCustomSkinState(next);
        setCustomState(next);
      }
      await postCosmetic('equip', skinId);
      notify(`Equipped: ${cosmetic.name}`, 'success', onToast);
      return;
    }

    // Check if it's a saved custom skin from DB
    const customEntry = p.customSkins?.find((s) => s.id === skinId);
    if (customEntry) {
      const segments = generateCustomSegments(
        customEntry.colors,
        customEntry.bodyStyle as BodyStyle,
        customEntry.taperStyle as TaperStyle,
        customEntry.glow,
      );
      const next: CustomSkinState = {
        useCustomSkin: true,
        currentSkin: customEntry.id,
        customSkinSegments: segments,
      };
      writeCustomSkinState(next);
      setCustomState(next);
      try {
        await fetch('/api/player/current-skin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skinId: customEntry.id }),
        });
        await refresh();
      } catch { /* non-critical */ }
      notify(`Equipped: ${customEntry.name}`, 'success', onToast);
      return;
    }

    // Check if it's a free preset (legacy manufactured ids alias onto their
    // preset twin after the 2026-09-05 premium-shop relocation)
    const preset = SKIN_PRESETS.find((pr) => pr.id === resolveLegacySkinId(skinId));
    if (preset) {
      await handleEquipSkinPreset(preset);
      return;
    }

    notify('Skin not found.', 'error', onToast);
  }

  // -- genetic lab handlers -------------------------------------------------
  function handleAppendColor(hex: string) {
    if (colorSequence.length >= 24) {
      notify('Maximum 24 segments in stripe pattern!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, hex]);
  }

  function handleRemoveColorAt(index: number) {
    if (colorSequence.length <= 1) {
      notify('Stripe sequence must have at least 1 color node!', 'error', onToast);
      return;
    }
    setColorSequence(colorSequence.filter((_, idx) => idx !== index));
  }

  function handleClearSequence() {
    setColorSequence(['#ffffff']);
    notify('Sequence reset.', 'info', onToast);
  }

  function handleDoublePattern() {
    if (colorSequence.length >= 12) {
      notify('Sequence too long to double!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, ...colorSequence]);
  }

  function handleMirrorPattern() {
    if (colorSequence.length >= 12) {
      notify('Sequence too long to mirror!', 'error', onToast);
      return;
    }
    setColorSequence([...colorSequence, ...[...colorSequence].reverse()]);
  }

  function handleRandomizePattern() {
    const categories: BodyStyle[] = [
      'smooth', 'dragon', 'armored', 'crystal', 'obsidian', 'basilisk',
      'stellar', 'fortress', 'stingray', 'phantom',
    ];
    const tapers: TaperStyle[] = ['natural', 'uniform', 'wave', 'heavy'];
    const colorsList = PALETTE_COLORS.map((c) => c.hex);

    const count = Math.floor(Math.random() * 3) + 2;
    const sequence: string[] = [];
    for (let i = 0; i < count; i++) {
      sequence.push(colorsList[Math.floor(Math.random() * colorsList.length)]);
    }

    setColorSequence(sequence);
    setBodyStyle(categories[Math.floor(Math.random() * categories.length)]);
    setTaperStyle(tapers[Math.floor(Math.random() * tapers.length)]);
    notify('Mutated new genetic chain!', 'success', onToast);
  }

  async function handleDeployCustomSkin() {
    if (colorSequence.length === 0) {
      notify('Choose at least 1 color node before deploying!', 'error', onToast);
      return;
    }

    const segments = generateCustomSegments(colorSequence, bodyStyle, taperStyle, false);
    const next: CustomSkinState = {
      useCustomSkin: true,
      currentSkin: 'custom-lab-skin',
      customSkinSegments: segments,
    };
    writeCustomSkinState(next);
    setCustomState(next);
    try {
      await fetch('/api/player/current-skin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId: 'custom-lab-skin' }),
      });
      await refresh();
    } catch { /* non-critical */ }
    notify(
      '🧪 Genetic Custom Segment deployed! Equipped in Battle Arena.',
      'success',
      onToast,
    );
  }

  // -- save to inventory from lab -------------------------------------------
  async function handleSaveToInventory() {
    const name = saveName.trim();
    if (!name) {
      notify('Please enter a name for your skin.', 'error', onToast);
      return;
    }
    if (colorSequence.length === 0) {
      notify('Design a skin first before saving!', 'error', onToast);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/player/custom-skins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          colors: colorSequence,
          bodyStyle,
          taperStyle,
          glow: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify((data as { error?: string }).error || 'Failed to save skin.', 'error', onToast);
        return;
      }
      await refresh();
      setSaveDialogOpen(false);
      setSaveName('');
      notify(`Saved "${name}" to your inventory!`, 'success', onToast);
    } catch {
      notify('Network error. Please try again.', 'error', onToast);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCustomSkin(id: string, name: string) {
    try {
      const res = await fetch('/api/player/custom-skins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify((data as { error?: string }).error || 'Failed to delete.', 'error', onToast);
        return;
      }
      // If this was the currently equipped skin, clear it
      if (customState?.useCustomSkin && customState.currentSkin === id) {
        const next: CustomSkinState = { ...customState, useCustomSkin: false };
        writeCustomSkinState(next);
        setCustomState(next);
      }
      await refresh();
      notify(`Deleted "${name}" from inventory.`, 'info', onToast);
    } catch {
      notify('Network error.', 'error', onToast);
    }
  }

  // -- derived lists --------------------------------------------------------
  const passOwnedIds: Set<string> = new Set(player?.unlockedSkins ?? []);
  const passOwnedCosmetics = [...PASS_FREE_COSMETICS, ...PASS_ELITE_COSMETICS].filter(
    (c) => passOwnedIds.has(c.id),
  );
  const allVisible = [...ALL_COSMETICS, ...passOwnedCosmetics];

  const manufacturedSkins = allVisible.filter((c) => c.type === 'skin');

  const showPresetsTab = activeCategory === 'all' || activeCategory === 'presets';
  const showPremiumTab = activeCategory === 'all' || activeCategory === 'premium';

  const isCustomLabDeployed =
    customState?.useCustomSkin === true &&
    customState.currentSkin === 'custom-lab-skin';

  const customSkinSlotsUsed = p.customSkins?.length ?? 0;
  const MAX_CUSTOM = 5;

  // -- inventory items: pass-claimed + custom skins --------------------------
  const inventoryPassSkins = passOwnedCosmetics.filter((c) => c.type === 'skin');
  const inventoryCustomSkins = p.customSkins ?? [];

  return (
    <div
      id="cosmetics-shop"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-1.5 shadow-2xl relative overflow-hidden"
    >
      {/* Decor */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-1 mb-6 lg:mb-1 pb-6 lg:pb-1 border-b border-slate-800">
        <div>
          <h2 className="text-xl lg:text-[11px] font-bold font-sans tracking-tight text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 lg:w-3 lg:h-3 text-indigo-400" /> Identity Workshop
            &amp; Skin Gallery
          </h2>
          <p className="text-xs lg:text-[11px] text-slate-400 font-sans mt-1 lg:mt-0 lg:leading-tight">
            Browse and equip real-time wiggling skins or customize your own
            custom repeating venom snake DNA blueprint!
          </p>
        </div>

        {/* View-mode tabs */}
        <div className="flex bg-slate-950 p-1 lg:p-0.5 rounded-xl border border-slate-800/80 w-fit shrink-0">
          <button
            type="button"
            onClick={() => setShopView('inventory')}
            className={`px-4 py-2 lg:px-2 lg:py-1 rounded-lg text-xs lg:text-[11px] font-sans font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              shopView === 'inventory'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Backpack className="w-4 h-4 lg:w-3 lg:h-3" /> My Inventory
          </button>
          <button
            type="button"
            onClick={() => setShopView('presets')}
            className={`px-4 py-2 lg:px-2 lg:py-1 rounded-lg text-xs lg:text-[11px] font-sans font-bold transition-all cursor-pointer ${
              shopView === 'presets'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎨 Skin &amp; Effect Gallery
          </button>
          <button
            type="button"
            onClick={() => setShopView('editor')}
            className={`px-4 py-2 lg:px-2 lg:py-1 rounded-lg text-xs lg:text-[11px] font-sans font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              shopView === 'editor'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🧬 Genetic Pattern Lab
          </button>
          <button
            type="button"
            onClick={() => setShopView('cosmetics')}
            className={`px-4 py-2 lg:px-2 lg:py-1 rounded-lg text-xs lg:text-[11px] font-sans font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              shopView === 'cosmetics'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎭 Face Cosmetics
          </button>
        </div>
      </div>

      {/* BODY */}
      {shopView === 'cosmetics' ? (
        <CosmeticsSection onToast={onToast} activeSkinId={activeSkinId} />
      ) : shopView === 'inventory' ? (
        /* ────────────── MY INVENTORY ────────────── */
        <div className="animate-fade-in space-y-6 lg:space-y-1">
          {/* Slot counter */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-slate-400 font-mono">
              CUSTOM SLOTS: <span className="text-emerald-400 font-black">{customSkinSlotsUsed}</span>/{MAX_CUSTOM}
            </span>
            <button
              type="button"
              onClick={() => { setSaveDialogOpen(true); setSaveName(''); }}
              disabled={customSkinSlotsUsed >= MAX_CUSTOM}
              className="px-3 py-1.5 lg:px-1.5 lg:py-0.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" /> Save Current Lab Design
            </button>
          </div>

          {/* Pass-claimed skins */}
          {inventoryPassSkins.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-3 lg:mb-1 flex items-center gap-1.5">
                🏆 Pass & Premium Skins
                <span className="text-slate-500 font-normal">({inventoryPassSkins.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-1.5">
                {inventoryPassSkins.map((item) => {
                  const isActive = isSkinActive(item);
                  return (
                    <SkinCard
                      key={item.id}
                      item={item}
                      unlocked={true}
                      active={isActive}
                      canAfford={true}
                      accent="emerald"
                      onClick={() => void handleEquipInventorySkin(item.id)}
                      equipLabel={isActive ? 'Equipped' : 'Equip Skin'}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom lab skins from DB */}
          {inventoryCustomSkins.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-3 lg:mb-1 flex items-center gap-1.5">
                🧬 My Custom Designs
                <span className="text-slate-500 font-normal">({inventoryCustomSkins.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-1.5">
                {inventoryCustomSkins.map((entry) => {
                  const isActive = isCustomSkinActive(entry);
                  const segments = generateCustomSegments(
                    entry.colors,
                    entry.bodyStyle as BodyStyle,
                    entry.taperStyle as TaperStyle,
                    entry.glow,
                  );
                  return (
                    <div
                      key={entry.id}
                      className={`bg-slate-950 border rounded-xl p-4 lg:p-1.5 transition-all ${
                        isActive
                          ? 'border-emerald-500 shadow shadow-emerald-950'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Mini preview */}
                      <GameSnakePreview
                        colors={entry.colors}
                        bodyStyle={entry.bodyStyle as BodyStyle}
                        taperStyle={entry.taperStyle as TaperStyle}
                        glow={entry.glow}
                        width={280}
                        height={60}
                        segments={14}
                        speed={1.0}
                        scale={0.9}
                        responsive
                      />
                      <div className="mt-3 lg:mt-0.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-white truncate">{entry.name}</p>
                          <p className="text-[10px] text-slate-500">Custom Design</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleDeleteCustomSkin(entry.id, entry.name)}
                            className="p-1.5 lg:p-0.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleEquipInventorySkin(entry.id)}
                            className={`px-3 py-1.5 lg:px-1.5 lg:py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              isActive
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            {isActive ? 'Equipped' : 'Equip'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {inventoryPassSkins.length === 0 && inventoryCustomSkins.length === 0 && (
            <div className="text-center py-12">
              <Backpack className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Your inventory is empty.</p>
              <p className="text-slate-500 text-xs mt-1">
                Claim skins from the Season Pass or save designs from the Genetic Lab.
              </p>
            </div>
          )}
        </div>
      ) : shopView === 'presets' ? (
        <div className="animate-fade-in">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 lg:gap-1 mb-6 lg:mb-1">
            {CATEGORY_TABS.map((tab) => {
              const handleClick = () => {
                if (tab.id === 'cosmetics') {
                  setShopView('cosmetics');
                } else {
                  setActiveCategory(tab.id);
                }
              };
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={handleClick}
                  className={`px-3.5 py-1.5 lg:px-2 lg:py-1 rounded-lg text-xs lg:text-[11px] font-sans font-semibold transition-all cursor-pointer ${
                    (tab.id !== 'cosmetics' && activeCategory === tab.id)
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-md font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Gallery grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-1.5">
            {/* A. FREE SKIN PRESETS */}
            {showPresetsTab &&
              SKIN_PRESETS.map((preset) => {
                const active = isPresetActive(preset);
                return (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    active={active}
                    onClick={() => handleEquipSkinPreset(preset)}
                  />
                );
              })}

            {/* B. PREMIUM MANUFACTURED SKINS */}
            {showPremiumTab &&
              manufacturedSkins.map((item) => {
                const unlocked = p.unlockedSkins.includes(item.id);
                const active = isSkinActive(item);
                const canAfford = p.bankedChips >= item.cost;
                return (
                  <SkinCard
                    key={item.id}
                    item={item}
                    unlocked={unlocked}
                    active={active}
                    canAfford={canAfford}
                    accent="emerald"
                    onClick={() => void handleEquipManufacturedSkin(item)}
                    equipLabel="Equip Skin"
                  />
                );
              })}
          </div>
        </div>
      ) : (
        /* GENETIC PATTERN LAB */
        <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-1">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-0.5">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 lg:p-1.5">
              <GameSnakePreview
                colors={colorSequence}
                bodyStyle={bodyStyle}
                taperStyle={taperStyle}
                glow={false}
                width={480}
                height={100}
                segments={24}
                speed={1.2}
                scale={1.1}
                responsive
              />
            </div>

            {/* Projector Details Card */}
            <div className="bg-slate-950 border border-slate-800 p-4 lg:p-1.5 rounded-2xl shadow-inner">
              <span className="text-[11px] text-indigo-400 font-mono tracking-widest block uppercase font-extrabold mb-1">
                GENETIC PROFILE STATS
              </span>
              <h3 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-1.5">
                <Palette className="w-4 h-4 lg:w-3 lg:h-3 text-purple-400" /> Pattern DNA Engine
              </h3>
              <p className="text-[11px] text-slate-400 mt-1.5 lg:mt-0.5 lg:leading-tight">
                Your stripe nodes loop continuously as your snake grows in the
                arena. You can tweak color order, skin geometries, and tapering
                physics before deploying!
              </p>

              <div className="bg-slate-900 px-2.5 lg:px-1.5 py-1.5 lg:py-1 rounded-lg border border-slate-800 mt-3 lg:mt-0.5 text-[11px] font-mono">
                <span className="text-slate-500">NODES:</span>{' '}
                <span className="text-purple-400 font-black">
                  {colorSequence.length} nodes
                </span>
              </div>

              <div className="flex gap-2 mt-4 lg:mt-0.5">
                <button
                  type="button"
                  onClick={handleDeployCustomSkin}
                  className={`flex-1 py-3 lg:py-1.5 rounded-xl text-xs lg:text-[11px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    isCustomLabDeployed
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950'
                      : 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500 hover:shadow-purple-500/20'
                  }`}
                >
                  {isCustomLabDeployed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 lg:w-3 lg:h-3 text-emerald-100 animate-bounce" />{' '}
                      DNA DEPLOYED &amp; EQUIPPED (ACTIVE)
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 lg:w-3 lg:h-3 text-purple-100" /> DEPLOY TO
                      BATTLE-ARENA
                    </>
                  )}
                </button>
              </div>

              {/* Save to Inventory button */}
              <button
                type="button"
                onClick={() => { setSaveDialogOpen(true); setSaveName(''); }}
                disabled={customSkinSlotsUsed >= MAX_CUSTOM}
                className={`w-full mt-2 py-2.5 lg:py-1.5 rounded-xl text-xs lg:text-[11px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  customSkinSlotsUsed >= MAX_CUSTOM
                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 border-emerald-800/40 text-emerald-400 hover:text-emerald-300 hover:border-emerald-600/50'
                }`}
              >
                <Save className="w-4 h-4 lg:w-3 lg:h-3" />
                SAVE TO INVENTORY ({customSkinSlotsUsed}/{MAX_CUSTOM})
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN — 4-step editor */}
          <div className="lg:col-span-7 flex flex-col gap-6 lg:gap-1">
            {/* STEP 1 — Stripe sequence */}
            <div className="bg-slate-950 border border-slate-800 p-5 lg:p-1.5 rounded-2xl flex flex-col gap-4 lg:gap-0.5">
              <div>
                <span className="text-[11px] text-slate-500 font-mono tracking-wider block uppercase font-bold lg:leading-tight">
                  STEP 1
                </span>
                <h3 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-1.5 lg:leading-tight">
                  <Palette className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" /> Construct
                  Stripe Sequence
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 lg:mt-0 lg:leading-tight">
                  Click any palette color below to append it to the tail
                  sequence.{' '}
                  <span className="text-indigo-400 font-semibold">
                    Click any crown node inside the wiggling strip to erase it.
                  </span>
                </p>
              </div>

              {/* Palette */}
              <div className="grid grid-cols-7 sm:grid-cols-9 lg:grid-cols-14 gap-2 lg:gap-0.5">
                {PALETTE_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => handleAppendColor(col.hex)}
                    title={`Add ${col.name}`}
                    className="aspect-square lg:w-5 lg:h-5 rounded-full border border-slate-800 hover:border-white hover:scale-110 active:scale-95 transition-all shadow cursor-pointer flex items-center justify-center group relative"
                    style={{ backgroundColor: col.hex }}
                  >
                    <Plus
                      className={`w-4 h-4 lg:w-2.5 lg:h-2.5 opacity-0 group-hover:opacity-100 transition ${
                        col.hex === '#ffffff' || col.hex === '#f59e0b'
                          ? 'text-slate-950'
                          : 'text-white'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Active strip */}
              <div className="bg-slate-900 border border-slate-800/80 p-3 lg:p-1 rounded-xl flex items-center gap-1.5 overflow-x-auto min-h-[64px] lg:min-h-[28px] max-w-full relative shadow-inner va-scroll">
                {colorSequence.map((col, idx) => (
                  <button
                    key={`${idx}-${col}`}
                    type="button"
                    onClick={() => handleRemoveColorAt(idx)}
                    title="Click to erase node"
                    className="w-8 h-8 lg:w-4 lg:h-4 rounded-full border border-slate-950/45 shrink-0 flex items-center justify-center relative cursor-pointer hover:border-red-500 hover:scale-105 active:scale-95 group transition"
                    style={{
                      backgroundColor: col,
                      boxShadow: `0 0 6px ${col}44`,
                    }}
                  >
                    <span
                      className={`${
                        col === '#ffffff' || col === '#f59e0b'
                          ? 'text-slate-950 font-black'
                          : 'text-white font-bold'
                      } text-[11px]`}
                    >
                      {idx === 0 ? '👑' : idx}
                    </span>
                    <span className="absolute inset-0 bg-red-600/90 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </span>
                  </button>
                ))}
              </div>

              {/* Helpers */}
              <div className="flex flex-wrap gap-2.5 lg:gap-0.5">
                <button
                  type="button"
                  onClick={handleDoublePattern}
                  className="px-3 py-1.5 lg:px-1.5 lg:py-0.5 lg:gap-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 text-indigo-400" /> Double
                  Sequence Length
                </button>
                <button
                  type="button"
                  onClick={handleMirrorPattern}
                  className="px-3 py-1.5 lg:px-1.5 lg:py-0.5 lg:gap-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5 text-indigo-400" />{' '}
                  Mirror Symmetrically
                </button>
                <button
                  type="button"
                  onClick={handleRandomizePattern}
                  className="px-3 py-1.5 lg:px-1.5 lg:py-0.5 lg:gap-0.5 bg-purple-950/20 hover:bg-purple-950/30 border border-purple-800/20 hover:border-purple-500/30 text-purple-300 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer ml-auto"
                >
                  🎲 Mutate DNA
                </button>
                <button
                  type="button"
                  onClick={handleClearSequence}
                  className="px-3 py-1.5 lg:px-1.5 lg:py-0.5 lg:gap-0.5 bg-rose-950/10 hover:bg-rose-950/25 border border-rose-800/20 hover:border-rose-500/30 text-rose-400 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 lg:w-2.5 lg:h-2.5" /> Reset
                </button>
              </div>
            </div>

            {/* STEP 2 — Geometry */}
            <div className="bg-slate-950 border border-slate-800 p-5 lg:p-1.5 rounded-2xl flex flex-col gap-3 lg:gap-0.5">
              <div>
                <span className="text-[11px] text-slate-500 font-mono tracking-wider block uppercase font-bold lg:leading-tight">
                  STEP 2
                </span>
                <h3 className="text-sm lg:text-[11px] font-bold text-white flex items-center gap-1.5 lg:leading-tight">
                  <Sliders className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400" /> Choose Segment
                  Geometry
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-0.5">
                {BODY_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setBodyStyle(style.id)}
                    className={`p-2 lg:p-1 rounded-xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between ${
                      bodyStyle === style.id
                        ? 'bg-indigo-600/10 border-indigo-500 shadow shadow-indigo-950'
                        : 'bg-slate-900 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-white block capitalize">
                      {style.label}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 lg:mt-0 lg:leading-tight">
                      {style.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* STEP 3 — Taper */}
            <div className="bg-slate-950 border border-slate-800 p-5 lg:p-1.5 rounded-2xl flex flex-col gap-3 lg:gap-0.5">
              <div>
                <span className="text-[11px] text-slate-500 font-mono tracking-wider block uppercase font-bold lg:leading-tight">
                  STEP 3
                </span>
                <h3 className="text-sm lg:text-[11px] font-bold text-white lg:leading-tight">
                  Body Taper Physics
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed lg:leading-tight mt-0.5 lg:mt-0">
                  Configure snake tail scaling density styles.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:gap-0.5">
                {TAPER_OPTIONS.map((tap) => (
                  <button
                    key={tap.id}
                    type="button"
                    onClick={() => setTaperStyle(tap.id)}
                    className={`py-2 px-2.5 lg:py-1 lg:px-1.5 rounded-lg border text-xs lg:text-[11px] font-semibold font-sans text-center transition cursor-pointer ${
                      taperStyle === tap.id
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tap.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SAVE TO INVENTORY DIALOG ─── */}
      {saveDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-400" /> Save to Inventory
              </h3>
              <button
                type="button"
                onClick={() => setSaveDialogOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview of current design */}
            <div className="bg-slate-950 rounded-xl p-3 mb-4">
              <GameSnakePreview
                colors={colorSequence}
                bodyStyle={bodyStyle}
                taperStyle={taperStyle}
                glow={false}
                width={280}
                height={50}
                segments={16}
                speed={1.0}
                scale={0.8}
                responsive
              />
            </div>

            <label className="block text-[11px] text-slate-400 font-semibold mb-1.5">
              NAME YOUR SKIN
            </label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value.slice(0, 30))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveToInventory(); }}
              placeholder="e.g. Shadow Viper"
              autoFocus
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setSaveDialogOpen(false)}
                className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveToInventory}
                disabled={saving || !saveName.trim()}
                className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Skin'}
              </button>
            </div>

            {customSkinSlotsUsed >= MAX_CUSTOM && (
              <p className="text-[10px] text-amber-400 mt-2 text-center">
                Inventory full! Delete a skin to make room.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CosmeticsShop;
