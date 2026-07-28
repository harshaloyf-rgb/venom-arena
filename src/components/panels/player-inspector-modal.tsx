'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  UserPlus,
  Swords,
  Ban,
  Shield,
  Trophy,
  Award,
  Zap,
  Sparkles,
  Check,
  ExternalLink,
  Globe,
  Users,
} from 'lucide-react';
import {
  INSPECTOR_ALLIES_REGIONAL,
  INSPECTOR_ALLIES_GLOBAL,
  INSPECTOR_BADGES,
  INSPECTOR_LOADOUT,
  countryFlag,
  type InspectedPlayer,
} from '@/lib/game-config';
import { toast } from 'sonner';

type ToastType = 'success' | 'error' | 'info';
type ToastFn = (msg: string, type?: ToastType) => void;

function notify(msg: string, type: ToastType, onToast?: ToastFn) {
  if (onToast) onToast(msg, type);
  else if (type === 'error') toast.error(msg);
  else if (type === 'info') toast.info(msg);
  else toast.success(msg);
}

interface PlayerInspectorModalProps {
  player?: InspectedPlayer | null;
  onClose: () => void;
  onToast?: ToastFn;
}

type Tab = 'overview' | 'stats' | 'logs' | 'loadout';

// Hardcoded career stats (per audit P.12)
const HARDCODED_HIGHEST_EXTRACTION = '1,00,00,000 c';
const HARDCODED_SUCCESS_RATE = '88.4%';
const HARDCODED_KILLS = '412 Kills';

// Hardcoded clan card (per audit P.15)
const HARDCODED_CLAN_NAME = 'Viper Apex Syndicate';
const HARDCODED_CLAN_TAG = 'APEX';
const HARDCODED_CLAN_BANK = '1,45,00,000 c Bank';
const HARDCODED_CLAN_ROLE = 'Officer • Clan Rank #1';

// Hardcoded match history (per audit P.13)
interface MatchLog {
  arena: string;
  outcome: 'Extracted' | 'Eliminated';
  chips: number;
  time: string;
  kills: number;
}

function buildMatchHistory(p: InspectedPlayer): MatchLog[] {
  const bigChip = p.bankedChips >= 10_000_000 ? 10_000_000 : 2_500_000;
  return [
    { arena: 'Tier-05 Crore High Roller', outcome: 'Extracted', chips: bigChip, time: '10 mins ago', kills: 14 },
    { arena: 'Tier-04 Platinum Arena', outcome: 'Extracted', chips: 1_500_000, time: '2 hours ago', kills: 8 },
    { arena: 'Tier-03 Viper Boundary', outcome: 'Extracted', chips: 500_000, time: '1 day ago', kills: 5 },
    { arena: 'Tier-05 Crore High Roller', outcome: 'Eliminated', chips: -200_000, time: '2 days ago', kills: 3 },
  ];
}

export function PlayerInspectorModal({ player, onClose, onToast }: PlayerInspectorModalProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [friendRequested, setFriendRequested] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Reset state when the inspected player changes (key-based remount pattern)
  // Using a `key` on the parent would be cleaner, but since we control open/close,
  // we use a ref-guarded effect to avoid cascading renders.
  const lastUserTagRef = useRef<string | undefined>(undefined);
  if (player?.userTag !== lastUserTagRef.current) {
    lastUserTagRef.current = player?.userTag;
    if (friendRequested) setFriendRequested(false);
    if (blocked) setBlocked(false);
    if (tab !== 'overview') setTab('overview');
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (player) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, onClose]);

  if (!player) return null;

  const p = player;
  const flag = p.flag || countryFlag(p.country);
  const clanTag = p.clanTag || HARDCODED_CLAN_TAG;
  const clanName = p.clanName || HARDCODED_CLAN_NAME;

  // Fallback ranks (per audit I.3)
  const globalRank = p.globalRank ?? Math.max(1, 15 - Math.floor(p.level / 3));
  const countryRank = p.countryRank ?? Math.max(1, Math.floor(globalRank / 1.4));
  const regionalRank = p.regionalRank ?? Math.max(1, Math.floor(globalRank / 2));
  const achievedAt = p.achievedAt || '26 Jul 2026, 05:42 PM UTC';

  const history = buildMatchHistory(p);

  function handleAddFriend() {
    if (friendRequested) return;
    setFriendRequested(true);
    notify(`Friend request sent to ${p.name} (${p.userTag})! 🤝`, 'success', onToast);
  }

  function handleChallenge() {
    notify(`Arena challenge dispatch sent to ${p.name}! ⚔️`, 'info', onToast);
  }

  function handleBlock() {
    if (blocked) return;
    setBlocked(true);
    notify(`Player ${p.name} has been added to your block list. 🚫`, 'error', onToast);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-inspector-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-[11px] text-amber-300 font-mono flex items-center justify-between shrink-0 mx-4 mt-4">
          <span className="flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Current Year (2026) Official Standings
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" /> Auto-updates every 30 mins
          </span>
        </div>

        {/* Avatar + identity */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3 sm:gap-4 shrink-0 pr-12">
          <div className="w-16 h-16 rounded-2xl bg-slate-950 border-2 border-amber-500/40 flex items-center justify-center text-3xl shadow-inner shrink-0 relative">
            <span aria-hidden>{flag}</span>
            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-400">
              Lvl {p.level}
            </div>
          </div>
          <div className="min-w-0">
            <h2 id="player-inspector-title" className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-1.5">
              <span className="truncate">{p.name}</span>
              <span className="text-xl" aria-hidden>{flag}</span>
            </h2>
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded inline-block mt-1">
              [{clanTag}]
            </span>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Ledger Tag: <strong className="font-mono text-amber-400">{p.userTag}</strong></span>
              <span>•</span>
              <span className="text-emerald-400 font-mono font-bold">{p.bankedChips.toLocaleString('en-IN')} c Bank</span>
            </p>
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono mt-1.5">
              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" /> Global Rank #{globalRank}
              </span>
              <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                {flag} Country Rank #{countryRank}
              </span>
              <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Region Rank #{regionalRank}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Achieved: {achievedAt}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-2 shrink-0">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold" role="tablist">
            {([
              ['overview', 'Overview'],
              ['stats', 'Career Stats'],
              ['logs', 'Extraction Logs'],
              ['loadout', 'Loadout'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 py-1.5 rounded-lg transition-all ${tab === id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto va-scroll px-4 pb-4 flex-1 min-h-0">
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-3">
              {/* Clan membership */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" /> Syndicate Clan Membership
                  </span>
                  <span className="text-[9px] text-emerald-400 font-mono">Active Member</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0" aria-hidden>🐍</span>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs truncate">
                        {clanName}
                        <span className="ml-1.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-mono font-bold px-1 py-0.2 rounded border border-indigo-500/30">
                          [{clanTag}]
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Role: {HARDCODED_CLAN_ROLE}</div>
                      <div className="text-[10px] text-emerald-400 font-mono mt-0.5">{HARDCODED_CLAN_BANK}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Regional allies */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-violet-400" /> 🇮🇳 REGIONAL ALLIES ({p.country || 'IN'} NETWORK)
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">{INSPECTOR_ALLIES_REGIONAL.length} Members</span>
                </div>
                <ul className="space-y-1.5">
                  {INSPECTOR_ALLIES_REGIONAL.map((a) => (
                    <li key={a.userTag} className="flex items-center justify-between text-xs p-2 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <span aria-hidden>{countryFlag(a.country)}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{a.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{a.userTag}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.5 rounded">{a.role}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Global allies */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" /> 🌐 GLOBAL ALLIES &amp; INTERNATIONAL ALLIANCES
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">{INSPECTOR_ALLIES_GLOBAL.length} Members</span>
                </div>
                <ul className="space-y-1.5">
                  {INSPECTOR_ALLIES_GLOBAL.map((a) => (
                    <li key={a.userTag} className="flex items-center justify-between text-xs p-2 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <span aria-hidden>{countryFlag(a.country)}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{a.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{a.userTag}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded">{a.role}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Social channels */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" /> Creator Social Channels
                  </span>
                  <span className="text-[9px] text-emerald-400 font-mono">Verified Handles</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Instagram', icon: '📸' },
                    { label: 'YouTube', icon: '🎥' },
                    { label: 'Twitch', icon: '📱' },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => notify(`Opening ${s.label} channel for ${p.name}...`, 'info', onToast)}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition"
                    >
                      <span aria-hidden>{s.icon}</span> {s.label} <ExternalLink className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Badges */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-400" /> Earned Badges &amp; Honors
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {INSPECTOR_BADGES.map((b) => (
                    <div key={b.title} className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center gap-2">
                      <span className="text-lg" aria-hidden>{b.icon}</span>
                      <div>
                        <div className="font-bold text-amber-300 text-[11px]">{b.title}</div>
                        <div className="text-[9px] text-slate-400">{b.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CAREER STATS */}
          {tab === 'stats' && (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between border-b border-slate-900 pb-1.5">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" /> Live Leaderboard Standings
                  </span>
                  <span className="text-[9px] text-emerald-400 font-mono">Real-Time Sync</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400">Global World Rank</div>
                    <div className="font-bold text-amber-400 text-sm mt-0.5">#{globalRank}</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400">{flag} Country Rank</div>
                    <div className="font-bold text-emerald-400 text-sm mt-0.5">#{countryRank}</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400">Regional Arena Rank</div>
                    <div className="font-bold text-indigo-400 text-sm mt-0.5">#{regionalRank}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Banked Chips" value={`${p.bankedChips.toLocaleString('en-IN')} c`} accent="text-emerald-400" icon={<Trophy className="w-3.5 h-3.5" />} />
                <StatCard label="Highest Extraction" value={HARDCODED_HIGHEST_EXTRACTION} accent="text-amber-400" icon={<Award className="w-3.5 h-3.5" />} />
                <StatCard label="Extraction Success Rate" value={HARDCODED_SUCCESS_RATE} accent="text-indigo-400" icon={<Zap className="w-3.5 h-3.5" />} />
                <StatCard label="Snake Eliminations" value={HARDCODED_KILLS} accent="text-rose-400" icon={<Swords className="w-3.5 h-3.5" />} />
              </div>
            </div>
          )}

          {/* EXTRACTION LOGS */}
          {tab === 'logs' && (
            <div className="space-y-2">
              {history.map((log, i) => (
                <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{log.arena}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${log.outcome === 'Extracted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        {log.outcome}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      🕒 {log.time} · {log.kills} kills
                    </div>
                  </div>
                  <div className={`font-mono font-bold tabular-nums shrink-0 ${log.chips > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {log.chips > 0 ? `+${log.chips.toLocaleString('en-IN')}c` : `${log.chips.toLocaleString('en-IN')}c`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LOADOUT */}
          {tab === 'loadout' && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              {INSPECTOR_LOADOUT.map((l) => (
                <div key={l.label} className="flex justify-between py-1.5 border-b border-slate-900 last:border-0">
                  <span className="text-slate-400">{l.label}</span>
                  <span className="font-bold text-white">{l.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 p-4 pt-2 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleAddFriend}
            disabled={friendRequested}
            className={`py-2.5 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${friendRequested ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-default' : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 shadow'}`}
          >
            {friendRequested ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {friendRequested ? 'Request Sent' : 'Add Friend'}
          </button>
          <button
            type="button"
            onClick={handleChallenge}
            className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow"
          >
            <Swords className="w-4 h-4" /> Challenge
          </button>
          <button
            type="button"
            onClick={handleBlock}
            disabled={blocked}
            className={`col-span-2 py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${blocked ? 'bg-rose-950/60 text-slate-400 border-slate-800 cursor-default' : 'bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border-rose-500/20'}`}
          >
            <Ban className="w-3.5 h-3.5" /> {blocked ? 'Player Blocked' : 'Block Player'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
      <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
        {icon} {label}
      </span>
      <span className={`font-mono font-bold text-sm block ${accent}`}>{value}</span>
    </div>
  );
}

export default PlayerInspectorModal;
