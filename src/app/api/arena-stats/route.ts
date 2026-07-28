import { NextResponse } from 'next/server';
import { ALL_ARENAS, MAX_ARENA_PLAYERS } from '@/lib/game-config';

// GET /api/arena-stats
// Returns live player counts per arena (proxied from game-server /stats endpoint).
// Falls back to maxPlayers=MAX_ARENA_PLAYERS and players=0 if game server unreachable.
export async function GET() {
  // Try to fetch live stats from the game server
  try {
    const res = await fetch('http://localhost:3001/stats', {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      // Merge with ALL_ARENAS to ensure every arena has an entry
      const merged: Record<string, { players: number; maxPlayers: number }> = {};
      for (const arena of ALL_ARENAS) {
        const live = data[arena.id];
        merged[arena.id] = {
          players: live?.players ?? 0,
          maxPlayers: MAX_ARENA_PLAYERS,
        };
      }
      return NextResponse.json(merged);
    }
  } catch {
    // Game server unreachable — return static data
  }

  // Fallback: no game server connection
  const fallback: Record<string, { players: number; maxPlayers: number }> = {};
  for (const arena of ALL_ARENAS) {
    fallback[arena.id] = { players: 0, maxPlayers: MAX_ARENA_PLAYERS };
  }
  return NextResponse.json(fallback);
}
