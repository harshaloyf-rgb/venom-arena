'use client';

/**
 * Venom Arena — Main Page
 * Simplified lobby: auth gate → mode selection (offline/online) → game canvas
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import AuthGate from '@/components/auth/auth-gate';
import OfflineGame from '@/components/game/offline-game';
import OnlineGame from '@/components/game/online-game';
import {
  Gamepad2,
  Wifi,
  WifiOff,
  Swords,
  Trophy,
  Zap,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---- Types ----
type GameMode = 'lobby' | 'offline' | 'online';
type Difficulty = 'easy' | 'medium' | 'hard';

// ---- Component ----
export default function HomePage() {
  const { player, logout } = useAuth();
  const [mode, setMode] = useState<GameMode>('lobby');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [lastResult, setLastResult] = useState<{ score: number; kills: number } | null>(null);

  const handleExit = useCallback((score: number, kills: number) => {
    setLastResult({ score, kills });
    setMode('lobby');
  }, []);

  const handleOnlineExit = useCallback(() => {
    setMode('lobby');
  }, []);

  // ---- Auth Gate (login/register) ----
  if (!player) {
    return <AuthGate />;
  }

  // ---- Game Mode ----
  if (mode === 'offline') {
    return <div className="h-dvh"><OfflineGame difficulty={difficulty} onExit={handleExit} /></div>;
  }

  if (mode === 'online') {
    return (
      <div className="h-dvh"><OnlineGame
        playerName={player.name}
        userTag={player.userTag}
        onExit={handleOnlineExit}
      /></div>
    );
  }

  // ---- Lobby ----
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gamepad2 className="h-6 w-6 text-emerald-500" />
            <h1 className="text-lg font-bold tracking-tight">VENOM ARENA</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {player.name} ({player.userTag})
            </span>
            <span className="text-sm font-mono text-amber-500">
              {player.bankedChips}chips
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Lobby */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Welcome */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">
              Welcome back, <span className="text-emerald-500">{player.name}</span>
            </h2>
            {lastResult && (
              <p className="text-sm text-muted-foreground">
                Last game: <span className="text-amber-500">{lastResult.score}</span> pts,{' '}
                <span className="text-red-400">{lastResult.kills}</span> kills
              </p>
            )}
          </div>

          {/* Offline Practice */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <WifiOff className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Practice Arena</h3>
                <p className="text-sm text-muted-foreground">
                  Play offline with bots. No chips at risk.
                </p>
              </div>
            </div>

            {/* Difficulty selector */}
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors border ${
                    difficulty === d
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                      : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                  <span className="block text-xs mt-0.5 opacity-60">
                    {d === 'easy' ? '10 bots' : d === 'medium' ? '20 bots' : '30 bots'}
                  </span>
                </button>
              ))}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => setMode('offline')}
            >
              <Zap className="h-4 w-4 mr-2" />
              Start Practice (Free)
            </Button>
          </div>

          {/* Online PVP */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Wifi className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold">Online PVP</h3>
                <p className="text-sm text-muted-foreground">
                  Battle real players and bots. Earn and risk chips.
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => setMode('online')}
            >
              <Swords className="h-4 w-4 mr-2" />
              Enter Arena
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border border-border bg-card p-3">
              <Trophy className="h-4 w-4 mx-auto mb-1 text-amber-500" />
              <div className="text-lg font-bold">{player.bankedChips}</div>
              <div className="text-xs text-muted-foreground">Chips</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <Swords className="h-4 w-4 mx-auto mb-1 text-red-400" />
              <div className="text-lg font-bold">{player.lifetimeKills}</div>
              <div className="text-xs text-muted-foreground">Kills</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <ArrowLeft className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
              <div className="text-lg font-bold">{player.lifetimeExtracts}</div>
              <div className="text-xs text-muted-foreground">Extracts</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground mt-auto">
        Venom Arena v1.0.0-MVP
      </footer>
    </div>
  );
}
