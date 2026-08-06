'use client';

/**
 * BUILD-11 — `CosmeticsShop` panel.
 *
 * Faithful replica of `/upload/extracted/src/components/CosmeticsShop.tsx`
 * (1810 lines). Adapted to the BUILD-2 server-authoritative stack:
 *
 *  - Premium ALL_COSMETICS items use `POST /api/player/cosmetic` with
 *    `{ action: 'buy' | 'equip', skinId }` and `useAuth().refresh()` after.
 *  - 20 free SLITHER_PRESETS and the Genetic Pattern Lab custom skin are
 *    persisted to `localStorage['venom_custom_skin_state']` (the server
 *    has no concept of custom-skin segments; the GameCanvas reads this
 *    key client-side to render the live wiggle preview).
 *
 * All textual strings — the H2 title, the subtitle, the two view-mode tabs,
 * the 7 category filters, the 20 preset descriptions, every "Active/Locked/
 * Equipped/Equip X/Unlock (N Chips)" button label, the 4-step Pattern Lab,
 * the TryOnPreview overlay caption "LAB HOLO-PREVIEW (STEER TO TEST)" and
 * every toast message — are preserved verbatim from the original audit
 * (AUDIT-C section A).
 *
 * The LIVE moving skin preview (`<SkinsCanvasPreview>` — 180×80 canvas, 10
 * segments, 60fps `requestAnimationFrame` loop using the exact
 * `Math.sin(time - i * 0.42) * 9` wiggle formula) and the interactive
 * `<TryOnPreview>` (450×180 canvas, 26 segments, mouse-steerable with
 * auto-patrol fallback) are both reproduced character-for-character from
 * the original so the "real-time wiggling skin" feeling is identical.
 */

import { useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Palette,
  Plus,
  ShoppingBag,
  Sliders,
  Trash2,
  Wand2,
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
  SlitherPreset,
  TaperStyle,
} from './cosmetics/cosmetics-types';
import {
  PALETTE_COLORS,
  SLITHER_PRESETS,
  BODY_STYLE_OPTIONS,
  TAPER_OPTIONS,
  CATEGORY_TABS,
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
  TrailCard,
  DeathCard,
  FlagCard,
  BannerCard,
} from './cosmetics/cosmetics-cards';
import { TryOnPreview } from './cosmetics/try-on-preview';
import { CosmeticsSection } from './cosmetics/cosmetics-section';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CosmeticsShop({ onToast }: CosmeticsShopProps) {
  const { player, loading, refresh } = useAuth();
  const [shopView, setShopView] = useState<ShopView>('presets');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  // DNA Lab custom states — initialized lazily from localStorage on the
  // client so that the Lab tab reflects whatever the player last deployed.
  // (The lab tab is hidden by default, so any hydration delta between
  // SSR-default and client-stored values is invisible until interaction.)
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

  // Bind to a const so TypeScript keeps the non-null narrowing inside the
  // closures below.
  const p = player;

  // -- helpers --------------------------------------------------------------
  // A manufactured skin is "active" only if no custom-skin (preset or DNA-lab)
  // is currently overriding the server's `currentSkin` field.
  const isSkinActive = (item: Skin) =>
    !customState?.useCustomSkin && p.currentSkin === item.id;

  const isPresetActive = (preset: SlitherPreset) =>
    customState?.useCustomSkin === true &&
    customState.currentSkin === preset.id;

  const isTrailActive = (item: Skin) => p.currentTrail === item.id;
  const isDeathActive = (item: Skin) => p.currentDeath === item.id;
  const isFlagActive = (item: Skin) => p.currentFlag === item.id;
  const isBannerActive = (item: Skin) => p.currentBanner === item.id;

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
        // Clear custom-skin flag when equipping a manufactured skin
        if (customState?.useCustomSkin) {
          const next: CustomSkinState = {
            ...customState,
            useCustomSkin: false,
          };
          writeCustomSkinState(next);
          setCustomState(next);
        }
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
          const next: CustomSkinState = {
            ...customState,
            useCustomSkin: false,
          };
          writeCustomSkinState(next);
          setCustomState(next);
        }
        notify(
          `Unlocked & Equipped ${item.name}! -${item.cost} CHIPS`,
          'success',
          onToast,
        );
      }
    }
  }

  function handleEquipSlitherPreset(preset: SlitherPreset) {
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
    notify(
      `Injected DNA: ${preset.name}! Equipped in Battle Arena.`,
      'success',
      onToast,
    );
  }

  // Consolidated handler for trail / death / flag / banner — all four
  // share the exact same check-owned → check-afford → postCosmetic → toast
  // flow, differing only in the toast message.
  async function handleEquip(
    type: 'trail' | 'death' | 'flag' | 'banner',
    item: Skin,
  ) {
    const owned = p.unlockedSkins.includes(item.id);
    if (owned) {
      if (await postCosmetic('equip', item.id)) {
        if (type === 'trail') {
          notify(`Equipped Trail Effect: ${item.name}`, 'success', onToast);
        } else if (type === 'death') {
          notify(`Equipped Death Effect: ${item.name}`, 'success', onToast);
        } else if (type === 'flag') {
          notify(`Equipped Flag: ${item.name}`, 'success', onToast);
        } else {
          notify(`Equipped Profile Banner: ${item.name}`, 'success', onToast);
        }
      }
    } else {
      if (p.bankedChips < item.cost) {
        if (type === 'trail') {
          notify(
            `You need ${item.cost} chips to unlock this trail!`,
            'error',
            onToast,
          );
        } else if (type === 'death') {
          notify(
            `You need ${item.cost} chips to unlock this death effect!`,
            'error',
            onToast,
          );
        } else if (type === 'flag') {
          notify(
            `You need ${item.cost} chips to unlock this flag!`,
            'error',
            onToast,
          );
        } else {
          notify(
            `You need ${item.cost} chips to unlock this profile banner!`,
            'error',
            onToast,
          );
        }
        return;
      }
      if (await postCosmetic('buy', item.id)) {
        if (type === 'trail') {
          notify(
            `Unlocked & Equipped Trail: ${item.name}! -${item.cost} CHIPS`,
            'success',
            onToast,
          );
        } else if (type === 'death') {
          notify(
            `Unlocked & Equipped Death Nova: ${item.name}! -${item.cost} CHIPS`,
            'success',
            onToast,
          );
        } else if (type === 'flag') {
          notify(
            `Unlocked & Equipped Flag: ${item.emoji} ${item.name}! -${item.cost} CHIPS`,
            'success',
            onToast,
          );
        } else {
          notify(
            `Unlocked & Equipped Profile Banner: ${item.name}! -${item.cost} CHIPS`,
            'success',
            onToast,
          );
        }
      }
    }
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
    setGlowEnabled(Math.random() > 0.4);
    notify('Mutated new genetic chain!', 'success', onToast);
  }

  function handleDeployCustomSkin() {
    if (colorSequence.length === 0) {
      notify('Choose at least 1 color node before deploying!', 'error', onToast);
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
    notify(
      '🧪 Genetic Custom Segment deployed! Equipped in Battle Arena.',
      'success',
      onToast,
    );
  }

  // -- derived lists --------------------------------------------------------
  // Merge pass cosmetics that the player has already claimed (so they can re-equip)
  const passOwnedIds: Set<string> = new Set(player?.unlockedSkins ?? []);
  const passOwnedCosmetics = [...PASS_FREE_COSMETICS, ...PASS_ELITE_COSMETICS].filter(
    (c) => passOwnedIds.has(c.id),
  );
  const allVisible = [...ALL_COSMETICS, ...passOwnedCosmetics];

  const manufacturedSkins = allVisible.filter((c) => c.type === 'skin');
  const trailCosmetics = allVisible.filter((c) => c.type === 'trail');
  const deathCosmetics = allVisible.filter((c) => c.type === 'death');
  const flagCosmetics = allVisible.filter((c) => c.type === 'flag');
  const bannerCosmetics = allVisible.filter((c) => c.type === 'banner');

  const showPresetsTab =
    activeCategory === 'all' || activeCategory === 'presets';
  const showPremiumTab =
    activeCategory === 'all' || activeCategory === 'premium';
  const showTrailsTab =
    activeCategory === 'all' || activeCategory === 'trails';
  const showDeathsTab =
    activeCategory === 'all' || activeCategory === 'deaths';
  const showFlagsTab = activeCategory === 'all' || activeCategory === 'flags';
  const showBannersTab =
    activeCategory === 'all' || activeCategory === 'banners';

  const isCustomLabDeployed =
    customState?.useCustomSkin === true &&
    customState.currentSkin === 'custom-lab-skin';

  return (
    <div
      id="cosmetics-shop"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
    >
      {/* Decor */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-400" /> Identity Workshop
            &amp; Skin Gallery
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Browse and equip real-time wiggling skins, luminous laser trails, or
            customize your own custom repeating venom snake DNA blueprint!
          </p>
        </div>

        {/* View-mode tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 w-fit shrink-0">
          <button
            type="button"
            onClick={() => setShopView('presets')}
            className={`px-4 py-2 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer ${
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
            className={`px-4 py-2 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
            className={`px-4 py-2 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
        <CosmeticsSection onToast={onToast} />
      ) : shopView === 'presets' ? (
        <div className="animate-fade-in">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-6">
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
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
                    (tab.id === 'cosmetics' && shopView === 'cosmetics')
                      || (tab.id !== 'cosmetics' && activeCategory === tab.id)
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* A. FREE SLITHER PRESETS */}
            {showPresetsTab &&
              SLITHER_PRESETS.map((preset) => {
                const active = isPresetActive(preset);
                return (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    active={active}
                    onClick={() => handleEquipSlitherPreset(preset)}
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

            {/* C. LASER TRAILS */}
            {showTrailsTab &&
              trailCosmetics.map((item) => (
                <TrailCard
                  key={item.id}
                  item={item}
                  unlocked={p.unlockedSkins.includes(item.id)}
                  active={isTrailActive(item)}
                  canAfford={p.bankedChips >= item.cost}
                  onClick={() => void handleEquip('trail', item)}
                />
              ))}

            {/* D. DEATH BURSTS */}
            {showDeathsTab &&
              deathCosmetics.map((item) => (
                <DeathCard
                  key={item.id}
                  item={item}
                  unlocked={p.unlockedSkins.includes(item.id)}
                  active={isDeathActive(item)}
                  canAfford={p.bankedChips >= item.cost}
                  onClick={() => void handleEquip('death', item)}
                />
              ))}

            {/* E. FLAGS */}
            {showFlagsTab &&
              flagCosmetics.map((item) => (
                <FlagCard
                  key={item.id}
                  item={item}
                  unlocked={p.unlockedSkins.includes(item.id)}
                  active={isFlagActive(item)}
                  canAfford={p.bankedChips >= item.cost}
                  onClick={() => void handleEquip('flag', item)}
                />
              ))}

            {/* F. BANNERS */}
            {showBannersTab &&
              bannerCosmetics.map((item) => (
                <BannerCard
                  key={item.id}
                  item={item}
                  unlocked={p.unlockedSkins.includes(item.id)}
                  active={isBannerActive(item)}
                  canAfford={p.bankedChips >= item.cost}
                  onClick={() => void handleEquip('banner', item)}
                />
              ))}
          </div>
        </div>
      ) : (
        /* GENETIC PATTERN LAB */
        <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN — TryOn preview + Projector card */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <TryOnPreview
              colors={colorSequence.length > 0 ? colorSequence : ['#ffffff']}
              shapeStyle={bodyStyle}
              taperStyle={taperStyle}
              glow={glowEnabled}
            />

            {/* Projector Details Card */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-inner">
              <span className="text-[9px] text-indigo-400 font-mono tracking-widest block uppercase font-extrabold mb-1">
                GENETIC PROFILE STATS
              </span>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-purple-400" /> Pattern DNA Engine
              </h3>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Your stripe nodes loop continuously as your snake grows in the
                arena. You can tweak color order, skin geometries, tapering
                physics, and aurora bioluminescence before deploying!
              </p>

              <div className="grid grid-cols-2 gap-2.5 mt-3 text-[10.5px] font-mono">
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500">NODES:</span>{' '}
                  <span className="text-purple-400 font-black">
                    {colorSequence.length} nodes
                  </span>
                </div>
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500">GLOW:</span>{' '}
                  <span
                    className={
                      glowEnabled
                        ? 'text-emerald-400 font-black'
                        : 'text-slate-500'
                    }
                  >
                    {glowEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeployCustomSkin}
                className={`w-full mt-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  isCustomLabDeployed
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950'
                    : 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500 hover:shadow-purple-500/20'
                }`}
              >
                {isCustomLabDeployed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-100 animate-bounce" />{' '}
                    DNA DEPLOYED &amp; EQUIPPED (ACTIVE)
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 text-purple-100" /> DEPLOY TO
                    BATTLE-ARENA
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN — 4-step editor */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* STEP 1 — Stripe sequence */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
              <div>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                  STEP 1
                </span>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-indigo-400" /> Construct
                  Stripe Sequence
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Click any palette color below to append it to the tail
                  sequence.{' '}
                  <span className="text-indigo-400 font-semibold">
                    Click any crown node inside the wiggling strip to erase it.
                  </span>
                </p>
              </div>

              {/* Palette */}
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
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
                      className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition ${
                        col.hex === '#ffffff' || col.hex === '#f59e0b'
                          ? 'text-slate-950'
                          : 'text-white'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Active strip */}
              <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-xl flex items-center gap-1.5 overflow-x-auto min-h-[64px] max-w-full relative shadow-inner va-scroll">
                {colorSequence.map((col, idx) => (
                  <button
                    key={`${idx}-${col}`}
                    type="button"
                    onClick={() => handleRemoveColorAt(idx)}
                    title="Click to erase node"
                    className="w-8 h-8 rounded-full border border-slate-950/45 shrink-0 flex items-center justify-center relative cursor-pointer hover:border-red-500 hover:scale-105 active:scale-95 group transition"
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
                      } text-[10px]`}
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
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleDoublePattern}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" /> Double
                  Sequence Length
                </button>
                <button
                  type="button"
                  onClick={handleMirrorPattern}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />{' '}
                  Mirror Symmetrically
                </button>
                <button
                  type="button"
                  onClick={handleRandomizePattern}
                  className="px-3 py-1.5 bg-purple-950/20 hover:bg-purple-950/30 border border-purple-800/20 hover:border-purple-500/30 text-purple-300 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer ml-auto"
                >
                  🎲 Mutate DNA
                </button>
                <button
                  type="button"
                  onClick={handleClearSequence}
                  className="px-3 py-1.5 bg-rose-950/10 hover:bg-rose-950/25 border border-rose-800/20 hover:border-rose-500/30 text-rose-400 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* STEP 2 — Geometry */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col gap-3">
              <div>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                  STEP 2
                </span>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-400" /> Choose Segment
                  Geometry
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BODY_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setBodyStyle(style.id)}
                    className={`p-3 rounded-xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between ${
                      bodyStyle === style.id
                        ? 'bg-indigo-600/10 border-indigo-500 shadow shadow-indigo-950'
                        : 'bg-slate-900 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <span className="text-xs font-bold text-white block capitalize">
                      {style.label}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-snug">
                      {style.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* STEPS 3 & 4 — Taper + Glow */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Taper */}
              <div className="flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                    STEP 3
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Body Taper Physics
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                    Configure snake tail scaling density styles.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {TAPER_OPTIONS.map((tap) => (
                    <button
                      key={tap.id}
                      type="button"
                      onClick={() => setTaperStyle(tap.id)}
                      className={`py-2 px-2.5 rounded-lg border text-xs font-semibold font-sans text-center transition cursor-pointer ${
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

              {/* Glow */}
              <div className="flex flex-col justify-between gap-3 border-t md:border-t-0 md:border-l border-slate-900 pt-4 md:pt-0 md:pl-6">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                    STEP 4
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Bioluminescent Aura
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                    Toggle active radioactive body node shading glow in battle
                    arenas.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-left">
                    <span className="text-xs font-bold text-white block">
                      Neon Glow
                    </span>
                    <span className="text-[10px] text-slate-400 block leading-tight">
                      Emit high-vis plasma light
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGlowEnabled(!glowEnabled)}
                    aria-pressed={glowEnabled}
                    aria-label="Toggle neon glow"
                    className={`w-11 h-6 rounded-full transition-all relative flex items-center p-1 cursor-pointer ${
                      glowEnabled ? 'bg-indigo-500' : 'bg-slate-800'
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
          </div>
        </div>
      )}
    </div>
  );
}

export default CosmeticsShop;
