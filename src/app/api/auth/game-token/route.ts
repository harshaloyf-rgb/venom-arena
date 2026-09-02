import { NextResponse } from 'next/server';
import { getSession, signSession } from '@/lib/auth';

// GET /api/auth/game-token
// Returns a short-lived JWT for the Socket.IO game server.
// The session cookie is httpOnly, so the browser can't read it.
// This endpoint re-signs a 1-hour token for game auth.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const token = await signSession({
      playerId: session.playerId,
      userTag: session.userTag,
      role: session.role,
      scope: 'game', // audit A2: 1h WS-only credential — rejected as a session cookie
    }, '1h');
    return NextResponse.json({ token });
  } catch (e) {
    console.error('[game-token] error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
