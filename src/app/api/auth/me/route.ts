import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile, ensureReferralCode } from '@/lib/player-helpers';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ player: null });
    }
    let player = await db.player.findUnique({ where: { id: session.playerId } });
    if (!player) {
      return NextResponse.json({ player: null });
    }
    if (player.banned) {
      return NextResponse.json({ error: 'banned' }, { status: 403 });
    }

    // Auto-generate referral code for existing users who don't have one
    if (!player.referralCode) {
      await ensureReferralCode(player.id);
      const refreshed = await db.player.findUnique({ where: { id: session.playerId } });
      if (!refreshed) return NextResponse.json({ player: null }, { status: 500 });
      player = refreshed;
    }

    return NextResponse.json({ player: toProfile(player) });
  } catch (e) {
    console.error('[auth/me] error', e);
    return NextResponse.json({ player: null }, { status: 500 });
  }
}