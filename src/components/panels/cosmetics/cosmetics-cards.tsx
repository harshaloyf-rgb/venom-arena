import { Check, Flame, Lock, Sparkles } from 'lucide-react';
import type { Skin } from '@/lib/game-config';
import type { SlitherPreset } from './cosmetics-types';

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
export function ActiveBadge({ accent }: { accent: 'indigo' | 'emerald' }) {
  const accentClass =
    accent === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
  return (
    <span
      className={`absolute top-2.5 right-2.5 ${accentClass} border text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 leading-none`}
    >
      <Check className="w-2.5 h-2.5" /> Active
    </span>
  );
}

export function LockedBadge() {
  return (
    <span className="absolute top-2.5 right-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 leading-none">
      <Lock className="w-2.5 h-2.5 text-amber-400" /> Locked
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared unlock footer used by TrailCard, DeathCard, FlagCard, BannerCard
// ---------------------------------------------------------------------------
export function UnlockFooter({
  active,
  unlocked,
  canAfford,
  cost,
  equipLabel,
}: {
  active: boolean;
  unlocked: boolean;
  canAfford: boolean;
  cost: number;
  equipLabel: string;
}) {
  if (active) {
    return (
      <button
        type="button"
        tabIndex={-1}
        className="w-full py-2 rounded-xl text-center text-xs font-bold bg-indigo-950/40 text-indigo-400 border border-indigo-500/20 pointer-events-none uppercase"
      >
        Equipped
      </button>
    );
  }
  if (unlocked) {
    return (
      <button
        type="button"
        tabIndex={-1}
        className="w-full py-2 rounded-xl text-center text-xs font-bold bg-slate-900 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white pointer-events-none uppercase"
      >
        {equipLabel}
      </button>
    );
  }
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`w-full py-2 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 pointer-events-none ${
        canAfford
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-slate-950 font-black'
          : 'bg-slate-900/40 text-slate-500 cursor-not-allowed'
      }`}
    >
      <Sparkles className="w-3 h-3 animate-pulse" /> Unlock ({cost} Chips)
    </button>
  );
}

// ---------------------------------------------------------------------------
// PresetCard
// ---------------------------------------------------------------------------
export function PresetCard({
  preset,
  active,
  onClick,
  onMouseEnter,
}: {
  preset: SlitherPreset;
  active: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active && <ActiveBadge accent="indigo" />}

      <div>
        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-2xl">{preset.emoji}</span>
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {preset.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {preset.description}
        </p>
      </div>

      <button
        type="button"
        tabIndex={-1}
        className={`w-full py-2 rounded-xl text-center text-xs font-bold transition-all uppercase pointer-events-none ${
          active
            ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20'
            : 'bg-slate-900 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white'
        }`}
      >
        {active ? 'Equipped' : 'Equip Preset'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkinCard (premium manufactured skins)
// ---------------------------------------------------------------------------
export function SkinCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
  equipLabel,
  accent,
  onMouseEnter,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
  equipLabel: string;
  accent: 'indigo' | 'emerald';
  onMouseEnter?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? accent === 'emerald'
            ? 'border-emerald-500 shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-500/25 translate-y-[-2px]'
            : 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? (
        <ActiveBadge accent={accent} />
      ) : (
        !unlocked && <LockedBadge />
      )}

      <div>
        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-2xl">{item.emoji}</span>
          <h3
            className={`text-sm font-bold text-white tracking-tight group-hover:text-${accent}-400 transition-colors`}
        >
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      {active ? (
        <button
          type="button"
          tabIndex={-1}
          className={`w-full py-2 rounded-xl text-center text-xs font-bold pointer-events-none uppercase ${
            accent === 'emerald'
              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
              : 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20'
          }`}
        >
          Equipped
        </button>
      ) : unlocked ? (
        <button
          type="button"
          tabIndex={-1}
          className={`w-full py-2 rounded-xl text-center text-xs font-bold pointer-events-none uppercase bg-slate-900 text-slate-300 group-hover:bg-${accent}-600 group-hover:text-white`}
        >
          {equipLabel}
        </button>
      ) : (
        <button
          type="button"
          tabIndex={-1}
          className={`w-full py-2 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 pointer-events-none ${
            canAfford
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-slate-950 font-black'
              : 'bg-slate-900/40 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Sparkles className="w-3 h-3 animate-pulse" /> Unlock ({item.cost}{' '}
          Chips)
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrailCard
// ---------------------------------------------------------------------------
export function TrailCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? <ActiveBadge accent="indigo" /> : !unlocked && <LockedBadge />}

      <div>
        <div className="h-[80px] bg-slate-900/45 rounded-xl border border-slate-800/40 flex items-center justify-center gap-1.5 mb-4 relative overflow-hidden">
          {[0, 1, 2, 3].map((val) => (
            <div
              key={val}
              className="w-2 h-2 rounded-full animate-ping shadow"
              style={{
                backgroundColor: item.color,
                animationDelay: `${val * 160}ms`,
                boxShadow: `0 0 10px ${item.color}, 0 0 20px ${item.color}`,
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-base">{item.emoji}</span>
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      <UnlockFooter
        active={active}
        unlocked={unlocked}
        canAfford={canAfford}
        cost={item.cost}
        equipLabel="Equip Trail"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeathCard
// ---------------------------------------------------------------------------
export function DeathCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? <ActiveBadge accent="indigo" /> : !unlocked && <LockedBadge />}

      <div>
        <div className="h-[80px] bg-slate-900/45 rounded-xl border border-slate-800/40 flex items-center justify-center relative mb-4 overflow-hidden">
          <div className="w-5 h-5 rounded-full absolute bg-indigo-500/20 animate-ping" />
          <Flame
            className="w-6 h-6 transition-transform duration-300 group-hover:scale-125 z-10"
            style={{
              color: item.color,
              filter: `drop-shadow(0 0 10px ${item.color})`,
            }}
          />
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-base">{item.emoji}</span>
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      <UnlockFooter
        active={active}
        unlocked={unlocked}
        canAfford={canAfford}
        cost={item.cost}
        equipLabel="Equip Nova"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlagCard
// ---------------------------------------------------------------------------
export function FlagCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? <ActiveBadge accent="indigo" /> : !unlocked && <LockedBadge />}

      <div>
        <div className="h-[80px] bg-slate-900/45 rounded-xl border border-slate-800/40 flex items-center justify-center relative mb-4 overflow-hidden">
          <span className="text-4xl transition-transform duration-300 group-hover:scale-125 z-10 select-none animate-bounce">
            {item.emoji}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      <UnlockFooter
        active={active}
        unlocked={unlocked}
        canAfford={canAfford}
        cost={item.cost}
        equipLabel="Equip Flag"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BannerCard
// ---------------------------------------------------------------------------
export function BannerCard({
  item,
  unlocked,
  active,
  canAfford,
  onClick,
}: {
  item: Skin;
  unlocked: boolean;
  active: boolean;
  canAfford: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-slate-950 rounded-2xl border transition-all duration-300 cursor-pointer group hover:bg-slate-900 flex flex-col justify-between relative select-none ${
        active
          ? 'border-indigo-500 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/25 translate-y-[-2px]'
          : 'border-slate-800 hover:border-slate-700 hover:translate-y-[-2px]'
      }`}
    >
      {active ? <ActiveBadge accent="indigo" /> : !unlocked && <LockedBadge />}

      <div>
        <div className="h-[80px] rounded-xl border border-slate-800/40 flex items-center justify-center relative mb-4 overflow-hidden bg-slate-900 p-2">
          <div
            className={`w-full h-8 rounded-lg bg-gradient-to-r ${item.color} flex items-center px-3 border shadow-inner`}
          >
            <div className="w-4 h-4 rounded-full bg-white/20 mr-2" />
            <div className="h-3 w-16 bg-white/20 rounded" />
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <span className="text-base">{item.emoji}</span>
          <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
        </div>

        <p className="text-[10.5px] text-slate-500 text-center leading-relaxed mb-4 px-1.5 line-clamp-2">
          {item.description}
        </p>
      </div>

      <UnlockFooter
        active={active}
        unlocked={unlocked}
        canAfford={canAfford}
        cost={item.cost}
        equipLabel="Equip Banner"
      />
    </div>
  );
}
