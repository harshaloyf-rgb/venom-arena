'use client';

import { COUNTRIES } from '@/lib/game-config';
import { Check, Globe, Lock, Shield, Timer, Trash2, Upload } from 'lucide-react';

// ---------------------------------------------------------------------------
// FACTION_COUNTRIES
// ---------------------------------------------------------------------------
const FACTION_COUNTRIES = COUNTRIES;

// ---------------------------------------------------------------------------
// PRESET_AVATARS
// ---------------------------------------------------------------------------
const PRESET_AVATARS = [
  { id: 'av-viper', label: 'Venomous Viper', emoji: '\u{1f40d}' },
  { id: 'av-skull', label: 'Syndicate Skull', emoji: '\u{1f3f4}\u{200d}\u{2620}\u{fe0f}' },
  { id: 'av-invader', label: 'Pixel Invader', emoji: '\u{1f47e}' },
  { id: 'av-sentinel', label: 'Cyber Sentinel', emoji: '\u{1f916}' },
  { id: 'av-king', label: 'Midas King', emoji: '\u{1f451}' },
  { id: 'av-storm', label: 'Storm Surge', emoji: '\u26a1' },
  { id: 'av-fury', label: 'Crimson Fury', emoji: '\u{1f525}' },
  { id: 'av-nebula', label: 'Cosmic Nebula', emoji: '\u{1f30c}' },
];

// ---------------------------------------------------------------------------
// IdentityEditor
// ---------------------------------------------------------------------------
interface IdentityEditorProps {
  newName: string;
  setNewName: (v: string) => void;
  selectedCountry: string;
  setSelectedCountry: (v: string) => void;
  selectedAvatar: string;
  setSelectedAvatar: (v: string) => void;
  instagram: string;
  setInstagram: (v: string) => void;
  youtube: string;
  setYoutube: (v: string) => void;
  twitch: string;
  setTwitch: (v: string) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  nameCooldownText: string | null;
  countryCooldownText: string | null;
}

export function IdentityEditor(props: IdentityEditorProps) {
  const {
    newName,
    setNewName,
    selectedCountry,
    setSelectedCountry,
    selectedAvatar,
    setSelectedAvatar,
    instagram,
    setInstagram,
    youtube,
    setYoutube,
    twitch,
    setTwitch,
    isDragging,
    setIsDragging,
    onDrop,
    onFileChange,
    onCancel,
    onSave,
    saving,
    nameCooldownText,
    countryCooldownText,
  } = props;

  const isImageAvatar =
    selectedAvatar.startsWith('data:') || selectedAvatar.startsWith('http');

  return (
    <div className="border border-indigo-500/30 bg-slate-950/80 rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
          <Lock className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white font-sans">
            Handshake Registration Protocol
          </h3>
          <p className="text-xs text-slate-400">
            Lock down your tournament handle and regional alignment. All
            changes are logged.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nickname */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Challenger Handle
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={20}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full"
            placeholder="Enter nickname"
          />
          <span className="text-[10px] text-slate-500">
            Max 20 characters. Your VENOM-XXXX tag is permanent and never changes.
          </span>
          {nameCooldownText && (
            <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
              <Timer className="w-3 h-3" /> {nameCooldownText}
            </span>
          )}
        </div>

        {/* Country */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Faction Region (Flag)
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full cursor-pointer"
          >
            {FACTION_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.code})
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500">
            Associates your extraction chips to regional champion rankings. 7-day change cooldown applies.
          </span>
          {countryCooldownText && (
            <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
              <Timer className="w-3 h-3" /> {countryCooldownText}
            </span>
          )}
        </div>

        {/* Avatar customizer */}
        <div className="md:col-span-2 flex flex-col gap-3 border-t border-slate-900/60 pt-5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
            Profile Avatar / Identity Emblem
          </label>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* Left: drag-drop */}
            <div className="md:col-span-5 flex flex-col gap-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() =>
                  document.getElementById('avatar-file-input')?.click()
                }
                className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 relative group h-44 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : 'border-slate-800 bg-slate-900/40 hover:border-indigo-500/40 hover:bg-slate-900/60'
                }`}
              >
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />

                {selectedAvatar && isImageAvatar ? (
                  <div className="absolute inset-0 p-1.5 flex flex-col items-center justify-center bg-slate-950/80 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Upload className="w-6 h-6 text-indigo-400 mb-1" />
                    <span className="text-[10px] text-white font-sans font-bold">
                      CHANGE IMAGE
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5">
                      Drag &amp; Drop or Click
                    </span>
                  </div>
                ) : null}

                {selectedAvatar ? (
                  isImageAvatar ? (
                    <div className="w-24 h-24 rounded-2xl border border-indigo-500/20 overflow-hidden relative shadow-lg">
                      <img
                        src={selectedAvatar}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-4xl mb-2 shadow-inner">
                        {selectedAvatar}
                      </div>
                      <span className="text-xs font-bold text-white font-sans">
                        Preset Selected
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-sans">
                        Click here to upload custom image instead
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors mb-2.5">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white font-sans">
                      Upload Custom Photo
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Drag &amp; Drop or click to browse
                    </span>
                    <span className="text-[9px] text-slate-500 mt-0.5">
                      PNG, JPG, WebP up to 1.5MB
                    </span>
                  </div>
                )}
              </div>

              {selectedAvatar && (
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('')}
                  className="py-1.5 px-3 bg-slate-900 hover:bg-red-950/40 hover:text-red-400 hover:border-red-500/20 border border-slate-800 text-slate-400 rounded-xl text-[10px] font-sans font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset to Skin Default
                </button>
              )}
            </div>

            {/* Right: preset grid */}
            <div className="md:col-span-7 flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                Choose Preset Emblem
              </span>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AVATARS.map((p) => {
                  const isSelected = selectedAvatar === p.emoji;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedAvatar(p.emoji)}
                      className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-1.5 group hover:scale-105 h-20 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg'
                          : 'border-slate-900 bg-slate-950/40 hover:border-slate-800'
                      }`}
                      title={p.label}
                    >
                      <span className="text-2xl select-none group-hover:scale-110 transition-transform">
                        {p.emoji}
                      </span>
                      <span className="text-[8.5px] font-sans font-semibold text-slate-400 group-hover:text-slate-200 truncate w-full text-center">
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Social channels — now DB-backed */}
        <div className="md:col-span-2 flex flex-col gap-3 border-t border-slate-900/60 pt-5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-400" /> Creator Social
            Channels (Showcased on your Public Profile)
          </label>
          <p className="text-[11px] text-slate-400 font-sans">
            Link your Instagram handle, YouTube channel, and Twitch profile so
            other vipers and allies can follow you and watch your game clips!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-pink-400 font-sans uppercase">
                📸 Instagram Handle
              </label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@username (e.g. @hari_snake_god)"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-pink-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-red-400 font-sans uppercase">
                🎥 YouTube Channel / Handle
              </label>
              <input
                type="text"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="@channel or URL"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-purple-400 font-sans uppercase">
                📱 Twitch Stream Handle
              </label>
              <input
                type="text"
                value={twitch}
                onChange={(e) => setTwitch(e.target.value)}
                placeholder="twitch_username"
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 p-3.5 bg-indigo-950/20 border border-indigo-500/10 rounded-xl flex items-start gap-3">
        <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs font-sans leading-relaxed text-slate-300">
          <strong className="text-indigo-300 block mb-0.5">
            IDENTITY CHANGE COOLDOWN:
          </strong>
          Your Challenger Handle is locked for <strong className="text-amber-400">30 days</strong> after each change. Your Faction Region is locked for <strong className="text-amber-400">7 days</strong>. These cooldowns protect leaderboard and championship integrity. Your VENOM-XXXX tag is always permanent.
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-900 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" /> Save Handshake
        </button>
      </div>
    </div>
  );
}
