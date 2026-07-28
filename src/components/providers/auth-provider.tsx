'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PlayerProfile } from '@/lib/types';

interface AuthCtx {
  player: PlayerProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setPlayer: (p: PlayerProfile | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  player: null,
  loading: true,
  refresh: async () => {},
  setPlayer: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) {
        setPlayer(null);
        return;
      }
      const data = await res.json();
      setPlayer(data.player || null);
    } catch {
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setPlayer(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ player, loading, refresh, setPlayer, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
