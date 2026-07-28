import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toProfile } from '@/lib/player-helpers';
import type { PlayerProfile } from '@/lib/types';

// POST /api/admin/modify-chips  body: { userTag: string, amount: number }
// Admin-only. Atomically adjusts target player's bankedChips by amount (+/-).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userTag = String(body.userTag || '').toUpperCase().trim();
  const rawAmount = Number(body.amount);

  if (!userTag) {
    return NextResponse.json({ error: 'userTag required' }, { status: 400 });
  }
  if (!Number.isFinite(rawAmount) || rawAmount === 0) {
    return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 });
  }
  // Round to int — chips are integers
  const amount = Math.trunc(rawAmount);

  // Atomic update with clamping at 0 (no negative banked balances)
  const target = await db.player.findUnique({ where: { userTag } });
  if (!target) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const newChips = Math.max(0, target.bankedChips + amount);

  const updated = await db.player.update({
    where: { userTag },
    data: {
      bankedChips: newChips,
      // Reflect in totalEarned / totalLost for audit trail
      totalEarned: amount > 0 ? target.totalEarned + amount : target.totalEarned,
      totalLost: amount < 0 ? target.totalLost + Math.abs(amount) : target.totalLost,
      lastSeenAt: new Date(),
    },
  });

  const profile: PlayerProfile = toProfile(updated);
  return NextResponse.json({ ok: true, player: profile });
}
