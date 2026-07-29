import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/clans/deposit  body: { tag, amount }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tag = String(body.tag || '').toUpperCase().trim();
  const amount = Math.floor(Number(body.amount) || 0);

  if (!tag || amount <= 0) {
    return NextResponse.json({ error: 'Invalid tag or amount.' }, { status: 400 });
  }
  if (amount > 1_000_000) {
    return NextResponse.json({ error: 'Max deposit is 1,000,000 chips per transaction.' }, { status: 400 });
  }

  const me = await db.player.findUnique({ where: { id: session.playerId } });
  if (!me) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (me.clanTag !== tag) return NextResponse.json({ error: 'You are not a member of this clan.' }, { status: 403 });
  if (me.bankedChips < amount) return NextResponse.json({ error: 'Insufficient chips.' }, { status: 400 });

  const clan = await db.clan.findUnique({ where: { tag } });
  if (!clan) return NextResponse.json({ error: 'Clan not found.' }, { status: 404 });

  // Atomic: deduct from player, add to clan treasury
  await db.$transaction([
    db.player.update({
      where: { id: me.id },
      data: { bankedChips: { decrement: amount }, totalLost: { increment: amount } },
    }),
    db.clan.update({
      where: { tag },
      data: { bankedChips: { increment: amount } },
    }),
  ]);

  const updated = await db.clan.findUnique({ where: { tag }, select: { bankedChips: true } });
  return NextResponse.json({ ok: true, newTreasury: updated?.bankedChips || 0 });
}
