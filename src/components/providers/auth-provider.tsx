'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PlayerProfile } from '@/lib/types';
import { apiUrl } from '@/lib/api-base';

interface AuthCtx {
  player: PlayerProfile | null;
  loading: boolean;
  /** Audit U10: true when /api/auth/me rejected the session because the account is banned */
  banned: boolean;
  refresh: () => Promise<void>;
  setPlayer: (p: PlayerProfile | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  player: null,
  loading: true,
  banned: false,
  refresh: async () => {},
  setPlayer: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { cache: 'no-store' });
      if (!res.ok) {
        setPlayer(null);
        // Audit U10: distinguish "banned" from any other auth failure so the
        // UI can show an explicit notice instead of silently logging out.
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setBanned(res.status === 403 && data.error === 'banned');
        return;
      }
      const data = await res.json();
      setPlayer(data.player || null);
      setBanned(false);
    } catch {
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST' });
    } catch {}
    setPlayer(null);
    setBanned(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ player, loading, banned, refresh, setPlayer, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
