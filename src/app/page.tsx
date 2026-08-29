'use client';

/**
 * Venom Arena — main app shell (BUILD-7 — Mobile-First Scroll-Free).
 *
 * Mobile:  h-dvh locked viewport → slim header + content + bottom tab bar. Zero scroll.
 * Desktop: natural min-h-screen → full header + bento grid + footer. Can scroll.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Compass, Shield, User, Trophy, Gift, ShoppingBag, Coins,
  Sparkles, Users, ChevronLeft, Play, ListTodo, Award,
  LogOut, Film, BookOpen, Crown, Loader2, Sunrise, Star,
  MoreHorizontal, Swords,
} from 'lucide-react';

import { useAuth } from '@/components/providers/auth-provider';
import { PASS_TIER_XP } from '@/lib/game-config';
import AuthGate from '@/components/auth/auth-gate';
import SnakeGame from '@/components/game/SnakeGame';
import OnlineSnakeGame from '@/components/game/OnlineSnakeGame';
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
import { PlayerInspectorModal} from '@/components/panels/player-inspector-modal';
import { GameRulesModal } from '@/components/modals/game-rules-modal';
import { BottomTabBar } from '@/components/layout/bottom-tab-bar';
import { ScrollTabStrip } from '@/components/layout/scroll-tab-strip';
import { MoreMenu } from '@/components/layout/more-menu';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { xpForLevel, type InspectedPlayer } from '@/lib/game-config';
import type { MatchResult } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId =
  | 'dashboard' | 'arena' | 'shop' | 'profile' | 'leaderboard'
  | 'championships' | 'halloffame' | 'clans' | 'seasonpass'
  | 'clips' | 'rewards' | 'store' | 'social' | 'admin';

interface Mission {
  id: string;
  type: 'daily' | 'weekly';
  title: string;
  description: string;
  reward: number;
  target: number;
  current: number;
  completed: boolean;
  claimed: boolean;
  periodStart: string;
}

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof Compass;
  activeColor: string;
}

const TABS: TabDef[] = [
  { id: 'arena', label: 'Play', icon: Compass, activeColor: 'text-indigo-400 bg-indigo-600/10 border-indigo-500/30' },
  { id: 'shop', label: 'Shop & Lab', icon: ShoppingBag, activeColor: 'text-purple-400 bg-purple-600/10 border-purple-500/30' },
  { id: 'profile', label: 'Agent Profile', icon: User, activeColor: 'text-blue-400 bg-blue-600/10 border-blue-500/30' },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, activeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'championships', label: 'Championships', icon: Crown, activeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'halloffame', label: 'Hall of Fame', icon: Award, activeColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  { id: 'clans', label: 'Syndicates', icon: Shield, activeColor: 'text-indigo-400 bg-indigo-600/10 border-indigo-500/30' },
  { id: 'seasonpass', label: 'Pass', icon: Sparkles, activeColor: 'text-purple-400 bg-purple-600/10 border-purple-500/30' },
  { id: 'clips', label: 'Highlights', icon: Film, activeColor: 'text-red-400 bg-red-600/10 border-red-500/30' },
  { id: 'rewards', label: 'Claims', icon: Gift, activeColor: 'text-emerald-400 bg-emerald-600/10 border-emerald-500/30' },
  { id: 'store', label: 'Vault', icon: Coins, activeColor: 'text-emerald-400 bg-emerald-600/10 border-emerald-500/30' },
  { id: 'social', label: 'Friends & Search', icon: Users, activeColor: 'text-violet-400 bg-violet-600/10 border-violet-500/30' },
  { id: 'admin', label: 'Admin', icon: Shield, activeColor: 'text-red-400 bg-red-600/10 border-red-500/30' },
];

const PANEL_TITLES: Record<string, string> = {
  arena: 'Play Arena', shop: 'Shop & Lab', profile: 'Agent Profile',
  leaderboard: 'Global Standings', championships: 'Championships',
  halloffame: 'Hall of Fame', clans: 'Syndicates', seasonpass: 'Season Pass',
  clips: 'Highlights', rewards: 'Daily Claims', store: 'Chip Vault',
  social: 'Friends & Social', admin: 'Admin Panel',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home() {
  const { player, loading, logout, refresh } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [activeArenaId, setActiveArenaId] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<'online' | 'offline'>('offline');

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengeStreak, setChallengeStreak] = useState(0);
  const [streakMultiplier, setStreakMultiplier] = useState(1);
  const [challengeTier, setChallengeTier] = useState('');
  const [lastResult, setLastResult] = useState<MatchResult | undefined>(undefined);
  const [inspectedPlayer, setInspectedPlayer] = useState<InspectedPlayer | null>(null);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [toastFn] = useState<(msg: string, type?: 'success' | 'error' | 'info') => void>(() => (msg: string, type?: 'success' | 'error' | 'info') => {
    if (type === 'error') toast.error(msg);
    else if (type === 'info') toast.info(msg);
    else toast.success(msg);
  });

  const handleInspectPlayer = useCallback((p: InspectedPlayer) => { setInspectedPlayer(p); }, []);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => t.id !== 'admin' || player?.role === 'admin'),
    [player?.role],
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const fetchChallenges = useCallback(async () => {
    setChallengesLoading(true);
    try {
      const res = await fetch('/api/player/challenges');
      if (res.ok) {
        const data = await res.json();
        setMissions(data.challenges || []);
        setChallengeStreak(data.streak || 0);
        setStreakMultiplier(data.streakMultiplier || 1);
        setChallengeTier(data.tier || '');
      }
    } catch { /* non-critical */ } finally { setChallengesLoading(false); }
  }, []);

  const fetchPendingFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends/list');
      if (res.ok) {
        const data = await res.json();
        setPendingFriendCount((data.pendingReceived ?? []).length);
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { if (player) void fetchChallenges(); }, [player, fetchChallenges]);
  useEffect(() => { if (player) void fetchPendingFriends(); }, [player, fetchPendingFriends]);

  // Listen for admin panel navigation requests
  useEffect(() => {
    function handleAdminNav(e: Event) {
      const tab = (e as CustomEvent).detail;
      if (tab && typeof tab === 'string') {
        setActiveTab(tab as TabId);
      }
    }
    window.addEventListener('admin:navigate', handleAdminNav);
    return () => window.removeEventListener('admin:navigate', handleAdminNav);
  }, []);

  const handleExitGame = useCallback(
    (result?: MatchResult) => {
      setActiveArenaId(null);
      if (result) {
        setLastResult(result);
        if (result.outcome === 'extract') {
          toast.success(`🏆 Extracted ${result.chipsExtracted.toLocaleString()}c from ${result.arenaName}! +${result.xpGained} XP`);
        } else {
          toast.error(`💀 Eliminated in ${result.arenaName}. ${result.kills} kill(s) this match.`);
        }
      }
      void refresh();
      void fetchChallenges();
    },
    [refresh, fetchChallenges],
  );

  const handlePlayArena = useCallback(
    (arenaId: string, isOnline?: boolean) => { if (!player) return; setActiveArenaId(arenaId); setGameMode(isOnline ? 'online' : 'offline'); },
    [player],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setActiveTab('dashboard');
    setActiveArenaId(null);
    toast.info('Secure session disconnected. 🔒');
  }, [logout]);

  const claimMission = useCallback(
    async (mission: Mission) => {
      if (!mission.completed || mission.claimed) return;
      try {
        const res = await fetch('/api/player/challenges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: mission.id }),
        });
        if (res.ok) {
          const claimData = await res.json();
          setMissions((prev) => prev.map((m) => (m.id === mission.id ? { ...m, claimed: true } : m)));
          const xpPart = claimData.xpGained ? ` +${claimData.xpGained} XP` : '';
          if (claimData.bonusReward > 0) {
            toast.success(`Challenge claimed: +${claimData.reward}c${xpPart} (includes ${claimData.bonusReward}c streak bonus ×${claimData.streakMultiplier})!`);
          } else {
            toast.success(`Challenge claimed: +${claimData.reward}c${xpPart}!`);
          }
          void refresh();
          void fetchChallenges();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Failed to claim reward.');
        }
      } catch { toast.error('Network error while claiming reward.'); }
    },
    [refresh],
  );

  // -----------------------------------------------------------------------
  // Loading / Auth / Game-canvas gates
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400">Loading arena…</p>
        </div>
      </div>
    );
  }

  if (!player) return <AuthGate />;

  if (activeArenaId) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-slate-950">
        {gameMode === 'online' ? (
          <OnlineSnakeGame
            onExit={() => handleExitGame()}
            arenaId={activeArenaId}
          />
        ) : (
          <SnakeGame
            onExit={() => handleExitGame()}
            arenaId={activeArenaId}
          />
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // XP progress
  // -----------------------------------------------------------------------

  const xpThisLevel = xpForLevel(player.level);
  const xpNextLevel = xpForLevel(player.level + 1);
  const xpIntoLevel = Math.max(0, player.xp - xpThisLevel);
  const xpSpan = Math.max(1, xpNextLevel - xpThisLevel);
  const xpPercent = Math.min(100, Math.floor((xpIntoLevel / xpSpan) * 100));

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-dvh md:h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white md:overflow-hidden">
      {/* ===================== HEADER ===================== */}
      <header className="sticky top-0 shrink-0 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-2 h-8 md:px-3 lg:px-4 md:h-auto md:py-0">
          {/* Logo */}
          <button
            onClick={() => { setActiveTab('dashboard'); setMoreMenuOpen(false); }}
            className="flex items-center gap-1 md:gap-1.5 cursor-pointer group select-none shrink-0"
            aria-label="Return to lobby dashboard"
          >
            <div className="w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-950/40 border border-indigo-400/20 group-hover:scale-105 transition duration-200">
              <Compass className="w-3 h-3 md:w-3.5 md:h-3.5 text-white va-spin-slow" />
            </div>
            <div className="text-left hidden sm:block">
              <h1 className="text-[11px] md:text-xs font-extrabold tracking-tight text-white font-sans flex items-center gap-1.5 uppercase group-hover:text-indigo-400 transition duration-200">
                Project Venom
                <span className="text-[11px] px-1.5 py-0 bg-indigo-500 text-white font-bold rounded-full leading-none tracking-widest font-mono">
                  Arena
                </span>
              </h1>
              <span className="text-[11px] text-slate-500 block font-mono hidden md:block">
                STORES-SAFE COMPLIANT VERSION
              </span>
            </div>
            <span className="sm:hidden text-[11px] font-extrabold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
              VENOM
            </span>
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-1 md:gap-1.5">
            {/* Chips wallet */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-lg flex items-center gap-1">
              <Coins className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[11px] md:text-xs font-bold font-mono text-emerald-400 tabular-nums">
                {player.bankedChips.toLocaleString()}
              </span>
            </div>

            {/* Desktop: Player badge + Rules + Sign Out */}
            <div className="hidden md:flex items-center gap-1.5">
              <div className="bg-slate-900/60 border border-slate-800/80 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-slate-950 flex items-center justify-center border border-slate-800/80 text-xs overflow-hidden shrink-0 shadow-inner">
                  {player.avatar ? (
                    player.avatar.startsWith('data:') || player.avatar.startsWith('http') ? (
                      <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="select-none text-base">{player.avatar}</span>
                    )
                  ) : (
                    <span className="select-none text-[11px] font-mono font-bold text-slate-400">{player.level}</span>
                  )}
                </div>
                <div className="text-left leading-none">
                  <span className="text-[11px] text-slate-500 block uppercase font-semibold leading-none">Challenger (Lvl {player.level})</span>
                  <span className="text-[11px] font-bold font-sans text-white block">{player.name}</span>
                </div>
              </div>
              <button onClick={() => setIsRulesOpen(true)} className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 px-1.5 py-0.5 rounded-lg transition duration-200 cursor-pointer flex items-center gap-1 shadow" title="Official Guide, Rules & FAQ">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold font-sans">Rules &amp; Guide</span>
              </button>
              <button onClick={handleLogout} className="bg-slate-900/60 hover:bg-red-950/40 hover:text-red-400 hover:border-red-500/20 border border-slate-800/80 px-1.5 py-0.5 rounded-lg transition duration-200 cursor-pointer flex items-center gap-1" title="Secure Logout">
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold font-sans">Sign Out</span>
              </button>
            </div>

            {/* Mobile: 3-dot menu (Rules + Sign Out) */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-7 h-7 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-center cursor-pointer" aria-label="Menu">
                    <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-slate-900 border-slate-800">
                  <div className="px-1.5 py-1 border-b border-slate-800 mb-0.5">
                    <p className="text-[11px] text-slate-500 font-mono">{player.name} · LVL {player.level}</p>
                  </div>
                  <DropdownMenuItem onClick={() => setIsRulesOpen(true)} className="cursor-pointer focus:bg-slate-800">
                    <BookOpen className="w-4 h-4 mr-2 text-indigo-400" />
                    <span className="text-[11px]">Rules & Guide</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer focus:bg-red-950/40 text-red-400 focus:text-red-400">
                    <LogOut className="w-4 h-4 mr-2" />
                    <span className="text-[11px]">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* ===================== MAIN ===================== */}
      <main className="flex-1 min-h-0 flex flex-col w-full max-w-7xl mx-auto md:px-3 lg:px-4 md:py-1">

        {/* ====== DASHBOARD TAB ====== */}
        {activeTab === 'dashboard' && (
          <>
            {/* ---- Mobile Dashboard (compact) ---- */}
            <div className="md:hidden flex flex-col flex-1 px-3 py-2.5 gap-2.5 va-fade-in">
              {/* Welcome + XP bar */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center border border-indigo-400/20 shrink-0 shadow-lg">
                  {player.avatar ? (
                    player.avatar.startsWith('data:') || player.avatar.startsWith('http') ? (
                      <img src={player.avatar} alt={player.name} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="select-none text-base">{player.avatar}</span>
                    )
                  ) : (
                    <Award className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">{player.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">LVL {player.level}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${xpPercent}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 shrink-0">{xpPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-2 py-1.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Streak</span>
                  <span className="text-xs font-bold text-amber-400 font-mono">{player.dailyStreak || 1}d</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-2 py-1.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Matches</span>
                  <span className="text-xs font-bold text-white font-mono">{player.lifetimeKills + player.lifetimeDeaths || 0}</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-2 py-1.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Extracts</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">{player.lifetimeExtracts || 0}</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-2 py-1.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Best</span>
                  <span className="text-xs font-bold text-purple-400 font-mono">{(player.biggestExtract || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Quick Play CTA */}
              <button
                onClick={() => setActiveTab('arena')}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-xs flex items-center justify-center gap-2 transition duration-200 cursor-pointer shadow-lg shadow-indigo-950/40 border border-indigo-500 active:scale-[0.98]"
              >
                <Swords className="w-4 h-4" /> LAUNCH MATCHMAKER
              </button>

              {/* Last match banner */}
              {lastResult && (
                <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/80 flex items-center gap-2">
                  <span className="text-sm">{lastResult.outcome === 'extract' ? '🏆' : '💀'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">
                      {lastResult.outcome === 'extract' ? 'Extracted' : 'Eliminated'} · {lastResult.arenaName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {lastResult.chipsExtracted.toLocaleString()}c · {lastResult.kills} kills · +{lastResult.xpGained} XP
                    </p>
                  </div>
                </div>
              )}

              {/* Challenges (fills remaining height) */}
              <DashboardChallenges
                missions={missions}
                challengesLoading={challengesLoading}
                challengeTier={challengeTier}
                challengeStreak={challengeStreak}
                streakMultiplier={streakMultiplier}
                claimMission={claimMission}
                compact
              />
            </div>

            {/* ---- Desktop Dashboard (bento grid, current layout) ---- */}
            <div className="hidden md:grid md:grid-cols-12 gap-2 items-start w-full va-fade-in">
              {/* LEFT COLUMN */}
              <div className="md:col-span-8 flex flex-col gap-1">
                {/* Hero banner */}
                <div className="p-1 rounded-lg bg-gradient-to-r from-slate-900 to-indigo-950/80 border border-indigo-500/10 shadow-2xl relative overflow-hidden flex items-center justify-between gap-1.5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex items-center gap-1.5 relative">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-950/40 border border-indigo-400/20 shrink-0">
                      <Award className="w-3 h-3 text-white animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[11px] text-indigo-400 font-mono font-bold tracking-widest uppercase">Lobby Headquarters</span>
                      <h2 className="text-[11px] font-bold text-white font-sans tracking-tight">WELCOME BACK, {player.name.toUpperCase()}</h2>
                      <div className="flex items-center gap-1 mt-0">
                        <span className="text-[11px] font-mono text-slate-400">LVL {player.level}</span>
                        <div className="w-20 h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${xpPercent}%` }} />
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">{xpIntoLevel.toLocaleString()} / {xpSpan.toLocaleString()} XP</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('arena')} className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-[11px] flex items-center gap-1 transition duration-200 cursor-pointer shadow-lg shadow-indigo-950/40 border border-indigo-500 shrink-0 justify-center">
                    <Play className="w-3 h-3 fill-current" /> LAUNCH MATCHMAKER
                  </button>
                </div>

                {/* Bento grid */}
                <div className="flex flex-col gap-0">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Lobby Stations</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                    <BentoGate onClick={() => setActiveTab('arena')} icon={Compass} accent="indigo" badge="Battle Gate" title="Play Endless Arenas" desc="Risk chips to compete in simulated multiplayer shards. Harvest dropping stars and escape safely." footLeft="STAKES FROM: 10 chips" footRight="Enter" />
                    <BentoGate onClick={() => setActiveTab('shop')} icon={ShoppingBag} accent="purple" badge="Customize Lab" title="Identity Workshop & Shop" desc="Unlock glowing skins, trials, death burst novas, or design a custom repeating body segment sequence." footLeft={`EQUIPPED: ${player.currentSkin ? 'Custom DNA' : 'Gallery Skin'}`} footRight="Modify" />
                    <BentoGate onClick={() => setActiveTab('profile')} icon={User} accent="blue" badge="My Record" title="Agent Profile" desc="Examine your records, high scores, total banked wealth, and change your operative callsign." footLeft={`HIGH SCORE: ${(player.biggestExtract || 0).toLocaleString()}`} footRight="Inspect" />
                    <BentoGate onClick={() => setActiveTab('leaderboard')} icon={Trophy} accent="amber" badge="Elite Standings" title="Global Standings" desc="Track rank placements and compare your banked chip balance against other elite venom snake operators." footLeft="LEADERBOARD RANK: Tier 1" footRight="View" />
                    <BentoGate onClick={() => setActiveTab('rewards')} icon={Gift} accent="emerald" badge="Complimentary" title="Daily Free Claims" desc="Secure your complimentary login chips. Claim daily streaks, hourly micro-rewards, and spin the lucky wheel!" footLeft={`STREAK: ${player.dailyStreak || 1} Days`} footRight="Claim" />
                    <BentoGate onClick={() => setActiveTab('store')} icon={Coins} accent="cyan" badge="Secure Vault" title="Virtual Chip Store" desc="Acquire secure safe-guarded chip packs immediately to compete in high-stakes premium arena tables." footLeft={`WALLET: ${player.bankedChips.toLocaleString()} c`} footRight="Shop" />
                    <BentoGate onClick={() => setActiveTab('championships')} icon={Crown} accent="rose" badge="Tournament" title="Championships" desc="Enter elite championship events. Compete against top-ranked operators for massive chip prizes and exclusive titles." footLeft="SEASONAL EVENTS" footRight="Compete" />
                    <BentoGate onClick={() => setActiveTab('halloffame')} icon={Award} accent="yellow" badge="Legends" title="Hall of Fame" desc="View legendary players and record-breaking performances. The greatest venom operators of all time." footLeft="LEGENDARY RANKINGS" footRight="View Legends" />
                    <BentoGate onClick={() => setActiveTab('clans')} icon={Shield} accent="violet" badge="Team Ops" title="Syndicates" desc="Create or join a syndicate. Team up with allies, pool resources, and dominate arenas together." footLeft="CLAN WARFARE" footRight="Assemble" />
                    <BentoGate onClick={() => setActiveTab('seasonpass')} icon={Sparkles} accent="pink" badge="Pass XP" title="Season Pass" desc="Earn Pass XP from matches (50% of match XP, daily cap). Unlock cosmetics and chip rewards across 20 tiers." footLeft={player ? (() => { const tiers = PASS_TIER_XP.filter(x => (player.passXp ?? 0) >= x).length; const unclaimed = PASS_TIER_XP.filter((x, i) => (player.passXp ?? 0) >= x && !(player.passClaimedFree ?? []).includes(i + 1)).length; return unclaimed > 0 ? `Tier ${tiers}/20 · ${unclaimed} to claim!` : `Tier ${tiers}/20`; })() : 'EARN XP'}
                    footRight="View Pass" />
                    <BentoGate onClick={() => setActiveTab('clips')} icon={Film} accent="red" badge="Replays" title="Highlights" desc="Watch and share your greatest moments. Review match replays, clutch extractions, and legendary eliminations." footLeft="MATCH HIGHLIGHTS" footRight="Watch" />
                    <div className="relative">
                      <BentoGate onClick={() => setActiveTab('social')} icon={Users} accent="violet" badge="Friends & Search" title="Friends & Global Player Search" desc="Search players by name or tag, send chip gifts, block players, and manage your friend network!" footLeft="SOCIAL HUB" footRight="Connect" />
                      {pendingFriendCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">{pendingFriendCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Challenges (desktop) */}
              <div className="md:col-span-4 flex flex-col gap-1">
                <DashboardChallenges
                  missions={missions}
                  challengesLoading={challengesLoading}
                  challengeTier={challengeTier}
                  challengeStreak={challengeStreak}
                  streakMultiplier={streakMultiplier}
                  claimMission={claimMission}
                  lastResult={lastResult}
                />
              </div>
            </div>
          </>
        )}

        {/* ====== SUB-PAGE TAB ====== */}
        {activeTab !== 'dashboard' && (
          <div className="h-full min-h-0 flex flex-col va-fade-in">
            {/* Desktop: back button + tab strip */}
            <div className="hidden md:flex flex-col sm:flex-row items-start sm:items-center justify-between md:gap-1 bg-slate-900/40 border border-slate-800 rounded-2xl md:p-1.5 md:mb-1 shadow-md shrink-0">
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => setActiveTab('dashboard')} className="md:px-2 md:py-0.5 px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 md:text-[11px] text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-all cursor-pointer flex items-center gap-1.5 shadow">
                  <ChevronLeft className="w-4 h-4 text-indigo-400" /> Lobby HQ
                </button>
                <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />
                <div className="md:text-[11px] text-[10px] text-slate-500 font-mono hidden sm:block">STATION / {activeTab.toUpperCase()}</div>
              </div>
              <ScrollTabStrip
                tabs={visibleTabs.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon, activeColor: tab.activeColor }))}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as TabId)}
              />
            </div>

            {/* Mobile: compact panel header */}
            <div className="md:hidden shrink-0 flex items-center gap-2.5 px-3 py-2 border-b border-slate-800/80 bg-slate-950/50">
              <button onClick={() => setActiveTab('dashboard')} className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors">
                <ChevronLeft className="w-4 h-4 text-indigo-400" />
              </button>
              <span className="text-xs font-bold text-white tracking-wide uppercase">{PANEL_TITLES[activeTab] || activeTab}</span>
            </div>

            {/* Panel content — scrollable on mobile and desktop */}
            <div className="flex-1 min-h-0 overflow-y-auto va-scroll">
              {activeTab === 'arena' && <ArenaSelector onPlay={handlePlayArena} onToast={toastFn} />}
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
              {activeTab === 'social' && <SocialPanel onToast={toastFn} onInspectPlayer={handleInspectPlayer} />}
              {activeTab === 'admin' && player?.role === 'admin' && <AdminPanel onToast={toastFn} />}
            </div>
          </div>
        )}
      </main>

      {/* ===================== FOOTER (desktop only) ===================== */}
      <footer className="hidden md:block shrink-0 border-t border-slate-900/60 bg-slate-950/40 py-0.5 mt-auto text-center text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="font-sans">&copy; 2026 Project Venom Arena. All Rights Reserved. Fully store-safe, non-gambling gameplay edition.</p>
          <div className="flex gap-4 font-mono text-[11px] text-slate-400">
            <span>APP_VERSION: 1.0.0-MVP</span>
            <span>ENGINE: TSX_CANVAS</span>
          </div>
        </div>
      </footer>

      {/* ===================== BOTTOM TAB BAR (mobile only) ===================== */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabId)}
        onMoreOpen={() => setMoreMenuOpen(true)}
      />

      {/* ===================== MORE MENU OVERLAY ===================== */}
      <MoreMenu
        isOpen={moreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        onSelectTab={(tab) => { setActiveTab(tab as TabId); setMoreMenuOpen(false); }}
        isAdmin={player.role === 'admin'}
      />

      {/* ===================== MODALS ===================== */}
      <GameRulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      {/* AdminGameTuning will be restored in Phase 7 */}
      <PlayerInspectorModal player={inspectedPlayer} onClose={() => setInspectedPlayer(null)} onToast={toastFn} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Challenges (shared between mobile & desktop)
// ---------------------------------------------------------------------------

function DashboardChallenges({
  missions, challengesLoading, challengeTier, challengeStreak, streakMultiplier, claimMission, lastResult, compact,
}: {
  missions: Mission[];
  challengesLoading: boolean;
  challengeTier: string;
  challengeStreak: number;
  streakMultiplier: number;
  claimMission: (m: Mission) => void;
  lastResult?: MatchResult;
  compact?: boolean;
}) {
  return (
    <section className={`${compact ? 'flex-1 flex flex-col' : 'bg-slate-900/60 border border-slate-800/80 rounded-lg p-1.5 shadow-lg flex flex-col gap-0.5'}`} aria-label="Tactical challenges">
      {/* Header */}
      <div className={`${compact ? 'shrink-0 flex items-center justify-between px-1' : 'flex items-center justify-between border-b border-slate-800 pb-1'}`}>
        <div className="flex items-center gap-2">
          <ListTodo className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-[11px] font-bold text-white font-sans uppercase tracking-wider">Tactical Challenges</span>
          {challengeTier && (
            <span className={`text-[11px] px-1.5 py-0 font-bold rounded font-sans uppercase ${
              challengeTier === 'elite' ? 'bg-red-500/15 border border-red-500/20 text-red-400' :
              challengeTier === 'veteran' ? 'bg-amber-500/15 border border-amber-500/20 text-amber-400' :
              challengeTier === 'operative' ? 'bg-cyan-500/15 border border-cyan-500/20 text-cyan-400' :
              'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400'
            }`}>{challengeTier}</span>
          )}
        </div>
        {streakMultiplier > 1 ? (
          <span className="text-[11px] font-mono text-amber-400 font-bold">🔥 {challengeStreak}d streak ×{streakMultiplier}</span>
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        )}
      </div>

      {/* Content */}
      {challengesLoading && missions.length === 0 ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span className="text-[11px] text-slate-400 ml-2">Loading challenges…</span>
        </div>
      ) : missions.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-[11px] text-slate-500 font-sans">No challenges available right now.</p>
        </div>
      ) : (
        <div className={`flex flex-col gap-2 ${compact ? 'flex-1' : 'flex flex-col gap-0'}`}>
          {/* Daily */}
          {(() => {
            const dailies = missions.filter((m) => m.type === 'daily');
            if (dailies.length === 0) return null;
            return (
              <div className="flex flex-col gap-0">
                {compact ? (
                  <div className="flex items-center gap-1.5">
                    <Sunrise className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-bold text-amber-400 font-sans uppercase tracking-widest">Daily ({dailies.length})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 border-b border-slate-800/40">
                    <Sunrise className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-bold text-amber-400 font-sans uppercase tracking-widest">Daily ({dailies.length})</span>
                  </div>
                )}
                {dailies.map((m) => <ChallengeCard key={m.id} mission={m} onClaim={claimMission} row={!compact} />)}
              </div>
            );
          })()}

          {/* Weekly */}
          {(() => {
            const weeklies = missions.filter((m) => m.type === 'weekly');
            if (weeklies.length === 0) return null;
            return (
              <div className="flex flex-col gap-0">
                {compact ? (
                  <div className="flex items-center gap-1.5 border-t border-slate-800 pt-1.5 mt-0.5">
                    <Star className="w-3 h-3 text-violet-400" />
                    <span className="text-[11px] font-bold text-violet-400 font-sans uppercase tracking-widest">Weekly ({weeklies.length})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 border-t border-slate-800 pt-1">
                    <Star className="w-3 h-3 text-violet-400" />
                    <span className="text-[11px] font-bold text-violet-400 font-sans uppercase tracking-widest">Weekly ({weeklies.length})</span>
                  </div>
                )}
                {weeklies.map((m) => <ChallengeCard key={m.id} mission={m} onClaim={claimMission} row={!compact} />)}
              </div>
            );
          })()}
        </div>
      )}

      {/* Last match (desktop only — mobile shows it above challenges) */}
      {!compact && lastResult && (
        <div className="mt-1 p-1.5 rounded-lg border border-slate-800 bg-slate-950/80">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">Last Match</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm">{lastResult.outcome === 'extract' ? '🏆' : '💀'}</span>
            <div className="text-[11px] text-slate-300 leading-tight">
              <p className="font-bold text-white">{lastResult.outcome === 'extract' ? 'Extracted' : 'Eliminated'} · {lastResult.arenaName}</p>
              <p className="text-[11px] text-slate-500">{lastResult.chipsExtracted.toLocaleString()}c · {lastResult.kills} kills · +{lastResult.xpGained} XP · {Math.floor(lastResult.durationSeconds)}s</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Challenge Card (shared)
// ---------------------------------------------------------------------------

function ChallengeCard({ mission, onClaim, row }: { mission: Mission; onClaim: (m: Mission) => void; row?: boolean }) {
  const percent = Math.min(100, Math.floor((mission.current / mission.target) * 100));
  const isWeekly = mission.type === 'weekly';
  const barClass = mission.claimed ? 'bg-emerald-600' :
    mission.completed ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
    isWeekly ? 'bg-gradient-to-r from-violet-500 to-purple-500' : 'bg-gradient-to-r from-amber-500 to-orange-500';
  const btnClass = mission.claimed ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' :
    mission.completed ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-black shadow shadow-emerald-950/20' :
    'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed';

  if (row) {
    return (
      <div className="py-0.5 border-b border-slate-800/40 last:border-b-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isWeekly ? 'bg-violet-400' : 'bg-amber-400'}`} />
          <span className="text-[11px] font-bold text-white shrink-0">{mission.title}</span>
          <span className="text-[11px] font-mono text-slate-500 shrink-0">{mission.current}/{mission.target} ({percent}%)</span>
          <div className="flex-1 h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800/60 min-w-[40px]">
            <div className={`h-full rounded-full transition-all duration-300 ${barClass}`} style={{ width: `${percent}%` }} />
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">+{mission.reward} CHIPS</span>
          <button
            onClick={() => void onClaim(mission)}
            disabled={!mission.completed || mission.claimed}
            className={`px-1.5 py-0 rounded-md text-[11px] font-sans font-bold transition-all cursor-pointer shrink-0 ${btnClass}`}
          >{mission.claimed ? 'Claimed ✓' : 'Claim'}</button>
        </div>
        <p className="text-[11px] text-slate-400 font-sans leading-tight pl-3">{mission.description}</p>
      </div>
    );
  }

  return (
    <div className={`p-2 bg-slate-950/90 rounded-lg border ${isWeekly ? 'border-violet-500/20' : 'border-slate-800'} flex flex-col gap-1.5`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-[11px] font-bold text-white font-sans leading-snug">{mission.title}</h4>
          <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-normal">{mission.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span>PROGRESS:</span>
        <span>{mission.current} / {mission.target} ({percent}%)</span>
      </div>
      <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800/60">
        <div className={`h-full rounded-full transition-all duration-300 ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex justify-between items-center pt-1.5 border-t border-slate-900/40">
        <span className="text-[11px] font-mono font-bold text-emerald-400">+{mission.reward} CHIPS</span>
        <button
          onClick={() => void onClaim(mission)}
          disabled={!mission.completed || mission.claimed}
          className={`px-2 py-0.5 rounded-md text-[11px] font-sans font-bold transition-all cursor-pointer ${btnClass}`}
        >{mission.claimed ? 'Claimed ✓' : 'Claim'}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bento gate card (desktop dashboard only)
// ---------------------------------------------------------------------------

interface BentoGateProps {
  icon: typeof Compass;
  accent: 'indigo' | 'purple' | 'blue' | 'amber' | 'yellow' | 'emerald' | 'violet' | 'red' | 'cyan' | 'rose' | 'pink';
  badge: string;
  title: string;
  desc: string;
  footLeft: string;
  footRight: string;
  onClick: () => void;
  wide?: boolean;
}

const ACCENT_CLASSES: Record<BentoGateProps['accent'], { iconBg: string; badgeBg: string; borderHover: string; textHover: string; arrow: string }> = {
  indigo: { iconBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400', badgeBg: 'bg-indigo-500/15 border-indigo-500/20 text-indigo-400', borderHover: 'hover:border-indigo-500/40', textHover: 'group-hover:text-indigo-400', arrow: 'text-indigo-400' },
  purple: { iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400', badgeBg: 'bg-purple-500/15 border-purple-500/20 text-purple-400', borderHover: 'hover:border-purple-500/40', textHover: 'group-hover:text-purple-400', arrow: 'text-purple-400' },
  blue: { iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400', badgeBg: 'bg-blue-500/15 border-blue-500/20 text-blue-400', borderHover: 'hover:border-blue-500/40', textHover: 'group-hover:text-blue-400', arrow: 'text-blue-400' },
  amber: { iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400', badgeBg: 'bg-amber-500/15 border-amber-500/20 text-amber-400', borderHover: 'hover:border-amber-500/40', textHover: 'group-hover:text-amber-400', arrow: 'text-amber-400' },
  yellow: { iconBg: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400', badgeBg: 'bg-yellow-500/15 border-yellow-500/20 text-yellow-400', borderHover: 'hover:border-yellow-500/40', textHover: 'group-hover:text-yellow-400', arrow: 'text-yellow-400' },
  emerald: { iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', badgeBg: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400', borderHover: 'hover:border-emerald-500/40', textHover: 'group-hover:text-emerald-400', arrow: 'text-emerald-400' },
  violet: { iconBg: 'bg-violet-500/10 border-violet-500/20 text-violet-400', badgeBg: 'bg-violet-500/15 border-violet-500/20 text-violet-400', borderHover: 'hover:border-violet-500/40', textHover: 'group-hover:text-violet-400', arrow: 'text-violet-400' },
  red: { iconBg: 'bg-red-500/10 border-red-500/20 text-red-400', badgeBg: 'bg-red-500/15 border-red-500/20 text-red-400', borderHover: 'hover:border-red-500/40', textHover: 'group-hover:text-red-400', arrow: 'text-red-400' },
  cyan: { iconBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400', badgeBg: 'bg-cyan-500/15 border-cyan-500/20 text-cyan-400', borderHover: 'hover:border-cyan-500/40', textHover: 'group-hover:text-cyan-400', arrow: 'text-cyan-400' },
  rose: { iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400', badgeBg: 'bg-rose-500/15 border-rose-500/20 text-rose-400', borderHover: 'hover:border-rose-500/40', textHover: 'group-hover:text-rose-400', arrow: 'text-rose-400' },
  pink: { iconBg: 'bg-pink-500/10 border-pink-500/20 text-pink-400', badgeBg: 'bg-pink-500/15 border-pink-500/20 text-pink-400', borderHover: 'hover:border-pink-500/40', textHover: 'group-hover:text-pink-400', arrow: 'text-pink-400' },
};

function BentoGate({ icon: Icon, accent, badge, title, desc, footLeft, footRight, onClick, wide }: BentoGateProps) {
  const c = ACCENT_CLASSES[accent];
  return (
    <button onClick={onClick} className={`p-1 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 ${c.borderHover} rounded-lg cursor-pointer transition-all duration-300 group shadow-sm flex flex-col justify-between text-left`}>
      <div className="flex items-start justify-between">
        <div className={`w-5 h-5 rounded ${c.iconBg} border flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className="w-3 h-3" />
        </div>
        <span className={`text-[11px] px-1 py-0 ${c.badgeBg} border font-bold font-sans rounded-full uppercase`}>{badge}</span>
      </div>
      <div>
        <h3 className={`text-[11px] font-bold text-white ${c.textHover} transition-colors`}>{title}</h3>
        <p className="text-[11px] text-slate-400 font-sans leading-tight">{desc}</p>
      </div>
      <div className="text-[11px] font-mono text-slate-500 border-t border-slate-800/40 pt-0.5 flex justify-between">
        <span className="pr-2">{footLeft}</span>
        <span className={`${c.arrow} group-hover:translate-x-1 transition-transform shrink-0`}>{footRight} →</span>
      </div>
    </button>
  );
}
