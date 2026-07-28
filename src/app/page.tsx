'use client';

/**
 * Venom Arena — main app shell (BUILD-6).
 *
 * Replicates the dark slate + indigo AAA dashboard from the original
 * `upload/extracted/src/App.tsx` while wiring into the new server-
 * authoritative BUILD-2/3/4 stack:
 *   - `useAuth()` for player data + logout
 *   - `<GameCanvas />` (BUILD-3) when an arena is active
 *   - The 8 BUILD-4 panels + 4 new BUILD-6 placeholders (Championships,
 *     SeasonPass, ClipShowcase, AdminPanel) + GameRulesModal
 *
 * Layout: sticky header → main (dashboard OR sub-page nav + content) →
 * sticky footer (`min-h-screen flex flex-col` + `mt-auto`).
 */

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Landmark,
  Compass,
  Shield,
  User,
  Trophy,
  Gift,
  ShoppingBag,
  Coins,
  Sparkles,
  Users,
  ChevronLeft,
  Play,
  ListTodo,
  Award,
  LogOut,
  Film,
  BookOpen,
  Crown,
  Loader2,
} from 'lucide-react';

import { useAuth } from '@/components/providers/auth-provider';
import AuthGate from '@/components/auth/auth-gate';
import { GameCanvas } from '@/components/game/game-canvas';
import { ArenaSelector } from '@/components/panels/arena-selector';
import { CosmeticsShop } from '@/components/panels/cosmetics-shop';
import { PlayerProfilePanel } from '@/components/panels/player-profile';
import { Leaderboards } from '@/components/panels/leaderboards';
import { DailyRewards } from '@/components/panels/daily-rewards';
import { ChipStore } from '@/components/panels/chip-store';
import { SocialPanel } from '@/components/panels/social-panel';
import { ClanSystem } from '@/components/panels/clan-system';
import { HallOfFame } from '@/components/panels/hall-of-fame';
import { Championships } from '@/components/panels/championships';
import { SeasonPass } from '@/components/panels/season-pass';
import { ClipShowcase } from '@/components/panels/clip-showcase';
import { AdminPanel } from '@/components/panels/admin-panel';
import { PlayerInspectorModal } from '@/components/panels/player-inspector-modal';
import { GameRulesModal } from '@/components/modals/game-rules-modal';

import { xpForLevel, type InspectedPlayer } from '@/lib/game-config';
import type { MatchResult } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId =
  | 'dashboard'
  | 'arena'
  | 'shop'
  | 'profile'
  | 'leaderboard'
  | 'championships'
  | 'halloffame'
  | 'clans'
  | 'seasonpass'
  | 'clips'
  | 'rewards'
  | 'store'
  | 'social'
  | 'admin';

interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
  target: number;
  current: number;
  completed: boolean;
  claimed: boolean;
}

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof Compass;
  activeColor: string; // tailwind classes applied when active
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'arena', label: 'Play', icon: Compass, activeColor: 'text-indigo-400 bg-indigo-600/10 border-indigo-500/30' },
  { id: 'shop', label: 'Shop & Lab', icon: ShoppingBag, activeColor: 'text-purple-400 bg-purple-600/10 border-purple-500/30' },
  { id: 'profile', label: 'Dossier', icon: User, activeColor: 'text-blue-400 bg-blue-600/10 border-blue-500/30' },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, activeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'championships', label: 'Championships', icon: Crown, activeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'halloffame', label: 'Hall of Fame', icon: Award, activeColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  { id: 'clans', label: 'Syndicates', icon: Shield, activeColor: 'text-indigo-400 bg-indigo-600/10 border-indigo-500/30' },
  { id: 'seasonpass', label: 'Pass', icon: Sparkles, activeColor: 'text-purple-400 bg-purple-600/10 border-purple-500/30' },
  { id: 'clips', label: 'Highlights', icon: Film, activeColor: 'text-red-400 bg-red-600/10 border-red-500/30' },
  { id: 'rewards', label: 'Claims', icon: Gift, activeColor: 'text-emerald-400 bg-emerald-600/10 border-emerald-500/30' },
  { id: 'store', label: 'Vault', icon: Coins, activeColor: 'text-emerald-400 bg-emerald-600/10 border-emerald-500/30' },
  { id: 'social', label: 'Friends & Search', icon: Users, activeColor: 'text-violet-400 bg-violet-600/10 border-violet-500/30' },
  { id: 'admin', label: 'Admin', icon: Shield, activeColor: 'text-red-400 bg-red-600/10 border-red-500/30', adminOnly: true },
];

const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'mission-1',
    title: 'Survive and Thrive',
    description: 'Successfully extract with at least 50 chips in a single match.',
    reward: 25,
    target: 1,
    current: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'mission-2',
    title: 'Apex Hunter',
    description: 'Eliminate 5 rival snakes (head-to-body collisions) in any arena.',
    reward: 50,
    target: 5,
    current: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'mission-3',
    title: 'Star Grabber',
    description: 'Collect 15 star-chips dropped by fallen opponents.',
    reward: 40,
    target: 15,
    current: 0,
    completed: false,
    claimed: false,
  },
  {
    id: 'mission-4',
    title: 'High Stakes Entry',
    description: 'Enter Neon Grid (100 chips buy-in) or higher arena.',
    reward: 30,
    target: 1,
    current: 0,
    completed: false,
    claimed: false,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home() {
  const { player, loading, logout, refresh } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [activeArenaId, setActiveArenaId] = useState<string | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS);
  const [lastResult, setLastResult] = useState<MatchResult | undefined>(undefined);
  const [inspectedPlayer, setInspectedPlayer] = useState<InspectedPlayer | null>(null);
  const [toastFn] = useState<(msg: string, type?: 'success' | 'error' | 'info') => void>(() => (msg: string, type?: 'success' | 'error' | 'info') => {
    if (type === 'error') toast.error(msg);
    else if (type === 'info') toast.info(msg);
    else toast.success(msg);
  });

  const handleInspectPlayer = useCallback((p: InspectedPlayer) => {
    setInspectedPlayer(p);
  }, []);

  // Filter tabs by admin role (must run before any early return).
  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.adminOnly || player?.role === 'admin'),
    [player?.role],
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleExitGame = useCallback(
    (result?: MatchResult) => {
      setActiveArenaId(null);
      if (result) {
        setLastResult(result);
        if (result.outcome === 'extract') {
          toast.success(
            `🏆 Extracted ${result.chipsExtracted.toLocaleString()}c from ${result.arenaName}! +${result.xpGained} XP`,
          );
          // Mark the "Survive and Thrive" mission progress if applicable
          if (result.chipsExtracted >= 50) {
            setMissions((prev) =>
              prev.map((m) =>
                m.id === 'mission-1' && !m.completed
                  ? { ...m, current: m.target, completed: true }
                  : m,
              ),
            );
          }
        } else {
          toast.error(`💀 Eliminated in ${result.arenaName}. ${result.kills} kill(s) this match.`);
        }
      }
      // Refresh player profile so header chips reflect the new bank balance.
      void refresh();
    },
    [refresh],
  );

  const handlePlayArena = useCallback(
    (arenaId: string) => {
      if (!player) return;
      setActiveArenaId(arenaId);
      // Mark the "High Stakes Entry" mission progress (buy-in ≥ 100c) — flavor.
      // The real buy-in accounting happens server-side in /api/match/join.
      if (arenaId === 'tier-2' || arenaId === 'tier-3' || arenaId === 'tier-4' || arenaId === 'tier-5') {
        setMissions((prev) =>
          prev.map((m) =>
            m.id === 'mission-4' && !m.completed
              ? { ...m, current: m.target, completed: true }
              : m,
          ),
        );
      }
    },
    [player],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setActiveTab('dashboard');
    setActiveArenaId(null);
    toast.info('Secure session disconnected. 🔒');
  }, [logout]);

  const claimMission = useCallback(
    (mission: Mission) => {
      if (!mission.completed || mission.claimed) return;
      setMissions((prev) =>
        prev.map((m) => (m.id === mission.id ? { ...m, claimed: true } : m)),
      );
      toast.success(`Challenge reward claimed: +${mission.reward}c!`);
      // In a future iteration this should POST to /api/player/mission-claim
      // to credit the banked chips server-side. For now we just refresh so
      // any other concurrent changes show up.
      void refresh();
    },
    [refresh],
  );

  // -------------------------------------------------------------------------
  // Loading / Auth / Game-canvas gates
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400">Loading arena…</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return <AuthGate />;
  }

  if (activeArenaId) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-slate-950">
        <GameCanvas arenaId={activeArenaId} player={player} onExit={handleExitGame} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // XP progress (proper curve via xpForLevel)
  // -------------------------------------------------------------------------

  const xpThisLevel = xpForLevel(player.level);
  const xpNextLevel = xpForLevel(player.level + 1);
  const xpIntoLevel = Math.max(0, player.xp - xpThisLevel);
  const xpSpan = Math.max(1, xpNextLevel - xpThisLevel);
  const xpPercent = Math.min(100, Math.floor((xpIntoLevel / xpSpan) * 100));

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* ============= HEADER ============= */}
      <header className="border-b border-slate-900 bg-slate-950/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo + title */}
          <button
            onClick={() => {
              setActiveTab('dashboard');
            }}
            className="flex items-center gap-3 cursor-pointer group select-none"
            aria-label="Return to lobby dashboard"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-950/40 border border-indigo-400/20 group-hover:scale-105 transition duration-200">
              <Compass className="w-5 h-5 text-white va-spin-slow" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-extrabold tracking-tight text-white font-sans flex items-center gap-1.5 uppercase group-hover:text-indigo-400 transition duration-200">
                Project Venom
                <span className="text-xs px-2 py-0.5 bg-indigo-500 text-white font-bold rounded-full leading-none tracking-widest font-mono">
                  Arena
                </span>
              </h1>
              <span className="text-[10px] text-slate-500 block font-mono">
                STORES-SAFE COMPLIANT VERSION
              </span>
            </div>
          </button>

          {/* Account controls */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
            {/* Player badge */}
            <div className="bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800/80 text-xs overflow-hidden shrink-0 shadow-inner">
                {player.avatar ? (
                  player.avatar.startsWith('data:') || player.avatar.startsWith('http') ? (
                    <img
                      src={player.avatar}
                      alt={player.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="select-none text-base">{player.avatar}</span>
                  )
                ) : (
                  <span className="select-none text-[10px] font-mono font-bold text-slate-400">
                    {player.level}
                  </span>
                )}
              </div>
              <div className="text-left leading-none">
                <span className="text-[9px] text-slate-500 block uppercase font-semibold">
                  Challenger (Lvl {player.level})
                </span>
                <span className="text-xs font-bold font-sans text-white truncate max-w-28 block">
                  {player.name}
                </span>
              </div>
            </div>

            {/* Chips wallet */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-2.5">
              <Coins className="w-4 h-4 text-emerald-400 animate-pulse" />
              <div className="text-left leading-none">
                <span className="text-[9px] text-emerald-500/60 block uppercase font-semibold">
                  Secure Chips
                </span>
                <span className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
                  {player.bankedChips.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Rules & Guide */}
            <button
              onClick={() => setIsRulesOpen(true)}
              className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 p-2 py-2.5 rounded-xl transition duration-200 cursor-pointer flex items-center gap-1.5 shadow"
              title="Official Guide, Rules & FAQ"
            >
              <BookOpen className="w-4 h-4 text-indigo-400 group-hover:text-white" />
              <span className="text-xs font-bold font-sans hidden sm:inline">Rules &amp; Guide</span>
            </button>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              className="bg-slate-900/60 hover:bg-red-950/40 hover:text-red-400 hover:border-red-500/20 border border-slate-800/80 p-2 py-2.5 rounded-xl transition duration-200 cursor-pointer flex items-center gap-1.5"
              title="Secure Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-bold font-sans hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============= MAIN ============= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col justify-start">
        {/* ========== DASHBOARD TAB ========== */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full va-fade-in">
            {/* LEFT COLUMN: Hero + Bento gates (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Hero banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/80 border border-indigo-500/10 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center gap-4 relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-950/40 border border-indigo-400/20 shrink-0">
                    <Award className="w-7 h-7 text-white animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-widest block uppercase">
                      Lobby Headquarters
                    </span>
                    <h2 className="text-xl font-black text-white font-sans tracking-tight mt-0.5">
                      WELCOME BACK, {player.name.toUpperCase()}
                    </h2>
                    {/* XP progress bar */}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] font-mono text-slate-400">LVL {player.level}</span>
                      <div className="w-36 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${xpPercent}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-500">
                        {xpIntoLevel.toLocaleString()} / {xpSpan.toLocaleString()} XP
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('arena');
                  }}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-xs flex items-center gap-2 transition duration-200 cursor-pointer shadow-lg shadow-indigo-950/40 border border-indigo-500 shrink-0 self-stretch sm:self-auto justify-center"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> LAUNCH MATCHMAKER
                </button>
              </div>

              {/* Bento grid of lobby stations */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                  Lobby Stations
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Gate 1: Play Endless Arenas */}
                  <BentoGate
                    onClick={() => setActiveTab('arena')}
                    icon={Compass}
                    accent="indigo"
                    badge="Battle Gate"
                    title="Play Endless Arenas"
                    desc="Risk chips to compete in simulated multiplayer shards. Harvest dropping stars and escape safely."
                    footLeft="STAKES FROM: 10 chips"
                    footRight="Enter"
                  />

                  {/* Gate 2: Identity Workshop & Shop */}
                  <BentoGate
                    onClick={() => setActiveTab('shop')}
                    icon={ShoppingBag}
                    accent="purple"
                    badge="Customize Lab"
                    title="Identity Workshop & Shop"
                    desc="Unlock glowing skins, trials, death burst novas, or design a custom repeating body segment sequence."
                    footLeft={`EQUIPPED: ${player.currentSkin ? 'Custom DNA' : 'Gallery Skin'}`}
                    footRight="Modify"
                  />

                  {/* Gate 3: Challenger Dossier */}
                  <BentoGate
                    onClick={() => setActiveTab('profile')}
                    icon={User}
                    accent="blue"
                    badge="My Record"
                    title="Challenger Dossier"
                    desc="Examine your records, high scores, total banked wealth, and change your operative callsign."
                    footLeft={`HIGH SCORE: ${(player.biggestExtract || 0).toLocaleString()}`}
                    footRight="Inspect"
                  />

                  {/* Gate 4: Global Standings */}
                  <BentoGate
                    onClick={() => setActiveTab('leaderboard')}
                    icon={Trophy}
                    accent="amber"
                    badge="Elite Standings"
                    title="Global Standings"
                    desc="Track rank placements and compare your banked chip balance against other elite venom snake operators."
                    footLeft="LEADERBOARD RANK: Tier 1"
                    footRight="View"
                  />

                  {/* Gate 5: Daily Free Claims */}
                  <BentoGate
                    onClick={() => setActiveTab('rewards')}
                    icon={Gift}
                    accent="emerald"
                    badge="Complimentary"
                    title="Daily Free Claims"
                    desc="Secure your complimentary login chips. Claim hourly or daily packages to rebuild your wallet!"
                    footLeft={`STREAK: ${player.dailyStreak || 1} Days`}
                    footRight="Claim"
                  />

                  {/* Gate 6: Virtual Chip Store */}
                  <BentoGate
                    onClick={() => setActiveTab('store')}
                    icon={Coins}
                    accent="emerald"
                    badge="Secure Vault"
                    title="Virtual Chip Store"
                    desc="Acquire secure safe-guarded chip packs immediately to compete in high-stakes premium arena tables."
                    footLeft={`WALLET: ${player.bankedChips.toLocaleString()} c`}
                    footRight="Shop"
                  />

                  {/* Gate 7: Friends, Global Search & Syndicate Hub (wide) */}
                  <BentoGate
                    onClick={() => setActiveTab('social')}
                    icon={Users}
                    accent="violet"
                    badge="Friends & Global Search"
                    title="Friends, Global Search & Syndicate Hub"
                    desc="Search and connect with players globally by tag or country flag (🇮🇳, 🇺🇸, 🇯🇵, etc.), send daily chip gifts (+25c), spectate matches, and create co-op team codes!"
                    footLeft="GLOBAL PLAYER NETWORK READY"
                    footRight="Search & Connect"
                    wide
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Tactical Challenges (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <section
                id="challenges-dashboard-panel"
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col gap-4"
                aria-label="Daily tactical challenges"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <span className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                      Tactical Challenges
                    </span>
                  </div>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>

                <div className="flex flex-col gap-3.5">
                  {missions.map((m) => {
                    const percent = Math.min(100, Math.floor((m.current / m.target) * 100));
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-white font-sans leading-snug">
                              {m.title}
                            </h4>
                            <p className="text-[10.5px] text-slate-400 font-sans mt-1 leading-normal">
                              {m.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                          <span>PROGRESS:</span>
                          <span>
                            {m.current} / {m.target} ({percent}%)
                          </span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/60">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              m.claimed
                                ? 'bg-emerald-600'
                                : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-900/40">
                          <span className="text-[10px] font-mono font-bold text-emerald-400">
                            +{m.reward} CHIPS
                          </span>
                          <button
                            onClick={() => claimMission(m)}
                            disabled={!m.completed || m.claimed}
                            className={`px-3 py-1 rounded-lg text-[10px] font-sans font-bold transition-all cursor-pointer ${
                              m.claimed
                                ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                                : m.completed
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-black shadow shadow-emerald-950/20'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {m.claimed ? 'Claimed ✓' : 'Claim'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Last-match summary */}
                {lastResult && (
                  <div className="mt-2 p-3 rounded-xl border border-slate-800 bg-slate-950/80">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                      Last Match
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-base">
                        {lastResult.outcome === 'extract' ? '🏆' : '💀'}
                      </span>
                      <div className="text-[11px] text-slate-300 leading-tight">
                        <p className="font-bold text-white">
                          {lastResult.outcome === 'extract' ? 'Extracted' : 'Eliminated'} ·{' '}
                          {lastResult.arenaName}
                        </p>
                        <p className="text-slate-500">
                          {lastResult.chipsExtracted.toLocaleString()}c · {lastResult.kills} kills ·
                          +{lastResult.xpGained} XP · {Math.floor(lastResult.durationSeconds)}s
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ========== SUB-PAGE NAV + CONTENT ========== */}
        {activeTab !== 'dashboard' && (
          <div className="w-full va-fade-in">
            {/* Top nav: back button + breadcrumb + tab strip */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 mb-6 shadow-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-all cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <ChevronLeft className="w-4 h-4 text-indigo-400" /> Lobby HQ
                </button>
                <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />
                <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
                  STATION / {activeTab.toUpperCase()}
                </div>
              </div>

              {/* Horizontal scrollable tab strip */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 overflow-x-auto max-w-full no-scrollbar">
                {visibleTabs.map((tab) => {
                  const active = activeTab === tab.id;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-transparent shrink-0 ${
                        active
                          ? `${tab.activeColor} border`
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content */}
            <div className="w-full">
              {activeTab === 'arena' && <ArenaSelector onPlay={handlePlayArena} />}

              {activeTab === 'shop' && <CosmeticsShop />}
              {activeTab === 'profile' && <PlayerProfilePanel />}
              {activeTab === 'leaderboard' && <Leaderboards onInspectPlayer={handleInspectPlayer} onToast={toastFn} />}
              {activeTab === 'championships' && <Championships onToast={toastFn} />}
              {activeTab === 'halloffame' && <HallOfFame onInspectPlayer={handleInspectPlayer} onToast={toastFn} />}
              {activeTab === 'clans' && <ClanSystem onInspectPlayer={handleInspectPlayer} onToast={toastFn} />}
              {activeTab === 'seasonpass' && <SeasonPass onToast={toastFn} />}
              {activeTab === 'clips' && <ClipShowcase onInspectPlayer={handleInspectPlayer} onToast={toastFn} />}
              {activeTab === 'rewards' && <DailyRewards onToast={toastFn} />}
              {activeTab === 'store' && <ChipStore onToast={toastFn} />}
              {activeTab === 'social' && <SocialPanel onToast={toastFn} />}
              {activeTab === 'admin' && player.role === 'admin' && <AdminPanel onToast={toastFn} />}
            </div>
          </div>
        )}
      </main>

      {/* ============= FOOTER ============= */}
      <footer className="border-t border-slate-900/60 bg-slate-950/40 py-6 mt-auto text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-sans">
            &copy; 2026 Project Venom Arena. All Rights Reserved. Fully store-safe, non-gambling gameplay edition.
          </p>
          <div className="flex gap-4 font-mono text-[10px] text-slate-400">
            <span>APP_VERSION: 1.0.0-MVP</span>
            <span>ENGINE: TSX_CANVAS</span>
          </div>
        </div>
      </footer>

      {/* ============= MODALS ============= */}
      <GameRulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <PlayerInspectorModal player={inspectedPlayer} onClose={() => setInspectedPlayer(null)} onToast={toastFn} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bento gate card (dashboard quick-link)
// ---------------------------------------------------------------------------

interface BentoGateProps {
  icon: typeof Compass;
  accent: 'indigo' | 'purple' | 'blue' | 'amber' | 'yellow' | 'emerald' | 'violet' | 'red';
  badge: string;
  title: string;
  desc: string;
  footLeft: string;
  footRight: string;
  onClick: () => void;
  wide?: boolean;
}

const ACCENT_CLASSES: Record<
  BentoGateProps['accent'],
  { iconBg: string; badgeBg: string; borderHover: string; textHover: string; arrow: string }
> = {
  indigo: {
    iconBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    badgeBg: 'bg-indigo-500/15 border-indigo-500/20 text-indigo-400',
    borderHover: 'hover:border-indigo-500/40',
    textHover: 'group-hover:text-indigo-400',
    arrow: 'text-indigo-400',
  },
  purple: {
    iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    badgeBg: 'bg-purple-500/15 border-purple-500/20 text-purple-400',
    borderHover: 'hover:border-purple-500/40',
    textHover: 'group-hover:text-purple-400',
    arrow: 'text-purple-400',
  },
  blue: {
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    badgeBg: 'bg-blue-500/15 border-blue-500/20 text-blue-400',
    borderHover: 'hover:border-blue-500/40',
    textHover: 'group-hover:text-blue-400',
    arrow: 'text-blue-400',
  },
  amber: {
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    badgeBg: 'bg-amber-500/15 border-amber-500/20 text-amber-400',
    borderHover: 'hover:border-amber-500/40',
    textHover: 'group-hover:text-amber-400',
    arrow: 'text-amber-400',
  },
  yellow: {
    iconBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    badgeBg: 'bg-yellow-500/15 border-yellow-500/20 text-yellow-400',
    borderHover: 'hover:border-yellow-500/40',
    textHover: 'group-hover:text-yellow-400',
    arrow: 'text-yellow-400',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400',
    borderHover: 'hover:border-emerald-500/40',
    textHover: 'group-hover:text-emerald-400',
    arrow: 'text-emerald-400',
  },
  violet: {
    iconBg: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    badgeBg: 'bg-cyan-500/15 border-cyan-500/20 text-cyan-300',
    borderHover: 'hover:border-violet-500/40',
    textHover: 'group-hover:text-violet-400',
    arrow: 'text-violet-400',
  },
  red: {
    iconBg: 'bg-red-500/10 border-red-500/20 text-red-400',
    badgeBg: 'bg-red-500/15 border-red-500/20 text-red-400',
    borderHover: 'hover:border-red-500/40',
    textHover: 'group-hover:text-red-400',
    arrow: 'text-red-400',
  },
};

function BentoGate({
  icon: Icon,
  accent,
  badge,
  title,
  desc,
  footLeft,
  footRight,
  onClick,
  wide,
}: BentoGateProps) {
  const c = ACCENT_CLASSES[accent];
  return (
    <button
      onClick={onClick}
      className={`p-5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 ${c.borderHover} rounded-2xl cursor-pointer transition-all duration-300 group shadow-md flex flex-col justify-between h-44 text-left ${
        wide ? 'sm:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-xl ${c.iconBg} border flex items-center justify-center group-hover:scale-110 transition-transform`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <span
          className={`text-[9px] px-2 py-0.5 ${c.badgeBg} border font-bold font-sans rounded-full uppercase`}
        >
          {badge}
        </span>
      </div>
      <div>
        <h3 className={`text-sm font-bold text-white ${c.textHover} transition-colors`}>
          {title}
        </h3>
        <p className="text-xs text-slate-400 font-sans mt-1 line-clamp-2 leading-relaxed">
          {desc}
        </p>
      </div>
      <div className="text-[10px] font-mono text-slate-500 border-t border-slate-800/40 pt-2 flex justify-between">
        <span className="truncate pr-2">{footLeft}</span>
        <span className={`${c.arrow} group-hover:translate-x-1 transition-transform shrink-0`}>
          {footRight} →
        </span>
      </div>
    </button>
  );
}

