import { NextResponse } from 'next/server';
import { getSession, signSession } from '@/lib/auth';

/**
 * Returns a short-lived JWT for Socket.IO auth.
 *
 * The httpOnly session cookie cannot be read by client-side JS, so the canvas
 * fetches this endpoint to obtain a fresh token to pass in
 * `socket.auth = { token }`. The token is re-signed from the current session
 * (not the same as the cookie token — it is freshly minted on each call so
 * we never expose the cookie value itself).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ token: null }, { status: 401 });
    }
    const token = await signSession({
      playerId: session.playerId,
      userTag: session.userTag,
      role: session.role,
    }, '24h');
    return NextResponse.json({ token });
  } catch (e) {
    console.error('[auth/token] sign error', e);
    return NextResponse.json({ token: null, error: 'sign_failed' }, { status: 500 });
  }
}
