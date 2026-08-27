'use client';

import { COUNTRIES } from '@/lib/game-config';
import { Check, ExternalLink, Globe, Lock, Shield, Timer, Trash2, Upload, AlertTriangle } from 'lucide-react';

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
    <div className="border border-indigo-500/30 bg-slate-950/80 rounded-2xl p-5 lg:p-2 mb-6 lg:mb-0">
      <div className="flex items-center gap-3 lg:gap-1.5 border-b border-slate-800 pb-4 lg:pb-1.5 mb-4 lg:mb-1.5">
        <div className="p-2.5 lg:p-1 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
          <Lock className="w-5 h-5 lg:w-3 lg:h-3 animate-pulse" />
        </div>
        <div className="lg:leading-tight">
          <h3 className="text-base lg:text-[11px] font-bold text-white font-sans">
            Handshake Registration Protocol
          </h3>
          <p className="text-xs lg:text-[11px] text-slate-400">
            Lock down your tournament handle and regional alignment.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-2">
        {/* Nickname */}
        <div className="flex flex-col gap-1.5 lg:gap-0.5">
          <label className="text-xs lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
            Challenger Handle
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={20}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm lg:text-xs px-3.5 lg:px-2 py-2 lg:py-1 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full"
            placeholder="Enter nickname"
          />
          <span className="text-[11px] text-slate-500">
            Max 20 characters. VENOM-XXXX tag is permanent.
          </span>
          {nameCooldownText && (
            <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
              <Timer className="w-3 h-3" /> {nameCooldownText}
            </span>
          )}
        </div>

        {/* Country */}
        <div className="flex flex-col gap-1.5 lg:gap-0.5">
          <label className="text-xs lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
            Faction Region (Flag)
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white font-sans text-sm lg:text-xs px-3.5 lg:px-2 py-2 lg:py-1 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all w-full cursor-pointer"
          >
            {FACTION_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.code})
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-500">
            7-day change cooldown applies.
          </span>
          {countryCooldownText && (
            <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
              <Timer className="w-3 h-3" /> {countryCooldownText}
            </span>
          )}
        </div>

        {/* Avatar customizer */}
        <div className="md:col-span-2 flex flex-col gap-3 lg:gap-1.5 border-t border-slate-900/60 pt-5 lg:pt-2">
          <label className="text-xs lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
            Profile Avatar / Identity Emblem
          </label>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-2 items-start">
            {/* Left: drag-drop */}
            <div className="lg:col-span-4 flex flex-col gap-3 lg:gap-1">
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
                className={`border-2 border-dashed rounded-2xl p-5 lg:p-2 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 relative group h-44 lg:h-20 ${
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
                    <span className="text-[11px] text-white font-sans font-bold">
                      CHANGE IMAGE
                    </span>
                  </div>
                ) : null}

                {selectedAvatar ? (
                  isImageAvatar ? (
                    <div className="w-24 h-24 lg:w-12 lg:h-12 rounded-2xl border border-indigo-500/20 overflow-hidden relative shadow-lg">
                      <img
                        src={selectedAvatar}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 lg:w-10 lg:h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-4xl lg:text-2xl mb-2 lg:mb-0.5 shadow-inner">
                        {selectedAvatar}
                      </div>
                      <span className="text-xs lg:text-[11px] font-bold text-white font-sans">
                        Preset Selected
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 lg:w-8 lg:h-8 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors mb-2.5 lg:mb-0.5">
                      <Upload className="w-5 h-5 lg:w-3.5 lg:h-3.5" />
                    </div>
                    <span className="text-xs lg:text-[11px] font-bold text-white font-sans">
                      Upload Custom Photo
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Click to browse (max 1.5MB)
                    </span>
                  </div>
                )}
              </div>

              {selectedAvatar && (
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('')}
                  className="py-1.5 lg:py-1 px-3 lg:px-2 bg-slate-900 hover:bg-red-950/40 hover:text-red-400 hover:border-red-500/20 border border-slate-800 text-slate-400 rounded-xl text-[11px] font-sans font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5 lg:w-3 lg:h-3" /> Reset to Skin Default
                </button>
              )}
            </div>

            {/* Right: preset grid */}
            <div className="lg:col-span-8 flex flex-col gap-2.5 lg:gap-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                Choose Preset Emblem
              </span>
              <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 lg:gap-1">
                {PRESET_AVATARS.map((p) => {
                  const isSelected = selectedAvatar === p.emoji;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedAvatar(p.emoji)}
                      className={`p-3 lg:p-1 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-1.5 lg:gap-0 group hover:scale-105 h-20 lg:h-auto lg:py-1 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg'
                          : 'border-slate-900 bg-slate-950/40 hover:border-slate-800'
                      }`}
                      title={p.label}
                    >
                      <span className="text-2xl lg:text-base select-none group-hover:scale-110 transition-transform">
                        {p.emoji}
                      </span>
                      <span className="text-[11px] font-sans font-semibold text-slate-400 group-hover:text-slate-200 truncate w-full text-center">
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
        <div className="md:col-span-2 flex flex-col gap-3 lg:gap-1.5 border-t border-slate-900/60 pt-5 lg:pt-2">
          <label className="text-xs lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-2">
            <Globe className="w-4 h-4 lg:w-3 lg:h-3 text-purple-400" /> Creator Social
            Channels
          </label>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-2">
            <div className="flex flex-col gap-1.5 lg:gap-0.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-pink-400 font-sans uppercase">
                  📸 Instagram Handle
                </label>
                {instagram && (
                  <a
                    href={`https://instagram.com/${instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-0.5 transition"
                    title="Open profile to verify ownership"
                  >
                    Verify <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                placeholder="username (no @)"
                maxLength={30}
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 lg:px-2 py-2 lg:py-1 rounded-xl focus:outline-none focus:border-pink-500"
              />
              {instagram && (instagram.startsWith('http') || instagram.includes('/')) && (
                <span className="text-[10px] text-amber-400 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Enter only the username, not a full URL</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5 lg:gap-0.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-red-400 font-sans uppercase">
                  🎥 YouTube Channel
                </label>
                {youtube && (
                  <a
                    href={youtube.startsWith('http') ? youtube : `https://youtube.com/@${youtube.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5 transition"
                    title="Open channel to verify ownership"
                  >
                    Verify <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <input
                type="text"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="@channel or URL"
                maxLength={100}
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 lg:px-2 py-2 lg:py-1 rounded-xl focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex flex-col gap-1.5 lg:gap-0.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-purple-400 font-sans uppercase">
                  📱 Twitch Handle
                </label>
                {twitch && (
                  <a
                    href={`https://twitch.tv/${twitch}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5 transition"
                    title="Open channel to verify ownership"
                  >
                    Verify <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <input
                type="text"
                value={twitch}
                onChange={(e) => setTwitch(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="username"
                maxLength={25}
                className="bg-slate-900 border border-slate-800 text-white font-sans text-xs px-3 lg:px-2 py-2 lg:py-1 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex items-start gap-1.5 p-2 lg:p-1 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-amber-400">Only link your own accounts.</strong> Click "Verify" to confirm ownership. Impersonating other creators may result in account restrictions.
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 lg:mt-2 p-3.5 lg:p-1.5 bg-indigo-950/20 border border-indigo-500/10 rounded-xl flex items-start gap-3 lg:gap-1.5">
        <Shield className="w-4 h-4 lg:w-3 lg:h-3 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs lg:text-[11px] font-sans leading-relaxed text-slate-300">
          <strong className="text-indigo-300 block mb-0.5">
            IDENTITY CHANGE COOLDOWN:
          </strong>
          Handle locked <strong className="text-amber-400">30 days</strong>, Region locked <strong className="text-amber-400">7 days</strong> after each change. VENOM-XXXX tag is always permanent.
        </div>
      </div>

      <div className="mt-5 lg:mt-2 flex justify-end gap-2.5 lg:gap-2 border-t border-slate-900 pt-4 lg:pt-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 lg:px-2.5 py-2 lg:py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs lg:text-[11px] font-bold transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 lg:px-2.5 py-2 lg:py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs lg:text-[11px] font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4 lg:w-3 lg:h-3" /> Save Handshake
        </button>
      </div>
    </div>
  );
}
