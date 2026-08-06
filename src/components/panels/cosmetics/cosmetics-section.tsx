'use client';

import { useState, useCallback } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import { GameSnakePreview } from './game-snake-preview';
import {
  getCosmeticsBySlot,
  getCosmeticById,
  SLOT_INFO,
  readEquippedCosmetics,
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
      // Toggle: if already equipped, UNEQUIP back to 'none'
      if (equipped[slot as keyof EquippedCosmetics] === cosmeticId) {
        const next: EquippedCosmetics = {
          ...equipped,
          [slot]: 'none',
        };
        writeEquippedCosmetics(next);
        setEquipped(next);
        onToast?.('❌ Unequipped — back to default', 'info');
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
        <GameSnakePreview
          key={activeSkinId}
          skinId={activeSkinId}
          width={450}
          height={180}
          segments={20}
          speed={1.2}
          scale={0.77}
        />
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
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1">
                      <Check className="w-3 h-3" /> Click to Unequip
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
