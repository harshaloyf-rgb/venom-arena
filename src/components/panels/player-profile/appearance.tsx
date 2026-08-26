'use client';

import type { PlayerProfile } from '@/lib/types';
import { getCosmeticById } from '@/lib/game-config';
import { Edit2, Upload } from 'lucide-react';

type CosmeticResult = ReturnType<typeof getCosmeticById>;

type ProfilePictureAndAppearanceProps = {
  player: PlayerProfile;
  activeSkin: CosmeticResult;
  activeTrail: CosmeticResult;
  activeDeath: CosmeticResult;
  activeFlagCosmetic: CosmeticResult;
  activeBanner: CosmeticResult;
  activeFlag: { code: string; flag: string; name: string } | undefined;
  onStartEditing: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
};

export function ProfilePictureAndAppearance({
  player,
  activeSkin,
  activeTrail,
  activeDeath,
  activeFlagCosmetic,
  activeBanner,
  activeFlag,
  onStartEditing,
  onDrop,
  onFileChange,
  isDragging,
  setIsDragging,
}: ProfilePictureAndAppearanceProps) {
  const skinColor = activeSkin?.color || '#10b981';
  const trailColor = activeTrail?.color || '#a855f7';
  const deathColor = activeDeath?.color || '#ef4444';
  const isImageAvatar = player.avatar ? (player.avatar.startsWith('data:') || player.avatar.startsWith('http')) : false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-5 pb-5 border-b border-slate-900/60">
      {/* Profile Picture Card */}
      <div className="md:col-span-4">
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 h-full flex flex-col items-center justify-center text-center">
          <span className="text-[11px] uppercase font-bold text-slate-500 tracking-widest mb-3">Profile Picture</span>
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center border-2 shadow-lg relative overflow-hidden cursor-pointer group mb-3"
            style={{ borderColor: skinColor + '50', backgroundColor: skinColor + '10' }}
            onClick={onStartEditing}
            title="Click to change profile picture"
          >
            {player.avatar ? (
              isImageAvatar ? (
                <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-5xl select-none">{player.avatar}</span>
              )
            ) : (
              <span className="text-5xl select-none">{activeSkin?.emoji || '🐍'}</span>
            )}
            <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold text-indigo-400 shadow">
              Lvl {player.level}
            </div>
          </div>
          <button type="button" onClick={onStartEditing} className="px-3 py-1.5 bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/25 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center gap-1">
            <Edit2 className="w-3 h-3" /> Change Picture
          </button>
        </div>
      </div>

      {/* Character Appearance Card */}
      <div className="md:col-span-8">
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 h-full">
          <span className="text-[11px] uppercase font-bold text-slate-500 tracking-widest mb-4 block">Character Appearance</span>
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Snake Visual */}
            <div className="relative w-full sm:w-48 h-40 shrink-0 rounded-xl bg-slate-900/80 border border-slate-900 overflow-hidden">
              {/* Grid background */}
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
              {/* Snake body segments */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Trail glow */}
                  <div className="absolute -inset-4 rounded-full opacity-30 blur-xl" style={{ backgroundColor: trailColor }} />
                  {/* Snake body - 5 segments in a curve */}
                  <svg width="120" height="100" viewBox="0 0 120 100" className="relative z-10">
                    <defs>
                      <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    {/* Body segments (curved path) */}
                    <path d="M 20 70 Q 40 70 50 55 Q 60 40 75 35 Q 90 30 100 25" fill="none" stroke={skinColor} strokeWidth="10" strokeLinecap="round" filter="url(#glow)" opacity="0.6" />
                    <path d="M 20 70 Q 40 70 50 55 Q 60 40 75 35 Q 90 30 100 25" fill="none" stroke={skinColor} strokeWidth="7" strokeLinecap="round" />
                    {/* Head */}
                    <circle cx="100" cy="25" r="7" fill={skinColor} filter="url(#glow)" />
                    <circle cx="100" cy="25" r="5.5" fill={skinColor} />
                    {/* Eyes */}
                    <circle cx="103" cy="22" r="2" fill="white" />
                    <circle cx="103" cy="22" r="1" fill="#0f172a" />
                    {/* Trail sparkles */}
                    <circle cx="15" cy="73" r="2" fill={trailColor} opacity="0.5" className="animate-pulse" />
                    <circle cx="8" cy="76" r="1.5" fill={trailColor} opacity="0.3" className="animate-pulse" />
                    <circle cx="22" cy="68" r="1" fill={trailColor} opacity="0.4" className="animate-pulse" />
                  </svg>
                  {/* Death FX indicator */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{activeDeath?.emoji || '💥'}</div>
                </div>
              </div>
              {/* Status indicator */}
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-950/80 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-mono text-slate-400">ACTIVE</span>
              </div>
            </div>

            {/* Equipped items grid */}
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-900/60">
                <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider block">Skin</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{activeSkin?.emoji || '🐍'}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{activeSkin?.name || 'Default'}</span>
                    <div className="w-full h-1 bg-slate-950 rounded-full mt-1"><div className="h-full rounded-full" style={{ width: '100%', backgroundColor: skinColor }} /></div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-900/60">
                <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider block">Trail</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{activeTrail?.emoji || '✨'}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{activeTrail?.name || 'Sparks'}</span>
                    <div className="w-full h-1 bg-slate-950 rounded-full mt-1"><div className="h-full rounded-full" style={{ width: '100%', backgroundColor: trailColor }} /></div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-900/60">
                <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider block">Death FX</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{activeDeath?.emoji || '💥'}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{activeDeath?.name || 'Splash'}</span>
                    <div className="w-full h-1 bg-slate-950 rounded-full mt-1"><div className="h-full rounded-full" style={{ width: '100%', backgroundColor: deathColor }} /></div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-900/60">
                <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider block">Region</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{activeFlag?.flag || '🏴'}</span>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{activeFlag?.name || 'Unknown'}</span>
                    <span className="text-[11px] font-mono text-slate-500">{activeFlag?.code || 'US'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type CosmeticsShowcaseProps = {
  activeSkin: CosmeticResult;
  activeTrail: CosmeticResult;
  activeDeath: CosmeticResult;
  activeFlagCosmetic: CosmeticResult;
  activeBanner: CosmeticResult;
};

export function CosmeticsShowcase({
  activeSkin,
  activeTrail,
  activeDeath,
  activeFlagCosmetic,
  activeBanner,
}: CosmeticsShowcaseProps) {
  const items = [
    { label: 'Skin', cosmetic: activeSkin, fallbackEmoji: '🐍', fallbackName: 'Default' },
    { label: 'Trail', cosmetic: activeTrail, fallbackEmoji: '✨', fallbackName: 'Sparks' },
    { label: 'Death FX', cosmetic: activeDeath, fallbackEmoji: '💥', fallbackName: 'Splash' },
    { label: 'Flag', cosmetic: activeFlagCosmetic, fallbackEmoji: '🏴', fallbackName: 'None' },
    { label: 'Banner', cosmetic: activeBanner, fallbackEmoji: '🌅', fallbackName: 'None' },
  ];

  return (
    <div className="flex flex-wrap gap-3 mb-5 pb-5 border-b border-slate-900/60">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 bg-slate-950/40 border border-slate-900 rounded-lg px-2.5 py-1.5 hover:border-slate-800 transition"
        >
          <span className="text-sm">{item.cosmetic?.emoji || item.fallbackEmoji}</span>
          <div className="flex flex-col">
            <span className="text-[11px] font-mono uppercase text-slate-500 leading-none">{item.label}</span>
            <span className="text-[11px] font-sans font-bold text-slate-300 leading-tight">
              {item.cosmetic?.name || item.fallbackName}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
