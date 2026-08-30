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
  const userTag = String(body.userTag || '').trim();
  const rawAmount = Number(body.amount);

  if (!userTag) {
    return NextResponse.json({ error: 'userTag required' }, { status: 400 });
  }
  if (!Number.isFinite(rawAmount) || rawAmount === 0) {
    return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 });
  }
  // Round to int — chips are integers
  const amount = Math.trunc(rawAmount);

  // Atomic update with clamping at 0 (no negative banked balances) — use transaction
  let profile: PlayerProfile;
  try {
    profile = await db.$transaction(async (tx) => {
      const target = await tx.player.findUnique({ where: { userTag } });
      if (!target) throw { code: 'NOT_FOUND' };

      const newChips = Math.max(0, target.bankedChips + amount);

      const updated = await tx.player.update({
        where: { userTag },
        data: {
          bankedChips: newChips,
          totalEarned: amount > 0 ? target.totalEarned + amount : target.totalEarned,
          totalLost: amount < 0 ? target.totalLost + Math.abs(amount) : target.totalLost,
          lastSeenAt: new Date(),
        },
      });

      return toProfile(updated);
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, player: profile });
}
